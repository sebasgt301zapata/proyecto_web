import os
from django.core.wsgi import get_wsgi_application

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nuestrostore.settings')

# WhiteNoise se aplica via middleware en settings.py (WHITENOISE_USE_FINDERS=True)
# No envolvemos aquí para evitar doble registro que puede causar conflictos de rutas
application = get_wsgi_application()
