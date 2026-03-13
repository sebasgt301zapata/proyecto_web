// NuestroStore v9 — app.js
var PRODS=[],CATS=[{id:0,n:"🏷️ Todos"}],RESENIAS={},REPORTES=[],LOGS=[],PEDIDOS=[],USUARIOS=[];
var usuario=null,carrito=[],catActiva=0,busqueda="",sortActivo="def";
var aTab="productos",sTab="stats",editId=null,newPF={n:"",d:"",p:"",o:"",st:"",cat:1,dest:false,img:null};
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
function bs(n){return "Bs. "+Number(n).toLocaleString("es-VE",{minimumFractionDigits:2,maximumFractionDigits:2});}

// ── PÁGINAS ──────────────────────────────────
function irPagina(pg){
  paginaActual=pg;
  var ids={inicio:"pInicio",tienda:"pTienda"};
  Object.keys(ids).forEach(function(k){var el=document.getElementById(ids[k]);if(el)el.className=k===pg?"pagina active":"pagina";});
  document.querySelectorAll(".btab").forEach(function(b){b.classList.remove("on");var l=b.querySelector(".iline");if(l)l.style.display="none";});
  var bmap={inicio:"bt0",tienda:"bt1"};
  if(bmap[pg]){var btn=document.getElementById(bmap[pg]);if(btn){btn.classList.add("on");var l=btn.querySelector(".iline");if(l)l.style.display="block";}}
  document.querySelectorAll(".dnav-btn").forEach(function(b){b.classList.remove("active");});
  var dmap={inicio:"dnav0",tienda:"dnav1"};
  if(dmap[pg]){var db=document.getElementById(dmap[pg]);if(db)db.classList.add("active");}
  if(pg==="tienda"){cargarCats();renderProds();actualizarEstadsTienda();}
  if(pg==="inicio")renderInicio();
  window.scrollTo({top:0,behavior:"smooth"});
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
  if(paginaActual==="inicio")renderInicio();
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
function initSearch(){
  var inp=document.getElementById("sBusq"),sw=document.getElementById("swBox"),cl=document.getElementById("swClear"),sugg=document.getElementById("swSugg");
  if(!inp)return;
  inp.addEventListener("focus",function(){sw.classList.add("focused");mostrarSugerencias(inp.value);});
  inp.addEventListener("blur",function(){sw.classList.remove("focused");setTimeout(function(){sugg.style.display="none";},200);});
  inp.addEventListener("input",function(){
    var v=inp.value;
    if(cl)cl.style.display=v?"flex":"none";
    clearTimeout(swTimer);
    swTimer=setTimeout(function(){mostrarSugerencias(v);},150);
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
  if(catMatches.length){html+='<div class="sw-sugg-sep">Categorías</div>';html+=catMatches.map(function(c){return '<div class="sw-sugg-item" onclick="filtrarYVer(\''+c.id+'\')"><span class="sugg-ico">🏷️</span><span class="sugg-nm">'+resaltarTexto(c.n,q)+'</span></div>';}).join("");}
  html+='<div class="sw-sugg-sep">Productos</div>';
  html+=matches.map(function(p){
    var ico=p.img?'<img src="'+p.img+'" style="width:28px;height:28px;object-fit:cover;border-radius:6px;" />':(emojiProd(p));
    return '<div class="sw-sugg-item" onclick="verProd('+p.id+');document.getElementById(\'swSugg\').style.display=\'none\'"><span class="sugg-ico">'+ico+'</span><span class="sugg-nm">'+resaltarTexto(p.n,q)+'</span><span class="sugg-cat">'+p.cat+'</span></div>';
  }).join("");
  sugg.innerHTML=html;sugg.style.display="block";
}
function resaltarTexto(txt,q){var re=new RegExp("("+q.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+")","gi");return txt.replace(re,"<mark>$1</mark>");}
function filtrarYVer(catId){document.getElementById("swSugg").style.display="none";catActiva=parseInt(catId);irPagina("tienda");}
function limpiarBusqueda(){var inp=document.getElementById("sBusq");if(inp){inp.value="";busqueda="";inp.focus();}var cl=document.getElementById("swClear");if(cl)cl.style.display="none";var s=document.getElementById("swSugg");if(s)s.style.display="none";if(paginaActual==="tienda")renderProds();}
function buscar(){busqueda=(document.getElementById("sBusq")||{}).value||"";busqueda=busqueda.trim();document.getElementById("swSugg").style.display="none";if(paginaActual!=="tienda")irPagina("tienda");renderProds();}

// ── CARRUSEL (arreglado, sin dejar de girar) ─
var CR={ofertas:{idx:0,total:0,perPage:1,timer:null,items:[]},valorados:{idx:0,total:0,perPage:1,timer:null,items:[]}};

function carouselPerPage(){var w=window.innerWidth;return w<480?2:w<768?3:w<1100?4:5;}

function carouselInit(name,items,delay){
  var c=CR[name];c.items=items;c.idx=0;c.total=items.length;c.perPage=carouselPerPage();
  var track=document.getElementById("track"+cap(name));
  if(!track)return;
  // Render cards
  track.style.transition="none";
  track.innerHTML=items.map(function(html){return '<div class="pc" style="flex-shrink:0;width:var(--cw)">'+html+'</div>';}).join("");
  // Set CSS var for card width
  var outer=document.getElementById("outer"+cap(name));
  if(outer){var gap=16,pp=c.perPage,ow=outer.offsetWidth;var cw=Math.floor((ow-(gap*(pp-1)))/pp);outer.style.setProperty("--cw",cw+"px");}
  // Dots
  var maxDots=Math.max(1,c.total-c.perPage+1);
  var isDark=name==="valorados";
  var dots=document.getElementById("dots"+cap(name));
  if(dots)dots.innerHTML=Array.from({length:maxDots}).map(function(_,i){return '<span class="cdot'+(isDark?" cdot-dark":"")+(i===0?" on":"")+'"></span>';}).join("");
  carouselRender(name);
  if(c.timer)clearInterval(c.timer);
  if(c.total>c.perPage){c.timer=setInterval(function(){carouselNext(name);},delay||5000);}
}

function carouselRender(name){
  var c=CR[name];var track=document.getElementById("track"+cap(name));if(!track)return;
  var outer=document.getElementById("outer"+cap(name));if(!outer)return;
  var gap=16,pp=c.perPage,ow=outer.offsetWidth;var cw=Math.floor((ow-(gap*(pp-1)))/pp);
  // Update --cw
  outer.style.setProperty("--cw",cw+"px");
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
}

window.addEventListener("resize",function(){
  // Recalculate perPage on resize/orientation change
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
}

// ── TARJETA PRODUCTO ─────────────────────────
function tarjetaInner(p,showOferta,starsStr,cnt){
  var imgEl=p.img?'<img src="'+p.img+'" />':(
    '<span class="pi-emoji">'+emojiProd(p)+'</span>'
  );
  var starsEl=starsStr?'<div class="pstars">'+starsStr+(cnt?' <small style="color:var(--gr);font-size:.7rem">('+cnt+')</small>':'')+'</div>':"";
  var ofPct=(showOferta&&p.o&&p.p>0)?Math.round((1-p.o/p.p)*100):0;
  var pctBadge=ofPct>0?'<span class="pdesc-pct">-'+ofPct+'%</span>':"";
  return '<div class="pi">'+imgEl+
    ((showOferta&&p.o)||(!showOferta&&p.o)?'<span class="pbo">🔥 OFERTA</span>':'')+
    pctBadge+(p.dest?'<span class="pbd">⭐</span>':'')+
    '</div><div class="pif">'+
    '<div class="pcat">'+p.cat+'</div>'+
    '<div class="pnm">'+p.n+'</div>'+
    starsEl+
    '<div class="ppr"><span class="ppr-v">'+bs(p.o||p.p)+'</span>'+(p.o?'<span class="ppr-o">'+bs(p.p)+'</span>':'')+
    '</div><button class="badd" onclick="event.stopPropagation();addCart('+p.id+')">🛒 Agregar</button></div>';
}
function tarjetaHTML(p,showOferta,starsStr,cnt){
  return '<div class="pc" onclick="verProd('+p.id+')">'+tarjetaInner(p,showOferta,starsStr,cnt)+'</div>';
}

// ── TIENDA ──────────────────────────────────
function cargarCats(){var c=document.getElementById("cats");if(!c)return;c.innerHTML=CATS.map(function(cat){return '<button class="cc'+(cat.id===catActiva?" on":"")+'" onclick="filtCat('+cat.id+',this)">'+cat.n+'</button>';}).join("");}
function filtCat(id,btn){catActiva=id;document.querySelectorAll(".cc").forEach(function(b){b.classList.remove("on");});btn.classList.add("on");renderProds();}
function sortProds(val){sortActivo=val;renderProds();}
function prodsFiltrados(){return PRODS.filter(function(p){if(p.st<=0)return false;var mc=catActiva===0||p.cid===catActiva;var mb=!busqueda||p.n.toLowerCase().indexOf(busqueda.toLowerCase())>=0||(p.d||"").toLowerCase().indexOf(busqueda.toLowerCase())>=0;return mc&&mb;});}
function renderProds(){
  var g=document.getElementById("pg");if(!g)return;
  var lista=prodsFiltrados();
  if(sortActivo==="precioAsc")lista.sort(function(a,b){return (a.o||a.p)-(b.o||b.p);});
  else if(sortActivo==="precioDesc")lista.sort(function(a,b){return (b.o||b.p)-(a.o||a.p);});
  else if(sortActivo==="nombre")lista.sort(function(a,b){return a.n.localeCompare(b.n);});
  else if(sortActivo==="valorados")lista.sort(function(a,b){return promedioEstrellas(b.id)-promedioEstrellas(a.id);});
  if(!lista.length){g.innerHTML='<div style="grid-column:1/-1" class="empty"><div class="eico">🔍</div><h3>Sin resultados</h3><p>Prueba otra búsqueda</p></div>';return;}
  g.innerHTML=lista.map(function(p){var avg=promedioEstrellas(p.id);var stars=avg>0?starsHtml(avg):null;var cnt=RESENIAS[p.id]?RESENIAS[p.id].length:0;return tarjetaHTML(p,true,stars,cnt);}).join("");
}

// ── VER PRODUCTO ─────────────────────────────
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
    '<button class="bp" onclick="addCart('+p.id+');cerrarModal(\'mProd\')">🛒 Agregar al Carrito</button>')+
    (usuario&&!agotado?'<button class="bs" onclick="abrirResenia('+p.id+',\''+p.n.replace(/'/g,"\\'")+'\')">⭐ Escribir Reseña</button>':'')+
    (usuario?'<button class="bs" onclick="cerrarModal(\'mProd\');abrirRep('+p.id+')">🚨 Reportar Problema</button>':'')+resHtml;
  abrirModal("mProd");
}

// ── RESEÑAS ──────────────────────────────────
function selStar(v){starSelVal=v;document.getElementById("resEstrellas").value=v;document.querySelectorAll("#starSelector .star").forEach(function(s){s.classList.toggle("sel",parseInt(s.getAttribute("data-v"))<=v);});}
function abrirResenia(pid,nom){if(!usuario){toast("Inicia sesión","e");abrirModal("mLogin");return;}document.getElementById("resPid").value=pid;document.getElementById("resProdNom").textContent="📦 "+nom;document.getElementById("resComentario").value="";starSelVal=5;selStar(5);cerrarModal("mProd");abrirModal("mResenia");}
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
        '<div class="perfil-ava-edit" onclick="document.getElementById(\'perfilImgInput\').click()">📷</div>'+
        '<input type="file" id="perfilImgInput" accept="image/*" style="display:none" onchange="cargarAvatarImg(event)"/>'+
      '</div>'+
      '<div class="perfil-info">'+
        '<div class="perfil-nom">'+pf.nombre+' '+pf.apellido+'</div>'+
        '<div class="perfil-email">'+pf.email+'</div>'+
        '<div class="perfil-rol">'+rolLabel+'</div>'+
      '</div>'+
    '</div>'+
    '<div style="font-weight:800;font-size:.88rem;color:var(--gr2);margin-bottom:8px">Elige un avatar emoji:</div>'+
    '<div class="avatar-grid">'+AVATARES.map(function(av){return '<div class="ava-opt'+(perfilAvatarSel===av?" sel":"")+'" onclick="selAvatar(\''+av+'\')" title="'+av+'">'+av+'</div>';}).join("")+'</div>'+
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
    '<button class="bp" onclick="guardarPerfil()">💾 Guardar Cambios</button>';
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
    cerrarModal("mPerfil");toast("✅ Perfil actualizado","s");
    actualizarUI();
  });
}

// ── LOGIN / REGISTRO ─────────────────────────
function doLogin(){
  var emailEl=document.getElementById("lEmail"),passEl=document.getElementById("lPass"),errEl=document.getElementById("loginErr"),btnEl=document.getElementById("btnLogin");
  var email=emailEl.value.trim().toLowerCase(),pass=passEl.value;
  errEl.style.display="none";
  if(!email||!pass){errEl.textContent="⚠️ Correo y contraseña requeridos.";errEl.style.display="block";return;}
  btnEl.disabled=true;btnEl.textContent="Verificando...";
  api("/login","POST",{email:email,password:pass}).then(function(r){
    btnEl.disabled=false;btnEl.textContent="Entrar →";
    if(!r.ok){errEl.textContent="❌ "+(r.error||"Credenciales incorrectas.");errEl.style.display="block";passEl.value="";passEl.focus();return;}
    usuario=r.usuario;cerrarModal("mLogin");emailEl.value="";passEl.value="";errEl.style.display="none";
    toast("¡Bienvenido, "+usuario.n+"! ("+({cliente:"Cliente",administrador:"Admin",superadmin:"Super Admin"}[usuario.rol]||usuario.rol)+")","s");
    actualizarUI();cargarDatos();
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
    cerrarModal("mReg");actualizarUI();cargarDatos();toast("¡Bienvenido, "+nom+"! 🎉","s");
  });
}
function cerrarSesion(){usuario=null;carrito=[];actualizarUI();actualizarCarrito();toast("Sesión cerrada","i");}

// ── UI ───────────────────────────────────────
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
    navIcons.innerHTML=
      '<button class="nic cart-btn" onclick="abrirCarrito()" style="position:relative">🛒<span class="bdot" id="cartBadgeMobile" style="display:none">0</span></button>'+
      '<button class="nic" onclick="abrirPanel()" style="font-size:'+(usuario.avatar&&(usuario.avatar.startsWith("data:")||/^\p{Emoji}/u.test(usuario.avatar)||usuario.avatar.length<=8)&&usuario.avatar.length<=2?'1.2rem':'0.85rem')+'">'+avatarMobile+'</button>';
    deskActs.innerHTML=
      '<div class="hdr-cart-btn" onclick="abrirCarrito()">🛒<span class="hdr-cart-badge" id="cartBadgeDesk" style="display:none">0</span></div>'+
      '<div class="hdr-divider"></div>'+
      '<div class="uchip" onclick="abrirPerfil()">'+
        '<div class="ava">'+avatarContent+'</div>'+
        '<div class="uchip-body">'+
          '<div class="uchip-name">'+nombre+'</div>'+
          '<div class="uchip-role">'+rolEmoji+' '+rolLabel+'</div>'+
        '</div>'+
        '<span class="uchip-arrow">▾</span>'+
      '</div>'+
      panelBtn+
      '<button class="bdn bdn-o" style="padding:8px 12px;font-size:.78rem" onclick="cerrarSesion()">Salir</button>';
    if(bt3ico)bt3ico.innerHTML=avatarMobile;
  }else{
    navIcons.innerHTML=
      '<button class="nic" onclick="abrirModal(\'mLogin\')">👤</button>'+
      '<button class="nic cart-btn" onclick="abrirCarrito()" style="position:relative">🛒<span class="bdot" id="cartBadgeMobile" style="display:none">0</span></button>';
    deskActs.innerHTML=
      '<button class="bdn bdn-o" onclick="abrirModal(\'mLogin\')">Iniciar sesión</button>'+
      '<button class="bdn bdn-f" onclick="abrirModal(\'mReg\')">Registrarse →</button>';
    if(bt3ico)bt3ico.textContent="👤";
  }
  actualizarBadge();
  mpRefreshAuth();
}

// ── CARRITO ──────────────────────────────────
function addCart(id){if(!usuario){toast("Inicia sesión","e");abrirModal("mLogin");return;}var p=PRODS.find(function(x){return x.id===id;});if(!p||p.st<=0){toast("Producto agotado","e");return;}var ex=carrito.find(function(x){return x.id===id;});if(ex)ex.qty++;else carrito.push({id:p.id,n:p.n,p:(p.o||p.p),qty:1,e:emojiProd(p),img:p.img||null});actualizarCarrito();toast(p.n+" agregado 🛒","s");}
function cambiarQty(id,delta){var ex=carrito.find(function(x){return x.id===id;});if(!ex)return;ex.qty=Math.max(1,ex.qty+delta);actualizarCarrito();}
function quitarCart(id){carrito=carrito.filter(function(x){return x.id!==id;});actualizarCarrito();}
function actualizarCarrito(){
  var total=carrito.reduce(function(s,x){return s+x.p*x.qty;},0),count=carrito.reduce(function(s,x){return s+x.qty;},0);
  var totEl=document.getElementById("cTot");if(totEl)totEl.textContent=bs(total);
  actualizarBadge(count);
  var c=document.getElementById("cits");if(!c)return;
  if(!carrito.length){c.innerHTML='<div class="empty"><div class="eico">🛒</div><h3>Carrito vacío</h3><p>Agrega productos</p></div>';return;}
  c.innerHTML=carrito.map(function(it){var imgC=it.img?'<img src="'+it.img+'">':(it.e||"📦");return '<div class="cit"><div class="cimg">'+imgC+'</div><div class="cinf"><div class="cnm">'+it.n+'</div><div class="cpr">'+bs(it.p)+'</div><div class="qty-ctrl"><button class="qty-btn" onclick="cambiarQty('+it.id+',-1)">−</button><span style="font-weight:800;font-size:.9rem">'+it.qty+'</span><button class="qty-btn" onclick="cambiarQty('+it.id+',1)">+</button></div></div><button class="cdel" onclick="quitarCart('+it.id+')">🗑️</button></div>';}).join("");
}
function actualizarBadge(count){var n=count!==undefined?count:carrito.reduce(function(s,x){return s+x.qty;},0);["cartBadgeMobile","cartBadgeDesk","cartBadgeNav"].forEach(function(bid){var el=document.getElementById(bid);if(el){el.textContent=n;el.style.display=n>0?"flex":"none";}});}
function abrirCarrito(){actualizarCarrito();document.getElementById("csh").classList.add("open");document.getElementById("cov").classList.add("show");document.body.style.overflow="hidden";}
function cerrarCarrito(){document.getElementById("csh").classList.remove("open");document.getElementById("cov").classList.remove("show");document.body.style.overflow="";}
function pedido(){if(!usuario){toast("Inicia sesión","e");abrirModal("mLogin");return;}if(!carrito.length){toast("Carrito vacío","e");return;}var total=carrito.reduce(function(s,x){return s+x.p*x.qty;},0);api("/pedidos","POST",{uid:usuario.id,items:JSON.parse(JSON.stringify(carrito)),total:total}).then(function(r){if(!r.ok){toast("Error","e");return;}carrito=[];actualizarCarrito();cerrarCarrito();toast("¡Pedido procesado! 🎉","s");});}

// ── FACTURA ──────────────────────────────────
function generarFactura(){
  if(!usuario){toast("Inicia sesión","e");abrirModal("mLogin");return;}
  if(!carrito.length){toast("Carrito vacío","e");return;}
  var total=carrito.reduce(function(s,x){return s+x.p*x.qty;},0),iva=total*.16;
  var numFact="NST-"+new Date().getFullYear()+"-"+String(contFact++).padStart(5,"0");
  var fecha=new Date().toLocaleDateString("es-VE",{year:"numeric",month:"long",day:"numeric"});
  var rows=carrito.map(function(it){return '<tr><td>'+(it.e||"📦")+' '+it.n+'</td><td style="text-align:center">'+it.qty+'</td><td style="text-align:right">'+bs(it.p)+'</td><td style="text-align:right;font-weight:700">'+bs(it.p*it.qty)+'</td></tr>';}).join("");
  document.getElementById("factBody").innerHTML='<div class="fact-logo"><span>Nuestro</span>Store</div><div class="fact-sub">RIF: J-123456789 · Caracas, Venezuela<br>Teléfono: +58 212 000 0000</div><hr style="border:1px solid #f0f0f0;margin-bottom:16px"/><div class="fact-info"><p><strong>N° Factura:</strong> '+numFact+'</p><p><strong>Fecha:</strong> '+fecha+'</p><p><strong>Cliente:</strong> '+usuario.n+' '+usuario.a+'</p><p><strong>Correo:</strong> '+usuario.email+'</p></div><table class="fact-table"><thead><tr><th>Producto</th><th style="text-align:center">Cant.</th><th style="text-align:right">Precio</th><th style="text-align:right">Total</th></tr></thead><tbody>'+rows+'</tbody></table><div style="text-align:right;font-size:.85rem;color:#555;margin-bottom:4px">Subtotal: '+bs(total)+'</div><div style="text-align:right;font-size:.85rem;color:#555;margin-bottom:4px">IVA (16%): '+bs(iva)+'</div><div class="fact-total">TOTAL A PAGAR: '+bs(total+iva)+'</div><div class="fact-footer">Gracias por su compra · NuestroStore</div>';
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
function enviarRespuesta(){var rid=parseInt(document.getElementById("respRepId").value),resp=document.getElementById("respRepTxt").value.trim(),est=document.getElementById("respRepEst").value;if(!resp){toast("Escribe una respuesta","e");return;}var admin=usuario?usuario.n+" "+usuario.a:"Admin";api("/reportes/"+rid+"/responder","POST",{respuesta:resp,estado:est,admin:admin}).then(function(r){if(!r.ok){toast("Error","e");return;}cerrarModal("mRespRep");toast("Respuesta enviada ✅","s");renderAdminTab();if(usuario&&usuario.rol==="superadmin")renderSuperTab();});}

// ── PANEL CLIENTE ────────────────────────────
function abrirCuentaCliente(){
  document.getElementById("panT").textContent="👤 Mi Cuenta";
  var pb=document.getElementById("panB");
  var userAva=usuario.avatar?(usuario.avatar.length<8?usuario.avatar:'<img src="'+usuario.avatar+'" style="width:52px;height:52px;object-fit:cover;border-radius:50%"/>'):(usuario.n[0]);
  pb.innerHTML='<div style="background:linear-gradient(135deg,var(--na3),var(--na2));border-radius:14px;padding:18px;color:#fff;margin-bottom:20px;display:flex;align-items:center;gap:14px">'+
    '<div style="width:52px;height:52px;border-radius:50%;background:var(--am);color:var(--na3);display:flex;align-items:center;justify-content:center;font-size:1.5rem;font-weight:900;flex-shrink:0;overflow:hidden">'+userAva+'</div>'+
    '<div><div style="font-weight:800;font-size:1.1rem">'+usuario.n+' '+usuario.a+'</div><div style="opacity:.85;font-size:.85rem">'+usuario.email+'</div>'+
    '<span style="background:var(--am);color:var(--na3);padding:2px 10px;border-radius:50px;font-size:.72rem;font-weight:900;margin-top:4px;display:inline-block">👤 Cliente</span></div></div>'+
    '<div style="display:flex;gap:8px;margin-bottom:18px">'+
      '<button class="bp" style="flex:1;font-size:.85rem;padding:10px" onclick="cerrarModal(\'mPanel\');abrirPerfil()">✏️ Editar Perfil</button>'+
      '<button class="bs" style="flex:1;font-size:.85rem;padding:10px;margin-top:0" onclick="cerrarSesion();cerrarModal(\'mPanel\')">🚪 Salir</button>'+
    '</div>'+
    '<div class="tabs"><button class="tab on" onclick="cTabN(this,1)">🚨 Reportes</button><button class="tab" onclick="cTabN(this,2)">📦 Pedidos</button><button class="tab" onclick="cTabN(this,3)">⭐ Reseñas</button></div>'+
    '<div id="cTabBody"></div>';
  cTabN(pb.querySelector(".tab"),1);
  abrirModal("mPanel");
}
function cTabN(btn,t){
  document.querySelectorAll("#panB .tab").forEach(function(b){b.classList.remove("on");});btn.classList.add("on");
  var c=document.getElementById("cTabBody");
  if(t===1){api("/mis-reportes/"+usuario.id).then(function(r){if(r.ok)REPORTES=r.reportes;c.innerHTML=renderMisReportes(REPORTES);});}
  else if(t===2){api("/mis-pedidos/"+usuario.id).then(function(r){if(r.ok)PEDIDOS=r.pedidos;c.innerHTML=renderMisPedidos(PEDIDOS);});}
  else{api("/resenias").then(function(r){if(!r.ok){c.innerHTML='<div class="empty"><div class="eico">⭐</div><h3>Sin reseñas</h3></div>';return;}var mis=r.resenias.filter(function(x){return x.uid===usuario.id;});if(!mis.length){c.innerHTML='<div class="empty"><div class="eico">⭐</div><h3>Sin reseñas aún</h3></div>';return;}c.innerHTML='<div style="display:flex;flex-direction:column;gap:10px">'+mis.map(function(res){var pn=(PRODS.find(function(p){return p.id===res.pid;})||{n:"Producto"}).n;return '<div style="border:2px solid #f0f0f0;border-radius:12px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px"><strong style="color:var(--na3)">'+pn+'</strong><span style="color:#f59e0b">'+starsHtml(res.estrellas)+'</span></div><p style="font-size:.88rem;color:#444">'+res.comentario+'</p><small style="color:var(--gr)">'+res.fecha+'</small></div>';}).join("")+'</div>';});}
}
function renderMisReportes(lista){
  if(!lista||!lista.length)return '<div class="empty"><div class="eico">📋</div><h3>Sin reportes</h3></div><button class="bp" style="margin-top:12px" onclick="cerrarModal(\'mPanel\');abrirRep(0)">+ Enviar Reporte</button>';
  return '<div style="display:flex;flex-direction:column;gap:10px">'+lista.map(function(r){
    var col=r.estado==="resuelto"?"#2e7d32":r.estado==="en_revision"?"#1565c0":"#e65100";
    var lbl=r.estado==="resuelto"?"✅ Resuelto":r.estado==="en_revision"?"🔄 En revisión":"⏳ Pendiente";
    return '<div class="rep-card">'+
      '<div class="rep-card-head"><strong style="font-size:.88rem;flex:1">'+r.pNom+'</strong><span style="background:'+col+'22;color:'+col+';padding:2px 9px;border-radius:50px;font-size:.72rem;font-weight:800">'+lbl+'</span></div>'+
      '<div class="rep-card-body"><div style="color:var(--gr);font-size:.78rem;margin-bottom:6px">📅 '+r.fecha+' · 🏷️ '+r.tipo+'</div>'+
      '<div class="rep-desc-box">'+(r.desc||r.descripcion||"")+'</div>'+
      (r.respuesta?'<div class="rep-respuesta-box"><strong>💬 Respuesta ('+( r.respFecha||"")+'):</strong>'+r.respuesta+'</div>':'')+
      '</div></div>';
  }).join("")+'</div><button class="bp" style="margin-top:14px" onclick="cerrarModal(\'mPanel\');abrirRep(0)">+ Nuevo Reporte</button>';
}
function renderMisPedidos(lista){if(!lista||!lista.length)return '<div class="empty"><div class="eico">📦</div><h3>Sin pedidos aún</h3></div>';return '<div style="display:flex;flex-direction:column;gap:10px">'+lista.map(function(ped){var items=ped.items.map(function(it){return (it.e||"📦")+' '+it.n+' ×'+it.qty;}).join(", ");return '<div style="border:2px solid #f0f0f0;border-radius:12px;padding:14px"><div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px"><strong style="font-size:.85rem;color:var(--na3)">Pedido #'+ped.id+'</strong><span style="background:#e8f5e9;color:#2e7d32;padding:2px 9px;border-radius:50px;font-size:.72rem;font-weight:800">✅ Procesado</span></div><div style="color:var(--gr);font-size:.78rem;margin-bottom:6px">📅 '+ped.fecha+'</div><p style="font-size:.82rem;color:#555;margin-bottom:6px">'+items+'</p><div style="font-weight:800;color:var(--na3)">Total: '+bs(ped.total)+'</div></div>';}).join("")+'</div>';}

// ── PANEL ────────────────────────────────────
function abrirPanel(){if(!usuario){abrirModal("mLogin");return;}if(usuario.rol==="administrador"){document.getElementById("panT").textContent="⚙️ Panel Administrador";buildAdmin();abrirModal("mPanel");}else if(usuario.rol==="superadmin"){document.getElementById("panT").textContent="👑 Super Administrador";buildSuper();abrirModal("mPanel");}else{abrirCuentaCliente();}}
function buildAdmin(){var pb=document.getElementById("panB");pb.innerHTML='<div class="tabs"><button class="tab'+(aTab==="productos"?" on":"")+'" onclick="setATab(\'productos\',this)">📦 Productos</button><button class="tab'+(aTab==="agregar"?" on":"")+'" onclick="setATab(\'agregar\',this)">'+(editId?"💾 Editar":"➕ Añadir")+'</button><button class="tab'+(aTab==="categorias"?" on":"")+'" onclick="setATab(\'categorias\',this)">🏷️ Categorías</button><button class="tab'+(aTab==="reportes"?" on":"")+'" onclick="setATab(\'reportes\',this)">🚨 Reportes</button></div><div id="aTB"></div>';renderAdminTab();}
function setATab(t,btn){aTab=t;document.querySelectorAll("#panB .tab").forEach(function(b){b.classList.remove("on");});btn.classList.add("on");renderAdminTab();}
function renderAdminTab(){api("/reportes").then(function(r){if(r.ok){REPORTES=r.reportes;_renderAdminTab();}else _renderAdminTab();});}
function _renderAdminTab(){
  var c=document.getElementById("aTB");if(!c)return;
  if(aTab==="productos"){
    c.innerHTML='<div class="tw"><table><thead><tr><th>Img</th><th>Nombre</th><th>Precio</th><th>Stock</th><th>Acc.</th></tr></thead><tbody>'+
      PRODS.map(function(p){var thumb=p.img?'<img src="'+p.img+'" style="width:40px;height:40px;object-fit:cover;border-radius:6px;"/>':'<span style="font-size:1.5rem">'+emojiProd(p)+'</span>';var sc=p.st<=0?"#c62828":p.st<=10?"#f57f17":"#2e7d32";return '<tr><td>'+thumb+'</td><td><strong>'+p.n+'</strong><br><small style="color:var(--gr)">'+p.cat+'</small></td><td style="color:var(--na3);font-weight:700">'+bs(p.o||p.p)+'</td><td style="color:'+sc+';font-weight:800">'+p.st+(p.st<=0?" 🚫":p.st<=10?" ⚠️":"")+'</td><td><button class="bte" onclick="editP('+p.id+')">✏️</button><button class="btd" onclick="elimP('+p.id+')">🗑️</button>'+(p.img?'<button class="btd" style="background:#e3f2fd;color:#1565c0" onclick="elimFoto('+p.id+')">🖼️✕</button>':'')+'</td></tr>';}).join("")+'</tbody></table></div>';
  }else if(aTab==="agregar"){
    var imgPv=(newPF.img||imgTempAdmin)?'<img src="'+(imgTempAdmin||newPF.img)+'" class="img-preview" id="imgPrev"/>':'<div id="imgPrev" style="display:none"></div>';
    var quitarFotoBtn=(editId&&(newPF.img||imgTempAdmin))?'<button class="btd" style="margin-top:6px;font-size:.8rem" onclick="quitarFotoFormAdmin()">🖼️✕ Quitar foto actual</button>':'';
    c.innerHTML='<div class="f2"><div class="fg"><label>Nombre *</label><input class="fc" id="nNom" value="'+(newPF.n||"")+'"/></div><div class="fg"><label>Categoría</label><select class="fc" id="nCat">'+CATS.filter(function(x){return x.id>0;}).map(function(x){return '<option value="'+x.id+'"'+(x.id===newPF.cat?" selected":"")+'>'+x.n+'</option>';}).join("")+'</select></div></div><div class="fg"><label>Descripción</label><textarea class="fc" id="nDesc" rows="3" style="resize:vertical">'+(newPF.d||"")+'</textarea></div><div class="f2"><div class="fg"><label>Precio Bs. *</label><input class="fc" type="number" id="nPrecio" value="'+(newPF.p||"")+'" step="0.01"/></div><div class="fg"><label>Precio Oferta</label><input class="fc" type="number" id="nOferta" value="'+(newPF.o||"")+'" step="0.01"/></div></div><div class="f2"><div class="fg"><label>Stock *</label><input class="fc" type="number" id="nStock" value="'+(newPF.st||"")+'"/></div><div class="fg"><label>¿Destacado?</label><select class="fc" id="nDest"><option value="false">No</option><option value="true"'+(newPF.dest?" selected":"")+'>Sí ⭐</option></select></div></div><div class="fg"><label>📷 Foto</label>'+imgPv+quitarFotoBtn+'<div class="img-upload-area"><input type="file" accept="image/*" onchange="cargarImgProd(event)"/><span style="font-size:2rem;display:block;margin-bottom:6px">📷</span><span style="font-size:.85rem;color:var(--gr)">'+(newPF.img||imgTempAdmin?"Cambiar foto":"Subir foto")+'</span></div></div><button class="bp" onclick="guardarProd()">'+(editId?"💾 Guardar Cambios":"➕ Crear Producto")+'</button>'+(editId?'<button class="bs" onclick="cancelEdit()">Cancelar</button>':"");
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
}
function _renderCategorias(c){api("/categorias").then(function(r){var cats=r.ok?r.categorias:[];c.innerHTML='<div style="margin-bottom:16px;background:#fff8e1;border-radius:10px;padding:14px;border-left:4px solid var(--am)"><div style="font-weight:800;margin-bottom:10px;color:var(--na3)">➕ Nueva Categoría</div><div class="f2"><div class="fg"><label>Nombre *</label><input class="fc" id="catNom" placeholder="Ej: Tecnología"/></div><div class="fg"><label>Emoji</label><input class="fc" id="catEmoji" placeholder="🏷️" maxlength="4"/></div></div><button class="bp" style="margin-top:0" onclick="crearCategoria()">➕ Crear</button></div><div class="tw"><table><thead><tr><th>Emoji</th><th>Nombre</th><th>Acción</th></tr></thead><tbody>'+cats.map(function(cat){return '<tr><td style="font-size:1.5rem">'+cat.emoji+'</td><td><strong>'+cat.nombre+'</strong></td><td><button class="btd" onclick="elimCategoria('+cat.id+',\''+cat.nombre.replace(/'/g,"\\'")+'\')">🗑️</button></td></tr>';}).join("")+'</tbody></table></div>';});}
function crearCategoria(){var nom=(document.getElementById("catNom").value||"").trim(),emoji=(document.getElementById("catEmoji").value||"🏷️").trim();if(!nom){toast("Nombre requerido","e");return;}api("/categorias","POST",{nombre:nom,emoji:emoji}).then(function(r){if(!r.ok){toast(r.error||"Error","e");return;}toast("Categoría '"+nom+"' creada ✅","s");document.getElementById("catNom").value="";document.getElementById("catEmoji").value="";cargarDatos();_renderAdminTab();});}
function elimCategoria(id,nom){if(!confirm("¿Eliminar '"+nom+"'?"))return;api("/categorias/"+id,"DELETE").then(function(r){if(!r.ok){toast(r.error||"No se puede eliminar","e");return;}toast("Eliminada","i");cargarDatos();_renderAdminTab();});}
function elimFoto(pid){if(!confirm("¿Eliminar foto?"))return;api("/productos/"+pid+"/foto","PUT").then(function(r){if(!r.ok){toast("Error","e");return;}var p=PRODS.find(function(x){return x.id===pid;});if(p)p.img=null;toast("Foto eliminada ✅","s");cargarDatos();_renderAdminTab();});}
function quitarFotoFormAdmin(){if(!editId)return;if(!confirm("¿Quitar la foto de este producto?"))return;api("/productos/"+editId+"/foto","PUT").then(function(r){if(!r.ok){toast("Error al quitar foto","e");return;}var p=PRODS.find(function(x){return x.id===editId;});if(p)p.img=null;imgTempAdmin=null;newPF.img=null;toast("Foto quitada ✅","s");cargarDatos();aTab="agregar";buildAdmin();});}
function quitarFotoFormSuper(){if(!spEditId)return;if(!confirm("¿Quitar la foto de este producto?"))return;api("/productos/"+spEditId+"/foto","PUT").then(function(r){if(!r.ok){toast("Error al quitar foto","e");return;}var p=PRODS.find(function(x){return x.id===spEditId;});if(p)p.img=null;imgTempSuper=null;spNewPF.img=null;toast("Foto quitada ✅","s");cargarDatos();sprodTab("add",document.getElementById("spTabAdd"));});}
function cargarImgProd(e){var file=e.target.files[0];if(!file)return;var r=new FileReader();r.onload=function(ev){imgTempAdmin=ev.target.result;var prev=document.getElementById("imgPrev");if(prev){prev.src=imgTempAdmin;prev.style.display="block";prev.className="img-preview";}};r.readAsDataURL(file);}
function editP(id){var p=PRODS.find(function(x){return x.id===id;});if(!p)return;editId=id;imgTempAdmin=p.img||null;newPF={n:p.n,d:p.d,p:p.p,o:p.o||"",st:p.st,cat:p.cid,dest:p.dest,img:p.img||null};aTab="agregar";buildAdmin();}
function cancelEdit(){editId=null;imgTempAdmin=null;newPF={n:"",d:"",p:"",o:"",st:"",cat:1,dest:false,img:null};aTab="productos";buildAdmin();}
function guardarProd(){var n=document.getElementById("nNom").value.trim(),pr=parseFloat(document.getElementById("nPrecio").value),st=parseInt(document.getElementById("nStock").value);if(!n||isNaN(pr)||isNaN(st)){toast("Completa los campos","e");return;}var cid=parseInt(document.getElementById("nCat").value),cat=CATS.find(function(c){return c.id===cid;}),catN=cat?cat.n.replace(/^\S+\s/,""):"General";var o=parseFloat(document.getElementById("nOferta").value)||null,dest=document.getElementById("nDest").value==="true",desc=document.getElementById("nDesc").value;var img=imgTempAdmin||(editId?(PRODS.find(function(p){return p.id===editId;})||{}).img:null)||null;var wasEdit=editId;api(editId?"/productos/"+editId:"/productos",editId?"PUT":"POST",{n:n,d:desc,p:pr,o:o,st:st,cat:catN,cid:cid,dest:dest,img:img}).then(function(r){if(!r.ok){toast("Error","e");return;}editId=null;imgTempAdmin=null;newPF={n:"",d:"",p:"",o:"",st:"",cat:1,dest:false,img:null};toast(wasEdit?"Actualizado ✅":"¡Creado! ✅","s");cargarDatos();aTab="productos";buildAdmin();});}
function elimP(id){if(!confirm("¿Eliminar?"))return;api("/productos/"+id,"DELETE").then(function(r){if(!r.ok){toast("Error","e");return;}toast("Eliminado","i");cargarDatos();buildAdmin();});}

// ── SUPERADMIN ───────────────────────────────
function buildSuper(){var pb=document.getElementById("panB");pb.innerHTML='<div class="tabs"><button class="tab'+(sTab==="stats"?" on":"")+'" onclick="setSTab(\'stats\',this)">📊 Stats</button><button class="tab'+(sTab==="users"?" on":"")+'" onclick="setSTab(\'users\',this)">👥 Usuarios</button><button class="tab'+(sTab==="prods"?" on":"")+'" onclick="setSTab(\'prods\',this)">📦 Productos</button><button class="tab'+(sTab==="categorias"?" on":"")+'" onclick="setSTab(\'categorias\',this)">🏷️ Categorías</button><button class="tab'+(sTab==="reportes"?" on":"")+'" onclick="setSTab(\'reportes\',this)">🚨 Reportes</button><button class="tab'+(sTab==="cadmin"?" on":"")+'" onclick="setSTab(\'cadmin\',this)">➕ Admin</button><button class="tab'+(sTab==="logs"?" on":"")+'" onclick="setSTab(\'logs\',this)">📋 Logs</button></div><div id="sTB"></div>';renderSuperTab();}
function setSTab(t,btn){sTab=t;document.querySelectorAll("#panB .tab").forEach(function(b){b.classList.remove("on");});btn.classList.add("on");renderSuperTab();}
function renderSuperTab(){Promise.all([api("/productos").then(function(r){if(r.ok)PRODS=r.productos;}),api("/usuarios").then(function(r){if(r.ok)USUARIOS=r.usuarios;}),api("/reportes").then(function(r){if(r.ok)REPORTES=r.reportes;}),api("/logs").then(function(r){if(r.ok)LOGS=r.logs;})]).then(function(){_renderSuperTab();});}
function _renderSuperTab(){
  var c=document.getElementById("sTB");if(!c)return;
  if(sTab==="stats"){
    var cl=USUARIOS.filter(function(u){return u.rol==="cliente";}).length,ad=USUARIOS.filter(function(u){return u.rol==="administrador";}).length;
    c.innerHTML='<div class="sgrid"><div class="sc"><div class="sn">'+cl+'</div><div class="sl">👥 Clientes</div></div><div class="sc"><div class="sn">'+ad+'</div><div class="sl">⚙️ Admins</div></div><div class="sc"><div class="sn">'+PRODS.filter(function(p){return p.st>0;}).length+'</div><div class="sl">📦 Disponibles</div></div><div class="sc"><div class="sn">'+REPORTES.filter(function(r){return r.estado==="pendiente";}).length+'</div><div class="sl">🚨 Pendientes</div></div></div><div style="background:#fff8e1;border-radius:10px;padding:16px;border-left:4px solid var(--na)"><strong style="color:var(--na3)">🔔 Estado del Sistema</strong><p style="color:#555;font-size:.88rem;margin-top:4px">Todo funcionando · Django + SQLite</p><p style="color:#888;font-size:.82rem;margin-top:4px">Agotados: '+PRODS.filter(function(p){return p.st<=0;}).length+'</p></div>';
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
function spGuardar(){var n=document.getElementById("spNom").value.trim(),pr=parseFloat(document.getElementById("spPrecio").value),st=parseInt(document.getElementById("spStock").value);if(!n||isNaN(pr)||isNaN(st)){toast("Completa campos","e");return;}var cid=parseInt(document.getElementById("spCat").value),cat=CATS.find(function(c){return c.id===cid;}),catN=cat?cat.n.replace(/^\S+\s/,""):"General";var o=parseFloat(document.getElementById("spOferta").value)||null,dest=document.getElementById("spDest").value==="true",desc=document.getElementById("spDesc").value;var img=imgTempSuper||(spEditId?(PRODS.find(function(p){return p.id===spEditId;})||{}).img:null)||null;var wasEdit=spEditId;api(spEditId?"/productos/"+spEditId:"/productos",spEditId?"PUT":"POST",{n:n,d:desc,p:pr,o:o,st:st,cat:catN,cid:cid,dest:dest,img:img}).then(function(r){if(!r.ok){toast("Error","e");return;}spEditId=null;imgTempSuper=null;spNewPF={n:"",d:"",p:"",o:"",st:"",cat:1,dest:false,img:null};toast(wasEdit?"Actualizado ✅":"¡Creado! ✅","s");cargarDatos();sprodTab("list",document.getElementById("spTabList"));});}
function spElim(id){if(!confirm("¿Eliminar?"))return;api("/productos/"+id,"DELETE").then(function(r){if(!r.ok){toast("Error","e");return;}toast("Eliminado","i");cargarDatos();sprodTab("list",document.getElementById("spTabList"));});}
function elimFotoSp(pid){if(!confirm("¿Eliminar foto?"))return;api("/productos/"+pid+"/foto","PUT").then(function(r){if(!r.ok){toast("Error","e");return;}var p=PRODS.find(function(x){return x.id===pid;});if(p)p.img=null;toast("Foto eliminada ✅","s");cargarDatos();sprodTab("list",document.getElementById("spTabList"));});}
function cambiarRol(id,rol){api("/usuarios/"+id+"/rol","PUT",{rol:rol}).then(function(r){if(!r.ok){toast("Error","e");return;}toast("Rol actualizado → "+rol,"s");renderSuperTab();});}
function togUser(id){api("/usuarios/"+id+"/toggle","PUT").then(function(r){if(!r.ok){toast("Error","e");return;}toast("Estado actualizado","i");renderSuperTab();});}
function crearAdmin(){var n=document.getElementById("aNom").value.trim(),a=document.getElementById("aApe").value.trim(),e=document.getElementById("aEmail").value.trim().toLowerCase(),p=document.getElementById("aPass").value;if(!n||!a||!e||!p){toast("Completa todo","e");return;}if(p.length<8){toast("Contraseña mínimo 8","e");return;}api("/usuarios/admin","POST",{n:n,a:a,email:e,password:p}).then(function(r){if(!r.ok){toast(r.error||"Error","e");return;}toast("Admin "+n+" creado 👑","s");sTab="users";buildSuper();});}

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

  initSearch();
  mpInit();
  irPagina("inicio");
  cargarDatos();
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
    // Sin sesión: si el panel estaba abierto, mostrar locked
    if(!wrap.classList.contains("mp-collapsed")){
      mpRenderLocked();
    }
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
  wrap.classList.toggle("mp-collapsed");
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
    '  <button class="mp-locked-btn" onclick="mpHide();abrirModal('mLogin')">🔐 Iniciar Sesión</button>',
    '</div>'
  ].join("");
}

// ── Ocultar completamente el reproductor ──
function mpHide(){
  var wrap = document.getElementById("musicPlayer");
  if(!wrap) return;
  wrap.classList.add("mp-hidden");
  wrap.classList.add("mp-collapsed");
  var btn = document.getElementById("mpShowBtn");
  if(btn) btn.style.display = "flex";
}

// ── Mostrar de nuevo el reproductor ──
function mpShow(){
  var wrap = document.getElementById("musicPlayer");
  if(!wrap) return;
  wrap.classList.remove("mp-hidden");
  var btn = document.getElementById("mpShowBtn");
  if(btn) btn.style.display = "none";
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

  var added = 0;
  files.forEach(function(f){
    if(!f.type.startsWith("audio/") && !/\.(mp3|wav|ogg|flac|aac|m4a|opus|weba)$/i.test(f.name)) return;
    var objUrl = URL.createObjectURL(f);
    var name = f.name.replace(/\.[^.]+$/, ""); // quitar extensión
    mp.playlist.push({ name: name, dur: "—", url: objUrl, objUrl: objUrl });
    added++;
  });

  // Reset file input para poder re-agregar mismo archivo
  e.target.value = "";

  if(!added){ toast("No se encontraron archivos de audio válidos","e"); return; }
  toast("+" + added + " canción" + (added>1?"es":"") + " agregada" + (added>1?"s":"") + " 🎵","s");

  mpShowPlayer();
  mpRenderPlaylist();

  // Autoplay si no había nada reproduciéndose
  if(mp.current < 0){
    mpPlay(0);
  }
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
  if(mp.playlist[idx] && mp.playlist[idx].objUrl) URL.revokeObjectURL(mp.playlist[idx].objUrl);
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
  mp.playlist.forEach(function(item){ if(item.objUrl) URL.revokeObjectURL(item.objUrl); });
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

