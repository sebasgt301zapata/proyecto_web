import os
from pathlib import Path

BASE_DIR = Path(__file__).resolve().parent.parent

SECRET_KEY = os.environ.get('SECRET_KEY', 'django-insecure-nuestrostore-change-this-in-production-xyz123')
DEBUG = os.environ.get('DEBUG', 'True') == 'True'

_allowed = os.environ.get('ALLOWED_HOSTS', '')
ALLOWED_HOSTS = [h.strip() for h in _allowed.split(',') if h.strip()] if _allowed else ['*']

INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.staticfiles',
    'tienda',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

# WhiteNoise opcional — solo si está instalado
try:
    import whitenoise  # noqa
    MIDDLEWARE.insert(1, 'whitenoise.middleware.WhiteNoiseMiddleware')
except ImportError:
    pass

ROOT_URLCONF = 'nuestrostore.urls'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [BASE_DIR / 'tienda' / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.request',
            ],
        },
    },
]

WSGI_APPLICATION = 'nuestrostore.wsgi.application'

# Base de datos — MongoDB (pymongo directo, sin ORM Django)
# Django necesita al menos una DB definida para arrancar correctamente.
# Los datos reales van a MongoDB, configurado en tienda/database.py
# usando la variable de entorno MONGODB_URI
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': ':memory:',
    }
}

LANGUAGE_CODE = 'es-ve'
TIME_ZONE = 'America/Caracas'
USE_I18N = True
USE_TZ = False

STATIC_URL = '/static/'
STATICFILES_DIRS = [BASE_DIR / 'tienda' / 'static']
STATIC_ROOT = BASE_DIR / 'staticfiles'

# WhiteNoise storage solo si está disponible
try:
    import whitenoise  # noqa
    STATICFILES_STORAGE = 'whitenoise.storage.CompressedStaticFilesStorage'
except ImportError:
    pass

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
DATA_UPLOAD_MAX_MEMORY_SIZE = 20 * 1024 * 1024

# ── EMAIL / SMTP ──────────────────────────────────────────────
# Configurar con variables de entorno en Render:
#   EMAIL_HOST=smtp.gmail.com
#   EMAIL_PORT=587
#   EMAIL_HOST_USER=tu@gmail.com
#   EMAIL_HOST_PASSWORD=tu_app_password   ← contraseña de app Gmail
#   DEFAULT_FROM_EMAIL=NuestroStore <tu@gmail.com>
#
# Para Gmail: Activar "Contraseñas de aplicación" en tu cuenta Google.
# Para otros: Mailgun, SendGrid, Brevo, etc.

EMAIL_BACKEND    = os.environ.get(
    'EMAIL_BACKEND',
    'django.core.mail.backends.console.EmailBackend'   # Dev: imprime en consola
)
EMAIL_HOST       = os.environ.get('EMAIL_HOST', 'smtp.gmail.com')
EMAIL_PORT       = int(os.environ.get('EMAIL_PORT', 587))
EMAIL_USE_TLS    = os.environ.get('EMAIL_USE_TLS', 'True') == 'True'
EMAIL_HOST_USER  = os.environ.get('EMAIL_HOST_USER', '')
EMAIL_HOST_PASSWORD = os.environ.get('EMAIL_HOST_PASSWORD', '')
DEFAULT_FROM_EMAIL  = os.environ.get(
    'DEFAULT_FROM_EMAIL',
    f'NuestroStore <{EMAIL_HOST_USER}>' if EMAIL_HOST_USER else 'NuestroStore <noreply@nuestrostore.com>'
)

# ── WEB PUSH / VAPID ─────────────────────────────────────────
# Generar claves con: python manage.py generate_vapid  (ver views.py)
# O usar las preconfiguradas (cambiar en producción):
VAPID_PUBLIC_KEY  = os.environ.get('VAPID_PUBLIC_KEY',
    'BEndZUOs3UJRpPLCdIxkQAmbJ_JhA05qvXd4v4wj_V7S44-MjEhTXoGDPKKQ6kg9CUk9WwYJ0L--6JuwfrMw5rk')
VAPID_PRIVATE_KEY = os.environ.get('VAPID_PRIVATE_KEY',
    'NlFmhwbXvxC2N2ppunKVQNYzzXIdQpeoJPd3eJCAHi4')
VAPID_EMAIL       = os.environ.get('VAPID_EMAIL', 'mailto:nuestrostore@gmail.com')
