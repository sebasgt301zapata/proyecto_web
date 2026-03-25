# NuestroStore 🛍️

Tienda online venezolana construida con Django + SQLite/PostgreSQL.

## ✅ Mejoras implementadas

### Sección Contacto (nueva)
- Página `/contacto` completa con hero, formulario, canales rápidos, FAQ acordeón y redes sociales
- Tabla `contactos` en la base de datos
- API REST: `POST /api/contactos`, `PUT /api/contactos/<id>/leer`, `DELETE /api/contactos/<id>/eliminar`
- Panel **📬 Mensajes** en el panel de Administrador y Superadmin
- Formulario conectado al backend real (sin setTimeout simulado)

### Correcciones de compatibilidad
- `GREATEST(0, ...)` → `MAX(0, ...)` para SQLite en descuento de stock al pedir
- `ON CONFLICT DO NOTHING` → `ON CONFLICT IGNORE` (SQLite)
- `commit_unless_managed()` eliminado (deprecado en Django 3+)

### Seguridad
- `ALLOWED_HOSTS` configurable por variable de entorno en producción
- `.env.example` con instrucciones claras
- `SECRET_KEY` y `DEBUG` siempre vienen de variables de entorno

### Escalabilidad
- API de productos soporta paginación: `GET /api/productos?page=1&per_page=50`
- Sin límite de resultados por defecto (retrocompatible)

### UX
- Página 404 personalizada con diseño de la marca
- Botón **📬 Contacto** en nav desktop y bottom nav móvil

## 🚀 Inicio rápido

```bash
cd nuestrostore_fix
pip install -r requirements.txt
cp .env.example .env        # edita los valores
python manage.py collectstatic --noinput
python main.py              # o: gunicorn nuestrostore.wsgi
```

## 🔑 Cuentas demo

| Rol | Email | Contraseña |
|-----|-------|------------|
| Superadmin | superadmin@tienda.com | Admin@2024 |
| Admin | carlos@admin.com | Admin@2024 |
| Cliente | ana@cliente.com | cliente123 |

## 📁 Estructura

```
nuestrostore_fix/
├── nuestrostore/       # Configuración Django
├── tienda/
│   ├── templates/      # index.html, 404.html
│   ├── static/
│   │   ├── css/styles.css
│   │   └── js/app.js
│   ├── views.py        # API REST completa
│   ├── urls.py         # Rutas
│   └── database.py     # ORM manual + init_db()
├── .env.example
└── requirements.txt
```
