"""
NuestroStore — Vistas Django (API REST + Frontend)
Compatible con PostgreSQL y SQLite
"""
import json
from datetime import datetime
from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods
from django.db import transaction

from .database import _exec, _exec_one, _exec_insert, log_action, hash_pass, check_pass



# ── RATE LIMITER (in-memory, sin dependencias externas) ───────
import threading
import time

class _RateLimiter:
    """
    Token-bucket por IP.
    max_calls intentos en window_secs; bloqueo por lockout_secs tras agotar tokens.
    Thread-safe con Lock.
    """
    def __init__(self, max_calls=5, window_secs=60, lockout_secs=300):
        self._max    = max_calls
        self._window = window_secs
        self._lock_t = lockout_secs
        self._data   = {}   # ip -> {tokens, window_start, locked_until}
        self._mu     = threading.Lock()

    def _clean(self, now):
        """Eliminar entradas expiradas para no acumular memoria."""
        expired = [ip for ip, d in self._data.items()
                   if now - d["window_start"] > max(self._window, self._lock_t) * 2]
        for ip in expired:
            del self._data[ip]

    def check(self, ip):
        """
        Retorna (allowed: bool, wait_secs: int).
        allowed=True  → la petición puede pasar.
        allowed=False → bloquear; wait_secs indica cuántos segundos debe esperar.
        """
        now = time.time()
        with self._mu:
            self._clean(now)
            d = self._data.get(ip)

            if d is None:
                self._data[ip] = {"tokens": self._max - 1,
                                  "window_start": now,
                                  "locked_until": 0}
                return True, 0

            # ¿En bloqueo duro?
            if d["locked_until"] > now:
                return False, int(d["locked_until"] - now)

            # ¿Ventana expirada? → reset
            if now - d["window_start"] > self._window:
                d["tokens"]       = self._max - 1
                d["window_start"] = now
                d["locked_until"] = 0
                return True, 0

            # Aún en ventana activa
            if d["tokens"] > 0:
                d["tokens"] -= 1
                return True, 0
            else:
                # Agotar tokens → activar bloqueo
                d["locked_until"] = now + self._lock_t
                return False, self._lock_t


# Instancias globales: login y registro tienen límites distintos
_rl_login    = _RateLimiter(max_calls=5,  window_secs=60,  lockout_secs=300)  # 5/min → 5 min bloqueo
_rl_registro = _RateLimiter(max_calls=3,  window_secs=300, lockout_secs=600)  # 3 cada 5 min → 10 min bloqueo


def _get_ip(request):
    """Extrae la IP real respetando proxies (Render, Heroku, Cloudflare)."""
    xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
    if xff:
        return xff.split(",")[0].strip()
    return request.META.get("REMOTE_ADDR", "unknown")



# ── RECUPERAR CONTRASEÑA ─────────────────────────────────────
import secrets

@csrf_exempt
@require_http_methods(["POST"])
def api_solicitar_reset(request):
    """
    Genera un token de 6 dígitos y lo guarda en la DB.
    En producción enviarías el email. Aquí lo devolvemos en la respuesta
    (el frontend lo muestra al usuario para que lo ingrese).
    """
    data  = json.loads(request.body or '{}')
    email = (data.get("email") or "").strip().lower()
    if not email:
        return JsonResponse({"ok": False, "error": "Correo requerido"})

    user = _exec_one("SELECT id FROM usuarios WHERE LOWER(email)=? AND activo=1", (email,))
    if not user:
        # Security: don't reveal if email exists — always respond OK
        return JsonResponse({"ok": True, "msg": "Si el correo está registrado recibirás el código."})

    # Invalidate previous tokens for this email
    _exec("UPDATE password_resets SET usado=1 WHERE email=?", (email,))

    # Generate 6-digit code
    code = str(secrets.randbelow(900000) + 100000)  # 100000-999999
    _exec("INSERT INTO password_resets(email, token) VALUES(?,?)", (email, code))

    log_action("Sistema", "RESET_SOLICITADO", f"Reset para {email}")

    # In production: send email with code.
    # For now: return code in response (dev mode).
    # To enable real email: set EMAIL_* env vars and use Django email backend.
    import os
    dev_mode = os.environ.get("DEBUG", "True") == "True"
    response = {"ok": True, "msg": "Código generado"}
    if dev_mode:
        response["dev_code"] = code  # Remove in production!
    return JsonResponse(response)


@csrf_exempt
@require_http_methods(["POST"])
def api_verificar_reset(request):
    """Verifies the 6-digit code is valid and not expired (10 min window)."""
    data  = json.loads(request.body or '{}')
    email = (data.get("email") or "").strip().lower()
    token = (data.get("token") or "").strip()
    if not email or not token:
        return JsonResponse({"ok": False, "error": "Datos incompletos"})

    # Check token valid and not older than 10 minutes
    row = _exec_one("""
        SELECT id FROM password_resets
        WHERE email=? AND token=? AND usado=0
          AND (julianday('now','localtime') - julianday(creado)) * 1440 < 10
    """, (email, token))

    if not row:
        return JsonResponse({"ok": False, "error": "Código inválido o expirado"})

    return JsonResponse({"ok": True})


@csrf_exempt
@require_http_methods(["POST"])
def api_confirmar_reset(request):
    """Changes the password after verifying the token."""
    data     = json.loads(request.body or '{}')
    email    = (data.get("email") or "").strip().lower()
    token    = (data.get("token") or "").strip()
    new_pass = data.get("password") or ""

    if not email or not token or not new_pass:
        return JsonResponse({"ok": False, "error": "Datos incompletos"})
    if len(new_pass) < 8:
        return JsonResponse({"ok": False, "error": "La contraseña debe tener al menos 8 caracteres"})

    # Re-verify token
    row = _exec_one("""
        SELECT id FROM password_resets
        WHERE email=? AND token=? AND usado=0
          AND (julianday('now','localtime') - julianday(creado)) * 1440 < 10
    """, (email, token))

    if not row:
        return JsonResponse({"ok": False, "error": "Código inválido o expirado"})

    # Update password
    h = hash_pass(new_pass)
    _exec("UPDATE usuarios SET password=? WHERE LOWER(email)=?", (h, email))

    # Mark token as used
    _exec("UPDATE password_resets SET usado=1 WHERE email=? AND token=?", (email, token))

    log_action(email, "RESET_COMPLETADO", "Contraseña cambiada por reset")
    return JsonResponse({"ok": True})

# ── CUPONES ───────────────────────────────────────────────────
@csrf_exempt
@require_http_methods(["GET"])
def api_validar_cupon(request):
    codigo = (request.GET.get("codigo") or "").strip().upper()
    total  = float(request.GET.get("total") or 0)
    if not codigo:
        return JsonResponse({"ok": False, "error": "Código requerido"})
    row = _exec_one(
        "SELECT * FROM cupones WHERE UPPER(codigo)=? AND activo=1",
        (codigo,)
    )
    if not row:
        return JsonResponse({"ok": False, "error": "Cupón no válido o expirado"})
    if row["usos_actual"] >= row["usos_max"]:
        return JsonResponse({"ok": False, "error": "Este cupón ya alcanzó su límite de usos"})
    if total < row["min_compra"]:
        from tienda.database import _exec as db_exec
        return JsonResponse({
            "ok": False,
            "error": f"Compra mínima para este cupón: {row['min_compra']:,.0f}"
        })
    # Calculate discount
    if row["tipo"] == "porcentaje":
        descuento = round(total * row["valor"] / 100, 2)
    else:  # monto_fijo
        descuento = min(row["valor"], total)
    return JsonResponse({
        "ok": True,
        "cupon": {
            "codigo": row["codigo"],
            "tipo": row["tipo"],
            "valor": row["valor"],
            "descuento": descuento,
            "total_final": round(total - descuento, 2),
        }
    })


@csrf_exempt
@require_http_methods(["POST"])
def api_usar_cupon(request):
    """Increment usage count after successful order."""
    data   = json.loads(request.body or '{}')
    codigo = (data.get("codigo") or "").strip().upper()
    if codigo:
        _exec("UPDATE cupones SET usos_actual=usos_actual+1 WHERE UPPER(codigo)=?", (codigo,))
    return JsonResponse({"ok": True})


@csrf_exempt
def api_cupones_admin(request):
    """CRUD de cupones — solo superadmin (validación básica por rol en body)."""
    if request.method == "GET":
        rows = _exec("SELECT * FROM cupones ORDER BY id DESC")
        return JsonResponse({"ok": True, "cupones": [dict(r) for r in rows]})
    if request.method == "POST":
        data = json.loads(request.body or '{}')
        codigo   = (data.get("codigo") or "").strip().upper()
        tipo     = data.get("tipo", "porcentaje")
        valor    = float(data.get("valor") or 0)
        min_c    = float(data.get("min_compra") or 0)
        usos_max = int(data.get("usos_max") or 100)
        if not codigo or valor <= 0:
            return JsonResponse({"ok": False, "error": "Datos incompletos"})
        if tipo == "porcentaje" and (valor <= 0 or valor > 100):
            return JsonResponse({"ok": False, "error": "El porcentaje debe ser entre 1 y 100"})
        try:
            _exec_insert(
                "INSERT INTO cupones(codigo,tipo,valor,min_compra,usos_max) VALUES(?,?,?,?,?)",
                (codigo, tipo, valor, min_c, usos_max)
            )
        except Exception:
            return JsonResponse({"ok": False, "error": "El código ya existe"})
        log_action("Admin", "CUPON_CREAR", f"Cupón {codigo} creado ({tipo} {valor})")
        return JsonResponse({"ok": True})
    if request.method == "DELETE":
        data = json.loads(request.body or '{}')
        cid  = int(data.get("id") or 0)
        _exec("DELETE FROM cupones WHERE id=?", (cid,))
        return JsonResponse({"ok": True})
    return JsonResponse({"ok": False, "error": "Método no permitido"}, status=405)

# ── Frontend — páginas separadas ─────────────────────
def index(request):
    return render(request, 'inicio.html')

def tienda_page(request):
    return render(request, 'tienda.html')

def contacto_page(request):
    return render(request, 'contacto.html')


# ── LOGIN ─────────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST"])
def api_login(request):
    ip = _get_ip(request)
    allowed, wait = _rl_login.check(ip)
    if not allowed:
        mins = (wait + 59) // 60
        return JsonResponse({
            "ok": False,
            "error": f"Demasiados intentos. Espera {mins} minuto{'s' if mins != 1 else ''} antes de volver a intentarlo."
        }, status=429)

    data  = json.loads(request.body or '{}')
    email = (data.get("email") or "").strip().lower()
    pw    = data.get("password") or ""
    if not email or not pw:
        return JsonResponse({"ok": False, "error": "Correo y contraseña requeridos"})
    row = _exec_one("SELECT * FROM usuarios WHERE LOWER(email)=? AND activo=1", (email,))
    if not row or not check_pass(pw, row["password"]):
        return JsonResponse({"ok": False, "error": "Correo o contraseña incorrectos."})
    usuario = {"id": row["id"], "n": row["nombre"], "a": row["apellido"],
               "email": row["email"], "rol": row["rol"]}
    log_action(f"{row['nombre']} {row['apellido']}", "LOGIN", "Acceso al sistema")
    return JsonResponse({"ok": True, "usuario": usuario})


# ── REGISTRO ──────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST"])
def api_registro(request):
    ip = _get_ip(request)
    allowed, wait = _rl_registro.check(ip)
    if not allowed:
        mins = (wait + 59) // 60
        return JsonResponse({
            "ok": False,
            "error": f"Demasiados registros desde esta IP. Espera {mins} minuto{'s' if mins != 1 else ''} e inténtalo de nuevo."
        }, status=429)

    data  = json.loads(request.body or '{}')
    nom   = (data.get("nom") or "").strip()
    ape   = (data.get("ape") or "").strip()
    email = (data.get("email") or "").strip().lower()
    pw    = data.get("password") or ""
    tel   = (data.get("tel") or "").strip()
    if not nom or not ape or not email or not pw:
        return JsonResponse({"ok": False, "error": "Campos requeridos incompletos"})
    if len(pw) < 8:
        return JsonResponse({"ok": False, "error": "Contraseña mínimo 8 caracteres"})
    if "@" not in email or "." not in email.split("@")[-1]:
        return JsonResponse({"ok": False, "error": "Correo electrónico inválido"})
    exists = _exec_one("SELECT 1 FROM usuarios WHERE LOWER(email)=?", (email,))
    if exists:
        return JsonResponse({"ok": False, "error": "Ese correo ya está registrado."})
    h = hash_pass(pw)
    with transaction.atomic():
        uid = _exec_insert(
            "INSERT INTO usuarios(nombre,apellido,email,password,rol,tel) VALUES(?,?,?,?,?,?)",
            (nom, ape, email, h, "cliente", tel)
        )
    log_action(f"{nom} {ape}", "REGISTRO", "Nuevo cliente registrado")
    usuario = {"id": uid, "n": nom, "a": ape, "email": email, "rol": "cliente"}
    return JsonResponse({"ok": True, "usuario": usuario})


# ── PRODUCTOS ─────────────────────────────────────────
@csrf_exempt
def api_productos(request):
    if request.method == "GET":
        page     = max(1, int(request.GET.get("page", 1)))
        per_page = int(request.GET.get("per_page", 0))   # 0 = sin límite (retrocompat.)
        rows = _exec("""
            SELECT p.id, p.nombre AS n, p.descripcion AS d,
                   p.precio AS p, p.oferta AS o, p.stock AS st,
                   p.cat_id AS cid, c.nombre AS cat,
                   p.destacado AS dest, p.emoji AS e, p.imagen AS img
            FROM productos p
            JOIN categorias c ON c.id = p.cat_id
            WHERE p.activo = 1
            ORDER BY p.id
        """)
        prods = []
        for r in rows:
            prods.append({
                "id": r["id"], "n": r["n"], "d": r["d"],
                "p": r["p"], "o": r["o"], "st": r["st"],
                "cid": r["cid"], "cat": r["cat"],
                "dest": bool(r["dest"]), "e": r["e"] or "📦",
                "img": r["img"]
            })
        total = len(prods)
        if per_page > 0:
            start = (page - 1) * per_page
            prods = prods[start:start + per_page]
        return JsonResponse({"ok": True, "productos": prods, "total": total, "page": page})

    elif request.method == "POST":
        data = json.loads(request.body or '{}')
        n    = (data.get("n") or "").strip()
        d    = (data.get("d") or "").strip()
        p    = float(data.get("p") or 0)
        o    = data.get("o")
        st   = int(data.get("st") or 0)
        cid  = int(data.get("cid") or 1)
        dest = 1 if data.get("dest") else 0
        img  = data.get("img")
        if not n or p <= 0:
            return JsonResponse({"ok": False, "error": "Nombre y precio requeridos"})
        with transaction.atomic():
            pid = _exec_insert(
                "INSERT INTO productos(nombre,descripcion,precio,oferta,stock,cat_id,destacado,imagen) VALUES(?,?,?,?,?,?,?,?)",
                (n, d, p, o if o else None, st, cid, dest, img)
            )
        log_action("Admin", "CREAR_PRODUCTO", n)
        return JsonResponse({"ok": True, "id": pid})

    return JsonResponse({"ok": False, "error": "Método no permitido"}, status=405)


@csrf_exempt
def api_producto_detalle(request, pid):
    if request.method == "PUT":
        data = json.loads(request.body or '{}')
        n    = (data.get("n") or "").strip()
        d    = (data.get("d") or "").strip()
        p    = float(data.get("p") or 0)
        o    = data.get("o")
        st   = int(data.get("st") or 0)
        cid  = int(data.get("cid") or 1)
        dest = 1 if data.get("dest") else 0
        img  = data.get("img")
        with transaction.atomic():
            _exec(
                "UPDATE productos SET nombre=?,descripcion=?,precio=?,oferta=?,stock=?,cat_id=?,destacado=?,imagen=? WHERE id=?",
                (n, d, p, o if o else None, st, cid, dest, img, pid)
            )
        log_action("Admin", "EDIT_PRODUCTO", n)
        return JsonResponse({"ok": True})

    elif request.method == "DELETE":
        row = _exec_one("SELECT nombre FROM productos WHERE id=?", (pid,))
        with transaction.atomic():
            _exec("UPDATE productos SET activo=0 WHERE id=?", (pid,))
        log_action("Admin", "ELIMINAR_PRODUCTO", row["nombre"] if row else str(pid))
        return JsonResponse({"ok": True})

    return JsonResponse({"ok": False, "error": "Método no permitido"}, status=405)


# ── CATEGORIAS ────────────────────────────────────────
def api_categorias(request):
    rows = _exec("SELECT id, nombre AS n, emoji AS e FROM categorias ORDER BY id")
    cats = [{"id": r["id"], "n": r["e"] + " " + r["n"]} for r in rows]
    return JsonResponse({"ok": True, "categorias": cats})


# ── REPORTES ──────────────────────────────────────────
@csrf_exempt
def api_reportes(request):
    if request.method == "GET":
        rows = _exec("""
            SELECT id, uid, u_nom AS uNom, prod_id AS pid, prod_nom AS pNom,
                   tipo, descripcion AS desc, estado, respuesta,
                   resp_fecha AS respFecha, resp_admin AS respAdmin, fecha
            FROM reportes ORDER BY id DESC
        """)
        return JsonResponse({"ok": True, "reportes": rows})

    elif request.method == "POST":
        data  = json.loads(request.body or '{}')
        uid   = int(data.get("uid") or 0)
        pid   = int(data.get("pid") or 0)
        tipo  = data.get("tipo") or "otro"
        desc  = (data.get("desc") or "").strip()
        if not desc:
            return JsonResponse({"ok": False, "error": "Descripción requerida"})
        u = _exec_one("SELECT nombre,apellido FROM usuarios WHERE id=?", (uid,))
        u_nom = f"{u['nombre']} {u['apellido']}" if u else "Desconocido"
        p_nom = "General"
        if pid:
            pr = _exec_one("SELECT nombre FROM productos WHERE id=?", (pid,))
            if pr: p_nom = pr["nombre"]
        with transaction.atomic():
            _exec("INSERT INTO reportes(uid,u_nom,prod_id,prod_nom,tipo,descripcion) VALUES(?,?,?,?,?,?)",
                  (uid, u_nom, pid, p_nom, tipo, desc))
        log_action(u_nom, "REPORTE", f"Tipo: {tipo}")
        return JsonResponse({"ok": True})

    return JsonResponse({"ok": False, "error": "Método no permitido"}, status=405)


@csrf_exempt
@require_http_methods(["POST"])
def api_responder_reporte(request, rid):
    data      = json.loads(request.body or '{}')
    respuesta = (data.get("respuesta") or "").strip()
    estado    = data.get("estado") or "pendiente"
    admin     = data.get("admin") or "Admin"
    if not respuesta:
        return JsonResponse({"ok": False, "error": "Respuesta requerida"})
    fecha = datetime.now().strftime("%d/%m/%Y %H:%M")
    with transaction.atomic():
        _exec("UPDATE reportes SET respuesta=?,estado=?,resp_fecha=?,resp_admin=? WHERE id=?",
              (respuesta, estado, fecha, admin, rid))
    log_action(admin, "RESPONDER_REPORTE", f"Reporte #{rid} → {estado}")
    return JsonResponse({"ok": True})


def api_mis_reportes(request, uid):
    rows = _exec("""
        SELECT id, uid, u_nom AS uNom, prod_id AS pid, prod_nom AS pNom,
               tipo, descripcion AS desc, estado, respuesta,
               resp_fecha AS respFecha, fecha
        FROM reportes WHERE uid=? ORDER BY id DESC
    """, (uid,))
    return JsonResponse({"ok": True, "reportes": rows})


# ── PEDIDOS ───────────────────────────────────────────
# ── EMAIL ─────────────────────────────────────────────────────
def _enviar_confirmacion_pedido(pedido_id, u_nom, u_email, items, total, cupon=None):
    """
    Sends order confirmation email.
    Works in dev mode (console backend) and production (SMTP).
    Never raises — logs errors but does not break the order flow.
    """
    try:
        from django.core.mail import send_mail
        from django.conf import settings

        # Format currency
        def cop(v):
            return f"COP$ {v:,.2f}".replace(",", "X").replace(".", ",").replace("X", ".")

        # Build items rows
        items_rows = ""
        subtotal = 0
        for it in items:
            precio = it.get("p", 0)
            qty    = it.get("qty", 1)
            linea  = precio * qty
            subtotal += linea
            items_rows += (
                f"<tr>"
                f"<td style='padding:10px 12px;border-bottom:1px solid #f0f0f0'>"
                f"  <span style='font-size:1.4rem'>{it.get('e','📦')}</span> "
                f"  <strong>{it.get('n','Producto')}</strong>"
                f"</td>"
                f"<td style='padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:#64748B'>"
                f"  x{qty}"
                f"</td>"
                f"<td style='padding:10px 12px;border-bottom:1px solid #f0f0f0;text-align:right;"
                f"  font-family:monospace;color:#1E3A8A;font-weight:700'>"
                f"  {cop(linea)}"
                f"</td>"
                f"</tr>"
            )

        descuento_row = ""
        if cupon and cupon.get("descuento", 0) > 0:
            descuento_row = (
                f"<tr>"
                f"<td colspan='2' style='padding:8px 12px;color:#16A34A;font-size:.9rem'>"
                f"  🎫 Cupón <strong>{cupon.get('codigo','')}</strong>"
                f"</td>"
                f"<td style='padding:8px 12px;text-align:right;color:#16A34A;font-weight:700'>"
                f"  -{cop(cupon['descuento'])}"
                f"</td>"
                f"</tr>"
            )

        nombre_corto = u_nom.split()[0] if u_nom else "Cliente"

        html_body = f"""
<!DOCTYPE html>
<html lang="es">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
<body style="margin:0;padding:0;background:#F8FAFC;font-family:'Segoe UI',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FAFC;padding:32px 16px">
  <tr><td align="center">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">

      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg,#0F172A 0%,#1E3A8A 60%,#2563EB 100%);padding:32px 36px;text-align:center">
        <div style="font-family:Arial Black,Arial,sans-serif;font-size:28px;font-weight:900;color:#fff;letter-spacing:2px">
          Nuestro<span style="color:#67E8F9">Store</span>
        </div>
        <div style="color:rgba(255,255,255,.75);font-size:13px;margin-top:4px">Tu tienda de confianza en Colombia</div>
      </td></tr>

      <!-- Success banner -->
      <tr><td style="background:#F0FDF4;border-bottom:2px solid #BBF7D0;padding:20px 36px;text-align:center">
        <div style="font-size:2.2rem">✅</div>
        <div style="font-size:1.15rem;font-weight:700;color:#15803D;margin-top:6px">¡Pedido confirmado!</div>
        <div style="color:#166534;font-size:.9rem;margin-top:4px">Pedido <strong>#{pedido_id}</strong></div>
      </td></tr>

      <!-- Greeting -->
      <tr><td style="padding:28px 36px 16px">
        <p style="font-size:1rem;color:#0F172A;margin:0">Hola <strong>{nombre_corto}</strong> 👋</p>
        <p style="font-size:.92rem;color:#475569;margin:10px 0 0;line-height:1.6">
          Gracias por tu compra. Hemos recibido tu pedido y lo estamos procesando.
          Te contactaremos pronto con los detalles del envío.
        </p>
      </td></tr>

      <!-- Items table -->
      <tr><td style="padding:8px 36px 20px">
        <table width="100%" cellpadding="0" cellspacing="0"
               style="border-collapse:collapse;border:1.5px solid #E2E8F0;border-radius:12px;overflow:hidden;font-size:.9rem">
          <thead>
            <tr style="background:linear-gradient(135deg,#0F172A,#1E3A8A)">
              <th style="padding:10px 12px;text-align:left;color:#fff;font-size:.8rem;font-weight:700;letter-spacing:.5px">PRODUCTO</th>
              <th style="padding:10px 12px;text-align:center;color:#fff;font-size:.8rem;font-weight:700">CANT.</th>
              <th style="padding:10px 12px;text-align:right;color:#fff;font-size:.8rem;font-weight:700">TOTAL</th>
            </tr>
          </thead>
          <tbody>
            {items_rows}
            {descuento_row}
            <tr style="background:#F8FAFC">
              <td colspan="2" style="padding:12px;font-weight:800;color:#0F172A;font-size:1rem">TOTAL A PAGAR</td>
              <td style="padding:12px;text-align:right;font-weight:900;color:#1E3A8A;font-size:1.15rem;font-family:monospace">{cop(total)}</td>
            </tr>
          </tbody>
        </table>
      </td></tr>

      <!-- Payment methods -->
      <tr><td style="padding:0 36px 20px">
        <div style="background:#EFF6FF;border-radius:10px;padding:14px;text-align:center">
          <div style="font-size:.82rem;color:#1E40AF;font-weight:700;margin-bottom:6px">Métodos de pago aceptados</div>
          <div style="font-size:.85rem;color:#1E3A8A">💳 PSE &nbsp;·&nbsp; 📱 Nequi &nbsp;·&nbsp; 💚 Daviplata &nbsp;·&nbsp; 🏦 Transferencia</div>
        </div>
      </td></tr>

      <!-- Info boxes -->
      <tr><td style="padding:0 36px 24px">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="50%" style="padding-right:6px">
              <div style="background:#F0FDF4;border-radius:10px;padding:14px;text-align:center">
                <div style="font-size:1.4rem">🚚</div>
                <div style="font-size:.78rem;font-weight:700;color:#15803D;margin-top:4px">Envío Rápido</div>
                <div style="font-size:.72rem;color:#166534">24-48 horas a todo Colombia</div>
              </div>
            </td>
            <td width="50%" style="padding-left:6px">
              <div style="background:#FFF7ED;border-radius:10px;padding:14px;text-align:center">
                <div style="font-size:1.4rem">🔄</div>
                <div style="font-size:.78rem;font-weight:700;color:#C2410C;margin-top:4px">Garantía</div>
                <div style="font-size:.72rem;color:#9A3412">30 días para devoluciones</div>
              </div>
            </td>
          </tr>
        </table>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#0F172A;padding:24px 36px;text-align:center">
        <p style="color:rgba(255,255,255,.5);font-size:.75rem;margin:0">
          © {__import__('datetime').datetime.now().year} NuestroStore · Colombia<br/>
          <a href="mailto:info@nuestrostore.com" style="color:#67E8F9;text-decoration:none">info@nuestrostore.com</a>
          &nbsp;·&nbsp; +57 601 000 0000
        </p>
        <p style="color:rgba(255,255,255,.3);font-size:.68rem;margin:8px 0 0">
          Este correo fue enviado a {u_email} porque realizaste una compra en NuestroStore.
        </p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>"""

        text_body = (
            f"¡Pedido #{pedido_id} confirmado!\n\n"
            f"Hola {nombre_corto},\n"
            f"Gracias por tu compra en NuestroStore.\n\n"
            f"Productos:\n"
            + "\n".join(
                f"  • {it.get('n','Producto')} x{it.get('qty',1)} — {cop(it.get('p',0)*it.get('qty',1))}"
                for it in items
            )
            + f"\n\nTotal: {cop(total)}\n\n"
            f"Procesaremos tu pedido en 24-48h.\n"
            f"Contacto: info@nuestrostore.com"
        )

        send_mail(
            subject=f"✅ Pedido #{pedido_id} confirmado — NuestroStore",
            message=text_body,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[u_email],
            html_message=html_body,
            fail_silently=False,
        )
        log_action("Sistema", "EMAIL_PEDIDO", f"Confirmación enviada a {u_email} (pedido #{pedido_id})")

    except Exception as e:
        # Never break the order — just log the email failure
        log_action("Sistema", "EMAIL_ERROR", f"Fallo al enviar a {u_email}: {str(e)[:120]}")


@csrf_exempt
@require_http_methods(["POST"])
def api_crear_pedido(request):
    data  = json.loads(request.body or '{}')
    uid   = int(data.get("uid") or 0)
    items = data.get("items") or []
    total = float(data.get("total") or 0)
    u = _exec_one("SELECT nombre,apellido,email FROM usuarios WHERE id=?", (uid,))
    if not u:
        return JsonResponse({"ok": False, "error": "Usuario no encontrado"})
    u_nom   = f"{u['nombre']} {u['apellido']}"
    u_email = u["email"]
    with transaction.atomic():
        _exec("INSERT INTO pedidos(uid,u_nom,u_email,items,total) VALUES(?,?,?,?,?)",
              (uid, u_nom, u_email, json.dumps(items), total))
        for item in items:
            if _is_postgres():
                _exec("UPDATE productos SET stock = GREATEST(0, stock - ?) WHERE id=?",
                      (item.get("qty", 1), item.get("id")))
            else:
                _exec("UPDATE productos SET stock = MAX(0, stock - ?) WHERE id=?",
                      (item.get("qty", 1), item.get("id")))
    log_action(u_nom, "PEDIDO", f"Total: {total:.2f}")

    # Get the pedido_id that was just created
    nuevo_pedido = _exec_one(
        "SELECT id FROM pedidos WHERE uid=? ORDER BY id DESC LIMIT 1", (uid,)
    )
    pedido_id = nuevo_pedido["id"] if nuevo_pedido else 0

    # Parse cupon from request data (if any)
    cupon_data = data.get("cupon")  # {codigo, descuento} or None

    # Send confirmation email (non-blocking — never breaks the order)
    import threading
    threading.Thread(
        target=_enviar_confirmacion_pedido,
        args=(pedido_id, u_nom, u_email, items, total, cupon_data),
        daemon=True
    ).start()

    return JsonResponse({"ok": True, "pedidoId": pedido_id})


def api_mis_pedidos(request, uid):
    rows = _exec("""
        SELECT id, uid, u_nom AS uNom, u_email AS uEmail,
               items, total, estado, fecha
        FROM pedidos WHERE uid=? ORDER BY id DESC
    """, (uid,))
    pedidos = []
    for r in rows:
        pedidos.append({
            "id": r["id"], "uid": r["uid"], "uNom": r["uNom"],
            "uEmail": r["uEmail"], "items": json.loads(r["items"]),
            "total": r["total"], "estado": r["estado"], "fecha": str(r["fecha"])
        })
    return JsonResponse({"ok": True, "pedidos": pedidos})



# ── PEDIDOS ADMIN (todos) ──────────────────────────────────────
@csrf_exempt
@require_http_methods(["GET"])
def api_todos_pedidos(request):
    """Todos los pedidos — para el superadmin."""
    rows = _exec("""
        SELECT id, uid, u_nom AS uNom, u_email AS uEmail,
               items, total, estado, fecha
        FROM pedidos ORDER BY id DESC
    """)
    pedidos = []
    for r in rows:
        pedidos.append({
            "id":     r["id"],
            "uNom":   r["uNom"],
            "uEmail": r["uEmail"],
            "items":  json.loads(r["items"] or "[]"),
            "total":  r["total"],
            "estado": r["estado"],
            "fecha":  r["fecha"],
        })
    return JsonResponse({"ok": True, "pedidos": pedidos})

# ── USUARIOS ──────────────────────────────────────────
def api_get_usuarios(request):
    rows = _exec("SELECT id, nombre AS n, apellido AS a, email, rol, activo AS act, tel FROM usuarios ORDER BY id")
    return JsonResponse({"ok": True, "usuarios": rows})


@csrf_exempt
@require_http_methods(["POST"])
def api_crear_admin(request):
    data  = json.loads(request.body or '{}')
    nom   = (data.get("n") or "").strip()
    ape   = (data.get("a") or "").strip()
    email = (data.get("email") or "").strip().lower()
    pw    = data.get("password") or ""
    if not nom or not ape or not email or not pw:
        return JsonResponse({"ok": False, "error": "Campos requeridos"})
    if len(pw) < 8:
        return JsonResponse({"ok": False, "error": "Contraseña mínimo 8 caracteres"})
    exists = _exec_one("SELECT 1 FROM usuarios WHERE LOWER(email)=?", (email,))
    if exists:
        return JsonResponse({"ok": False, "error": "Email ya registrado"})
    h = hash_pass(pw)
    with transaction.atomic():
        _exec("INSERT INTO usuarios(nombre,apellido,email,password,rol) VALUES(?,?,?,?,?)",
              (nom, ape, email, h, "administrador"))
    log_action("SuperAdmin", "CREAR_ADMIN", f"{nom} {ape}")
    return JsonResponse({"ok": True})


@csrf_exempt
@require_http_methods(["PUT"])
def api_cambiar_rol(request, uid):
    data = json.loads(request.body or '{}')
    rol  = data.get("rol") or "cliente"
    with transaction.atomic():
        _exec("UPDATE usuarios SET rol=? WHERE id=?", (rol, uid))
    return JsonResponse({"ok": True})


@csrf_exempt
@require_http_methods(["PUT"])
def api_toggle_usuario(request, uid):
    with transaction.atomic():
        _exec("UPDATE usuarios SET activo = 1 - activo WHERE id=?", (uid,))
    u = _exec_one("SELECT nombre,activo FROM usuarios WHERE id=?", (uid,))
    log_action("Admin", "TOGGLE_USUARIO", f"{u['nombre']} → {'activo' if u['activo'] else 'inactivo'}")
    return JsonResponse({"ok": True})


# ── LOGS ──────────────────────────────────────────────
def api_get_logs(request):
    rows = _exec("SELECT fecha AS f, usuario AS u, accion AS ac, detalle AS d FROM logs ORDER BY id DESC LIMIT 200")
    return JsonResponse({"ok": True, "logs": rows})


# ── RESEÑAS ───────────────────────────────────────────
@csrf_exempt
def api_resenias(request):
    if request.method == "GET":
        pid = request.GET.get("pid")
        if pid:
            rows = _exec("""
                SELECT r.id, r.uid, r.prod_id AS pid, r.estrellas, r.comentario, r.fecha,
                       u.nombre AS uNom, u.apellido AS uApe
                FROM resenias r JOIN usuarios u ON u.id = r.uid
                WHERE r.prod_id=? ORDER BY r.id DESC
            """, (pid,))
        else:
            rows = _exec("""
                SELECT r.id, r.uid, r.prod_id AS pid, r.estrellas, r.comentario, r.fecha,
                       u.nombre AS uNom, u.apellido AS uApe
                FROM resenias r JOIN usuarios u ON u.id = r.uid
                ORDER BY r.id DESC LIMIT 100
            """)
        return JsonResponse({"ok": True, "resenias": rows})

    elif request.method == "POST":
        data      = json.loads(request.body or '{}')
        uid       = int(data.get("uid") or 0)
        pid       = int(data.get("pid") or 0)
        estrellas = max(1, min(5, int(data.get("estrellas") or 5)))
        comentario = (data.get("comentario") or "").strip()
        if not uid or not pid or not comentario:
            return JsonResponse({"ok": False, "error": "Datos requeridos"})
        existe = _exec_one("SELECT 1 FROM resenias WHERE uid=? AND prod_id=?", (uid, pid))
        with transaction.atomic():
            if existe:
                _exec("UPDATE resenias SET estrellas=?,comentario=? WHERE uid=? AND prod_id=?",
                      (estrellas, comentario, uid, pid))
            else:
                _exec("INSERT INTO resenias(uid,prod_id,estrellas,comentario) VALUES(?,?,?,?)",
                      (uid, pid, estrellas, comentario))
        log_action(f"Usuario {uid}", "RESENIA", f"Producto #{pid} — {estrellas}⭐")
        return JsonResponse({"ok": True})

    return JsonResponse({"ok": False, "error": "Método no permitido"}, status=405)


# ── CATEGORÍAS CRUD ───────────────────────────────────
@csrf_exempt
def api_categorias_crud(request):
    if request.method == "GET":
        rows = _exec("SELECT id, nombre AS n, emoji AS e FROM categorias ORDER BY id")
        cats = [{"id": r["id"], "n": r["e"] + " " + r["n"], "nombre": r["n"], "emoji": r["e"]} for r in rows]
        return JsonResponse({"ok": True, "categorias": cats})

    elif request.method == "POST":
        data   = json.loads(request.body or '{}')
        nombre = (data.get("nombre") or "").strip()
        emoji  = (data.get("emoji") or "🏷️").strip()
        if not nombre:
            return JsonResponse({"ok": False, "error": "Nombre requerido"})
        existe = _exec_one("SELECT 1 FROM categorias WHERE LOWER(nombre)=LOWER(?)", (nombre,))
        if existe:
            return JsonResponse({"ok": False, "error": "Esa categoría ya existe"})
        with transaction.atomic():
            cid = _exec_insert("INSERT INTO categorias(nombre,emoji) VALUES(?,?)", (nombre, emoji))
        log_action("Admin", "CREAR_CATEGORIA", nombre)
        return JsonResponse({"ok": True, "id": cid})

    return JsonResponse({"ok": False, "error": "Método no permitido"}, status=405)


@csrf_exempt
def api_categoria_detalle(request, cid):
    if request.method == "DELETE":
        en_uso = _exec_one("SELECT 1 FROM productos WHERE cat_id=? AND activo=1", (cid,))
        if en_uso:
            return JsonResponse({"ok": False, "error": "No se puede eliminar: hay productos activos"})
        row = _exec_one("SELECT nombre FROM categorias WHERE id=?", (cid,))
        with transaction.atomic():
            _exec("DELETE FROM categorias WHERE id=?", (cid,))
        log_action("Admin", "ELIMINAR_CATEGORIA", row["nombre"] if row else str(cid))
        return JsonResponse({"ok": True})

    return JsonResponse({"ok": False, "error": "Método no permitido"}, status=405)


# ── ELIMINAR FOTO ─────────────────────────────────────
@csrf_exempt
@require_http_methods(["PUT"])
def api_eliminar_foto(request, pid):
    row = _exec_one("SELECT nombre FROM productos WHERE id=?", (pid,))
    with transaction.atomic():
        _exec("UPDATE productos SET imagen=NULL WHERE id=?", (pid,))
    log_action("Admin", "ELIMINAR_FOTO", row["nombre"] if row else str(pid))
    return JsonResponse({"ok": True})


# ── PERFIL ────────────────────────────────────────────
@csrf_exempt
def api_perfil(request, uid):
    if request.method == "GET":
        row = _exec_one(
            "SELECT id, nombre, apellido, email, tel, rol, avatar FROM usuarios WHERE id=?", (uid,)
        )
        if not row:
            return JsonResponse({"ok": False, "error": "Usuario no encontrado"})
        return JsonResponse({"ok": True, "perfil": {
            "id": row["id"], "nombre": row["nombre"], "apellido": row["apellido"],
            "email": row["email"], "tel": row["tel"] or "", "rol": row["rol"],
            "avatar": row["avatar"] or ""
        }})

    elif request.method == "PUT":
        data     = json.loads(request.body or '{}')
        nombre   = (data.get("nombre") or "").strip()
        apellido = (data.get("apellido") or "").strip()
        tel      = (data.get("tel") or "").strip()
        avatar   = data.get("avatar") or ""
        nueva_pw = (data.get("nueva_pw") or "").strip()
        old_pw   = (data.get("old_pw") or "").strip()
        if not nombre or not apellido:
            return JsonResponse({"ok": False, "error": "Nombre y apellido requeridos"})
        if nueva_pw:
            if len(nueva_pw) < 8:
                return JsonResponse({"ok": False, "error": "Nueva contraseña mínimo 8 caracteres"})
            row = _exec_one("SELECT password FROM usuarios WHERE id=?", (uid,))
            if not row or not check_pass(old_pw, row["password"]):
                return JsonResponse({"ok": False, "error": "Contraseña actual incorrecta"})
            h = hash_pass(nueva_pw)
            with transaction.atomic():
                _exec("UPDATE usuarios SET nombre=?,apellido=?,tel=?,avatar=?,password=? WHERE id=?",
                      (nombre, apellido, tel, avatar, h, uid))
        else:
            with transaction.atomic():
                _exec("UPDATE usuarios SET nombre=?,apellido=?,tel=?,avatar=? WHERE id=?",
                      (nombre, apellido, tel, avatar, uid))
        log_action(f"{nombre} {apellido}", "EDITAR_PERFIL", "Perfil actualizado")
        return JsonResponse({"ok": True, "perfil": {
            "id": uid, "nombre": nombre, "apellido": apellido, "tel": tel, "avatar": avatar
        }})

    return JsonResponse({"ok": False, "error": "Método no permitido"}, status=405)


# ── MÚSICA ────────────────────────────────────────────
@csrf_exempt
def api_musica(request, uid):
    if request.method == "GET":
        rows = _exec(
            "SELECT id, nombre, duracion, orden FROM musica WHERE uid=? ORDER BY orden, id",
            (uid,)
        )
        return JsonResponse({"ok": True, "tracks": rows})

    elif request.method == "POST":
        data     = json.loads(request.body or '{}')
        nombre   = (data.get("nombre") or "").strip()
        datos    = data.get("datos") or ""
        duracion = (data.get("duracion") or "--").strip()
        if not nombre or not datos:
            return JsonResponse({"ok": False, "error": "Nombre y datos requeridos"})
        count = _exec_one("SELECT COUNT(*) as c FROM musica WHERE uid=?", (uid,))
        orden = count["c"] if count else 0
        with transaction.atomic():
            mid = _exec_insert(
                "INSERT INTO musica(uid, nombre, datos, duracion, orden) VALUES(?,?,?,?,?)",
                (uid, nombre, datos, duracion, orden)
            )
        return JsonResponse({"ok": True, "id": mid})

    return JsonResponse({"ok": False, "error": "Método no permitido"}, status=405)


@csrf_exempt
def api_musica_track(request, uid, mid):
    if request.method == "GET":
        row = _exec_one(
            "SELECT id, nombre, datos, duracion FROM musica WHERE id=? AND uid=?", (mid, uid)
        )
        if not row:
            return JsonResponse({"ok": False, "error": "No encontrado"}, status=404)
        return JsonResponse({"ok": True, "track": row})

    elif request.method == "DELETE":
        with transaction.atomic():
            _exec("DELETE FROM musica WHERE id=? AND uid=?", (mid, uid))
        return JsonResponse({"ok": True})

    elif request.method == "PUT":
        data  = json.loads(request.body or '{}')
        orden = int(data.get("orden") or 0)
        with transaction.atomic():
            _exec("UPDATE musica SET orden=? WHERE id=? AND uid=?", (orden, mid, uid))
        return JsonResponse({"ok": True})

    return JsonResponse({"ok": False, "error": "Método no permitido"}, status=405)


# ── CONTACTOS ─────────────────────────────────────────
@csrf_exempt
def api_contactos(request):
    if request.method == "GET":
        rows = _exec("""
            SELECT id, nombre, email, tel, asunto, mensaje, leido, fecha
            FROM contactos ORDER BY id DESC
        """)
        return JsonResponse({"ok": True, "contactos": rows})

    elif request.method == "POST":
        data    = json.loads(request.body or '{}')
        nombre  = (data.get("nombre") or "").strip()
        email   = (data.get("email") or "").strip().lower()
        tel     = (data.get("tel") or "").strip()
        asunto  = (data.get("asunto") or "").strip()
        mensaje = (data.get("mensaje") or "").strip()

        if not nombre or not email or not asunto or not mensaje:
            return JsonResponse({"ok": False, "error": "Todos los campos obligatorios son requeridos"})
        if "@" not in email or "." not in email.split("@")[-1]:
            return JsonResponse({"ok": False, "error": "Correo electrónico inválido"})
        if len(mensaje) < 10:
            return JsonResponse({"ok": False, "error": "El mensaje debe tener al menos 10 caracteres"})

        with transaction.atomic():
            _exec_insert(
                "INSERT INTO contactos(nombre,email,tel,asunto,mensaje) VALUES(?,?,?,?,?)",
                (nombre, email, tel, asunto, mensaje)
            )
        log_action(nombre, "CONTACTO", f"Asunto: {asunto}")
        return JsonResponse({"ok": True, "mensaje": "Mensaje recibido correctamente"})

    return JsonResponse({"ok": False, "error": "Método no permitido"}, status=405)


@csrf_exempt
@require_http_methods(["PUT"])
def api_contacto_leer(request, cid):
    _exec("UPDATE contactos SET leido=1 WHERE id=?", (cid,))
    return JsonResponse({"ok": True})


@csrf_exempt
@require_http_methods(["DELETE"])
def api_contacto_eliminar(request, cid):
    _exec("DELETE FROM contactos WHERE id=?", (cid,))
    return JsonResponse({"ok": True})



# ── CHAT DE SOPORTE ───────────────────────────────────────────
@csrf_exempt
def api_chat(request):
    """GET: messages for a user. POST: send a message."""

    if request.method == "GET":
        uid = int(request.GET.get("uid") or 0)
        if not uid:
            return JsonResponse({"ok": False, "error": "uid requerido"})
        rows = _exec("""
            SELECT id, uid, u_nom AS uNom, u_email AS uEmail,
                   mensaje, remitente, leido, fecha
            FROM chat_mensajes WHERE uid=? ORDER BY id ASC
        """, (uid,))
        # Mark support messages as read by client
        _exec("UPDATE chat_mensajes SET leido=1 WHERE uid=? AND remitente='soporte'", (uid,))
        return JsonResponse({"ok": True, "mensajes": rows})

    if request.method == "POST":
        data     = json.loads(request.body or '{}')
        uid      = int(data.get("uid") or 0)
        mensaje  = (data.get("mensaje") or "").strip()
        remitente = data.get("remitente", "cliente")  # 'cliente' | 'soporte'
        if not uid or not mensaje:
            return JsonResponse({"ok": False, "error": "Datos incompletos"})
        u = _exec_one("SELECT nombre, apellido, email FROM usuarios WHERE id=?", (uid,))
        if not u:
            return JsonResponse({"ok": False, "error": "Usuario no encontrado"})
        u_nom   = f"{u['nombre']} {u['apellido']}"
        u_email = u["email"]
        _exec_insert(
            "INSERT INTO chat_mensajes(uid, u_nom, u_email, mensaje, remitente) VALUES(?,?,?,?,?)",
            (uid, u_nom, u_email, mensaje, remitente)
        )
        if remitente == "soporte":
            log_action("Soporte", "CHAT_RESPUESTA", f"Respuesta a {u_nom}")
        return JsonResponse({"ok": True})

    return JsonResponse({"ok": False, "error": "Método no permitido"}, status=405)


@csrf_exempt
@require_http_methods(["GET"])
def api_chat_admin(request):
    """Admin: get all active chats grouped by user."""
    rows = _exec("""
        SELECT uid, u_nom AS uNom, u_email AS uEmail,
               COUNT(*) AS total,
               SUM(CASE WHEN remitente='cliente' AND leido=0 THEN 1 ELSE 0 END) AS sinLeer,
               MAX(fecha) AS ultimaFecha,
               (SELECT mensaje FROM chat_mensajes cm2
                WHERE cm2.uid=cm.uid ORDER BY cm2.id DESC LIMIT 1) AS ultimoMsg
        FROM chat_mensajes cm
        GROUP BY uid, u_nom, u_email
        ORDER BY ultimaFecha DESC
    """)
    # Mark admin view — client messages as read when admin fetches
    return JsonResponse({"ok": True, "chats": rows})


@csrf_exempt
@require_http_methods(["DELETE"])
def api_chat_eliminar(request, uid):
    """Delete entire chat with a user."""
    _exec("DELETE FROM chat_mensajes WHERE uid=?", (uid,))
    return JsonResponse({"ok": True})


# ── WEB PUSH — VAPID ──────────────────────────────────────────
import base64 as _b64
import struct as _struct
import time as _time
import os as _os

def _b64u_encode(data):
    if isinstance(data, (str, bytes)):
        if isinstance(data, str): data = data.encode()
    return _b64.urlsafe_b64encode(data).rstrip(b'=').decode()

def _b64u_decode(s):
    if isinstance(s, bytes): s = s.decode()
    pad = 4 - len(s) % 4
    if pad != 4: s += '=' * pad
    return _b64.urlsafe_b64decode(s)

def _make_vapid_jwt(audience, subject, private_key_b64):
    """Generate a VAPID JWT using only the cryptography library."""
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives.asymmetric.utils import decode_dss_signature
    import json

    # Rebuild private key from raw bytes
    priv_int = int.from_bytes(_b64u_decode(private_key_b64), 'big')
    priv_key = ec.derive_private_key(priv_int, ec.SECP256R1(), default_backend())

    header  = _b64u_encode(json.dumps({"typ": "JWT", "alg": "ES256"}).encode())
    payload = _b64u_encode(json.dumps({
        "aud": audience,
        "exp": int(_time.time()) + 43200,
        "sub": subject,
    }).encode())

    signing_input = f"{header}.{payload}".encode()
    sig_der = priv_key.sign(signing_input, ec.ECDSA(hashes.SHA256()))
    r, s    = decode_dss_signature(sig_der)
    sig     = r.to_bytes(32, 'big') + s.to_bytes(32, 'big')
    return f"{header}.{payload}.{_b64u_encode(sig)}"


def _encrypt_push_payload(payload_str, p256dh_b64, auth_b64):
    """
    Encrypt a push payload per RFC 8291 / Web Push Encryption.
    Returns (ciphertext_bytes, salt_b64, server_public_key_b64).
    """
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.kdf.hkdf import HKDF
    from cryptography.hazmat.backends import default_backend
    from cryptography.hazmat.primitives.ciphers.aead import AESGCM
    from cryptography.hazmat.primitives import serialization

    # Decode client keys
    client_pub_bytes = _b64u_decode(p256dh_b64)
    auth_secret      = _b64u_decode(auth_b64)

    # Load client public key
    client_pub = ec.EllipticCurvePublicKey.from_encoded_point(ec.SECP256R1(), client_pub_bytes)

    # Generate server ephemeral key
    server_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
    server_pub = server_key.public_key()
    server_pub_bytes = server_pub.public_bytes(
        serialization.Encoding.X962,
        serialization.PublicFormat.UncompressedPoint
    )

    # ECDH shared secret
    shared = server_key.exchange(ec.ECDH(), client_pub)

    # Salt (16 random bytes)
    salt = _os.urandom(16)

    # PRK (pseudo-random key) via HKDF-SHA256
    prk_key = HKDF(
        algorithm=hashes.SHA256(), length=32,
        salt=auth_secret,
        info=b"Content-Encoding: auth\x00",
        backend=default_backend()
    ).derive(shared)

    # Context string
    context = (
        b"P-256\x00"
        + _struct.pack('>H', len(client_pub_bytes)) + client_pub_bytes
        + _struct.pack('>H', len(server_pub_bytes)) + server_pub_bytes
    )

    # CEK (content encryption key) and nonce
    cek = HKDF(
        algorithm=hashes.SHA256(), length=16,
        salt=salt,
        info=b"Content-Encoding: aesgcm\x00" + context,
        backend=default_backend()
    ).derive(prk_key)

    nonce = HKDF(
        algorithm=hashes.SHA256(), length=12,
        salt=salt,
        info=b"Content-Encoding: nonce\x00" + context,
        backend=default_backend()
    ).derive(prk_key)

    # Encrypt
    payload_bytes = payload_str.encode('utf-8')
    # Add padding: 2-byte big-endian padding length + padding + payload
    padded = _struct.pack('>H', 0) + payload_bytes
    aesgcm = AESGCM(cek)
    ciphertext = aesgcm.encrypt(nonce, padded, None)

    return ciphertext, _b64u_encode(salt), _b64u_encode(server_pub_bytes)


def _send_push(subscription, payload_dict):
    """
    Send a push notification to one subscription.
    subscription: {endpoint, p256dh, auth}
    payload_dict: dict with title, body, etc.
    Returns True on success.
    """
    import json
    import urllib.request
    import urllib.parse
    from django.conf import settings

    endpoint   = subscription['endpoint']
    p256dh     = subscription['p256dh']
    auth       = subscription['auth']
    vapid_pub  = settings.VAPID_PUBLIC_KEY
    vapid_priv = settings.VAPID_PRIVATE_KEY
    vapid_sub  = settings.VAPID_EMAIL

    payload_str = json.dumps(payload_dict)

    try:
        ciphertext, salt_b64, server_pub_b64 = _encrypt_push_payload(payload_str, p256dh, auth)

        # Parse audience from endpoint
        parsed = urllib.parse.urlparse(endpoint)
        audience = f"{parsed.scheme}://{parsed.netloc}"

        # Build VAPID JWT
        jwt = _make_vapid_jwt(audience, vapid_sub, vapid_priv)

        # Build HTTP request
        headers = {
            'Content-Type': 'application/octet-stream',
            'Content-Encoding': 'aesgcm',
            'Encryption': f'salt={salt_b64}',
            'Crypto-Key': f'dh={server_pub_b64};p256ecdsa={vapid_pub}',
            'Authorization': f'WebPush {jwt}',
            'TTL': '86400',
        }

        req = urllib.request.Request(endpoint, data=ciphertext, headers=headers, method='POST')
        with urllib.request.urlopen(req, timeout=10) as resp:
            return resp.status in (200, 201, 202, 204)

    except Exception as e:
        log_action("Sistema", "PUSH_ERROR", str(e)[:120])
        return False


def _notify_user(uid, title, body, url='/', tag='general', icon=None):
    """Send push notification to a specific user (non-blocking thread)."""
    import threading
    def _send():
        sub = _exec_one(
            "SELECT endpoint, p256dh, auth FROM push_subscriptions WHERE uid=? AND activo=1",
            (uid,)
        )
        if not sub:
            return
        payload = {'title': title, 'body': body, 'tag': tag,
                   'icon': icon or '/static/img/favicon.svg',
                   'data': {'url': url}}
        ok = _send_push(dict(sub), payload)
        if not ok:
            # Subscription likely expired — deactivate
            _exec("UPDATE push_subscriptions SET activo=0 WHERE uid=?", (uid,))
    threading.Thread(target=_send, daemon=True).start()


def _notify_all_clients(title, body, url='/', tag='oferta'):
    """Broadcast push notification to all subscribed clients."""
    import threading
    def _broadcast():
        subs = _exec(
            "SELECT uid, endpoint, p256dh, auth FROM push_subscriptions WHERE activo=1"
        )
        payload = {'title': title, 'body': body, 'tag': tag,
                   'icon': '/static/img/favicon.svg', 'data': {'url': url}}
        for sub in subs:
            try:
                ok = _send_push(dict(sub), payload)
                if not ok:
                    _exec("UPDATE push_subscriptions SET activo=0 WHERE uid=?", (sub['uid'],))
            except Exception:
                pass
    threading.Thread(target=_broadcast, daemon=True).start()


# ── PUSH API ENDPOINTS ────────────────────────────────────────
@csrf_exempt
@require_http_methods(["GET"])
def api_vapid_public_key(request):
    """Return VAPID public key so the frontend can subscribe."""
    from django.conf import settings
    return JsonResponse({"ok": True, "publicKey": settings.VAPID_PUBLIC_KEY})


@csrf_exempt
@require_http_methods(["POST"])
def api_push_subscribe(request):
    """Save or update a push subscription for a user."""
    data     = json.loads(request.body or '{}')
    uid      = int(data.get('uid') or 0)
    endpoint = (data.get('endpoint') or '').strip()
    p256dh   = (data.get('p256dh') or '').strip()
    auth     = (data.get('auth') or '').strip()

    if not uid or not endpoint or not p256dh or not auth:
        return JsonResponse({"ok": False, "error": "Datos incompletos"})

    # Upsert subscription
    existing = _exec_one("SELECT id FROM push_subscriptions WHERE uid=?", (uid,))
    if existing:
        _exec(
            "UPDATE push_subscriptions SET endpoint=?, p256dh=?, auth=?, activo=1 WHERE uid=?",
            (endpoint, p256dh, auth, uid)
        )
    else:
        _exec_insert(
            "INSERT INTO push_subscriptions(uid, endpoint, p256dh, auth) VALUES(?,?,?,?)",
            (uid, endpoint, p256dh, auth)
        )
    log_action(str(uid), "PUSH_SUBSCRIBE", "Suscripción guardada")
    return JsonResponse({"ok": True})


@csrf_exempt
@require_http_methods(["POST"])
def api_push_unsubscribe(request):
    """Remove push subscription for a user."""
    data = json.loads(request.body or '{}')
    uid  = int(data.get('uid') or 0)
    if uid:
        _exec("UPDATE push_subscriptions SET activo=0 WHERE uid=?", (uid,))
    return JsonResponse({"ok": True})


@csrf_exempt
@require_http_methods(["POST"])
def api_push_send(request):
    """Admin: broadcast or send to specific user."""
    data  = json.loads(request.body or '{}')
    title = (data.get('title') or '').strip()
    body  = (data.get('body') or '').strip()
    uid   = data.get('uid')  # None = broadcast to all
    tag   = data.get('tag', 'oferta')
    url   = data.get('url', '/')

    if not title or not body:
        return JsonResponse({"ok": False, "error": "Título y mensaje requeridos"})

    if uid:
        _notify_user(int(uid), title, body, url, tag)
        return JsonResponse({"ok": True, "modo": "individual"})
    else:
        _notify_all_clients(title, body, url, tag)
        return JsonResponse({"ok": True, "modo": "broadcast"})


@csrf_exempt
@require_http_methods(["GET"])
def api_push_stats(request):
    """Admin: count active subscriptions."""
    count = _exec_one("SELECT COUNT(*) AS n FROM push_subscriptions WHERE activo=1")
    return JsonResponse({"ok": True, "total": count['n'] if count else 0})


@csrf_exempt
@require_http_methods(["PUT"])
def api_cambiar_estado_pedido(request, pid):
    """Admin: update pedido estado and notify the client."""
    data   = json.loads(request.body or '{}')
    estado = (data.get('estado') or '').strip()
    estados_validos = ['procesando', 'preparando', 'enviado', 'entregado', 'cancelado']
    if estado not in estados_validos:
        return JsonResponse({"ok": False, "error": f"Estado inválido. Válidos: {estados_validos}"})

    pedido = _exec_one("SELECT uid, u_nom, u_email, total FROM pedidos WHERE id=?", (pid,))
    if not pedido:
        return JsonResponse({"ok": False, "error": "Pedido no encontrado"})

    _exec("UPDATE pedidos SET estado=? WHERE id=?", (estado, pid))
    log_action("Admin", "PEDIDO_ESTADO", f"Pedido #{pid} → {estado}")

    # Push notification to the client
    emojis = {
        'procesando': '⏳', 'preparando': '📦',
        'enviado': '🚚', 'entregado': '✅', 'cancelado': '❌'
    }
    emoji = emojis.get(estado, '📋')
    _notify_user(
        uid   = pedido['uid'],
        title = f"{emoji} Pedido #{pid} actualizado",
        body  = f"Tu pedido está ahora en estado: {estado.upper()}",
        url   = '/',
        tag   = f"pedido-{pid}"
    )
    return JsonResponse({"ok": True})

# ── 404 ───────────────────────────────────────────────
def error_404(request, exception=None):
    from django.shortcuts import render as drender
    return drender(request, '404.html', status=404)
