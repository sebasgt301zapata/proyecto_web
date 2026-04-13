"""
migrate_to_mongo.py — Migra datos de SQLite a MongoDB
Ejecutar UNA SOLA VEZ desde tu máquina local antes del deploy.

Uso:
    pip install pymongo[srv]
    python migrate_to_mongo.py

Configura las rutas/URIs abajo antes de ejecutar.
"""

import sqlite3
import os
from pymongo import MongoClient
from datetime import datetime

# ── CONFIGURA ESTAS DOS LÍNEAS ────────────────────────────────────────────────
SQLITE_PATH  = "tienda.db"                         # ruta a tu archivo .db local
MONGODB_URI  = os.environ.get("MONGODB_URI", "")   # o pega tu URI aquí entre comillas
# ─────────────────────────────────────────────────────────────────────────────

if not MONGODB_URI:
    print("❌ Falta MONGODB_URI. Ejecútalo así:")
    print('   MONGODB_URI="mongodb+srv://..." python migrate_to_mongo.py')
    exit(1)

if not os.path.exists(SQLITE_PATH):
    print(f"❌ No se encontró {SQLITE_PATH}")
    exit(1)

# Conectar a ambas bases
sqlite_conn = sqlite3.connect(SQLITE_PATH)
sqlite_conn.row_factory = sqlite3.Row

mongo_client = MongoClient(MONGODB_URI)
db_name = MONGODB_URI.split("/")[-1].split("?")[0] or "nuestrostore"
mongo_db = mongo_client[db_name]

print(f"✅ SQLite: {SQLITE_PATH}")
print(f"✅ MongoDB: {db_name} en Atlas")
print()

def migrar(tabla, transformar=None):
    cur = sqlite_conn.cursor()
    try:
        cur.execute(f"SELECT * FROM {tabla}")
        rows = [dict(r) for r in cur.fetchall()]
    except Exception as e:
        print(f"  ⚠  {tabla}: {e}")
        return

    if not rows:
        print(f"  ⏭  {tabla}: vacía, saltando")
        return

    col = mongo_db[tabla]
    # Limpiar colección destino antes de migrar
    col.delete_many({})

    docs = []
    max_id = 0
    for row in rows:
        doc = dict(row)
        if transformar:
            doc = transformar(doc)
        if doc is None:
            continue
        # Asegurarse que tiene campo 'id'
        if "id" in doc:
            max_id = max(max_id, int(doc["id"]))
        docs.append(doc)

    if docs:
        col.insert_many(docs)
        # Actualizar counter para IDs futuros
        if max_id > 0:
            mongo_db["counters"].update_one(
                {"_id": tabla},
                {"$set": {"seq": max_id}},
                upsert=True
            )

    print(f"  ✅ {tabla}: {len(docs)} documentos migrados (max id={max_id})")

# Transformaciones específicas
def transform_usuario(doc):
    # Normalizar email a minúsculas
    if "email" in doc:
        doc["email"] = doc["email"].lower()
    return doc

def transform_producto(doc):
    # Asegurar campos opcionales
    if "oferta" not in doc:
        doc["oferta"] = None
    if "imagen" not in doc:
        doc["imagen"] = None
    return doc

print("=== Iniciando migración SQLite → MongoDB ===")
print()

migrar("usuarios",        transform_usuario)
migrar("categorias")
migrar("productos",       transform_producto)
migrar("pedidos")
migrar("reportes")
migrar("resenias")
migrar("logs")
migrar("contactos")
migrar("cupones")
migrar("musica")

# Tablas que pueden no existir en versiones antiguas
for tabla_opcional in ["chat_mensajes", "push_subscriptions", "password_resets"]:
    migrar(tabla_opcional)

print()
print("=== Migración completada ===")
print()

# Verificación
print("Verificación de conteos:")
tablas = ["usuarios","categorias","productos","pedidos","reportes",
          "resenias","logs","contactos","cupones"]
for t in tablas:
    count = mongo_db[t].count_documents({})
    print(f"  {t}: {count} documentos en MongoDB")

sqlite_conn.close()
mongo_client.close()
print()
print("✅ Listo. Ahora puedes hacer el deploy en Render.")
