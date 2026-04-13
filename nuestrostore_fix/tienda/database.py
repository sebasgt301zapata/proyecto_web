"""
NuestroStore — Base de datos MongoDB
Reemplaza la capa SQL (SQLite/PostgreSQL) por colecciones MongoDB.
Mantiene las mismas funciones públicas que usaba el código anterior:
  _exec, _exec_one, _exec_insert, log_action, hash_pass, check_pass, init_db
"""
import os
import re
import hashlib
import secrets
from datetime import datetime
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import DuplicateKeyError

# ── Conexión ──────────────────────────────────────────────────────────────────
_client = None
_db     = None

def get_db():
    global _client, _db
    if _db is not None:
        return _db
    uri = os.environ.get("MONGODB_URI", "mongodb://localhost:27017/nuestrostore")
    _client = MongoClient(uri)
    db_name = uri.split("/")[-1].split("?")[0] or "nuestrostore"
    _db = _client[db_name]
    return _db

def col(nombre):
    return get_db()[nombre]

# ── IDs autoincrementales ─────────────────────────────────────────────────────
def _next_id(coleccion):
    result = get_db()["counters"].find_one_and_update(
        {"_id": coleccion},
        {"$inc": {"seq": 1}},
        upsert=True,
        return_document=True
    )
    return result["seq"]

# ── Contraseñas ───────────────────────────────────────────────────────────────
def hash_pass(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt.encode(), 260000)
    return f"pbkdf2$sha256$260000${salt}${dk.hex()}"

def check_pass(password: str, stored_hash: str) -> bool:
    try:
        if not stored_hash or not stored_hash.startswith("pbkdf2$"):
            return False
        _, algo, iters, salt, dk_hex = stored_hash.split("$")
        dk = hashlib.pbkdf2_hmac(algo, password.encode(), salt.encode(), int(iters))
        return secrets.compare_digest(dk.hex(), dk_hex)
    except Exception:
        return False

# ── Utilidades ────────────────────────────────────────────────────────────────
def _now():
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

def _norm(sql):
    return re.sub(r"\s+", " ", sql.strip().lower())

def log_action(usuario, accion, detalle=""):
    try:
        lid = _next_id("logs")
        col("logs").insert_one({
            "id": lid, "fecha": _now(),
            "usuario": usuario, "accion": accion, "detalle": detalle,
        })
    except Exception as e:
        print(f"  ⚠  Error al guardar log: {e}")

# ── API pública ───────────────────────────────────────────────────────────────
def _exec(sql, params=()):
    return _route(sql, params, mode="many")

def _exec_one(sql, params=()):
    results = _route(sql, params, mode="one")
    if isinstance(results, list):
        return results[0] if results else None
    return results

def _exec_insert(sql, params=()):
    return _route(sql, params, mode="insert")

# ── Router ────────────────────────────────────────────────────────────────────
def _route(sql, params, mode):
    n = _norm(sql)
    if "from usuarios" in n or "into usuarios" in n or "update usuarios" in n:
        return _usuarios(n, params, mode)
    if "from productos" in n or "into productos" in n or "update productos" in n:
        return _productos(n, params, mode)
    if "from categorias" in n or "into categorias" in n or "delete from categorias" in n:
        return _categorias(n, params, mode)
    if "from pedidos" in n or "into pedidos" in n or "update pedidos" in n:
        return _pedidos(n, params, mode)
    if "from resenias" in n or "into resenias" in n or "update resenias" in n:
        return _resenias(n, params, mode)
    if "from reportes" in n or "into reportes" in n or "update reportes" in n:
        return _reportes(n, params, mode)
    if "from logs" in n or "into logs" in n:
        return _logs(n, params, mode)
    if "from contactos" in n or "into contactos" in n or "update contactos" in n or "delete from contactos" in n:
        return _contactos(n, params, mode)
    if "from cupones" in n or "into cupones" in n or "update cupones" in n or "delete from cupones" in n:
        return _cupones(n, params, mode)
    if "password_resets" in n:
        return _password_resets(n, params, mode)
    if "from musica" in n or "into musica" in n or "update musica" in n or "delete from musica" in n:
        return _musica(n, params, mode)
    if "chat_mensajes" in n:
        return _chat(n, params, mode)
    if "push_subscriptions" in n:
        return _push(n, params, mode)
    raise NotImplementedError(f"[MongoDB] Consulta no mapeada:\n{sql}")

# ── USUARIOS ──────────────────────────────────────────────────────────────────
def _usuarios(n, p, mode):
    c = col("usuarios")
    if "select 1" in n and "lower(email)" in n:
        q = {"email": p[0].lower()}
        if "and activo" in n:
            q["activo"] = 1
        doc = c.find_one(q, {"_id": 0, "id": 1})
        return [{"1": 1}] if doc else []
    if "select *" in n and "lower(email)" in n:
        q = {"email": p[0].lower()}
        if "and activo" in n:
            q["activo"] = 1
        doc = c.find_one(q, {"_id": 0})
        return [doc] if doc else []
    if "select id" in n and "lower(email)" in n:
        doc = c.find_one({"email": p[0].lower()}, {"_id": 0, "id": 1})
        return [doc] if doc else []
    if "select id, nombre" in n and "order by id" in n:
        docs = list(c.find({}, {"_id": 0}).sort("id", ASCENDING))
        return [{"id": d["id"], "n": d.get("nombre",""), "a": d.get("apellido",""),
                 "email": d.get("email",""), "rol": d.get("rol",""),
                 "act": d.get("activo",1), "tel": d.get("tel","")} for d in docs]
    if "select nombre,activo" in n or "select nombre, activo" in n:
        doc = c.find_one({"id": p[0]}, {"_id": 0, "nombre": 1, "activo": 1})
        return [doc] if doc else []
    if "select nombre" in n and "apellido" in n and "email" in n:
        doc = c.find_one({"id": p[0]}, {"_id": 0, "nombre": 1, "apellido": 1, "email": 1})
        return [doc] if doc else []
    if "select password" in n:
        doc = c.find_one({"id": p[0]}, {"_id": 0, "password": 1})
        return [doc] if doc else []
    if "insert into usuarios" in n:
        uid = _next_id("usuarios")
        c.insert_one({"id": uid, "nombre": p[0], "apellido": p[1],
                       "email": p[2].lower(), "password": p[3],
                       "rol": p[4] if len(p) > 4 else "cliente",
                       "activo": 1, "tel": "", "avatar": "", "creado": _now()})
        return uid
    if "update usuarios set rol" in n:
        c.update_one({"id": p[1]}, {"$set": {"rol": p[0]}})
        return []
    if "update usuarios set activo = 1 - activo" in n:
        doc = c.find_one({"id": p[0]}, {"_id": 0, "activo": 1})
        nuevo = 0 if (doc or {}).get("activo", 1) == 1 else 1
        c.update_one({"id": p[0]}, {"$set": {"activo": nuevo}})
        return []
    if "update usuarios set nombre" in n and "password" in n:
        c.update_one({"id": p[5]}, {"$set": {"nombre": p[0], "apellido": p[1],
                                               "tel": p[2], "avatar": p[3], "password": p[4]}})
        return []
    if "update usuarios set nombre" in n:
        c.update_one({"id": p[4]}, {"$set": {"nombre": p[0], "apellido": p[1],
                                               "tel": p[2], "avatar": p[3]}})
        return []
    raise NotImplementedError(f"[MongoDB/usuarios] No mapeado: {n}")

# ── PRODUCTOS ─────────────────────────────────────────────────────────────────
def _productos(n, p, mode):
    c = col("productos")
    if "select count(*)" in n:
        return [{"c": c.count_documents({"activo": 1})}]
    if "select 1" in n and "cat_id" in n:
        doc = c.find_one({"cat_id": p[0], "activo": 1}, {"_id": 0, "id": 1})
        return [{"1": 1}] if doc else []
    if "select 1" in n:
        doc = c.find_one({"id": p[0]}, {"_id": 0, "id": 1})
        return [{"1": 1}] if doc else []
    if "select nombre from productos where id" in n:
        doc = c.find_one({"id": p[0]}, {"_id": 0, "nombre": 1})
        return [doc] if doc else []
    if "select *" in n and "where id" in n:
        doc = c.find_one({"id": p[0], "activo": 1}, {"_id": 0})
        return [doc] if doc else []
    if "lower(nombre)" in n and "like" in n:
        term = p[0].replace("%", "")
        q = {"activo": 1, "nombre": {"$regex": term, "$options": "i"}}
        if len(p) > 1:
            q["cat_id"] = p[1]
        return list(c.find(q, {"_id": 0}).sort("id", ASCENDING))
    if "select *" in n and "activo=1" in n:
        q = {"activo": 1}
        if "destacado=1" in n:
            q["destacado"] = 1
        if "cat_id=?" in n:
            q["cat_id"] = p[0]
        return list(c.find(q, {"_id": 0}).sort("id", ASCENDING))
    if "select *" in n:
        return list(c.find({}, {"_id": 0}).sort("id", DESCENDING))
    if "insert into productos" in n:
        pid = _next_id("productos")
        c.insert_one({"id": pid, "nombre": p[0], "descripcion": p[1],
                       "precio": p[2], "oferta": p[3], "stock": p[4],
                       "cat_id": p[5], "destacado": p[6], "emoji": p[7],
                       "imagen": None, "activo": 1, "creado": _now()})
        return pid
    if "update productos set activo=0" in n:
        c.update_one({"id": p[0]}, {"$set": {"activo": 0}})
        return []
    if "update productos set imagen=null" in n:
        c.update_one({"id": p[0]}, {"$set": {"imagen": None}})
        return []
    if "update productos set stock" in n:
        doc = c.find_one({"id": p[1]}, {"_id": 0, "stock": 1})
        nuevo = max(0, (doc or {}).get("stock", 0) - p[0])
        c.update_one({"id": p[1]}, {"$set": {"stock": nuevo}})
        return []
    if "update productos set" in n:
        set_part = re.search(r"set (.+?) where", n)
        if set_part:
            col_names = re.findall(r"(\w+)\s*=\s*\?", set_part.group(1))
            fields = {k: p[i] for i, k in enumerate(col_names) if i < len(p) - 1}
            c.update_one({"id": p[-1]}, {"$set": fields})
        return []
    raise NotImplementedError(f"[MongoDB/productos] No mapeado: {n}")

# ── CATEGORIAS ────────────────────────────────────────────────────────────────
def _categorias(n, p, mode):
    c = col("categorias")
    if "select id, nombre" in n and "order by id" in n:
        docs = list(c.find({}, {"_id": 0}).sort("id", ASCENDING))
        return [{"id": d["id"], "n": d.get("nombre",""), "e": d.get("emoji","🏷️")} for d in docs]
    if "select 1" in n and "lower(nombre)" in n:
        doc = c.find_one({"nombre": {"$regex": f"^{re.escape(p[0])}$", "$options": "i"}}, {"_id": 0, "id": 1})
        return [{"1": 1}] if doc else []
    if "select nombre" in n:
        doc = c.find_one({"id": p[0]}, {"_id": 0, "nombre": 1})
        return [doc] if doc else []
    if "insert into categorias" in n:
        try:
            cid = _next_id("categorias")
            c.insert_one({"id": cid, "nombre": p[0], "emoji": p[1]})
            return cid
        except DuplicateKeyError:
            return None
    if "delete from categorias" in n:
        c.delete_one({"id": p[0]})
        return []
    raise NotImplementedError(f"[MongoDB/categorias] No mapeado: {n}")

# ── PEDIDOS ───────────────────────────────────────────────────────────────────
def _pedidos(n, p, mode):
    c = col("pedidos")
    if "select uid" in n and "total" in n:
        doc = c.find_one({"id": p[0]}, {"_id": 0})
        return [doc] if doc else []
    if "select *" in n and "where id" in n:
        doc = c.find_one({"id": p[0]}, {"_id": 0})
        return [doc] if doc else []
    if "select *" in n and "where uid" in n:
        return list(c.find({"uid": p[0]}, {"_id": 0}).sort("id", DESCENDING))
    if "select *" in n:
        return list(c.find({}, {"_id": 0}).sort("id", DESCENDING))
    if "insert into pedidos" in n:
        pid = _next_id("pedidos")
        c.insert_one({"id": pid, "uid": p[0], "u_nom": p[1], "u_email": p[2],
                       "items": p[3], "total": p[4], "estado": "procesado", "fecha": _now()})
        return pid
    if "update pedidos set estado" in n:
        c.update_one({"id": p[1]}, {"$set": {"estado": p[0]}})
        return []
    raise NotImplementedError(f"[MongoDB/pedidos] No mapeado: {n}")

# ── RESENIAS ──────────────────────────────────────────────────────────────────
def _resenias(n, p, mode):
    c = col("resenias")
    if "select 1" in n:
        doc = c.find_one({"uid": p[0], "prod_id": p[1]}, {"_id": 0, "id": 1})
        return [{"1": 1}] if doc else []
    if "where prod_id" in n:
        return list(c.find({"prod_id": p[0]}, {"_id": 0}).sort("id", DESCENDING))
    if "where uid" in n:
        return list(c.find({"uid": p[0]}, {"_id": 0}).sort("id", DESCENDING))
    if "update resenias" in n:
        c.update_one({"uid": p[2], "prod_id": p[3]}, {"$set": {"estrellas": p[0], "comentario": p[1]}})
        return []
    if "insert into resenias" in n:
        rid = _next_id("resenias")
        c.insert_one({"id": rid, "uid": p[0], "prod_id": p[1],
                       "estrellas": p[2], "comentario": p[3], "fecha": _now()})
        return rid
    raise NotImplementedError(f"[MongoDB/resenias] No mapeado: {n}")

# ── REPORTES ──────────────────────────────────────────────────────────────────
def _reportes(n, p, mode):
    c = col("reportes")
    if "where uid" in n and "select" in n:
        return list(c.find({"uid": p[0]}, {"_id": 0}).sort("id", DESCENDING))
    if "select *" in n:
        return list(c.find({}, {"_id": 0}).sort("id", DESCENDING))
    if "insert into reportes" in n:
        rid = _next_id("reportes")
        c.insert_one({"id": rid, "uid": p[0], "u_nom": p[1], "prod_id": p[2],
                       "prod_nom": p[3], "tipo": p[4], "descripcion": p[5],
                       "estado": "pendiente", "respuesta": None,
                       "resp_fecha": None, "resp_admin": None, "fecha": _now()})
        return rid
    if "update reportes" in n:
        c.update_one({"id": p[4]}, {"$set": {"respuesta": p[0], "estado": p[1],
                                               "resp_fecha": p[2], "resp_admin": p[3]}})
        return []
    raise NotImplementedError(f"[MongoDB/reportes] No mapeado: {n}")

# ── LOGS ──────────────────────────────────────────────────────────────────────
def _logs(n, p, mode):
    c = col("logs")
    if "select fecha" in n:
        docs = list(c.find({}, {"_id": 0}).sort("id", DESCENDING).limit(200))
        return [{"f": d.get("fecha",""), "u": d.get("usuario",""),
                 "ac": d.get("accion",""), "d": d.get("detalle","")} for d in docs]
    if "insert into logs" in n:
        lid = _next_id("logs")
        c.insert_one({"id": lid, "usuario": p[0], "accion": p[1],
                       "detalle": p[2] if len(p) > 2 else "", "fecha": _now()})
        return lid
    raise NotImplementedError(f"[MongoDB/logs] No mapeado: {n}")

# ── CONTACTOS ─────────────────────────────────────────────────────────────────
def _contactos(n, p, mode):
    c = col("contactos")
    if "where id" in n and "select" in n:
        doc = c.find_one({"id": p[0]}, {"_id": 0})
        return [doc] if doc else []
    if "select *" in n:
        return list(c.find({}, {"_id": 0}).sort("id", DESCENDING))
    if "insert into contactos" in n:
        cid = _next_id("contactos")
        c.insert_one({"id": cid, "nombre": p[0], "email": p[1], "tel": p[2],
                       "asunto": p[3], "mensaje": p[4], "leido": 0, "fecha": _now()})
        return cid
    if "update contactos" in n:
        c.update_one({"id": p[0]}, {"$set": {"leido": 1}})
        return []
    if "delete from contactos" in n:
        c.delete_one({"id": p[0]})
        return []
    raise NotImplementedError(f"[MongoDB/contactos] No mapeado: {n}")

# ── CUPONES ───────────────────────────────────────────────────────────────────
def _cupones(n, p, mode):
    c = col("cupones")
    if "upper(codigo)" in n and "select *" in n:
        doc = c.find_one({"codigo": p[0].upper(), "activo": 1,
                           "$expr": {"$gt": ["$usos_max", "$usos_actual"]}}, {"_id": 0})
        return [doc] if doc else []
    if "select *" in n:
        return list(c.find({}, {"_id": 0}).sort("id", DESCENDING))
    if "insert into cupones" in n:
        cid = _next_id("cupones")
        c.insert_one({"id": cid, "codigo": p[0].upper(), "tipo": p[1],
                       "valor": p[2], "min_compra": p[3], "usos_max": p[4],
                       "usos_actual": 0, "activo": 1, "creado": _now()})
        return cid
    if "update cupones set usos_actual" in n:
        c.update_one({"codigo": p[0].upper()}, {"$inc": {"usos_actual": 1}})
        return []
    if "delete from cupones" in n:
        c.delete_one({"id": p[0]})
        return []
    raise NotImplementedError(f"[MongoDB/cupones] No mapeado: {n}")

# ── PASSWORD RESETS ───────────────────────────────────────────────────────────
def _password_resets(n, p, mode):
    c = col("password_resets")
    if "select" in n and "token" in n and "usado=0" in n and "email" not in n:
        doc = c.find_one({"token": p[0], "usado": 0}, {"_id": 0})
        return [doc] if doc else []
    if "select" in n and "email" in n and "token" in n:
        doc = c.find_one({"email": p[0].lower(), "token": p[1], "usado": 0}, {"_id": 0})
        return [doc] if doc else []
    if "update" in n and "email" in n and "token" in n:
        c.update_many({"email": p[0].lower(), "token": p[1]}, {"$set": {"usado": 1}})
        return []
    if "update" in n and "email" in n:
        c.update_many({"email": p[0].lower()}, {"$set": {"usado": 1}})
        return []
    if "insert into password_resets" in n:
        rid = _next_id("password_resets")
        c.insert_one({"id": rid, "email": p[0].lower(), "token": p[1], "usado": 0, "creado": _now()})
        return rid
    raise NotImplementedError(f"[MongoDB/password_resets] No mapeado: {n}")

# ── MUSICA ────────────────────────────────────────────────────────────────────
def _musica(n, p, mode):
    c = col("musica")
    if "count(*)" in n:
        return [{"c": c.count_documents({"uid": p[0]})}]
    if "where id" in n and "and uid" in n and "select" in n:
        doc = c.find_one({"id": p[0], "uid": p[1]}, {"_id": 0})
        return [doc] if doc else []
    if "where uid" in n and "select" in n:
        return list(c.find({"uid": p[0]}, {"_id": 0}).sort("orden", ASCENDING))
    if "insert into musica" in n:
        mid = _next_id("musica")
        c.insert_one({"id": mid, "uid": p[0], "nombre": p[1], "datos": p[2],
                       "duracion": p[3], "orden": p[4], "creado": _now()})
        return mid
    if "delete from musica" in n:
        c.delete_one({"id": p[0], "uid": p[1]})
        return []
    if "update musica" in n:
        c.update_one({"id": p[1], "uid": p[2]}, {"$set": {"orden": p[0]}})
        return []
    raise NotImplementedError(f"[MongoDB/musica] No mapeado: {n}")

# ── CHAT ──────────────────────────────────────────────────────────────────────
def _chat(n, p, mode):
    c = col("chat_mensajes")
    if "where uid" in n and "select" in n:
        return list(c.find({"uid": p[0]}, {"_id": 0}).sort("id", ASCENDING))
    if "select *" in n:
        return list(c.find({}, {"_id": 0}).sort("id", ASCENDING))
    if "insert into chat_mensajes" in n:
        mid = _next_id("chat_mensajes")
        c.insert_one({"id": mid, "uid": p[0], "u_nom": p[1], "u_email": p[2],
                       "mensaje": p[3], "remitente": p[4], "leido": 0, "fecha": _now()})
        return mid
    if "update chat_mensajes" in n and "remitente='soporte'" in n:
        c.update_many({"uid": p[0], "remitente": "soporte"}, {"$set": {"leido": 1}})
        return []
    if "update chat_mensajes" in n:
        c.update_many({"uid": p[0]}, {"$set": {"leido": 1}})
        return []
    if "delete from chat_mensajes" in n:
        c.delete_many({"uid": p[0]})
        return []
    raise NotImplementedError(f"[MongoDB/chat] No mapeado: {n}")

# ── PUSH SUBSCRIPTIONS ────────────────────────────────────────────────────────
def _push(n, p, mode):
    c = col("push_subscriptions")
    if "count(*)" in n:
        return [{"n": c.count_documents({"activo": 1})}]
    if "select id from" in n:
        doc = c.find_one({"uid": p[0]}, {"_id": 0, "id": 1})
        return [doc] if doc else []
    if "select *" in n and "activo=1" in n:
        return list(c.find({"activo": 1}, {"_id": 0}))
    if "select *" in n and "where uid" in n:
        doc = c.find_one({"uid": p[0]}, {"_id": 0})
        return [doc] if doc else []
    if "insert into push_subscriptions" in n:
        sid = _next_id("push_subscriptions")
        c.insert_one({"id": sid, "uid": p[0], "endpoint": p[1],
                       "p256dh": p[2], "auth": p[3], "activo": 1, "creado": _now()})
        return sid
    if "update push_subscriptions set" in n:
        if "endpoint" in n:
            c.update_one({"uid": p[3]}, {"$set": {"endpoint": p[0], "p256dh": p[1], "auth": p[2], "activo": 1}})
        else:
            c.update_one({"uid": p[0]}, {"$set": {"activo": 0}})
        return []
    raise NotImplementedError(f"[MongoDB/push] No mapeado: {n}")

# ── Inicialización ────────────────────────────────────────────────────────────
def init_db():
    db = get_db()
    # Índices
    db["usuarios"].create_index("email", unique=True)
    db["productos"].create_index([("activo", ASCENDING), ("cat_id", ASCENDING)])
    db["resenias"].create_index([("uid", ASCENDING), ("prod_id", ASCENDING)], unique=True)
    db["cupones"].create_index("codigo", unique=True)
    db["password_resets"].create_index("token", unique=True)
    db["push_subscriptions"].create_index("uid", unique=True)
    db["logs"].create_index([("id", DESCENDING)])

    if db["usuarios"].count_documents({}) == 0:
        print("  ℹ  Creando datos iniciales en MongoDB...")
        _seed(db)
        print("  ✅ Datos iniciales creados")
    print("  ✅ MongoDB listo")

def _seed(db):
    cats = [("Electrónica","📱"),("Ropa","👕"),("Hogar","🏠"),
            ("Deportes","⚽"),("Alimentos","🍎"),("Belleza","💄")]
    for i,(nom,emoji) in enumerate(cats,1):
        db["categorias"].insert_one({"id":i,"nombre":nom,"emoji":emoji})
    db["counters"].update_one({"_id":"categorias"},{"$set":{"seq":len(cats)}},upsert=True)

    users = [("Super","Admin","superadmin@tienda.com","Admin@2024","superadmin"),
             ("Carlos","Lopez","carlos@admin.com","Admin@2024","administrador"),
             ("Ana","Garcia","ana@cliente.com","cliente123","cliente"),
             ("Pedro","Martinez","pedro@cliente.com","cliente123","cliente")]
    for i,(nom,ape,email,pw,rol) in enumerate(users,1):
        db["usuarios"].insert_one({"id":i,"nombre":nom,"apellido":ape,"email":email.lower(),
                                    "password":hash_pass(pw),"rol":rol,"activo":1,
                                    "tel":"","avatar":"","creado":_now()})
    db["counters"].update_one({"_id":"usuarios"},{"$set":{"seq":len(users)}},upsert=True)

    prods = [
        ("Smartphone Pro X","AMOLED 6.7 pulgadas",599.99,499.99,50,1,1,"📱"),
        ("Auriculares ANC","Cancelacion activa de ruido",199.99,None,100,1,1,"🎧"),
        ("Laptop UltraBook","Intel i7, 16GB RAM",1299.99,999.99,25,1,1,"💻"),
        ("Tablet 10 pulgadas","AMOLED 2K, 8000mAh",349.99,None,40,1,0,"📟"),
        ("Smart Watch","GPS, monitor cardiaco",249.99,199.99,60,1,1,"⌚"),
        ("Camara Mirrorless","Sensor 24MP, video 4K",899.99,749.99,20,1,1,"📷"),
        ("Parlante Bluetooth","360 surround, IPX7",79.99,59.99,90,1,0,"🔊"),
        ("Camiseta Deportiva","Tela transpirable",29.99,19.99,200,2,0,"👕"),
        ("Chaqueta Impermeable","Gore-Tex sellada",149.99,119.99,80,2,1,"🧥"),
        ("Jeans Slim Fit","Denim elastico",69.99,None,120,2,0,"👖"),
        ("Silla Ergonomica","Soporte lumbar 4D",299.99,None,30,3,1,"🪑"),
        ("Mochila Urbana","Compartimento laptop",59.99,44.99,150,3,0,"🎒"),
        ("Licuadora Pro","Motor 1200W",79.99,59.99,80,3,0,"🥤"),
        ("Aspiradora Robot","Mapeo laser 3000Pa",399.99,329.99,35,3,1,"🤖"),
        ("Zapatillas Running","Foam reactiva",89.99,69.99,75,4,1,"👟"),
        ("Bicicleta MTB 29","Aluminio 21 vel",699.99,599.99,15,4,1,"🚴"),
        ("Pesas Ajustables","2-32kg cerrojo rapido",249.99,None,40,4,0,"🏋️"),
        ("Cafe Premium 500g","Arabica colombiano",18.99,14.99,300,5,1,"☕"),
        ("Proteina Whey 1kg","25g proteina",49.99,39.99,120,5,0,"💪"),
        ("Set Skincare Pro","Serum vitamina C",89.99,69.99,60,6,1,"✨"),
    ]
    for i,(nom,desc,precio,oferta,stock,cat_id,dest,emoji) in enumerate(prods,1):
        db["productos"].insert_one({"id":i,"nombre":nom,"descripcion":desc,"precio":precio,
                                     "oferta":oferta,"stock":stock,"cat_id":cat_id,
                                     "destacado":dest,"emoji":emoji,"imagen":None,
                                     "activo":1,"creado":_now()})
    db["counters"].update_one({"_id":"productos"},{"$set":{"seq":len(prods)}},upsert=True)
    db["logs"].insert_one({"id":1,"fecha":_now(),"usuario":"Sistema",
                            "accion":"INIT","detalle":"MongoDB inicializado"})
    db["counters"].update_one({"_id":"logs"},{"$set":{"seq":1}},upsert=True)
