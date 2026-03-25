#!/usr/bin/env bash
set -o errexit

echo "==> Instalando dependencias..."
pip install -r requirements.txt

echo "==> Copiando archivos estáticos a staticfiles/..."
# collectstatic copia tienda/static/ → staticfiles/
# WhiteNoise sirve staticfiles/ bajo la URL /static/
python manage.py collectstatic --no-input --clear

echo "==> Inicializando base de datos..."
python -c "
import os, django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'nuestrostore.settings')
django.setup()
from tienda.database import init_db
init_db()
"

echo "==> Build OK"
