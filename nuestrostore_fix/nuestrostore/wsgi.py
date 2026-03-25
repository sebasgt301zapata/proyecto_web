import os
from django.core.wsgi import get_wsgi_application
from whitenoise import WhiteNoise
from pathlib import Path

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nuestrostore.settings')

application = get_wsgi_application()

# WhiteNoise como capa WSGI — sirve /static/ directamente desde staticfiles/
# Esto garantiza que los CSS/JS carguen en Render aunque Django no esté en DEBUG
BASE_DIR = Path(__file__).resolve().parent.parent
application = WhiteNoise(application, root=str(BASE_DIR / 'staticfiles'), prefix='static')
