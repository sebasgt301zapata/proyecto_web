# Base de datos SQLite — conexión, inicialización y logs
import sqlite3
import hashlib
import secrets
from pathlib import Path
from django.conf import settings


def get_db_path():
    return settings.DATABASES['default']['NAME']


def get_db():
    """Obtiene conexión a SQLite con row_factory para dict."""
    conn = sqlite3.connect(str(get_db_path()))
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    return conn


def hash_pass(password: str) -> str:
    salt = secrets.token_hex(16)
    dk = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'),
                              salt.encode('utf-8'), 260000)
    return f"pbkdf2$sha256$260000${salt}${dk.hex()}"


def check_pass(password: str, stored_hash: str) -> bool:
    try:
        if not stored_hash or not stored_hash.startswith("pbkdf2$"):
            return False
        _, algo, iters, salt, dk_hex = stored_hash.split("$")
        dk = hashlib.pbkdf2_hmac(algo, password.encode('utf-8'),
                                  salt.encode('utf-8'), int(iters))
        return secrets.compare_digest(dk.hex(), dk_hex)
    except Exception:
        return False


def log_action(usuario, accion, detalle=""):
    try:
        conn = get_db()
        conn.execute("INSERT INTO logs(usuario,accion,detalle) VALUES(?,?,?)",
                     (usuario, accion, detalle))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"  ⚠  Error al guardar log: {e}")


def init_db():
    """Crea tablas y datos iniciales si no existen."""
    conn = get_db()
    c = conn.cursor()

    c.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id       INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre   TEXT NOT NULL,
            apellido TEXT NOT NULL,
            email    TEXT NOT NULL UNIQUE COLLATE NOCASE,
            password TEXT NOT NULL,
            rol      TEXT NOT NULL DEFAULT 'cliente',
            activo   INTEGER NOT NULL DEFAULT 1,
            tel      TEXT DEFAULT '',
            creado   TEXT DEFAULT (datetime('now','localtime'))
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS categorias (
            id     INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL UNIQUE,
            emoji  TEXT DEFAULT '🏷️'
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS productos (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre      TEXT NOT NULL,
            descripcion TEXT DEFAULT '',
            precio      REAL NOT NULL,
            oferta      REAL DEFAULT NULL,
            stock       INTEGER NOT NULL DEFAULT 0,
            cat_id      INTEGER NOT NULL DEFAULT 1,
            destacado   INTEGER NOT NULL DEFAULT 0,
            emoji       TEXT DEFAULT '📦',
            imagen      TEXT DEFAULT NULL,
            activo      INTEGER NOT NULL DEFAULT 1,
            creado      TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (cat_id) REFERENCES categorias(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS reportes (
            id           INTEGER PRIMARY KEY AUTOINCREMENT,
            uid          INTEGER NOT NULL,
            u_nom        TEXT NOT NULL,
            prod_id      INTEGER DEFAULT 0,
            prod_nom     TEXT DEFAULT 'General',
            tipo         TEXT NOT NULL,
            descripcion  TEXT NOT NULL,
            estado       TEXT NOT NULL DEFAULT 'pendiente',
            respuesta    TEXT DEFAULT NULL,
            resp_fecha   TEXT DEFAULT NULL,
            resp_admin   TEXT DEFAULT NULL,
            fecha        TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (uid) REFERENCES usuarios(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS pedidos (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            uid     INTEGER NOT NULL,
            u_nom   TEXT NOT NULL,
            u_email TEXT NOT NULL,
            items   TEXT NOT NULL,
            total   REAL NOT NULL,
            estado  TEXT NOT NULL DEFAULT 'procesado',
            fecha   TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (uid) REFERENCES usuarios(id)
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS logs (
            id      INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha   TEXT DEFAULT (datetime('now','localtime')),
            usuario TEXT NOT NULL,
            accion  TEXT NOT NULL,
            detalle TEXT DEFAULT ''
        )
    """)

    c.execute("""
        CREATE TABLE IF NOT EXISTS resenias (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            uid         INTEGER NOT NULL,
            prod_id     INTEGER NOT NULL,
            estrellas   INTEGER NOT NULL DEFAULT 5,
            comentario  TEXT NOT NULL,
            fecha       TEXT DEFAULT (datetime('now','localtime')),
            FOREIGN KEY (uid)     REFERENCES usuarios(id),
            FOREIGN KEY (prod_id) REFERENCES productos(id),
            UNIQUE(uid, prod_id)
        )
    """)

    conn.commit()

    # Datos iniciales si las tablas están vacías
    if not c.execute("SELECT 1 FROM usuarios LIMIT 1").fetchone():
        print("  ℹ  Creando datos iniciales en la base de datos...")

        cats = [
            ("Electrónica", "📱"), ("Ropa", "👕"), ("Hogar", "🏠"),
            ("Deportes", "⚽"),    ("Alimentos", "🍎"), ("Belleza", "💄"),
        ]
        for cat_n, cat_e in cats:
            c.execute("INSERT OR IGNORE INTO categorias(nombre,emoji) VALUES(?,?)", (cat_n, cat_e))

        usuarios_demo = [
            ("Super","Admin","superadmin@tienda.com","Admin@2024","superadmin"),
            ("Carlos","Lopez","carlos@admin.com","Admin@2024","administrador"),
            ("Ana","Garcia","ana@cliente.com","cliente123","cliente"),
            ("Pedro","Martinez","pedro@cliente.com","cliente123","cliente"),
        ]
        for nom, ape, email, pw, rol in usuarios_demo:
            h = hash_pass(pw)
            c.execute("INSERT OR IGNORE INTO usuarios(nombre,apellido,email,password,rol) VALUES(?,?,?,?,?)",
                      (nom, ape, email, h, rol))

        productos_demo = [
            ("Smartphone Pro X",    "AMOLED 6.7 pulgadas, camara 108MP, bateria 5000mAh",    599.99, 499.99,  50, 1, 1, "📱"),
            ("Auriculares ANC",     "Cancelacion activa de ruido, autonomia 30h",              199.99, None,   100, 1, 1, "🎧"),
            ("Laptop UltraBook",    "Intel i7 12va gen, 16GB RAM, SSD NVMe 512GB",            1299.99, 999.99,  25, 1, 1, "💻"),
            ("Tablet 10 pulgadas",  "AMOLED 2K, 8000mAh, soporte S-Pen incluido",             349.99, None,    40, 1, 0, "📟"),
            ("Smart Watch",         "GPS, monitor cardiaco, resistente al agua 50m",           249.99, 199.99,  60, 1, 1, "⌚"),
            ("Camara Mirrorless",   "Sensor 24MP, video 4K, lente intercambiable",             899.99, 749.99,  20, 1, 1, "📷"),
            ("Parlante Bluetooth",  "360 surround, IPX7, bateria 24h",                          79.99,  59.99,  90, 1, 0, "🔊"),
            ("Camiseta Deportiva",  "Tela transpirable premium para entrenamientos",             29.99,  19.99, 200, 2, 0, "👕"),
            ("Chaqueta Impermeable","Membrana Gore-Tex, costuras selladas, unisex",             149.99, 119.99,  80, 2, 1, "🧥"),
            ("Jeans Slim Fit",      "Denim premium elastico, corte moderno",                     69.99, None,   120, 2, 0, "👖"),
            ("Silla Ergonomica",    "Soporte lumbar ajustable, apoyabrazos 4D",                 299.99, None,    30, 3, 1, "🪑"),
            ("Mochila Urbana",      "Compartimento laptop 15 pulgadas, impermeable, USB",        59.99,  44.99, 150, 3, 0, "🎒"),
            ("Licuadora Pro",       "Motor 1200W, 6 velocidades, vaso de vidrio 2L",             79.99,  59.99,  80, 3, 0, "🥤"),
            ("Aspiradora Robot",    "Mapeo laser, 3000Pa, compatible con Alexa",                399.99, 329.99,  35, 3, 1, "🤖"),
            ("Zapatillas Running",  "Amortiguacion foam reactiva para maraton",                   89.99,  69.99,  75, 4, 1, "👟"),
            ("Bicicleta MTB 29",    "Marco aluminio, 21 velocidades, frenos disco",              699.99, 599.99,  15, 4, 1, "🚴"),
            ("Pesas Ajustables",    "Set 2-32kg por mancuerna, cerrojo rapido",                 249.99, None,    40, 4, 0, "🏋️"),
            ("Cafe Premium 500g",   "Grano arabica colombiano, tostado medio",                   18.99,  14.99, 300, 5, 1, "☕"),
            ("Proteina Whey 1kg",   "25g proteina por porcion, sabor vainilla",                  49.99,  39.99, 120, 5, 0, "💪"),
            ("Set Skincare Pro",    "Serum vitamina C, hidratante y contorno de ojos",           89.99,  69.99,  60, 6, 1, "✨"),
        ]
        for nom, desc, precio, oferta, stock, cat_id, dest, emoji in productos_demo:
            c.execute(
                "INSERT OR IGNORE INTO productos(nombre,descripcion,precio,oferta,stock,cat_id,destacado,emoji) VALUES(?,?,?,?,?,?,?,?)",
                (nom, desc, precio, oferta, stock, cat_id, dest, emoji)
            )

        c.execute("INSERT INTO logs(usuario,accion,detalle) VALUES(?,?,?)",
                  ("Sistema", "INIT", "Base de datos inicializada con Django"))
        conn.commit()
        print("  ✅ Datos iniciales creados")

    # Migración: re-hashear contraseñas en texto plano
    try:
        rows = conn.execute("SELECT id, password FROM usuarios").fetchall()
        migrated = 0
        for row in rows:
            if row["password"] and not row["password"].startswith("pbkdf2$"):
                new_hash = hash_pass(row["password"])
                conn.execute("UPDATE usuarios SET password=? WHERE id=?", (new_hash, row["id"]))
                migrated += 1
        if migrated:
            conn.commit()
            print(f"  ✅ Migración: {migrated} contraseñas hasheadas")
    except Exception as e:
        print(f"  ⚠  Error en migración: {e}")

    conn.close()
