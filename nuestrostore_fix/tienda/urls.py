from django.urls import path
from . import views

urlpatterns = [
    # Frontend
    path('', views.index, name='index'),

    # Auth
    path('api/login',    views.api_login,    name='api_login'),
    path('api/registro', views.api_registro, name='api_registro'),

    # Productos
    path('api/productos',           views.api_productos,        name='api_productos'),
    path('api/productos/<int:pid>', views.api_producto_detalle, name='api_producto_detalle'),
    path('api/productos/<int:pid>/foto', views.api_eliminar_foto, name='api_eliminar_foto'),

    # Categorias
    path('api/categorias',          views.api_categorias_crud,   name='api_categorias'),
    path('api/categorias/<int:cid>', views.api_categoria_detalle, name='api_categoria_detalle'),

    # Reseñas
    path('api/resenias', views.api_resenias, name='api_resenias'),

    # Reportes
    path('api/reportes',                    views.api_reportes,          name='api_reportes'),
    path('api/reportes/<int:rid>/responder', views.api_responder_reporte, name='api_responder_reporte'),
    path('api/mis-reportes/<int:uid>',       views.api_mis_reportes,      name='api_mis_reportes'),

    # Pedidos
    path('api/pedidos',               views.api_crear_pedido, name='api_crear_pedido'),
    path('api/mis-pedidos/<int:uid>',  views.api_mis_pedidos,  name='api_mis_pedidos'),

    # Usuarios
    path('api/usuarios',                  views.api_get_usuarios,   name='api_get_usuarios'),
    path('api/usuarios/admin',            views.api_crear_admin,    name='api_crear_admin'),
    path('api/usuarios/<int:uid>/rol',    views.api_cambiar_rol,    name='api_cambiar_rol'),
    path('api/usuarios/<int:uid>/toggle', views.api_toggle_usuario, name='api_toggle_usuario'),

    # Logs
    path('api/logs', views.api_get_logs, name='api_get_logs'),

    # Perfil
    path('api/perfil/<int:uid>', views.api_perfil, name='api_perfil'),
    # Música
    path('api/musica/<int:uid>',           views.api_musica,       name='api_musica'),
    path('api/musica/<int:uid>/<int:mid>', views.api_musica_track, name='api_musica_track'),

    # Contactos
    path('api/contactos',              views.api_contactos,         name='api_contactos'),
    path('api/contactos/<int:cid>/leer',   views.api_contacto_leer,    name='api_contacto_leer'),
    path('api/contactos/<int:cid>/eliminar', views.api_contacto_eliminar, name='api_contacto_eliminar'),

    # Cupones
    path('api/cupones/validar',  views.api_validar_cupon,   name='api_validar_cupon'),
    path('api/cupones/usar',     views.api_usar_cupon,       name='api_usar_cupon'),
    path('api/cupones',          views.api_cupones_admin,    name='api_cupones_admin'),
]
