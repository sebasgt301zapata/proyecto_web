# 🛒 NuestroStore v6 — Django Edition

## 🚀 Cómo ejecutar

### 1. Instalar Django
```bash
pip install django
# o
pip install -r requirements.txt
```

### 2. Ejecutar (modo fácil)
```bash
python main.py
```
Esto inicializa la base de datos, muestra las credenciales y levanta el servidor en el puerto 8000.

### 3. Ejecutar (modo Django estándar)
```bash
python manage.py runserver 0.0.0.0:8000
```
> ⚠️ Con este modo debes primero crear la BD manualmente:
> ```python
> import django, os
> os.environ['DJANGO_SETTINGS_MODULE'] = 'nuestrostore.settings'
> django.setup()
> from tienda.database import init_db
> init_db()
> ```

---

## 🔐 Credenciales de acceso

| Rol        | Email                       | Contraseña   |
|------------|-----------------------------|--------------|
| SuperAdmin | superadmin@tienda.com       | Admin@2024   |
| Admin      | carlos@admin.com            | Admin@2024   |
| Cliente    | ana@cliente.com             | cliente123   |

---

## 🏗️ Estructura del proyecto

```
nuestrostore_django/
├── main.py                    ← Punto de entrada (reemplaza Flask main.py)
├── manage.py                  ← CLI Django estándar
├── requirements.txt
├── tienda.db                  ← Base de datos SQLite (se crea automáticamente)
├── nuestrostore/
│   ├── settings.py
│   ├── urls.py
│   └── wsgi.py
└── tienda/
    ├── views.py               ← API REST (equivale a Flask routes.py)
    ├── urls.py                ← Rutas Django
    ├── database.py            ← SQLite directo (sin ORM Django)
    ├── templates/
    │   └── index.html         ← Frontend SPA
    └── static/
        ├── css/styles.css     ← Estilos mejorados para móvil
        └── js/app.js          ← JS con bug de doble carrito corregido
```

---

## 🐛 Bug del doble carrito — corregido

**Causa:** La función `actualizarUI()` regeneraba el innerHTML de `navIcons` y `deskActs`,
creando nuevos elementos `.cart-badge` dinámicamente. Al mismo tiempo, `actualizarBadge()`
usaba `querySelectorAll(".cart-badge")` que encontraba badges huérfanos del DOM anterior,
causando conteos duplicados y badges que no desaparecían correctamente.

**Solución:**
- Cada badge tiene un **ID único**: `#cartBadgeMobile`, `#cartBadgeDesk`, `#cartBadgeNav`
- `actualizarBadge()` busca por `getElementById()` en lugar de `querySelectorAll(".cart-badge")`
- El badge del bottom nav (`#cartBadgeNav`) está en el HTML estático y nunca se regenera
- Los badges de header se crean con sus IDs correctos cuando se regenera el HTML de usuario

---

## 📱 Mejoras móviles

- Carrito como **sidebar deslizable desde abajo** en móvil / desde la derecha en escritorio
- Iconos móviles optimizados para pantallas pequeñas
- Soporte para `safe-area-inset` (notch en iPhone)
- Animación de entrada en toasts
- Inputs con `inputmode` correcto para teclados móviles
- Botones con feedback táctil (`:active` states)
- Pantallas muy pequeñas (≤360px) con layout en columna única
- `maximum-scale=5.0` para permitir zoom de accesibilidad
