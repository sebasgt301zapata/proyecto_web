import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nuestrostore.settings')

# Auto-initialize DB on first startup (important for Render ephemeral filesystem)
try:
    application = get_wsgi_application()
    from tienda.database import init_db
    init_db()
except Exception as e:
    print(f"Warning: DB init failed: {e}")
    application = get_wsgi_application()
