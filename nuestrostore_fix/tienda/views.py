"""
NuestroStore — Vistas Django (API REST + Frontend)
"""
import json
from datetime import datetime

from django.http import JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .database import get_db, log_action, hash_pass, check_pass


# ── Frontend ──────────────────────────────────────────
def index(request):
    return render(request, 'index.html')


# ── LOGIN ─────────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST"])
def api_login(request):
    data  = json.loads(request.body or '{}')
    email = (data.get("email") or "").strip().lower()
    pw    = data.get("password") or ""
    if not email or not pw:
        return JsonResponse({"ok": False, "error": "Correo y contraseña requeridos"})
    conn = get_db()
    row = conn.execute(
        "SELECT * FROM usuarios WHERE LOWER(email)=? AND activo=1", (email,)
    ).fetchone()
    conn.close()
    if not row or not check_pass(pw, row["password"]):
        return JsonResponse({"ok": False, "error": "Correo o contraseña incorrectos."})
    usuario = {
        "id": row["id"], "n": row["nombre"], "a": row["apellido"],
        "email": row["email"], "rol": row["rol"]
    }
    log_action(f"{row['nombre']} {row['apellido']}", "LOGIN", "Acceso al sistema")
    return JsonResponse({"ok": True, "usuario": usuario})


# ── REGISTRO ──────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST"])
def api_registro(request):
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
    conn = get_db()
    exists = conn.execute("SELECT 1 FROM usuarios WHERE LOWER(email)=?", (email,)).fetchone()
    if exists:
        conn.close()
        return JsonResponse({"ok": False, "error": "Ese correo ya está registrado."})
    h = hash_pass(pw)
    cur = conn.execute(
        "INSERT INTO usuarios(nombre,apellido,email,password,rol,tel) VALUES(?,?,?,?,?,?)",
        (nom, ape, email, h, "cliente", tel)
    )
    uid = cur.lastrowid
    conn.commit()
    conn.close()
    log_action(f"{nom} {ape}", "REGISTRO", "Nuevo cliente registrado")
    usuario = {"id": uid, "n": nom, "a": ape, "email": email, "rol": "cliente"}
    return JsonResponse({"ok": True, "usuario": usuario})


# ── PRODUCTOS ─────────────────────────────────────────
@csrf_exempt
def api_productos(request):
    if request.method == "GET":
        conn = get_db()
        rows = conn.execute("""
            SELECT p.id, p.nombre AS n, p.descripcion AS d,
                   p.precio AS p, p.oferta AS o, p.stock AS st,
                   p.cat_id AS cid, c.nombre AS cat,
                   p.destacado AS dest, p.emoji AS e, p.imagen AS img
            FROM productos p
            JOIN categorias c ON c.id = p.cat_id
            WHERE p.activo = 1
            ORDER BY p.id
        """).fetchall()
        conn.close()
        prods = []
        for r in rows:
            prods.append({
                "id": r["id"], "n": r["n"], "d": r["d"],
                "p": r["p"], "o": r["o"], "st": r["st"],
                "cid": r["cid"], "cat": r["cat"],
                "dest": bool(r["dest"]), "e": r["e"] or "📦",
                "img": r["img"]
            })
        return JsonResponse({"ok": True, "productos": prods})

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
        conn = get_db()
        cur = conn.execute(
            """INSERT INTO productos(nombre,descripcion,precio,oferta,stock,cat_id,destacado,imagen)
               VALUES(?,?,?,?,?,?,?,?)""",
            (n, d, p, o if o else None, st, cid, dest, img)
        )
        pid = cur.lastrowid
        conn.commit()
        conn.close()
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
        conn = get_db()
        conn.execute(
            """UPDATE productos SET nombre=?,descripcion=?,precio=?,oferta=?,stock=?,
               cat_id=?,destacado=?,imagen=? WHERE id=?""",
            (n, d, p, o if o else None, st, cid, dest, img, pid)
        )
        conn.commit()
        conn.close()
        log_action("Admin", "EDIT_PRODUCTO", n)
        return JsonResponse({"ok": True})

    elif request.method == "DELETE":
        conn = get_db()
        row = conn.execute("SELECT nombre FROM productos WHERE id=?", (pid,)).fetchone()
        conn.execute("UPDATE productos SET activo=0 WHERE id=?", (pid,))
        conn.commit()
        conn.close()
        log_action("Admin", "ELIMINAR_PRODUCTO", row["nombre"] if row else str(pid))
        return JsonResponse({"ok": True})

    return JsonResponse({"ok": False, "error": "Método no permitido"}, status=405)


# ── CATEGORIAS ────────────────────────────────────────
def api_categorias(request):
    conn = get_db()
    rows = conn.execute("SELECT id, nombre AS n, emoji AS e FROM categorias ORDER BY id").fetchall()
    conn.close()
    cats = [{"id": r["id"], "n": r["e"] + " " + r["n"]} for r in rows]
    return JsonResponse({"ok": True, "categorias": cats})


# ── REPORTES ──────────────────────────────────────────
@csrf_exempt
def api_reportes(request):
    if request.method == "GET":
        conn = get_db()
        rows = conn.execute("""
            SELECT id, uid, u_nom AS uNom, prod_id AS pid, prod_nom AS pNom,
                   tipo, descripcion AS desc, estado, respuesta,
                   resp_fecha AS respFecha, resp_admin AS respAdmin, fecha
            FROM reportes ORDER BY id DESC
        """).fetchall()
        conn.close()
        return JsonResponse({"ok": True, "reportes": [dict(r) for r in rows]})

    elif request.method == "POST":
        data  = json.loads(request.body or '{}')
        uid   = int(data.get("uid") or 0)
        pid   = int(data.get("pid") or 0)
        tipo  = data.get("tipo") or "otro"
        desc  = (data.get("desc") or "").strip()
        if not desc:
            return JsonResponse({"ok": False, "error": "Descripción requerida"})
        conn = get_db()
        u = conn.execute("SELECT nombre,apellido FROM usuarios WHERE id=?", (uid,)).fetchone()
        u_nom = f"{u['nombre']} {u['apellido']}" if u else "Desconocido"
        p_nom = "General"
        if pid:
            pr = conn.execute("SELECT nombre FROM productos WHERE id=?", (pid,)).fetchone()
            if pr: p_nom = pr["nombre"]
        conn.execute("""INSERT INTO reportes(uid,u_nom,prod_id,prod_nom,tipo,descripcion)
                        VALUES(?,?,?,?,?,?)""", (uid, u_nom, pid, p_nom, tipo, desc))
        conn.commit()
        conn.close()
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
    conn = get_db()
    conn.execute("""UPDATE reportes SET respuesta=?,estado=?,resp_fecha=?,resp_admin=?
                    WHERE id=?""", (respuesta, estado, fecha, admin, rid))
    conn.commit()
    conn.close()
    log_action(admin, "RESPONDER_REPORTE", f"Reporte #{rid} → {estado}")
    return JsonResponse({"ok": True})


def api_mis_reportes(request, uid):
    conn = get_db()
    rows = conn.execute("""
        SELECT id, uid, u_nom AS uNom, prod_id AS pid, prod_nom AS pNom,
               tipo, descripcion AS desc, estado, respuesta,
               resp_fecha AS respFecha, fecha
        FROM reportes WHERE uid=? ORDER BY id DESC
    """, (uid,)).fetchall()
    conn.close()
    return JsonResponse({"ok": True, "reportes": [dict(r) for r in rows]})


# ── PEDIDOS ───────────────────────────────────────────
@csrf_exempt
@require_http_methods(["POST"])
def api_crear_pedido(request):
    data  = json.loads(request.body or '{}')
    uid   = int(data.get("uid") or 0)
    items = data.get("items") or []
    total = float(data.get("total") or 0)
    conn = get_db()
    u = conn.execute("SELECT nombre,apellido,email FROM usuarios WHERE id=?", (uid,)).fetchone()
    if not u:
        conn.close()
        return JsonResponse({"ok": False, "error": "Usuario no encontrado"})
    u_nom   = f"{u['nombre']} {u['apellido']}"
    u_email = u["email"]
    conn.execute("""INSERT INTO pedidos(uid,u_nom,u_email,items,total)
                    VALUES(?,?,?,?,?)""",
                 (uid, u_nom, u_email, json.dumps(items), total))
    for item in items:
        conn.execute("UPDATE productos SET stock = MAX(0, stock - ?) WHERE id=?",
                     (item.get("qty", 1), item.get("id")))
    conn.commit()
    conn.close()
    log_action(u_nom, "PEDIDO", f"Total: {total:.2f}")
    return JsonResponse({"ok": True})


def api_mis_pedidos(request, uid):
    conn = get_db()
    rows = conn.execute("""
        SELECT id, uid, u_nom AS uNom, u_email AS uEmail,
               items, total, estado, fecha
        FROM pedidos WHERE uid=? ORDER BY id DESC
    """, (uid,)).fetchall()
    conn.close()
    pedidos = []
    for r in rows:
        pedidos.append({
            "id": r["id"], "uid": r["uid"], "uNom": r["uNom"],
            "uEmail": r["uEmail"], "items": json.loads(r["items"]),
            "total": r["total"], "estado": r["estado"], "fecha": r["fecha"]
        })
    return JsonResponse({"ok": True, "pedidos": pedidos})


# ── USUARIOS (SuperAdmin) ──────────────────────────────
def api_get_usuarios(request):
    conn = get_db()
    rows = conn.execute("""
        SELECT id, nombre AS n, apellido AS a, email, rol, activo AS act, tel
        FROM usuarios ORDER BY id
    """).fetchall()
    conn.close()
    return JsonResponse({"ok": True, "usuarios": [dict(r) for r in rows]})


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
    conn = get_db()
    exists = conn.execute("SELECT 1 FROM usuarios WHERE LOWER(email)=?", (email,)).fetchone()
    if exists:
        conn.close()
        return JsonResponse({"ok": False, "error": "Email ya registrado"})
    h = hash_pass(pw)
    conn.execute(
        "INSERT INTO usuarios(nombre,apellido,email,password,rol) VALUES(?,?,?,?,?)",
        (nom, ape, email, h, "administrador")
    )
    conn.commit()
    conn.close()
    log_action("SuperAdmin", "CREAR_ADMIN", f"{nom} {ape}")
    return JsonResponse({"ok": True})


@csrf_exempt
@require_http_methods(["PUT"])
def api_cambiar_rol(request, uid):
    data = json.loads(request.body or '{}')
    rol  = data.get("rol") or "cliente"
    conn = get_db()
    conn.execute("UPDATE usuarios SET rol=? WHERE id=?", (rol, uid))
    conn.commit()
    conn.close()
    return JsonResponse({"ok": True})


@csrf_exempt
@require_http_methods(["PUT"])
def api_toggle_usuario(request, uid):
    conn = get_db()
    conn.execute("UPDATE usuarios SET activo = 1 - activo WHERE id=?", (uid,))
    conn.commit()
    u = conn.execute("SELECT nombre,activo FROM usuarios WHERE id=?", (uid,)).fetchone()
    conn.close()
    log_action("Admin", "TOGGLE_USUARIO", f"{u['nombre']} → {'activo' if u['activo'] else 'inactivo'}")
    return JsonResponse({"ok": True})


# ── LOGS ──────────────────────────────────────────────
def api_get_logs(request):
    conn = get_db()
    rows = conn.execute("""
        SELECT fecha AS f, usuario AS u, accion AS ac, detalle AS d
        FROM logs ORDER BY id DESC LIMIT 200
    """).fetchall()
    conn.close()
    return JsonResponse({"ok": True, "logs": [dict(r) for r in rows]})


# ── RESEÑAS ───────────────────────────────────────────
@csrf_exempt
def api_resenias(request):
    if request.method == "GET":
        pid = request.GET.get("pid")
        conn = get_db()
        if pid:
            rows = conn.execute("""
                SELECT r.id, r.uid, r.prod_id AS pid, r.estrellas, r.comentario, r.fecha,
                       u.nombre AS uNom, u.apellido AS uApe
                FROM resenias r JOIN usuarios u ON u.id = r.uid
                WHERE r.prod_id=? ORDER BY r.id DESC
            """, (pid,)).fetchall()
        else:
            rows = conn.execute("""
                SELECT r.id, r.uid, r.prod_id AS pid, r.estrellas, r.comentario, r.fecha,
                       u.nombre AS uNom, u.apellido AS uApe
                FROM resenias r JOIN usuarios u ON u.id = r.uid
                ORDER BY r.id DESC LIMIT 100
            """).fetchall()
        conn.close()
        return JsonResponse({"ok": True, "resenias": [dict(r) for r in rows]})

    elif request.method == "POST":
        data     = json.loads(request.body or '{}')
        uid      = int(data.get("uid") or 0)
        pid      = int(data.get("pid") or 0)
        estrellas = int(data.get("estrellas") or 5)
        comentario = (data.get("comentario") or "").strip()
        if not uid or not pid or not comentario:
            return JsonResponse({"ok": False, "error": "Datos requeridos"})
        estrellas = max(1, min(5, estrellas))
        conn = get_db()
        # Evitar doble reseña del mismo usuario al mismo producto
        existe = conn.execute("SELECT 1 FROM resenias WHERE uid=? AND prod_id=?", (uid, pid)).fetchone()
        if existe:
            conn.execute("UPDATE resenias SET estrellas=?,comentario=?,fecha=datetime('now','localtime') WHERE uid=? AND prod_id=?",
                         (estrellas, comentario, uid, pid))
        else:
            conn.execute("INSERT INTO resenias(uid,prod_id,estrellas,comentario) VALUES(?,?,?,?)",
                         (uid, pid, estrellas, comentario))
        conn.commit()
        conn.close()
        log_action(f"Usuario {uid}", "RESENIA", f"Producto #{pid} — {estrellas}⭐")
        return JsonResponse({"ok": True})

    return JsonResponse({"ok": False, "error": "Método no permitido"}, status=405)


# ── CATEGORÍAS CRUD (admin/superadmin) ────────────────
@csrf_exempt
def api_categorias_crud(request):
    if request.method == "GET":
        conn = get_db()
        rows = conn.execute("SELECT id, nombre AS n, emoji AS e FROM categorias ORDER BY id").fetchall()
        conn.close()
        cats = [{"id": r["id"], "n": r["e"] + " " + r["n"], "nombre": r["n"], "emoji": r["e"]} for r in rows]
        return JsonResponse({"ok": True, "categorias": cats})

    elif request.method == "POST":
        data   = json.loads(request.body or '{}')
        nombre = (data.get("nombre") or "").strip()
        emoji  = (data.get("emoji") or "🏷️").strip()
        if not nombre:
            return JsonResponse({"ok": False, "error": "Nombre requerido"})
        conn = get_db()
        existe = conn.execute("SELECT 1 FROM categorias WHERE LOWER(nombre)=LOWER(?)", (nombre,)).fetchone()
        if existe:
            conn.close()
            return JsonResponse({"ok": False, "error": "Esa categoría ya existe"})
        cur = conn.execute("INSERT INTO categorias(nombre,emoji) VALUES(?,?)", (nombre, emoji))
        cid = cur.lastrowid
        conn.commit()
        conn.close()
        log_action("Admin", "CREAR_CATEGORIA", nombre)
        return JsonResponse({"ok": True, "id": cid})

    return JsonResponse({"ok": False, "error": "Método no permitido"}, status=405)


@csrf_exempt
def api_categoria_detalle(request, cid):
    if request.method == "DELETE":
        conn = get_db()
        en_uso = conn.execute("SELECT 1 FROM productos WHERE cat_id=? AND activo=1", (cid,)).fetchone()
        if en_uso:
            conn.close()
            return JsonResponse({"ok": False, "error": "No se puede eliminar: hay productos activos en esta categoría"})
        row = conn.execute("SELECT nombre FROM categorias WHERE id=?", (cid,)).fetchone()
        conn.execute("DELETE FROM categorias WHERE id=?", (cid,))
        conn.commit()
        conn.close()
        log_action("Admin", "ELIMINAR_CATEGORIA", row["nombre"] if row else str(cid))
        return JsonResponse({"ok": True})

    return JsonResponse({"ok": False, "error": "Método no permitido"}, status=405)


# ── ELIMINAR FOTO DE PRODUCTO ──────────────────────────
@csrf_exempt
@require_http_methods(["PUT"])
def api_eliminar_foto(request, pid):
    conn = get_db()
    row = conn.execute("SELECT nombre FROM productos WHERE id=?", (pid,)).fetchone()
    conn.execute("UPDATE productos SET imagen=NULL WHERE id=?", (pid,))
    conn.commit()
    conn.close()
    log_action("Admin", "ELIMINAR_FOTO", row["nombre"] if row else str(pid))
    return JsonResponse({"ok": True})


# ── PERFIL DE USUARIO ──────────────────────────────────
@csrf_exempt
def api_perfil(request, uid):
    if request.method == "GET":
        conn = get_db()
        row = conn.execute(
            "SELECT id, nombre, apellido, email, tel, rol, avatar FROM usuarios WHERE id=?", (uid,)
        ).fetchone()
        conn.close()
        if not row:
            return JsonResponse({"ok": False, "error": "Usuario no encontrado"})
        return JsonResponse({"ok": True, "perfil": {
            "id": row["id"], "nombre": row["nombre"], "apellido": row["apellido"],
            "email": row["email"], "tel": row["tel"] or "", "rol": row["rol"],
            "avatar": row["avatar"] or ""
        }})

    elif request.method == "PUT":
        data    = json.loads(request.body or '{}')
        nombre  = (data.get("nombre") or "").strip()
        apellido= (data.get("apellido") or "").strip()
        tel     = (data.get("tel") or "").strip()
        avatar  = data.get("avatar") or ""
        nueva_pw= (data.get("nueva_pw") or "").strip()
        old_pw  = (data.get("old_pw") or "").strip()
        if not nombre or not apellido:
            return JsonResponse({"ok": False, "error": "Nombre y apellido requeridos"})
        conn = get_db()
        # Cambio de contraseña opcional
        if nueva_pw:
            if len(nueva_pw) < 8:
                conn.close()
                return JsonResponse({"ok": False, "error": "Nueva contraseña mínimo 8 caracteres"})
            row = conn.execute("SELECT password FROM usuarios WHERE id=?", (uid,)).fetchone()
            if not row or not check_pass(old_pw, row["password"]):
                conn.close()
                return JsonResponse({"ok": False, "error": "Contraseña actual incorrecta"})
            h = hash_pass(nueva_pw)
            conn.execute("UPDATE usuarios SET nombre=?,apellido=?,tel=?,avatar=?,password=? WHERE id=?",
                         (nombre, apellido, tel, avatar, h, uid))
        else:
            conn.execute("UPDATE usuarios SET nombre=?,apellido=?,tel=?,avatar=? WHERE id=?",
                         (nombre, apellido, tel, avatar, uid))
        conn.commit()
        conn.close()
        log_action(f"{nombre} {apellido}", "EDITAR_PERFIL", "Perfil actualizado")
        return JsonResponse({"ok": True, "perfil": {
            "id": uid, "nombre": nombre, "apellido": apellido, "tel": tel, "avatar": avatar
        }})

    return JsonResponse({"ok": False, "error": "Método no permitido"}, status=405)

# ── MÚSICA ────────────────────────────────────────────
@csrf_exempt
def api_musica(request, uid):
    if request.method == "GET":
        conn = get_db()
        rows = conn.execute(
            "SELECT id, nombre, duracion, orden FROM musica WHERE uid=? ORDER BY orden, id",
            (uid,)
        ).fetchall()
        conn.close()
        # No devolver datos (base64) en el listado para no sobrecargar
        tracks = [{"id": r["id"], "nombre": r["nombre"], "duracion": r["duracion"], "orden": r["orden"]} for r in rows]
        return JsonResponse({"ok": True, "tracks": tracks})

    elif request.method == "POST":
        data   = json.loads(request.body or '{}')
        nombre = (data.get("nombre") or "").strip()
        datos  = data.get("datos") or ""
        duracion = (data.get("duracion") or "--").strip()
        if not nombre or not datos:
            return JsonResponse({"ok": False, "error": "Nombre y datos requeridos"})
        conn = get_db()
        orden = (conn.execute("SELECT COUNT(*) as c FROM musica WHERE uid=?", (uid,)).fetchone()["c"])
        cur = conn.execute(
            "INSERT INTO musica(uid, nombre, datos, duracion, orden) VALUES(?,?,?,?,?)",
            (uid, nombre, datos, duracion, orden)
        )
        mid = cur.lastrowid
        conn.commit()
        conn.close()
        return JsonResponse({"ok": True, "id": mid})

    return JsonResponse({"ok": False, "error": "Método no permitido"}, status=405)


@csrf_exempt
def api_musica_track(request, uid, mid):
    if request.method == "GET":
        conn = get_db()
        row = conn.execute(
            "SELECT id, nombre, datos, duracion FROM musica WHERE id=? AND uid=?", (mid, uid)
        ).fetchone()
        conn.close()
        if not row:
            return JsonResponse({"ok": False, "error": "No encontrado"}, status=404)
        return JsonResponse({"ok": True, "track": {"id": row["id"], "nombre": row["nombre"], "datos": row["datos"], "duracion": row["duracion"]}})

    elif request.method == "DELETE":
        conn = get_db()
        conn.execute("DELETE FROM musica WHERE id=? AND uid=?", (mid, uid))
        conn.commit()
        conn.close()
        return JsonResponse({"ok": True})

    elif request.method == "PUT":
        data  = json.loads(request.body or '{}')
        orden = int(data.get("orden") or 0)
        conn  = get_db()
        conn.execute("UPDATE musica SET orden=? WHERE id=? AND uid=?", (orden, mid, uid))
        conn.commit()
        conn.close()
        return JsonResponse({"ok": True})

    return JsonResponse({"ok": False, "error": "Método no permitido"}, status=405)
