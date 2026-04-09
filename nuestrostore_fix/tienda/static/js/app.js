// NuestroStore v9 — app.js
let PRODS=[],CATS=[{id:0,n:"🏷️ Todos"}],RESENIAS={},REPORTES=[],LOGS=[],PEDIDOS=[],USUARIOS=[];
let usuario=null,carrito=[],wishlist=[],catActiva=0,busqueda="",sortActivo="def";
let filtroPrecioMin=0,filtroPrecioMax=Infinity,filtroRating=0,filtroSoloOfertas=false;
let aTab="productos",sTab="stats",editId=null,newPF={n:"",d:"",p:"",o:"",st:"",cat:1,dest:false,img:null};
let CONTACTOS=[];
let contFact=1000,paginaActual=(typeof PAGE!=="undefined"?PAGE:"inicio"),starSelVal=5;
let imgTempAdmin=null,imgTempSuper=null,spEditId=null,spNewPF={n:"",d:"",p:"",o:"",st:"",cat:1,dest:false,img:null};
let swTimer=null;

// Imágenes de muestra por categoría
let EMOJIS_CAT={"tecnología":"💻","ropa":"👗","zapatos":"👟","hogar":"🏠","juguetes":"🧸","alimentos":"🍎","deportes":"⚽","belleza":"💄","libros":"📚","electrodomésticos":"🏠","muebles":"🪑","mascotas":"🐾"};
function emojiProd(p){
  let cat=(p.cat||"").toLowerCase();
  for(let k in EMOJIS_CAT){if(cat.indexOf(k)>=0)return EMOJIS_CAT[k];}
  let letters=["🛍️","📦","🎁","✨","🌟","💎","🔑","🎯","🛒","💡"];
  return letters[p.id%letters.length]||"📦";
}

// ── API ─────────────────────────────────────
async function api(path,method,body){
  try{
    let opts={method:method||"GET",headers:{"Content-Type":"application/json"}};
    if(body) opts.body=JSON.stringify(body);
    let res=await fetch("/api"+path,opts);
    if(!res.ok) console.error("[API] "+path+" → HTTP "+res.status);
    let data=await res.json();
    if(!res.ok&&!data.error) data.error="Error ("+res.status+")";
    return data;
  }catch(e){
    console.error("[API] "+path+" → "+e);
    return{ok:false,error:"Error de conexión: "+e};
  }
}
// ── MONEDA E IDIOMA ──────────────────────────
const LANG = "es";
let CURRENCY = localStorage.getItem("ns_currency") || "COP";
let DARK_MODE = localStorage.getItem("ns_dark") === "1";

// ── WEB PUSH — Cliente ───────────────────────────────────────
let _pushSuscrito = false;

function _urlB64ToUint8Array(base64String){
  let padding = '='.repeat((4 - base64String.length % 4) % 4);
  let base64  = (base64String + padding).replace(/-/g,'+').replace(/_/g,'/');
  let rawData = atob(base64);
  let arr     = new Uint8Array(rawData.length);
  for(let i=0;i<rawData.length;i++) arr[i]=rawData.charCodeAt(i);
  return arr;
}

function pushPuedeActivarse(){
  return 'serviceWorker' in navigator
      && 'PushManager'   in window
      && 'Notification'  in window;
}

function pushEstaActivo(){
  return _pushSuscrito;
}

function activarNotificaciones(){
  if(!pushPuedeActivarse()){
    toast("Tu navegador no soporta notificaciones push","e"); return;
  }
  if(!usuario){
    toast("Inicia sesión para activar notificaciones","e"); return;
  }

  Notification.requestPermission().then(function(permission){
    if(permission !== 'granted'){
      toast("Permiso de notificaciones denegado","e"); return;
    }
    // Get VAPID public key
    fetch('/api/push/vapid-key').then(function(r){ return r.json(); }).then(function(r){
      if(!r.ok || !r.publicKey){ toast("Error al obtener clave VAPID","e"); return; }
      let appServerKey = _urlB64ToUint8Array(r.publicKey);

      navigator.serviceWorker.ready.then(function(reg){
        reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: appServerKey
        }).then(function(sub){
          let json = sub.toJSON();
          let keys = json.keys || {};
          return fetch('/api/push/subscribe', {
            method: 'POST',
            headers: {'Content-Type':'application/json'},
            body: JSON.stringify({
              uid:      usuario.id,
              endpoint: json.endpoint,
              p256dh:   keys.p256dh,
              auth:     keys.auth
            })
          });
        }).then(function(r){ return r.json(); })
          .then(function(r){
            if(r.ok){
              _pushSuscrito = true;
              _actualizarBtnPush();
              toast("🔔 Notificaciones activadas","s");
            }
          })
          .catch(function(err){
            console.warn('[Push] Subscribe error:', err);
            toast("Error al activar notificaciones","e");
          });
      });
    });
  });
}

function desactivarNotificaciones(){
  if(!usuario) return;
  navigator.serviceWorker.ready.then(function(reg){
    reg.pushManager.getSubscription().then(function(sub){
      if(sub) sub.unsubscribe();
      return fetch('/api/push/unsubscribe',{
        method:'POST',
        headers:{'Content-Type':'application/json'},
        body: JSON.stringify({uid: usuario.id})
      });
    }).then(function(){
      _pushSuscrito = false;
      _actualizarBtnPush();
      toast("🔕 Notificaciones desactivadas","i");
    });
  });
}

function _checkPushEstado(){
  if(!pushPuedeActivarse() || !usuario) return;
  navigator.serviceWorker.ready.then(function(reg){
    reg.pushManager.getSubscription().then(function(sub){
      _pushSuscrito = !!sub;
      _actualizarBtnPush();
    });
  });
}

function _actualizarBtnPush(){
  document.querySelectorAll('.push-toggle-btn').forEach(function(btn){
    btn.innerHTML  = _pushSuscrito ? '🔔 Notif. ON' : '🔕 Notif. OFF';
    btn.title      = _pushSuscrito ? 'Desactivar notificaciones' : 'Activar notificaciones push';
    btn.className  = 'push-toggle-btn bte' + (_pushSuscrito ? ' push-on' : '');
    btn.onclick    = _pushSuscrito ? desactivarNotificaciones : activarNotificaciones;
  });
}

// ── PUSH ADMIN — Enviar notificaciones desde superadmin ──────
function _renderPushAdmin(c){
  fetch('/api/push/stats').then(function(r){ return r.json(); }).then(function(r){
    let total = r.total || 0;
    c.innerHTML =
      '<div class="push-admin-wrap">'
      +'<div class="push-stats-row">'
      +'  <div class="sc"><div class="sn">'+total+'</div><div class="sl">🔔 Suscritos</div></div>'
      +'</div>'
      +'<div class="push-form">'
      +'  <div class="admin-form-title">📢 Enviar Notificación</div>'
      +'  <div class="fg"><label>Título *</label>'
      +'    <input class="fc" id="pushTitle" placeholder="Ej: ¡Oferta Flash! 🔥"/></div>'
      +'  <div class="fg"><label>Mensaje *</label>'
      +'    <input class="fc" id="pushBody" placeholder="Ej: 30% en todos los electrónicos. Solo hoy."/></div>'
      +'  <div class="f2">'
      +'    <div class="fg"><label>URL de destino</label>'
      +'      <input class="fc" id="pushUrl" value="/" placeholder="/"/></div>'
      +'    <div class="fg"><label>Tag (agrupa notifs)</label>'
      +'      <input class="fc" id="pushTag" value="oferta" placeholder="oferta"/></div>'
      +'  </div>'
      +'  <div style="display:flex;gap:8px;margin-top:4px">'
      +'    <button class="bp" style="flex:1" onclick="_enviarPushBroadcast()">📢 Enviar a todos ('+total+')</button>'
      +'  </div>'
      +'  <div id="pushFeedback" style="margin-top:8px;font-size:.82rem;min-height:18px"></div>'
      +'</div>'
      +'</div>';
  });
}

function _enviarPushBroadcast(){
  let title = (document.getElementById('pushTitle')||{}).value||'';
  let body  = (document.getElementById('pushBody') ||{}).value||'';
  let url   = (document.getElementById('pushUrl')  ||{}).value||'/';
  let tag   = (document.getElementById('pushTag')  ||{}).value||'oferta';
  let fb    = document.getElementById('pushFeedback');

  if(!title.trim()||!body.trim()){
    if(fb) fb.textContent='⚠️ Título y mensaje requeridos';
    return;
  }
  if(fb) fb.textContent='Enviando…';

  fetch('/api/push/send',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body: JSON.stringify({title:title.trim(), body:body.trim(), url:url, tag:tag})
  }).then(function(r){return r.json();}).then(function(r){
    if(fb) fb.textContent = r.ok ? '✅ Notificación enviada a todos los suscritos' : '❌ Error: '+(r.error||'');
  }).catch(function(){
    if(fb) fb.textContent = '❌ Error de conexión';
  });
}


const CURRENCIES = {
  VES:{name:"Bolívares",symbol:"Bs.",rate:1,locale:"es-VE"},
  USD:{name:"Dólares",symbol:"$",rate:0.000028,locale:"en-US"},
  COP:{name:"Pesos Col.",symbol:"COP$",rate:115,locale:"es-CO"},
  PEN:{name:"Soles",symbol:"S/.",rate:0.000104,locale:"es-PE"},
  MXN:{name:"Pesos Mex.",symbol:"MX$",rate:0.00048,locale:"es-MX"},
  ARS:{name:"Pesos Arg.",symbol:"AR$",rate:0.028,locale:"es-AR"},
  CLP:{name:"Pesos Chil.",symbol:"CL$",rate:0.026,locale:"es-CL"},
  BRL:{name:"Reales",symbol:"R$",rate:0.000145,locale:"pt-BR"}
};
const T={
  es:{inicio:"Inicio",tienda:"Tienda",contacto:"Contacto",iniciarSesion:"Iniciar Sesión",registrarse:"Registrarse",buscar:"Buscar",buscarPlaceholder:"Buscar productos, categorías…",carrito:"Mi Carrito",cuenta:"Cuenta",bienvenido:"¡Bienvenido",cerrarSesion:"Cerrar sesión",editarPerfil:"Editar Perfil",misCompras:"Mis Compras",misReportes:"Mis Reportes",historial:"Historial",misResenias:"Mis Reseñas",agregarCarrito:"🛒 Agregar",sinPedidos:"Sin compras aún",verTienda:"Ver Tienda",pedido:"Pedido",productos:"Productos",articulos:"Artículos",gastado:"Gastado",subtotal:"Subtotal",total:"Total",procesado:"✅ Procesado",enviado:"🚚 En camino",entregado:"📦 Entregado",cancelado:"❌ Cancelado",ofertaDelDia:"🔥 Ofertas del Día",mejorValorados:"⭐ Mejor Valorados",verTodas:"Ver todas →",verTodos:"Ver todos →",agotado:"Agotado",enOferta:"OFERTA",sinResultados:"Sin resultados",cargando:"Cargando…",moneda:"Moneda",
    salir:"Salir",enviarMensaje:"📨 Enviar Mensaje →",nombre:"Nombre",apellido:"Apellido",telefono:"Teléfono",correo:"Correo",asunto:"Asunto",mensaje:"Mensaje",prioridad:"Prioridad",normal:"Normal",urgente:"Urgente",informativo:"Informativo",
    preguntasFrecuentes:"Preguntas Frecuentes",horarioAtencion:"Horario de Atención",nuestraUbicacion:"Nuestra Ubicación",siguenos:"Síguenos",
    politicasTitle:"Nuestras Políticas",privacidad:"Privacidad",devoluciones:"Devoluciones",envios:"Envíos",pagos:"Pagos",
    soporte:"Soporte 24/7",siempreDisponibles:"Siempre disponibles",
    stock:"Stock",unidades:"unidades",sinDescripcion:"Sin descripción",
    resenas:"Reseñas",sinResenias:"Sin reseñas aún",tuCalificacion:"Tu calificación",publicarResenia:"⭐ Publicar Reseña",
    reportarProblema:"🚨 Reportar Problema",enviarReporte:"📨 Enviar Reporte →",
    verFactura:"📄 Factura",pagar:"Pagar →",carritoVacio:"Carrito vacío",
    editarPerfilBtn:"✏️ Editar Perfil",reproductorMusica:"Reproductor de música",mostrar:"Mostrar",ocultar:"Ocultar"}
};
function t(key){return(T[LANG]&&T[LANG][key])||T.es[key]||key;}
function sanitize(str){
  if(!str) return "";
  return String(str)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;")
    .replace(/'/g,"&#x27;");
}
function bs(n){
  let cur=CURRENCIES[CURRENCY]||CURRENCIES.VES;
  let conv=Number(n)*cur.rate;
  if(CURRENCY==="VES") return cur.symbol+" "+conv.toLocaleString("es-VE",{minimumFractionDigits:2,maximumFractionDigits:2});
  return cur.symbol+" "+conv.toLocaleString(cur.locale,{minimumFractionDigits:2,maximumFractionDigits:2});
}
// setLang eliminado — idioma fijo en español
function setCurrency(cur){
  CURRENCY=cur;localStorage.setItem("ns_currency",cur);
  if(PRODS.length){if(paginaActual==="inicio"||PAGE==="inicio")renderInicio();if(paginaActual==="tienda"||PAGE==="tienda")renderProds();}
  actualizarCarrito();
}
function aplicarIdioma(){
  // Idioma fijo en español — solo actualiza UI estática si hace falta
  actualizarLangUI();
}

// ── PÁGINAS ──────────────────────────────────
function irPagina(pg){
  const routes = {'inicio':'/','tienda':'/tienda/','contacto':'/contacto/'};
  if(routes[pg]){
    // Only navigate if not already on that page
    if(window.location.pathname !== routes[pg]){
      window.location.href = routes[pg];
    }
    return;
  }
  if(pg === 'cuenta'){ if(usuario) abrirPanel(); else abrirLogin(); return; }
}

function toast(msg,tipo){tipo=tipo||"i";let c=document.getElementById("tcs"),el=document.createElement("div");el.className="tst "+tipo;el.innerHTML="<span>"+({s:"✅",e:"❌",i:"🔔"}[tipo]||"🔔")+"</span> "+msg;c.appendChild(el);setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},3200);}

// ── MODALES ────────────────────────────────
function abrirModal(id){
  let el=document.getElementById(id);
  if(!el) return;
  el.classList.add("show");
}
function cerrarModal(id){
  let el=document.getElementById(id);
  if(!el) return;
  el.classList.remove("show");
}
function cerrarIdioma(){ cerrarModal("mIdiomaMoneda"); }
function switchM(a,b){cerrarModal(a);abrirModal(b);}
function bTab(tab,btn){if(tab==="cuenta"){if(usuario)abrirPanel();else abrirModal("mLogin");return;}irPagina(tab);}

// ── CARGAR DATOS ────────────────────────────
async function cargarDatos(){
  let r, rr;
  try {
    [r, rr] = await Promise.all([api("/productos"), api("/resenias")]);
  } catch(e) {
    console.error("[NuestroStore] Error cargando datos:", e);
    r = {ok:false, error:String(e)};
    rr = {ok:false};
  }
  if(r && r.ok){
    PRODS=r.productos||[];
    let catMap={};
    PRODS.forEach(function(p){if(p.cid)catMap[p.cid]=p.cat;});
    CATS=[{id:0,n:"🏷️ Todos"}];
    Object.keys(catMap).forEach(function(cid){CATS.push({id:parseInt(cid),n:catMap[cid]});});
    actualizarStatsHero();
    if(paginaActual==="tienda"||PAGE==="tienda"){cargarCats();renderProds();actualizarEstadsTienda();}
  } else {
    console.error("[NuestroStore] API /productos falló:", r&&r.error);
  }
  if(rr && rr.ok){RESENIAS={};(rr.resenias||[]).forEach(function(res){if(!RESENIAS[res.pid])RESENIAS[res.pid]=[];RESENIAS[res.pid].push(res);});}
  if(paginaActual==="inicio"||PAGE==="inicio"){
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        setTimeout(renderInicio, 50);
      });
    });
  }
  if(paginaActual==="tienda"||PAGE==="tienda"){cargarCats();renderProds();actualizarEstadsTienda();}
}
function actualizarStatsHero(){
  let cs=PRODS.filter(function(p){return p.st>0;});
  let h=document.getElementById("hsProd");if(h)h.textContent=cs.length||"–";
  let a=document.getElementById("aboutProd");if(a)a.textContent=cs.length||"–";
}
function actualizarEstadsTienda(){
  let cs=PRODS.filter(function(p){return p.st>0;}),catSet={};
  cs.forEach(function(p){catSet[p.cid]=1;});
  let ofs=cs.filter(function(p){return p.o&&p.o<p.p;}).length;
  let e1=document.getElementById("thProd"),e2=document.getElementById("thCats"),e3=document.getElementById("thOfs");
  if(e1)e1.textContent=cs.length;if(e2)e2.textContent=Object.keys(catSet).length;if(e3)e3.textContent=ofs;
}

// ── BÚSQUEDA MEJORADA ───────────────────────
// ── HISTORIAL DE BÚSQUEDA ────────────────────────────────────
let _searchHistory = [];
const _SEARCH_HIST_KEY = "ns_search_hist";
const _SEARCH_MAX = 5;

function _loadSearchHistory(){
  try{ _searchHistory = JSON.parse(localStorage.getItem(_SEARCH_HIST_KEY)||"[]"); }
  catch(e){ _searchHistory = []; }
}
function _saveSearchToHistory(q){
  q = q.trim();
  if(!q || q.length < 2) return;
  // Remove if already exists (move to front)
  _searchHistory = _searchHistory.filter(function(h){ return h !== q; });
  _searchHistory.unshift(q);
  if(_searchHistory.length > _SEARCH_MAX) _searchHistory = _searchHistory.slice(0, _SEARCH_MAX);
  try{ localStorage.setItem(_SEARCH_HIST_KEY, JSON.stringify(_searchHistory)); }catch(e){}
}
function _clearSearchHistory(){
  _searchHistory = [];
  try{ localStorage.removeItem(_SEARCH_HIST_KEY); }catch(e){}
  // Close suggestions panel
  let sugg = document.getElementById("swSugg");
  if(sugg) sugg.style.display = "none";
}
function _renderHistorySuggestions(){
  let sugg = document.getElementById("swSugg");
  if(!sugg) return;
  _loadSearchHistory();
  if(!_searchHistory.length){
    sugg.style.display = "none";
    return;
  }
  let html = '<div class="sw-sugg-sep" style="display:flex;align-items:center;justify-content:space-between">'
    + '<span>Búsquedas recientes</span>'
    + '<span style="cursor:pointer;color:var(--na);font-size:.72rem;font-weight:700" onclick="_clearSearchHistory()">Borrar</span>'
    + '</div>';
  html += _searchHistory.map(function(h){
    return '<div class="sw-sugg-item sw-hist-item" onclick="document.getElementById(\'sBusq\').value=\''+h.replace(/'/g,"\'")+'\';buscarDesdeHistorial(\''+h.replace(/'/g,"\'")+'\')">'
      + '<span class="sugg-ico" style="font-size:.9rem;opacity:.5">🕒</span>'
      + '<span class="sugg-nm">'+h+'</span>'
      + '<span style="font-size:.72rem;color:var(--gr);margin-left:auto;padding-left:8px">↗</span>'
      + '</div>';
  }).join("");
  sugg.innerHTML = html;
  sugg.style.display = "block";
}
function buscarDesdeHistorial(q){
  busqueda = q;
  document.getElementById("swSugg").style.display = "none";
  let cl = document.getElementById("swClear");
  if(cl) cl.style.display = "flex";
  if(paginaActual !== "tienda") irPagina("tienda");
  else renderProds();
}

function initSearch(){
  let inp=document.getElementById("sBusq"),sw=document.getElementById("swBox"),cl=document.getElementById("swClear"),sugg=document.getElementById("swSugg");
  if(!inp)return;
  inp.addEventListener("focus",function(){sw.classList.add("focused");if(!inp.value.trim())_renderHistorySuggestions();else mostrarSugerencias(inp.value);});
  inp.addEventListener("blur",function(){sw.classList.remove("focused");setTimeout(function(){sugg.style.display="none";},200);});
  inp.addEventListener("input",function(){
    let v=inp.value;
    if(cl)cl.style.display=v?"flex":"none";
    clearTimeout(swTimer);
    swTimer=setTimeout(function(){mostrarSugerencias(v);},250);
  });
  inp.addEventListener("keydown",function(e){
    if(e.key==="Enter"){sugg.style.display="none";buscar();}
    if(e.key==="Escape"){sugg.style.display="none";inp.blur();}
  });
}
function mostrarSugerencias(q){
  let sugg=document.getElementById("swSugg");if(!sugg)return;
  if(!q||q.length<1){sugg.style.display="none";return;}
  let ql=q.toLowerCase();
  let matches=PRODS.filter(function(p){return p.st>0&&(p.n.toLowerCase().indexOf(ql)>=0||(p.cat||"").toLowerCase().indexOf(ql)>=0);}).slice(0,6);
  if(!matches.length){sugg.innerHTML='<div class="sw-sugg-empty">🔍 Sin resultados para "'+q+'"</div>';sugg.style.display="block";return;}
  let catMatches=CATS.filter(function(c){return c.id>0&&c.n.toLowerCase().indexOf(ql)>=0;}).slice(0,2);
  let html="";
  if(catMatches.length){html+='<div class="sw-sugg-sep">Categorías</div>';html+=catMatches.map(function(c){return '<div class="sw-sugg-item" onclick="filtrarYVer('+c.id+')"><span class="sugg-ico">🏷️</span><span class="sugg-nm">'+resaltarTexto(c.n,q)+'</span></div>';}).join("");}
  html+='<div class="sw-sugg-sep">Productos</div>';
  html+=matches.map(function(p){
    let ico=p.img?'<img src="'+p.img+'" style="width:28px;height:28px;object-fit:cover;border-radius:6px;" />':(emojiProd(p));
    return '<div class="sw-sugg-item" onclick="_saveSearchToHistory(\''+ q +'\');verProd('+p.id+');document.getElementById(\'swSugg\').style.display=\'none\'"><span class="sugg-ico">'+ico+'</span><span class="sugg-nm">'+resaltarTexto(p.n,q)+'</span><span class="sugg-cat">'+p.cat+'</span></div>';
  }).join("");
  sugg.innerHTML=html;sugg.style.display="block";
}
function resaltarTexto(txt,q){let re=new RegExp("("+q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","gi");return txt.replace(re,"<mark>$1</mark>");}
function filtrarYVer(catId){document.getElementById("swSugg").style.display="none";catActiva=parseInt(catId);if(PAGE!=="tienda"){window.location.href="/tienda/";return;}renderProds();}
function limpiarBusqueda(){let inp=document.getElementById("sBusq");if(inp){inp.value="";busqueda="";inp.focus();}let cl=document.getElementById("swClear");if(cl)cl.style.display="none";let s=document.getElementById("swSugg");if(s)s.style.display="none";if(PAGE==="tienda"||paginaActual==="tienda")renderProds();}
function buscar(){busqueda=(document.getElementById("sBusq")||{}).value||"";busqueda=busqueda.trim();document.getElementById("swSugg").style.display="none";if(busqueda)_saveSearchToHistory(busqueda);if(PAGE!=="tienda"){ window.location.href="/tienda/?q="+encodeURIComponent(busqueda); return; } renderProds();}

// ── CARRUSEL (arreglado, sin dejar de girar) ─
let CR={ofertas:{idx:0,total:0,perPage:1,timer:null,items:[]},valorados:{idx:0,total:0,perPage:1,timer:null,items:[]}};

function carouselPerPage(){let w=window.innerWidth;return w<480?1:w<640?2:w<900?3:w<1200?4:5;}

function carouselInit(name,items,delay){
  let c=CR[name];c.items=items;c.idx=0;c.total=items.length;c.perPage=carouselPerPage();
  let track=document.getElementById("track"+cap(name));
  if(!track)return;
  // Si no hay items, limpiar skeleton y salir
  if(!items||!items.length){
    track.innerHTML='<div style="padding:24px;text-align:center;color:var(--gr);font-size:.9rem">Sin productos disponibles</div>';
    return;
  }
  // Fade out skeleton cards if present
  let skCards=track.querySelectorAll(".sk-card");
  if(skCards.length){
    skCards.forEach(function(sk){sk.style.transition="opacity .25s";sk.style.opacity="0";});
  }
  // doRender: escribe las tarjetas reales y recalcula dimensiones con rAF
  let doRender=function(){
    track.style.transition="none";
    track.innerHTML=items.map(function(html){return '<div class="pc" style="flex-shrink:0;width:var(--cw)">'+html+'</div>';}).join("");
    // Dots
    let maxDots=Math.max(1,c.total-c.perPage+1);
    let isDark=name==="valorados";
    let dots=document.getElementById("dots"+cap(name));
    if(dots)dots.innerHTML=Array.from({length:maxDots}).map(function(_,i){return '<span class="cdot'+(isDark?" cdot-dark":"")+(i===0?" on":"")+'"></span>';}).join("");
    if(c.timer)clearInterval(c.timer);
    if(c.total>c.perPage){c.timer=setInterval(function(){carouselNext(name);},delay||5000);}
    // Esperar a que el navegador calcule el layout antes de medir anchos
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        let outer=document.getElementById("outer"+cap(name));
        if(outer){
          let gap=14,pp=c.perPage;
          let ow=outer.getBoundingClientRect().width||outer.offsetWidth;
          if(ow<10)ow=window.innerWidth-32;
          let peekOffset=(pp===1&&ow<480)?Math.floor(ow*0.22):0;
          let cw=Math.floor((ow-peekOffset-(gap*(pp-1)))/pp);
          if(cw<80)cw=Math.floor((window.innerWidth-48)/pp);
          outer.style.setProperty("--cw",cw+"px");
          outer.style.setProperty("--cgap",gap+"px");
          Array.from(track.children).forEach(function(el){el.style.width=cw+"px";});
        }
        carouselRender(name);
      });
    });
  };
  if(skCards.length){
    setTimeout(doRender, 300);
  } else {
    doRender();
  }
}

function carouselRender(name){
  let c=CR[name];let track=document.getElementById("track"+cap(name));if(!track)return;
  let outer=document.getElementById("outer"+cap(name));if(!outer)return;
  let gap=14,pp=c.perPage,ow=outer.offsetWidth||outer.getBoundingClientRect().width||window.innerWidth;if(ow<10)ow=window.innerWidth;let peekOffset=(pp===1&&ow<480)?Math.floor(ow*0.12):0;let cw=Math.floor((ow-peekOffset-(gap*(pp-1)))/pp);if(cw<80)cw=Math.floor((window.innerWidth-48)/pp);
  outer.style.setProperty("--cw",cw+"px");outer.style.setProperty("--cgap",gap+"px");
  // Clamp idx
  let maxIdx=Math.max(0,c.total-pp);c.idx=Math.min(c.idx,maxIdx);
  let offset=c.idx*(cw+gap);
  track.style.transition="transform .45s cubic-bezier(.4,0,.2,1)";
  track.style.transform="translateX(-"+offset+"px)";
  // Update cards width
  Array.from(track.children).forEach(function(el){el.style.width=cw+"px";});
  // Update dots
  let maxDots=Math.max(1,c.total-pp+1);
  let dots=document.getElementById("dots"+cap(name));
  if(dots)Array.from(dots.children).forEach(function(d,i){d.classList.toggle("on",i===c.idx);});
}

function carouselNext(name){
  let c=CR[name];let maxIdx=Math.max(0,c.total-c.perPage);
  c.idx=c.idx>=maxIdx?0:c.idx+1;
  carouselRender(name);
  resetCarouselTimer(name);
}
function carouselPrev(name){
  let c=CR[name];let maxIdx=Math.max(0,c.total-c.perPage);
  c.idx=c.idx<=0?maxIdx:c.idx-1;
  carouselRender(name);
  resetCarouselTimer(name);
}
function resetCarouselTimer(name){
  let c=CR[name];if(c.timer)clearInterval(c.timer);
  if(c.total>c.perPage){let delay=name==="ofertas"?5000:4200;c.timer=setInterval(function(){carouselNext(name);},delay);}
}
function cap(s){return s.charAt(0).toUpperCase()+s.slice(1);}

// Swipe en carrusel
function initCarouselSwipe(name){
  let outer=document.getElementById("outer"+cap(name));if(!outer)return;
  let startX=0,isDragging=false;
  outer.addEventListener("mousedown",function(e){startX=e.clientX;isDragging=true;});
  outer.addEventListener("mousemove",function(e){if(!isDragging)return;});
  outer.addEventListener("mouseup",function(e){if(!isDragging)return;isDragging=false;let diff=startX-e.clientX;if(Math.abs(diff)>40){if(diff>0)carouselNext(name);else carouselPrev(name);}});
  outer.addEventListener("mouseleave",function(){isDragging=false;});
  outer.addEventListener("touchstart",function(e){startX=e.touches[0].clientX;},{passive:true});
  outer.addEventListener("touchend",function(e){let diff=startX-e.changedTouches[0].clientX;if(Math.abs(diff)>40){if(diff>0)carouselNext(name);else carouselPrev(name);}},{passive:true});
  // Pausar al hover
  outer.addEventListener("mouseenter",function(){let c=CR[name];if(c.timer){clearInterval(c.timer);c.timer=null;}});
  outer.addEventListener("mouseleave",function(){let c=CR[name];if(!c.timer&&c.total>c.perPage){let delay=name==="ofertas"?5000:4200;c.timer=setInterval(function(){carouselNext(name);},delay);}});
}

window.addEventListener("resize",function(){
  requestAnimationFrame(function(){
    ["ofertas","valorados"].forEach(function(name){
      let c=CR[name];
      if(!c||!c.items||!c.items.length)return;
      let newPP=carouselPerPage();
      if(newPP!==c.perPage){
        c.perPage=newPP;
        carouselInit(name,c.items,name==="ofertas"?5000:4200);
      } else {
        carouselRender(name);
      }
    });
  });
});
window.addEventListener("orientationchange",function(){
  setTimeout(function(){
    ["ofertas","valorados"].forEach(function(name){
      let c=CR[name];
      if(c&&c.items&&c.items.length){c.perPage=carouselPerPage();carouselInit(name,c.items,name==="ofertas"?5000:4200);}
    });
  },200);
});

// ── INICIO ──────────────────────────────────
function promedioEstrellas(pid){let arr=RESENIAS[pid];if(!arr||!arr.length)return 0;return arr.reduce(function(s,r){return s+r.estrellas;},0)/arr.length;}
function starsHtml(avg){let full=Math.round(avg),h="";for(let i=1;i<=5;i++)h+='<span style="color:'+(i<=full?"#f59e0b":"#d1d5db")+'">★</span>';return h;}

function renderInicio(){
  // Remove loading skeleton
  let sk=document.getElementById("skeletonLoader");
  if(sk)sk.remove();
  let ofs=PRODS.filter(function(p){return p.o&&p.o<p.p&&p.st>0;});
  if(!ofs.length)ofs=PRODS.filter(function(p){return p.st>0;}).slice(0,6);
  ofs=ofs.slice(0,6);
  carouselInit("ofertas",ofs.map(function(p){return tarjetaInner(p,true);}),5000);
  initCarouselSwipe("ofertas");

  let vals=PRODS.filter(function(p){return p.st>0;}).slice();
  vals.sort(function(a,b){return promedioEstrellas(b.id)-promedioEstrellas(a.id);});
  vals=vals.slice(0,6);
  carouselInit("valorados",vals.map(function(p){
    let avg=promedioEstrellas(p.id),stars=avg>0?starsHtml(avg):'<span style="color:#d1d5db">★★★★★</span>';
    let cnt=RESENIAS[p.id]?RESENIAS[p.id].length:0;
    return tarjetaInner(p,false,stars,cnt);
  }),4200);
  initCarouselSwipe("valorados");
  // Update heart state on all cards
  requestAnimationFrame(actualizarTodosHearts);
}

// ── TARJETA PRODUCTO ─────────────────────────

// ── WISHLIST ─────────────────────────────────────────────
function cargarWishlist(){
  try{let w=localStorage.getItem("ns_wishlist");wishlist=w?JSON.parse(w):[];}
  catch(e){wishlist=[];}
}
function guardarWishlist(){
  try{localStorage.setItem("ns_wishlist",JSON.stringify(wishlist));}catch(e){}
}
function enWishlist(pid){return wishlist.indexOf(pid)>=0;}
function toggleWishlist(pid,e){
  if(e){e.stopPropagation();e.preventDefault();}
  if(!usuario){toast("Inicia sesión para guardar favoritos","e");abrirModal("mLogin");return;}
  let idx=wishlist.indexOf(pid);
  if(idx>=0){
    wishlist.splice(idx,1);
    toast("Eliminado de favoritos","i");
  } else {
    wishlist.push(pid);
    toast("💙 Guardado en favoritos","s");
  }
  guardarWishlist();
  // Update all heart buttons for this product
  document.querySelectorAll(".wl-btn[data-pid=\""+pid+"\"]").forEach(function(btn){
    actualizarHeartBtn(btn, enWishlist(pid));
    // Pop animation
    btn.classList.remove("wl-pop");
    void btn.offsetWidth; // reflow
    btn.classList.add("wl-pop");
    setTimeout(function(){btn.classList.remove("wl-pop");}, 400);
  });
}
function actualizarHeartBtn(btn,active){
  if(!btn)return;
  btn.setAttribute("aria-label", active?"Quitar de favoritos":"Guardar en favoritos");
  btn.innerHTML = active
    ? '<svg viewBox="0 0 24 24" fill="#EF4444" width="18" height="18"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
  btn.classList.toggle("wl-active", active);
}
function actualizarTodosHearts(){
  document.querySelectorAll(".wl-btn").forEach(function(btn){
    let pid=parseInt(btn.getAttribute("data-pid"));
    actualizarHeartBtn(btn, enWishlist(pid));
  });
}
function renderWishlist(){
  let ids=wishlist.slice();
  if(!ids.length){
    return '<div class="empty"><div class="eico">💙</div><h3>Sin favoritos aún</h3><p>Toca el corazón en cualquier producto para guardarlo aquí.</p><button class="bp" style="margin-top:14px" onclick="cerrarModal(\'mPanel\');irPagina(\'tienda\')">🛍️ Explorar Tienda</button></div>';
  }
  let prods=ids.map(function(id){return PRODS.find(function(p){return p.id===id;});}).filter(Boolean);
  if(!prods.length){
    return '<div class="empty"><div class="eico">💙</div><h3>Productos no disponibles</h3><p>Algunos productos guardados ya no están disponibles.</p></div>';
  }
  return '<div style="display:flex;flex-direction:column;gap:10px">'+prods.map(function(p){
    let imgEl=p.img?'<img src="'+p.img+'" style="width:56px;height:56px;object-fit:cover;border-radius:10px;flex-shrink:0"/>':
      '<div style="width:56px;height:56px;border-radius:10px;background:linear-gradient(135deg,#EFF6FF,#DBEAFE);display:flex;align-items:center;justify-content:center;font-size:1.6rem;flex-shrink:0">'+emojiProd(p)+'</div>';
    let agotado=p.st<=0;
    let imgContent=p.img?'<img src="'+p.img+'" />':emojiProd(p);
    return '<div class="wl-item" onclick="cerrarModal(\'mPanel\');verProd('+p.id+')">'+
      '<div class="wl-item-img">'+imgContent+'</div>'+
      '<div class="wl-item-info">'+
        '<div class="wl-item-name">'+p.n+'</div>'+
        '<div class="wl-item-cat">'+p.cat+'</div>'+
        '<div class="wl-item-price">'+bs(p.o||p.p)+'</div>'+
      '</div>'+
      '<div class="wl-item-actions">'+
        (agotado
          ? '<span style="background:#FEF2F2;color:#DC2626;font-size:.68rem;font-weight:700;padding:3px 8px;border-radius:50px">Agotado</span>'
          : '<button class="badd pact-cart" style="padding:7px 12px;font-size:.75rem;border-radius:9px;white-space:nowrap;margin-top:0" onclick="event.stopPropagation();addCart('+p.id+')">🛒 Agregar</button>')+
        '<button class="wl-btn wl-active" data-pid="'+p.id+'" onclick="event.stopPropagation();toggleWishlist('+p.id+',event)" aria-label="Quitar de favoritos">'+
          '<svg viewBox="0 0 24 24" fill="#EF4444" width="16" height="16"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'+
        '</button>'+
      '</div>'+
    '</div>';
  }).join("")+'</div>';
}

function tarjetaInner(p,showOferta,starsStr,cnt){
  let imgEl=p.img?'<img src="'+p.img+'" data-pid="'+p.id+'" onclick="event.stopPropagation();(function(el){let pp=PRODS.find(function(x){return x.id===parseInt(el.dataset.pid);});if(pp)abrirZoomImagen(el.src,pp.n);})(this)"/>':(
    '<span class="pi-emoji">'+emojiProd(p)+'</span>'
  );
  let starsEl=starsStr?'<div class="pstars">'+starsStr+(cnt?' <small style="color:var(--gr);font-size:.7rem">('+cnt+')</small>':'')+'</div>':"";
  let ofPct=(showOferta&&p.o&&p.p>0)?Math.round((1-p.o/p.p)*100):0;
  let pctBadge=ofPct>0?'<span class="pdesc-pct">-'+ofPct+'%</span>':"";
  let stockBadge=(p.st>0&&p.st<=5)?'<span style="position:absolute;bottom:8px;left:8px;background:rgba(230,81,0,.9);color:#fff;font-size:.62rem;font-weight:900;padding:3px 7px;border-radius:50px;z-index:2">⚡ Solo '+p.st+'</span>':"";
  return '<div class="pi">'+imgEl+
    ((showOferta&&p.o)||(!showOferta&&p.o)?'<span class="pbo">🔥 OFERTA</span>':'')+
    pctBadge+(p.dest?'<span class="pbd">⭐</span>':'')+
    stockBadge+
    '</div><div class="pif">'+
    '<div class="pcat">'+p.cat+'</div>'+
    '<div class="pnm">'+p.n+'</div>'+
    starsEl+
    '<div class="ppr"><span class="ppr-v">'+bs(p.o||p.p)+'</span>'+(p.o?'<span class="ppr-o">'+bs(p.p)+'</span>':'')+
    '</div>'+
    '<div class="pact-row">'+
    '<button class="badd pact-cart" onclick="event.stopPropagation();addCart('+p.id+')">🛒 Agregar</button>'+
    '<button class="wl-btn" data-pid="'+p.id+'" onclick="event.stopPropagation();toggleWishlist('+p.id+',event)" aria-label="Guardar en favoritos">'+
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'+
    '</button>'+
    '</div></div>';
}
function tarjetaHTML(p,showOferta,starsStr,cnt){
  return '<div class="pc" onclick="verProd('+p.id+')">'+tarjetaInner(p,showOferta,starsStr,cnt)+'</div>';
}

// ── TIENDA ──────────────────────────────────
function cargarCats(){let c=document.getElementById("cats");if(!c)return;c.innerHTML=CATS.map(function(cat){return '<button class="cc'+(cat.id===catActiva?" on":"")+'" onclick="filtCat('+cat.id+',this)">'+cat.n+'</button>';}).join("");}
function filtCat(id,btn){catActiva=id;document.querySelectorAll(".cc").forEach(function(b){b.classList.remove("on");});btn.classList.add("on");renderProds();}
function sortProds(val){sortActivo=val;renderProds();}
function prodsFiltrados(){
  let q=busqueda.toLowerCase().trim();
  return PRODS.filter(function(p){
    if(p.st<=0)return false;
    // Categoría
    let mc=catActiva===0||p.cid===catActiva;
    if(!mc)return false;
    // Búsqueda texto
    if(q){
      let mb=p.n.toLowerCase().indexOf(q)>=0||
             (p.d||"").toLowerCase().indexOf(q)>=0||
             (p.cat||"").toLowerCase().indexOf(q)>=0||
             String(p.p).indexOf(q)>=0;
      if(!mb)return false;
    }
    // Precio
    let precio=p.o||p.p;
    if(precio<filtroPrecioMin||precio>filtroPrecioMax)return false;
    // Rating mínimo
    if(filtroRating>0){
      let avg=promedioEstrellas(p.id);
      if(avg<filtroRating)return false;
    }
    // Solo ofertas
    if(filtroSoloOfertas&&!(p.o&&p.o<p.p))return false;
    return true;
  });
}

// ── FILTROS TIENDA ──────────────────────────────────────
function initFiltrosPanel(){
  // Calculate min/max prices from PRODS
  if(!PRODS.length)return;
  let precios=PRODS.filter(function(p){return p.st>0;}).map(function(p){return p.o||p.p;});
  let pMin=Math.floor(Math.min.apply(null,precios));
  let pMax=Math.ceil(Math.max.apply(null,precios));
  // Round to nice numbers
  pMin=Math.floor(pMin/1000)*1000;
  pMax=Math.ceil(pMax/1000)*1000;
  let slMin=document.getElementById("fSliderMin");
  let slMax=document.getElementById("fSliderMax");
  if(!slMin||!slMax)return;
  slMin.min=pMin;slMin.max=pMax;slMin.value=filtroPrecioMin>0?filtroPrecioMin:pMin;
  slMax.min=pMin;slMax.max=pMax;slMax.value=filtroPrecioMax<Infinity?filtroPrecioMax:pMax;
  slMin.step=Math.max(1000,Math.floor((pMax-pMin)/100));
  slMax.step=slMin.step;
  actualizarPrecioLabels();
  actualizarRangeFill();
}
function actualizarPrecioLabels(){
  let slMin=document.getElementById("fSliderMin");
  let slMax=document.getElementById("fSliderMax");
  let lMin=document.getElementById("fPrecioMin");
  let lMax=document.getElementById("fPrecioMax");
  if(!slMin||!lMin)return;
  lMin.textContent=bs(parseFloat(slMin.value));
  lMax.textContent=bs(parseFloat(slMax.value));
}
function actualizarRangeFill(){
  let slMin=document.getElementById("fSliderMin");
  let slMax=document.getElementById("fSliderMax");
  let fill=document.getElementById("fRangeFill");
  if(!slMin||!fill)return;
  let min=parseFloat(slMin.min),max=parseFloat(slMin.max);
  let vMin=parseFloat(slMin.value),vMax=parseFloat(slMax.value);
  let pLeft=((vMin-min)/(max-min))*100;
  let pRight=((vMax-min)/(max-min))*100;
  fill.style.left=pLeft+"%";
  fill.style.width=(pRight-pLeft)+"%";
}
function onSliderMin(el){
  let slMax=document.getElementById("fSliderMax");
  if(parseFloat(el.value)>parseFloat(slMax.value)-parseFloat(el.step)){
    el.value=parseFloat(slMax.value)-parseFloat(el.step);
  }
  filtroPrecioMin=parseFloat(el.value);
  actualizarPrecioLabels();
  actualizarRangeFill();
  actualizarFiltrosBadge();
  renderProds();
}
function onSliderMax(el){
  let slMin=document.getElementById("fSliderMin");
  if(parseFloat(el.value)<parseFloat(slMin.value)+parseFloat(el.step)){
    el.value=parseFloat(slMin.value)+parseFloat(el.step);
  }
  filtroPrecioMax=parseFloat(el.value);
  actualizarPrecioLabels();
  actualizarRangeFill();
  actualizarFiltrosBadge();
  renderProds();
}
function setRatingFiltro(val,btn){
  filtroRating=val;
  document.querySelectorAll(".filtro-star-btn").forEach(function(b){b.classList.remove("on");});
  btn.classList.add("on");
  actualizarFiltrosBadge();
  renderProds();
}
function toggleFiltroOfertas(){
  filtroSoloOfertas=!filtroSoloOfertas;
  let btn=document.getElementById("fSoloOfertas");
  if(btn){
    btn.classList.toggle("on",filtroSoloOfertas);
    btn.querySelector(".filtro-check-ico").textContent=filtroSoloOfertas?"●":"○";
  }
  actualizarFiltrosBadge();
  renderProds();
}
function toggleFiltrosPanel(){
  let panel=document.getElementById("filtrosPanel");
  let btn=document.getElementById("filtrosToggleBtn");
  if(!panel)return;
  let open=panel.style.display==="none"||!panel.style.display;
  panel.style.display=open?"block":"none";
  if(btn)btn.classList.toggle("on",open);
  if(open)initFiltrosPanel();
}
function resetFiltros(){
  filtroPrecioMin=0;filtroPrecioMax=Infinity;
  filtroRating=0;filtroSoloOfertas=false;
  catActiva=0;busqueda="";
  let inp=document.getElementById("sBusq");if(inp)inp.value="";
  let cl=document.getElementById("swClear");if(cl)cl.style.display="none";
  // Reset UI
  document.querySelectorAll(".filtro-star-btn").forEach(function(b){b.classList.remove("on");});
  let allBtn=document.querySelector(".filtro-star-btn[data-val='0']");
  if(allBtn)allBtn.classList.add("on");
  let ofBtn=document.getElementById("fSoloOfertas");
  if(ofBtn){ofBtn.classList.remove("on");ofBtn.querySelector(".filtro-check-ico").textContent="○";}
  initFiltrosPanel();
  actualizarFiltrosBadge();
  cargarCats();
  renderProds();
}
function actualizarFiltrosBadge(){
  let cnt=0;
  if(filtroRating>0)cnt++;
  if(filtroSoloOfertas)cnt++;
  if(filtroPrecioMin>0)cnt++;
  if(filtroPrecioMax<Infinity)cnt++;
  let badge=document.getElementById("filtrosBadge");
  if(badge){badge.style.display=cnt>0?"inline-flex":"none";badge.textContent=cnt;}
  let btn=document.getElementById("filtrosToggleBtn");
  if(btn)btn.classList.toggle("has-active",cnt>0);
}

function renderProds(){
  let sk=document.getElementById("skeletonLoader");if(sk)sk.remove();
  let g=document.getElementById("pg");if(!g)return;
  let lista=prodsFiltrados();
  if(sortActivo==="precioAsc")lista.sort(function(a,b){return (a.o||a.p)-(b.o||b.p);});
  else if(sortActivo==="precioDesc")lista.sort(function(a,b){return (b.o||b.p)-(a.o||a.p);});
  else if(sortActivo==="nombre")lista.sort(function(a,b){return a.n.localeCompare(b.n);});
  else if(sortActivo==="valorados")lista.sort(function(a,b){return promedioEstrellas(b.id)-promedioEstrellas(a.id);});
  // Contador de resultados
  let filtroInfo=document.getElementById("filtroInfo");
  if(!filtroInfo){
    let toolbar=document.querySelector(".tienda-toolbar");
    if(toolbar){filtroInfo=document.createElement("div");filtroInfo.id="filtroInfo";filtroInfo.style.cssText="font-size:.8rem;font-weight:700;color:var(--gr);padding:6px 16px 0;max-width:960px;margin:0 auto;";toolbar.after(filtroInfo);}
  }
  if(filtroInfo){
    let txt="";
    if(busqueda)txt+="🔍 \""+busqueda+"\" — ";
    if(catActiva>0){let cat=CATS.find(function(c){return c.id===catActiva;});if(cat)txt+=cat.n+" — ";}
    txt+=lista.length+" resultado"+(lista.length!==1?"s":"");
    if(busqueda||catActiva>0)txt+=' <span style="cursor:pointer;color:var(--na);text-decoration:underline;margin-left:6px" onclick="catActiva=0;busqueda="";document.getElementById(\"sBusq\").value="";renderProds();cargarCats()">✕ Limpiar</span>';
    filtroInfo.innerHTML=txt;
  }
  if(!lista.length){g.innerHTML='<div style="grid-column:1/-1" class="empty"><div class="eico">🔍</div><h3>Sin resultados</h3><p>Prueba otra búsqueda o categoría</p>'+(busqueda||catActiva>0?'<button class="btn-hero-2" style="margin-top:12px;font-size:.85rem" onclick="catActiva=0;busqueda="";document.getElementById(\"sBusq\").value="";renderProds();cargarCats()">Ver todos los productos</button>':'')+' </div>';return;}
  g.innerHTML=lista.map(function(p){let avg=promedioEstrellas(p.id);let stars=avg>0?starsHtml(avg):null;let cnt=RESENIAS[p.id]?RESENIAS[p.id].length:0;return tarjetaHTML(p,true,stars,cnt);}).join("");
  requestAnimationFrame(actualizarTodosHearts);
}

// ── VER PRODUCTO ─────────────────────────────

// ── COMPARTIR PRODUCTO ────────────────────────────────────────

// ── ZOOM IMAGEN PRODUCTO ──────────────────────────────────────
function abrirZoomImagen(src, alt){
  // Remove existing
  let existing = document.getElementById("imgZoomOv");
  if(existing) existing.remove();

  let ov = document.createElement("div");
  ov.id = "imgZoomOv";
  ov.className = "img-zoom-ov";
  ov.setAttribute("role","dialog");
  ov.setAttribute("aria-label","Imagen ampliada");

  let img = document.createElement("img");
  img.src = src;
  img.alt = alt || "Producto";
  img.className = "img-zoom-img";

  let closeBtn = document.createElement("button");
  closeBtn.className = "img-zoom-close";
  closeBtn.innerHTML = "✕";
  closeBtn.setAttribute("aria-label","Cerrar");

  ov.appendChild(closeBtn);
  ov.appendChild(img);
  document.body.appendChild(ov);

  // Animate in
  requestAnimationFrame(function(){
    ov.classList.add("visible");
  });

  // Close handlers
  function cerrar(){
    ov.classList.remove("visible");
    setTimeout(function(){ if(ov.parentNode) ov.remove(); }, 250);
  }
  closeBtn.addEventListener("click", cerrar);
  ov.addEventListener("click", function(e){ if(e.target === ov) cerrar(); });
  document.addEventListener("keydown", function onKey(e){
    if(e.key === "Escape"){ cerrar(); document.removeEventListener("keydown", onKey); }
  });

  // Pinch-to-zoom on mobile (basic)
  let scale = 1, lastDist = 0;
  ov.addEventListener("touchstart", function(e){
    if(e.touches.length===2) lastDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY
    );
  }, {passive:true});
  ov.addEventListener("touchmove", function(e){
    if(e.touches.length===2){
      let dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      scale = Math.min(4, Math.max(1, scale * dist/lastDist));
      img.style.transform = "scale("+scale+")";
      lastDist = dist;
    }
  }, {passive:true});
}

function compartirProducto(pid, nom){
  let p = PRODS.find(function(x){ return x.id === pid; });
  let pNom = nom || (p ? p.n : "Producto");
  let url  = window.location.href.split("?")[0];
  let text = "👀 Mira este producto en NuestroStore:\n*" + pNom + "*";
  if(p && p.o) text += "\n💰 " + bs(p.o) + " (antes " + bs(p.p) + ")";
  else if(p)   text += "\n💰 " + bs(p.p);
  text += "\n\n" + url;

  if(navigator.share){
    navigator.share({ title: pNom, text: text, url: url })
      .catch(function(){});
  } else {
    // Fallback: copy to clipboard
    let copyText = text;
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(copyText).then(function(){
        toast("🔗 Link copiado al portapapeles","s");
      }).catch(function(){
        _fallbackCopy(copyText);
      });
    } else {
      _fallbackCopy(copyText);
    }
  }
}
function _fallbackCopy(text){
  let ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;top:-9999px;left:-9999px";
  document.body.appendChild(ta);
  ta.select();
  try{ document.execCommand("copy"); toast("🔗 Link copiado al portapapeles","s"); }
  catch(e){ toast("No se pudo copiar el link","e"); }
  document.body.removeChild(ta);
}

function verProd(id){
  let p=PRODS.find(function(x){return x.id===id;});if(!p)return;
  document.getElementById("mProdT").textContent=p.n;
  let imgHtml=p.img?'<img src="'+p.img+'" data-pid="'+p.id+'" style="width:100%;border-radius:12px;margin-bottom:16px;max-height:240px;object-fit:cover;cursor:zoom-in" onclick="(function(el){let pp=PRODS.find(function(x){return x.id===parseInt(el.dataset.pid);});if(pp)abrirZoomImagen(el.src,pp.n);})(this)"/>':
    '<div style="text-align:center;font-size:6rem;padding:24px 20px;background:linear-gradient(135deg,#fff8e1,#ffe082);border-radius:12px;margin-bottom:16px">'+emojiProd(p)+'</div>';
  let avg=promedioEstrellas(p.id),cnt=RESENIAS[p.id]?RESENIAS[p.id].length:0;
  let starsRow=avg>0?'<div style="margin-bottom:14px">'+starsHtml(avg)+' <span style="color:var(--gr);font-size:.85rem">'+avg.toFixed(1)+'/5 ('+cnt+' reseña'+(cnt!==1?'s':'')+')</span></div>':"";
  let listaRes=RESENIAS[p.id]||[];
  let agotado=p.st<=0;
  let resHtml='<div style="margin-top:18px;border-top:2px solid #f0f0f0;padding-top:14px"><div style="font-weight:800;color:var(--na3);margin-bottom:12px">⭐ Reseñas ('+listaRes.length+')</div>';
  if(listaRes.length){resHtml+='<div style="max-height:180px;overflow-y:auto">'+listaRes.map(function(r){return '<div class="resenia-item"><div class="res-header"><span class="res-autor">'+r.uNom+' '+r.uApe[0]+'.</span><span class="res-fecha">'+r.fecha+'</span></div><div class="res-stars">'+starsHtml(r.estrellas)+'</div><div class="res-texto">'+r.comentario+'</div></div>';}).join("")+'</div>';}
  else resHtml+='<div style="color:var(--gr);font-size:.85rem;text-align:center;padding:12px">Sin reseñas aún.</div>';
  resHtml+='</div>';
  document.getElementById("mProdB").innerHTML=imgHtml+
    '<div class="pcat" style="margin-bottom:6px">'+p.cat+'</div>'+starsRow+
    '<p style="color:#555;line-height:1.7;margin-bottom:16px">'+(p.d||"Sin descripción")+'</p>'+
    '<div class="ppr" style="margin-bottom:6px"><span class="ppr-v" style="font-size:2rem">'+bs(p.o||p.p)+'</span>'+(p.o?'<span class="ppr-o">'+bs(p.p)+'</span>':'')+
    '</div>'+(agotado?'<div style="background:#ffebee;border-radius:8px;padding:10px 14px;text-align:center;font-weight:800;color:#c62828;margin-bottom:14px">❌ Producto Agotado</div>':
    '<p style="color:#888;font-size:.85rem;margin-bottom:18px">📦 Stock: '+p.st+' unidades</p>'+
    '<button class="bp" onclick="addCart('+p.id+');cerrarModal(\"mProd\")">🛒 Agregar al Carrito</button>')+
    (usuario?'<button class="wl-btn-lg"'+(enWishlist(p.id)?' style="border-color:#3B82F6;color:#1E3A8A;background:#EFF6FF"':'')+' data-pid="'+p.id+'" onclick="toggleWishlist('+p.id+',event);let b=this;b.style.background=enWishlist('+p.id+')?\"#EFF6FF\":\"#fff\";b.style.color=enWishlist('+p.id+')?\"#1E3A8A\":\"var(--gr2)\";b.innerHTML=enWishlist('+p.id+')?\"💙 En Favoritos\":\"🤍 Guardar en Favoritos\"">'+(enWishlist(p.id)?'💙 En Favoritos':'🤍 Guardar en Favoritos')+'</button>':'')+
    (usuario&&!agotado?'<button class="bs" onclick="abrirResenia('+p.id+')">⭐ Escribir Reseña</button>':'')+
    (usuario?'<button class="bs" onclick="cerrarModal(\"mProd\");abrirRep('+p.id+')">🚨 Reportar Problema</button>':'')+resHtml;
  // Productos relacionados
  let relacionados = PRODS.filter(function(x){
    return x.id !== p.id && x.cid === p.cid && x.st > 0;
  }).slice(0,4);
  let relHtml = '';
  if(relacionados.length){
    relHtml = '<div style="margin-top:20px;border-top:2px solid #f0f0f0;padding-top:16px">'
      + '<div style="font-weight:800;color:var(--na3);margin-bottom:12px;font-size:.9rem">🛍️ También te puede gustar</div>'
      + '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">'
      + relacionados.map(function(r){
          let rImg = r.img
            ? '<img src="'+r.img+'" style="width:100%;height:80px;object-fit:cover;border-radius:8px;margin-bottom:8px"/>'
            : '<div style="height:80px;border-radius:8px;background:linear-gradient(135deg,#EFF6FF,#DBEAFE);display:flex;align-items:center;justify-content:center;font-size:2rem;margin-bottom:8px">'+emojiProd(r)+'</div>';
          let rPct = (r.o && r.p > 0) ? Math.round((1-r.o/r.p)*100) : 0;
          let card = document.createElement("div");
          card.style.cssText = "background:#fff;border:1.5px solid #E2E8F0;border-radius:12px;padding:10px;cursor:pointer;transition:border-color .18s";
          card.setAttribute("data-relid", r.id);
          card.innerHTML = rImg
            + '<div style="font-size:.75rem;font-weight:700;color:#64748B;margin-bottom:2px">'+r.cat+'</div>'
            + '<div style="font-size:.8rem;font-weight:700;color:#0F172A;line-height:1.3;margin-bottom:4px">'+r.n+'</div>'
            + '<div style="font-family:Bebas Neue,cursive;font-size:.95rem;color:#1E3A8A">'
            + bs(r.o||r.p)
            + (rPct > 0 ? ' <span style="background:#EF4444;color:#fff;font-size:.55rem;font-weight:900;padding:1px 5px;border-radius:50px;font-family:Inter,sans-serif">-'+rPct+'%</span>' : '')
            + '</div>';
          card.addEventListener("mouseenter", function(){ this.style.borderColor="#93C5FD"; });
          card.addEventListener("mouseleave", function(){ this.style.borderColor="#E2E8F0"; });
          card.addEventListener("click", function(){
            let rid = parseInt(this.getAttribute("data-relid"));
            cerrarModal("mProd");
            setTimeout(function(){ verProd(rid); }, 80);
          });
          return card.outerHTML;
        }).join("")
      + '</div></div>';
  }
  document.getElementById("mProdB").innerHTML = document.getElementById("mProdB").innerHTML + relHtml;
  abrirModal("mProd");
}

// ── RESEÑAS ──────────────────────────────────
function selStar(v){starSelVal=v;document.getElementById("resEstrellas").value=v;document.querySelectorAll("#starSelector .star").forEach(function(s){s.classList.toggle("sel",parseInt(s.getAttribute("data-v"))<=v);});}
function abrirResenia(pid,nom){
  if(!nom){let pp=PRODS.find(function(x){return x.id===pid;});nom=pp?pp.n:"Producto";}if(!usuario){toast("Inicia sesión","e");abrirModal("mLogin");return;}document.getElementById("resPid").value=pid;document.getElementById("resProdNom").textContent="📦 "+nom;document.getElementById("resComentario").value="";starSelVal=5;selStar(5);cerrarModal("mProd");abrirModal("mResenia");}
function enviarResenia(){if(!usuario){toast("Inicia sesión","e");return;}let pid=parseInt(document.getElementById("resPid").value),coment=document.getElementById("resComentario").value.trim();if(!coment){toast("Escribe un comentario","e");return;}api("/resenias","POST",{uid:usuario.id,pid:pid,estrellas:starSelVal,comentario:coment}).then(function(r){if(!r.ok){toast(r.error||"Error","e");return;}toast("¡Reseña publicada! ⭐","s");cerrarModal("mResenia");api("/resenias").then(function(rr){if(rr.ok){RESENIAS={};rr.resenias.forEach(function(res){if(!RESENIAS[res.pid])RESENIAS[res.pid]=[];RESENIAS[res.pid].push(res);});renderInicio();if(PAGE==="tienda"||paginaActual==="tienda")renderProds();}});});}

// ── PERFIL ───────────────────────────────────
let AVATARES=["😊","🧑","👩","👨","🧑‍💻","👩‍💼","👨‍💼","🧑‍🎨","👩‍🍳","👨‍🔬","🦸","🧙","🐱","🦊","🐸","🌟","🔥","💎","🏆","🚀","🎮","🎨","🎸","⚽","🌈"];
let perfilAvatarSel="";

function abrirPerfil(){
  if(!usuario){abrirModal("mLogin");return;}
  api("/perfil/"+usuario.id).then(function(r){
    if(!r.ok){toast("Error al cargar perfil","e");return;}
    let pf=r.perfil;
    perfilAvatarSel=pf.avatar||"";
    let avaDisplay=pf.avatar?(pf.avatar.startsWith("data:")||/^\p{Emoji}/u.test(pf.avatar)||pf.avatar.length<=8)?'<span style="font-size:2.5rem">'+pf.avatar+'</span>':'<img src="'+pf.avatar+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />'
      :'<span style="font-size:2.5rem">'+usuario.n[0]+'</span>';
    let rolLabel={cliente:"👤 Cliente",administrador:"⚙️ Administrador",superadmin:"👑 Super Admin"}[pf.rol]||pf.rol;
    let html='<div class="perfil-hero">'+
      '<div class="perfil-ava-wrap">'+
        '<div class="perfil-ava" id="perfilAvaPreview">'+avaDisplay+'</div>'+
        '<div class="perfil-ava-edit" onclick="document.getElementById(\"perfilImgInput\").click()">📷</div>'+
        '<input type="file" id="perfilImgInput" accept="image/*" style="display:none" onchange="cargarAvatarImg(event)"/>'+
      '</div>'+
      '<div class="perfil-info">'+
        '<div class="perfil-nom">'+pf.nombre+' '+pf.apellido+'</div>'+
        '<div class="perfil-email">'+pf.email+'</div>'+
        '<div class="perfil-rol">'+rolLabel+'</div>'+
      '</div>'+
    '</div>'+
    '<div style="font-weight:800;font-size:.88rem;color:var(--gr2);margin-bottom:8px">Elige un avatar emoji:</div>'+
    '<div class="avatar-grid">'+AVATARES.map(function(av){return '<div class="ava-opt'+(perfilAvatarSel===av?' sel':''  )+'" data-av="'+av+'" onclick="selAvatar(this.getAttribute(\"data-av\"))" title="'+av+'">'+av+'</div>';}).join('')+'</div>'+
    '<div class="f2">'+
      '<div class="fg"><label>Nombre *</label><input class="fc" id="pfNom" value="'+pf.nombre+'"/></div>'+
      '<div class="fg"><label>Apellido *</label><input class="fc" id="pfApe" value="'+pf.apellido+'"/></div>'+
    '</div>'+
    '<div class="fg"><label>Teléfono</label><input class="fc" id="pfTel" type="tel" value="'+(pf.tel||'')+'"/></div>'+
    '<details style="margin-bottom:14px"><summary style="cursor:pointer;font-weight:700;color:var(--gr);font-size:.88rem;padding:8px 0">🔑 Cambiar contraseña (opcional)</summary>'+
    '<div style="padding-top:10px">'+
    '<div class="fg"><label>Contraseña actual</label><input class="fc" type="password" id="pfOldPw" placeholder="Tu contraseña actual"/></div>'+
    '<div class="fg"><label>Nueva contraseña</label><input class="fc" type="password" id="pfNewPw" placeholder="Mínimo 8 caracteres"/></div>'+
    '</div></details>'+
    '<div id="pfErr" class="form-err" style="display:none"></div>'+
    '<button class="bp" onclick="guardarPerfil()">💾 Guardar Cambios</button>'+
    '<div style="margin-top:14px;padding-top:14px;border-top:2px solid #f0e4d0">'+
    '<div style="font-weight:800;font-size:.82rem;color:var(--gr2);margin-bottom:8px">🎵 Reproductor de música</div>'+
    '<button id="mpPerfilBtn" onclick="mpPerfilToggle()" style="width:100%;padding:11px 14px;border-radius:10px;border:2px solid #e0d0c0;background:#fff8f0;font-weight:700;font-size:.85rem;cursor:pointer;display:flex;align-items:center;justify-content:space-between;color:var(--na3)">'+mpPerfilBtnLabel()+'</button>'+
    '</div>';
    document.getElementById("mPerfilB").innerHTML=html;
    abrirModal("mPerfil");
  });
}

function selAvatar(av){
  perfilAvatarSel=av;
  document.querySelectorAll(".ava-opt").forEach(function(el){el.classList.toggle("sel",el.textContent===av);});
  let prev=document.getElementById("perfilAvaPreview");if(prev)prev.innerHTML='<span style="font-size:2.5rem">'+av+'</span>';
}
function cargarAvatarImg(e){let file=e.target.files[0];if(!file)return;let r=new FileReader();r.onload=function(ev){perfilAvatarSel=ev.target.result;let prev=document.getElementById("perfilAvaPreview");if(prev)prev.innerHTML='<img src="'+ev.target.result+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>';};r.readAsDataURL(file);}

function guardarPerfil(){
  let nom=(document.getElementById("pfNom").value||"").trim();
  let ape=(document.getElementById("pfApe").value||"").trim();
  let tel=(document.getElementById("pfTel").value||"").trim();
  let oldPw=(document.getElementById("pfOldPw").value||"").trim();
  let newPw=(document.getElementById("pfNewPw").value||"").trim();
  let errEl=document.getElementById("pfErr");errEl.style.display="none";
  if(!nom||!ape){errEl.textContent="⚠️ Nombre y apellido requeridos.";errEl.style.display="block";return;}
  let avatarAEnviar=perfilAvatarSel||"";
  api("/perfil/"+usuario.id,"PUT",{nombre:nom,apellido:ape,tel:tel,avatar:avatarAEnviar,old_pw:oldPw,nueva_pw:newPw}).then(function(r){
    if(!r.ok){errEl.textContent="❌ "+(r.error||"Error");errEl.style.display="block";return;}
    usuario.n=nom;usuario.a=ape;usuario.avatar=avatarAEnviar;
    perfilAvatarSel=avatarAEnviar;
    // Actualizar localStorage con los nuevos datos
    localStorage.setItem("ns_usuario", JSON.stringify(usuario));
    // Si cambió la contraseña, avisar al usuario que debe volver a iniciar sesión
    if(newPw){
      toast("✅ Perfil y contraseña actualizados","s");
    } else {
      toast("✅ Perfil actualizado","s");
    }
    cerrarModal("mPerfil");
    actualizarUI();
  });
}

// ── LOGIN / REGISTRO ─────────────────────────
let _loginAttempts = 0;
let _loginLocked = false;
function doLogin(){
  if(_loginLocked){ toast("Demasiados intentos. Espera 30 segundos.", "e"); return; }
  let emailEl=document.getElementById("lEmail"),passEl=document.getElementById("lPass"),errEl=document.getElementById("loginErr"),btnEl=document.getElementById("btnLogin");
  let email=emailEl.value.trim().toLowerCase(),pass=passEl.value;
  errEl.style.display="none";
  if(!email||!pass){errEl.textContent="⚠️ Correo y contraseña requeridos.";errEl.style.display="block";return;}
  btnEl.disabled=true;btnEl.textContent="Verificando...";
  api("/login","POST",{email:email,password:pass}).then(function(r){
    btnEl.disabled=false;btnEl.textContent="Entrar →";
    if(!r.ok){_loginAttempts++;errEl.textContent="❌ "+(r.error||"Credenciales incorrectas.")+((_loginAttempts>=3)?" ("+( 5-_loginAttempts)+" intentos restantes)":"");errEl.style.display="block";passEl.value="";passEl.focus();if(_loginAttempts>=5){_loginLocked=true;setTimeout(function(){_loginLocked=false;_loginAttempts=0;toast("Puedes intentar de nuevo","i");},30000);}return;}
    usuario=r.usuario;localStorage.setItem("ns_usuario",JSON.stringify(usuario));cerrarModal("mLogin");emailEl.value="";passEl.value="";errEl.style.display="none";
    toast("¡Bienvenido, "+usuario.n+"! ("+({cliente:"Cliente",administrador:"Admin",superadmin:"Super Admin"}[usuario.rol]||usuario.rol)+")","s");
    actualizarUI();cargarDatos();mpCargarDesdeDB();_mpYaCargo=true;setTimeout(_checkPushEstado,800);
  });
}
function doRegistro(){
  let nom=document.getElementById("rNom").value.trim(),ape=document.getElementById("rApe").value.trim();
  let email=document.getElementById("rEmail").value.trim().toLowerCase(),pass=document.getElementById("rPass").value;
  let tel=document.getElementById("rTel").value.trim(),errEl=document.getElementById("regErr");errEl.style.display="none";
  if(!nom||!ape||!email||!pass){errEl.textContent="⚠️ Completa todos los campos.";errEl.style.display="block";return;}
  if(pass.length<8){errEl.textContent="⚠️ Mínimo 8 caracteres.";errEl.style.display="block";return;}
  api("/registro","POST",{nom:nom,ape:ape,email:email,password:pass,tel:tel}).then(function(r){
    if(!r.ok){errEl.textContent="⚠️ "+(r.error||"Error.");errEl.style.display="block";return;}
    usuario=r.usuario;["rNom","rApe","rEmail","rPass"].forEach(function(id){document.getElementById(id).value="";});
    cerrarModal("mReg");localStorage.setItem("ns_usuario",JSON.stringify(usuario));actualizarUI();cargarDatos();toast("¡Bienvenido, "+nom+"! 🎉","s");
  });
}
function cerrarSesion(){usuario=null;carrito=[];wishlist=[];_mpCargando=false;_mpYaCargo=false;localStorage.removeItem("ns_usuario");localStorage.removeItem("ns_carrito");localStorage.removeItem("ns_wishlist");actualizarUI();actualizarCarrito();actualizarTodosHearts();toast("Sesión cerrada","i");}

// ── UI ───────────────────────────────────────


// ── RECUPERAR CONTRASEÑA — 3 pasos ──────────────────────────
// Paso 1: email → solicitar código
// Paso 2: ingresar código de 6 dígitos
// Paso 3: nueva contraseña

let _resetEmail = "";
let _resetToken = "";

function abrirRecuperarPass(){
  cerrarModal("mLogin");
  _resetEmail = "";
  _resetToken = "";
  let modal = document.getElementById("mReset");
  if(!modal){
    modal = document.createElement("div");
    modal.id = "mReset";
    modal.className = "ov";
    modal.innerHTML =
      '<div class="mdl" style="max-width:420px;border-radius:20px 20px 0 0;padding:0">'
      + '<div class="mhd" style="padding:18px 20px 14px">'
      + '<h3 id="resetT" style="font-size:1.05rem;font-weight:800;color:var(--bk)">🔑 Recuperar Contraseña</h3>'
      + '<button class="bx" onclick="cerrarModal(\'mReset\')">✕</button>'
      + '</div>'
      + '<div id="resetBody" style="padding:16px 20px 24px"></div>'
      + '</div>';
    document.body.appendChild(modal);
    modal.addEventListener("click", function(e){ if(e.target===modal) cerrarModal("mReset"); });
  }
  _renderResetStep1();
  abrirModal("mReset");
}

function _renderResetStep1(){
  document.getElementById("resetT").textContent = "🔑 Recuperar Contraseña";
  document.getElementById("resetBody").innerHTML =
    '<p style="color:var(--gr);font-size:.88rem;margin-bottom:16px;line-height:1.5">'
    + 'Ingresa tu correo y te enviaremos un código de 6 dígitos para restablecer tu contraseña.</p>'
    + '<div class="fg"><label>Correo electrónico *</label>'
    + '<input class="fc" id="resetEmail" type="email" placeholder="tu@correo.com" autocomplete="email"/></div>'
    + '<div id="resetErr" class="form-err" style="display:none"></div>'
    + '<button class="bp" id="resetBtn1" style="margin-top:12px;width:100%" onclick="solicitarReset()">Enviar código</button>'
    + '<div style="text-align:center;margin-top:12px">'
    + '<button style="background:none;border:none;color:var(--na);font-size:.85rem;cursor:pointer" onclick="cerrarModal(\'mReset\');abrirLogin()">← Volver al inicio de sesión</button>'
    + '</div>';
  setTimeout(function(){ let el=document.getElementById("resetEmail"); if(el) el.focus(); }, 100);
}

function solicitarReset(){
  let email = (document.getElementById("resetEmail").value||"").trim().toLowerCase();
  let errEl = document.getElementById("resetErr");
  let btn   = document.getElementById("resetBtn1");
  errEl.style.display = "none";
  if(!email || !email.includes("@")){ errEl.textContent="⚠️ Correo válido requerido"; errEl.style.display="block"; return; }
  btn.disabled = true; btn.textContent = "Enviando…";
  _resetEmail = email;
  api("/reset/solicitar","POST",{email:email}).then(function(r){
    btn.disabled = false; btn.textContent = "Enviar código";
    if(!r.ok){ errEl.textContent="❌ "+(r.error||"Error"); errEl.style.display="block"; return; }
    _renderResetStep2(r.dev_code);
  });
}

function _renderResetStep2(devCode){
  document.getElementById("resetT").textContent = "📨 Ingresa el Código";
  let devNote = devCode
    ? '<div style="background:#EFF6FF;border:1.5px solid #93C5FD;border-radius:10px;padding:10px 14px;margin-bottom:14px;font-size:.84rem;color:#1E3A8A">'
      + '🔧 <strong>Modo dev:</strong> Tu código es <strong style="font-family:monospace;font-size:1rem;letter-spacing:2px">'+devCode+'</strong></div>'
    : '';
  document.getElementById("resetBody").innerHTML =
    '<p style="color:var(--gr);font-size:.88rem;margin-bottom:14px;line-height:1.5">'
    + 'Enviamos un código de 6 dígitos a <strong>'+_resetEmail+'</strong>. Válido por 10 minutos.</p>'
    + devNote
    + '<div class="fg"><label>Código de 6 dígitos *</label>'
    + '<input class="fc" id="resetCode" type="text" inputmode="numeric" pattern="[0-9]*" maxlength="6"'
    + ' placeholder="123456" style="font-size:1.4rem;font-weight:800;letter-spacing:4px;text-align:center"/></div>'
    + '<div id="resetErr" class="form-err" style="display:none"></div>'
    + '<button class="bp" id="resetBtn2" style="margin-top:12px;width:100%" onclick="verificarCodigo()">Verificar código</button>'
    + '<div style="text-align:center;margin-top:10px">'
    + '<button style="background:none;border:none;color:var(--na);font-size:.82rem;cursor:pointer" onclick="_renderResetStep1()">← Cambiar correo</button>'
    + '</div>';
  setTimeout(function(){ let el=document.getElementById("resetCode"); if(el) el.focus(); }, 100);
}

function verificarCodigo(){
  let code  = (document.getElementById("resetCode").value||"").trim();
  let errEl = document.getElementById("resetErr");
  let btn   = document.getElementById("resetBtn2");
  errEl.style.display = "none";
  if(!code || code.length !== 6){ errEl.textContent="⚠️ El código tiene 6 dígitos"; errEl.style.display="block"; return; }
  btn.disabled = true; btn.textContent = "Verificando…";
  api("/reset/verificar","POST",{email:_resetEmail, token:code}).then(function(r){
    btn.disabled = false; btn.textContent = "Verificar código";
    if(!r.ok){ errEl.textContent="❌ "+(r.error||"Código incorrecto"); errEl.style.display="block"; return; }
    _resetToken = code;
    _renderResetStep3();
  });
}

function _renderResetStep3(){
  document.getElementById("resetT").textContent = "🔐 Nueva Contraseña";
  document.getElementById("resetBody").innerHTML =
    '<p style="color:var(--gr);font-size:.88rem;margin-bottom:14px;line-height:1.5">'
    + '¡Código verificado! Elige una nueva contraseña segura.</p>'
    + '<div class="fg"><label>Nueva contraseña *</label>'
    + '<input class="fc" id="resetNewPass" type="password" placeholder="Mínimo 8 caracteres" autocomplete="new-password"/></div>'
    + '<div class="fg"><label>Confirmar contraseña *</label>'
    + '<input class="fc" id="resetConfPass" type="password" placeholder="Repite la contraseña" autocomplete="new-password"/></div>'
    + '<div id="resetErr" class="form-err" style="display:none"></div>'
    + '<button class="bp" id="resetBtn3" style="margin-top:12px;width:100%" onclick="confirmarReset()">Cambiar contraseña</button>';
  setTimeout(function(){ let el=document.getElementById("resetNewPass"); if(el) el.focus(); }, 100);
}

function confirmarReset(){
  let pass1 = document.getElementById("resetNewPass").value;
  let pass2 = document.getElementById("resetConfPass").value;
  let errEl = document.getElementById("resetErr");
  let btn   = document.getElementById("resetBtn3");
  errEl.style.display = "none";
  if(!pass1 || pass1.length < 8){ errEl.textContent="⚠️ Mínimo 8 caracteres"; errEl.style.display="block"; return; }
  if(pass1 !== pass2){ errEl.textContent="⚠️ Las contraseñas no coinciden"; errEl.style.display="block"; return; }
  btn.disabled = true; btn.textContent = "Cambiando…";
  api("/reset/confirmar","POST",{email:_resetEmail, token:_resetToken, password:pass1}).then(function(r){
    btn.disabled = false; btn.textContent = "Cambiar contraseña";
    if(!r.ok){ errEl.textContent="❌ "+(r.error||"Error"); errEl.style.display="block"; return; }
    cerrarModal("mReset");
    toast("✅ Contraseña actualizada. Inicia sesión con tu nueva contraseña.","s");
    setTimeout(abrirLogin, 400);
  });
}

// ── MODO OSCURO ───────────────────────────────────────────────
function aplicarDarkMode(dark){
  // Add smooth transition class
  document.documentElement.classList.add("dm-transition");
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem("ns_dark", dark ? "1" : "0");
  DARK_MODE = dark;
  // Remove transition class after animation completes
  setTimeout(function(){
    document.documentElement.classList.remove("dm-transition");
  }, 400);
  // Update all toggle buttons with animation
  document.querySelectorAll(".dm-toggle").forEach(function(btn){
    btn.classList.add("dm-spin");
    setTimeout(function(){ btn.classList.remove("dm-spin"); }, 400);
    btn.textContent = dark ? "☀️" : "🌙";
    btn.setAttribute("title", dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
  });
  // Update meta theme-color
  let meta = document.querySelector("meta[name=theme-color]");
  if(meta) meta.setAttribute("content", dark ? "#0F172A" : "#1E3A8A");
}
function toggleDarkMode(){
  aplicarDarkMode(!DARK_MODE);
}
function actualizarUI(){
  let navIcons=document.getElementById("navIcons"),deskActs=document.getElementById("deskActs"),bt3ico=document.getElementById("bt3ico");
  if(usuario){
    let rol=usuario.rol;
    let rolLabel={cliente:"Cliente",administrador:"Administrador",superadmin:"Super Admin"}[rol]||rol;
    let rolEmoji={cliente:"👤",administrador:"⚙️",superadmin:"👑"}[rol]||"👤";
    let avatarContent=usuario.avatar?(usuario.avatar.startsWith("data:")||/^\p{Emoji}/u.test(usuario.avatar)||usuario.avatar.length<=8)?usuario.avatar:'<img src="'+usuario.avatar+'" style="width:100%;height:100%;object-fit:cover;border-radius:50% 0 0 50%;"/>':(usuario.n[0]);
    let avatarMobile=usuario.avatar?(usuario.avatar.startsWith("data:")||/^\p{Emoji}/u.test(usuario.avatar)||usuario.avatar.length<=8)?usuario.avatar:'<img src="'+usuario.avatar+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>':(usuario.n[0]);
    // Panel button según rol
    let panelBtn="";
    if(rol==="administrador"){
      panelBtn='<button class="hdr-panel-btn admin" onclick="abrirPanel()">⚙️ Panel</button>';
    }else if(rol==="superadmin"){
      panelBtn='<button class="hdr-panel-btn superadmin" onclick="abrirPanel()">👑 Panel</button>';
    }
    // Nombre truncado
    let nombre=usuario.n.split(" ")[0];
    navIcons.innerHTML=''; // En móvil carrito y cuenta están en el bottom nav
    deskActs.innerHTML=
      '<button class="push-toggle-btn bte" onclick="activarNotificaciones()" title="Activar notificaciones" style="font-size:.75rem;padding:5px 10px;display:'+(pushPuedeActivarse()&&usuario?'flex':'none')+'">'+(pushEstaActivo()?'🔔 Notif. ON':'🔕 Notif. OFF')+'</button>'+
      '<button class="dm-toggle bdn bdn-lang" onclick="toggleDarkMode()" title="Modo oscuro">'+(DARK_MODE?'☀️':'🌙')+'</button>'+
      '<button class="bdn bdn-lang" onclick="abrirIdiomaMoneda()" title="Moneda">💰</button>'+
      '<div class="hdr-cart-btn" onclick="abrirCarrito()">🛒<span class="hdr-cart-badge" id="cartBadgeDesk" style="display:none">0</span></div>'+
      '<div class="hdr-divider"></div>'+
      '<div class="uchip" onclick="abrirPanel()">'+
        '<div class="ava">'+avatarContent+'</div>'+
        '<div class="uchip-body">'+
          '<div class="uchip-name">'+nombre+'</div>'+
          '<div class="uchip-role">'+rolEmoji+' '+rolLabel+'</div>'+
        '</div>'+
        '<span class="uchip-arrow">▾</span>'+
      '</div>'+
      panelBtn;
    if(bt3ico)bt3ico.innerHTML=avatarMobile;
  }else{
    navIcons.innerHTML=''; // En móvil carrito y cuenta están en el bottom nav
    deskActs.innerHTML=
      '<button class="push-toggle-btn bte" onclick="activarNotificaciones()" title="Activar notificaciones" style="font-size:.75rem;padding:5px 10px;display:'+(pushPuedeActivarse()&&usuario?'flex':'none')+'">'+(pushEstaActivo()?'🔔 Notif. ON':'🔕 Notif. OFF')+'</button>'+
      '<button class="dm-toggle bdn bdn-lang" onclick="toggleDarkMode()" title="Modo oscuro">'+(DARK_MODE?'☀️':'🌙')+'</button>'+
      '<button class="bdn bdn-lang" onclick="abrirIdiomaMoneda()" title="Moneda">💰</button>'+
      '<button class="bdn bdn-o" onclick="abrirLogin()">'+t('iniciarSesion')+'</button>'+
      '<button class="bdn bdn-f" onclick="abrirRegistro()">'+t('registrarse')+' →</button>';
    if(bt3ico)bt3ico.textContent="👤";
  }
  actualizarBadge();
  mpRefreshAuth();
}

// ── CARRITO ──────────────────────────────────
// ── FLY TO CART ──────────────────────────────────────────────
function flyToCart(sourceEl){
  // Find the cart icon position (botnav on mobile, desk on desktop)
  let cartTarget = document.getElementById("cartBadgeNav")
    || document.getElementById("cartBadgeDesk")
    || document.querySelector(".hdr-cart-btn")
    || document.querySelector(".cart-btn");
  if(!cartTarget || !sourceEl) return;

  // Get positions
  let srcRect = sourceEl.getBoundingClientRect();
  let tgtRect = cartTarget.getBoundingClientRect();

  // Create flying dot
  let dot = document.createElement("div");
  dot.className = "fly-dot";
  dot.innerHTML = "🛒";
  dot.style.cssText = [
    "position:fixed",
    "z-index:9999",
    "pointer-events:none",
    "font-size:1.2rem",
    "left:" + (srcRect.left + srcRect.width/2 - 14) + "px",
    "top:"  + (srcRect.top  + srcRect.height/2 - 14) + "px",
    "width:28px",
    "height:28px",
    "display:flex",
    "align-items:center",
    "justify-content:center",
    "border-radius:50%",
    "background:linear-gradient(135deg,#2563EB,#06B6D4)",
    "box-shadow:0 4px 16px rgba(37,99,235,.5)",
    "transition:none",
  ].join(";");
  document.body.appendChild(dot);

  // Trigger reflow then animate
  void dot.offsetWidth;
  let tx = tgtRect.left + tgtRect.width/2  - (srcRect.left + srcRect.width/2);
  let ty = tgtRect.top  + tgtRect.height/2 - (srcRect.top  + srcRect.height/2);
  dot.style.transition = "transform .55s cubic-bezier(.4,0,.2,1), opacity .55s ease";
  dot.style.transform  = "translate("+tx+"px,"+ty+"px) scale(.3)";
  dot.style.opacity    = "0";

  setTimeout(function(){
    dot.remove();
    // Pulse the target badge
    [cartTarget].concat(
      Array.from(document.querySelectorAll(".bdot,.hdr-cart-badge"))
    ).forEach(function(el){
      if(!el) return;
      el.classList.remove("badge-pulse");
      void el.offsetWidth;
      el.classList.add("badge-pulse");
    });
  }, 560);
}


// ── CUPONES ──────────────────────────────────────────────────
let cuponActivo = null; // {codigo, tipo, valor, descuento}

function aplicarCupon(){
  let inp = document.getElementById("cuponInput");
  let btn = document.getElementById("cuponBtn");
  let msg = document.getElementById("cuponMsg");
  if(!inp || !msg) return;
  let codigo = inp.value.trim().toUpperCase();
  if(!codigo){ msg.textContent="Ingresa un código"; msg.className="cupon-msg cupon-err"; return; }
  let total = carrito.reduce(function(s,x){ return s+x.p*x.qty; }, 0);
  btn.disabled = true;
  btn.textContent = "Validando…";
  fetch("/api/cupones/validar?codigo="+encodeURIComponent(codigo)+"&total="+total)
    .then(function(r){ return r.json(); })
    .then(function(r){
      btn.disabled = false;
      btn.textContent = "Aplicar";
      if(!r.ok){
        cuponActivo = null;
        msg.textContent = "❌ " + r.error;
        msg.className = "cupon-msg cupon-err";
        actualizarTotalCarrito();
        return;
      }
      cuponActivo = r.cupon;
      msg.textContent = "✅ ¡Cupón aplicado! Descuento: " + bs(r.cupon.descuento);
      msg.className = "cupon-msg cupon-ok";
      actualizarTotalCarrito();
    })
    .catch(function(){
      btn.disabled = false;
      btn.textContent = "Aplicar";
      msg.textContent = "❌ Error de conexión";
      msg.className = "cupon-msg cupon-err";
    });
}

function quitarCupon(){
  cuponActivo = null;
  let inp = document.getElementById("cuponInput");
  let msg = document.getElementById("cuponMsg");
  if(inp) inp.value = "";
  if(msg){ msg.textContent = ""; msg.className = "cupon-msg"; }
  actualizarTotalCarrito();
}

function actualizarTotalCarrito(){
  let subtotal = carrito.reduce(function(s,x){ return s+x.p*x.qty; }, 0);
  let descuento = cuponActivo ? cuponActivo.descuento : 0;
  let total = subtotal - descuento;
  let totEl = document.getElementById("cTot");
  if(totEl) totEl.textContent = bs(total);
  // Show/hide discount row
  let discRow = document.getElementById("cDescRow");
  if(discRow){
    discRow.style.display = descuento > 0 ? "flex" : "none";
    let discEl = document.getElementById("cDesc");
    if(discEl) discEl.textContent = "- " + bs(descuento);
  }
}

function addCart(id){
  if(!usuario){toast("Inicia sesión para comprar","e");abrirModal("mLogin");return;}
  let p=PRODS.find(function(x){return x.id===id;});
  if(!p||p.st<=0){toast("Producto agotado ❌","e");return;}
  let ex=carrito.find(function(x){return x.id===id;});
  let cantActual=ex?ex.qty:0;
  if(cantActual>=p.st){toast("Solo hay "+p.st+" unidad"+(p.st!==1?"es":"")+" disponible","e");return;}
  if(ex) ex.qty++;
  else carrito.push({id:p.id,n:p.n,p:(p.o||p.p),qty:1,e:emojiProd(p),img:p.img||null,maxSt:p.st});
  actualizarCarrito();
  toast(p.n+" agregado al carrito 🛒","s");
  // Fly-to-cart desde el botón activo
  let srcBtn=document.activeElement;
  if(srcBtn&&(srcBtn.classList.contains("badd")||srcBtn.classList.contains("bp"))){
    flyToCart(srcBtn);
  } else {
    // Fallback: pulse badges
    ["cartBadgeMobile","cartBadgeDesk","cartBadgeNav"].forEach(function(bid){
      let el=document.getElementById(bid);
      if(el){el.classList.remove("badge-pulse");void el.offsetWidth;el.classList.add("badge-pulse");}
    });
  }
}
function cambiarQty(id,delta){
  let ex=carrito.find(function(x){return x.id===id;});
  if(!ex)return;
  let p=PRODS.find(function(x){return x.id===id;});
  let maxSt=p?p.st:(ex.maxSt||999);
  let nueva=ex.qty+delta;
  if(nueva<1){quitarCart(id);return;}
  if(nueva>maxSt){toast("Máximo "+maxSt+" unidad"+(maxSt!==1?"es":"")+" disponibles","e");return;}
  ex.qty=nueva;
  actualizarCarrito();
}
function quitarCart(id){carrito=carrito.filter(function(x){return x.id!==id;});actualizarCarrito();}
function actualizarCarrito(){
  let total=carrito.reduce(function(s,x){return s+x.p*x.qty;},0),count=carrito.reduce(function(s,x){return s+x.qty;},0);
  localStorage.setItem("ns_carrito", JSON.stringify(carrito));
  actualizarTotalCarrito();
  actualizarBadge(count);
  let c=document.getElementById("cits");if(!c)return;
  if(!carrito.length){c.innerHTML='<div class="empty"><div class="eico">🛒</div><h3>Carrito vacío</h3><p>Agrega productos</p></div>';return;}
  c.innerHTML=carrito.map(function(it){let imgC=it.img?'<img src="'+it.img+'">':(it.e||"📦");return '<div class="cit"><div class="cimg">'+imgC+'</div><div class="cinf"><div class="cnm">'+it.n+'</div><div class="cpr">'+bs(it.p)+'</div><div class="qty-ctrl"><button class="qty-btn" onclick="cambiarQty('+it.id+',-1)">−</button><span style="font-weight:800;font-size:.9rem">'+it.qty+'</span><button class="qty-btn" onclick="cambiarQty('+it.id+',1)">+</button></div></div><button class="cdel" onclick="quitarCart('+it.id+')">🗑️</button></div>';}).join("");
}
function actualizarBadge(count){let n=count!==undefined?count:carrito.reduce(function(s,x){return s+x.qty;},0);["cartBadgeMobile","cartBadgeDesk","cartBadgeNav"].forEach(function(bid){let el=document.getElementById(bid);if(el){el.textContent=n;el.style.display=n>0?"flex":"none";}});}
function abrirCarrito(){actualizarCarrito();document.getElementById("csh").classList.add("open");document.getElementById("cov").classList.add("show");document.body.style.overflow="hidden";}
function cerrarCarrito(){document.getElementById("csh").classList.remove("open");document.getElementById("cov").classList.remove("show");document.body.style.overflow="";}
function pedido(){
  if(!usuario){toast("Inicia sesión","e");abrirModal("mLogin");return;}
  if(!carrito.length){toast("Carrito vacío","e");return;}
  let total=carrito.reduce(function(s,x){return s+x.p*x.qty;},0);
  let resumen=carrito.map(function(it){return "• "+it.n+" × "+it.qty+" = "+bs(it.p*it.qty);}).join("\n");
  let iva=total*0.19;
  if(!confirm("📋 CONFIRMAR PEDIDO\n\n"+resumen+"\n\n─────────────────\nSubtotal: "+bs(total)+"\nIVA (19%): "+bs(iva)+"\nTOTAL: "+bs(total+iva)+"\n\n¿Confirmas la compra?")){return;}
  let btn=document.querySelector(".btn-pagar");
  if(btn){btn.disabled=true;btn.textContent="Procesando…";}
    // Include cupon data if active
  let payload = {uid:usuario.id, items:JSON.parse(JSON.stringify(carrito)), total:total};
  if(cuponActivo) payload.cupon = {codigo:cuponActivo.codigo, descuento:cuponActivo.descuento};

  api("/pedidos","POST",payload).then(function(r){
    if(btn){btn.disabled=false;btn.textContent="Pagar →";}
    if(!r.ok){toast("Error al procesar el pedido","e");return;}

    // Mark cupon as used and clear it
    if(cuponActivo){
      fetch("/api/cupones/usar",{method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({codigo:cuponActivo.codigo})});
      cuponActivo=null;
      let cuponInp=document.getElementById("cuponInput");
      if(cuponInp) cuponInp.value="";
      let cuponMsg=document.getElementById("cuponMsg");
      if(cuponMsg){cuponMsg.textContent="";cuponMsg.className="cupon-msg";}
    }

    let itemsSnapshot = JSON.parse(JSON.stringify(carrito));
    let pedidoId = r.pedidoId;
    let totalFinal = total;
    carrito=[];
    actualizarCarrito();
    cerrarCarrito();
    toast("✅ Pedido"+(pedidoId?" #"+pedidoId:"")+" confirmado. Revisa tu correo 📧","s");
    _mostrarConfirmacionPedido(pedidoId, itemsSnapshot, totalFinal);
    cargarDatos();
  })
}

// ── FACTURA ──────────────────────────────────
function generarFactura(){
  if(!usuario){toast("Inicia sesión","e");abrirModal("mLogin");return;}
  if(!carrito.length){toast("Carrito vacío","e");return;}
  let total=carrito.reduce(function(s,x){return s+x.p*x.qty;},0),iva=total*.16;
  let numFact="NST-"+new Date().getFullYear()+"-"+String(contFact++).padStart(5,"0");
  let fecha=new Date().toLocaleDateString("es-CO",{year:"numeric",month:"long",day:"numeric"});
  let rows=carrito.map(function(it){return '<tr><td>'+(it.e||"📦")+' '+it.n+'</td><td style="text-align:center">'+it.qty+'</td><td style="text-align:right">'+bs(it.p)+'</td><td style="text-align:right;font-weight:700">'+bs(it.p*it.qty)+'</td></tr>';}).join("");
  document.getElementById("factBody").innerHTML='<div class="fact-logo"><span>Nuestro</span>Store</div><div class="fact-sub">NIT: 900.123.456-7 · Bogotá, Colombia<br>Teléfono: +57 601 000 0000</div><hr style="border:1px solid #f0f0f0;margin-bottom:16px"/><div class="fact-info"><p><strong>N° Factura:</strong> '+numFact+'</p><p><strong>Fecha:</strong> '+fecha+'</p><p><strong>Cliente:</strong> '+usuario.n+' '+usuario.a+'</p><p><strong>Correo:</strong> '+usuario.email+'</p></div><table class="fact-table"><thead><tr><th>Producto</th><th style="text-align:center">Cant.</th><th style="text-align:right">Precio</th><th style="text-align:right">Total</th></tr></thead><tbody>'+rows+'</tbody></table><div style="text-align:right;font-size:.85rem;color:#555;margin-bottom:4px">Subtotal: '+bs(total)+'</div><div style="text-align:right;font-size:.85rem;color:#555;margin-bottom:4px">IVA (19%): '+bs(iva)+'</div><div class="fact-total">TOTAL A PAGAR: '+bs(total+iva)+'</div><div class="fact-footer">Gracias por su compra · NuestroStore</div>';
  document.getElementById("factOverlay").classList.add("show");document.body.style.overflow="hidden";
}
function cerrarFactura(){document.getElementById("factOverlay").classList.remove("show");document.body.style.overflow="";}
function imprimirFactura(){let v=window.open("","_blank","width=600,height=800");v.document.write('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>Factura NuestroStore</title><link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap" rel="stylesheet"/><style>body{font-family:Nunito,sans-serif;padding:32px;max-width:500px;margin:0 auto;}.fact-logo{font-size:2rem;font-weight:900;color:#E65100;letter-spacing:2px;text-align:center;}.fact-logo span{color:#1A1A1A;}.fact-sub{text-align:center;color:#757575;font-size:.8rem;margin-bottom:16px;}.fact-info{background:#f8f8f8;border-radius:8px;padding:12px;margin-bottom:14px;font-size:.85rem;}.fact-info strong{color:#E65100;}.fact-table{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:.85rem;}.fact-table th{background:#E65100;color:#fff;padding:8px 10px;text-align:left;}.fact-table td{padding:7px 10px;border-bottom:1px solid #f0f0f0;}.fact-total{text-align:right;font-size:1.1rem;font-weight:900;color:#E65100;padding:10px 0;border-top:2px solid #E65100;}.fact-footer{text-align:center;color:#757575;font-size:.75rem;margin-top:14px;padding-top:10px;border-top:1px solid #f0f0f0;}@media print{button{display:none;}}</style></head><body>'+document.getElementById("factBody").innerHTML+'<button onclick="window.print()" style="width:100%;padding:12px;background:#E65100;color:#fff;border:none;border-radius:8px;font-weight:900;font-size:1rem;cursor:pointer;margin-top:12px">🖨️ Imprimir / PDF</button></body></html>');v.document.close();}

// ── REPORTE ──────────────────────────────────
function abrirRep(pid){if(!usuario){toast("Inicia sesión","e");abrirModal("mLogin");return;}document.getElementById("rPid").value=pid||0;document.getElementById("rDesc").value="";let sel=document.getElementById("rProdSel");if(sel)sel.innerHTML='<option value="0">-- General --</option>'+PRODS.map(function(p){return '<option value="'+p.id+'"'+(p.id==pid?' selected':'')+'>'+(emojiProd(p))+' '+p.n+'</option>';}).join("");abrirModal("mRep");}
function enviarRep(){if(!usuario){toast("Inicia sesión","e");return;}let desc=document.getElementById("rDesc").value.trim(),tipo=document.getElementById("rTipo").value,sel=document.getElementById("rProdSel"),pid=sel?parseInt(sel.value)||0:0;if(!desc){toast("Describe el problema","e");return;}api("/reportes","POST",{uid:usuario.id,pid:pid,tipo:tipo,desc:desc}).then(function(r){if(!r.ok){toast("Error","e");return;}document.getElementById("rDesc").value="";cerrarModal("mRep");toast("✅ Reporte enviado","s");});}

// ── RESPONDER REPORTE (mejorado) ─────────────
function abrirRespRep(rid){
  let rep=REPORTES.find(function(r){return r.id===rid;});if(!rep)return;
  let estLabel={pendiente:"⏳ Pendiente",en_revision:"🔄 En Revisión",resuelto:"✅ Resuelto"}[rep.estado]||rep.estado;
  let estCls={pendiente:"rep-est-pendiente",en_revision:"rep-est-revision",resuelto:"rep-est-resuelto"}[rep.estado]||"";
  let userAva=(rep.uAvatar&&rep.uAvatar.length<8)?rep.uAvatar:(rep.uNom||"U")[0];
  let html='<div class="rep-card" style="margin-bottom:0;border:none">'+
    '<div class="rep-card-head">'+
      '<div class="rep-user-ava">'+userAva+'</div>'+
      '<div><strong style="font-size:.9rem">'+rep.uNom+'</strong><br><small style="color:var(--gr)">'+rep.fecha+'</small></div>'+
      '<span class="rep-tipo-badge">'+rep.tipo+'</span>'+
      '<span class="rep-est-badge '+estCls+'">'+estLabel+'</span>'+
    '</div>'+
    '<div class="rep-card-body">'+
      (rep.pNom&&rep.pNom!=="General"?'<div class="rep-prod-tag">📦 '+rep.pNom+'</div><br>':'')+
      '<div class="rep-desc-box">'+'"'+(rep.desc||rep.descripcion||"")+'</div>'+
      (rep.respuesta?'<div class="rep-respuesta-box"><strong>💬 Respuesta anterior ('+( rep.respFecha||"")+'):</strong>'+rep.respuesta+'</div>':'')+
    '</div>'+
  '</div>'+
  '<div class="fg" style="margin-top:14px"><label>✍️ Tu Respuesta *</label><textarea class="fc" id="respRepTxt" rows="4" style="resize:vertical" placeholder="Escribe tu respuesta al cliente…">'+(rep.respuesta||"")+'</textarea></div>'+
  '<div class="fg"><label>Estado del reporte</label>'+
    '<select class="fc" id="respRepEst">'+
      '<option value="pendiente"'+(rep.estado==="pendiente"?" selected":"")+'>⏳ Pendiente</option>'+
      '<option value="en_revision"'+(rep.estado==="en_revision"?" selected":"")+'>🔄 En Revisión</option>'+
      '<option value="resuelto"'+(rep.estado==="resuelto"?" selected":"")+'>✅ Resuelto</option>'+
    '</select>'+
  '</div>'+
  '<input type="hidden" id="respRepId" value="'+rid+'"/>'+
  '<button class="bp" onclick="enviarRespuesta()">💬 Enviar Respuesta →</button>';
  document.getElementById("mRespRepB").innerHTML=html;
  abrirModal("mRespRep");
}
function enviarRespuesta(){let rid=parseInt(document.getElementById("respRepId").value),resp=document.getElementById("respRepTxt").value.trim(),est=document.getElementById("respRepEst").value;if(!resp){toast("Escribe una respuesta","e");return;}let admin=usuario?usuario.n+" "+usuario.a:"Admin";api("/reportes/"+rid+"/responder","POST",{respuesta:resp,estado:est,admin:admin}).then(function(r){if(!r.ok){toast("Error","e");return;}cerrarModal("mRespRep");toast("Respuesta enviada ✅","s");renderAdminTab();if(usuario&&usuario.rol==="superadmin"){invalidateSCache(["reportes"]);renderSuperTab();}});}

// ── PANEL CLIENTE ────────────────────────────
// ── GLOBAL ONCLICK HELPERS (sin argumentos = sin problemas de comillas) ──
function abrirLogin(){ abrirModal("mLogin"); }
function abrirRegistro(){ abrirModal("mReg"); }
function abrirCarritoBtn(){ abrirCarrito(); }
function panelEditarPerfil(){ cerrarModal("mPanel"); setTimeout(abrirPerfil, 50); }
function panelSalir(){ cerrarModal("mPanel"); cerrarSesion(); }
function cerrarPanelBtn(){ cerrarModal("mPanel"); if(_chatTimer){clearInterval(_chatTimer);_chatTimer=null;} if(_adminChatTimer){clearInterval(_adminChatTimer);_adminChatTimer=null;} }
function cerrarLoginBtn(){ cerrarModal("mLogin"); }
function cerrarRegBtn(){ cerrarModal("mReg"); }

function abrirCuentaCliente(){
  document.getElementById("panT").textContent="👤 Mi Cuenta";
  let pb=document.getElementById("panB");
  let userAva=usuario.avatar?(usuario.avatar.length<8?usuario.avatar:'<img src="'+usuario.avatar+'" style="width:52px;height:52px;object-fit:cover;border-radius:50%"/>'):(usuario.n[0]);
  pb.innerHTML='<div style="background:linear-gradient(135deg,var(--na3),var(--na2));border-radius:14px;padding:18px;color:#fff;margin-bottom:20px;display:flex;align-items:center;gap:14px">'+
    '<div style="width:52px;height:52px;border-radius:50%;background:var(--am);color:var(--na3);display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:900;flex-shrink:0;overflow:hidden">'+userAva+'</div>'+
    '<div><div style="font-weight:800;font-size:1.1rem">'+usuario.n+' '+usuario.a+'</div><div style="opacity:.85;font-size:.85rem">'+usuario.email+'</div>'+
    '<span style="background:var(--am);color:var(--na3);padding:2px 10px;border-radius:50px;font-size:.72rem;font-weight:900;margin-top:4px;display:inline-block">👤 Cliente</span></div></div>'+
    '<div style="display:flex;gap:8px;margin-bottom:12px">'+
      '<button class="bp" style="flex:1;font-size:.85rem;padding:10px" onclick="panelEditarPerfil()">✏️ Editar Perfil</button>'+
      '<button class="bs" style="flex:1;font-size:.85rem;padding:10px;margin-top:0" onclick="panelSalir()">🚪 Salir</button>'+
    '</div>'+
    '<button onclick="mpPanelToggle()" id="mpPanelBtn" style="width:100%;margin-bottom:18px;padding:10px 14px;border-radius:10px;border:2px solid #e0d0c0;background:#fff8f0;font-weight:800;font-size:.85rem;cursor:pointer;display:flex;align-items:center;justify-content:space-between;color:var(--na3)">'+mpPanelBtnLabel()+'</button>'+
    '<div class="tabs"><button class="tab on" onclick="cTabN(this,2)">🛍️ Mis Compras</button><button class="tab" onclick="cTabN(this,5)">💙 Favoritos</button><button class="tab" onclick="cTabN(this,6)">💬 Chat</button><button class="tab" onclick="cTabN(this,1)">🚨 Reportes</button><button class="tab" onclick="cTabN(this,3)">📋 Historial</button><button class="tab" onclick="cTabN(this,4)">⭐ Reseñas</button></div>'+
    '<div id="cTabBody"></div>';
  cTabN(pb.querySelector(".tab"),2);
  abrirModal("mPanel");
}

function _renderChatTab(c){
  _chatUid = usuario.id;
  c.innerHTML =
    '<div class="chat-panel-wrap">'
    + '<div class="chat-messages" id="chatPanelBox"><div class="chat-empty-state"><div style="font-size:2.5rem">💬</div><div class="chat-empty-title">Soporte en vivo</div><div class="chat-empty-sub">¿Tienes alguna pregunta? Escríbenos, respondemos en menos de 24h.</div></div></div>'
    + '<div class="chat-input-row">'
    + '  <input class="fc chat-input" id="chatPanelInput" placeholder="Escribe un mensaje…" autocomplete="off"'
    + '    onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();_enviarMsgPanel();}"/>'
    + '  <button class="chat-send-btn" id="chatSendBtn" onclick="_enviarMsgPanel()" title="Enviar">'
    + '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>'
    + '  </button>'
    + '</div>'
    + '</div>';
  _chatCargarMensajes();
  if(_chatTimer) clearInterval(_chatTimer);
  _chatTimer = setInterval(function(){
    let box = document.getElementById('chatPanelBox');
    if(!box){ clearInterval(_chatTimer); _chatTimer=null; return; }
    _chatCargarMensajes(true);
  }, 4000);
}

function _chatCargarMensajes(silencioso){
  fetch('/api/chat?uid='+usuario.id)
    .then(function(r){ return r.json(); })
    .then(function(r){
      let box = document.getElementById('chatPanelBox');
      if(!box || !r.ok) return;
      let msgs = r.mensajes || [];
      let wasEmpty = box.querySelector('.chat-empty-state') !== null;
      let atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
      if(!msgs.length){
        if(wasEmpty) return; // Already showing empty state
        box.innerHTML = '<div class="chat-empty-state"><div style="font-size:2.5rem">💬</div><div class="chat-empty-title">Soporte en vivo</div><div class="chat-empty-sub">¿Tienes alguna pregunta? Escríbenos, respondemos en menos de 24h.</div></div>';
        return;
      }
      // Rebuild messages
      box.innerHTML = msgs.map(function(m){
        let esCliente = m.remitente === 'cliente';
        return '<div class="chat-msg-row '+(esCliente?'chat-msg-row-client':'chat-msg-row-support')+'">'
          + '<div class="chat-bubble '+(esCliente?'chat-bubble-client':'chat-bubble-support')+'">'
          + _escapeHtml(m.mensaje)
          + '</div>'
          + '<div class="chat-msg-time">'+(esCliente?'Tú':'🛡️ Soporte')+' · '+(m.fecha||'').slice(11,16)+'</div>'
          + '</div>';
      }).join('');
      if(atBottom || wasEmpty) box.scrollTop = box.scrollHeight;
    })
    .catch(function(){});
}

function _chatLimpiarAlCerrar(){
  if(_chatTimer){ clearInterval(_chatTimer); _chatTimer=null; }
}

function _enviarMsgPanel(){
  let inp = document.getElementById('chatPanelInput');
  let btn = document.getElementById('chatSendBtn');
  if(!inp) return;
  let msg = inp.value.trim();
  if(!msg) return;
  inp.value = '';
  inp.disabled = true;
  if(btn) btn.disabled = true;

  // Optimistic UI: show message immediately
  let box = document.getElementById('chatPanelBox');
  if(box){
    let emptyState = box.querySelector('.chat-empty-state');
    if(emptyState) box.innerHTML = '';
    let row = document.createElement('div');
    row.className = 'chat-msg-row chat-msg-row-client';
    row.innerHTML = '<div class="chat-bubble chat-bubble-client">'+_escapeHtml(msg)+'</div>'
      + '<div class="chat-msg-time">Tú · enviando…</div>';
    box.appendChild(row);
    box.scrollTop = box.scrollHeight;
  }

  fetch('/api/chat', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({uid: usuario.id, mensaje: msg, remitente: 'cliente'})
  })
  .then(function(r){ return r.json(); })
  .then(function(r){
    inp.disabled = false;
    if(btn) btn.disabled = false;
    inp.focus();
    if(r.ok) _chatCargarMensajes();
    else toast('Error al enviar mensaje', 'e');
  })
  .catch(function(){
    inp.disabled = false;
    if(btn) btn.disabled = false;
    toast('Error de conexión', 'e');
  });
}


function cTabN(btn,t){
  document.querySelectorAll("#panB .tab").forEach(function(b){b.classList.remove("on");});btn.classList.add("on");
  let c=document.getElementById("cTabBody");
  c.innerHTML='<div style="text-align:center;padding:24px;color:var(--gr)">Cargando…</div>';
  if(t===1){api("/mis-reportes/"+usuario.id).then(function(r){if(r.ok)REPORTES=r.reportes;c.innerHTML=renderMisReportes(REPORTES);});}
  else if(t===2){api("/mis-pedidos/"+usuario.id).then(function(r){if(r.ok)PEDIDOS=r.pedidos;c.innerHTML=renderMisPedidos(PEDIDOS);});}
  else if(t===3){
    Promise.all([api("/mis-pedidos/"+usuario.id),api("/mis-reportes/"+usuario.id)]).then(function(res){
      if(res[0].ok)PEDIDOS=res[0].pedidos;if(res[1].ok)REPORTES=res[1].reportes;
      c.innerHTML=renderHistorial(PEDIDOS,REPORTES);
    });
  } else if(t===5){ c.innerHTML=renderWishlist(); } else if(t===6){ _renderChatTab(c); } else{api("/resenias").then(function(r){if(!r.ok){c.innerHTML='<div class="empty"><div class="eico">⭐</div><h3>Sin reseñas</h3></div>';return;}let mis=r.resenias.filter(function(x){return x.uid===usuario.id;});if(!mis.length){c.innerHTML='<div class="empty"><div class="eico">⭐</div><h3>Sin reseñas aún</h3></div>';return;}c.innerHTML='<div style="display:flex;flex-direction:column;gap:10px">'+mis.map(function(res){let pn=(PRODS.find(function(p){return p.id===res.pid;})||{n:"Producto"}).n;return '<div style="border:2px solid #f0f0f0;border-radius:12px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><strong style="color:var(--na3)">'+pn+'</strong><span style="color:#f59e0b">'+starsHtml(res.estrellas)+'</span></div><p style="font-size:.88rem;color:#444">'+res.comentario+'</p><small style="color:var(--gr)">'+res.fecha+'</small></div>';}).join("")+'</div>';});}
}

function renderMisReportes(lista){
  if(!lista||!lista.length)return '<div class="empty"><div class="eico">📋</div><h3>Sin reportes</h3><p>¿Encontraste un problema? Avísanos.</p></div><button class="bp" style="margin-top:12px" onclick="cerrarModal(\"mProd\");abrirRep(0)">+ Enviar Reporte</button>';
  return '<div style="display:flex;flex-direction:column;gap:10px">'+lista.map(function(r){
    let col=r.estado==="resuelto"?"#2e7d32":r.estado==="en_revision"?"#1565c0":"#e65100";
    let lbl=r.estado==="resuelto"?"✅ Resuelto":r.estado==="en_revision"?"🔄 En revisión":"⏳ Pendiente";
    let bg=r.estado==="resuelto"?"#e8f5e9":r.estado==="en_revision"?"#e3f2fd":"#fff3e0";
    return '<div style="border:2px solid '+col+'33;border-radius:14px;padding:14px;background:'+bg+'22">'+
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">'+
        '<div style="width:36px;height:36px;border-radius:10px;background:'+col+'22;display:flex;align-items:center;justify-content:center;font-size:1.1rem;flex-shrink:0">🚨</div>'+
        '<div style="flex:1;min-width:0">'+
          '<strong style="font-size:.88rem;color:var(--bk)">'+r.pNom+'</strong>'+
          '<div style="font-size:.74rem;color:var(--gr)">📅 '+r.fecha+' · 🏷️ '+r.tipo+'</div>'+
        '</div>'+
        '<span style="background:'+col+'22;color:'+col+';padding:3px 10px;border-radius:50px;font-size:.72rem;font-weight:900">'+lbl+'</span>'+
      '</div>'+
      '<div style="background:rgba(0,0,0,.04);border-radius:10px;padding:10px 12px;font-size:.83rem;color:#444;line-height:1.55;margin-bottom:'+(r.respuesta?'8':'0')+'px">'+(r.desc||r.descripcion||"")+'</div>'+
      (r.respuesta?'<div style="background:#fff;border-left:3px solid '+col+';border-radius:0 10px 10px 0;padding:10px 12px;margin-top:8px">'+
        '<div style="font-size:.72rem;font-weight:900;color:'+col+';margin-bottom:4px">💬 Respuesta del equipo · '+(r.respFecha||"")+'</div>'+
        '<div style="font-size:.83rem;color:#333;line-height:1.55">'+r.respuesta+'</div>'+
      '</div>':
      '<div style="font-size:.75rem;color:var(--gr);margin-top:6px;font-style:italic">⏳ Esperando respuesta del equipo…</div>')+
    '</div>';
  }).join("")+'</div><button class="bp" style="margin-top:14px" onclick="cerrarModal(\"mProd\");abrirRep(0)">+ Nuevo Reporte</button>';
}

function renderMisPedidos(lista){
  if(!lista||!lista.length)return(
    '<div class="empty">'+
    '<div class="eico">🛍️</div>'+
    '<h3>'+t("sinPedidos")+'</h3>'+
    '<p style="color:var(--gr);font-size:.88rem;margin:8px 0 16px">Tus compras aparecerán aquí</p>'+
    '<button class="btn-hero-2" style="margin-top:4px;font-size:.85rem" onclick="cerrarModal(\"mPanel\");irPagina(\"tienda\")">🛍️ '+t("verTienda")+'</button>'+
    '</div>'
  );
  let totalGastado=lista.reduce(function(s,p){return s+(p.total||0);},0);
  let totalItems=lista.reduce(function(s,p){return s+(p.items?p.items.reduce(function(a,i){return a+(i.qty||1);},0):0);},0);
  // Stats strip
  let stats=(
    '<div class="historial-stats">'+
      '<div class="hstat-card hstat-orange">'+
        '<div class="hstat-n">'+lista.length+'</div>'+
        '<div class="hstat-l">'+t("pedido")+'s</div>'+
      '</div>'+
      '<div class="hstat-card hstat-green">'+
        '<div class="hstat-n">'+totalItems+'</div>'+
        '<div class="hstat-l">'+t("articulos")+'</div>'+
      '</div>'+
      '<div class="hstat-card hstat-purple">'+
        '<div class="hstat-n hstat-n-sm">'+bs(totalGastado)+'</div>'+
        '<div class="hstat-l">'+t("gastado")+'</div>'+
      '</div>'+
    '</div>'
  );
  // Search/filter bar
  let filtro=(
    '<div class="historial-filtro">'+
      '<input class="fc historial-search" id="histSearch" placeholder="🔍 Buscar en mis compras…" oninput="filtrarHistorial(this.value)" style="margin:0;font-size:.85rem"/>'+
      '<select class="historial-select" id="histEstado" onchange="filtrarHistorial(document.getElementById(\'histSearch\').value)">'+
        '<option value="">Todos los estados</option>'+
        '<option value="procesado">✅ Procesado</option>'+
        '<option value="enviado">🚚 En camino</option>'+
        '<option value="entregado">📦 Entregado</option>'+
        '<option value="cancelado">❌ Cancelado</option>'+
      '</select>'+
    '</div>'
  );
  // Pedido cards
  let cards=lista.map(function(ped,idx){
    let estadoColor={procesado:"#2e7d32",enviado:"#1565c0",entregado:"#7b1fa2",cancelado:"#c62828"}[ped.estado]||"#2e7d32";
    let estadoBg={procesado:"#e8f5e9",enviado:"#e3f2fd",entregado:"#f3e5f5",cancelado:"#ffebee"}[ped.estado]||"#e8f5e9";
    let estadoLabel={procesado:t("procesado"),enviado:t("enviado"),entregado:t("entregado"),cancelado:t("cancelado")}[ped.estado]||t("procesado");
    let subtotal=ped.total||0;
    let iva=subtotal*0.16;
    let totalConIva=subtotal+iva;
    let items=ped.items||[];
    return(
      '<div class="historial-card" data-estado="'+ped.estado+'" data-search="'+
        items.map(function(i){return i.n;}).join(" ").toLowerCase()+' '+ped.id+'"'+
      '>'+
        '<div class="historial-card-head">'+
          '<div>'+
            '<div class="historial-num">📦 '+t("pedido")+' #'+ped.id+'</div>'+
            '<div class="historial-fecha">📅 '+ped.fecha+'</div>'+
          '</div>'+
          '<span class="historial-badge" style="background:'+estadoBg+';color:'+estadoColor+'">'+estadoLabel+'</span>'+
        '</div>'+
        '<div class="historial-items">'+
          items.slice(0,4).map(function(it){
            let p=PRODS.find(function(x){return x.id===it.id;})||{};
            let imgEl=it.img||p.img
              ?'<img src="'+(it.img||p.img)+'" class="hitem-img"/>'
              :'<div class="hitem-emoji">'+(it.e||"📦")+'</div>';
            return(
              '<div class="hitem">'+
                imgEl+
                '<div class="hitem-info">'+
                  '<div class="hitem-name">'+it.n+'</div>'+
                  '<div class="hitem-price">'+bs(it.p)+' × '+it.qty+'</div>'+
                '</div>'+
                '<div class="hitem-sub">'+bs(it.p*it.qty)+'</div>'+
              '</div>'
            );
          }).join("")+
          (items.length>4?'<div class="hitem-more">+'+( items.length-4)+' más…</div>':"")+
        '</div>'+
        '<div class="historial-totales">'+
          '<div class="htot-row"><span>'+t("subtotal")+'</span><span>'+bs(subtotal)+'</span></div>'+
          '<div class="htot-row"><span>IVA (16%)</span><span>'+bs(iva)+'</span></div>'+
          '<div class="htot-row htot-final"><span>'+t("total")+'</span><span>'+bs(totalConIva)+'</span></div>'+
        '</div>'+
        '<div style="display:flex;gap:8px;margin-top:10px">'+
          '<button class="historial-btn-rep" onclick="abrirRepDesdePedido('+ped.id+')">🚨 Reportar</button>'+
          '<button class="historial-btn-fact" onclick="verFacturaPedido('+idx+')">📄 Factura</button>'+
        '</div>'+
      '</div>'
    );
  }).join("");
  return stats+filtro+'<div id="historialLista" style="display:flex;flex-direction:column;gap:12px;margin-top:4px">'+cards+'</div>';
}

function filtrarHistorial(q){
  let estado=document.getElementById("histEstado");
  let estVal=estado?estado.value:"";
  let ql=(q||"").toLowerCase();
  document.querySelectorAll(".historial-card").forEach(function(card){
    let search=card.getAttribute("data-search")||"";
    let cardEst=card.getAttribute("data-estado")||"";
    let matchQ=!ql||search.indexOf(ql)>=0;
    let matchE=!estVal||cardEst===estVal;
    card.style.display=(matchQ&&matchE)?"":"none";
  });
}

function abrirRepDesdePedido(pedId){
  cerrarModal("mPanel");
  setTimeout(function(){abrirRep(0,pedId);},150);
}

function verFacturaPedido(idx){
  let pedidos=PEDIDOS;
  if(!pedidos||!pedidos[idx])return;
  let ped=pedidos[idx];
  carrito=ped.items.map(function(it){return{id:it.id,n:it.n,p:it.p,qty:it.qty||1,e:it.e,img:it.img};});
  generarFactura(ped.id);
}


function renderHistorial(pedidos,reportes){
  let eventos=[];
  (pedidos||[]).forEach(function(p){eventos.push({tipo:"pedido",fecha:p.fecha,data:p});});
  (reportes||[]).forEach(function(r){eventos.push({tipo:"reporte",fecha:r.fecha,data:r});});
  eventos.sort(function(a,b){return (b.fecha||"").localeCompare(a.fecha||"");});
  if(!eventos.length)return '<div class="empty"><div class="eico">📋</div><h3>Sin historial</h3><p>Tus compras y reportes aparecerán aquí.</p></div>';
  return '<div style="position:relative">'+
    '<div style="position:absolute;left:18px;top:0;bottom:0;width:2px;background:linear-gradient(180deg,var(--na2),var(--am));border-radius:2px;z-index:0"></div>'+
    '<div style="display:flex;flex-direction:column;gap:12px;padding-left:44px;position:relative;z-index:1">'+
    eventos.map(function(ev){
      let isPedido=ev.tipo==="pedido";let d=ev.data;
      let dot=isPedido?
        '<div style="position:absolute;left:-30px;top:14px;width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,var(--na3),var(--na2));border:3px solid #fff;box-shadow:0 2px 8px rgba(255,109,0,.3);display:flex;align-items:center;justify-content:center;font-size:.6rem">🛒</div>':
        '<div style="position:absolute;left:-30px;top:14px;width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#1565c0,#42a5f5);border:3px solid #fff;box-shadow:0 2px 8px rgba(21,101,192,.3);display:flex;align-items:center;justify-content:center;font-size:.6rem">🚨</div>';
      if(isPedido){
        let estadoLabel={procesado:"✅ Procesado",enviado:"🚚 Enviado",entregado:"📦 Entregado",cancelado:"❌ Cancelado"}[d.estado]||"✅ Procesado";
        let nItems=d.items?d.items.reduce(function(s,i){return s+(i.qty||1);},0):0;
        return '<div style="position:relative;background:#fff;border:1.5px solid #f0e6d6;border-radius:14px;padding:14px">'+dot+
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px">'+
            '<div><div style="font-weight:900;font-size:.88rem;color:var(--na3)">Pedido #'+d.id+'</div>'+
            '<div style="font-size:.74rem;color:var(--gr)">📅 '+d.fecha+'</div></div>'+
            '<span style="background:#e8f5e9;color:#2e7d32;padding:2px 9px;border-radius:50px;font-size:.7rem;font-weight:900">'+estadoLabel+'</span>'+
          '</div>'+
          '<div style="display:flex;gap:8px;flex-wrap:wrap">'+
            d.items.slice(0,3).map(function(it){return '<div style="background:#faf5f0;border-radius:8px;padding:4px 8px;font-size:.75rem;font-weight:700;color:var(--bk)">'+(it.e||"📦")+' '+it.n+' ×'+it.qty+'</div>';}).join("")+
            (d.items.length>3?'<div style="background:#f5f5f5;border-radius:8px;padding:4px 8px;font-size:.75rem;color:var(--gr)">+'+(d.items.length-3)+' más</div>':'')+
          '</div>'+
          '<div style="margin-top:8px;font-weight:900;font-size:.9rem;color:var(--na3);text-align:right">'+bs(d.total+d.total*0.16)+'</div>'+
        '</div>';
      } else {
        let col=d.estado==="resuelto"?"#2e7d32":d.estado==="en_revision"?"#1565c0":"#e65100";
        let lbl=d.estado==="resuelto"?"✅ Resuelto":d.estado==="en_revision"?"🔄 En revisión":"⏳ Pendiente";
        return '<div style="position:relative;background:#fff;border:1.5px solid #dbeafe;border-radius:14px;padding:14px">'+dot+
          '<div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px">'+
            '<div><div style="font-weight:900;font-size:.88rem;color:#1565c0">Reporte: '+d.pNom+'</div>'+
            '<div style="font-size:.74rem;color:var(--gr)">📅 '+d.fecha+' · 🏷️ '+d.tipo+'</div></div>'+
            '<span style="background:'+col+'22;color:'+col+';padding:2px 9px;border-radius:50px;font-size:.7rem;font-weight:900">'+lbl+'</span>'+
          '</div>'+
          '<div style="font-size:.82rem;color:#555;line-height:1.5;background:#f0f4ff;border-radius:8px;padding:8px 10px">'+(d.desc||d.descripcion||"")+'</div>'+
          (d.respuesta?'<div style="margin-top:6px;font-size:.78rem;color:#1565c0;font-weight:700">💬 Respondido · '+d.respFecha+'</div>':'')+
        '</div>';
      }
    }).join("")+
    '</div></div>';
}


// ── PANEL ────────────────────────────────────
function abrirIdiomaMoneda(){
  let modal = document.getElementById("mIdiomaMoneda");
  if(!modal){
    modal = document.createElement("div");
    modal.id = "mIdiomaMoneda";
    modal.className = "ov";
    document.body.appendChild(modal);
    modal.addEventListener("click", function(e){ if(e.target===modal) cerrarModal("mIdiomaMoneda"); });
  }

  let curOpts = [
    {code:"COP", sym:"COP$",  name:"Peso Colombiano",    flag:"🇨🇴", sub:"Colombia"},
    {code:"USD", sym:"$",     name:"Dólar",              flag:"🇺🇸", sub:"Estados Unidos"},
    {code:"COP", sym:"COP$",  name:"Peso Colombiano",    flag:"🇨🇴", sub:"Colombia"},
    {code:"MXN", sym:"MX$",   name:"Peso Mexicano",      flag:"🇲🇽", sub:"México"},
    {code:"ARS", sym:"AR$",   name:"Peso Argentino",     flag:"🇦🇷", sub:"Argentina"},
    {code:"CLP", sym:"CL$",   name:"Peso Chileno",       flag:"🇨🇱", sub:"Chile"},
    {code:"PEN", sym:"S/.",   name:"Sol Peruano",        flag:"🇵🇪", sub:"Perú"},
    {code:"BRL", sym:"R$",    name:"Real Brasileño",     flag:"🇧🇷", sub:"Brasil"}
  ];

  let curHTML = curOpts.map(function(c){
    let isSel = CURRENCY===c.code;
    return(
      '<button class="ilm-cur-opt'+(isSel?" ilm-sel":"")+
        '" data-cur="'+c.code+'" onclick="setCurrency(this.dataset.cur);actualizarLangUI()">'+
        '<div class="ilm-cur-flag">'+c.flag+'</div>'+
        '<div class="ilm-cur-body">'+
          '<div class="ilm-cur-name">'+c.name+'</div>'+
          '<div class="ilm-cur-sub">'+c.sym+' · '+c.sub+'</div>'+
        '</div>'+
        (isSel?'<span class="ilm-check">✓</span>':'')+
      '</button>'
    );
  }).join("");

  modal.innerHTML =
    '<div class="mdl ilm-modal">'+
      '<div class="mh">'+
        '<div style="display:flex;align-items:center;gap:10px">'+
          '<div style="width:36px;height:36px;border-radius:10px;background:rgba(255,255,255,.2);display:flex;align-items:center;justify-content:center;font-size:1.3rem">💰</div>'+
          '<div>'+
            '<h2 style="font-size:1.3rem">Moneda</h2>'+
            '<p style="font-size:.72rem;opacity:.8;margin-top:1px">Los precios se convierten automáticamente</p>'+
          '</div>'+
        '</div>'+
        '<button class="bx" onclick="cerrarIdioma()">✕</button>'+
      '</div>'+
      '<div class="mb" style="padding:0">'+
        '<div class="ilm-section">'+
          '<div class="ilm-section-title">'+
            '<span class="ilm-section-ico">🌎</span>'+
            '<div>'+
              '<div class="ilm-section-label">Moneda de visualización</div>'+
              '<div class="ilm-section-sub">Selecciona la moneda de tu país</div>'+
            '</div>'+
          '</div>'+
          '<div class="ilm-cur-grid" id="ilmCurGrid">'+curHTML+'</div>'+
        '</div>'+
        '<div class="ilm-footer">'+
          '<span>⚠️</span> Las tasas de cambio son referenciales y pueden variar'+
        '</div>'+
      '</div>'+
    '</div>';

  abrirModal("mIdiomaMoneda");
}

function actualizarLangUI(){
  // Update currency buttons in modal
  document.querySelectorAll(".ilm-cur-opt").forEach(function(b){
    let isSel = b.dataset.cur===CURRENCY;
    b.classList.toggle("ilm-sel", isSel);
    let check = b.querySelector(".ilm-check");
    if(isSel && !check){
      let sp=document.createElement("span");sp.className="ilm-check";sp.textContent="✓";b.appendChild(sp);
    } else if(!isSel && check){
      check.remove();
    }
  });
}

function abrirPanel(){if(!usuario){abrirModal("mLogin");return;}if(usuario.rol==="administrador"){document.getElementById("panT").textContent="⚙️ Panel Administrador";buildAdmin();abrirModal("mPanel");}else if(usuario.rol==="superadmin"){document.getElementById("panT").textContent="👑 Super Administrador";buildSuper();abrirModal("mPanel");}else{abrirCuentaCliente();}}
function buildAdmin(){let pb=document.getElementById("panB");let userAvaAdmin=usuario.avatar?(usuario.avatar.startsWith("data:")||/^\p{Emoji}/u.test(usuario.avatar)||usuario.avatar.length<=8)?usuario.avatar:'<img src="'+usuario.avatar+'" style="width:32px;height:32px;object-fit:cover;border-radius:50%"/>':(usuario.n[0]);pb.innerHTML='<div class="panel-user-bar">'+'<div class="pub-ava">'+userAvaAdmin+'</div>'+'<div class="pub-info"><div class="pub-name">'+usuario.n+' '+usuario.a+'</div><div class="pub-role">⚙️ Administrador</div></div>'+'<div class="pub-actions">'+'<button class="pub-btn pub-btn-edit" onclick="panelEditarPerfil()">✏️ Perfil</button>'+'<button class="pub-btn pub-btn-exit" onclick="panelSalir()">🚪 Salir</button>'+'</div></div>'+'<div class="tabs"><button class="tab'+(aTab==="productos"?" on":"")+'" onclick="setATab(\'productos\',this)">📦 Productos</button><button class="tab'+(aTab==="agregar"?" on":"")+'" onclick="setATab(\'agregar\',this)">'+(editId?"💾 Editar":"➕ Añadir")+'</button><button class="tab'+(aTab==="categorias"?" on":"")+'" onclick="setATab(\'categorias\',this)">🏷️ Categorías</button><button class="tab'+(aTab==="reportes"?" on":"")+'" onclick="setATab(\'reportes\',this)">🚨 Reportes</button><button class="tab'+(aTab==="mensajes"?" on":"")+'" onclick="setATab(\'mensajes\',this)" id="tabMensajesAdmin">📬 Mensajes</button></div><div id="aTB"></div>';renderAdminTab();}
function setATab(t,btn){aTab=t;document.querySelectorAll("#panB .tab").forEach(function(b){b.classList.remove("on");});btn.classList.add("on");renderAdminTab();}
function renderAdminTab(){api("/reportes").then(function(r){if(r.ok){REPORTES=r.reportes;_renderAdminTab();}else _renderAdminTab();});}
function _renderAdminTab(){
  let c=document.getElementById("aTB");if(!c)return;
  if(aTab==="productos"){
    c.innerHTML='<div style="display:flex;gap:8px;margin-bottom:10px;flex-wrap:wrap"><button class="bte" onclick="exportarCSV(\'productos\')">⬇ CSV Productos</button><button class="bte" onclick="exportarCSV(\'pedidos\')">⬇ CSV Pedidos</button><button class="bte" onclick="exportarCSV(\'usuarios\')">⬇ CSV Usuarios</button></div><div class="tw"><table><thead><tr><th>Img</th><th>Nombre</th><th>Precio</th><th>Stock</th><th>Acc.</th></tr></thead><tbody>'+
      PRODS.map(function(p){let thumb=p.img?'<img src="'+p.img+'" style="width:44px;height:44px;object-fit:cover;border-radius:10px;box-shadow:0 2px 6px rgba(0,0,0,.1)"/>':'<div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#EFF6FF,#DBEAFE);display:flex;align-items:center;justify-content:center;font-size:1.4rem">'+emojiProd(p)+'</div>';let stBg=p.st<=0?'#FEF2F2':p.st<=10?'#FFFBEB':'#F0FDF4';let stColor=p.st<=0?'#DC2626':p.st<=10?'#D97706':'#16A34A';let stIcon=p.st<=0?' 🚫':p.st<=10?' ⚠️':'';let ofBadge=p.o?'<span style="background:#EFF6FF;color:#1E40AF;font-size:.65rem;font-weight:800;padding:2px 7px;border-radius:50px;margin-left:5px">OFERTA</span>':'';return '<tr>'+'<td>'+thumb+'</td>'+'<td><div style="font-weight:700;font-size:.88rem">'+p.n+ofBadge+'</div><small style="color:#94A3B8;font-size:.72rem">'+p.cat+'</small></td>'+'<td><span style="font-weight:800;color:#1E3A8A;font-family:Bebas Neue,cursive;font-size:1rem">'+bs(p.o||p.p)+'</span>'+(p.o?'<br><small style="color:#94A3B8;text-decoration:line-through;font-size:.72rem">'+bs(p.p)+'</small>':'')+'</td>'+'<td><span style="background:'+stBg+';color:'+stColor+';font-weight:800;font-size:.82rem;padding:4px 10px;border-radius:8px">'+p.st+stIcon+'</span></td>'+'<td style="white-space:nowrap">'+'<button class="bte" onclick="editP('+p.id+')" title="Editar">✏️</button>'+'<button class="btd" onclick="elimP('+p.id+')" title="Eliminar">🗑️</button>'+(p.img?'<button class="btd" title="Quitar foto" onclick="elimFoto('+p.id+')">🖼️</button>':'')+'</td></tr>';}).join('')+'</tbody></table></div>';
  }else if(aTab==="agregar"){
    let imgPv=(newPF.img||imgTempAdmin)?'<img src="'+(imgTempAdmin||newPF.img)+'" class="img-preview" id="imgPrev"/>':'<div id="imgPrev" style="display:none"></div>';
    let quitarFotoBtn=(editId&&(newPF.img||imgTempAdmin))?'<button class="btd" style="margin-top:6px;font-size:.8rem" onclick="quitarFotoFormAdmin()">🖼️✕ Quitar foto actual</button>':'';
    c.innerHTML='<div class="f2"><div class="fg"><label>Nombre *</label><input class="fc" id="nNom" value="'+(newPF.n||"")+'"/></div><div class="fg"><label>Categoría</label><select class="fc" id="nCat">'+CATS.filter(function(x){return x.id>0;}).map(function(x){return '<option value="'+x.id+'"'+(x.id===newPF.cat?" selected":"")+'>'+x.n+'</option>';}).join("")+'</select></div></div><div class="fg"><label>Descripción</label><textarea class="fc" id="nDesc" rows="3" style="resize:vertical">'+(newPF.d||"")+'</textarea></div><div class="f2"><div class="fg"><label>Precio (COP$) *</label><input class="fc" type="number" id="nPrecio" value="'+(newPF.p||"")+'" step="0.01"/></div><div class="fg"><label>Precio Oferta</label><input class="fc" type="number" id="nOferta" value="'+(newPF.o||"")+'" step="0.01"/></div></div><div class="f2"><div class="fg"><label>Stock *</label><input class="fc" type="number" id="nStock" value="'+(newPF.st||"")+'"/></div><div class="fg"><label>¿Destacado?</label><select class="fc" id="nDest"><option value="false">No</option><option value="true"'+(newPF.dest?" selected":"")+'>Sí ⭐</option></select></div></div><div class="fg"><label>📷 Foto</label>'+imgPv+quitarFotoBtn+'<div class="img-upload-area"><input type="file" accept="image/*" onchange="cargarImgProd(event)"/><span style="font-size:2rem;display:block;margin-bottom:6px">📷</span><span style="font-size:.85rem;color:var(--gr)">'+(newPF.img||imgTempAdmin?"Cambiar foto":"Subir foto")+'</span></div></div><button class="bp" onclick="guardarProd()">'+(editId?"💾 Guardar Cambios":"➕ Crear Producto")+'</button>'+(editId?'<button class="bs" onclick="cancelEdit()">Cancelar</button>':"");
  }else if(aTab==="categorias"){
    _renderCategorias(c);
  }else{
    if(!REPORTES.length){c.innerHTML='<div class="empty"><div class="eico">✅</div><h3>Sin reportes</h3></div>';return;}
    c.innerHTML='<div style="display:flex;flex-direction:column;gap:0">'+REPORTES.map(function(r){
      let estCls={pendiente:"rep-est-pendiente",en_revision:"rep-est-revision",resuelto:"rep-est-resuelto"}[r.estado]||"";
      let estLabel={pendiente:"⏳ Pendiente",en_revision:"🔄 Revisión",resuelto:"✅ Resuelto"}[r.estado]||r.estado;
      let userAva=(r.uNom||"U")[0];
      return '<div class="rep-card">'+
        '<div class="rep-card-head">'+
          '<div class="rep-user-ava">'+userAva+'</div>'+
          '<div><strong style="font-size:.88rem">'+r.uNom+'</strong><br><small style="color:var(--gr)">'+r.fecha+'</small></div>'+
          '<span class="rep-tipo-badge">'+r.tipo+'</span>'+
          '<span class="rep-est-badge '+estCls+'">'+estLabel+'</span>'+
        '</div>'+
        '<div class="rep-card-body">'+
          (r.pNom&&r.pNom!=="General"?'<div class="rep-prod-tag">📦 '+r.pNom+'</div><br>':'')+
          '<div class="rep-desc-box">'+(r.desc||r.descripcion||"")+'</div>'+
          (r.respuesta?'<div class="rep-respuesta-box"><strong>💬 Respuesta ('+( r.respFecha||"")+'):</strong>'+r.respuesta+'</div>':'')+
          '<button class="bte" style="margin-top:8px" onclick="abrirRespRep('+r.id+')">💬 Responder</button>'+
        '</div>'+
      '</div>';
    }).join("")+'</div>';
  }
  if(aTab==="mensajes"){
    function _renderMensajesAdmin(msgs){
      if(!msgs.length){c.innerHTML='<div class="empty"><div class="eico">📬</div><h3>Sin mensajes</h3><p>Aún no hay mensajes de contacto.</p></div>';return;}
      let noLeidos=msgs.filter(function(m){return !m.leido;}).length;
      c.innerHTML=(noLeidos?'<div style="margin-bottom:12px;background:#fff3e0;border:1.5px solid #ffb74d;border-radius:10px;padding:10px 14px;font-size:.85rem;font-weight:800;color:#e65100">🔔 '+noLeidos+' mensaje'+(noLeidos!==1?"s":"")+" sin leer</div>":"")+
      '<div style="display:flex;flex-direction:column;gap:10px">'+msgs.map(function(m){
        let badge=m.leido?'<span style="background:#e8f5e9;color:#2e7d32;font-size:.7rem;font-weight:800;padding:3px 9px;border-radius:50px">✅ Leído</span>':'<span style="background:#fff3e0;color:#e65100;font-size:.7rem;font-weight:800;padding:3px 9px;border-radius:50px">🔔 Nuevo</span>';
        let asuntoLabel={"pedido":"📦 Pedido","producto":"🛍️ Producto","devolucion":"↩️ Devolución","pago":"💳 Pago","envio":"🚚 Envío","queja":"😟 Queja","otro":"💬 Otro"}[m.asunto]||m.asunto;
        let prioBadge=m.prioridad?'<span class="prio-badge-'+(m.prioridad||"normal")+"'>"+(m.prioridad==="urgente"?"🔴 Urgente":m.prioridad==="informativo"?"🔵 Info":"🟢 Normal")+"</span>":"";
        return '<div class="msg-card'+(m.leido?'':' unread')+'">'+
          '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">'+
            '<div class="msg-avatar">'+(m.nombre||"?")[0].toUpperCase()+'</div>'+
            '<div style="flex:1;min-width:0"><strong style="font-size:.86rem">'+m.nombre+'</strong><br><small style="color:var(--gr)">'+m.email+(m.tel?' · '+m.tel:'')+'</small></div>'+
            badge+prioBadge+'<span style="background:#f5f5f5;color:var(--na3);font-size:.7rem;font-weight:800;padding:3px 9px;border-radius:50px">'+asuntoLabel+'</span>'+
          '</div>'+
          '<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:10px;padding:10px 12px;font-size:.84rem;color:var(--bk);line-height:1.6;margin-bottom:8px">'+m.mensaje+'</div>'+
          '<div style="display:flex;gap:8px;align-items:center;justify-content:space-between">'+
            '<small style="color:var(--gr)">'+m.fecha+'</small>'+
            '<div style="display:flex;gap:6px">'+
              (!m.leido?'<button class="bte" onclick="marcarMensajeLeido('+m.id+')">✅ Leído</button>':'')+
              '<a class="bte" href="mailto:'+m.email+'?subject=Re: '+m.asunto+'" style="text-decoration:none">📧 Responder</a>'+
              '<button class="btd" onclick="eliminarMensaje('+m.id+')">🗑️</button>'+
            '</div>'+
          '</div>'+
        '</div>';
      }).join("")+'</div>';
    }
    if(CONTACTOS.length){_renderMensajesAdmin(CONTACTOS);}
    else{
      api("/contactos").then(function(r){
        CONTACTOS=r.ok?(r.contactos||[]):[];
        _renderMensajesAdmin(CONTACTOS);
      });
    }
  }
}
function _renderCategorias(c){api("/categorias").then(function(r){
  let cats=r.ok?r.categorias:[];
  let html='';
  html+='<div class="cat-create-box">';
  html+='<div class="admin-form-title">➕ Nueva Categoría</div>';
  html+='<div class="f2">';
  html+='<div class="fg"><label>Nombre *</label><input class="fc" id="catNom" placeholder="Ej: Tecnología"/></div>';
  html+='<div class="fg"><label>Emoji</label><input class="fc" id="catEmoji" placeholder="🏷️" maxlength="4"/></div>';
  html+='</div>';
  html+='<button class="bp" style="margin-top:8px" onclick="crearCategoria()">➕ Crear Categoría</button>';
  html+='</div>';
  if(!cats.length){
    html+='<div class="empty"><div class="eico">🏷️</div><p>No hay categorías aún</p></div>';
  } else {
    html+='<div class="tw"><table><thead><tr><th>Emoji</th><th>Nombre</th><th>Prods.</th><th>Acción</th></tr></thead><tbody>';
    cats.forEach(function(cat){
      let prodCount=PRODS.filter(function(p){return p.cid===cat.id;}).length;
      html+='<tr>';
      html+='<td style="font-size:1.3rem;text-align:center">'+cat.emoji+'</td>';
      html+='<td><strong style="font-size:.88rem">'+cat.nombre+'</strong></td>';
      html+='<td><span style="background:#EFF6FF;color:#1E3A8A;padding:3px 10px;border-radius:50px;font-size:.75rem;font-weight:700">'+prodCount+'</span></td>';
      html+='<td><button class="btd" data-cid="'+cat.id+'" onclick="elimCategoria(parseInt(this.dataset.cid))">🗑️ Eliminar</button></td>';
      html+='</tr>';
    });
    html+='</tbody></table></div>';
  }
  c.innerHTML=html;
});}

function crearCategoria(){let nom=(document.getElementById("catNom").value||"").trim(),emoji=(document.getElementById("catEmoji").value||"🏷️").trim();if(!nom){toast("Nombre requerido","e");return;}api("/categorias","POST",{nombre:nom,emoji:emoji}).then(function(r){if(!r.ok){toast(r.error||"Error","e");return;}toast("Categoría '"+nom+"' creada ✅","s");document.getElementById("catNom").value="";document.getElementById("catEmoji").value="";cargarDatos();_renderAdminTab();});}
function elimCategoria(id,nom){
  if(nom===undefined){let cc=CATS.find(function(x){return x.id===id;});nom=cc?cc.nombre:("#"+id);}if(!confirm("¿Eliminar '"+nom+"'?"))return;api("/categorias/"+id,"DELETE").then(function(r){if(!r.ok){toast(r.error||"No se puede eliminar","e");return;}toast("Eliminada","i");cargarDatos();_renderAdminTab();});}
function elimFoto(pid){if(!confirm("¿Eliminar foto?"))return;api("/productos/"+pid+"/foto","PUT").then(function(r){if(!r.ok){toast("Error","e");return;}let p=PRODS.find(function(x){return x.id===pid;});if(p)p.img=null;toast("Foto eliminada ✅","s");cargarDatos();_renderAdminTab();});}
function quitarFotoFormAdmin(){if(!editId)return;if(!confirm("¿Quitar la foto de este producto?"))return;api("/productos/"+editId+"/foto","PUT").then(function(r){if(!r.ok){toast("Error al quitar foto","e");return;}let p=PRODS.find(function(x){return x.id===editId;});if(p)p.img=null;imgTempAdmin=null;newPF.img=null;toast("Foto quitada ✅","s");cargarDatos();aTab="agregar";buildAdmin();});}
function quitarFotoFormSuper(){if(!spEditId)return;if(!confirm("¿Quitar la foto de este producto?"))return;api("/productos/"+spEditId+"/foto","PUT").then(function(r){if(!r.ok){toast("Error al quitar foto","e");return;}let p=PRODS.find(function(x){return x.id===spEditId;});if(p)p.img=null;imgTempSuper=null;spNewPF.img=null;toast("Foto quitada ✅","s");cargarDatos();sprodTab("add",document.getElementById("spTabAdd"));});}
function cargarImgProd(e){let file=e.target.files[0];if(!file)return;let r=new FileReader();r.onload=function(ev){imgTempAdmin=ev.target.result;let prev=document.getElementById("imgPrev");if(prev){prev.src=imgTempAdmin;prev.style.display="block";prev.className="img-preview";}};r.readAsDataURL(file);}
function editP(id){let p=PRODS.find(function(x){return x.id===id;});if(!p)return;editId=id;imgTempAdmin=p.img||null;newPF={n:p.n,d:p.d,p:p.p,o:p.o||"",st:p.st,cat:p.cid,dest:p.dest,img:p.img||null};aTab="agregar";buildAdmin();}
function cancelEdit(){editId=null;imgTempAdmin=null;newPF={n:"",d:"",p:"",o:"",st:"",cat:1,dest:false,img:null};aTab="productos";buildAdmin();}
function guardarProd(){let n=document.getElementById("nNom").value.trim(),pr=parseFloat(document.getElementById("nPrecio").value),st=parseInt(document.getElementById("nStock").value);if(!n||isNaN(pr)||isNaN(st)){toast("Completa los campos","e");return;}let cid=parseInt(document.getElementById("nCat").value),cat=CATS.find(function(c){return c.id===cid;}),catN=cat?cat.n.replace(/^\S+\s/,""):"General";let o=parseFloat(document.getElementById("nOferta").value)||null,dest=document.getElementById("nDest").value==="true",desc=document.getElementById("nDesc").value;let img=imgTempAdmin||(editId?(PRODS.find(function(p){return p.id===editId;})||{}).img:null)||null;let wasEdit=editId;api(editId?"/productos/"+editId:"/productos",editId?"PUT":"POST",{n:n,d:desc,p:pr,o:o,st:st,cat:catN,cid:cid,dest:dest,img:img}).then(function(r){if(!r.ok){toast("Error","e");return;}editId=null;imgTempAdmin=null;newPF={n:"",d:"",p:"",o:"",st:"",cat:1,dest:false,img:null};toast(wasEdit?"Actualizado ✅":"¡Creado! ✅","s");cargarDatos();aTab="productos";buildAdmin();});}
function elimP(id){if(!confirm("¿Eliminar?"))return;api("/productos/"+id,"DELETE").then(function(r){if(!r.ok){toast("Error","e");return;}toast("Eliminado","i");cargarDatos();buildAdmin();});}

// ── SUPERADMIN ───────────────────────────────

function _notifBanner(count, singular, plural, color, borderColor, action, actionLabel) {
  if(count <= 0) return '';
  let noun = count !== 1 ? plural : singular;
  let banner = '<div class="notif-banner notif-banner-warn">';
  banner += '<span style="font-size:1.1rem">⚠️</span>';
  banner += '<span>Tienes <strong>' + count + '</strong> ' + noun;
  if(action) banner += '. <span style="cursor:pointer;text-decoration:underline;color:#1E40AF" onclick="'+action+'">'+actionLabel+'</span>';
  banner += '</span></div>';
  return banner;
}

function marcarMensajeLeido(id){
  api("/contactos/"+id+"/leer","PUT").then(function(r){
    if(!r.ok){toast("Error al marcar","e");return;}
    let m=CONTACTOS.find(function(x){return x.id===id;});
    if(m)m.leido=true;
    toast("Mensaje marcado como leído ✅","s");
    invalidateSCache(["contactos"]);renderSuperTab();
  });
}
function eliminarMensaje(id){
  if(!confirm("¿Eliminar este mensaje?"))return;
  api("/contactos/"+id+"/eliminar","DELETE").then(function(r){
    if(!r.ok){toast("Error al eliminar","e");return;}
    CONTACTOS=CONTACTOS.filter(function(x){return x.id!==id;});
    toast("Mensaje eliminado","i");
    invalidateSCache(["contactos"]);renderSuperTab();
  });
}

function crearCupon(){
  let cod=document.getElementById("cpCod").value.trim().toUpperCase();
  let tipo=document.getElementById("cpTipo").value;
  let val=parseFloat(document.getElementById("cpVal").value);
  let min=parseFloat(document.getElementById("cpMin").value)||0;
  let usos=parseInt(document.getElementById("cpUsos").value)||100;
  if(!cod||isNaN(val)||val<=0){toast("Completa código y valor","e");return;}
  api("/cupones","POST",{codigo:cod,tipo:tipo,valor:val,min_compra:min,usos_max:usos}).then(function(r){
    if(!r.ok){toast(r.error||"Error","e");return;}
    toast("Cupón "+cod+" creado 🎫","s");
    invalidateSCache(["cupones"]);
    sTab="cupones";setSTab("cupones",document.querySelector('[data-k=\"cupones\"]')||document.querySelector(".tab.on"));renderSuperTab();
  });
}
function elimCupon(id){
  if(!confirm("¿Eliminar este cupón?"))return;
  api("/cupones","DELETE",{id:id}).then(function(r){
    if(!r.ok){toast("Error","e");return;}
    toast("Cupón eliminado","i");
    renderSuperTab();
  });
}

// ── CHAT ADMIN — Superadmin panel ────────────────────────────
let _adminChatUid     = null;  // Currently open conversation UID
let _adminChatTimer   = null;  // Polling timer

function _renderSuperChats(c){
  c.innerHTML = '<div class="tab-loading"></div>';
  _adminCargarChats(c);
}

function _adminCargarChats(c){
  fetch('/api/chat/admin')
    .then(function(r){ return r.json(); })
    .then(function(r){
      if(!r.ok){ c.innerHTML='<div class="empty"><div class="eico">💬</div><h3>Error cargando chats</h3></div>'; return; }
      let chats = r.chats || [];
      if(!chats.length){
        c.innerHTML = '<div class="empty"><div class="eico">💬</div><h3>Sin conversaciones</h3><p>Cuando los clientes escriban aparecerán aquí.</p></div>';
        return;
      }
      let listaHtml = '<div class="admin-chat-layout">'
        + '<div class="admin-chat-list" id="adminChatList">'
        + chats.map(function(ch){
            let sinLeer = ch.sinLeer > 0;
            return '<div class="admin-chat-item'+(sinLeer?' admin-chat-item-unread':'')+'" '
              + 'onclick="_adminAbrirChat('+ch.uid+',\''+_escapeHtml(ch.uNom)+'\',\''+_escapeHtml(ch.uEmail)+'\')" '
              + 'data-uid="'+ch.uid+'">'
              + '<div class="admin-chat-ava">'+(ch.uNom||'?')[0].toUpperCase()+'</div>'
              + '<div class="admin-chat-meta">'
              + '  <div class="admin-chat-name">'+_escapeHtml(ch.uNom)+'</div>'
              + '  <div class="admin-chat-preview">'+_escapeHtml((ch.ultimoMsg||'').slice(0,40))+'</div>'
              + '</div>'
              + (sinLeer?'<div class="admin-chat-badge">'+ch.sinLeer+'</div>':'')
              + '</div>';
          }).join('')
        + '</div>'
        + '<div class="admin-chat-conv" id="adminChatConv">'
        + '  <div class="admin-chat-placeholder"><div style="font-size:2rem">👈</div><p>Selecciona una conversación</p></div>'
        + '</div>'
        + '</div>';
      c.innerHTML = listaHtml;
      // Auto-open first if only one
      if(chats.length === 1) _adminAbrirChat(chats[0].uid, chats[0].uNom, chats[0].uEmail);
    })
    .catch(function(){ c.innerHTML='<div class="empty"><div class="eico">⚠️</div><h3>Error de conexión</h3></div>'; });
}

function _adminAbrirChat(uid, nom, email){
  _adminChatUid = uid;
  // Highlight selected
  document.querySelectorAll('.admin-chat-item').forEach(function(el){
    el.classList.toggle('admin-chat-item-active', parseInt(el.dataset.uid) === uid);
  });
  let conv = document.getElementById('adminChatConv');
  if(!conv) return;
  conv.innerHTML =
    '<div class="admin-chat-conv-header">'
    + '  <div class="admin-chat-ava">'+nom[0].toUpperCase()+'</div>'
    + '  <div><div style="font-weight:700;font-size:.9rem">'+_escapeHtml(nom)+'</div><div style="font-size:.72rem;color:var(--gr)">'+_escapeHtml(email)+'</div></div>'
    + '  <button class="btd" style="margin-left:auto;font-size:.72rem" onclick="_adminEliminarChat('+uid+')">🗑️ Cerrar chat</button>'
    + '</div>'
    + '<div class="admin-chat-messages" id="adminChatMessages"><div class="tab-loading"></div></div>'
    + '<div class="chat-input-row" style="padding:10px 12px;border-top:1.5px solid #E2E8F0">'
    + '  <input class="fc chat-input" id="adminChatInput" placeholder="Responder a '+_escapeHtml(nom)+'…" autocomplete="off"'
    + '    onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();_adminEnviarRespuesta();}"/>'
    + '  <button class="chat-send-btn" onclick="_adminEnviarRespuesta()" title="Enviar">'
    + '    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>'
    + '  </button>'
    + '</div>';
  _adminCargarMensajes(uid);
  if(_adminChatTimer) clearInterval(_adminChatTimer);
  _adminChatTimer = setInterval(function(){
    if(_adminChatUid === uid) _adminCargarMensajes(uid, true);
    else { clearInterval(_adminChatTimer); _adminChatTimer=null; }
  }, 4000);
}

function _adminCargarMensajes(uid, silencioso){
  fetch('/api/chat?uid='+uid)
    .then(function(r){ return r.json(); })
    .then(function(r){
      let box = document.getElementById('adminChatMessages');
      if(!box || !r.ok) return;
      let msgs = r.mensajes || [];
      let atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
      if(!msgs.length){
        box.innerHTML = '<div style="text-align:center;padding:30px;color:var(--gr);font-size:.88rem">Sin mensajes aún</div>';
        return;
      }
      box.innerHTML = msgs.map(function(m){
        let esCliente = m.remitente === 'cliente';
        return '<div class="chat-msg-row '+(esCliente?'chat-msg-row-support':'chat-msg-row-client')+'">'
          + '<div class="chat-bubble '+(esCliente?'chat-bubble-support':'chat-bubble-client')+'">'
          + _escapeHtml(m.mensaje)+'</div>'
          + '<div class="chat-msg-time">'+(esCliente?'👤 '+_escapeHtml(m.uNom||'Cliente'):'🛡️ Soporte')+' · '+(m.fecha||'').slice(11,16)+'</div>'
          + '</div>';
      }).join('');
      if(atBottom || !silencioso) box.scrollTop = box.scrollHeight;
      // Clear unread badge for this user
      let item = document.querySelector('.admin-chat-item[data-uid="'+uid+'"]');
      if(item){ item.classList.remove('admin-chat-item-unread'); let badge=item.querySelector('.admin-chat-badge');if(badge)badge.remove(); }
    });
}

function _adminEnviarRespuesta(){
  if(!_adminChatUid) return;
  let inp = document.getElementById('adminChatInput');
  if(!inp) return;
  let msg = inp.value.trim();
  if(!msg) return;
  inp.value = ''; inp.disabled = true;
  fetch('/api/chat', {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({uid: _adminChatUid, mensaje: msg, remitente: 'soporte'})
  })
  .then(function(r){ return r.json(); })
  .then(function(r){
    inp.disabled = false; inp.focus();
    if(r.ok) _adminCargarMensajes(_adminChatUid);
    else toast('Error al enviar respuesta','e');
  })
  .catch(function(){ inp.disabled=false; toast('Error de conexión','e'); });
}

function _adminEliminarChat(uid){
  if(!confirm('¿Cerrar y eliminar esta conversación?')) return;
  fetch('/api/chat/'+uid+'/eliminar', {method:'DELETE'})
    .then(function(r){ return r.json(); })
    .then(function(r){
      if(r.ok){
        toast('Chat eliminado','i');
        if(_adminChatTimer){clearInterval(_adminChatTimer);_adminChatTimer=null;}
        _adminChatUid = null;
        let c = document.getElementById('sTB');
        if(c) _renderSuperChats(c);
      }
    });
}

function buildSuper(){let pb=document.getElementById("panB");let userAvaSuper=usuario.avatar?(usuario.avatar.startsWith("data:")||/^\p{Emoji}/u.test(usuario.avatar)||usuario.avatar.length<=8)?usuario.avatar:'<img src="'+usuario.avatar+'" style="width:32px;height:32px;object-fit:cover;border-radius:50%"/>':(usuario.n[0]);let userBar='<div class="panel-user-bar">'+'<div class="pub-ava">'+userAvaSuper+'</div>'+'<div class="pub-info"><div class="pub-name">'+usuario.n+' '+usuario.a+'</div><div class="pub-role">👑 Super Admin</div></div>'+'<div class="pub-actions">'+'<button class="pub-btn pub-btn-edit" onclick="panelEditarPerfil()">✏️ Perfil</button>'+'<button class="pub-btn pub-btn-exit" onclick="panelSalir()">🚪 Salir</button>'+'</div></div>';let tbs=[{k:"stats",l:"📊 Stats"},{k:"users",l:"👥 Usuarios"},{k:"prods",l:"📦 Productos"},{k:"categorias",l:"🏷️ Categorías"},{k:"reportes",l:"🚨 Reportes"},{k:"mensajes",l:"📬 Mensajes",id:"tabMensajesSuper"},{k:"cadmin",l:"➕ Admin"},{k:"cupones",l:"🎫 Cupones"},{k:"chat",l:"💬 Chat"},{k:"push",l:"🔔 Push"},{k:"logs",l:"📋 Logs"}];let html=tbs.map(function(t){let id=t.id?' id="'+t.id+'"':'';let on=' onclick="setSTab(\''+t.k+'\',this)"';return '<button class="tab'+(sTab===t.k?' on':'')+'"'+id+on+'>'+t.l+'</button>';}).join("");pb.innerHTML=userBar+'<div class="tabs">'+html+'</div><div id="sTB"></div>';
// Al abrir el panel siempre refrescar la pestaña stats
if(sTab==="stats")invalidateSCache(["prods","users","reportes","contactos"]);
renderSuperTab();}
function setSTab(t,btn){sTab=t;if(_adminChatTimer){clearInterval(_adminChatTimer);_adminChatTimer=null;}_adminChatUid=null;document.querySelectorAll("#panB .tab").forEach(function(b){b.classList.remove("on");});btn.classList.add("on");renderSuperTab();}
// Cache de timestamps para las APIs del superadmin (0 = nunca cargado)
let _sCache={prods:0,users:0,reportes:0,logs:0,contactos:0};
let _sCacheTTL=30000; // 30 segundos

function _sNeedsRefresh(key){return Date.now()-_sCache[key]>_sCacheTTL;}
function _sMarkFresh(key){_sCache[key]=Date.now();}
function invalidateSCache(keys){
  (keys||["prods","users","reportes","logs","contactos"]).forEach(function(k){_sCache[k]=0;});
}

function renderSuperTab(){
  // Show spinner immediately
  let c=document.getElementById("sTB");
  if(c&&!c.innerHTML.trim()){
    c.innerHTML='<div class="tab-loading"></div>';
  }

  // Build fetch list based on active tab + staleness
  let fetches=[];

  if(sTab==="stats"){
    // Stats needs everything except logs
    if(_sNeedsRefresh("prods"))   fetches.push(api("/productos").then(function(r){if(r.ok){PRODS=r.productos;_sMarkFresh("prods");}}));
    if(_sNeedsRefresh("users"))   fetches.push(api("/usuarios").then(function(r){if(r.ok){USUARIOS=r.usuarios;_sMarkFresh("users");}}));
    if(_sNeedsRefresh("reportes"))fetches.push(api("/reportes").then(function(r){if(r.ok){REPORTES=r.reportes;_sMarkFresh("reportes");}}));
    if(_sNeedsRefresh("contactos"))fetches.push(api("/contactos").then(function(r){if(r.ok){CONTACTOS=r.contactos||[];_sMarkFresh("contactos");}}));
  } else if(sTab==="users"){
    if(_sNeedsRefresh("users"))   fetches.push(api("/usuarios").then(function(r){if(r.ok){USUARIOS=r.usuarios;_sMarkFresh("users");}}));
  } else if(sTab==="prods"||sTab==="categorias"){
    if(_sNeedsRefresh("prods"))   fetches.push(api("/productos").then(function(r){if(r.ok){PRODS=r.productos;_sMarkFresh("prods");}}));
  } else if(sTab==="reportes"){
    if(_sNeedsRefresh("reportes"))fetches.push(api("/reportes").then(function(r){if(r.ok){REPORTES=r.reportes;_sMarkFresh("reportes");}}));
  } else if(sTab==="mensajes"){
    if(_sNeedsRefresh("contactos"))fetches.push(api("/contactos").then(function(r){if(r.ok){CONTACTOS=r.contactos||[];_sMarkFresh("contactos");}}));
  } else if(sTab==="logs"){
    if(_sNeedsRefresh("logs"))    fetches.push(api("/logs").then(function(r){if(r.ok){LOGS=r.logs;_sMarkFresh("logs");}}));
  }
  // cadmin/cupones: no pre-fetch needed (cupones tab fetches inline)
  // cadmin: no fetch needed

  if(fetches.length){
    Promise.all(fetches).then(function(){_renderSuperTab();});
  } else {
    // All data is fresh — render synchronously
    _renderSuperTab();
  }
}


// ── EXPORTAR CSV ─────────────────────────────────────────────
function exportarCSV(tipo){
  let rows = [], nombre = "";

  if(tipo === "productos"){
    nombre = "productos_nuestrostore.csv";
    rows.push(["ID","Nombre","Categoría","Precio","Oferta","Stock","Destacado"]);
    PRODS.forEach(function(p){
      rows.push([p.id, p.n, p.cat, p.p, p.o||"", p.st, p.dest?"Sí":"No"]);
    });
  } else if(tipo === "usuarios"){
    nombre = "usuarios_nuestrostore.csv";
    rows.push(["ID","Nombre","Apellido","Email","Rol","Activo"]);
    USUARIOS.forEach(function(u){
      rows.push([u.id, u.n, u.a, u.email, u.rol, u.act?"Sí":"No"]);
    });
  } else if(tipo === "pedidos"){
    nombre = "pedidos_nuestrostore.csv";
    rows.push(["ID","Cliente","Email","Total","Estado","Fecha","Productos"]);
    // Fetch fresh pedidos data
    api("/todos-pedidos").then(function(r){
      if(!r.ok){ toast("Error al cargar pedidos","e"); return; }
      r.pedidos.forEach(function(p){
        let items = (p.items||[]).map(function(i){ return i.n+"×"+i.qty; }).join(" | ");
        rows.push([p.id, p.uNom, p.uEmail, p.total, p.estado, (p.fecha||"").slice(0,16), items]);
      });
      _descargarCSV(rows, nombre);
    });
    return;
  }

  _descargarCSV(rows, nombre);
}

function _descargarCSV(rows, nombre){
  if(!rows.length){ toast("Sin datos para exportar","e"); return; }
  let csv = rows.map(function(row){
    return row.map(function(cell){
      let s = String(cell==null?"":cell).replace(/"/g,'""');
      return s.indexOf(",")>=0||s.indexOf('"')>=0||s.indexOf("\n")>=0 ? '"'+s+'"' : s;
    }).join(",");
  }).join("\r\n");
  // Add UTF-8 BOM for Excel
  let blob = new Blob(["\uFEFF"+csv], {type:"text/csv;charset=utf-8;"});
  let url = URL.createObjectURL(blob);
  let a = document.createElement("a");
  a.href = url; a.download = nombre;
  document.body.appendChild(a); a.click();
  document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 1000);
  toast("✅ "+nombre+" descargado","s");
}

// ── GRÁFICA DE VENTAS ─────────────────────────────────────────
let _ventasChart = null;
let _chartPeriodo = "dias"; // "dias" | "semanas"

function renderVentasChart(){
  // Add chart HTML if not present
  let c = document.getElementById("sTB");
  if(!c) return;

  // Inject chart container after sgrid
  let existing = document.getElementById("ventasChartWrap");
  if(!existing){
    let wrap = document.createElement("div");
    wrap.id = "ventasChartWrap";
    wrap.innerHTML =
      '<div class="vchart-header">'
      + '<div class="vchart-title">📈 Ventas</div>'
      + '<div class="vchart-tabs">'
      + '<button class="vchart-tab on" onclick="cambiarPeriodo(\'dias\',this)">7 días</button>'
      + '<button class="vchart-tab" onclick="cambiarPeriodo(\'semanas\',this)">4 semanas</button>'
      + '</div>'
      + '<div class="vchart-export-row">'
      + '<button class="bte" onclick="exportarCSV(\'pedidos\')">⬇ CSV Pedidos</button>'
      + '<button class="bte" onclick="exportarCSV(\'productos\')">⬇ CSV Productos</button>'
      + '<button class="bte" onclick="exportarCSV(\'usuarios\')">⬇ CSV Usuarios</button>'
      + '</div>'
      + '</div>'
      + '<div style="position:relative;height:220px;margin-top:12px">'
      + '<canvas id="ventasCanvas"></canvas>'
      + '</div>';
    c.appendChild(wrap);
  }

  api("/todos-pedidos").then(function(r){
    if(!r.ok) return;
    let pedidos = r.pedidos || [];
    _dibujarChart(pedidos, _chartPeriodo);
  });
}

function cambiarPeriodo(periodo, btn){
  _chartPeriodo = periodo;
  document.querySelectorAll(".vchart-tab").forEach(function(b){ b.classList.remove("on"); });
  btn.classList.add("on");
  api("/todos-pedidos").then(function(r){
    if(r.ok) _dibujarChart(r.pedidos || [], periodo);
  });
}

function _dibujarChart(pedidos, periodo){
  // Destroy previous instance
  if(_ventasChart){ _ventasChart.destroy(); _ventasChart = null; }
  let canvas = document.getElementById("ventasCanvas");
  if(!canvas) return;

  // Aggregate data
  let labels = [], totales = [], counts = [];

  if(periodo === "dias"){
    // Last 7 days
    for(let i=6; i>=0; i--){
      let d = new Date(); d.setDate(d.getDate()-i);
      let key = d.toISOString().slice(0,10); // YYYY-MM-DD
      let dayStr = d.toLocaleDateString("es-CO",{weekday:"short",day:"numeric"});
      labels.push(dayStr);
      let dayPedidos = pedidos.filter(function(p){
        return (p.fecha||"").slice(0,10) === key;
      });
      totales.push(dayPedidos.reduce(function(s,p){ return s+(p.total||0); }, 0));
      counts.push(dayPedidos.length);
    }
  } else {
    // Last 4 weeks (Mon-Sun)
    let now = new Date();
    for(let w=3; w>=0; w--){
      let wStart = new Date(now);
      wStart.setDate(now.getDate() - now.getDay() + 1 - w*7);
      let wEnd = new Date(wStart); wEnd.setDate(wStart.getDate()+6);
      let wLabel = wStart.toLocaleDateString("es-CO",{day:"numeric",month:"short"})
        + " - " + wEnd.toLocaleDateString("es-CO",{day:"numeric",month:"short"});
      labels.push(wLabel);
      let wPedidos = pedidos.filter(function(p){
        let pDate = new Date((p.fecha||"").slice(0,10));
        return pDate >= wStart && pDate <= wEnd;
      });
      totales.push(wPedidos.reduce(function(s,p){ return s+(p.total||0); }, 0));
      counts.push(wPedidos.length);
    }
  }

  // Load Chart.js if not loaded
  function drawChart(){
    let isDark = document.documentElement.classList.contains("dark");
    let gridColor = isDark ? "rgba(255,255,255,.08)" : "rgba(0,0,0,.06)";
    let textColor = isDark ? "#94A3B8" : "#64748B";
    let maxTotal = Math.max.apply(null, totales.concat([1]));

    _ventasChart = new Chart(canvas, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Ventas (COP$)",
            data: totales,
            backgroundColor: "rgba(37,99,235,.75)",
            borderRadius: 7,
            borderSkipped: false,
            yAxisID: "y",
          },
          {
            label: "Pedidos",
            data: counts,
            type: "line",
            borderColor: "#06B6D4",
            backgroundColor: "rgba(6,182,212,.12)",
            pointBackgroundColor: "#06B6D4",
            pointRadius: 4,
            fill: true,
            tension: .35,
            yAxisID: "y2",
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: function(ctx){
                if(ctx.datasetIndex===0) return " COP$ " + Math.round(ctx.raw).toLocaleString("es-CO");
                return " " + ctx.raw + " pedido" + (ctx.raw!==1?"s":"");
              }
            }
          }
        },
        scales: {
          x: { grid:{color:gridColor}, ticks:{color:textColor, font:{size:11}} },
          y: {
            position: "left",
            grid: { color: gridColor },
            ticks: {
              color: textColor, font:{size:10},
              callback: function(v){ return "COP$ " + (v>=1000?Math.round(v/1000)+"k":v); }
            }
          },
          y2: {
            position: "right",
            grid: { drawOnChartArea: false },
            ticks: { color:"#06B6D4", font:{size:10}, stepSize:1 },
            min: 0,
          }
        }
      }
    });
  }

  if(typeof Chart !== "undefined"){
    drawChart();
  } else {
    let s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.js";
    s.onload = drawChart;
    document.head.appendChild(s);
  }
}

function _renderSuperTab(){
  let c=document.getElementById("sTB");if(!c)return;
  if(sTab==="stats"){
    let cl=USUARIOS.filter(function(u){return u.rol==="cliente";}).length;
    let ad=USUARIOS.filter(function(u){return u.rol==="administrador";}).length;
    let sinLeer=CONTACTOS.filter(function(m){return !m.leido;}).length;
    let pendientes=REPORTES.filter(function(r){return r.estado==="pendiente";}).length;
    let agotados=PRODS.filter(function(p){return p.st<=0;}).length;
    let enOferta=PRODS.filter(function(p){return p.o&&p.o<p.p&&p.st>0;}).length;
    c.innerHTML='<div class="sgrid">'+
      '<div class="sc"><div class="sn">'+cl+'</div><div class="sl">👥 Clientes</div></div>'+
      '<div class="sc"><div class="sn">'+ad+'</div><div class="sl">⚙️ Admins</div></div>'+
      '<div class="sc"><div class="sn">'+PRODS.filter(function(p){return p.st>0;}).length+'</div><div class="sl">📦 Disponibles</div></div>'+
      '<div class="sc '+(agotados>0?"sc-warn":"")+'"><div class="sn">'+agotados+'</div><div class="sl">🚫 Agotados</div></div>'+
      '<div class="sc '+(pendientes>0?"sc-warn":"")+'"><div class="sn">'+pendientes+'</div><div class="sl">🚨 Rep. Pendientes</div></div>'+
      '<div class="sc '+(sinLeer>0?"sc-warn":"")+'"><div class="sn">'+sinLeer+'</div><div class="sl">📬 Msgs Nuevos</div></div>'+
      '<div class="sc"><div class="sn">'+enOferta+'</div><div class="sl">🔥 En Oferta</div></div>'+
      '<div class="sc"><div class="sn">'+PRODS.length+'</div><div class="sl">🗂️ Total Prods.</div></div>'+
    '</div>'+
    _notifBanner(agotados,"producto agotado","productos agotados","#fff3e0","#ffb74d","setSTab(\"prods\",this)","Revisar inventario →")+
    _notifBanner(sinLeer,"mensaje sin leer","mensajes sin leer","#e8f5e9","#81c784","sTab='mensajes';renderSuperTab()","Ver mensajes →");
    // Load chart after DOM is painted
    setTimeout(renderVentasChart, 80);
  }else if(sTab==="users"){
    c.innerHTML='<div class="tw"><table><thead><tr><th>Nombre</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>'+USUARIOS.map(function(u){let bc=u.rol==="superadmin"?"bsu":u.rol==="administrador"?"ba":"bc";return '<tr><td><div style="display:flex;align-items:center;gap:8px"><div style="width:30px;height:30px;border-radius:50%;background:var(--am);color:var(--na3);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.8rem;flex-shrink:0">'+(u.n[0])+'</div><div><strong>'+u.n+' '+u.a+'</strong><br><small style="color:var(--gr)">'+u.email+'</small></div></div></td><td><span class="bdg '+bc+'">'+u.rol+'</span></td><td><span class="bdg '+(u.act?"bok":"bno")+'">'+(u.act?"✅":"❌")+'</span></td><td>'+(u.rol!=="superadmin"?'<select onchange="cambiarRol('+u.id+',this.value)" style="padding:3px 6px;border:1px solid #ddd;border-radius:5px;font-size:.75rem"><option value="cliente"'+(u.rol==="cliente"?" selected":"")+'>Cliente</option><option value="administrador"'+(u.rol==="administrador"?" selected":"")+'>Admin</option></select><button class="'+(u.act?"btd":"btok")+'" onclick="togUser('+u.id+')">'+(u.act?"🚫":"✅")+'</button>':'<em style="color:var(--gr);font-size:.8rem">Propietario</em>')+'</td></tr>';}).join("")+'</tbody></table></div>';
  }else if(sTab==="prods"){
    c.innerHTML='<div class="tabs" style="margin-bottom:14px"><button class="tab on" id="spTabList" onclick="sprodTab(\'list\',this)">📋 Lista</button><button class="tab" id="spTabAdd" onclick="sprodTab(\'add\',this)">➕ Agregar</button></div><div id="spBody"></div>';
    sprodTab("list",document.getElementById("spTabList"));
  }else if(sTab==="categorias"){
    _renderCategorias(c);
  }else if(sTab==="reportes"){
    if(!REPORTES.length){c.innerHTML='<div class="empty"><div class="eico">✅</div><h3>Sin reportes</h3></div>';return;}
    c.innerHTML='<div style="display:flex;flex-direction:column;gap:0">'+REPORTES.map(function(r){
      let estCls={pendiente:"rep-est-pendiente",en_revision:"rep-est-revision",resuelto:"rep-est-resuelto"}[r.estado]||"";
      let estLabel={pendiente:"⏳ Pendiente",en_revision:"🔄 Revisión",resuelto:"✅ Resuelto"}[r.estado]||r.estado;
      let ua=(r.uNom||"U")[0];
      return '<div class="rep-card">'+
        '<div class="rep-card-head"><div class="rep-user-ava">'+ua+'</div><div><strong style="font-size:.88rem">'+r.uNom+'</strong><br><small style="color:var(--gr)">'+r.fecha+'</small></div><span class="rep-tipo-badge">'+r.tipo+'</span><span class="rep-est-badge '+estCls+'">'+estLabel+'</span></div>'+
        '<div class="rep-card-body">'+(r.pNom&&r.pNom!=="General"?'<div class="rep-prod-tag">📦 '+r.pNom+'</div><br>':'')+
        '<div class="rep-desc-box">'+(r.desc||r.descripcion||"")+'</div>'+
        (r.respuesta?'<div class="rep-respuesta-box"><strong>💬 Respuesta ('+( r.respFecha||"")+'):</strong>'+r.respuesta+'</div>':'')+
        '<button class="bte" style="margin-top:8px" onclick="abrirRespRep('+r.id+')">💬 Responder</button>'+
        '</div></div>';
    }).join("")+'</div>';
  }else if(sTab==="mensajes"){
    if(!CONTACTOS.length){c.innerHTML='<div class="empty"><div class="eico">📬</div><h3>Sin mensajes</h3><p>Aún no hay mensajes de contacto.</p></div>';return;}
    let noLeidos=CONTACTOS.filter(function(m){return !m.leido;}).length;
    c.innerHTML='<div style="margin-bottom:12px;display:flex;align-items:center;gap:10px"><strong style="font-size:.9rem">📬 Bandeja de entrada</strong>'+(noLeidos?'<span style="background:linear-gradient(135deg,var(--na3),var(--na2));color:#fff;font-size:.72rem;font-weight:900;padding:3px 10px;border-radius:50px">'+noLeidos+' nuevo'+(noLeidos>1?'s':'')+'</span>':'')+'</div>'+
    '<div style="display:flex;flex-direction:column;gap:10px">'+CONTACTOS.map(function(m){
      let badge=m.leido?'<span style="background:#e8f5e9;color:#2e7d32;font-size:.7rem;font-weight:800;padding:3px 9px;border-radius:50px">✅ Leído</span>':'<span style="background:#fff3e0;color:#e65100;font-size:.7rem;font-weight:800;padding:3px 9px;border-radius:50px">🔔 Nuevo</span>';
      let asuntoLabel={"pedido":"📦 Pedido","producto":"🛍️ Producto","devolucion":"↩️ Devolución","pago":"💳 Pago","envio":"🚚 Envío","queja":"😟 Queja","otro":"💬 Otro"}[m.asunto]||m.asunto;
        let prioBadge=m.prioridad?'<span class="prio-badge-'+(m.prioridad||"normal")+"'>"+(m.prioridad==="urgente"?"🔴 Urgente":m.prioridad==="informativo"?"🔵 Info":"🟢 Normal")+"</span>":"";
      return '<div class="msg-card'+(m.leido?'':' unread')+'">'+
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;flex-wrap:wrap">'+
          '<div class="msg-avatar">'+(m.nombre||"?")[0].toUpperCase()+'</div>'+
          '<div style="flex:1;min-width:0"><strong style="font-size:.88rem">'+m.nombre+'</strong><br><small style="color:var(--gr)">'+m.email+(m.tel?' · '+m.tel:'')+'</small></div>'+
          badge+prioBadge+'<span style="background:#f5f5f5;color:var(--na3);font-size:.7rem;font-weight:800;padding:3px 9px;border-radius:50px">'+asuntoLabel+'</span>'+
        '</div>'+
        '<div style="background:#faf5f0;border-radius:10px;padding:10px 12px;font-size:.85rem;color:var(--bk);line-height:1.55;margin-bottom:8px">'+m.mensaje+'</div>'+
        '<div style="display:flex;gap:8px;align-items:center;justify-content:space-between">'+
          '<small style="color:var(--gr)">'+m.fecha+'</small>'+
          '<div style="display:flex;gap:6px">'+
            (!m.leido?'<button class="bte" onclick="marcarMensajeLeido('+m.id+')">✅ Marcar leído</button>':'')+
            '<a class="bte" href="mailto:'+m.email+'?subject=Re: '+m.asunto+'" style="text-decoration:none">📧 Responder</a>'+
            '<button class="btd" onclick="eliminarMensaje('+m.id+')">🗑️</button>'+
          '</div>'+
        '</div>'+
      '</div>';
    }).join("")+'</div>';
  }else if(sTab==="cupones"){
    api("/cupones").then(function(r){
      if(!r.ok){c.innerHTML='<div class="empty"><div class="eico">🎫</div><h3>Error cargando cupones</h3></div>';return;}
      let cps=r.cupones||[];
      let form='<div style="background:#EFF6FF;border:1.5px solid #93C5FD;border-radius:14px;padding:16px;margin-bottom:16px">'
        +'<div class="admin-form-title">➕ Nuevo Cupón</div>'
        +'<div class="f2">'
        +'<div class="fg"><label>Código *</label><input class="fc" id="cpCod" placeholder="VERANO20" style="text-transform:uppercase"/></div>'
        +'<div class="fg"><label>Tipo</label><select class="fc" id="cpTipo"><option value="porcentaje">% Porcentaje</option><option value="monto_fijo">COP$ Monto fijo</option></select></div>'
        +'</div>'
        +'<div class="f2">'
        +'<div class="fg"><label>Valor *</label><input class="fc" type="number" id="cpVal" placeholder="20"/></div>'
        +'<div class="fg"><label>Compra mínima</label><input class="fc" type="number" id="cpMin" placeholder="0"/></div>'
        +'</div>'
        +'<div class="fg"><label>Usos máximos</label><input class="fc" type="number" id="cpUsos" value="100"/></div>'
        +'<button class="bp" onclick="crearCupon()">🎫 Crear Cupón</button>'
        +'</div>';
      let tabla=cps.length
        ?'<div class="tw"><table><thead><tr><th>Código</th><th>Tipo</th><th>Valor</th><th>Usos</th><th>Estado</th><th></th></tr></thead><tbody>'
        +cps.map(function(cp){
          let val=cp.tipo==="porcentaje"?cp.valor+"%":"COP$ "+cp.valor.toLocaleString();
          return '<tr><td><strong>'+cp.codigo+'</strong></td><td>'+cp.tipo+'</td><td>'+val+'</td><td>'+cp.usos_actual+"/"+cp.usos_max+'</td>'
            +'<td><span class="bdg '+(cp.activo?"bok":"bno")+'">'+( cp.activo?"Activo":"Inactivo")+'</span></td>'
            +'<td><button class="btd" onclick="elimCupon('+cp.id+')">🗑️</button></td></tr>';
        }).join("")+'</tbody></table></div>'
        :'<div class="empty"><div class="eico">🎫</div><h3>Sin cupones</h3><p>Crea el primero arriba</p></div>';
      c.innerHTML=form+tabla;
    });
  }else if(sTab==="cadmin"){
    c.innerHTML='<div style="max-width:480px"><div class="f2"><div class="fg"><label>Nombre *</label><input class="fc" id="aNom" placeholder="Nombre"/></div><div class="fg"><label>Apellido *</label><input class="fc" id="aApe" placeholder="Apellido"/></div></div><div class="fg"><label>Email *</label><input class="fc" type="email" id="aEmail" placeholder="correo@ejemplo.com"/></div><div class="fg"><label>Contraseña *</label><input class="fc" type="password" id="aPass" placeholder="Mínimo 8 caracteres"/></div><button class="bp" onclick="crearAdmin()">➕ Crear Administrador</button></div>';
  }else{
    c.innerHTML='<div class="tw"><table><thead><tr><th>Fecha</th><th>Usuario</th><th>Acción</th><th>Detalle</th></tr></thead><tbody>'+LOGS.map(function(l){return '<tr><td style="color:var(--gr);font-size:.78rem;white-space:nowrap">'+l.f+'</td><td><strong>'+l.u+'</strong></td><td><code style="background:#f5f5f5;padding:2px 7px;border-radius:4px;font-size:.75rem">'+l.ac+'</code></td><td style="color:#555;font-size:.85rem">'+l.d+'</td></tr>';}).join("")+'</tbody></table></div>';
  }
}
function sprodTab(t,btn){document.querySelectorAll("#sTB .tabs .tab").forEach(function(b){b.classList.remove("on");});btn.classList.add("on");let sb=document.getElementById("spBody");if(!sb)return;if(t==="list"){sb.innerHTML='<div class="tw"><table><thead><tr><th>Img</th><th>Nombre</th><th>Precio</th><th>Stock</th><th>Acc.</th></tr></thead><tbody>'+PRODS.map(function(p){let thumb=p.img?'<img src="'+p.img+'" style="width:38px;height:38px;object-fit:cover;border-radius:6px;"/>':'<span style="font-size:1.3rem">'+emojiProd(p)+'</span>';let sc=p.st<=0?"#c62828":p.st<=10?"#f57f17":"#2e7d32";return '<tr><td>'+thumb+'</td><td><strong>'+p.n+'</strong><br><small style="color:var(--gr)">'+p.cat+'</small></td><td style="color:var(--na3);font-weight:700">'+bs(p.o||p.p)+'</td><td style="color:'+sc+';font-weight:800">'+p.st+(p.st<=0?" 🚫":p.st<=10?" ⚠️":"")+'</td><td><button class="bte" onclick="spEdit('+p.id+')">✏️</button><button class="btd" onclick="spElim('+p.id+')">🗑️</button>'+(p.img?'<button class="btd" style="background:#e3f2fd;color:#1565c0" onclick="elimFotoSp('+p.id+')">🖼️✕</button>':'')+'</td></tr>';}).join("")+'</tbody></table></div>';}else{let imgPv=(imgTempSuper||spNewPF.img)?'<img src="'+(imgTempSuper||spNewPF.img)+'" class="img-preview" id="spImgPrev"/>':'<div id="spImgPrev" style="display:none"></div>';let quitarFotoBtnSp=(spEditId&&(spNewPF.img||imgTempSuper))?'<button class="btd" style="margin-top:6px;font-size:.8rem" onclick="quitarFotoFormSuper()">🖼️✕ Quitar foto actual</button>':'';sb.innerHTML='<div class="f2"><div class="fg"><label>Nombre *</label><input class="fc" id="spNom" value="'+(spNewPF.n||"")+'"/></div><div class="fg"><label>Categoría</label><select class="fc" id="spCat">'+CATS.filter(function(c){return c.id>0;}).map(function(c){return '<option value="'+c.id+'"'+(c.id===spNewPF.cat?" selected":"")+'>'+c.n+'</option>';}).join("")+'</select></div></div><div class="fg"><label>Descripción</label><textarea class="fc" id="spDesc" rows="2" style="resize:vertical">'+(spNewPF.d||"")+'</textarea></div><div class="f2"><div class="fg"><label>Precio *</label><input class="fc" type="number" id="spPrecio" value="'+(spNewPF.p||"")+'" step="0.01"/></div><div class="fg"><label>Precio Oferta</label><input class="fc" type="number" id="spOferta" value="'+(spNewPF.o||"")+'" step="0.01"/></div></div><div class="f2"><div class="fg"><label>Stock *</label><input class="fc" type="number" id="spStock" value="'+(spNewPF.st||"")+'"/></div><div class="fg"><label>¿Destacado?</label><select class="fc" id="spDest"><option value="false">No</option><option value="true"'+(spNewPF.dest?" selected":"")+'>Sí ⭐</option></select></div></div><div class="fg"><label>📷 Foto</label>'+imgPv+quitarFotoBtnSp+'<div class="img-upload-area"><input type="file" accept="image/*" onchange="cargarImgSuper(event)"/><span style="font-size:2rem;display:block;margin-bottom:6px">📷</span><span style="font-size:.85rem;color:var(--gr)">'+(imgTempSuper||spNewPF.img?"Cambiar foto":"Subir foto")+'</span></div></div><button class="bp" onclick="spGuardar()">'+(spEditId?"💾 Guardar":"➕ Crear Producto")+'</button>'+(spEditId?'<button class="bs" onclick="spCancelar()">Cancelar</button>':"");}}
function cargarImgSuper(e){let file=e.target.files[0];if(!file)return;let r=new FileReader();r.onload=function(ev){imgTempSuper=ev.target.result;let prev=document.getElementById("spImgPrev");if(prev){prev.src=imgTempSuper;prev.style.display="block";prev.className="img-preview";}};r.readAsDataURL(file);}
function spEdit(id){let p=PRODS.find(function(x){return x.id===id;});if(!p)return;spEditId=id;imgTempSuper=p.img||null;spNewPF={n:p.n,d:p.d,p:p.p,o:p.o||"",st:p.st,cat:p.cid,dest:p.dest,img:p.img||null};sprodTab("add",document.getElementById("spTabAdd"));}
function spCancelar(){spEditId=null;imgTempSuper=null;spNewPF={n:"",d:"",p:"",o:"",st:"",cat:1,dest:false,img:null};sprodTab("list",document.getElementById("spTabList"));}
function spGuardar(){let n=document.getElementById("spNom").value.trim(),pr=parseFloat(document.getElementById("spPrecio").value),st=parseInt(document.getElementById("spStock").value);if(!n||isNaN(pr)||isNaN(st)){toast("Completa campos","e");return;}let cid=parseInt(document.getElementById("spCat").value),cat=CATS.find(function(c){return c.id===cid;}),catN=cat?cat.n.replace(/^\S+\s/,""):"General";let o=parseFloat(document.getElementById("spOferta").value)||null,dest=document.getElementById("spDest").value==="true",desc=document.getElementById("spDesc").value;let img=imgTempSuper||(spEditId?(PRODS.find(function(p){return p.id===spEditId;})||{}).img:null)||null;let wasEdit=spEditId;api(spEditId?"/productos/"+spEditId:"/productos",spEditId?"PUT":"POST",{n:n,d:desc,p:pr,o:o,st:st,cat:catN,cid:cid,dest:dest,img:img}).then(function(r){if(!r.ok){toast("Error","e");return;}spEditId=null;imgTempSuper=null;spNewPF={n:"",d:"",p:"",o:"",st:"",cat:1,dest:false,img:null};toast(wasEdit?"Actualizado ✅":"¡Creado! ✅","s");invalidateSCache(["prods"]);cargarDatos();sprodTab("list",document.getElementById("spTabList"));});}
function spElim(id){if(!confirm("¿Eliminar?"))return;api("/productos/"+id,"DELETE").then(function(r){if(!r.ok){toast("Error","e");return;}toast("Eliminado","i");invalidateSCache(["prods"]);cargarDatos();sprodTab("list",document.getElementById("spTabList"));});}
function elimFotoSp(pid){if(!confirm("¿Eliminar foto?"))return;api("/productos/"+pid+"/foto","PUT").then(function(r){if(!r.ok){toast("Error","e");return;}let p=PRODS.find(function(x){return x.id===pid;});if(p)p.img=null;toast("Foto eliminada ✅","s");cargarDatos();sprodTab("list",document.getElementById("spTabList"));});}
function cambiarRol(id,rol){api("/usuarios/"+id+"/rol","PUT",{rol:rol}).then(function(r){if(!r.ok){toast("Error","e");return;}toast("Rol actualizado → "+rol,"s");invalidateSCache(["users"]);renderSuperTab();});}
function togUser(id){api("/usuarios/"+id+"/toggle","PUT").then(function(r){if(!r.ok){toast("Error","e");return;}toast("Estado actualizado","i");invalidateSCache(["users"]);renderSuperTab();});}
function crearAdmin(){let n=document.getElementById("aNom").value.trim(),a=document.getElementById("aApe").value.trim(),e=document.getElementById("aEmail").value.trim().toLowerCase(),p=document.getElementById("aPass").value;if(!n||!a||!e||!p){toast("Completa todo","e");return;}if(p.length<8){toast("Contraseña mínimo 8","e");return;}api("/usuarios/admin","POST",{n:n,a:a,email:e,password:p}).then(function(r){if(!r.ok){toast(r.error||"Error","e");return;}toast("Admin "+n+" creado 👑","s");invalidateSCache(["users"]);sTab="users";buildSuper();});}

// ── INIT ─────────────────────────────────────
document.addEventListener("DOMContentLoaded",function(){
  // Mark active nav links
  // Sync paginaActual with PAGE from template
  paginaActual = typeof PAGE !== "undefined" ? PAGE : "inicio";
  const curPath = window.location.pathname;
  document.querySelectorAll('.dnav-btn,.btab').forEach(function(el){
    const href = el.getAttribute('href');
    if(href && href === curPath){
      el.classList.add('active','on');
    }
  });

  document.querySelectorAll(".anioActual").forEach(function(el){el.textContent=new Date().getFullYear();});

  // Overlay: cerrar al tocar fuera del modal
  document.querySelectorAll(".ov").forEach(function(ov){
    ov.addEventListener("click",function(e){if(e.target===ov)cerrarModal(ov.id);});
  });

  // Login: Enter key navigation
  let lPass=document.getElementById("lPass"),lEmail=document.getElementById("lEmail");
  if(lPass)lPass.addEventListener("keydown",function(e){if(e.key==="Enter")doLogin();});
  if(lEmail)lEmail.addEventListener("keydown",function(e){if(e.key==="Enter")lPass&&lPass.focus();});

  // Header scroll effect
  let hdr=document.getElementById("hdr");
  if(hdr){window.addEventListener("scroll",function(){hdr.classList.toggle("scrolled",window.scrollY>10);},{passive:true});}

  _loadSearchHistory();
  initSearch();
  mpInit();
  aplicarIdioma();
  aplicarDarkMode(DARK_MODE); // Apply saved dark mode preference
  // PAGE-AWARE: no redirect needed, already on correct page
  // Show loading skeleton while data loads
  let pI = document.getElementById("pInicio");
  if(pI && !PRODS.length){
    let sk = document.getElementById("skeletonLoader");
    if(!sk){
      sk = document.createElement("div");
      sk.id = "skeletonLoader";
      sk.style.cssText = "padding:60px 20px;text-align:center;color:var(--na3);font-size:1.1rem;font-weight:700;";
      sk.innerHTML = '<div style="font-size:3rem;margin-bottom:16px;animation:spin 1s linear infinite">🔄</div>Cargando productos...';
      pI.prepend(sk);
    }
  }

  // Restaurar carrito desde localStorage
  try{
    let carritoGuardado = localStorage.getItem("ns_carrito");
    if(carritoGuardado) carrito = JSON.parse(carritoGuardado);
  }catch(e){ carrito = []; }
  // Restaurar wishlist
  cargarWishlist();

  // Restaurar sesión desde localStorage al recargar
  let guardado = localStorage.getItem("ns_usuario");
  if(guardado){
    try{
      let u = JSON.parse(guardado);
      // PASO 1: Restaurar sesión INMEDIATAMENTE desde localStorage
      // Validar que los datos son coherentes
      if(!u.id||!u.n||!u.rol){localStorage.removeItem('ns_usuario');cargarDatos();return;}
      usuario = u;
      actualizarUI();
      aplicarIdioma();
      cargarDatos();
      // PASO 2: Verificar en background que el usuario sigue activo en el servidor
      api("/perfil/"+u.id,"GET").then(function(r){
        if(r.ok && r.perfil){
          // Actualizar con datos frescos del servidor
          usuario = {id:r.perfil.id, n:r.perfil.nombre, a:r.perfil.apellido,
                     email:r.perfil.email, rol:r.perfil.rol, avatar:r.perfil.avatar||""};
          localStorage.setItem("ns_usuario", JSON.stringify(usuario));
          actualizarUI(); // Refresca con datos actualizados
          if(!_mpYaCargo){ mpCargarDesdeDB(); _mpYaCargo=true; }
        } else {
          // Usuario desactivado o eliminado en el servidor
          usuario=null; carrito=[];
          localStorage.removeItem("ns_usuario");
          localStorage.removeItem("ns_carrito");
          actualizarUI();
          toast("Tu sesión ha expirado. Por favor inicia sesión de nuevo.", "e");
        }
      }).catch(function(){
        // Sin conexión: mantener sesión local (funciona offline)
        if(!_mpYaCargo){ mpCargarDesdeDB(); _mpYaCargo=true; }
      });
    }catch(e){
      localStorage.removeItem("ns_usuario");
      cargarDatos();
    }
  } else {
    cargarDatos();
  }
});

// ══════════════════════════════════════════════════════
//  REPRODUCTOR DE MÚSICA FLOTANTE — NuestroStore Music
// ══════════════════════════════════════════════════════
let mp = {
  audio: null,
  playlist: [],       // [{name, dur, url, objUrl}]
  current: -1,
  playing: false,
  shuffle: false,
  repeat: false,      // false | "one" | "all"
  muted: false,
  volume: 80,
  dragging: false,
  shuffleOrder: [],
  shuffleIdx: 0
};

function mpInit(){
  mp.audio = new Audio();
  mp.audio.volume = mp.volume / 100;

  mp.audio.addEventListener("timeupdate", mpOnTimeUpdate);
  mp.audio.addEventListener("ended", mpOnEnded);
  mp.audio.addEventListener("loadedmetadata", function(){
    let item = mp.playlist[mp.current];
    if(item) item.dur = mpFmtTime(mp.audio.duration);
    mpRenderPlaylist();
    mpUpdateDur();
  });
  mp.audio.addEventListener("error", function(){
    toast("No se pudo reproducir este archivo 🎵", "e");
    mpNext();
  });

  // Arrastrar barra de progreso
  let pb = document.getElementById("mpProgressBg");
  if(pb){
    pb.addEventListener("mousedown", function(e){ mp.dragging=true; mpSeek(e); });
    pb.addEventListener("touchstart", function(e){ mp.dragging=true; mpSeekTouch(e); }, {passive:true});
    document.addEventListener("mousemove", function(e){ if(mp.dragging) mpSeek(e); });
    document.addEventListener("touchmove", function(e){ if(mp.dragging) mpSeekTouch(e); }, {passive:true});
    document.addEventListener("mouseup", function(){ mp.dragging=false; });
    document.addEventListener("touchend", function(){ mp.dragging=false; });
  }

  // Actualizar gradiente del slider de volumen en tiempo real
  let vs = document.getElementById("mpVolSlider");
  if(vs) vs.addEventListener("input", function(){ mpUpdateVolGradient(); });

  mpUpdateVolGradient();
}

// ── Actualizar reproductor según sesión ──
function mpRefreshAuth(){
  let panel = document.getElementById("mpPanel");
  let wrap  = document.getElementById("musicPlayer");
  if(!panel || !wrap) return;

  if(usuario){
    // Mostrar el FAB colapsado al iniciar sesión (nunca abrir solo)
    wrap.classList.remove("mp-hidden");
    wrap.classList.add("mp-collapsed");
    // Usuario logueado: restaurar panel normal si estaba en modo locked
    if(panel.querySelector(".mp-locked")){
      panel.innerHTML = [
        '<div class="mp-header">',
        '  <div class="mp-header-left"><span class="mp-title-icon">🎶</span><span class="mp-title">Mi Música</span></div>',
        '  <div class="mp-header-right">',
        '    <button class="mp-hbtn" onclick="mpAddFiles()" title="Subir MP3/WAV">🎵</button>',
        '    <button class="mp-hbtn" onclick="mpAgregarYouTube()" title="Agregar de YouTube">🎬</button>',
        '    <button class="mp-hbtn" onclick="mpBuscarFMA()" title="Buscar música gratis">🔍</button>',
        '    <button class="mp-hbtn" onclick="mpToggle()" title="Minimizar">—</button>',
        '    <button class="mp-hbtn mp-hbtn-hide" onclick="mpHide()" title="Ocultar">✕</button>',
        '  </div>',
        '</div>',
        '<input type="file" id="mpFileInput" accept="audio/*" multiple style="display:none" onchange="mpLoadFiles(event)"/>',
        '<div class="mp-empty" id="mpEmpty">',
        '  <div class="mp-empty-ico">🎵</div>',
        '  <div class="mp-empty-txt">Agrega música</div>',
        '  <div class="mp-empty-btns">',
        '    <button class="mp-empty-btn" onclick="mpAddFiles()">🎵 Subir MP3</button>',
        '    <button class="mp-empty-btn mp-empty-btn-yt" onclick="mpAgregarYouTube()">🎬 YouTube</button>',
        '    <button class="mp-empty-btn mp-empty-btn-fma" onclick="mpBuscarFMA()">🔍 Buscar gratis</button>',
        '  </div>',
        '</div>',
        '<div id="mpNow" class="mp-now" style="display:none"></div>',
        '<div id="mpProgressWrap" class="mp-progress-wrap" style="display:none">',
        '  <div class="mp-progress-bg" id="mpProgressBg">',
        '    <div class="mp-progress-fill" id="mpProgressFill"></div>',
        '    <div class="mp-progress-thumb" id="mpProgressThumb"></div>',
        '  </div>',
        '</div>',
        '<div id="mpControls" class="mp-controls" style="display:none">',
        '  <button class="mp-ctrl-btn mp-ctrl-sm" id="mpShuffleBtn" onclick="mpToggleShuffle()" title="Aleatorio">⇄</button>',
        '  <button class="mp-ctrl-btn" onclick="mpPrev()" title="Anterior">⏮</button>',
        '  <button class="mp-ctrl-btn mp-play-btn" id="mpPlayBtn" onclick="mpTogglePlay()" title="Play/Pausa">▶</button>',
        '  <button class="mp-ctrl-btn" onclick="mpNext()" title="Siguiente">⏭</button>',
        '  <button class="mp-ctrl-btn mp-ctrl-sm" id="mpRepeatBtn" onclick="mpToggleRepeat()" title="Repetir">↻</button>',
        '</div>',
        '<div id="mpVolume" class="mp-volume" style="display:none">',
        '  <span class="mp-vol-ico" id="mpVolIco" onclick="mpToggleMute()">🔊</span>',
        '  <input type="range" class="mp-vol-slider" id="mpVolSlider" min="0" max="100" value="80" oninput="mpSetVolume(this.value)"/>',
        '</div>',
        '<div id="mpPlaylist" class="mp-playlist" style="display:none">',
        '  <div class="mp-pl-header"><span>Lista de reproducción</span><button class="mp-pl-clear" onclick="mpClear()">Limpiar</button></div>',
        '  <div class="mp-pl-list" id="mpPlList"></div>',
        '</div>'
      ].join("");
      // Re-bind progress bar events
      let pb = document.getElementById("mpProgressBg");
      if(pb){
        pb.addEventListener("mousedown", function(e){ mp.dragging=true; mpSeek(e); });
        pb.addEventListener("touchstart", function(e){ mp.dragging=true; mpSeekTouch(e); }, {passive:true});
      }
      let vs = document.getElementById("mpVolSlider");
      if(vs){ vs.value = mp.volume; vs.addEventListener("input", function(){ mpUpdateVolGradient(); }); }
      mpUpdateVolGradient();
    }
  } else {
    // Sin sesión: ocultar completamente el FAB
    wrap.classList.add("mp-hidden");
    wrap.classList.add("mp-collapsed");
    // Pausar música si estaba reproduciendo
    if(mp.audio && !mp.audio.paused){ mp.audio.pause(); }
  }
}

// ── Abrir/colapsar panel ──
function mpToggle(){
  let wrap = document.getElementById("musicPlayer");
  if(!wrap) return;
  // Si no hay usuario, mostrar estado bloqueado en lugar del panel
  if(!usuario){
    let panel = document.getElementById("mpPanel");
    if(panel){
      wrap.classList.toggle("mp-collapsed");
      mpRenderLocked();
    }
    return;
  }
  let wasCollapsed = wrap.classList.contains("mp-collapsed");
  wrap.classList.toggle("mp-collapsed");
  // Al abrir el panel, mostrar canciones si ya están cargadas
  if(wasCollapsed && mp.playlist.length > 0){
    mpShowPlayer();
    mpRenderPlaylist();
  }
}

// ── Mostrar mensaje de "inicia sesión" en el panel ──
function mpRenderLocked(){
  let panel = document.getElementById("mpPanel");
  if(!panel || usuario) return;
  if(document.getElementById("musicPlayer").classList.contains("mp-collapsed")) return;
  panel.innerHTML = [
    '<div class="mp-header">',
    '  <div class="mp-header-left"><span class="mp-title-icon">🎶</span><span class="mp-title">Mi Música</span></div>',
    '  <div class="mp-header-right">',
    '    <button class="mp-hbtn mp-hbtn-hide" onclick="mpHide()" title="Ocultar">✕</button>',
    '  </div>',
    '</div>',
    '<div class="mp-locked">',
    '  <div class="mp-locked-ico">🔒</div>',
    '  <div class="mp-locked-txt">Solo para usuarios registrados</div>',
    '  <div class="mp-locked-sub">Inicia sesión para agregar y reproducir tu música favorita</div>',
    '  <button class="mp-locked-btn" onclick="mpHide();abrirLogin()">🔐 Iniciar Sesión</button>',
    '</div>'
  ].join("");
}

// ── Ocultar completamente el reproductor ──
// ── Etiqueta del botón de música en el panel de perfil ──
function mpPerfilBtnLabel(){
  let wrap = document.getElementById("musicPlayer");
  let hidden = wrap && wrap.classList.contains("mp-hidden");
  if(hidden){
    return '<span>Reproductor oculto</span><span style="font-size:.75rem;background:#e8f5e9;color:#2e7d32;padding:2px 8px;border-radius:50px">Mostrar</span>';
  }
  return '<span>Reproductor visible</span><span style="font-size:.75rem;background:#fff0e0;color:var(--na3);padding:2px 8px;border-radius:50px">Ocultar</span>';
}

function mpPerfilToggle(){
  let wrap = document.getElementById("musicPlayer");
  if(!wrap) return;
  if(wrap.classList.contains("mp-hidden")){
    mpShow();
  } else {
    mpHide();
  }
  let btn = document.getElementById("mpPerfilBtn");
  if(btn) btn.innerHTML = mpPerfilBtnLabel();
}

function mpPanelBtnLabel(){
  let wrap = document.getElementById("musicPlayer");
  let hidden = wrap && wrap.classList.contains("mp-hidden");
  if(hidden){
    return '<span>🎵 Reproductor de música</span><span style="font-size:.75rem;background:#e8f5e9;color:#2e7d32;padding:2px 8px;border-radius:50px">Mostrar</span>';
  }
  return '<span>🎵 Reproductor de música</span><span style="font-size:.75rem;background:#fff0e0;color:var(--na3);padding:2px 8px;border-radius:50px">Ocultar</span>';
}

// ── Alternar visibilidad del reproductor desde el perfil ──
function mpPanelToggle(){
  let wrap = document.getElementById("musicPlayer");
  if(!wrap) return;
  if(wrap.classList.contains("mp-hidden")){
    mpShow();
  } else {
    mpHide();
  }
  // Actualizar el botón en tiempo real
  let btn = document.getElementById("mpPanelBtn");
  if(btn) btn.innerHTML = mpPanelBtnLabel();
}

function mpHide(){
  let wrap = document.getElementById("musicPlayer");
  if(!wrap) return;
  wrap.classList.add("mp-hidden");
  wrap.classList.add("mp-collapsed");
  // Sin botón flotante — se controla desde el perfil
}

// ── Mostrar de nuevo el reproductor ──
function mpShow(){
  let wrap = document.getElementById("musicPlayer");
  if(!wrap) return;
  wrap.classList.remove("mp-hidden");
}

// ── Abrir selector de archivos (solo si hay sesión) ──
function mpAddFiles(){
  if(!usuario){ toast("Inicia sesión para agregar música","e"); abrirModal("mLogin"); return; }
  let fi = document.getElementById("mpFileInput");
  if(fi) fi.click();
}

// ── Cargar archivos seleccionados ──
function mpLoadFiles(e){
  let files = Array.from(e.target.files || []);
  if(!files.length) return;

  let pending = 0, added = 0;
  files.forEach(function(f){
    if(!f.type.startsWith("audio/") && !/\.(mp3|wav|ogg|flac|aac|m4a|opus|weba)$/i.test(f.name)) return;
    pending++;
    let name = f.name.replace(/\.[^.]+$/, "");
    let reader = new FileReader();
    reader.onload = function(ev){
      let b64 = ev.target.result; // data:audio/...;base64,...
      // Guardar en BD si hay usuario
      if(usuario){
        api("/musica/"+usuario.id, "POST", {nombre:name, datos:b64, duracion:"--"}).then(function(r){
          if(r.ok){
            let objUrl = URL.createObjectURL(f);
            mp.playlist.push({id:r.id, name:name, dur:"—", url:objUrl, objUrl:objUrl, b64:b64});
          } else {
            // Sin BD, usar solo en memoria
            let objUrl = URL.createObjectURL(f);
            mp.playlist.push({name:name, dur:"—", url:objUrl, objUrl:objUrl});
          }
          added++;
          pending--;
          if(pending === 0) mpLoadFilesDone(added);
        }).catch(function(){
          let objUrl = URL.createObjectURL(f);
          mp.playlist.push({name:name, dur:"—", url:objUrl, objUrl:objUrl});
          added++; pending--;
          if(pending === 0) mpLoadFilesDone(added);
        });
      } else {
        let objUrl = URL.createObjectURL(f);
        mp.playlist.push({name:name, dur:"—", url:objUrl, objUrl:objUrl});
        added++; pending--;
        if(pending === 0) mpLoadFilesDone(added);
      }
    };
    reader.readAsDataURL(f);
  });

  e.target.value = "";
  if(pending === 0) toast("No se encontraron archivos de audio válidos","e");
}

function mpLoadFilesDone(added){
  if(!added){ toast("No se encontraron archivos de audio válidos","e"); return; }
  toast("+" + added + " canción" + (added>1?"es":"") + " agregada" + (added>1?"s":"") + " 🎵","s");
  mpShowPlayer();
  mpRenderPlaylist();
  if(mp.current < 0) mpPlay(0);
}

// ══════════════════════════════════════════
//  YOUTUBE EMBED — pegar link para reproducir
// ══════════════════════════════════════════
function mpAgregarYouTube(){
  let url = prompt("🎬 Pega el link de YouTube:\n(ej: https://youtube.com/watch?v=xxx)");
  if(!url) return;
  let vid = _ytExtractId(url);
  if(!vid){ toast("Link de YouTube no válido","e"); return; }
  let name = "YouTube — " + vid;
  mp.playlist.push({name:name, dur:"YT", url:null, ytId:vid, type:"youtube"});
  toast("Video de YouTube agregado 🎬","s");
  mpShowPlayer();
  mpRenderPlaylist();
  if(mp.current < 0) mpPlayYT(mp.playlist.length - 1);
}

function _ytExtractId(url){
  let m = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{11})/);
  return m ? m[1] : null;
}

function mpPlayYT(idx){
  // Pausar audio normal si está sonando
  if(mp.audio && !mp.audio.paused) mp.audio.pause();

  mp.current = idx;
  let item = mp.playlist[idx];
  if(!item || item.type !== "youtube") return;

  // Mostrar/ocultar el iframe de YouTube
  let ytWrap = document.getElementById("mpYTWrap");
  if(!ytWrap){
    ytWrap = document.createElement("div");
    ytWrap.id = "mpYTWrap";
    ytWrap.className = "mp-yt-wrap";
    let panel = document.getElementById("mpPanel");
    if(panel) panel.appendChild(ytWrap);
  }
  ytWrap.innerHTML =
    '<div class="mp-yt-label">🎬 ' + _escapeHtml(item.name.replace("YouTube — ","")) + '</div>' +
    '<div class="mp-yt-frame-wrap">' +
    '<iframe src="https://www.youtube.com/embed/' + item.ytId +
    '?autoplay=1&rel=0" frameborder="0" allow="autoplay; encrypted-media" allowfullscreen></iframe>' +
    '</div>' +
    '<button class="mp-yt-close" onclick="mpCerrarYT()">✕ Cerrar video</button>';
  ytWrap.style.display = "block";

  // Ocultar controles normales mientras hay YT activo
  ["mpNow","mpProgressWrap","mpControls","mpVolume"].forEach(function(id){
    let el = document.getElementById(id);
    if(el) el.style.display = "none";
  });

  mp.playing = true;
  mpRenderPlaylist();
  mpUpdateNowPlaying();
}

function mpCerrarYT(){
  let ytWrap = document.getElementById("mpYTWrap");
  if(ytWrap){ ytWrap.innerHTML = ""; ytWrap.style.display = "none"; }
  mp.playing = false;
  mp.current = -1;
  mpRenderPlaylist();
}

// ══════════════════════════════════════════
//  FREE MUSIC ARCHIVE — buscar música gratis
// ══════════════════════════════════════════
let _fmaResults = [];

function mpBuscarFMA(){
  let panel = document.getElementById("mpPanel");
  let existing = document.getElementById("mpFMAWrap");
  if(existing){ existing.remove(); return; }

  let wrap = document.createElement("div");
  wrap.id = "mpFMAWrap";
  wrap.className = "mp-fma-wrap";
  wrap.innerHTML =
    '<div class="mp-fma-header">' +
      '<span>🎵 Música Libre (Free Music Archive)</span>' +
      '<button class="mp-yt-close" onclick="document.getElementById('mpFMAWrap').remove()">✕</button>' +
    '</div>' +
    '<div class="mp-fma-search">' +
      '<input class="mp-fma-inp" id="mpFMAInp" placeholder="Buscar canción o artista..." ' +
             'onkeydown="if(event.key==='Enter')mpFMABuscar()"/>' +
      '<button class="mp-fma-btn" onclick="mpFMABuscar()">🔍</button>' +
    '</div>' +
    '<div class="mp-fma-genres">' +
      '<button class="mp-fma-genre" onclick="mpFMAGenero('Electronic')">⚡ Electronic</button>' +
      '<button class="mp-fma-genre" onclick="mpFMAGenero('Hip-Hop')">🎤 Hip-Hop</button>' +
      '<button class="mp-fma-genre" onclick="mpFMAGenero('Rock')">🎸 Rock</button>' +
      '<button class="mp-fma-genre" onclick="mpFMAGenero('Jazz')">🎷 Jazz</button>' +
      '<button class="mp-fma-genre" onclick="mpFMAGenero('Classical')">🎻 Clásica</button>' +
      '<button class="mp-fma-genre" onclick="mpFMAGenero('Ambient')">🌊 Ambient</button>' +
    '</div>' +
    '<div class="mp-fma-results" id="mpFMAResults">' +
      '<div class="mp-fma-hint">Busca una canción o selecciona un género 🎵</div>' +
    '</div>';

  if(panel) panel.appendChild(wrap);
}

function mpFMABuscar(){
  let inp = document.getElementById("mpFMAInp");
  let q = inp ? inp.value.trim() : "";
  if(!q){ toast("Escribe algo para buscar","e"); return; }
  _mpFMAFetch("https://freemusicarchive.org/api/get/tracks.json?per_page=10&api_key=60BLHNQCAOUFPIBZ&search=" + encodeURIComponent(q));
}

function mpFMAGenero(genero){
  _mpFMAFetch("https://freemusicarchive.org/api/get/tracks.json?per_page=10&api_key=60BLHNQCAOUFPIBZ&genre_title=" + encodeURIComponent(genero));
}

function _mpFMAFetch(url){
  let res = document.getElementById("mpFMAResults");
  if(res) res.innerHTML = '<div class="mp-fma-hint">Buscando... ⏳</div>';

  fetch(url)
    .then(function(r){ return r.json(); })
    .then(function(data){
      _fmaResults = (data.dataset || []).filter(function(t){ return t.track_file; });
      if(!_fmaResults.length){
        if(res) res.innerHTML = '<div class="mp-fma-hint">Sin resultados 😕 Intenta otra búsqueda</div>';
        return;
      }
      if(res) res.innerHTML = _fmaResults.map(function(t, i){
        return '<div class="mp-fma-item">' +
          '<div class="mp-fma-item-info">' +
            '<div class="mp-fma-item-name">' + _escapeHtml(t.track_title || "Sin título") + '</div>' +
            '<div class="mp-fma-item-artist">' + _escapeHtml(t.artist_name || "") + ' · ' + _escapeHtml((t.track_duration||"").slice(0,5)) + '</div>' +
          '</div>' +
          '<div class="mp-fma-item-btns">' +
            '<button class="mp-fma-add" onclick="mpFMAAgregar(' + i + ')">+ Lista</button>' +
            '<button class="mp-fma-play" onclick="mpFMATocar(' + i + ')">▶</button>' +
          '</div>' +
        '</div>';
      }).join("");
    })
    .catch(function(){
      if(res) res.innerHTML = '<div class="mp-fma-hint">❌ Error de conexión. La API de FMA puede estar caída.</div>';
    });
}

function mpFMATocar(idx){
  let t = _fmaResults[idx];
  if(!t) return;
  // Cerrar YT si estaba abierto
  mpCerrarYT();
  let item = {name: (t.track_title||"Sin título") + " — " + (t.artist_name||""), dur:"—", url: t.track_file, type:"mp3"};
  // Si ya existe en playlist, reproducir; si no, agregar y reproducir
  let existIdx = mp.playlist.findIndex(function(x){ return x.url === t.track_file; });
  if(existIdx >= 0){
    mpPlay(existIdx);
  } else {
    mp.playlist.push(item);
    mpShowPlayer();
    mpRenderPlaylist();
    mpPlay(mp.playlist.length - 1);
  }
  toast("▶ Reproduciendo: " + (t.track_title||"canción"),"s");
}

function mpFMAAgregar(idx){
  let t = _fmaResults[idx];
  if(!t) return;
  let exists = mp.playlist.some(function(x){ return x.url === t.track_file; });
  if(exists){ toast("Ya está en tu lista 👍","i"); return; }
  mp.playlist.push({name: (t.track_title||"Sin título") + " — " + (t.artist_name||""), dur:"—", url: t.track_file, type:"mp3"});
  toast("➕ Agregado a la lista: " + (t.track_title||"canción"),"s");
  mpShowPlayer();
  mpRenderPlaylist();
  if(mp.current < 0) mpPlay(mp.playlist.length - 1);
}



// ── Cargar playlist desde BD al iniciar sesión ──
let _mpCargando = false;
let _mpYaCargo = false;
function mpCargarDesdeDB(){
  if(!usuario) return;
  if(_mpCargando) return; // evitar llamadas simultáneas
  _mpCargando = true;
  api("/musica/"+usuario.id).then(function(r){
    _mpCargando = false;
    if(!r.ok || !r.tracks || !r.tracks.length) return;
    // Limpiar playlist antes de cargar para evitar duplicados
    mp.playlist.forEach(function(item){ if(item.objUrl) URL.revokeObjectURL(item.objUrl); });
    mp.playlist = [];
    mp.current = -1;
    let tracks = r.tracks;
    let loaded = 0;
    tracks.forEach(function(t){
      // Cargar datos del track
      api("/musica/"+usuario.id+"/"+t.id).then(function(tr){
        if(!tr.ok) return;
        let b64 = tr.track.datos;
        // Convertir base64 a blob URL
        try{
          let arr = b64.split(","), mime = arr[0].match(/:(.*?);/)[1];
          let bstr = atob(arr[1]), n = bstr.length, u8 = new Uint8Array(n);
          while(n--){ u8[n] = bstr.charCodeAt(n); }
          let blob = new Blob([u8], {type:mime});
          let objUrl = URL.createObjectURL(blob);
          mp.playlist.push({id:t.id, name:t.nombre, dur:t.duracion||"—", url:objUrl, objUrl:objUrl});
        }catch(ex){ return; }
        loaded++;
        if(loaded === tracks.length){
          // Solo mostrar UI si el panel está abierto
          let w = document.getElementById("musicPlayer");
          if(w && !w.classList.contains("mp-collapsed")){
            mpShowPlayer();
            mpRenderPlaylist();
          }
          toast("🎵 Playlist cargada ("+loaded+" canción"+(loaded>1?"es":"")+")", "i");
        }
      });
    });
  }).catch(function(){ _mpCargando = false; });
}

// ── Mostrar UI del reproductor ──
function mpShowPlayer(){
  document.getElementById("mpEmpty").style.display = "none";
  document.getElementById("mpNow").style.display = "flex";
  document.getElementById("mpProgressWrap").style.display = "block";
  document.getElementById("mpControls").style.display = "flex";
  document.getElementById("mpVolume").style.display = "flex";
  document.getElementById("mpPlaylist").style.display = "block";
}

// ── Reproducir canción por índice ──
function mpPlay(idx){
  if(idx < 0 || idx >= mp.playlist.length) return;
  if(mp.playlist[idx] && mp.playlist[idx].type === "youtube"){ mpPlayYT(idx); return; }
  let ytw = document.getElementById("mpYTWrap");
  if(ytw){ ytw.innerHTML=""; ytw.style.display="none"; }
  mp.current = idx;

  let item = mp.playlist[idx];
  mp.audio.src = item.url;
  mp.audio.load();
  mp.audio.play().then(function(){
    mp.playing = true;
    mpUpdateNowPlaying();
    mpSetPlayIcon(true);
    mpUpdateFab(true);
  }).catch(function(err){
    console.warn("Autoplay bloqueado:", err);
    mp.playing = false;
    mpSetPlayIcon(false);
  });
}

// ── Play / Pausa ──
function mpTogglePlay(){
  if(mp.playlist.length === 0){ mpAddFiles(); return; }
  if(mp.current < 0){ mpPlay(0); return; }

  if(mp.playing){
    mp.audio.pause();
    mp.playing = false;
    mpSetPlayIcon(false);
    mpUpdateFab(false);
  } else {
    mp.audio.play();
    mp.playing = true;
    mpSetPlayIcon(true);
    mpUpdateFab(true);
  }
}

// ── Siguiente ──
function mpNext(){
  if(!mp.playlist.length) return;
  let next;
  if(mp.shuffle){
    mp.shuffleIdx = (mp.shuffleIdx + 1) % mp.shuffleOrder.length;
    next = mp.shuffleOrder[mp.shuffleIdx];
  } else {
    next = (mp.current + 1) % mp.playlist.length;
  }
  mpPlay(next);
}

// ── Anterior ──
function mpPrev(){
  if(!mp.playlist.length) return;
  // Si llevamos más de 3s, rebobinar en lugar de ir atrás
  if(mp.audio.currentTime > 3){ mp.audio.currentTime = 0; return; }
  let prev;
  if(mp.shuffle){
    mp.shuffleIdx = (mp.shuffleIdx - 1 + mp.shuffleOrder.length) % mp.shuffleOrder.length;
    prev = mp.shuffleOrder[mp.shuffleIdx];
  } else {
    prev = (mp.current - 1 + mp.playlist.length) % mp.playlist.length;
  }
  mpPlay(prev);
}

// ── Al terminar canción ──
function mpOnEnded(){
  if(mp.repeat === "one"){
    mp.audio.currentTime = 0;
    mp.audio.play();
  } else if(mp.repeat === "all"){
    mpNext();
  } else if(mp.current < mp.playlist.length - 1){
    mpNext();
  } else {
    // Fin de playlist
    mp.playing = false;
    mpSetPlayIcon(false);
    mpUpdateFab(false);
  }
}

// ── Shuffle ──
function mpToggleShuffle(){
  mp.shuffle = !mp.shuffle;
  let btn = document.getElementById("mpShuffleBtn");
  if(btn) btn.classList.toggle("active", mp.shuffle);
  if(mp.shuffle){
    // Generar orden aleatorio
    mp.shuffleOrder = mp.playlist.map(function(_,i){return i;});
    for(let i = mp.shuffleOrder.length - 1; i > 0; i--){
      let j = Math.floor(Math.random() * (i+1));
      let tmp = mp.shuffleOrder[i]; mp.shuffleOrder[i]=mp.shuffleOrder[j]; mp.shuffleOrder[j]=tmp;
    }
    mp.shuffleIdx = mp.shuffleOrder.indexOf(mp.current);
    if(mp.shuffleIdx < 0) mp.shuffleIdx = 0;
    toast("Aleatorio activado 🔀","i");
  } else {
    toast("Aleatorio desactivado","i");
  }
}

// ── Repeat ──
function mpToggleRepeat(){
  let btn = document.getElementById("mpRepeatBtn");
  if(mp.repeat === false){
    mp.repeat = "all";
    if(btn){ btn.classList.add("active"); btn.textContent = "↻"; btn.title = "Repetir todo"; }
    toast("Repetir todo 🔁","i");
  } else if(mp.repeat === "all"){
    mp.repeat = "one";
    if(btn){ btn.classList.add("active"); btn.textContent = "🔂"; btn.title = "Repetir uno"; }
    toast("Repetir una canción 🔂","i");
  } else {
    mp.repeat = false;
    if(btn){ btn.classList.remove("active"); btn.textContent = "↻"; btn.title = "Repetir"; }
    toast("Repetición desactivada","i");
  }
}

// ── Seek ──
function mpSeek(e){
  let bg = document.getElementById("mpProgressBg");
  if(!bg) return;
  let rect = bg.getBoundingClientRect();
  let x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
  let pct = x / rect.width;
  if(mp.audio.duration){ mp.audio.currentTime = pct * mp.audio.duration; }
}
function mpSeekTouch(e){
  if(e.touches && e.touches[0]) mpSeek(e.touches[0]);
}

// ── Actualizar barra de progreso ──
function mpOnTimeUpdate(){
  if(mp.dragging) return;
  let fill = document.getElementById("mpProgressFill");
  let thumb = document.getElementById("mpThumb");
  let cur = document.getElementById("mpCurTime");
  if(!fill || !mp.audio.duration) return;
  let pct = (mp.audio.currentTime / mp.audio.duration) * 100;
  fill.style.width = pct + "%";
  if(thumb) thumb.style.left = pct + "%";
  if(cur) cur.textContent = mpFmtTime(mp.audio.currentTime);
}

// ── Volumen ──
function mpSetVolume(val){
  mp.volume = parseInt(val);
  mp.audio.volume = mp.volume / 100;
  mp.muted = false;
  mp.audio.muted = false;
  mpUpdateVolIcon();
  mpUpdateVolGradient();
}
function mpToggleMute(){
  mp.muted = !mp.muted;
  mp.audio.muted = mp.muted;
  mpUpdateVolIcon();
}
function mpUpdateVolIcon(){
  let ico = document.getElementById("mpVolIco");
  if(!ico) return;
  if(mp.muted || mp.volume === 0) ico.textContent = "🔇";
  else if(mp.volume < 40) ico.textContent = "🔈";
  else if(mp.volume < 70) ico.textContent = "🔉";
  else ico.textContent = "🔊";
}
function mpUpdateVolGradient(){
  let vs = document.getElementById("mpVolSlider");
  if(!vs) return;
  let pct = vs.value + "%";
  vs.style.background = "linear-gradient(90deg,var(--na) " + pct + ",#e0d0c4 " + pct + ")";
}

// ── Actualizar NOW PLAYING ──
function mpUpdateNowPlaying(){
  let item = mp.playlist[mp.current];
  if(!item) return;
  let nm = document.getElementById("mpTrackName");
  let art = document.getElementById("mpArt");
  if(nm) nm.textContent = item.name;
  if(art){ art.textContent = "🎵"; art.style.borderRadius = "12px"; }
  document.getElementById("mpPlayerWrap") && document.getElementById("mpPlayerWrap").classList.add("mp-playing");
  let panel = document.getElementById("mpPanel");
  if(panel) panel.classList.add("mp-playing");
  mpUpdateDur();
  mpRenderPlaylist();
}
function mpUpdateDur(){
  let total = document.getElementById("mpTotalTime");
  if(total && mp.audio.duration) total.textContent = mpFmtTime(mp.audio.duration);
}

// ── Íconos play/pausa ──
function mpSetPlayIcon(playing){
  let btn = document.getElementById("mpPlayBtn");
  if(btn) btn.textContent = playing ? "⏸" : "▶";
}

// ── FAB: mostrar ondas o nota ──
function mpUpdateFab(playing){
  let ico = document.getElementById("mpFabIco");
  let waves = document.getElementById("mpWaves");
  if(playing){
    if(ico) ico.style.display = "none";
    if(waves) waves.style.display = "flex";
  } else {
    if(ico){ ico.style.display = ""; ico.textContent = "🎵"; }
    if(waves) waves.style.display = "none";
  }
}

// ── Renderizar lista ──
function mpRenderPlaylist(){
  let list = document.getElementById("mpPlList");
  if(!list) return;
  if(!mp.playlist.length){ list.innerHTML = "<div style='text-align:center;padding:16px;color:#ccc;font-size:.8rem'>Sin canciones</div>"; return; }
  list.innerHTML = mp.playlist.map(function(item, i){
    let active = i === mp.current ? " active" : "";
    return "<div class='mp-pl-item" + active + "' onclick='mpPlay(" + i + ")'>" +
      "<span class='mp-pl-num'>" + (i+1) + "</span>" +
      "<span class='mp-pl-ico'>" + (i === mp.current && mp.playing ? "🔊" : (item.type==="youtube"?"🎬":item.type==="mp3"&&!item.objUrl?"🌐":"🎵")) + "</span>" +
      "<div class='mp-pl-info'>" +
        "<div class='mp-pl-name' title='" + item.name.replace(/'/g,"&#39;") + "'>" + item.name + "</div>" +
        "<div class='mp-pl-dur'>" + item.dur + "</div>" +
      "</div>" +
      "<button class='mp-pl-del' onclick='event.stopPropagation();mpRemove(" + i + ")' title='Quitar'>✕</button>" +
    "</div>";
  }).join("");
}

// ── Quitar canción de playlist ──
function mpRemove(idx){
  let item = mp.playlist[idx];
  if(item && item.objUrl) URL.revokeObjectURL(item.objUrl);
  // Eliminar de BD si tiene id
  if(item && item.id && usuario){
    api("/musica/"+usuario.id+"/"+item.id, "DELETE").catch(function(){});
  }
  mp.playlist.splice(idx, 1);

  if(!mp.playlist.length){
    // Playlist vacía
    mp.audio.pause();
    mp.audio.src = "";
    mp.current = -1;
    mp.playing = false;
    mpSetPlayIcon(false);
    mpUpdateFab(false);
    document.getElementById("mpEmpty").style.display = "block";
    document.getElementById("mpNow").style.display = "none";
    document.getElementById("mpProgressWrap").style.display = "none";
    document.getElementById("mpControls").style.display = "none";
    document.getElementById("mpVolume").style.display = "none";
    document.getElementById("mpPlaylist").style.display = "none";
    return;
  }

  if(idx === mp.current){
    // Era la canción actual
    if(mp.current >= mp.playlist.length) mp.current = 0;
    mpPlay(mp.current);
  } else if(idx < mp.current){
    mp.current--;
  }
  mpRenderPlaylist();
  toast("Canción eliminada 🗑️","i");
}

// ── Borrar todo ──
function mpClear(){ mpClearAll(); }
function mpClearAll(){
  if(!mp.playlist.length) return;
  if(!confirm("¿Borrar toda la lista de reproducción?")) return;
  mp.playlist.forEach(function(item){
    if(item.objUrl) URL.revokeObjectURL(item.objUrl);
    if(item.id && usuario){
      api("/musica/"+usuario.id+"/"+item.id, "DELETE").catch(function(){});
    }
  });
  mp.playlist = [];
  mp.current = -1;
  mp.playing = false;
  mp.audio.pause();
  mp.audio.src = "";
  mpSetPlayIcon(false);
  mpUpdateFab(false);
  document.getElementById("mpEmpty").style.display = "block";
  document.getElementById("mpNow").style.display = "none";
  document.getElementById("mpProgressWrap").style.display = "none";
  document.getElementById("mpControls").style.display = "none";
  document.getElementById("mpVolume").style.display = "none";
  document.getElementById("mpPlaylist").style.display = "none";
  toast("Lista borrada 🗑️","i");
}

// ── Utilidad: formatear tiempo ──
function mpFmtTime(secs){
  if(!secs || isNaN(secs)) return "0:00";
  let m = Math.floor(secs / 60);
  let s = Math.floor(secs % 60);
  return m + ":" + (s < 10 ? "0" : "") + s;
}

// ── CONTACTO ─────────────────────────────────────────────────────────────────
function actualizarContador(){
  let ta=document.getElementById("cfMensaje");
  let cnt=document.getElementById("cfCharCount");
  if(!ta||!cnt)return;
  let n=ta.value.length,max=500;
  cnt.textContent=n+" / "+max;
  cnt.style.color=n>450?"#c62828":n>350?"#e65100":"var(--gr)";
}

function autocompletarContacto(){
  if(!usuario)return;
  let nm=document.getElementById("cfNombre"),em=document.getElementById("cfEmail"),tel=document.getElementById("cfTel");
  if(nm&&!nm.value)nm.value=(usuario.n||"")+" "+(usuario.a||"");
  if(em&&!em.value)em.value=usuario.email||"";
  if(tel&&!tel.value&&usuario.tel)tel.value=usuario.tel;
  let note=document.getElementById("cfLoginNote"),txt=document.getElementById("cfLoginNoteText");
  if(note){note.style.display="flex";}
  if(txt)txt.textContent="✨ Datos completados con tu cuenta";
}

function enviarContacto(){
  let nombre  = (document.getElementById("cfNombre")||{}).value||"";
  let email   = (document.getElementById("cfEmail")||{}).value||"";
  let tel     = (document.getElementById("cfTel")||{}).value||"";
  let asunto  = (document.getElementById("cfAsunto")||{}).value||"";
  let mensaje = (document.getElementById("cfMensaje")||{}).value||"";
  let prioEl  = document.querySelector('input[name="cfPrioridad"]:checked');
  let prioridad = prioEl ? prioEl.value : "normal";
  let errEl   = document.getElementById("cfErr");
  let okEl    = document.getElementById("cfOk");

  errEl.style.display="none";
  okEl.style.display="none";

  if(!nombre.trim()){errEl.textContent="Por favor escribe tu nombre.";errEl.style.display="block";return;}
  if(!email.trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){errEl.textContent="Escribe un correo electrónico válido.";errEl.style.display="block";return;}
  if(!asunto){errEl.textContent="Selecciona un asunto para tu mensaje.";errEl.style.display="block";return;}
  if(!mensaje.trim()||mensaje.trim().length<10){errEl.textContent="El mensaje debe tener al menos 10 caracteres.";errEl.style.display="block";return;}

  let btn=document.querySelector(".contact-send-btn");
  if(btn){btn.disabled=true;btn.textContent="Enviando…";}

  let payload={nombre:nombre.trim(),email:email.trim().toLowerCase(),tel:tel.trim(),asunto:asunto,mensaje:mensaje.trim(),prioridad:prioridad};

  api("/contactos","POST",payload)
    .then(function(r){
      if(btn){btn.disabled=false;btn.textContent="📨 Enviar Mensaje →";}
      if(!r.ok){errEl.textContent=r.error||"Error al enviar. Intenta de nuevo.";errEl.style.display="block";return;}
      okEl.style.display="block";
      document.getElementById("cfNombre").value="";
      document.getElementById("cfEmail").value="";
      document.getElementById("cfTel").value="";
      document.getElementById("cfAsunto").value="";
      document.getElementById("cfMensaje").value="";
      actualizarContador();
      let prio=document.querySelector('input[name="cfPrioridad"][value="normal"]');
      if(prio)prio.checked=true;
      toast("Mensaje enviado correctamente ✅","s");
    })
    .catch(function(){
      if(btn){btn.disabled=false;btn.textContent="📨 Enviar Mensaje →";}
      errEl.textContent="Error de conexión. Intenta de nuevo.";
      errEl.style.display="block";
    });
}

function toggleFaq(el){
  let isOpen = el.classList.contains("open");
  document.querySelectorAll(".cfaq-item").forEach(function(i){i.classList.remove("open");});
  if(!isOpen) el.classList.add("open");
}

// ── MENSAJES DE CONTACTO (helpers) ────────────────────────────
function marcarMensajeLeido(id){
  api("/contactos/"+id+"/leer","PUT").then(function(r){
    if(!r.ok){toast("Error","e");return;}
    let m=CONTACTOS.find(function(x){return x.id===id;});
    if(m)m.leido=1;
    toast("Marcado como leído ✅","s");
    if(aTab==="mensajes")renderAdminTab();
    if(sTab==="mensajes")renderSuperTab();
  });
}
function eliminarMensaje(id){
  if(!confirm("¿Eliminar este mensaje?"))return;
  api("/contactos/"+id+"/eliminar","DELETE").then(function(r){
    if(!r.ok){toast("Error","e");return;}
    CONTACTOS=CONTACTOS.filter(function(x){return x.id!==id;});
    toast("Mensaje eliminado","i");
    if(aTab==="mensajes")renderAdminTab();
    if(sTab==="mensajes")renderSuperTab();
  });
}

// ── CHAT DE SOPORTE ──────────────────────────────────────────
let _chatTimer  = null;
let _chatActivo = false;
let _chatUid    = null;

function abrirChatSoporte(){
  if(!usuario){ toast("Inicia sesión para usar el chat","e"); return; }
  _chatUid    = usuario.id;
  _chatActivo = true;
  _renderChatWidget();
  _chatPoll();
}

function cerrarChatSoporte(){
  _chatActivo = false;
  if(_chatTimer){ clearInterval(_chatTimer); _chatTimer = null; }
  let w = document.getElementById("chatWidget");
  if(w){ w.classList.remove("chat-open"); setTimeout(function(){ w.remove(); }, 300); }
}

function _chatPoll(){
  if(!_chatActivo) return;
  _cargarMensajesChat();
  if(_chatTimer) clearInterval(_chatTimer);
  _chatTimer = setInterval(function(){
    if(_chatActivo) _cargarMensajesChat();
    else clearInterval(_chatTimer);
  }, 4000); // Poll every 4 seconds
}

function _cargarMensajesChat(){
  if(!_chatUid || !_chatActivo) return;
  fetch("/api/chat?uid=" + _chatUid)
    .then(function(r){ return r.json(); })
    .then(function(r){
      if(!r.ok) return;
      _renderMensajesChat(r.mensajes || []);
    })
    .catch(function(){});
}

function _renderChatWidget(){
  let existing = document.getElementById("chatWidget");
  if(existing) existing.remove();

  let w = document.createElement("div");
  w.id = "chatWidget";
  w.className = "chat-widget";
  w.innerHTML =
    '<div class="chat-header">'
    + '<div class="chat-header-info">'
    + '  <div class="chat-avatar">💬</div>'
    + '  <div>'
    + '    <div class="chat-header-name">Soporte NuestroStore</div>'
    + '    <div class="chat-header-status"><span class="chat-dot"></span> En línea</div>'
    + '  </div>'
    + '</div>'
    + '<button class="chat-close" onclick="cerrarChatSoporte()" title="Cerrar">✕</button>'
    + '</div>'
    + '<div class="chat-messages" id="chatMessages">'
    + '  <div class="chat-msg chat-msg-soporte">'
    + '    <div class="chat-bubble">¡Hola ' + usuario.n + '! 👋<br>¿En qué podemos ayudarte hoy?</div>'
    + '    <div class="chat-time">Soporte</div>'
    + '  </div>'
    + '</div>'
    + '<div class="chat-input-wrap">'
    + '  <input class="chat-input" id="chatInput" placeholder="Escribe tu mensaje…" autocomplete="off"'
    + '    onkeydown="if(event.key===\'Enter\'&&!event.shiftKey){event.preventDefault();enviarMensajeChat();}"'
    + '  />'
    + '  <button class="chat-send" onclick="enviarMensajeChat()" title="Enviar">➤</button>'
    + '</div>';

  document.body.appendChild(w);
  requestAnimationFrame(function(){ w.classList.add("chat-open"); });
  document.getElementById("chatInput").focus();
}

function _renderMensajesChat(mensajes){
  let box = document.getElementById("chatMessages");
  if(!box) return;
  if(!mensajes.length) return;

  // Keep welcome message, rebuild the rest
  let welcome = box.querySelector(".chat-msg-soporte");
  box.innerHTML = "";
  if(welcome) box.appendChild(welcome);

  mensajes.forEach(function(m){
    let esCliente = m.remitente === "cliente";
    let div = document.createElement("div");
    div.className = "chat-msg " + (esCliente ? "chat-msg-cliente" : "chat-msg-soporte");
    div.innerHTML =
      '<div class="chat-bubble">' + _escapeHtml(m.mensaje) + '</div>'
      + '<div class="chat-time">'
      + (esCliente ? "Tú" : "Soporte")
      + ' · ' + (m.fecha || "").slice(11, 16)
      + '</div>';
    box.appendChild(div);
  });

  // Scroll to bottom
  box.scrollTop = box.scrollHeight;
}

function enviarMensajeChat(){
  let inp = document.getElementById("chatInput");
  if(!inp) return;
  let msg = inp.value.trim();
  if(!msg || !_chatUid) return;

  // Optimistic UI
  inp.value = "";
  let box = document.getElementById("chatMessages");
  if(box){
    let div = document.createElement("div");
    div.className = "chat-msg chat-msg-cliente";
    div.innerHTML = '<div class="chat-bubble">' + _escapeHtml(msg) + '</div>'
      + '<div class="chat-time">Tú · enviando…</div>';
    box.appendChild(div);
    box.scrollTop = box.scrollHeight;
  }

  fetch("/api/chat", {
    method: "POST",
    headers: {"Content-Type": "application/json"},
    body: JSON.stringify({uid: _chatUid, mensaje: msg, remitente: "cliente"})
  }).then(function(r){ return r.json(); })
    .then(function(r){
      if(r.ok) _cargarMensajesChat(); // Refresh to get server timestamp
    });
}

function _escapeHtml(s){
  return String(s)
    .replace(/&/g,"&amp;")
    .replace(/</g,"&lt;")
    .replace(/>/g,"&gt;")
    .replace(/"/g,"&quot;");
}

// ── CHAT ADMIN — responder desde el panel ─────────────────────
let _chatAdminUid   = null;
let _chatAdminTimer = null;

function abrirChatAdmin(uid, nombre){
  _chatAdminUid = uid;
  let c = document.getElementById("aTB") || document.getElementById("sTB");
  if(!c) return;
  // Mark client messages as read
  fetch("/api/chat?uid="+uid).then(function(r){ return r.json(); }).then(function(r){
    _renderChatAdmin(r.mensajes || [], nombre, c);
    if(_chatAdminTimer) clearInterval(_chatAdminTimer);
    _chatAdminTimer = setInterval(function(){
      fetch("/api/chat?uid="+uid).then(function(r){ return r.json(); }).then(function(r){
        if(r.ok) _renderChatAdmin(r.mensajes || [], nombre, document.getElementById("chatAdminBox"));
      });
    }, 5000);
  });
}

function _renderChatAdmin(mensajes, nombre, container){
  let box = typeof container === "string"
    ? document.getElementById(container)
    : (container.id === "chatAdminBox" ? container : null);

  // If rendering into the full tab container
  if(!box || box.id !== "chatAdminBox"){
    let wrap = container || document.getElementById("aTB") || document.getElementById("sTB");
    if(!wrap) return;
    wrap.innerHTML =
      '<div style="display:flex;align-items:center;gap:10px;margin-bottom:14px">'
      + '<button class="bte" onclick="if(_chatAdminTimer)clearInterval(_chatAdminTimer);renderAdminTab&&renderAdminTab();renderSuperTab&&renderSuperTab()">← Volver</button>'
      + '<strong style="font-size:.95rem">💬 Chat con ' + nombre + '</strong>'
      + '</div>'
      + '<div class="chat-admin-box" id="chatAdminBox" style="height:320px;overflow-y:auto;border:1.5px solid #E2E8F0;border-radius:14px;padding:14px;display:flex;flex-direction:column;gap:10px;margin-bottom:12px">'
      + '</div>'
      + '<div style="display:flex;gap:8px">'
      + '<input class="fc" id="chatAdminInput" placeholder="Responder…" style="flex:1"'
      + '  onkeydown="if(event.key===\'Enter\')enviarRespuestaAdmin()"/>'
      + '<button class="bp" style="padding:10px 18px;white-space:nowrap" onclick="enviarRespuestaAdmin()">Enviar ➤</button>'
      + '</div>';
    box = document.getElementById("chatAdminBox");
  }

  if(!box) return;
  box.innerHTML = "";
  if(!mensajes.length){
    box.innerHTML = '<div style="text-align:center;color:var(--gr);padding:20px">Sin mensajes aún</div>';
    return;
  }
  mensajes.forEach(function(m){
    let esCliente = m.remitente === "cliente";
    let div = document.createElement("div");
    div.style.cssText = "display:flex;flex-direction:column;" + (esCliente ? "align-items:flex-start" : "align-items:flex-end");
    div.innerHTML =
      '<div style="max-width:80%;background:' + (esCliente ? "#EFF6FF" : "#F0FDF4")
      + ';color:' + (esCliente ? "#1E3A8A" : "#166534")
      + ';padding:9px 13px;border-radius:' + (esCliente ? "4px 14px 14px 14px" : "14px 4px 14px 14px")
      + ';font-size:.87rem;line-height:1.5">'
      + _escapeHtml(m.mensaje) + '</div>'
      + '<div style="font-size:.68rem;color:var(--gr);margin-top:2px">'
      + (esCliente ? (m.uNom || "Cliente") : "Soporte") + ' · ' + (m.fecha || "").slice(11,16)
      + '</div>';
    box.appendChild(div);
  });
  box.scrollTop = box.scrollHeight;
}

function enviarRespuestaAdmin(){
  let inp = document.getElementById("chatAdminInput");
  if(!inp || !_chatAdminUid) return;
  let msg = inp.value.trim();
  if(!msg) return;
  inp.value = "";
  fetch("/api/chat",{
    method:"POST",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({uid:_chatAdminUid, mensaje:msg, remitente:"soporte"})
  }).then(function(r){ return r.json(); }).then(function(r){
    if(r.ok){
      fetch("/api/chat?uid="+_chatAdminUid).then(function(r){return r.json();}).then(function(r){
        if(r.ok) _renderChatAdmin(r.mensajes||[], "", document.getElementById("chatAdminBox"));
      });
    }
  });
}
