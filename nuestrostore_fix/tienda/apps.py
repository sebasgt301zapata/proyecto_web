from django.apps import AppConfig

class TiendaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'tienda'

    def ready(self):
        # Inicializar base de datos al arrancar
        try:
            from .database import init_db
            init_db()
        except Exception as e:
            print(f"  ⚠  Error iniciando BD: {e}")
