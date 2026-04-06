from django.urls import path
from . import views

urlpatterns = [
    # Frontend — páginas separadas
    path('',           views.index,        name='index'),
    path('tienda/',    views.tienda_page,   name='tienda'),
    path('contacto/',  views.contacto_page, name='contacto'),

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

    # Web Push / VAPID
    path('api/push/vapid-key',           views.api_vapid_public_key,      name='api_vapid_key'),
    path('api/push/subscribe',           views.api_push_subscribe,         name='api_push_subscribe'),
    path('api/push/unsubscribe',         views.api_push_unsubscribe,       name='api_push_unsubscribe'),
    path('api/push/send',                views.api_push_send,              name='api_push_send'),
    path('api/push/stats',               views.api_push_stats,             name='api_push_stats'),
    path('api/pedidos/<int:pid>/estado', views.api_cambiar_estado_pedido,  name='api_pedido_estado'),

    # Chat de soporte
    path('api/chat',                views.api_chat,          name='api_chat'),
    path('api/chat/admin',          views.api_chat_admin,    name='api_chat_admin'),
    path('api/chat/<int:uid>/eliminar', views.api_chat_eliminar, name='api_chat_eliminar'),

    # Recuperar contraseña
    path('api/reset/solicitar',  views.api_solicitar_reset,  name='api_solicitar_reset'),
    path('api/reset/verificar',  views.api_verificar_reset,  name='api_verificar_reset'),
    path('api/reset/confirmar',  views.api_confirmar_reset,  name='api_confirmar_reset'),

    # Pedidos admin
    path('api/todos-pedidos', views.api_todos_pedidos, name='api_todos_pedidos'),

    # Cupones
    path('api/cupones/validar',  views.api_validar_cupon,   name='api_validar_cupon'),
    path('api/cupones/usar',     views.api_usar_cupon,       name='api_usar_cupon'),
    path('api/cupones',          views.api_cupones_admin,    name='api_cupones_admin'),
]
