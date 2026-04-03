// NuestroStore v9 — app.js
var PRODS=[],CATS=[{id:0,n:"🏷️ Todos"}],RESENIAS={},REPORTES=[],LOGS=[],PEDIDOS=[],USUARIOS=[];
var usuario=null,carrito=[],wishlist=[],catActiva=0,busqueda="",sortActivo="def";
var filtroPrecioMin=0,filtroPrecioMax=Infinity,filtroRating=0,filtroSoloOfertas=false;
var aTab="productos",sTab="stats",editId=null,newPF={n:"",d:"",p:"",o:"",st:"",cat:1,dest:false,img:null};
var CONTACTOS=[];
var contFact=1000,paginaActual="inicio",starSelVal=5;
var imgTempAdmin=null,imgTempSuper=null,spEditId=null,spNewPF={n:"",d:"",p:"",o:"",st:"",cat:1,dest:false,img:null};
var swTimer=null;

// Imágenes de muestra por categoría
var EMOJIS_CAT={"tecnología":"💻","ropa":"👗","zapatos":"👟","hogar":"🏠","juguetes":"🧸","alimentos":"🍎","deportes":"⚽","belleza":"💄","libros":"📚","electrodomésticos":"🏠","muebles":"🪑","mascotas":"🐾"};
function emojiProd(p){
  var cat=(p.cat||"").toLowerCase();
  for(var k in EMOJIS_CAT){if(cat.indexOf(k)>=0)return EMOJIS_CAT[k];}
  var letters=["🛍️","📦","🎁","✨","🌟","💎","🔑","🎯","🛒","💡"];
  return letters[p.id%letters.length]||"📦";
}

// ── API ─────────────────────────────────────
async function api(path,method,body){
  try{
    var opts={method:method||"GET",headers:{"Content-Type":"application/json"}};
    if(body) opts.body=JSON.stringify(body);
    var res=await fetch("/api"+path,opts);
    var data=await res.json();
    if(!res.ok&&!data.error) data.error="Error ("+res.status+")";
    return data;
  }catch(e){return{ok:false,error:"Error de conexión."};}
}
// ── MONEDA E IDIOMA ──────────────────────────
var LANG = "es";
var CURRENCY = localStorage.getItem("ns_currency") || "COP";
var DARK_MODE = localStorage.getItem("ns_dark") === "1";
var CURRENCIES = {
  VES:{name:"Bolívares",symbol:"Bs.",rate:1,locale:"es-VE"},
  USD:{name:"Dólares",symbol:"$",rate:0.000028,locale:"en-US"},
  COP:{name:"Pesos Col.",symbol:"COP$",rate:115,locale:"es-CO"},
  PEN:{name:"Soles",symbol:"S/.",rate:0.000104,locale:"es-PE"},
  MXN:{name:"Pesos Mex.",symbol:"MX$",rate:0.00048,locale:"es-MX"},
  ARS:{name:"Pesos Arg.",symbol:"AR$",rate:0.028,locale:"es-AR"},
  CLP:{name:"Pesos Chil.",symbol:"CL$",rate:0.026,locale:"es-CL"},
  BRL:{name:"Reales",symbol:"R$",rate:0.000145,locale:"pt-BR"}
};
var T={
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
  var cur=CURRENCIES[CURRENCY]||CURRENCIES.VES;
  var conv=Number(n)*cur.rate;
  if(CURRENCY==="VES") return cur.symbol+" "+conv.toLocaleString("es-VE",{minimumFractionDigits:2,maximumFractionDigits:2});
  return cur.symbol+" "+conv.toLocaleString(cur.locale,{minimumFractionDigits:2,maximumFractionDigits:2});
}
// setLang eliminado — idioma fijo en español
function setCurrency(cur){
  CURRENCY=cur;localStorage.setItem("ns_currency",cur);
  if(PRODS.length){renderInicio();if(paginaActual==="tienda")renderProds();}
  actualizarCarrito();
}
function aplicarIdioma(){
  // Idioma fijo en español — solo actualiza UI estática si hace falta
  actualizarLangUI();
}

// ── PÁGINAS ──────────────────────────────────
function irPagina(pg){
  paginaActual=pg;
  var ids={inicio:"pInicio",tienda:"pTienda",contacto:"pContacto"};
  Object.keys(ids).forEach(function(k){var el=document.getElementById(ids[k]);if(el)el.className=k===pg?"pagina active":"pagina";});
  document.querySelectorAll(".btab").forEach(function(b){b.classList.remove("on");var l=b.querySelector(".iline");if(l)l.style.display="none";});
  var bmap={inicio:"bt0",tienda:"bt1",contacto:"bt4"};
  if(bmap[pg]){var btn=document.getElementById(bmap[pg]);if(btn){btn.classList.add("on");var l=btn.querySelector(".iline");if(l)l.style.display="block";}}
  document.querySelectorAll(".dnav-btn").forEach(function(b){b.classList.remove("active");});
  var dmap={inicio:"dnav0",tienda:"dnav1",contacto:"dnav2"};
  if(dmap[pg]){var db=document.getElementById(dmap[pg]);if(db)db.classList.add("active");}
  if(pg==="tienda"){
    cargarCats();
    if(PRODS.length){renderProds();actualizarEstadsTienda();}
    else{
      var g=document.getElementById("pg");
      if(g)g.innerHTML='<div style="grid-column:1/-1;text-align:center;padding:60px 20px"><div style="font-size:3rem;animation:spin 1s linear infinite">🔄</div><p style="font-weight:700;color:var(--na3);margin-top:16px">Cargando productos...</p></div>';
      cargarDatos();
    }
  }
  if(pg==="inicio"&&PRODS.length){
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){ renderInicio(); });
    });
  }
  if(pg==="contacto"){setTimeout(autocompletarContacto,100);}
  window.scrollTo({top:0,behavior:"smooth"});
  // ── Bottom nav ────────────────────────────────
  var bn0=document.getElementById("btnav0");if(bn0)bn0.textContent=t("inicio");
  var bn1=document.getElementById("btnav1");if(bn1)bn1.textContent=t("tienda");
  var bn2=document.getElementById("btnav2");if(bn2)bn2.textContent=t("carrito");
  var bn3=document.getElementById("btnav3");if(bn3)bn3.textContent=t("cuenta");
  // ── Hero buttons ──────────────────────────────
  var hb1=document.getElementById("heroBtn1");if(hb1)hb1.innerHTML="🛍️ "+t("tienda");
  var hb2=document.getElementById("heroBtn2");if(hb2)hb2.innerHTML="⭐ "+t("mejorValorados");
  // ── Page title ────────────────────────────────
  document.title="NuestroStore — Tu Tienda de Confianza";
}

// ── TOAST ──────────────────────────────────
function toast(msg,tipo){tipo=tipo||"i";var c=document.getElementById("tcs"),el=document.createElement("div");el.className="tst "+tipo;el.innerHTML="<span>"+({s:"✅",e:"❌",i:"🔔"}[tipo]||"🔔")+"</span> "+msg;c.appendChild(el);setTimeout(function(){if(el.parentNode)el.parentNode.removeChild(el);},3200);}

// ── MODALES ────────────────────────────────
function abrirModal(id){
  var el=document.getElementById(id);
  if(!el) return;
  el.classList.add("show");
}
function cerrarModal(id){
  var el=document.getElementById(id);
  if(!el) return;
  el.classList.remove("show");
}
function cerrarIdioma(){ cerrarModal("mIdiomaMoneda"); }
function switchM(a,b){cerrarModal(a);abrirModal(b);}
function bTab(tab,btn){if(tab==="cuenta"){if(usuario)abrirPanel();else abrirModal("mLogin");return;}irPagina(tab);}

// ── CARGAR DATOS ────────────────────────────
async function cargarDatos(){
  var r=await api("/productos");
  if(r.ok){
    PRODS=r.productos;
    var catMap={};
    PRODS.forEach(function(p){if(p.cid)catMap[p.cid]=p.cat;});
    CATS=[{id:0,n:"🏷️ Todos"}];
    Object.keys(catMap).forEach(function(cid){CATS.push({id:parseInt(cid),n:catMap[cid]});});
    actualizarStatsHero();
    if(paginaActual==="tienda"){cargarCats();renderProds();actualizarEstadsTienda();}
  }
  var rr=await api("/resenias");
  if(rr.ok){RESENIAS={};rr.resenias.forEach(function(res){if(!RESENIAS[res.pid])RESENIAS[res.pid]=[];RESENIAS[res.pid].push(res);});}
  // Always re-render current page after data loads
  if(paginaActual==="inicio"){
    // Doble rAF garantiza que el DOM está completamente pintado antes de medir
    requestAnimationFrame(function(){
      requestAnimationFrame(function(){
        setTimeout(renderInicio, 50);
      });
    });
  }
  if(paginaActual==="tienda"){cargarCats();renderProds();actualizarEstadsTienda();}
}
function actualizarStatsHero(){
  var cs=PRODS.filter(function(p){return p.st>0;});
  var h=document.getElementById("hsProd");if(h)h.textContent=cs.length||"–";
  var a=document.getElementById("aboutProd");if(a)a.textContent=cs.length||"–";
}
function actualizarEstadsTienda(){
  var cs=PRODS.filter(function(p){return p.st>0;}),catSet={};
  cs.forEach(function(p){catSet[p.cid]=1;});
  var ofs=cs.filter(function(p){return p.o&&p.o<p.p;}).length;
  var e1=document.getElementById("thProd"),e2=document.getElementById("thCats"),e3=document.getElementById("thOfs");
  if(e1)e1.textContent=cs.length;if(e2)e2.textContent=Object.keys(catSet).length;if(e3)e3.textContent=ofs;
}

// ── BÚSQUEDA MEJORADA ───────────────────────
// ── HISTORIAL DE BÚSQUEDA ────────────────────────────────────
var _searchHistory = [];
var _SEARCH_HIST_KEY = "ns_search_hist";
var _SEARCH_MAX = 5;

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
  var sugg = document.getElementById("swSugg");
  if(sugg) sugg.style.display = "none";
}
function _renderHistorySuggestions(){
  var sugg = document.getElementById("swSugg");
  if(!sugg) return;
  _loadSearchHistory();
  if(!_searchHistory.length){
    sugg.style.display = "none";
    return;
  }
  var html = '<div class="sw-sugg-sep" style="display:flex;align-items:center;justify-content:space-between">'
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
  var cl = document.getElementById("swClear");
  if(cl) cl.style.display = "flex";
  if(paginaActual !== "tienda") irPagina("tienda");
  else renderProds();
}

function initSearch(){
  var inp=document.getElementById("sBusq"),sw=document.getElementById("swBox"),cl=document.getElementById("swClear"),sugg=document.getElementById("swSugg");
  if(!inp)return;
  inp.addEventListener("focus",function(){sw.classList.add("focused");if(!inp.value.trim())_renderHistorySuggestions();else mostrarSugerencias(inp.value);});
  inp.addEventListener("blur",function(){sw.classList.remove("focused");setTimeout(function(){sugg.style.display="none";},200);});
  inp.addEventListener("input",function(){
    var v=inp.value;
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
  var sugg=document.getElementById("swSugg");if(!sugg)return;
  if(!q||q.length<1){sugg.style.display="none";return;}
  var ql=q.toLowerCase();
  var matches=PRODS.filter(function(p){return p.st>0&&(p.n.toLowerCase().indexOf(ql)>=0||(p.cat||"").toLowerCase().indexOf(ql)>=0);}).slice(0,6);
  if(!matches.length){sugg.innerHTML='<div class="sw-sugg-empty">🔍 Sin resultados para "'+q+'"</div>';sugg.style.display="block";return;}
  var catMatches=CATS.filter(function(c){return c.id>0&&c.n.toLowerCase().indexOf(ql)>=0;}).slice(0,2);
  var html="";
  if(catMatches.length){html+='<div class="sw-sugg-sep">Categorías</div>';html+=catMatches.map(function(c){return '<div class="sw-sugg-item" onclick="filtrarYVer('+c.id+')"><span class="sugg-ico">🏷️</span><span class="sugg-nm">'+resaltarTexto(c.n,q)+'</span></div>';}).join("");}
  html+='<div class="sw-sugg-sep">Productos</div>';
  html+=matches.map(function(p){
    var ico=p.img?'<img src="'+p.img+'" style="width:28px;height:28px;object-fit:cover;border-radius:6px;" />':(emojiProd(p));
    return '<div class="sw-sugg-item" onclick="_saveSearchToHistory(\''+ q +'\');verProd('+p.id+');document.getElementById(\'swSugg\').style.display=\'none\'"><span class="sugg-ico">'+ico+'</span><span class="sugg-nm">'+resaltarTexto(p.n,q)+'</span><span class="sugg-cat">'+p.cat+'</span></div>';
  }).join("");
  sugg.innerHTML=html;sugg.style.display="block";
}
function resaltarTexto(txt,q){var re=new RegExp("("+q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","gi");return txt.replace(re,"<mark>$1</mark>");}
function filtrarYVer(catId){document.getElementById("swSugg").style.display="none";catActiva=parseInt(catId);irPagina("tienda");}
function limpiarBusqueda(){var inp=document.getElementById("sBusq");if(inp){inp.value="";busqueda="";inp.focus();}var cl=document.getElementById("swClear");if(cl)cl.style.display="none";var s=document.getElementById("swSugg");if(s)s.style.display="none";if(paginaActual==="tienda")renderProds();}
function buscar(){busqueda=(document.getElementById("sBusq")||{}).value||"";busqueda=busqueda.trim();document.getElementById("swSugg").style.display="none";if(busqueda)_saveSearchToHistory(busqueda);if(paginaActual!=="tienda")irPagina("tienda");renderProds();}

// ── CARRUSEL (arreglado, sin dejar de girar) ─
var CR={ofertas:{idx:0,total:0,perPage:1,timer:null,items:[]},valorados:{idx:0,total:0,perPage:1,timer:null,items:[]}};

function carouselPerPage(){var w=window.innerWidth;return w<480?1:w<640?2:w<900?3:w<1200?4:5;}

function carouselInit(name,items,delay){
  var c=CR[name];c.items=items;c.idx=0;c.total=items.length;c.perPage=carouselPerPage();
  var track=document.getElementById("track"+cap(name));
  if(!track)return;
  // Fade out skeleton cards if present
  var skCards=track.querySelectorAll(".sk-card");
  if(skCards.length){
    skCards.forEach(function(sk){sk.style.opacity="0";});
  }
  // Render real cards (tiny delay lets fade-out play)
  var doRender=function(){
    track.style.transition="none";
    track.innerHTML=items.map(function(html){return '<div class="pc" style="flex-shrink:0;width:var(--cw)">'+html+'</div>';}).join("");
  // Set CSS var for card width
  var outer=document.getElementById("outer"+cap(name));
  if(outer){var gap=14,pp=c.perPage,ow=outer.offsetWidth||outer.getBoundingClientRect().width||window.innerWidth;if(ow<10)ow=window.innerWidth;var peekOffset=(pp===1&&ow<480)?Math.floor(ow*0.22):0;var cw=Math.floor((ow-peekOffset-(gap*(pp-1)))/pp);if(cw<80)cw=Math.floor((window.innerWidth-48)/pp);outer.style.setProperty("--cw",cw+"px");outer.style.setProperty("--cgap",gap+"px");}
  // Dots
  var maxDots=Math.max(1,c.total-c.perPage+1);
  var isDark=name==="valorados";
  var dots=document.getElementById("dots"+cap(name));
  if(dots)dots.innerHTML=Array.from({length:maxDots}).map(function(_,i){return '<span class="cdot'+(isDark?" cdot-dark":"")+(i===0?" on":"")+'"></span>';}).join("");
  carouselRender(name);
  if(c.timer)clearInterval(c.timer);
  if(c.total>c.perPage){c.timer=setInterval(function(){carouselNext(name);},delay||5000);}
  };
  if(skCards.length){
    setTimeout(doRender, 200);
  } else {
    doRender();
  }
}

function carouselRender(name){
  var c=CR[name];var track=document.getElementById("track"+cap(name));if(!track)return;
  var outer=document.getElementById("outer"+cap(name));if(!outer)return;
  var gap=14,pp=c.perPage,ow=outer.offsetWidth||outer.getBoundingClientRect().width||window.innerWidth;if(ow<10)ow=window.innerWidth;var peekOffset=(pp===1&&ow<480)?Math.floor(ow*0.12):0;var cw=Math.floor((ow-peekOffset-(gap*(pp-1)))/pp);if(cw<80)cw=Math.floor((window.innerWidth-48)/pp);
  outer.style.setProperty("--cw",cw+"px");outer.style.setProperty("--cgap",gap+"px");
  // Clamp idx
  var maxIdx=Math.max(0,c.total-pp);c.idx=Math.min(c.idx,maxIdx);
  var offset=c.idx*(cw+gap);
  track.style.transition="transform .45s cubic-bezier(.4,0,.2,1)";
  track.style.transform="translateX(-"+offset+"px)";
  // Update cards width
  Array.from(track.children).forEach(function(el){el.style.width=cw+"px";});
  // Update dots
  var maxDots=Math.max(1,c.total-pp+1);
  var dots=document.getElementById("dots"+cap(name));
  if(dots)Array.from(dots.children).forEach(function(d,i){d.classList.toggle("on",i===c.idx);});
}

function carouselNext(name){
  var c=CR[name];var maxIdx=Math.max(0,c.total-c.perPage);
  c.idx=c.idx>=maxIdx?0:c.idx+1;
  carouselRender(name);
  resetCarouselTimer(name);
}
function carouselPrev(name){
  var c=CR[name];var maxIdx=Math.max(0,c.total-c.perPage);
  c.idx=c.idx<=0?maxIdx:c.idx-1;
  carouselRender(name);
  resetCarouselTimer(name);
}
function resetCarouselTimer(name){
  var c=CR[name];if(c.timer)clearInterval(c.timer);
  if(c.total>c.perPage){var delay=name==="ofertas"?5000:4200;c.timer=setInterval(function(){carouselNext(name);},delay);}
}
function cap(s){return s.charAt(0).toUpperCase()+s.slice(1);}

// Swipe en carrusel
function initCarouselSwipe(name){
  var outer=document.getElementById("outer"+cap(name));if(!outer)return;
  var startX=0,isDragging=false;
  outer.addEventListener("mousedown",function(e){startX=e.clientX;isDragging=true;});
  outer.addEventListener("mousemove",function(e){if(!isDragging)return;});
  outer.addEventListener("mouseup",function(e){if(!isDragging)return;isDragging=false;var diff=startX-e.clientX;if(Math.abs(diff)>40){if(diff>0)carouselNext(name);else carouselPrev(name);}});
  outer.addEventListener("mouseleave",function(){isDragging=false;});
  outer.addEventListener("touchstart",function(e){startX=e.touches[0].clientX;},{passive:true});
  outer.addEventListener("touchend",function(e){var diff=startX-e.changedTouches[0].clientX;if(Math.abs(diff)>40){if(diff>0)carouselNext(name);else carouselPrev(name);}},{passive:true});
  // Pausar al hover
  outer.addEventListener("mouseenter",function(){var c=CR[name];if(c.timer){clearInterval(c.timer);c.timer=null;}});
  outer.addEventListener("mouseleave",function(){var c=CR[name];if(!c.timer&&c.total>c.perPage){var delay=name==="ofertas"?5000:4200;c.timer=setInterval(function(){carouselNext(name);},delay);}});
}

window.addEventListener("resize",function(){
  requestAnimationFrame(function(){
    ["ofertas","valorados"].forEach(function(name){
      var c=CR[name];
      if(!c||!c.items||!c.items.length)return;
      var newPP=carouselPerPage();
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
      var c=CR[name];
      if(c&&c.items&&c.items.length){c.perPage=carouselPerPage();carouselInit(name,c.items,name==="ofertas"?5000:4200);}
    });
  },200);
});

// ── INICIO ──────────────────────────────────
function promedioEstrellas(pid){var arr=RESENIAS[pid];if(!arr||!arr.length)return 0;return arr.reduce(function(s,r){return s+r.estrellas;},0)/arr.length;}
function starsHtml(avg){var full=Math.round(avg),h="";for(var i=1;i<=5;i++)h+='<span style="color:'+(i<=full?"#f59e0b":"#d1d5db")+'">★</span>';return h;}

function renderInicio(){
  // Remove loading skeleton
  var sk=document.getElementById("skeletonLoader");
  if(sk)sk.remove();
  var ofs=PRODS.filter(function(p){return p.o&&p.o<p.p&&p.st>0;});
  if(!ofs.length)ofs=PRODS.filter(function(p){return p.st>0;}).slice(0,6);
  ofs=ofs.slice(0,6);
  carouselInit("ofertas",ofs.map(function(p){return tarjetaInner(p,true);}),5000);
  initCarouselSwipe("ofertas");

  var vals=PRODS.filter(function(p){return p.st>0;}).slice();
  vals.sort(function(a,b){return promedioEstrellas(b.id)-promedioEstrellas(a.id);});
  vals=vals.slice(0,6);
  carouselInit("valorados",vals.map(function(p){
    var avg=promedioEstrellas(p.id),stars=avg>0?starsHtml(avg):'<span style="color:#d1d5db">★★★★★</span>';
    var cnt=RESENIAS[p.id]?RESENIAS[p.id].length:0;
    return tarjetaInner(p,false,stars,cnt);
  }),4200);
  initCarouselSwipe("valorados");
  // Update heart state on all cards
  requestAnimationFrame(actualizarTodosHearts);
}

// ── TARJETA PRODUCTO ─────────────────────────

// ── WISHLIST ─────────────────────────────────────────────
function cargarWishlist(){
  try{var w=localStorage.getItem("ns_wishlist");wishlist=w?JSON.parse(w):[];}
  catch(e){wishlist=[];}
}
function guardarWishlist(){
  try{localStorage.setItem("ns_wishlist",JSON.stringify(wishlist));}catch(e){}
}
function enWishlist(pid){return wishlist.indexOf(pid)>=0;}
function toggleWishlist(pid,e){
  if(e){e.stopPropagation();e.preventDefault();}
  if(!usuario){toast("Inicia sesión para guardar favoritos","e");abrirModal("mLogin");return;}
  var idx=wishlist.indexOf(pid);
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
    var pid=parseInt(btn.getAttribute("data-pid"));
    actualizarHeartBtn(btn, enWishlist(pid));
  });
}
function renderWishlist(){
  var ids=wishlist.slice();
  if(!ids.length){
    return '<div class="empty"><div class="eico">💙</div><h3>Sin favoritos aún</h3><p>Toca el corazón en cualquier producto para guardarlo aquí.</p><button class="bp" style="margin-top:14px" onclick="cerrarModal(\'mPanel\');irPagina(\'tienda\')">🛍️ Explorar Tienda</button></div>';
  }
  var prods=ids.map(function(id){return PRODS.find(function(p){return p.id===id;});}).filter(Boolean);
  if(!prods.length){
    return '<div class="empty"><div class="eico">💙</div><h3>Productos no disponibles</h3><p>Algunos productos guardados ya no están disponibles.</p></div>';
  }
  return '<div style="display:flex;flex-direction:column;gap:10px">'+prods.map(function(p){
    var imgEl=p.img?'<img src="'+p.img+'" style="width:56px;height:56px;object-fit:cover;border-radius:10px;flex-shrink:0"/>':
      '<div style="width:56px;height:56px;border-radius:10px;background:linear-gradient(135deg,#EFF6FF,#DBEAFE);display:flex;align-items:center;justify-content:center;font-size:1.6rem;flex-shrink:0">'+emojiProd(p)+'</div>';
    var agotado=p.st<=0;
    var imgContent=p.img?'<img src="'+p.img+'" />':emojiProd(p);
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
  var imgEl=p.img?'<img src="'+p.img+'" />':(
    '<span class="pi-emoji">'+emojiProd(p)+'</span>'
  );
  var starsEl=starsStr?'<div class="pstars">'+starsStr+(cnt?' <small style="color:var(--gr);font-size:.7rem">('+cnt+')</small>':'')+'</div>':"";
  var ofPct=(showOferta&&p.o&&p.p>0)?Math.round((1-p.o/p.p)*100):0;
  var pctBadge=ofPct>0?'<span class="pdesc-pct">-'+ofPct+'%</span>':"";
  var stockBadge=(p.st>0&&p.st<=5)?'<span style="position:absolute;bottom:8px;left:8px;background:rgba(230,81,0,.9);color:#fff;font-size:.62rem;font-weight:900;padding:3px 7px;border-radius:50px;z-index:2">⚡ Solo '+p.st+'</span>':"";
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
function cargarCats(){var c=document.getElementById("cats");if(!c)return;c.innerHTML=CATS.map(function(cat){return '<button class="cc'+(cat.id===catActiva?" on":"")+'" onclick="filtCat('+cat.id+',this)">'+cat.n+'</button>';}).join("");}
function filtCat(id,btn){catActiva=id;document.querySelectorAll(".cc").forEach(function(b){b.classList.remove("on");});btn.classList.add("on");renderProds();}
function sortProds(val){sortActivo=val;renderProds();}
function prodsFiltrados(){
  var q=busqueda.toLowerCase().trim();
  return PRODS.filter(function(p){
    if(p.st<=0)return false;
    // Categoría
    var mc=catActiva===0||p.cid===catActiva;
    if(!mc)return false;
    // Búsqueda texto
    if(q){
      var mb=p.n.toLowerCase().indexOf(q)>=0||
             (p.d||"").toLowerCase().indexOf(q)>=0||
             (p.cat||"").toLowerCase().indexOf(q)>=0||
             String(p.p).indexOf(q)>=0;
      if(!mb)return false;
    }
    // Precio
    var precio=p.o||p.p;
    if(precio<filtroPrecioMin||precio>filtroPrecioMax)return false;
    // Rating mínimo
    if(filtroRating>0){
      var avg=promedioEstrellas(p.id);
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
  var precios=PRODS.filter(function(p){return p.st>0;}).map(function(p){return p.o||p.p;});
  var pMin=Math.floor(Math.min.apply(null,precios));
  var pMax=Math.ceil(Math.max.apply(null,precios));
  // Round to nice numbers
  pMin=Math.floor(pMin/1000)*1000;
  pMax=Math.ceil(pMax/1000)*1000;
  var slMin=document.getElementById("fSliderMin");
  var slMax=document.getElementById("fSliderMax");
  if(!slMin||!slMax)return;
  slMin.min=pMin;slMin.max=pMax;slMin.value=filtroPrecioMin>0?filtroPrecioMin:pMin;
  slMax.min=pMin;slMax.max=pMax;slMax.value=filtroPrecioMax<Infinity?filtroPrecioMax:pMax;
  slMin.step=Math.max(1000,Math.floor((pMax-pMin)/100));
  slMax.step=slMin.step;
  actualizarPrecioLabels();
  actualizarRangeFill();
}
function actualizarPrecioLabels(){
  var slMin=document.getElementById("fSliderMin");
  var slMax=document.getElementById("fSliderMax");
  var lMin=document.getElementById("fPrecioMin");
  var lMax=document.getElementById("fPrecioMax");
  if(!slMin||!lMin)return;
  lMin.textContent=bs(parseFloat(slMin.value));
  lMax.textContent=bs(parseFloat(slMax.value));
}
function actualizarRangeFill(){
  var slMin=document.getElementById("fSliderMin");
  var slMax=document.getElementById("fSliderMax");
  var fill=document.getElementById("fRangeFill");
  if(!slMin||!fill)return;
  var min=parseFloat(slMin.min),max=parseFloat(slMin.max);
  var vMin=parseFloat(slMin.value),vMax=parseFloat(slMax.value);
  var pLeft=((vMin-min)/(max-min))*100;
  var pRight=((vMax-min)/(max-min))*100;
  fill.style.left=pLeft+"%";
  fill.style.width=(pRight-pLeft)+"%";
}
function onSliderMin(el){
  var slMax=document.getElementById("fSliderMax");
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
  var slMin=document.getElementById("fSliderMin");
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
  var btn=document.getElementById("fSoloOfertas");
  if(btn){
    btn.classList.toggle("on",filtroSoloOfertas);
    btn.querySelector(".filtro-check-ico").textContent=filtroSoloOfertas?"●":"○";
  }
  actualizarFiltrosBadge();
  renderProds();
}
function toggleFiltrosPanel(){
  var panel=document.getElementById("filtrosPanel");
  var btn=document.getElementById("filtrosToggleBtn");
  if(!panel)return;
  var open=panel.style.display==="none"||!panel.style.display;
  panel.style.display=open?"block":"none";
  if(btn)btn.classList.toggle("on",open);
  if(open)initFiltrosPanel();
}
function resetFiltros(){
  filtroPrecioMin=0;filtroPrecioMax=Infinity;
  filtroRating=0;filtroSoloOfertas=false;
  catActiva=0;busqueda="";
  var inp=document.getElementById("sBusq");if(inp)inp.value="";
  var cl=document.getElementById("swClear");if(cl)cl.style.display="none";
  // Reset UI
  document.querySelectorAll(".filtro-star-btn").forEach(function(b){b.classList.remove("on");});
  var allBtn=document.querySelector(".filtro-star-btn[data-val='0']");
  if(allBtn)allBtn.classList.add("on");
  var ofBtn=document.getElementById("fSoloOfertas");
  if(ofBtn){ofBtn.classList.remove("on");ofBtn.querySelector(".filtro-check-ico").textContent="○";}
  initFiltrosPanel();
  actualizarFiltrosBadge();
  cargarCats();
  renderProds();
}
function actualizarFiltrosBadge(){
  var cnt=0;
  if(filtroRating>0)cnt++;
  if(filtroSoloOfertas)cnt++;
  if(filtroPrecioMin>0)cnt++;
  if(filtroPrecioMax<Infinity)cnt++;
  var badge=document.getElementById("filtrosBadge");
  if(badge){badge.style.display=cnt>0?"inline-flex":"none";badge.textContent=cnt;}
  var btn=document.getElementById("filtrosToggleBtn");
  if(btn)btn.classList.toggle("has-active",cnt>0);
}

function renderProds(){
  var sk=document.getElementById("skeletonLoader");if(sk)sk.remove();
  var g=document.getElementById("pg");if(!g)return;
  var lista=prodsFiltrados();
  if(sortActivo==="precioAsc")lista.sort(function(a,b){return (a.o||a.p)-(b.o||b.p);});
  else if(sortActivo==="precioDesc")lista.sort(function(a,b){return (b.o||b.p)-(a.o||a.p);});
  else if(sortActivo==="nombre")lista.sort(function(a,b){return a.n.localeCompare(b.n);});
  else if(sortActivo==="valorados")lista.sort(function(a,b){return promedioEstrellas(b.id)-promedioEstrellas(a.id);});
  // Contador de resultados
  var filtroInfo=document.getElementById("filtroInfo");
  if(!filtroInfo){
    var toolbar=document.querySelector(".tienda-toolbar");
    if(toolbar){filtroInfo=document.createElement("div");filtroInfo.id="filtroInfo";filtroInfo.style.cssText="font-size:.8rem;font-weight:700;color:var(--gr);padding:6px 16px 0;max-width:960px;margin:0 auto;";toolbar.after(filtroInfo);}
  }
  if(filtroInfo){
    var txt="";
    if(busqueda)txt+="🔍 \""+busqueda+"\" — ";
    if(catActiva>0){var cat=CATS.find(function(c){return c.id===catActiva;});if(cat)txt+=cat.n+" — ";}
    txt+=lista.length+" resultado"+(lista.length!==1?"s":"");
    if(busqueda||catActiva>0)txt+=' <span style="cursor:pointer;color:var(--na);text-decoration:underline;margin-left:6px" onclick="catActiva=0;busqueda="";document.getElementById(\"sBusq\").value="";renderProds();cargarCats()">✕ Limpiar</span>';
    filtroInfo.innerHTML=txt;
  }
  if(!lista.length){g.innerHTML='<div style="grid-column:1/-1" class="empty"><div class="eico">🔍</div><h3>Sin resultados</h3><p>Prueba otra búsqueda o categoría</p>'+(busqueda||catActiva>0?'<button class="btn-hero-2" style="margin-top:12px;font-size:.85rem" onclick="catActiva=0;busqueda="";document.getElementById(\"sBusq\").value="";renderProds();cargarCats()">Ver todos los productos</button>':'')+' </div>';return;}
  g.innerHTML=lista.map(function(p){var avg=promedioEstrellas(p.id);var stars=avg>0?starsHtml(avg):null;var cnt=RESENIAS[p.id]?RESENIAS[p.id].length:0;return tarjetaHTML(p,true,stars,cnt);}).join("");
  requestAnimationFrame(actualizarTodosHearts);
}

// ── VER PRODUCTO ─────────────────────────────

// ── COMPARTIR PRODUCTO ────────────────────────────────────────
function compartirProducto(pid, nom){
  var p = PRODS.find(function(x){ return x.id === pid; });
  var pNom = nom || (p ? p.n : "Producto");
  var url  = window.location.href.split("?")[0];
  var text = "👀 Mira este producto en NuestroStore:\n*" + pNom + "*";
  if(p && p.o) text += "\n💰 " + bs(p.o) + " (antes " + bs(p.p) + ")";
  else if(p)   text += "\n💰 " + bs(p.p);
  text += "\n\n" + url;

  if(navigator.share){
    navigator.share({ title: pNom, text: text, url: url })
      .catch(function(){});
  } else {
    // Fallback: copy to clipboard
    var copyText = text;
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
  var ta = document.createElement("textarea");
  ta.value = text;
  ta.style.cssText = "position:fixed;top:-9999px;left:-9999px";
  document.body.appendChild(ta);
  ta.select();
  try{ document.execCommand("copy"); toast("🔗 Link copiado al portapapeles","s"); }
  catch(e){ toast("No se pudo copiar el link","e"); }
  document.body.removeChild(ta);
}

function verProd(id){
  var p=PRODS.find(function(x){return x.id===id;});if(!p)return;
  document.getElementById("mProdT").textContent=p.n;
  var imgHtml=p.img?'<img src="'+p.img+'" style="width:100%;border-radius:12px;margin-bottom:16px;max-height:240px;object-fit:cover"/>':
    '<div style="text-align:center;font-size:6rem;padding:24px 20px;background:linear-gradient(135deg,#fff8e1,#ffe082);border-radius:12px;margin-bottom:16px">'+emojiProd(p)+'</div>';
  var avg=promedioEstrellas(p.id),cnt=RESENIAS[p.id]?RESENIAS[p.id].length:0;
  var starsRow=avg>0?'<div style="margin-bottom:14px">'+starsHtml(avg)+' <span style="color:var(--gr);font-size:.85rem">'+avg.toFixed(1)+'/5 ('+cnt+' reseña'+(cnt!==1?'s':'')+')</span></div>':"";
  var listaRes=RESENIAS[p.id]||[];
  var agotado=p.st<=0;
  var resHtml='<div style="margin-top:18px;border-top:2px solid #f0f0f0;padding-top:14px"><div style="font-weight:800;color:var(--na3);margin-bottom:12px">⭐ Reseñas ('+listaRes.length+')</div>';
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
    (usuario?'<button class="wl-btn-lg"'+(enWishlist(p.id)?' style="border-color:#3B82F6;color:#1E3A8A;background:#EFF6FF"':'')+' data-pid="'+p.id+'" onclick="toggleWishlist('+p.id+',event);var b=this;b.style.background=enWishlist('+p.id+')?\"#EFF6FF\":\"#fff\";b.style.color=enWishlist('+p.id+')?\"#1E3A8A\":\"var(--gr2)\";b.innerHTML=enWishlist('+p.id+')?\"💙 En Favoritos\":\"🤍 Guardar en Favoritos\"">'+(enWishlist(p.id)?'💙 En Favoritos':'🤍 Guardar en Favoritos')+'</button>':'')+
    (usuario&&!agotado?'<button class="bs" onclick="abrirResenia('+p.id+')">⭐ Escribir Reseña</button>':'')+
    (usuario?'<button class="bs" onclick="cerrarModal(\"mProd\");abrirRep('+p.id+')">🚨 Reportar Problema</button>':'')+resHtml;
  // Productos relacionados
  var relacionados = PRODS.filter(function(x){
    return x.id !== p.id && x.cid === p.cid && x.st > 0;
  }).slice(0,4);
  var relHtml = '';
  if(relacionados.length){
    relHtml = '<div style="margin-top:20px;border-top:2px solid #f0f0f0;padding-top:16px">'
      + '<div style="font-weight:800;color:var(--na3);margin-bottom:12px;font-size:.9rem">🛍️ También te puede gustar</div>'
      + '<div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px">'
      + relacionados.map(function(r){
          var rImg = r.img
            ? '<img src="'+r.img+'" style="width:100%;height:80px;object-fit:cover;border-radius:8px;margin-bottom:8px"/>'
            : '<div style="height:80px;border-radius:8px;background:linear-gradient(135deg,#EFF6FF,#DBEAFE);display:flex;align-items:center;justify-content:center;font-size:2rem;margin-bottom:8px">'+emojiProd(r)+'</div>';
          var rPct = (r.o && r.p > 0) ? Math.round((1-r.o/r.p)*100) : 0;
          var card = document.createElement("div");
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
            var rid = parseInt(this.getAttribute("data-relid"));
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
  if(!nom){var pp=PRODS.find(function(x){return x.id===pid;});nom=pp?pp.n:"Producto";}if(!usuario){toast("Inicia sesión","e");abrirModal("mLogin");return;}document.getElementById("resPid").value=pid;document.getElementById("resProdNom").textContent="📦 "+nom;document.getElementById("resComentario").value="";starSelVal=5;selStar(5);cerrarModal("mProd");abrirModal("mResenia");}
function enviarResenia(){if(!usuario){toast("Inicia sesión","e");return;}var pid=parseInt(document.getElementById("resPid").value),coment=document.getElementById("resComentario").value.trim();if(!coment){toast("Escribe un comentario","e");return;}api("/resenias","POST",{uid:usuario.id,pid:pid,estrellas:starSelVal,comentario:coment}).then(function(r){if(!r.ok){toast(r.error||"Error","e");return;}toast("¡Reseña publicada! ⭐","s");cerrarModal("mResenia");api("/resenias").then(function(rr){if(rr.ok){RESENIAS={};rr.resenias.forEach(function(res){if(!RESENIAS[res.pid])RESENIAS[res.pid]=[];RESENIAS[res.pid].push(res);});renderInicio();if(paginaActual==="tienda")renderProds();}});});}

// ── PERFIL ───────────────────────────────────
var AVATARES=["😊","🧑","👩","👨","🧑‍💻","👩‍💼","👨‍💼","🧑‍🎨","👩‍🍳","👨‍🔬","🦸","🧙","🐱","🦊","🐸","🌟","🔥","💎","🏆","🚀","🎮","🎨","🎸","⚽","🌈"];
var perfilAvatarSel="";

function abrirPerfil(){
  if(!usuario){abrirModal("mLogin");return;}
  api("/perfil/"+usuario.id).then(function(r){
    if(!r.ok){toast("Error al cargar perfil","e");return;}
    var pf=r.perfil;
    perfilAvatarSel=pf.avatar||"";
    var avaDisplay=pf.avatar?(pf.avatar.startsWith("data:")||/^\p{Emoji}/u.test(pf.avatar)||pf.avatar.length<=8)?'<span style="font-size:2.5rem">'+pf.avatar+'</span>':'<img src="'+pf.avatar+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;" />'
      :'<span style="font-size:2.5rem">'+usuario.n[0]+'</span>';
    var rolLabel={cliente:"👤 Cliente",administrador:"⚙️ Administrador",superadmin:"👑 Super Admin"}[pf.rol]||pf.rol;
    var html='<div class="perfil-hero">'+
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
  var prev=document.getElementById("perfilAvaPreview");if(prev)prev.innerHTML='<span style="font-size:2.5rem">'+av+'</span>';
}
function cargarAvatarImg(e){var file=e.target.files[0];if(!file)return;var r=new FileReader();r.onload=function(ev){perfilAvatarSel=ev.target.result;var prev=document.getElementById("perfilAvaPreview");if(prev)prev.innerHTML='<img src="'+ev.target.result+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>';};r.readAsDataURL(file);}

function guardarPerfil(){
  var nom=(document.getElementById("pfNom").value||"").trim();
  var ape=(document.getElementById("pfApe").value||"").trim();
  var tel=(document.getElementById("pfTel").value||"").trim();
  var oldPw=(document.getElementById("pfOldPw").value||"").trim();
  var newPw=(document.getElementById("pfNewPw").value||"").trim();
  var errEl=document.getElementById("pfErr");errEl.style.display="none";
  if(!nom||!ape){errEl.textContent="⚠️ Nombre y apellido requeridos.";errEl.style.display="block";return;}
  var avatarAEnviar=perfilAvatarSel||"";
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
var _loginAttempts = 0;
var _loginLocked = false;
function doLogin(){
  if(_loginLocked){ toast("Demasiados intentos. Espera 30 segundos.", "e"); return; }
  var emailEl=document.getElementById("lEmail"),passEl=document.getElementById("lPass"),errEl=document.getElementById("loginErr"),btnEl=document.getElementById("btnLogin");
  var email=emailEl.value.trim().toLowerCase(),pass=passEl.value;
  errEl.style.display="none";
  if(!email||!pass){errEl.textContent="⚠️ Correo y contraseña requeridos.";errEl.style.display="block";return;}
  btnEl.disabled=true;btnEl.textContent="Verificando...";
  api("/login","POST",{email:email,password:pass}).then(function(r){
    btnEl.disabled=false;btnEl.textContent="Entrar →";
    if(!r.ok){_loginAttempts++;errEl.textContent="❌ "+(r.error||"Credenciales incorrectas.")+((_loginAttempts>=3)?" ("+( 5-_loginAttempts)+" intentos restantes)":"");errEl.style.display="block";passEl.value="";passEl.focus();if(_loginAttempts>=5){_loginLocked=true;setTimeout(function(){_loginLocked=false;_loginAttempts=0;toast("Puedes intentar de nuevo","i");},30000);}return;}
    usuario=r.usuario;localStorage.setItem("ns_usuario",JSON.stringify(usuario));cerrarModal("mLogin");emailEl.value="";passEl.value="";errEl.style.display="none";
    toast("¡Bienvenido, "+usuario.n+"! ("+({cliente:"Cliente",administrador:"Admin",superadmin:"Super Admin"}[usuario.rol]||usuario.rol)+")","s");
    actualizarUI();cargarDatos();mpCargarDesdeDB();_mpYaCargo=true;
  });
}
function doRegistro(){
  var nom=document.getElementById("rNom").value.trim(),ape=document.getElementById("rApe").value.trim();
  var email=document.getElementById("rEmail").value.trim().toLowerCase(),pass=document.getElementById("rPass").value;
  var tel=document.getElementById("rTel").value.trim(),errEl=document.getElementById("regErr");errEl.style.display="none";
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

// ── MODO OSCURO ───────────────────────────────────────────────
function aplicarDarkMode(dark){
  document.documentElement.classList.toggle("dark", dark);
  localStorage.setItem("ns_dark", dark ? "1" : "0");
  DARK_MODE = dark;
  // Update all toggle buttons
  document.querySelectorAll(".dm-toggle").forEach(function(btn){
    btn.innerHTML = dark ? "☀️" : "🌙";
    btn.setAttribute("aria-label", dark ? "Modo claro" : "Modo oscuro");
    btn.setAttribute("title", dark ? "Cambiar a modo claro" : "Cambiar a modo oscuro");
  });
}
function toggleDarkMode(){
  aplicarDarkMode(!DARK_MODE);
}
function actualizarUI(){
  var navIcons=document.getElementById("navIcons"),deskActs=document.getElementById("deskActs"),bt3ico=document.getElementById("bt3ico");
  if(usuario){
    var rol=usuario.rol;
    var rolLabel={cliente:"Cliente",administrador:"Administrador",superadmin:"Super Admin"}[rol]||rol;
    var rolEmoji={cliente:"👤",administrador:"⚙️",superadmin:"👑"}[rol]||"👤";
    var avatarContent=usuario.avatar?(usuario.avatar.startsWith("data:")||/^\p{Emoji}/u.test(usuario.avatar)||usuario.avatar.length<=8)?usuario.avatar:'<img src="'+usuario.avatar+'" style="width:100%;height:100%;object-fit:cover;border-radius:50% 0 0 50%;"/>':(usuario.n[0]);
    var avatarMobile=usuario.avatar?(usuario.avatar.startsWith("data:")||/^\p{Emoji}/u.test(usuario.avatar)||usuario.avatar.length<=8)?usuario.avatar:'<img src="'+usuario.avatar+'" style="width:100%;height:100%;object-fit:cover;border-radius:50%;"/>':(usuario.n[0]);
    // Panel button según rol
    var panelBtn="";
    if(rol==="administrador"){
      panelBtn='<button class="hdr-panel-btn admin" onclick="abrirPanel()">⚙️ Panel</button>';
    }else if(rol==="superadmin"){
      panelBtn='<button class="hdr-panel-btn superadmin" onclick="abrirPanel()">👑 Panel</button>';
    }
    // Nombre truncado
    var nombre=usuario.n.split(" ")[0];
    navIcons.innerHTML=''; // En móvil carrito y cuenta están en el bottom nav
    deskActs.innerHTML=
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
  var cartTarget = document.getElementById("cartBadgeNav")
    || document.getElementById("cartBadgeDesk")
    || document.querySelector(".hdr-cart-btn")
    || document.querySelector(".cart-btn");
  if(!cartTarget || !sourceEl) return;

  // Get positions
  var srcRect = sourceEl.getBoundingClientRect();
  var tgtRect = cartTarget.getBoundingClientRect();

  // Create flying dot
  var dot = document.createElement("div");
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
  var tx = tgtRect.left + tgtRect.width/2  - (srcRect.left + srcRect.width/2);
  var ty = tgtRect.top  + tgtRect.height/2 - (srcRect.top  + srcRect.height/2);
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
var cuponActivo = null; // {codigo, tipo, valor, descuento}

function aplicarCupon(){
  var inp = document.getElementById("cuponInput");
  var btn = document.getElementById("cuponBtn");
  var msg = document.getElementById("cuponMsg");
  if(!inp || !msg) return;
  var codigo = inp.value.trim().toUpperCase();
  if(!codigo){ msg.textContent="Ingresa un código"; msg.className="cupon-msg cupon-err"; return; }
  var total = carrito.reduce(function(s,x){ return s+x.p*x.qty; }, 0);
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
  var inp = document.getElementById("cuponInput");
  var msg = document.getElementById("cuponMsg");
  if(inp) inp.value = "";
  if(msg){ msg.textContent = ""; msg.className = "cupon-msg"; }
  actualizarTotalCarrito();
}

function actualizarTotalCarrito(){
  var subtotal = carrito.reduce(function(s,x){ return s+x.p*x.qty; }, 0);
  var descuento = cuponActivo ? cuponActivo.descuento : 0;
  var total = subtotal - descuento;
  var totEl = document.getElementById("cTot");
  if(totEl) totEl.textContent = bs(total);
  // Show/hide discount row
  var discRow = document.getElementById("cDescRow");
  if(discRow){
    discRow.style.display = descuento > 0 ? "flex" : "none";
    var discEl = document.getElementById("cDesc");
    if(discEl) discEl.textContent = "- " + bs(descuento);
  }
}

function addCart(id){
  if(!usuario){toast("Inicia sesión para comprar","e");abrirModal("mLogin");return;}
  var p=PRODS.find(function(x){return x.id===id;});
  if(!p||p.st<=0){toast("Producto agotado ❌","e");return;}
  var ex=carrito.find(function(x){return x.id===id;});
  var cantActual=ex?ex.qty:0;
  if(cantActual>=p.st){toast("Solo hay "+p.st+" unidad"+(p.st!==1?"es":"")+" disponible","e");return;}
  if(ex) ex.qty++;
  else carrito.push({id:p.id,n:p.n,p:(p.o||p.p),qty:1,e:emojiProd(p),img:p.img||null,maxSt:p.st});
  actualizarCarrito();
  toast(p.n+" agregado al carrito 🛒","s");
  // Fly-to-cart desde el botón activo
  var srcBtn=document.activeElement;
  if(srcBtn&&(srcBtn.classList.contains("badd")||srcBtn.classList.contains("bp"))){
    flyToCart(srcBtn);
  } else {
    // Fallback: pulse badges
    ["cartBadgeMobile","cartBadgeDesk","cartBadgeNav"].forEach(function(bid){
      var el=document.getElementById(bid);
      if(el){el.classList.remove("badge-pulse");void el.offsetWidth;el.classList.add("badge-pulse");}
    });
  }
}
function cambiarQty(id,delta){
  var ex=carrito.find(function(x){return x.id===id;});
  if(!ex)return;
  var p=PRODS.find(function(x){return x.id===id;});
  var maxSt=p?p.st:(ex.maxSt||999);
  var nueva=ex.qty+delta;
  if(nueva<1){quitarCart(id);return;}
  if(nueva>maxSt){toast("Máximo "+maxSt+" unidad"+(maxSt!==1?"es":"")+" disponibles","e");return;}
  ex.qty=nueva;
  actualizarCarrito();
}
function quitarCart(id){carrito=carrito.filter(function(x){return x.id!==id;});actualizarCarrito();}
function actualizarCarrito(){
  var total=carrito.reduce(function(s,x){return s+x.p*x.qty;},0),count=carrito.reduce(function(s,x){return s+x.qty;},0);
  localStorage.setItem("ns_carrito", JSON.stringify(carrito));
  actualizarTotalCarrito();
  actualizarBadge(count);
  var c=document.getElementById("cits");if(!c)return;
  if(!carrito.length){c.innerHTML='<div class="empty"><div class="eico">🛒</div><h3>Carrito vacío</h3><p>Agrega productos</p></div>';return;}
  c.innerHTML=carrito.map(function(it){var imgC=it.img?'<img src="'+it.img+'">':(it.e||"📦");return '<div class="cit"><div class="cimg">'+imgC+'</div><div class="cinf"><div class="cnm">'+it.n+'</div><div class="cpr">'+bs(it.p)+'</div><div class="qty-ctrl"><button class="qty-btn" onclick="cambiarQty('+it.id+',-1)">−</button><span style="font-weight:800;font-size:.9rem">'+it.qty+'</span><button class="qty-btn" onclick="cambiarQty('+it.id+',1)">+</button></div></div><button class="cdel" onclick="quitarCart('+it.id+')">🗑️</button></div>';}).join("");
}
function actualizarBadge(count){var n=count!==undefined?count:carrito.reduce(function(s,x){return s+x.qty;},0);["cartBadgeMobile","cartBadgeDesk","cartBadgeNav"].forEach(function(bid){var el=document.getElementById(bid);if(el){el.textContent=n;el.style.display=n>0?"flex":"none";}});}
function abrirCarrito(){actualizarCarrito();document.getElementById("csh").classList.add("open");document.getElementById("cov").classList.add("show");document.body.style.overflow="hidden";}
function cerrarCarrito(){document.getElementById("csh").classList.remove("open");document.getElementById("cov").classList.remove("show");document.body.style.overflow="";}
function pedido(){
  if(!usuario){toast("Inicia sesión","e");abrirModal("mLogin");return;}
  if(!carrito.length){toast("Carrito vacío","e");return;}
  var total=carrito.reduce(function(s,x){return s+x.p*x.qty;},0);
  var resumen=carrito.map(function(it){return "• "+it.n+" × "+it.qty+" = "+bs(it.p*it.qty);}).join("\n");
  var iva=total*0.19;
  if(!confirm("📋 CONFIRMAR PEDIDO\n\n"+resumen+"\n\n─────────────────\nSubtotal: "+bs(total)+"\nIVA (19%): "+bs(iva)+"\nTOTAL: "+bs(total+iva)+"\n\n¿Confirmas la compra?")){return;}
  var btn=document.querySelector(".btn-pagar");
  if(btn){btn.disabled=true;btn.textContent="Procesando…";}
  api("/pedidos","POST",{uid:usuario.id,items:JSON.parse(JSON.stringify(carrito)),total:total}).then(function(r){
    if(btn){btn.disabled=false;btn.textContent="Pagar →";}
    if(!r.ok){toast("Error al procesar el pedido","e");return;}
    carrito=[];
    actualizarCarrito();
    cerrarCarrito();
    toast("¡Pedido confirmado! 🎉 Te contactaremos pronto.","s");
    // Actualizar stock local
    if(r.ok) cargarDatos();
  });
}

// ── FACTURA ──────────────────────────────────
function generarFactura(){
  if(!usuario){toast("Inicia sesión","e");abrirModal("mLogin");return;}
  if(!carrito.length){toast("Carrito vacío","e");return;}
  var total=carrito.reduce(function(s,x){return s+x.p*x.qty;},0),iva=total*.16;
  var numFact="NST-"+new Date().getFullYear()+"-"+String(contFact++).padStart(5,"0");
  var fecha=new Date().toLocaleDateString("es-CO",{year:"numeric",month:"long",day:"numeric"});
  var rows=carrito.map(function(it){return '<tr><td>'+(it.e||"📦")+' '+it.n+'</td><td style="text-align:center">'+it.qty+'</td><td style="text-align:right">'+bs(it.p)+'</td><td style="text-align:right;font-weight:700">'+bs(it.p*it.qty)+'</td></tr>';}).join("");
  document.getElementById("factBody").innerHTML='<div class="fact-logo"><span>Nuestro</span>Store</div><div class="fact-sub">NIT: 900.123.456-7 · Bogotá, Colombia<br>Teléfono: +57 601 000 0000</div><hr style="border:1px solid #f0f0f0;margin-bottom:16px"/><div class="fact-info"><p><strong>N° Factura:</strong> '+numFact+'</p><p><strong>Fecha:</strong> '+fecha+'</p><p><strong>Cliente:</strong> '+usuario.n+' '+usuario.a+'</p><p><strong>Correo:</strong> '+usuario.email+'</p></div><table class="fact-table"><thead><tr><th>Producto</th><th style="text-align:center">Cant.</th><th style="text-align:right">Precio</th><th style="text-align:right">Total</th></tr></thead><tbody>'+rows+'</tbody></table><div style="text-align:right;font-size:.85rem;color:#555;margin-bottom:4px">Subtotal: '+bs(total)+'</div><div style="text-align:right;font-size:.85rem;color:#555;margin-bottom:4px">IVA (19%): '+bs(iva)+'</div><div class="fact-total">TOTAL A PAGAR: '+bs(total+iva)+'</div><div class="fact-footer">Gracias por su compra · NuestroStore</div>';
  document.getElementById("factOverlay").classList.add("show");document.body.style.overflow="hidden";
}
function cerrarFactura(){document.getElementById("factOverlay").classList.remove("show");document.body.style.overflow="";}
function imprimirFactura(){var v=window.open("","_blank","width=600,height=800");v.document.write('<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"/><title>Factura NuestroStore</title><link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;700;800;900&display=swap" rel="stylesheet"/><style>body{font-family:Nunito,sans-serif;padding:32px;max-width:500px;margin:0 auto;}.fact-logo{font-size:2rem;font-weight:900;color:#E65100;letter-spacing:2px;text-align:center;}.fact-logo span{color:#1A1A1A;}.fact-sub{text-align:center;color:#757575;font-size:.8rem;margin-bottom:16px;}.fact-info{background:#f8f8f8;border-radius:8px;padding:12px;margin-bottom:14px;font-size:.85rem;}.fact-info strong{color:#E65100;}.fact-table{width:100%;border-collapse:collapse;margin-bottom:14px;font-size:.85rem;}.fact-table th{background:#E65100;color:#fff;padding:8px 10px;text-align:left;}.fact-table td{padding:7px 10px;border-bottom:1px solid #f0f0f0;}.fact-total{text-align:right;font-size:1.1rem;font-weight:900;color:#E65100;padding:10px 0;border-top:2px solid #E65100;}.fact-footer{text-align:center;color:#757575;font-size:.75rem;margin-top:14px;padding-top:10px;border-top:1px solid #f0f0f0;}@media print{button{display:none;}}</style></head><body>'+document.getElementById("factBody").innerHTML+'<button onclick="window.print()" style="width:100%;padding:12px;background:#E65100;color:#fff;border:none;border-radius:8px;font-weight:900;font-size:1rem;cursor:pointer;margin-top:12px">🖨️ Imprimir / PDF</button></body></html>');v.document.close();}

// ── REPORTE ──────────────────────────────────
function abrirRep(pid){if(!usuario){toast("Inicia sesión","e");abrirModal("mLogin");return;}document.getElementById("rPid").value=pid||0;document.getElementById("rDesc").value="";var sel=document.getElementById("rProdSel");if(sel)sel.innerHTML='<option value="0">-- General --</option>'+PRODS.map(function(p){return '<option value="'+p.id+'"'+(p.id==pid?' selected':'')+'>'+(emojiProd(p))+' '+p.n+'</option>';}).join("");abrirModal("mRep");}
function enviarRep(){if(!usuario){toast("Inicia sesión","e");return;}var desc=document.getElementById("rDesc").value.trim(),tipo=document.getElementById("rTipo").value,sel=document.getElementById("rProdSel"),pid=sel?parseInt(sel.value)||0:0;if(!desc){toast("Describe el problema","e");return;}api("/reportes","POST",{uid:usuario.id,pid:pid,tipo:tipo,desc:desc}).then(function(r){if(!r.ok){toast("Error","e");return;}document.getElementById("rDesc").value="";cerrarModal("mRep");toast("✅ Reporte enviado","s");});}

// ── RESPONDER REPORTE (mejorado) ─────────────
function abrirRespRep(rid){
  var rep=REPORTES.find(function(r){return r.id===rid;});if(!rep)return;
  var estLabel={pendiente:"⏳ Pendiente",en_revision:"🔄 En Revisión",resuelto:"✅ Resuelto"}[rep.estado]||rep.estado;
  var estCls={pendiente:"rep-est-pendiente",en_revision:"rep-est-revision",resuelto:"rep-est-resuelto"}[rep.estado]||"";
  var userAva=(rep.uAvatar&&rep.uAvatar.length<8)?rep.uAvatar:(rep.uNom||"U")[0];
  var html='<div class="rep-card" style="margin-bottom:0;border:none">'+
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
function enviarRespuesta(){var rid=parseInt(document.getElementById("respRepId").value),resp=document.getElementById("respRepTxt").value.trim(),est=document.getElementById("respRepEst").value;if(!resp){toast("Escribe una respuesta","e");return;}var admin=usuario?usuario.n+" "+usuario.a:"Admin";api("/reportes/"+rid+"/responder","POST",{respuesta:resp,estado:est,admin:admin}).then(function(r){if(!r.ok){toast("Error","e");return;}cerrarModal("mRespRep");toast("Respuesta enviada ✅","s");renderAdminTab();if(usuario&&usuario.rol==="superadmin"){invalidateSCache(["reportes"]);renderSuperTab();}});}

// ── PANEL CLIENTE ────────────────────────────
// ── GLOBAL ONCLICK HELPERS (sin argumentos = sin problemas de comillas) ──
function abrirLogin(){ abrirModal("mLogin"); }
function abrirRegistro(){ abrirModal("mReg"); }
function abrirCarritoBtn(){ abrirCarrito(); }
function panelEditarPerfil(){ cerrarModal("mPanel"); setTimeout(abrirPerfil, 50); }
function panelSalir(){ cerrarModal("mPanel"); cerrarSesion(); }
function cerrarPanelBtn(){ cerrarModal("mPanel"); }
function cerrarLoginBtn(){ cerrarModal("mLogin"); }
function cerrarRegBtn(){ cerrarModal("mReg"); }

function abrirCuentaCliente(){
  document.getElementById("panT").textContent="👤 Mi Cuenta";
  var pb=document.getElementById("panB");
  var userAva=usuario.avatar?(usuario.avatar.length<8?usuario.avatar:'<img src="'+usuario.avatar+'" style="width:52px;height:52px;object-fit:cover;border-radius:50%"/>'):(usuario.n[0]);
  pb.innerHTML='<div style="background:linear-gradient(135deg,var(--na3),var(--na2));border-radius:14px;padding:18px;color:#fff;margin-bottom:20px;display:flex;align-items:center;gap:14px">'+
    '<div style="width:52px;height:52px;border-radius:50%;background:var(--am);color:var(--na3);display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:900;flex-shrink:0;overflow:hidden">'+userAva+'</div>'+
    '<div><div style="font-weight:800;font-size:1.1rem">'+usuario.n+' '+usuario.a+'</div><div style="opacity:.85;font-size:.85rem">'+usuario.email+'</div>'+
    '<span style="background:var(--am);color:var(--na3);padding:2px 10px;border-radius:50px;font-size:.72rem;font-weight:900;margin-top:4px;display:inline-block">👤 Cliente</span></div></div>'+
    '<div style="display:flex;gap:8px;margin-bottom:12px">'+
      '<button class="bp" style="flex:1;font-size:.85rem;padding:10px" onclick="panelEditarPerfil()">✏️ Editar Perfil</button>'+
      '<button class="bs" style="flex:1;font-size:.85rem;padding:10px;margin-top:0" onclick="panelSalir()">🚪 Salir</button>'+
    '</div>'+
    '<button onclick="mpPanelToggle()" id="mpPanelBtn" style="width:100%;margin-bottom:18px;padding:10px 14px;border-radius:10px;border:2px solid #e0d0c0;background:#fff8f0;font-weight:800;font-size:.85rem;cursor:pointer;display:flex;align-items:center;justify-content:space-between;color:var(--na3)">'+mpPanelBtnLabel()+'</button>'+
    '<div class="tabs"><button class="tab on" onclick="cTabN(this,2)">🛍️ Mis Compras</button><button class="tab" onclick="cTabN(this,5)">💙 Favoritos</button><button class="tab" onclick="cTabN(this,1)">🚨 Reportes</button><button class="tab" onclick="cTabN(this,3)">📋 Historial</button><button class="tab" onclick="cTabN(this,4)">⭐ Reseñas</button></div>'+
    '<div id="cTabBody"></div>';
  cTabN(pb.querySelector(".tab"),2);
  abrirModal("mPanel");
}
function cTabN(btn,t){
  document.querySelectorAll("#panB .tab").forEach(function(b){b.classList.remove("on");});btn.classList.add("on");
  var c=document.getElementById("cTabBody");
  c.innerHTML='<div style="text-align:center;padding:24px;color:var(--gr)">Cargando…</div>';
  if(t===1){api("/mis-reportes/"+usuario.id).then(function(r){if(r.ok)REPORTES=r.reportes;c.innerHTML=renderMisReportes(REPORTES);});}
  else if(t===2){api("/mis-pedidos/"+usuario.id).then(function(r){if(r.ok)PEDIDOS=r.pedidos;c.innerHTML=renderMisPedidos(PEDIDOS);});}
  else if(t===3){
    Promise.all([api("/mis-pedidos/"+usuario.id),api("/mis-reportes/"+usuario.id)]).then(function(res){
      if(res[0].ok)PEDIDOS=res[0].pedidos;if(res[1].ok)REPORTES=res[1].reportes;
      c.innerHTML=renderHistorial(PEDIDOS,REPORTES);
    });
  } else if(t===5){ c.innerHTML=renderWishlist(); } else{api("/resenias").then(function(r){if(!r.ok){c.innerHTML='<div class="empty"><div class="eico">⭐</div><h3>Sin reseñas</h3></div>';return;}var mis=r.resenias.filter(function(x){return x.uid===usuario.id;});if(!mis.length){c.innerHTML='<div class="empty"><div class="eico">⭐</div><h3>Sin reseñas aún</h3></div>';return;}c.innerHTML='<div style="display:flex;flex-direction:column;gap:10px">'+mis.map(function(res){var pn=(PRODS.find(function(p){return p.id===res.pid;})||{n:"Producto"}).n;return '<div style="border:2px solid #f0f0f0;border-radius:12px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><strong style="color:var(--na3)">'+pn+'</strong><span style="color:#f59e0b">'+starsHtml(res.estrellas)+'</span></div><p style="font-size:.88rem;color:#444">'+res.comentario+'</p><small style="color:var(--gr)">'+res.fecha+'</small></div>';}).join("")+'</div>';});}
}

function renderMisReportes(lista){
  if(!lista||!lista.length)return '<div class="empty"><div class="eico">📋</div><h3>Sin reportes</h3><p>¿Encontraste un problema? Avísanos.</p></div><button class="bp" style="margin-top:12px" onclick="cerrarModal(\"mProd\");abrirRep(0)">+ Enviar Reporte</button>';
  return '<div style="display:flex;flex-direction:column;gap:10px">'+lista.map(function(r){
    var col=r.estado==="resuelto"?"#2e7d32":r.estado==="en_revision"?"#1565c0":"#e65100";
    var lbl=r.estado==="resuelto"?"✅ Resuelto":r.estado==="en_revision"?"🔄 En revisión":"⏳ Pendiente";
    var bg=r.estado==="resuelto"?"#e8f5e9":r.estado==="en_revision"?"#e3f2fd":"#fff3e0";
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
  var totalGastado=lista.reduce(function(s,p){return s+(p.total||0);},0);
  var totalItems=lista.reduce(function(s,p){return s+(p.items?p.items.reduce(function(a,i){return a+(i.qty||1);},0):0);},0);
  // Stats strip
  var stats=(
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
  var filtro=(
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
  var cards=lista.map(function(ped,idx){
    var estadoColor={procesado:"#2e7d32",enviado:"#1565c0",entregado:"#7b1fa2",cancelado:"#c62828"}[ped.estado]||"#2e7d32";
    var estadoBg={procesado:"#e8f5e9",enviado:"#e3f2fd",entregado:"#f3e5f5",cancelado:"#ffebee"}[ped.estado]||"#e8f5e9";
    var estadoLabel={procesado:t("procesado"),enviado:t("enviado"),entregado:t("entregado"),cancelado:t("cancelado")}[ped.estado]||t("procesado");
    var subtotal=ped.total||0;
    var iva=subtotal*0.16;
    var totalConIva=subtotal+iva;
    var items=ped.items||[];
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
            var p=PRODS.find(function(x){return x.id===it.id;})||{};
            var imgEl=it.img||p.img
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
  var estado=document.getElementById("histEstado");
  var estVal=estado?estado.value:"";
  var ql=(q||"").toLowerCase();
  document.querySelectorAll(".historial-card").forEach(function(card){
    var search=card.getAttribute("data-search")||"";
    var cardEst=card.getAttribute("data-estado")||"";
    var matchQ=!ql||search.indexOf(ql)>=0;
    var matchE=!estVal||cardEst===estVal;
    card.style.display=(matchQ&&matchE)?"":"none";
  });
}

function abrirRepDesdePedido(pedId){
  cerrarModal("mPanel");
  setTimeout(function(){abrirRep(0,pedId);},150);
}

function verFacturaPedido(idx){
  var pedidos=PEDIDOS;
  if(!pedidos||!pedidos[idx])return;
  var ped=pedidos[idx];
  carrito=ped.items.map(function(it){return{id:it.id,n:it.n,p:it.p,qty:it.qty||1,e:it.e,img:it.img};});
  generarFactura(ped.id);
}


function renderHistorial(pedidos,reportes){
  var eventos=[];
  (pedidos||[]).forEach(function(p){eventos.push({tipo:"pedido",fecha:p.fecha,data:p});});
  (reportes||[]).forEach(function(r){eventos.push({tipo:"reporte",fecha:r.fecha,data:r});});
  eventos.sort(function(a,b){return (b.fecha||"").localeCompare(a.fecha||"");});
  if(!eventos.length)return '<div class="empty"><div class="eico">📋</div><h3>Sin historial</h3><p>Tus compras y reportes aparecerán aquí.</p></div>';
  return '<div style="position:relative">'+
    '<div style="position:absolute;left:18px;top:0;bottom:0;width:2px;background:linear-gradient(180deg,var(--na2),var(--am));border-radius:2px;z-index:0"></div>'+
    '<div style="display:flex;flex-direction:column;gap:12px;padding-left:44px;position:relative;z-index:1">'+
    eventos.map(function(ev){
      var isPedido=ev.tipo==="pedido";var d=ev.data;
      var dot=isPedido?
        '<div style="position:absolute;left:-30px;top:14px;width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,var(--na3),var(--na2));border:3px solid #fff;box-shadow:0 2px 8px rgba(255,109,0,.3);display:flex;align-items:center;justify-content:center;font-size:.6rem">🛒</div>':
        '<div style="position:absolute;left:-30px;top:14px;width:20px;height:20px;border-radius:50%;background:linear-gradient(135deg,#1565c0,#42a5f5);border:3px solid #fff;box-shadow:0 2px 8px rgba(21,101,192,.3);display:flex;align-items:center;justify-content:center;font-size:.6rem">🚨</div>';
      if(isPedido){
        var estadoLabel={procesado:"✅ Procesado",enviado:"🚚 Enviado",entregado:"📦 Entregado",cancelado:"❌ Cancelado"}[d.estado]||"✅ Procesado";
        var nItems=d.items?d.items.reduce(function(s,i){return s+(i.qty||1);},0):0;
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
        var col=d.estado==="resuelto"?"#2e7d32":d.estado==="en_revision"?"#1565c0":"#e65100";
        var lbl=d.estado==="resuelto"?"✅ Resuelto":d.estado==="en_revision"?"🔄 En revisión":"⏳ Pendiente";
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
  var modal = document.getElementById("mIdiomaMoneda");
  if(!modal){
    modal = document.createElement("div");
    modal.id = "mIdiomaMoneda";
    modal.className = "ov";
    document.body.appendChild(modal);
    modal.addEventListener("click", function(e){ if(e.target===modal) cerrarModal("mIdiomaMoneda"); });
  }

  var curOpts = [
    {code:"COP", sym:"COP$",  name:"Peso Colombiano",    flag:"🇨🇴", sub:"Colombia"},
    {code:"USD", sym:"$",     name:"Dólar",              flag:"🇺🇸", sub:"Estados Unidos"},
    {code:"COP", sym:"COP$",  name:"Peso Colombiano",    flag:"🇨🇴", sub:"Colombia"},
    {code:"MXN", sym:"MX$",   name:"Peso Mexicano",      flag:"🇲🇽", sub:"México"},
    {code:"ARS", sym:"AR$",   name:"Peso Argentino",     flag:"🇦🇷", sub:"Argentina"},
    {code:"CLP", sym:"CL$",   name:"Peso Chileno",       flag:"🇨🇱", sub:"Chile"},
    {code:"PEN", sym:"S/.",   name:"Sol Peruano",        flag:"🇵🇪", sub:"Perú"},
    {code:"BRL", sym:"R$",    name:"Real Brasileño",     flag:"🇧🇷", sub:"Brasil"}
  ];

  var curHTML = curOpts.map(function(c){
    var isSel = CURRENCY===c.code;
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
    var isSel = b.dataset.cur===CURRENCY;
    b.classList.toggle("ilm-sel", isSel);
    var check = b.querySelector(".ilm-check");
    if(isSel && !check){
      var sp=document.createElement("span");sp.className="ilm-check";sp.textContent="✓";b.appendChild(sp);
    } else if(!isSel && check){
      check.remove();
    }
  });
}

function abrirPanel(){if(!usuario){abrirModal("mLogin");return;}if(usuario.rol==="administrador"){document.getElementById("panT").textContent="⚙️ Panel Administrador";buildAdmin();abrirModal("mPanel");}else if(usuario.rol==="superadmin"){document.getElementById("panT").textContent="👑 Super Administrador";buildSuper();abrirModal("mPanel");}else{abrirCuentaCliente();}}
function buildAdmin(){var pb=document.getElementById("panB");var userAvaAdmin=usuario.avatar?(usuario.avatar.startsWith("data:")||/^\p{Emoji}/u.test(usuario.avatar)||usuario.avatar.length<=8)?usuario.avatar:'<img src="'+usuario.avatar+'" style="width:32px;height:32px;object-fit:cover;border-radius:50%"/>':(usuario.n[0]);pb.innerHTML='<div class="panel-user-bar">'+'<div class="pub-ava">'+userAvaAdmin+'</div>'+'<div class="pub-info"><div class="pub-name">'+usuario.n+' '+usuario.a+'</div><div class="pub-role">⚙️ Administrador</div></div>'+'<div class="pub-actions">'+'<button class="pub-btn pub-btn-edit" onclick="panelEditarPerfil()">✏️ Perfil</button>'+'<button class="pub-btn pub-btn-exit" onclick="panelSalir()">🚪 Salir</button>'+'</div></div>'+'<div class="tabs"><button class="tab'+(aTab==="productos"?" on":"")+'" onclick="setATab(\'productos\',this)">📦 Productos</button><button class="tab'+(aTab==="agregar"?" on":"")+'" onclick="setATab(\'agregar\',this)">'+(editId?"💾 Editar":"➕ Añadir")+'</button><button class="tab'+(aTab==="categorias"?" on":"")+'" onclick="setATab(\'categorias\',this)">🏷️ Categorías</button><button class="tab'+(aTab==="reportes"?" on":"")+'" onclick="setATab(\'reportes\',this)">🚨 Reportes</button><button class="tab'+(aTab==="mensajes"?" on":"")+'" onclick="setATab(\'mensajes\',this)" id="tabMensajesAdmin">📬 Mensajes</button></div><div id="aTB"></div>';renderAdminTab();}
function setATab(t,btn){aTab=t;document.querySelectorAll("#panB .tab").forEach(function(b){b.classList.remove("on");});btn.classList.add("on");renderAdminTab();}
function renderAdminTab(){api("/reportes").then(function(r){if(r.ok){REPORTES=r.reportes;_renderAdminTab();}else _renderAdminTab();});}
function _renderAdminTab(){
  var c=document.getElementById("aTB");if(!c)return;
  if(aTab==="productos"){
    c.innerHTML='<div class="tw"><table><thead><tr><th>Img</th><th>Nombre</th><th>Precio</th><th>Stock</th><th>Acc.</th></tr></thead><tbody>'+
      PRODS.map(function(p){var thumb=p.img?'<img src="'+p.img+'" style="width:44px;height:44px;object-fit:cover;border-radius:10px;box-shadow:0 2px 6px rgba(0,0,0,.1)"/>':'<div style="width:44px;height:44px;border-radius:10px;background:linear-gradient(135deg,#EFF6FF,#DBEAFE);display:flex;align-items:center;justify-content:center;font-size:1.4rem">'+emojiProd(p)+'</div>';var stBg=p.st<=0?'#FEF2F2':p.st<=10?'#FFFBEB':'#F0FDF4';var stColor=p.st<=0?'#DC2626':p.st<=10?'#D97706':'#16A34A';var stIcon=p.st<=0?' 🚫':p.st<=10?' ⚠️':'';var ofBadge=p.o?'<span style="background:#EFF6FF;color:#1E40AF;font-size:.65rem;font-weight:800;padding:2px 7px;border-radius:50px;margin-left:5px">OFERTA</span>':'';return '<tr>'+'<td>'+thumb+'</td>'+'<td><div style="font-weight:700;font-size:.88rem">'+p.n+ofBadge+'</div><small style="color:#94A3B8;font-size:.72rem">'+p.cat+'</small></td>'+'<td><span style="font-weight:800;color:#1E3A8A;font-family:Bebas Neue,cursive;font-size:1rem">'+bs(p.o||p.p)+'</span>'+(p.o?'<br><small style="color:#94A3B8;text-decoration:line-through;font-size:.72rem">'+bs(p.p)+'</small>':'')+'</td>'+'<td><span style="background:'+stBg+';color:'+stColor+';font-weight:800;font-size:.82rem;padding:4px 10px;border-radius:8px">'+p.st+stIcon+'</span></td>'+'<td style="white-space:nowrap">'+'<button class="bte" onclick="editP('+p.id+')" title="Editar">✏️</button>'+'<button class="btd" onclick="elimP('+p.id+')" title="Eliminar">🗑️</button>'+(p.img?'<button class="btd" title="Quitar foto" onclick="elimFoto('+p.id+')">🖼️</button>':'')+'</td></tr>';}).join('')+'</tbody></table></div>';
  }else if(aTab==="agregar"){
    var imgPv=(newPF.img||imgTempAdmin)?'<img src="'+(imgTempAdmin||newPF.img)+'" class="img-preview" id="imgPrev"/>':'<div id="imgPrev" style="display:none"></div>';
    var quitarFotoBtn=(editId&&(newPF.img||imgTempAdmin))?'<button class="btd" style="margin-top:6px;font-size:.8rem" onclick="quitarFotoFormAdmin()">🖼️✕ Quitar foto actual</button>':'';
    c.innerHTML='<div class="f2"><div class="fg"><label>Nombre *</label><input class="fc" id="nNom" value="'+(newPF.n||"")+'"/></div><div class="fg"><label>Categoría</label><select class="fc" id="nCat">'+CATS.filter(function(x){return x.id>0;}).map(function(x){return '<option value="'+x.id+'"'+(x.id===newPF.cat?" selected":"")+'>'+x.n+'</option>';}).join("")+'</select></div></div><div class="fg"><label>Descripción</label><textarea class="fc" id="nDesc" rows="3" style="resize:vertical">'+(newPF.d||"")+'</textarea></div><div class="f2"><div class="fg"><label>Precio (COP$) *</label><input class="fc" type="number" id="nPrecio" value="'+(newPF.p||"")+'" step="0.01"/></div><div class="fg"><label>Precio Oferta</label><input class="fc" type="number" id="nOferta" value="'+(newPF.o||"")+'" step="0.01"/></div></div><div class="f2"><div class="fg"><label>Stock *</label><input class="fc" type="number" id="nStock" value="'+(newPF.st||"")+'"/></div><div class="fg"><label>¿Destacado?</label><select class="fc" id="nDest"><option value="false">No</option><option value="true"'+(newPF.dest?" selected":"")+'>Sí ⭐</option></select></div></div><div class="fg"><label>📷 Foto</label>'+imgPv+quitarFotoBtn+'<div class="img-upload-area"><input type="file" accept="image/*" onchange="cargarImgProd(event)"/><span style="font-size:2rem;display:block;margin-bottom:6px">📷</span><span style="font-size:.85rem;color:var(--gr)">'+(newPF.img||imgTempAdmin?"Cambiar foto":"Subir foto")+'</span></div></div><button class="bp" onclick="guardarProd()">'+(editId?"💾 Guardar Cambios":"➕ Crear Producto")+'</button>'+(editId?'<button class="bs" onclick="cancelEdit()">Cancelar</button>':"");
  }else if(aTab==="categorias"){
    _renderCategorias(c);
  }else{
    if(!REPORTES.length){c.innerHTML='<div class="empty"><div class="eico">✅</div><h3>Sin reportes</h3></div>';return;}
    c.innerHTML='<div style="display:flex;flex-direction:column;gap:0">'+REPORTES.map(function(r){
      var estCls={pendiente:"rep-est-pendiente",en_revision:"rep-est-revision",resuelto:"rep-est-resuelto"}[r.estado]||"";
      var estLabel={pendiente:"⏳ Pendiente",en_revision:"🔄 Revisión",resuelto:"✅ Resuelto"}[r.estado]||r.estado;
      var userAva=(r.uNom||"U")[0];
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
      var noLeidos=msgs.filter(function(m){return !m.leido;}).length;
      c.innerHTML=(noLeidos?'<div style="margin-bottom:12px;background:#fff3e0;border:1.5px solid #ffb74d;border-radius:10px;padding:10px 14px;font-size:.85rem;font-weight:800;color:#e65100">🔔 '+noLeidos+' mensaje'+(noLeidos!==1?"s":"")+" sin leer</div>":"")+
      '<div style="display:flex;flex-direction:column;gap:10px">'+msgs.map(function(m){
        var badge=m.leido?'<span style="background:#e8f5e9;color:#2e7d32;font-size:.7rem;font-weight:800;padding:3px 9px;border-radius:50px">✅ Leído</span>':'<span style="background:#fff3e0;color:#e65100;font-size:.7rem;font-weight:800;padding:3px 9px;border-radius:50px">🔔 Nuevo</span>';
        var asuntoLabel={"pedido":"📦 Pedido","producto":"🛍️ Producto","devolucion":"↩️ Devolución","pago":"💳 Pago","envio":"🚚 Envío","queja":"😟 Queja","otro":"💬 Otro"}[m.asunto]||m.asunto;
        var prioBadge=m.prioridad?'<span class="prio-badge-'+(m.prioridad||"normal")+"'>"+(m.prioridad==="urgente"?"🔴 Urgente":m.prioridad==="informativo"?"🔵 Info":"🟢 Normal")+"</span>":"";
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
  var cats=r.ok?r.categorias:[];
  var html='';
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
      var prodCount=PRODS.filter(function(p){return p.cid===cat.id;}).length;
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

function crearCategoria(){var nom=(document.getElementById("catNom").value||"").trim(),emoji=(document.getElementById("catEmoji").value||"🏷️").trim();if(!nom){toast("Nombre requerido","e");return;}api("/categorias","POST",{nombre:nom,emoji:emoji}).then(function(r){if(!r.ok){toast(r.error||"Error","e");return;}toast("Categoría '"+nom+"' creada ✅","s");document.getElementById("catNom").value="";document.getElementById("catEmoji").value="";cargarDatos();_renderAdminTab();});}
function elimCategoria(id,nom){
  if(nom===undefined){var cc=CATS.find(function(x){return x.id===id;});nom=cc?cc.nombre:("#"+id);}if(!confirm("¿Eliminar '"+nom+"'?"))return;api("/categorias/"+id,"DELETE").then(function(r){if(!r.ok){toast(r.error||"No se puede eliminar","e");return;}toast("Eliminada","i");cargarDatos();_renderAdminTab();});}
function elimFoto(pid){if(!confirm("¿Eliminar foto?"))return;api("/productos/"+pid+"/foto","PUT").then(function(r){if(!r.ok){toast("Error","e");return;}var p=PRODS.find(function(x){return x.id===pid;});if(p)p.img=null;toast("Foto eliminada ✅","s");cargarDatos();_renderAdminTab();});}
function quitarFotoFormAdmin(){if(!editId)return;if(!confirm("¿Quitar la foto de este producto?"))return;api("/productos/"+editId+"/foto","PUT").then(function(r){if(!r.ok){toast("Error al quitar foto","e");return;}var p=PRODS.find(function(x){return x.id===editId;});if(p)p.img=null;imgTempAdmin=null;newPF.img=null;toast("Foto quitada ✅","s");cargarDatos();aTab="agregar";buildAdmin();});}
function quitarFotoFormSuper(){if(!spEditId)return;if(!confirm("¿Quitar la foto de este producto?"))return;api("/productos/"+spEditId+"/foto","PUT").then(function(r){if(!r.ok){toast("Error al quitar foto","e");return;}var p=PRODS.find(function(x){return x.id===spEditId;});if(p)p.img=null;imgTempSuper=null;spNewPF.img=null;toast("Foto quitada ✅","s");cargarDatos();sprodTab("add",document.getElementById("spTabAdd"));});}
function cargarImgProd(e){var file=e.target.files[0];if(!file)return;var r=new FileReader();r.onload=function(ev){imgTempAdmin=ev.target.result;var prev=document.getElementById("imgPrev");if(prev){prev.src=imgTempAdmin;prev.style.display="block";prev.className="img-preview";}};r.readAsDataURL(file);}
function editP(id){var p=PRODS.find(function(x){return x.id===id;});if(!p)return;editId=id;imgTempAdmin=p.img||null;newPF={n:p.n,d:p.d,p:p.p,o:p.o||"",st:p.st,cat:p.cid,dest:p.dest,img:p.img||null};aTab="agregar";buildAdmin();}
function cancelEdit(){editId=null;imgTempAdmin=null;newPF={n:"",d:"",p:"",o:"",st:"",cat:1,dest:false,img:null};aTab="productos";buildAdmin();}
function guardarProd(){var n=document.getElementById("nNom").value.trim(),pr=parseFloat(document.getElementById("nPrecio").value),st=parseInt(document.getElementById("nStock").value);if(!n||isNaN(pr)||isNaN(st)){toast("Completa los campos","e");return;}var cid=parseInt(document.getElementById("nCat").value),cat=CATS.find(function(c){return c.id===cid;}),catN=cat?cat.n.replace(/^\S+\s/,""):"General";var o=parseFloat(document.getElementById("nOferta").value)||null,dest=document.getElementById("nDest").value==="true",desc=document.getElementById("nDesc").value;var img=imgTempAdmin||(editId?(PRODS.find(function(p){return p.id===editId;})||{}).img:null)||null;var wasEdit=editId;api(editId?"/productos/"+editId:"/productos",editId?"PUT":"POST",{n:n,d:desc,p:pr,o:o,st:st,cat:catN,cid:cid,dest:dest,img:img}).then(function(r){if(!r.ok){toast("Error","e");return;}editId=null;imgTempAdmin=null;newPF={n:"",d:"",p:"",o:"",st:"",cat:1,dest:false,img:null};toast(wasEdit?"Actualizado ✅":"¡Creado! ✅","s");cargarDatos();aTab="productos";buildAdmin();});}
function elimP(id){if(!confirm("¿Eliminar?"))return;api("/productos/"+id,"DELETE").then(function(r){if(!r.ok){toast("Error","e");return;}toast("Eliminado","i");cargarDatos();buildAdmin();});}

// ── SUPERADMIN ───────────────────────────────

function _notifBanner(count, singular, plural, color, borderColor, action, actionLabel) {
  if(count <= 0) return '';
  var noun = count !== 1 ? plural : singular;
  var banner = '<div class="notif-banner notif-banner-warn">';
  banner += '<span style="font-size:1.1rem">⚠️</span>';
  banner += '<span>Tienes <strong>' + count + '</strong> ' + noun;
  if(action) banner += '. <span style="cursor:pointer;text-decoration:underline;color:#1E40AF" onclick="'+action+'">'+actionLabel+'</span>';
  banner += '</span></div>';
  return banner;
}

function marcarMensajeLeido(id){
  api("/contactos/"+id+"/leer","PUT").then(function(r){
    if(!r.ok){toast("Error al marcar","e");return;}
    var m=CONTACTOS.find(function(x){return x.id===id;});
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
  var cod=document.getElementById("cpCod").value.trim().toUpperCase();
  var tipo=document.getElementById("cpTipo").value;
  var val=parseFloat(document.getElementById("cpVal").value);
  var min=parseFloat(document.getElementById("cpMin").value)||0;
  var usos=parseInt(document.getElementById("cpUsos").value)||100;
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
function buildSuper(){var pb=document.getElementById("panB");var userAvaSuper=usuario.avatar?(usuario.avatar.startsWith("data:")||/^\p{Emoji}/u.test(usuario.avatar)||usuario.avatar.length<=8)?usuario.avatar:'<img src="'+usuario.avatar+'" style="width:32px;height:32px;object-fit:cover;border-radius:50%"/>':(usuario.n[0]);var userBar='<div class="panel-user-bar">'+'<div class="pub-ava">'+userAvaSuper+'</div>'+'<div class="pub-info"><div class="pub-name">'+usuario.n+' '+usuario.a+'</div><div class="pub-role">👑 Super Admin</div></div>'+'<div class="pub-actions">'+'<button class="pub-btn pub-btn-edit" onclick="panelEditarPerfil()">✏️ Perfil</button>'+'<button class="pub-btn pub-btn-exit" onclick="panelSalir()">🚪 Salir</button>'+'</div></div>';var tbs=[{k:"stats",l:"📊 Stats"},{k:"users",l:"👥 Usuarios"},{k:"prods",l:"📦 Productos"},{k:"categorias",l:"🏷️ Categorías"},{k:"reportes",l:"🚨 Reportes"},{k:"mensajes",l:"📬 Mensajes",id:"tabMensajesSuper"},{k:"cadmin",l:"➕ Admin"},{k:"cupones",l:"🎫 Cupones"},{k:"logs",l:"📋 Logs"}];var html=tbs.map(function(t){var id=t.id?' id="'+t.id+'"':'';var on=' onclick="setSTab(\''+t.k+'\',this)"';return '<button class="tab'+(sTab===t.k?' on':'')+'"'+id+on+'>'+t.l+'</button>';}).join("");pb.innerHTML=userBar+'<div class="tabs">'+html+'</div><div id="sTB"></div>';
// Al abrir el panel siempre refrescar la pestaña stats
if(sTab==="stats")invalidateSCache(["prods","users","reportes","contactos"]);
renderSuperTab();}
function setSTab(t,btn){sTab=t;document.querySelectorAll("#panB .tab").forEach(function(b){b.classList.remove("on");});btn.classList.add("on");renderSuperTab();}
// Cache de timestamps para las APIs del superadmin (0 = nunca cargado)
var _sCache={prods:0,users:0,reportes:0,logs:0,contactos:0};
var _sCacheTTL=30000; // 30 segundos

function _sNeedsRefresh(key){return Date.now()-_sCache[key]>_sCacheTTL;}
function _sMarkFresh(key){_sCache[key]=Date.now();}
function invalidateSCache(keys){
  (keys||["prods","users","reportes","logs","contactos"]).forEach(function(k){_sCache[k]=0;});
}

function renderSuperTab(){
  // Show spinner immediately
  var c=document.getElementById("sTB");
  if(c&&!c.innerHTML.trim()){
    c.innerHTML='<div class="tab-loading"></div>';
  }

  // Build fetch list based on active tab + staleness
  var fetches=[];

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
function _renderSuperTab(){
  var c=document.getElementById("sTB");if(!c)return;
  if(sTab==="stats"){
    var cl=USUARIOS.filter(function(u){return u.rol==="cliente";}).length;
    var ad=USUARIOS.filter(function(u){return u.rol==="administrador";}).length;
    var sinLeer=CONTACTOS.filter(function(m){return !m.leido;}).length;
    var pendientes=REPORTES.filter(function(r){return r.estado==="pendiente";}).length;
    var agotados=PRODS.filter(function(p){return p.st<=0;}).length;
    var enOferta=PRODS.filter(function(p){return p.o&&p.o<p.p&&p.st>0;}).length;
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
  }else if(sTab==="users"){
    c.innerHTML='<div class="tw"><table><thead><tr><th>Nombre</th><th>Rol</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>'+USUARIOS.map(function(u){var bc=u.rol==="superadmin"?"bsu":u.rol==="administrador"?"ba":"bc";return '<tr><td><div style="display:flex;align-items:center;gap:8px"><div style="width:30px;height:30px;border-radius:50%;background:var(--am);color:var(--na3);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:.8rem;flex-shrink:0">'+(u.n[0])+'</div><div><strong>'+u.n+' '+u.a+'</strong><br><small style="color:var(--gr)">'+u.email+'</small></div></div></td><td><span class="bdg '+bc+'">'+u.rol+'</span></td><td><span class="bdg '+(u.act?"bok":"bno")+'">'+(u.act?"✅":"❌")+'</span></td><td>'+(u.rol!=="superadmin"?'<select onchange="cambiarRol('+u.id+',this.value)" style="padding:3px 6px;border:1px solid #ddd;border-radius:5px;font-size:.75rem"><option value="cliente"'+(u.rol==="cliente"?" selected":"")+'>Cliente</option><option value="administrador"'+(u.rol==="administrador"?" selected":"")+'>Admin</option></select><button class="'+(u.act?"btd":"btok")+'" onclick="togUser('+u.id+')">'+(u.act?"🚫":"✅")+'</button>':'<em style="color:var(--gr);font-size:.8rem">Propietario</em>')+'</td></tr>';}).join("")+'</tbody></table></div>';
  }else if(sTab==="prods"){
    c.innerHTML='<div class="tabs" style="margin-bottom:14px"><button class="tab on" id="spTabList" onclick="sprodTab(\'list\',this)">📋 Lista</button><button class="tab" id="spTabAdd" onclick="sprodTab(\'add\',this)">➕ Agregar</button></div><div id="spBody"></div>';
    sprodTab("list",document.getElementById("spTabList"));
  }else if(sTab==="categorias"){
    _renderCategorias(c);
  }else if(sTab==="reportes"){
    if(!REPORTES.length){c.innerHTML='<div class="empty"><div class="eico">✅</div><h3>Sin reportes</h3></div>';return;}
    c.innerHTML='<div style="display:flex;flex-direction:column;gap:0">'+REPORTES.map(function(r){
      var estCls={pendiente:"rep-est-pendiente",en_revision:"rep-est-revision",resuelto:"rep-est-resuelto"}[r.estado]||"";
      var estLabel={pendiente:"⏳ Pendiente",en_revision:"🔄 Revisión",resuelto:"✅ Resuelto"}[r.estado]||r.estado;
      var ua=(r.uNom||"U")[0];
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
    var noLeidos=CONTACTOS.filter(function(m){return !m.leido;}).length;
    c.innerHTML='<div style="margin-bottom:12px;display:flex;align-items:center;gap:10px"><strong style="font-size:.9rem">📬 Bandeja de entrada</strong>'+(noLeidos?'<span style="background:linear-gradient(135deg,var(--na3),var(--na2));color:#fff;font-size:.72rem;font-weight:900;padding:3px 10px;border-radius:50px">'+noLeidos+' nuevo'+(noLeidos>1?'s':'')+'</span>':'')+'</div>'+
    '<div style="display:flex;flex-direction:column;gap:10px">'+CONTACTOS.map(function(m){
      var badge=m.leido?'<span style="background:#e8f5e9;color:#2e7d32;font-size:.7rem;font-weight:800;padding:3px 9px;border-radius:50px">✅ Leído</span>':'<span style="background:#fff3e0;color:#e65100;font-size:.7rem;font-weight:800;padding:3px 9px;border-radius:50px">🔔 Nuevo</span>';
      var asuntoLabel={"pedido":"📦 Pedido","producto":"🛍️ Producto","devolucion":"↩️ Devolución","pago":"💳 Pago","envio":"🚚 Envío","queja":"😟 Queja","otro":"💬 Otro"}[m.asunto]||m.asunto;
        var prioBadge=m.prioridad?'<span class="prio-badge-'+(m.prioridad||"normal")+"'>"+(m.prioridad==="urgente"?"🔴 Urgente":m.prioridad==="informativo"?"🔵 Info":"🟢 Normal")+"</span>":"";
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
      var cps=r.cupones||[];
      var form='<div style="background:#EFF6FF;border:1.5px solid #93C5FD;border-radius:14px;padding:16px;margin-bottom:16px">'
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
      var tabla=cps.length
        ?'<div class="tw"><table><thead><tr><th>Código</th><th>Tipo</th><th>Valor</th><th>Usos</th><th>Estado</th><th></th></tr></thead><tbody>'
        +cps.map(function(cp){
          var val=cp.tipo==="porcentaje"?cp.valor+"%":"COP$ "+cp.valor.toLocaleString();
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
function sprodTab(t,btn){document.querySelectorAll("#sTB .tabs .tab").forEach(function(b){b.classList.remove("on");});btn.classList.add("on");var sb=document.getElementById("spBody");if(!sb)return;if(t==="list"){sb.innerHTML='<div class="tw"><table><thead><tr><th>Img</th><th>Nombre</th><th>Precio</th><th>Stock</th><th>Acc.</th></tr></thead><tbody>'+PRODS.map(function(p){var thumb=p.img?'<img src="'+p.img+'" style="width:38px;height:38px;object-fit:cover;border-radius:6px;"/>':'<span style="font-size:1.3rem">'+emojiProd(p)+'</span>';var sc=p.st<=0?"#c62828":p.st<=10?"#f57f17":"#2e7d32";return '<tr><td>'+thumb+'</td><td><strong>'+p.n+'</strong><br><small style="color:var(--gr)">'+p.cat+'</small></td><td style="color:var(--na3);font-weight:700">'+bs(p.o||p.p)+'</td><td style="color:'+sc+';font-weight:800">'+p.st+(p.st<=0?" 🚫":p.st<=10?" ⚠️":"")+'</td><td><button class="bte" onclick="spEdit('+p.id+')">✏️</button><button class="btd" onclick="spElim('+p.id+')">🗑️</button>'+(p.img?'<button class="btd" style="background:#e3f2fd;color:#1565c0" onclick="elimFotoSp('+p.id+')">🖼️✕</button>':'')+'</td></tr>';}).join("")+'</tbody></table></div>';}else{var imgPv=(imgTempSuper||spNewPF.img)?'<img src="'+(imgTempSuper||spNewPF.img)+'" class="img-preview" id="spImgPrev"/>':'<div id="spImgPrev" style="display:none"></div>';var quitarFotoBtnSp=(spEditId&&(spNewPF.img||imgTempSuper))?'<button class="btd" style="margin-top:6px;font-size:.8rem" onclick="quitarFotoFormSuper()">🖼️✕ Quitar foto actual</button>':'';sb.innerHTML='<div class="f2"><div class="fg"><label>Nombre *</label><input class="fc" id="spNom" value="'+(spNewPF.n||"")+'"/></div><div class="fg"><label>Categoría</label><select class="fc" id="spCat">'+CATS.filter(function(c){return c.id>0;}).map(function(c){return '<option value="'+c.id+'"'+(c.id===spNewPF.cat?" selected":"")+'>'+c.n+'</option>';}).join("")+'</select></div></div><div class="fg"><label>Descripción</label><textarea class="fc" id="spDesc" rows="2" style="resize:vertical">'+(spNewPF.d||"")+'</textarea></div><div class="f2"><div class="fg"><label>Precio *</label><input class="fc" type="number" id="spPrecio" value="'+(spNewPF.p||"")+'" step="0.01"/></div><div class="fg"><label>Precio Oferta</label><input class="fc" type="number" id="spOferta" value="'+(spNewPF.o||"")+'" step="0.01"/></div></div><div class="f2"><div class="fg"><label>Stock *</label><input class="fc" type="number" id="spStock" value="'+(spNewPF.st||"")+'"/></div><div class="fg"><label>¿Destacado?</label><select class="fc" id="spDest"><option value="false">No</option><option value="true"'+(spNewPF.dest?" selected":"")+'>Sí ⭐</option></select></div></div><div class="fg"><label>📷 Foto</label>'+imgPv+quitarFotoBtnSp+'<div class="img-upload-area"><input type="file" accept="image/*" onchange="cargarImgSuper(event)"/><span style="font-size:2rem;display:block;margin-bottom:6px">📷</span><span style="font-size:.85rem;color:var(--gr)">'+(imgTempSuper||spNewPF.img?"Cambiar foto":"Subir foto")+'</span></div></div><button class="bp" onclick="spGuardar()">'+(spEditId?"💾 Guardar":"➕ Crear Producto")+'</button>'+(spEditId?'<button class="bs" onclick="spCancelar()">Cancelar</button>':"");}}
function cargarImgSuper(e){var file=e.target.files[0];if(!file)return;var r=new FileReader();r.onload=function(ev){imgTempSuper=ev.target.result;var prev=document.getElementById("spImgPrev");if(prev){prev.src=imgTempSuper;prev.style.display="block";prev.className="img-preview";}};r.readAsDataURL(file);}
function spEdit(id){var p=PRODS.find(function(x){return x.id===id;});if(!p)return;spEditId=id;imgTempSuper=p.img||null;spNewPF={n:p.n,d:p.d,p:p.p,o:p.o||"",st:p.st,cat:p.cid,dest:p.dest,img:p.img||null};sprodTab("add",document.getElementById("spTabAdd"));}
function spCancelar(){spEditId=null;imgTempSuper=null;spNewPF={n:"",d:"",p:"",o:"",st:"",cat:1,dest:false,img:null};sprodTab("list",document.getElementById("spTabList"));}
function spGuardar(){var n=document.getElementById("spNom").value.trim(),pr=parseFloat(document.getElementById("spPrecio").value),st=parseInt(document.getElementById("spStock").value);if(!n||isNaN(pr)||isNaN(st)){toast("Completa campos","e");return;}var cid=parseInt(document.getElementById("spCat").value),cat=CATS.find(function(c){return c.id===cid;}),catN=cat?cat.n.replace(/^\S+\s/,""):"General";var o=parseFloat(document.getElementById("spOferta").value)||null,dest=document.getElementById("spDest").value==="true",desc=document.getElementById("spDesc").value;var img=imgTempSuper||(spEditId?(PRODS.find(function(p){return p.id===spEditId;})||{}).img:null)||null;var wasEdit=spEditId;api(spEditId?"/productos/"+spEditId:"/productos",spEditId?"PUT":"POST",{n:n,d:desc,p:pr,o:o,st:st,cat:catN,cid:cid,dest:dest,img:img}).then(function(r){if(!r.ok){toast("Error","e");return;}spEditId=null;imgTempSuper=null;spNewPF={n:"",d:"",p:"",o:"",st:"",cat:1,dest:false,img:null};toast(wasEdit?"Actualizado ✅":"¡Creado! ✅","s");invalidateSCache(["prods"]);cargarDatos();sprodTab("list",document.getElementById("spTabList"));});}
function spElim(id){if(!confirm("¿Eliminar?"))return;api("/productos/"+id,"DELETE").then(function(r){if(!r.ok){toast("Error","e");return;}toast("Eliminado","i");invalidateSCache(["prods"]);cargarDatos();sprodTab("list",document.getElementById("spTabList"));});}
function elimFotoSp(pid){if(!confirm("¿Eliminar foto?"))return;api("/productos/"+pid+"/foto","PUT").then(function(r){if(!r.ok){toast("Error","e");return;}var p=PRODS.find(function(x){return x.id===pid;});if(p)p.img=null;toast("Foto eliminada ✅","s");cargarDatos();sprodTab("list",document.getElementById("spTabList"));});}
function cambiarRol(id,rol){api("/usuarios/"+id+"/rol","PUT",{rol:rol}).then(function(r){if(!r.ok){toast("Error","e");return;}toast("Rol actualizado → "+rol,"s");invalidateSCache(["users"]);renderSuperTab();});}
function togUser(id){api("/usuarios/"+id+"/toggle","PUT").then(function(r){if(!r.ok){toast("Error","e");return;}toast("Estado actualizado","i");invalidateSCache(["users"]);renderSuperTab();});}
function crearAdmin(){var n=document.getElementById("aNom").value.trim(),a=document.getElementById("aApe").value.trim(),e=document.getElementById("aEmail").value.trim().toLowerCase(),p=document.getElementById("aPass").value;if(!n||!a||!e||!p){toast("Completa todo","e");return;}if(p.length<8){toast("Contraseña mínimo 8","e");return;}api("/usuarios/admin","POST",{n:n,a:a,email:e,password:p}).then(function(r){if(!r.ok){toast(r.error||"Error","e");return;}toast("Admin "+n+" creado 👑","s");invalidateSCache(["users"]);sTab="users";buildSuper();});}

// ── INIT ─────────────────────────────────────
document.addEventListener("DOMContentLoaded",function(){
  document.querySelectorAll(".anioActual").forEach(function(el){el.textContent=new Date().getFullYear();});

  // Overlay: cerrar al tocar fuera del modal
  document.querySelectorAll(".ov").forEach(function(ov){
    ov.addEventListener("click",function(e){if(e.target===ov)cerrarModal(ov.id);});
  });

  // Login: Enter key navigation
  var lPass=document.getElementById("lPass"),lEmail=document.getElementById("lEmail");
  if(lPass)lPass.addEventListener("keydown",function(e){if(e.key==="Enter")doLogin();});
  if(lEmail)lEmail.addEventListener("keydown",function(e){if(e.key==="Enter")lPass&&lPass.focus();});

  // Header scroll effect
  var hdr=document.getElementById("hdr");
  if(hdr){window.addEventListener("scroll",function(){hdr.classList.toggle("scrolled",window.scrollY>10);},{passive:true});}

  _loadSearchHistory();
  initSearch();
  mpInit();
  aplicarIdioma();
  aplicarDarkMode(DARK_MODE); // Apply saved dark mode preference
  irPagina("inicio");
  // Show loading skeleton while data loads
  var pI = document.getElementById("pInicio");
  if(pI && !PRODS.length){
    var sk = document.getElementById("skeletonLoader");
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
    var carritoGuardado = localStorage.getItem("ns_carrito");
    if(carritoGuardado) carrito = JSON.parse(carritoGuardado);
  }catch(e){ carrito = []; }
  // Restaurar wishlist
  cargarWishlist();

  // Restaurar sesión desde localStorage al recargar
  var guardado = localStorage.getItem("ns_usuario");
  if(guardado){
    try{
      var u = JSON.parse(guardado);
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
var mp = {
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
    var item = mp.playlist[mp.current];
    if(item) item.dur = mpFmtTime(mp.audio.duration);
    mpRenderPlaylist();
    mpUpdateDur();
  });
  mp.audio.addEventListener("error", function(){
    toast("No se pudo reproducir este archivo 🎵", "e");
    mpNext();
  });

  // Arrastrar barra de progreso
  var pb = document.getElementById("mpProgressBg");
  if(pb){
    pb.addEventListener("mousedown", function(e){ mp.dragging=true; mpSeek(e); });
    pb.addEventListener("touchstart", function(e){ mp.dragging=true; mpSeekTouch(e); }, {passive:true});
    document.addEventListener("mousemove", function(e){ if(mp.dragging) mpSeek(e); });
    document.addEventListener("touchmove", function(e){ if(mp.dragging) mpSeekTouch(e); }, {passive:true});
    document.addEventListener("mouseup", function(){ mp.dragging=false; });
    document.addEventListener("touchend", function(){ mp.dragging=false; });
  }

  // Actualizar gradiente del slider de volumen en tiempo real
  var vs = document.getElementById("mpVolSlider");
  if(vs) vs.addEventListener("input", function(){ mpUpdateVolGradient(); });

  mpUpdateVolGradient();
}

// ── Actualizar reproductor según sesión ──
function mpRefreshAuth(){
  var panel = document.getElementById("mpPanel");
  var wrap  = document.getElementById("musicPlayer");
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
        '    <button class="mp-hbtn" onclick="mpAddFiles()" title="Agregar canciones">➕</button>',
        '    <button class="mp-hbtn" onclick="mpToggle()" title="Minimizar">—</button>',
        '    <button class="mp-hbtn mp-hbtn-hide" onclick="mpHide()" title="Ocultar">✕</button>',
        '  </div>',
        '</div>',
        '<input type="file" id="mpFileInput" accept="audio/*" multiple style="display:none" onchange="mpLoadFiles(event)"/>',
        '<div class="mp-empty" id="mpEmpty" onclick="mpAddFiles()">',
        '  <div class="mp-empty-ico">🎵</div>',
        '  <div class="mp-empty-txt">Toca para agregar música</div>',
        '  <div class="mp-empty-sub">MP3, WAV, OGG, FLAC y más</div>',
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
      var pb = document.getElementById("mpProgressBg");
      if(pb){
        pb.addEventListener("mousedown", function(e){ mp.dragging=true; mpSeek(e); });
        pb.addEventListener("touchstart", function(e){ mp.dragging=true; mpSeekTouch(e); }, {passive:true});
      }
      var vs = document.getElementById("mpVolSlider");
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
  var wrap = document.getElementById("musicPlayer");
  if(!wrap) return;
  // Si no hay usuario, mostrar estado bloqueado en lugar del panel
  if(!usuario){
    var panel = document.getElementById("mpPanel");
    if(panel){
      wrap.classList.toggle("mp-collapsed");
      mpRenderLocked();
    }
    return;
  }
  var wasCollapsed = wrap.classList.contains("mp-collapsed");
  wrap.classList.toggle("mp-collapsed");
  // Al abrir el panel, mostrar canciones si ya están cargadas
  if(wasCollapsed && mp.playlist.length > 0){
    mpShowPlayer();
    mpRenderPlaylist();
  }
}

// ── Mostrar mensaje de "inicia sesión" en el panel ──
function mpRenderLocked(){
  var panel = document.getElementById("mpPanel");
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
  var wrap = document.getElementById("musicPlayer");
  var hidden = wrap && wrap.classList.contains("mp-hidden");
  if(hidden){
    return '<span>Reproductor oculto</span><span style="font-size:.75rem;background:#e8f5e9;color:#2e7d32;padding:2px 8px;border-radius:50px">Mostrar</span>';
  }
  return '<span>Reproductor visible</span><span style="font-size:.75rem;background:#fff0e0;color:var(--na3);padding:2px 8px;border-radius:50px">Ocultar</span>';
}

function mpPerfilToggle(){
  var wrap = document.getElementById("musicPlayer");
  if(!wrap) return;
  if(wrap.classList.contains("mp-hidden")){
    mpShow();
  } else {
    mpHide();
  }
  var btn = document.getElementById("mpPerfilBtn");
  if(btn) btn.innerHTML = mpPerfilBtnLabel();
}

function mpPanelBtnLabel(){
  var wrap = document.getElementById("musicPlayer");
  var hidden = wrap && wrap.classList.contains("mp-hidden");
  if(hidden){
    return '<span>🎵 Reproductor de música</span><span style="font-size:.75rem;background:#e8f5e9;color:#2e7d32;padding:2px 8px;border-radius:50px">Mostrar</span>';
  }
  return '<span>🎵 Reproductor de música</span><span style="font-size:.75rem;background:#fff0e0;color:var(--na3);padding:2px 8px;border-radius:50px">Ocultar</span>';
}

// ── Alternar visibilidad del reproductor desde el perfil ──
function mpPanelToggle(){
  var wrap = document.getElementById("musicPlayer");
  if(!wrap) return;
  if(wrap.classList.contains("mp-hidden")){
    mpShow();
  } else {
    mpHide();
  }
  // Actualizar el botón en tiempo real
  var btn = document.getElementById("mpPanelBtn");
  if(btn) btn.innerHTML = mpPanelBtnLabel();
}

function mpHide(){
  var wrap = document.getElementById("musicPlayer");
  if(!wrap) return;
  wrap.classList.add("mp-hidden");
  wrap.classList.add("mp-collapsed");
  // Sin botón flotante — se controla desde el perfil
}

// ── Mostrar de nuevo el reproductor ──
function mpShow(){
  var wrap = document.getElementById("musicPlayer");
  if(!wrap) return;
  wrap.classList.remove("mp-hidden");
}

// ── Abrir selector de archivos (solo si hay sesión) ──
function mpAddFiles(){
  if(!usuario){ toast("Inicia sesión para agregar música","e"); abrirModal("mLogin"); return; }
  var fi = document.getElementById("mpFileInput");
  if(fi) fi.click();
}

// ── Cargar archivos seleccionados ──
function mpLoadFiles(e){
  var files = Array.from(e.target.files || []);
  if(!files.length) return;

  var pending = 0, added = 0;
  files.forEach(function(f){
    if(!f.type.startsWith("audio/") && !/\.(mp3|wav|ogg|flac|aac|m4a|opus|weba)$/i.test(f.name)) return;
    pending++;
    var name = f.name.replace(/\.[^.]+$/, "");
    var reader = new FileReader();
    reader.onload = function(ev){
      var b64 = ev.target.result; // data:audio/...;base64,...
      // Guardar en BD si hay usuario
      if(usuario){
        api("/musica/"+usuario.id, "POST", {nombre:name, datos:b64, duracion:"--"}).then(function(r){
          if(r.ok){
            var objUrl = URL.createObjectURL(f);
            mp.playlist.push({id:r.id, name:name, dur:"—", url:objUrl, objUrl:objUrl, b64:b64});
          } else {
            // Sin BD, usar solo en memoria
            var objUrl = URL.createObjectURL(f);
            mp.playlist.push({name:name, dur:"—", url:objUrl, objUrl:objUrl});
          }
          added++;
          pending--;
          if(pending === 0) mpLoadFilesDone(added);
        }).catch(function(){
          var objUrl = URL.createObjectURL(f);
          mp.playlist.push({name:name, dur:"—", url:objUrl, objUrl:objUrl});
          added++; pending--;
          if(pending === 0) mpLoadFilesDone(added);
        });
      } else {
        var objUrl = URL.createObjectURL(f);
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

// ── Cargar playlist desde BD al iniciar sesión ──
var _mpCargando = false;
var _mpYaCargo = false;
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
    var tracks = r.tracks;
    var loaded = 0;
    tracks.forEach(function(t){
      // Cargar datos del track
      api("/musica/"+usuario.id+"/"+t.id).then(function(tr){
        if(!tr.ok) return;
        var b64 = tr.track.datos;
        // Convertir base64 a blob URL
        try{
          var arr = b64.split(","), mime = arr[0].match(/:(.*?);/)[1];
          var bstr = atob(arr[1]), n = bstr.length, u8 = new Uint8Array(n);
          while(n--){ u8[n] = bstr.charCodeAt(n); }
          var blob = new Blob([u8], {type:mime});
          var objUrl = URL.createObjectURL(blob);
          mp.playlist.push({id:t.id, name:t.nombre, dur:t.duracion||"—", url:objUrl, objUrl:objUrl});
        }catch(ex){ return; }
        loaded++;
        if(loaded === tracks.length){
          // Solo mostrar UI si el panel está abierto
          var w = document.getElementById("musicPlayer");
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
  mp.current = idx;

  var item = mp.playlist[idx];
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
  var next;
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
  var prev;
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
  var btn = document.getElementById("mpShuffleBtn");
  if(btn) btn.classList.toggle("active", mp.shuffle);
  if(mp.shuffle){
    // Generar orden aleatorio
    mp.shuffleOrder = mp.playlist.map(function(_,i){return i;});
    for(var i = mp.shuffleOrder.length - 1; i > 0; i--){
      var j = Math.floor(Math.random() * (i+1));
      var tmp = mp.shuffleOrder[i]; mp.shuffleOrder[i]=mp.shuffleOrder[j]; mp.shuffleOrder[j]=tmp;
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
  var btn = document.getElementById("mpRepeatBtn");
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
  var bg = document.getElementById("mpProgressBg");
  if(!bg) return;
  var rect = bg.getBoundingClientRect();
  var x = Math.max(0, Math.min(e.clientX - rect.left, rect.width));
  var pct = x / rect.width;
  if(mp.audio.duration){ mp.audio.currentTime = pct * mp.audio.duration; }
}
function mpSeekTouch(e){
  if(e.touches && e.touches[0]) mpSeek(e.touches[0]);
}

// ── Actualizar barra de progreso ──
function mpOnTimeUpdate(){
  if(mp.dragging) return;
  var fill = document.getElementById("mpProgressFill");
  var thumb = document.getElementById("mpThumb");
  var cur = document.getElementById("mpCurTime");
  if(!fill || !mp.audio.duration) return;
  var pct = (mp.audio.currentTime / mp.audio.duration) * 100;
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
  var ico = document.getElementById("mpVolIco");
  if(!ico) return;
  if(mp.muted || mp.volume === 0) ico.textContent = "🔇";
  else if(mp.volume < 40) ico.textContent = "🔈";
  else if(mp.volume < 70) ico.textContent = "🔉";
  else ico.textContent = "🔊";
}
function mpUpdateVolGradient(){
  var vs = document.getElementById("mpVolSlider");
  if(!vs) return;
  var pct = vs.value + "%";
  vs.style.background = "linear-gradient(90deg,var(--na) " + pct + ",#e0d0c4 " + pct + ")";
}

// ── Actualizar NOW PLAYING ──
function mpUpdateNowPlaying(){
  var item = mp.playlist[mp.current];
  if(!item) return;
  var nm = document.getElementById("mpTrackName");
  var art = document.getElementById("mpArt");
  if(nm) nm.textContent = item.name;
  if(art){ art.textContent = "🎵"; art.style.borderRadius = "12px"; }
  document.getElementById("mpPlayerWrap") && document.getElementById("mpPlayerWrap").classList.add("mp-playing");
  var panel = document.getElementById("mpPanel");
  if(panel) panel.classList.add("mp-playing");
  mpUpdateDur();
  mpRenderPlaylist();
}
function mpUpdateDur(){
  var total = document.getElementById("mpTotalTime");
  if(total && mp.audio.duration) total.textContent = mpFmtTime(mp.audio.duration);
}

// ── Íconos play/pausa ──
function mpSetPlayIcon(playing){
  var btn = document.getElementById("mpPlayBtn");
  if(btn) btn.textContent = playing ? "⏸" : "▶";
}

// ── FAB: mostrar ondas o nota ──
function mpUpdateFab(playing){
  var ico = document.getElementById("mpFabIco");
  var waves = document.getElementById("mpWaves");
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
  var list = document.getElementById("mpPlList");
  if(!list) return;
  if(!mp.playlist.length){ list.innerHTML = "<div style='text-align:center;padding:16px;color:#ccc;font-size:.8rem'>Sin canciones</div>"; return; }
  list.innerHTML = mp.playlist.map(function(item, i){
    var active = i === mp.current ? " active" : "";
    return "<div class='mp-pl-item" + active + "' onclick='mpPlay(" + i + ")'>" +
      "<span class='mp-pl-num'>" + (i+1) + "</span>" +
      "<span class='mp-pl-ico'>" + (i === mp.current && mp.playing ? "🔊" : "🎵") + "</span>" +
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
  var item = mp.playlist[idx];
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
  var m = Math.floor(secs / 60);
  var s = Math.floor(secs % 60);
  return m + ":" + (s < 10 ? "0" : "") + s;
}

// ── CONTACTO ─────────────────────────────────────────────────────────────────
function actualizarContador(){
  var ta=document.getElementById("cfMensaje");
  var cnt=document.getElementById("cfCharCount");
  if(!ta||!cnt)return;
  var n=ta.value.length,max=500;
  cnt.textContent=n+" / "+max;
  cnt.style.color=n>450?"#c62828":n>350?"#e65100":"var(--gr)";
}

function autocompletarContacto(){
  if(!usuario)return;
  var nm=document.getElementById("cfNombre"),em=document.getElementById("cfEmail"),tel=document.getElementById("cfTel");
  if(nm&&!nm.value)nm.value=(usuario.n||"")+" "+(usuario.a||"");
  if(em&&!em.value)em.value=usuario.email||"";
  if(tel&&!tel.value&&usuario.tel)tel.value=usuario.tel;
  var note=document.getElementById("cfLoginNote"),txt=document.getElementById("cfLoginNoteText");
  if(note){note.style.display="flex";}
  if(txt)txt.textContent="✨ Datos completados con tu cuenta";
}

function enviarContacto(){
  var nombre  = (document.getElementById("cfNombre")||{}).value||"";
  var email   = (document.getElementById("cfEmail")||{}).value||"";
  var tel     = (document.getElementById("cfTel")||{}).value||"";
  var asunto  = (document.getElementById("cfAsunto")||{}).value||"";
  var mensaje = (document.getElementById("cfMensaje")||{}).value||"";
  var prioEl  = document.querySelector('input[name="cfPrioridad"]:checked');
  var prioridad = prioEl ? prioEl.value : "normal";
  var errEl   = document.getElementById("cfErr");
  var okEl    = document.getElementById("cfOk");

  errEl.style.display="none";
  okEl.style.display="none";

  if(!nombre.trim()){errEl.textContent="Por favor escribe tu nombre.";errEl.style.display="block";return;}
  if(!email.trim()||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)){errEl.textContent="Escribe un correo electrónico válido.";errEl.style.display="block";return;}
  if(!asunto){errEl.textContent="Selecciona un asunto para tu mensaje.";errEl.style.display="block";return;}
  if(!mensaje.trim()||mensaje.trim().length<10){errEl.textContent="El mensaje debe tener al menos 10 caracteres.";errEl.style.display="block";return;}

  var btn=document.querySelector(".contact-send-btn");
  if(btn){btn.disabled=true;btn.textContent="Enviando…";}

  var payload={nombre:nombre.trim(),email:email.trim().toLowerCase(),tel:tel.trim(),asunto:asunto,mensaje:mensaje.trim(),prioridad:prioridad};

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
      var prio=document.querySelector('input[name="cfPrioridad"][value="normal"]');
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
  var isOpen = el.classList.contains("open");
  document.querySelectorAll(".cfaq-item").forEach(function(i){i.classList.remove("open");});
  if(!isOpen) el.classList.add("open");
}

// ── MENSAJES DE CONTACTO (helpers) ────────────────────────────
function marcarMensajeLeido(id){
  api("/contactos/"+id+"/leer","PUT").then(function(r){
    if(!r.ok){toast("Error","e");return;}
    var m=CONTACTOS.find(function(x){return x.id===id;});
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
