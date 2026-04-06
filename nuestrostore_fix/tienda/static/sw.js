/* NuestroStore — Service Worker v1 */
const CACHE_NAME = 'nuestrostore-v1';

// ── Install: cache shell assets ─────────────────────────────
self.addEventListener('install', function(e){
  self.skipWaiting();
});

self.addEventListener('activate', function(e){
  e.waitUntil(clients.claim());
});

// ── Push: receive server push notifications ─────────────────
self.addEventListener('push', function(e){
  if(!e.data) return;
  var data = {};
  try { data = e.data.json(); } catch(err){ data = {title:'NuestroStore', body: e.data.text()}; }

  var title   = data.title   || 'NuestroStore 🛍️';
  var options = {
    body:    data.body    || '¡Tienes una notificación!',
    icon:    data.icon    || '/static/img/favicon.svg',
    badge:   data.badge   || '/static/img/favicon.svg',
    tag:     data.tag     || 'nuestrostore-notif',
    data:    data.data    || {},
    vibrate: [200, 100, 200],
    actions: data.actions || [],
  };

  e.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// ── Notification click: focus or open app ───────────────────
self.addEventListener('notificationclick', function(e){
  e.notification.close();
  var url = (e.notification.data && e.notification.data.url) || '/';
  e.waitUntil(
    clients.matchAll({type:'window', includeUncontrolled:true}).then(function(list){
      for(var i=0; i<list.length; i++){
        if(list[i].url.includes(self.location.origin)){
          list[i].focus();
          return;
        }
      }
      return clients.openWindow(url);
    })
  );
});
