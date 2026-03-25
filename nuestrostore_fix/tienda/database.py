"""
NuestroStore — Base de datos
Soporta PostgreSQL (producción) y SQLite (desarrollo local)
"""
import os
import hashlib
import secrets
from django.conf import settings
from django.db import connection as django_conn


def _is_postgres():
    return 'postgresql' in settings.DATABASES['default']['ENGINE']


def get_db():
    """Retorna la conexión Django (compatible con Postgres y SQLite)."""
    return django_conn


def _exec(sql, params=()):
    """Ejecuta SQL adaptando placeholders según el motor."""
    if _is_postgres():
        sql = sql.replace('?', '%s')
        sql = sql.replace("datetime('now','localtime')", "NOW()")
        sql = sql.replace("datetime('now')", "NOW()")
    with django_conn.cursor() as cur:
        cur.execute(sql, params)
        try:
            rows = cur.fetchall()
            cols = [d[0] for d in cur.description] if cur.description else []
            return [dict(zip(cols, row)) for row in rows]
        except Exception:
            return []


def _exec_one(sql, params=()):
    results = _exec(sql, params)
    return results[0] if results else None


def _exec_insert(sql, params=()):
    """Ejecuta INSERT y retorna el id generado."""
    if _is_postgres():
        sql = sql.replace('?', '%s')
        sql = sql.replace("datetime('now','localtime')", "NOW()")
        if 'RETURNING' not in sql.upper():
            sql = sql + ' RETURNING id'
    with django_conn.cursor() as cur:
        cur.execute(sql, params)
        if _is_postgres():
            row = cur.fetchone()
            return row[0] if row else None
        else:
            return cur.lastrowid


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
        from django.db import transaction
        with transaction.atomic():
            _exec(
                "INSERT INTO logs(usuario,accion,detalle) VALUES(?,?,?)",
                (usuario, accion, detalle)
            )
    except Exception as e:
        print(f"  ⚠  Error al guardar log: {e}")


def init_db():
    """Crea tablas y datos iniciales si no existen."""
    pg = _is_postgres()

    def t(sqlite_type, pg_type):
        return pg_type if pg else sqlite_type

    tables = [
        f"""
        CREATE TABLE IF NOT EXISTS usuarios (
            id       {t('INTEGER PRIMARY KEY AUTOINCREMENT', 'SERIAL PRIMARY KEY')},
            nombre   TEXT NOT NULL,
            apellido TEXT NOT NULL,
            email    TEXT NOT NULL UNIQUE,
            password TEXT NOT NULL,
            rol      TEXT NOT NULL DEFAULT 'cliente',
            activo   {t('INTEGER', 'SMALLINT')} NOT NULL DEFAULT 1,
            tel      TEXT DEFAULT '',
            avatar   TEXT DEFAULT '',
            creado   {t("TEXT DEFAULT (datetime('now','localtime'))", 'TIMESTAMP DEFAULT NOW()')}
        )
        """,
        f"""
        CREATE TABLE IF NOT EXISTS categorias (
            id     {t('INTEGER PRIMARY KEY AUTOINCREMENT', 'SERIAL PRIMARY KEY')},
            nombre TEXT NOT NULL UNIQUE,
            emoji  TEXT DEFAULT '🏷️'
        )
        """,
        f"""
        CREATE TABLE IF NOT EXISTS productos (
            id          {t('INTEGER PRIMARY KEY AUTOINCREMENT', 'SERIAL PRIMARY KEY')},
            nombre      TEXT NOT NULL,
            descripcion TEXT DEFAULT '',
            precio      REAL NOT NULL,
            oferta      REAL DEFAULT NULL,
            stock       {t('INTEGER', 'INT')} NOT NULL DEFAULT 0,
            cat_id      {t('INTEGER', 'INT')} NOT NULL DEFAULT 1,
            destacado   {t('INTEGER', 'SMALLINT')} NOT NULL DEFAULT 0,
            emoji       TEXT DEFAULT '📦',
            imagen      TEXT DEFAULT NULL,
            activo      {t('INTEGER', 'SMALLINT')} NOT NULL DEFAULT 1,
            creado      {t("TEXT DEFAULT (datetime('now','localtime'))", 'TIMESTAMP DEFAULT NOW()')}
        )
        """,
        f"""
        CREATE TABLE IF NOT EXISTS reportes (
            id           {t('INTEGER PRIMARY KEY AUTOINCREMENT', 'SERIAL PRIMARY KEY')},
            uid          {t('INTEGER', 'INT')} NOT NULL,
            u_nom        TEXT NOT NULL,
            prod_id      {t('INTEGER', 'INT')} DEFAULT 0,
            prod_nom     TEXT DEFAULT 'General',
            tipo         TEXT NOT NULL,
            descripcion  TEXT NOT NULL,
            estado       TEXT NOT NULL DEFAULT 'pendiente',
            respuesta    TEXT DEFAULT NULL,
            resp_fecha   TEXT DEFAULT NULL,
            resp_admin   TEXT DEFAULT NULL,
            fecha        {t("TEXT DEFAULT (datetime('now','localtime'))", 'TIMESTAMP DEFAULT NOW()')}
        )
        """,
        f"""
        CREATE TABLE IF NOT EXISTS pedidos (
            id      {t('INTEGER PRIMARY KEY AUTOINCREMENT', 'SERIAL PRIMARY KEY')},
            uid     {t('INTEGER', 'INT')} NOT NULL,
            u_nom   TEXT NOT NULL,
            u_email TEXT NOT NULL,
            items   TEXT NOT NULL,
            total   REAL NOT NULL,
            estado  TEXT NOT NULL DEFAULT 'procesado',
            fecha   {t("TEXT DEFAULT (datetime('now','localtime'))", 'TIMESTAMP DEFAULT NOW()')}
        )
        """,
        f"""
        CREATE TABLE IF NOT EXISTS logs (
            id      {t('INTEGER PRIMARY KEY AUTOINCREMENT', 'SERIAL PRIMARY KEY')},
            fecha   {t("TEXT DEFAULT (datetime('now','localtime'))", 'TIMESTAMP DEFAULT NOW()')},
            usuario TEXT NOT NULL,
            accion  TEXT NOT NULL,
            detalle TEXT DEFAULT ''
        )
        """,
        f"""
        CREATE TABLE IF NOT EXISTS resenias (
            id          {t('INTEGER PRIMARY KEY AUTOINCREMENT', 'SERIAL PRIMARY KEY')},
            uid         {t('INTEGER', 'INT')} NOT NULL,
            prod_id     {t('INTEGER', 'INT')} NOT NULL,
            estrellas   {t('INTEGER', 'SMALLINT')} NOT NULL DEFAULT 5,
            comentario  TEXT NOT NULL,
            fecha       {t("TEXT DEFAULT (datetime('now','localtime'))", 'TIMESTAMP DEFAULT NOW()')},
            UNIQUE(uid, prod_id)
        )
        """,
        f"""
        CREATE TABLE IF NOT EXISTS musica (
            id       {t('INTEGER PRIMARY KEY AUTOINCREMENT', 'SERIAL PRIMARY KEY')},
            uid      {t('INTEGER', 'INT')} NOT NULL,
            nombre   TEXT NOT NULL,
            datos    TEXT NOT NULL,
            duracion TEXT DEFAULT '--',
            orden    {t('INTEGER', 'INT')} NOT NULL DEFAULT 0,
            creado   {t("TEXT DEFAULT (datetime('now','localtime'))", 'TIMESTAMP DEFAULT NOW()')}
        )
        """,
        f"""
        CREATE TABLE IF NOT EXISTS contactos (
            id       {t('INTEGER PRIMARY KEY AUTOINCREMENT', 'SERIAL PRIMARY KEY')},
            nombre   TEXT NOT NULL,
            email    TEXT NOT NULL,
            tel      TEXT DEFAULT '',
            asunto   TEXT NOT NULL,
            mensaje  TEXT NOT NULL,
            leido    {t('INTEGER', 'SMALLINT')} NOT NULL DEFAULT 0,
            fecha    {t("TEXT DEFAULT (datetime('now','localtime'))", 'TIMESTAMP DEFAULT NOW()')}
        )
        """,
    ]

    from django.db import transaction
    with transaction.atomic():
        for sql in tables:
            _exec(sql)

    # Datos iniciales
    existe = _exec_one("SELECT 1 FROM usuarios LIMIT 1")
    if not existe:
        print("  ℹ  Creando datos iniciales...")
        cats = [
            ("Electrónica", "📱"), ("Ropa", "👕"), ("Hogar", "🏠"),
            ("Deportes", "⚽"), ("Alimentos", "🍎"), ("Belleza", "💄"),
        ]
        for cat_n, cat_e in cats:
            _exec("INSERT INTO categorias(nombre,emoji) VALUES(?,?) ON CONFLICT IGNORE", (cat_n, cat_e))

        usuarios_demo = [
            ("Super", "Admin", "superadmin@tienda.com", "Admin@2024", "superadmin"),
            ("Carlos", "Lopez", "carlos@admin.com", "Admin@2024", "administrador"),
            ("Ana", "Garcia", "ana@cliente.com", "cliente123", "cliente"),
            ("Pedro", "Martinez", "pedro@cliente.com", "cliente123", "cliente"),
        ]
        for nom, ape, email, pw, rol in usuarios_demo:
            h = hash_pass(pw)
            _exec("INSERT INTO usuarios(nombre,apellido,email,password,rol) VALUES(?,?,?,?,?) ON CONFLICT IGNORE",
                  (nom, ape, email, h, rol))

        productos_demo = [
            ("Smartphone Pro X", "AMOLED 6.7 pulgadas, camara 108MP, bateria 5000mAh", 599.99, 499.99, 50, 1, 1, "📱"),
            ("Auriculares ANC", "Cancelacion activa de ruido, autonomia 30h", 199.99, None, 100, 1, 1, "🎧"),
            ("Laptop UltraBook", "Intel i7 12va gen, 16GB RAM, SSD NVMe 512GB", 1299.99, 999.99, 25, 1, 1, "💻"),
            ("Tablet 10 pulgadas", "AMOLED 2K, 8000mAh, soporte S-Pen incluido", 349.99, None, 40, 1, 0, "📟"),
            ("Smart Watch", "GPS, monitor cardiaco, resistente al agua 50m", 249.99, 199.99, 60, 1, 1, "⌚"),
            ("Camara Mirrorless", "Sensor 24MP, video 4K, lente intercambiable", 899.99, 749.99, 20, 1, 1, "📷"),
            ("Parlante Bluetooth", "360 surround, IPX7, bateria 24h", 79.99, 59.99, 90, 1, 0, "🔊"),
            ("Camiseta Deportiva", "Tela transpirable premium para entrenamientos", 29.99, 19.99, 200, 2, 0, "👕"),
            ("Chaqueta Impermeable", "Membrana Gore-Tex, costuras selladas, unisex", 149.99, 119.99, 80, 2, 1, "🧥"),
            ("Jeans Slim Fit", "Denim premium elastico, corte moderno", 69.99, None, 120, 2, 0, "👖"),
            ("Silla Ergonomica", "Soporte lumbar ajustable, apoyabrazos 4D", 299.99, None, 30, 3, 1, "🪑"),
            ("Mochila Urbana", "Compartimento laptop 15 pulgadas, impermeable, USB", 59.99, 44.99, 150, 3, 0, "🎒"),
            ("Licuadora Pro", "Motor 1200W, 6 velocidades, vaso de vidrio 2L", 79.99, 59.99, 80, 3, 0, "🥤"),
            ("Aspiradora Robot", "Mapeo laser, 3000Pa, compatible con Alexa", 399.99, 329.99, 35, 3, 1, "🤖"),
            ("Zapatillas Running", "Amortiguacion foam reactiva para maraton", 89.99, 69.99, 75, 4, 1, "👟"),
            ("Bicicleta MTB 29", "Marco aluminio, 21 velocidades, frenos disco", 699.99, 599.99, 15, 4, 1, "🚴"),
            ("Pesas Ajustables", "Set 2-32kg por mancuerna, cerrojo rapido", 249.99, None, 40, 4, 0, "🏋️"),
            ("Cafe Premium 500g", "Grano arabica colombiano, tostado medio", 18.99, 14.99, 300, 5, 1, "☕"),
            ("Proteina Whey 1kg", "25g proteina por porcion, sabor vainilla", 49.99, 39.99, 120, 5, 0, "💪"),
            ("Set Skincare Pro", "Serum vitamina C, hidratante y contorno de ojos", 89.99, 69.99, 60, 6, 1, "✨"),
        ]
        for nom, desc, precio, oferta, stock, cat_id, dest, emoji in productos_demo:
            _exec(
                "INSERT INTO productos(nombre,descripcion,precio,oferta,stock,cat_id,destacado,emoji) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT IGNORE",
                (nom, desc, precio, oferta, stock, cat_id, dest, emoji)
            )

        _exec("INSERT INTO logs(usuario,accion,detalle) VALUES(?,?,?)",
              ("Sistema", "INIT", "Base de datos inicializada"))

        from django.db import transaction as tx
        # already in atomic block above, just pass
        print("  ✅ Datos iniciales creados")

    print("  ✅ Base de datos lista")
