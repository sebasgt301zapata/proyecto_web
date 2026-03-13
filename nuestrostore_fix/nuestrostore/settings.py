"""
NuestroStore — Configuración Django
"""
import os
from pathlib import Path
 
BASE_DIR = Path(__file__).resolve().parent.parent
 
SECRET_KEY = 'django-insecure-nuestrostore-change-this-in-production-xyz123'
 
DEBUG = False
 
ALLOWED_HOSTS = ['*']
 
INSTALLED_APPS = [
    'django.contrib.contenttypes',
    'django.contrib.staticfiles',
    'tienda',
]
 
MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'whitenoise.middleware.WhiteNoiseMiddleware',  # ← agregado
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
 
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
 
# Base de datos SQLite
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'tienda.db',
    }
}
 
LANGUAGE_CODE = 'es-ve'
TIME_ZONE = 'America/Caracas'
USE_I18N = True
USE_TZ = False
 
STATIC_URL = '/static/'
STATICFILES_DIRS = [
    BASE_DIR / 'tienda' / 'static',
]
STATIC_ROOT = BASE_DIR / 'staticfiles'
STATICFILES_STORAGE = 'whitenoise.storage.CompressedManifestStaticFilesStorage'  # ← agregado
 
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
 
# Tamaño máximo de datos (para imágenes en base64)
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024  # 10MB
