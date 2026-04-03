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

# ── Frontend ──────────────────────────────────────────
def index(request):
    return render(request, 'index.html')


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
    return JsonResponse({"ok": True})


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


# ── 404 ───────────────────────────────────────────────
def error_404(request, exception=None):
    from django.shortcuts import render as drender
    return drender(request, '404.html', status=404)
