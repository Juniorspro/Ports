// ---------------- maquinitas: juegos HTML en los gabinetes (el prop Arcade) ----------------
// Se usa un gabinete (E o el botón de usar) y se elige un juego de la biblioteca: los que trae el juego, los tuyos
// (importados de un .html o de una dirección, guardados en el navegador), los que puso alguien en la sala y los de la
// comunidad (la tienda). El juego se juega en el medio de la pantalla con el mundo atrás; en el celular los controles
// de siempre se van y aparecen los de la maquinita (palanca o cruceta, A B X Y, Select y Start), que le mandan teclas
// de PC al juego. Los juegos corren aislados: un iframe sandbox sin permiso de mismo origen (no leen nada del juego ni
// del navegador); un puente chico adentro recibe las teclas y le da al juego un localStorage de mentira.
// En la sala, el gabinete dice qué juego tiene y quien lo puso le pasa el HTML (comprimido, de a pedazos) al que lo quiera.
const MAQ = { subs: [], lib: [], libOk: false, obj: null, j: null, vista: null, ifr: null, apretadas: new Set(), sala: new Map(), partes: new Map(), esperas: new Map(), tapas: new Map(), fotos: new Map(), fotoDe: new Map(), tab: 'inc', eco: [], com: null };
// teclas de PC para cada botón, según el juego
const MAQ_CTRL = {
  flechas: { arr: 'ArrowUp', aba: 'ArrowDown', izq: 'ArrowLeft', der: 'ArrowRight', A: ' ', B: 'z', X: 'x', Y: 'c', start: 'Enter', select: 'Shift' },
  wasd: { arr: 'w', aba: 's', izq: 'a', der: 'd', A: ' ', B: 'e', X: 'f', Y: 'q', start: 'Enter', select: 'Tab' },
  raton: null,   // (se juega tocando la pantalla del juego: el toque es el mouse)
};
const maqCode = (k) => (k === ' ' ? 'Space' : k === 'Shift' ? 'ShiftLeft' : k.length === 1 ? 'Key' + k.toUpperCase() : k);
// el puente: va al principio del HTML del juego (teclas que llegan por mensaje y un localStorage en memoria si el de verdad
// no se puede usar, como pasa en un iframe aislado)
const MAQ_PUENTE = `<script>(function(){var KC={ArrowLeft:37,ArrowUp:38,ArrowRight:39,ArrowDown:40,' ':32,Enter:13,Escape:27,Shift:16,Tab:9};
function mem(){var d={};return{getItem:function(k){return k in d?d[k]:null},setItem:function(k,v){d[k]=String(v)},removeItem:function(k){delete d[k]},clear:function(){d={}},key:function(i){return Object.keys(d)[i]||null},get length(){return Object.keys(d).length}}}
['localStorage','sessionStorage'].forEach(function(n){try{window[n].getItem('x')}catch(e){try{Object.defineProperty(window,n,{value:mem(),configurable:true})}catch(x){}}});
var AJ={on:0,c:null,st:null};function ajF(){var c=AJ.c;if(!AJ.on||!c)return;c.style.removeProperty('transform');var w=c.offsetWidth||c.width,h=c.offsetHeight||c.height,s=Math.min(innerWidth/w,innerHeight/h);c.style.setProperty('transform','translate(-50%,-50%) scale('+s+')','important')}
function aj(on){AJ.on=on;var cs=document.getElementsByTagName('canvas'),b=null,ba=0;for(var i=0;i<cs.length;i++){var a=cs[i].width*cs[i].height;if(a>ba){ba=a;b=cs[i]}}if(AJ.c&&AJ.c!==b)AJ.c.classList.remove('rbAj');AJ.c=b;
if(!AJ.st){AJ.st=document.createElement('style');AJ.st.textContent='html.rbAj,html.rbAj body{overflow:hidden!important;background:#000!important}canvas.rbAj{position:fixed!important;left:50%!important;top:50%!important;margin:0!important;transform-origin:50% 50%!important}';(document.head||document.documentElement).appendChild(AJ.st)}
document.documentElement.classList.toggle('rbAj',!!on);if(b){b.classList.toggle('rbAj',!!on);if(on)ajF();else b.style.removeProperty('transform')}}addEventListener('resize',ajF);
addEventListener('message',function(e){var m=e.data;if(!m||m.rbMaq!==1)return;if(m.t==='ajustar'){aj(m.on);return}if(m.t==='ritmo'){CAP.pide=Math.max(15,+m.ms||1000);return}var k=m.key,n=KC[k]||(k.length===1?k.toUpperCase().charCodeAt(0):0);
var ev=new KeyboardEvent(m.t,{key:k,code:m.code,bubbles:true,cancelable:true});try{Object.defineProperty(ev,'keyCode',{get:function(){return n}});Object.defineProperty(ev,'which',{get:function(){return n}})}catch(x){}
var a=document.activeElement,t=a&&a!==document.body?a:(document.querySelector('canvas')||document.body||document);t.dispatchEvent(ev);
try{parent.postMessage({rbMaqOk:m.t+':'+k},'*')}catch(x){}});
var CAP={t:0,v:null,vg:null,c:0,pide:1000,i:1000};function cap(){var n=performance.now();CAP.i=Math.max(CAP.pide,Math.min(2000,CAP.c*10));if(n-CAP.t<CAP.i)return;CAP.t=n;var cs=document.getElementsByTagName('canvas'),b=null,ba=0;
for(var i=0;i<cs.length;i++){var c=cs[i],a=c.width*c.height;if(a>ba&&c.width>15&&c.height>15){ba=a;b=c}}if(!b)return;
var ar=b.width/b.height,W=Math.min(320,b.width),H=Math.max(1,Math.round(W/ar));if(!CAP.v||CAP.v.width!==W||CAP.v.height!==H){CAP.v=document.createElement('canvas');CAP.v.width=W;CAP.v.height=H;CAP.vg=CAP.v.getContext('2d',{willReadFrequently:true})}
try{CAP.vg.imageSmoothingEnabled=b.width>W;CAP.vg.drawImage(b,0,0,W,H);var px=CAP.vg.getImageData(0,0,W,H).data.buffer;parent.postMessage({rbMaqPx:px,w:W,h:H,a:ar,c:CAP.c,i:CAP.i},'*',[px])}catch(e){}var c=performance.now()-n;CAP.c=CAP.c?CAP.c*0.7+c*0.3:c}
var RAF=window.requestAnimationFrame;window.requestAnimationFrame=function(f){return RAF.call(window,function(t){f(t);cap()})};setInterval(cap,250);
var AC=window.AudioContext||window.webkitAudioContext,ACS=[],CALL=[];if(AC){var W=function(a){var c=a===undefined?new AC():new AC(a);ACS.push(c);return c};W.prototype=AC.prototype;try{window.AudioContext=W;window.webkitAudioContext=W}catch(x){}}
addEventListener('message',function(e){var m=e.data;if(!m||m.rbMaqFondo===undefined)return;if(m.rbMaqFondo){CALL=[];ACS.forEach(function(c){if(c.state==='running'){CALL.push(c);c.suspend()}});[].forEach.call(document.querySelectorAll('audio,video'),function(v){if(!v.paused){CALL.push(v);v.pause()}})}
else{CALL.forEach(function(x){try{if(x.resume)x.resume();else x.play()}catch(y){}});CALL=[]}});})();<\/script>`;
const maqConPuente = (h) => (/<head[^>]*>/i.test(h) ? h.replace(/<head[^>]*>/i, (m) => m + MAQ_PUENTE) : MAQ_PUENTE + h);

// ---------------- los juegos que trae (hechos para JXMod) ----------------
const MAQ_HTML = (t, js) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t}</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}canvas{display:block;width:100%;height:100%;object-fit:contain;image-rendering:pixelated}</style></head>
<body><canvas id="c" width="320" height="240"></canvas><script>var c=document.getElementById('c'),g=c.getContext('2d'),K={},P={};
addEventListener('keydown',function(e){K[e.key.toLowerCase()]=1;P[e.key.toLowerCase()]=1;if(/^(arrow| )/i.test(e.key))e.preventDefault()});addEventListener('keyup',function(e){K[e.key.toLowerCase()]=0});
function tec(){for(var i=0;i<arguments.length;i++)if(K[arguments[i]])return 1;return 0}function pul(){for(var i=0;i<arguments.length;i++)if(P[arguments[i]])return 1;return 0}
function txt(s,x,y,z,col){g.fillStyle=col||'#fff';g.font=(z||10)+'px monospace';g.textAlign='center';g.fillText(s,x,y)}
${js}
var u=performance.now();function bucle(n){var dt=Math.min(0.05,(n-u)/1000);u=n;paso(dt);P={};requestAnimationFrame(bucle)}requestAnimationFrame(bucle);<\/script></body></html>`;
const MAQ_INCLUIDOS = [
  { id: 'rb:serpiente', nombre: 'Serpiente', autor: 'JXMod', ctrl: 'flechas', html: MAQ_HTML('Serpiente', `var N=20,M=15,S,d,nd,f,pt,t,v,vivo=0,mx=0;
function nueva(){S=[[10,7],[9,7],[8,7]];d=[1,0];nd=d;pt=0;t=0;v=0.14;vivo=1;comida()}function comida(){do{f=[Math.random()*N|0,Math.random()*M|0]}while(S.some(function(s){return s[0]==f[0]&&s[1]==f[1]}))}
function paso(dt){if(!vivo){if(pul(' ','enter'))nueva()}else{if(tec('arrowup','w')&&d[1]!=1)nd=[0,-1];if(tec('arrowdown','s')&&d[1]!=-1)nd=[0,1];if(tec('arrowleft','a')&&d[0]!=1)nd=[-1,0];if(tec('arrowright','d')&&d[0]!=-1)nd=[1,0];
t+=dt;while(t>v){t-=v;d=nd;var h=[(S[0][0]+d[0]+N)%N,(S[0][1]+d[1]+M)%M];if(S.some(function(s){return s[0]==h[0]&&s[1]==h[1]})){vivo=0;mx=Math.max(mx,pt);break}S.unshift(h);if(h[0]==f[0]&&h[1]==f[1]){pt++;v=Math.max(0.06,v*0.96);comida()}else S.pop()}}
g.fillStyle='#071a10';g.fillRect(0,0,320,240);g.fillStyle='#0d2a1a';for(var i=0;i<N;i++)for(var j=0;j<M;j++)if((i+j)%2)g.fillRect(i*16,j*16,16,16);
g.fillStyle='#ff3355';g.fillRect(f[0]*16+3,f[1]*16+3,10,10);S.forEach(function(s,i){g.fillStyle=i?'#3ddc84':'#b6ffce';g.fillRect(s[0]*16+1,s[1]*16+1,14,14)});
txt(pt+'',300,14,12,'#ffe066');if(!vivo)txt(S.length>3?'GAME OVER  '+pt+'  (MAX '+mx+')':'SERPIENTE',160,110,16,'#fff'),txt('START / ESPACIO',160,135,10,'#9fe')}
nueva();vivo=0;S=[[10,7],[9,7],[8,7]];` ) },
  { id: 'rb:ladrillos', nombre: 'Ladrillos', autor: 'JXMod', ctrl: 'flechas', html: MAQ_HTML('Ladrillos', `var px,bx,by,vx,vy,pega,L,vidas,pt,niv,vivo=0;
function nivel(){L=[];for(var j=0;j<5+Math.min(niv,3);j++)for(var i=0;i<10;i++)L.push({x:8+i*30.4,y:30+j*12,c:'hsl('+(j*40+niv*25)+',80%,60%)'});saque()}
function saque(){px=136;pega=1;vx=0;vy=0}function nueva(){vidas=3;pt=0;niv=0;vivo=1;nivel()}
c.addEventListener('pointermove',function(e){var r=c.getBoundingClientRect(),s=Math.min(r.width/320,r.height/240),ox=(r.width-320*s)/2;px=Math.max(0,Math.min(272,(e.clientX-r.left-ox)/s-24))});c.addEventListener('pointerdown',function(){P[' ']=1});
function paso(dt){if(!vivo){if(pul(' ','enter'))nueva()}else{px=Math.max(0,Math.min(272,px+(tec('arrowright','d')-tec('arrowleft','a'))*260*dt));
if(pega){bx=px+24;by=218;if(pul(' ','enter','z')){pega=0;vx=90*(Math.random()<.5?-1:1);vy=-190-niv*15}}else{bx+=vx*dt;by+=vy*dt;if(bx<3){bx=3;vx=-vx}if(bx>317){bx=317;vx=-vx}if(by<3){by=3;vy=-vy}
if(by>218&&by<226&&bx>px-3&&bx<px+51&&vy>0){vy=-Math.abs(vy)*1.02;vx=(bx-px-24)*7}
for(var i=0;i<L.length;i++){var b=L[i];if(bx>b.x-2&&bx<b.x+30&&by>b.y-2&&by<b.y+12){L.splice(i,1);vy=-vy;pt+=10;break}}if(!L.length){niv++;nivel()}if(by>244){vidas--;if(vidas<0)vivo=0;else saque()}}}
g.fillStyle='#0b0f2a';g.fillRect(0,0,320,240);L&&L.forEach(function(b){g.fillStyle=b.c;g.fillRect(b.x,b.y,28,10)});g.fillStyle='#e8f0ff';g.fillRect(px,222,48,6);g.beginPath();g.arc(bx||0,by||0,3,0,7);g.fill();
if(vivo||pt)txt(pt+'',290,14,11,'#ffe066'),txt('x'+Math.max(vidas,0),20,14,11,'#9fe');if(!vivo)txt(pt?'GAME OVER  '+pt:'LADRILLOS',160,130,16),txt('START / ESPACIO',160,155,10,'#9fe')}
niv=0;L=[];bx=160;by=200;pt=0;vidas=3;` ) },
  { id: 'rb:meteoros', nombre: 'Meteoros', autor: 'JXMod', ctrl: 'flechas', html: MAQ_HTML('Meteoros', `var sx,B,R,E,pt,vidas,ce,t,inv,vivo=0,st=[];for(var i=0;i<60;i++)st.push([Math.random()*320,Math.random()*240,Math.random()*40+10]);
function nueva(){sx=160;B=[];R=[];E=[];pt=0;vidas=3;ce=0;t=0;inv=0;vivo=1}
function paso(dt){g.fillStyle='#04040c';g.fillRect(0,0,320,240);st.forEach(function(s){s[1]=(s[1]+s[2]*dt)%240;g.fillStyle='#456';g.fillRect(s[0],s[1],1,1)});
if(!vivo){txt(pt?'GAME OVER  '+pt:'METEOROS',160,110,16);txt('START / ESPACIO',160,135,10,'#9fe');if(pul(' ','enter'))nueva();return}
t+=dt;inv-=dt;sx=Math.max(10,Math.min(310,sx+(tec('arrowright','d')-tec('arrowleft','a'))*200*dt));ce-=dt;if((tec(' ','z','x'))&&ce<=0){B.push([sx,210]);ce=0.22}
if(Math.random()<dt*(0.8+t*0.05))R.push({x:Math.random()*300+10,y:-10,r:6+Math.random()*10,v:40+Math.random()*50+t*1.5,a:0,w:Math.random()*4-2});
B.forEach(function(b){b[1]-=320*dt});B=B.filter(function(b){return b[1]>-5});
R.forEach(function(m){m.y+=m.v*dt;m.a+=m.w*dt;B.forEach(function(b){if(m.y<900&&Math.hypot(b[0]-m.x,b[1]-m.y)<m.r){E.push([m.x,m.y,m.r,0]);m.y=999;b[1]=-99;pt+=Math.round(30-m.r)}});
if(inv<=0&&Math.hypot(m.x-sx,m.y-216)<m.r+7){vidas--;inv=2;m.y=999;if(vidas<0)vivo=0}});
E=E.filter(function(e){e[3]+=dt;return e[3]<0.5});R=R.filter(function(m){return m.y<260});E.forEach(function(e){g.strokeStyle='rgba(255,'+(200-e[3]*300|0)+',80,'+(1-e[3]*2)+')';g.beginPath();g.arc(e[0],e[1],e[2]*(0.5+e[3]*4),0,7);g.stroke()});
R.forEach(function(m){g.save();g.translate(m.x,m.y);g.rotate(m.a);g.fillStyle='#8a6a4a';g.beginPath();for(var k=0;k<7;k++){var q=k/7*6.28,rr=m.r*(0.8+((k*37)%5)/12);g.lineTo(Math.cos(q)*rr,Math.sin(q)*rr)}g.fill();g.restore()});
g.fillStyle='#ffe066';B.forEach(function(b){g.fillRect(b[0]-1,b[1]-5,2,6)});if(inv<=0||(t*10|0)%2){g.fillStyle='#7cf';g.beginPath();g.moveTo(sx,206);g.lineTo(sx-9,224);g.lineTo(sx+9,224);g.fill()}
txt(pt+'',290,14,11,'#ffe066');txt('x'+Math.max(vidas,0),20,14,11,'#9fe')}
nueva();vivo=0;` ) },
];

// ---------------- la biblioteca: lo incluido, lo tuyo (IndexedDB) y lo de la sala ----------------
function maqDB() {
  if (MAQ.db) return MAQ.db;
  return (MAQ.db = new Promise((ok) => {
    try {
      // (2: los HTML pesados van aparte, en «h»: la lista lee sólo nombre, autor y foto, no 80 MB de juegos)
      const r = indexedDB.open('rezobox-juegos', 2);
      r.onupgradeneeded = () => { const db = r.result; if (!db.objectStoreNames.contains('j')) db.createObjectStore('j', { keyPath: 'id' }); if (!db.objectStoreNames.contains('h')) db.createObjectStore('h'); };
      r.onsuccess = () => ok(r.result); r.onerror = () => ok(null);
    } catch (e) { ok(null); }
  }));
}
async function maqMios() {
  const db = await maqDB(); if (!db) return MAQ.memoria || [];
  return new Promise((ok) => { try { const r = db.transaction('j').objectStore('j').getAll(); r.onsuccess = () => ok(r.result || []); r.onerror = () => ok([]); } catch (e) { ok([]); } });
}
// (un juego de más de 256 mil letras se guarda partido: los datos en «j» con hg = su tamaño, y el HTML en «h»; uno que
// llega sin html pero con hg —el de la lista— sólo cambia sus datos)
async function maqGuardar(j) {
  const db = await maqDB();
  if (!db) { MAQ.memoria = (MAQ.memoria || []).filter((x) => x.id !== j.id).concat([j]); return true; }   // (sin IndexedDB: hasta recargar)
  return new Promise((ok) => {
    try {
      const t = db.transaction(['j', 'h'], 'readwrite');
      if (typeof j.html === 'string' && j.html.length > 262144) { const l = { ...j, hg: j.html.length }; delete l.html; t.objectStore('h').put(j.html, j.id); t.objectStore('j').put(l); }
      else { t.objectStore('j').put(j); if (typeof j.html === 'string') t.objectStore('h').delete(j.id); }
      t.oncomplete = () => ok(true); t.onerror = () => ok(false); t.onabort = () => ok(false);
    } catch (e) { ok(false); }
  });
}
// uno tuyo: sólo los datos (ligero) o completo, con su HTML
async function maqMio(id, completo) {
  const db = await maqDB(); if (!db) return (MAQ.memoria || []).find((x) => x.id === id) || null;
  const get = (st, k) => new Promise((ok) => { try { const r = db.transaction(st).objectStore(st).get(k); r.onsuccess = () => ok(r.result || null); r.onerror = () => ok(null); } catch (e) { ok(null); } });
  const j = await get('j', id); if (!j || !completo || j.html || !j.hg) return j;
  const h = await get('h', id); return typeof h === 'string' ? { ...j, html: h } : null;
}
async function maqBorrarMio(id) {
  const db = await maqDB(); if (!db) { MAQ.memoria = (MAQ.memoria || []).filter((x) => x.id !== id); return; }
  return new Promise((ok) => { try { const t = db.transaction(['j', 'h'], 'readwrite'); t.objectStore('j').delete(id); t.objectStore('h').delete(id); t.oncomplete = () => ok(); t.onerror = () => ok(); } catch (e) { ok(); } });
}
// un juego por su id (incluido, tuyo, de la sala o de la comunidad), o null
async function maqBuscar(id) {
  const inc = MAQ_INCLUIDOS.find((x) => x.id === id); if (inc) return inc;
  if (MAQ.sala.has(id)) return MAQ.sala.get(id);
  return maqMio(id, true);
}
// importar: un .html (texto) o una dirección; el id sale del contenido (el mismo juego, el mismo id en todos lados)
async function maqHuella(s) {
  try { const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); return [...h.slice(0, 6)].map((b) => b.toString(16).padStart(2, '0')).join(''); }
  catch (e) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16); }
}
async function maqImportarTexto(nombre, html, ctrl) {
  if (typeof html !== 'string' || html.length < 20) return null;
  if (html.length > MAQ_MAX) { aviso(T('maq.grande'), 3); return null; }
  const j = { id: 'u:' + (await maqHuella(html)), nombre: (nombre || 'Juego').replace(/\.html?$/i, '').slice(0, 40), autor: PREFS.nombre || '', ctrl: MAQ_CTRL[ctrl] !== undefined ? ctrl : 'flechas', html, fecha: Date.now() };
  // (si ya estaba, se queda con su foto)
  const ya = await maqMio(j.id); if (ya && ya.foto) j.foto = ya.foto;
  return (await maqGuardar(j)) ? j : null;
}
async function maqImportarUrl(url, ctrl) {
  if (!/^https:\/\/[^\s]+$/i.test(url || '')) return null;
  // (si se puede leer, se guarda el HTML con la dirección de base para que encuentre lo suyo; si no, se juega desde ahí)
  try { const r = await fetch(url); if (r.ok) { const h = await r.text(); if (/<html|<script|<canvas|<body/i.test(h)) return maqImportarTexto(decodeURIComponent(url.split('/').filter(Boolean).pop() || 'Juego'), h.replace(/<head[^>]*>/i, (m) => m + `<base href="${esc(url)}">`), ctrl); } } catch (e) {}
  const j = { id: 'w:' + (await maqHuella(url)), nombre: (url.split('/').filter(Boolean).pop() || 'Juego').slice(0, 40), autor: PREFS.nombre || '', ctrl: MAQ_CTRL[ctrl] !== undefined ? ctrl : 'flechas', url, fecha: Date.now() };
  await maqGuardar(j); return j;
}

// ---------------- subir: varios a la vez, pesados, .zip y carpetas (3.8) ----------------
// Pedido del dueño: «poder cargar pesados y varios a la vez, con un apartado de subiendo, y que corra cualquier HTML». Cada
// archivo (o carpeta) es un trabajo con su avance en la pestaña «Subiendo»: se lee (con el avance de la lectura), se arma
// y se guarda en el aparato (IndexedDB). Un .zip o una carpeta: se busca el HTML principal (index.html o el primero, el
// menos hondo) y todo lo demás va adentro: lo que el HTML nombra (scripts, estilos, imágenes, sonidos) se reemplaza por
// su contenido, lo de adentro de los .css también, y lo que el juego pide después por su cuenta (fetch, XHR, una imagen o
// un sonido que arma su código) lo contesta un mapa de archivos con un puente chico (MAQ_FS). Así anda un juego de varios
// archivos sin servidor, en el iframe aislado de siempre.
const MAQ_MAX = 80e6;
const MAQ_MIME = { js: 'text/javascript', mjs: 'text/javascript', css: 'text/css', json: 'application/json', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml', ico: 'image/x-icon',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', m4a: 'audio/mp4', mp4: 'video/mp4', webm: 'video/webm', woff: 'font/woff', woff2: 'font/woff2', ttf: 'font/ttf', otf: 'font/otf', wasm: 'application/wasm', txt: 'text/plain', xml: 'application/xml', atlas: 'text/plain', fnt: 'text/plain', glsl: 'text/plain' };
const MAQ_FS = `<script>(function(){var F=window.__rbFS;if(!F)return;function res(u){try{u=typeof u==='string'?u:String(u&&u.url||u);if(/^(data|blob|https?|about):/i.test(u))return null;u=u.split('#')[0].split('?')[0].replace(/^(\\.\\/)+/,'').replace(/^\\//,'');try{u=decodeURIComponent(u)}catch(e){}
var k=u;while(k.indexOf('../')===0)k=k.slice(3);return F[u]||F[k]||null}catch(e){return null}}
var f0=window.fetch;if(f0)window.fetch=function(i,o){var d=res(typeof i==='string'?i:i&&i.url);return f0.call(this,d||i,o)};
var X=XMLHttpRequest.prototype,op=X.open;X.open=function(m,u){var d=res(u);if(d)arguments[1]=d;return op.apply(this,arguments)};
[[window.HTMLImageElement,'src'],[window.HTMLMediaElement,'src'],[window.HTMLSourceElement,'src'],[window.HTMLScriptElement,'src'],[window.HTMLLinkElement,'href']].forEach(function(x){if(!x[0])return;var P=x[0].prototype,dd=Object.getOwnPropertyDescriptor(P,x[1]);if(!dd||!dd.set)return;
Object.defineProperty(P,x[1],{configurable:true,enumerable:dd.enumerable,get:dd.get,set:function(v){var d=res(v);dd.set.call(this,d||v)}})});
var sa=Element.prototype.setAttribute;Element.prototype.setAttribute=function(k,v){if((k==='src'||k==='href')&&typeof v==='string'){var d=res(v);if(d)v=d}return sa.call(this,k,v)};})();<\/script>`;
const maqExt = (n) => (String(n).toLowerCase().match(/\.([a-z0-9]+)$/) || [])[1] || '';
const maqMB = (n) => (n < 1048576 ? Math.max(1, Math.round(n / 1024)) + ' KB' : (n / 1048576).toFixed(n < 10485760 ? 1 : 0) + ' MB');
// lee un archivo con su avance
function maqLeer(f, cada) {
  return new Promise((ok, mal) => { const r = new FileReader(); r.onprogress = (e) => cada && cada(e.loaded); r.onload = () => ok(new Uint8Array(r.result)); r.onerror = () => mal(r.error); r.readAsArrayBuffer(f); });
}
// un .zip: el índice del final y cada archivo (guardado tal cual o con deflate, que abre el navegador)
async function maqZip(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength); let e = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 65557); i--) if (dv.getUint32(i, true) === 0x06054b50) { e = i; break; }
  if (e < 0) throw new Error('zip');
  const n = dv.getUint16(e + 10, true); let o = dv.getUint32(e + 16, true); const out = {}, td = new TextDecoder();
  for (let k = 0; k < n; k++) {
    if (dv.getUint32(o, true) !== 0x02014b50) break;
    const met = dv.getUint16(o + 10, true), cs = dv.getUint32(o + 20, true), nl = dv.getUint16(o + 28, true), xl = dv.getUint16(o + 30, true), cl = dv.getUint16(o + 32, true), lo = dv.getUint32(o + 42, true);
    const nom = td.decode(u8.subarray(o + 46, o + 46 + nl)); o += 46 + nl + xl + cl;
    if (nom.endsWith('/') || /(^|\/)(__MACOSX|\.DS_Store)/.test(nom)) continue;
    const d0 = lo + 30 + dv.getUint16(lo + 26, true) + dv.getUint16(lo + 28, true), raw = u8.subarray(d0, d0 + cs);
    if (met === 0) out[nom] = raw;
    else if (met === 8) {
      if (typeof DecompressionStream === 'undefined') throw new Error('deflate');
      out[nom] = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    }
  }
  return out;
}
const maqB64 = (u8) => { let s = ''; for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000)); return btoa(s); };
const maqDataUrl = (nom, u8) => 'data:' + (MAQ_MIME[maqExt(nom)] || 'application/octet-stream') + ';base64,' + maqB64(u8);
// los archivos de un juego (ruta → bytes) en un solo HTML
function maqPaquete(A) {
  const rutas = Object.keys(A); const htmls = rutas.filter((r) => /\.html?$/i.test(r)).sort((a, b) => a.split('/').length - b.split('/').length || (/(^|\/)index\.html?$/i.test(b) ? 1 : 0) - (/(^|\/)index\.html?$/i.test(a) ? 1 : 0));
  const prin = htmls.find((r) => /(^|\/)index\.html?$/i.test(r) && r.split('/').length === htmls[0].split('/').length) || htmls[0]; if (!prin) throw new Error('html');
  const base = prin.includes('/') ? prin.slice(0, prin.lastIndexOf('/') + 1) : '', td = new TextDecoder();
  const rel = (desde, r) => { if (/^(data|blob|https?|mailto|javascript|about):/i.test(r) || r.startsWith('#') || r.startsWith('//')) return null; const p = (r.startsWith('/') ? base + r.slice(1) : desde + r).split('#')[0].split('?')[0]; const s2 = []; for (const x of p.split('/')) { if (x === '..') s2.pop(); else if (x !== '.' && x !== '') s2.push(x); } let k = s2.join('/'); try { k = decodeURIComponent(k); } catch (e) {} return A[k] ? k : null; };
  const urls = {}; const url = (k) => urls[k] || (urls[k] = maqDataUrl(k, A[k]));
  // (lo de adentro de un .css: sus url(...) y @import, contra su carpeta)
  const css = (k) => { const d = k.includes('/') ? k.slice(0, k.lastIndexOf('/') + 1) : ''; return td.decode(A[k]).replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, r) => { const x = rel(d, r.trim()); return x ? `url("${url(x)}")` : m; }).replace(/@import\s+(['"])([^'"]+)\1/g, (m, q, r) => { const x = rel(d, r); return x ? `@import "data:text/css;base64,${maqB64(new TextEncoder().encode(css(x)))}"` : m; }); };
  for (const k of rutas) if (maqExt(k) === 'css') urls[k] = 'data:text/css;base64,' + maqB64(new TextEncoder().encode(css(k)));
  let h = td.decode(A[prin]);
  h = h.replace(/(\s(?:src|href|poster|data-src)\s*=\s*)(["'])([^"']+)\2/gi, (m, at, q, r) => { const x = rel(base, r); return x && !/\.html?$/i.test(x) ? at + q + url(x) + q : m; });
  h = h.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g, (m, q, r) => { const x = rel(base, r); return x ? `url("${url(x)}")` : m; });
  // (el mapa para lo que el juego pide después: las rutas como las escribe él, contra la carpeta del HTML principal)
  const F = {}; for (const k of rutas) { if (k === prin || /\.html?$/i.test(k)) continue; const c = k.startsWith(base) ? k.slice(base.length) : k; F[c] = url(k); }
  const fs = `<script>window.__rbFS=${JSON.stringify(F).replace(/</g, '\\u003c')};<\/script>` + MAQ_FS;
  h = /<head[^>]*>/i.test(h) ? h.replace(/<head[^>]*>/i, (m) => m + fs) : fs + h;
  return { html: h, nombre: (prin.includes('/') ? prin.split('/').slice(-2, -1)[0] : '') || prin.replace(/\.html?$/i, ''), n: rutas.length };
}
// los trabajos: [archivos] cada uno (un .html, un .zip o una carpeta entera)
async function maqSubir(grupos, ctrl, carpeta) {
  const nuevos = grupos.map((L) => ({ id: Math.random().toString(36).slice(2, 9), nombre: carpeta ? (L[0].webkitRelativePath || L[0].name).split('/')[0] : L[0].name, tam: L.reduce((a, f) => a + f.size, 0), lei: 0, estado: 'espera', det: '', L }));
  MAQ.subs.push(...nuevos); MAQ.tab = 'sub'; maqPanelDibujar();
  // (de a uno: varios pesados a la vez ocuparían la memoria del celular todos juntos)
  for (const J of nuevos) {
    try {
      if (J.tam > MAQ_MAX * 1.5) throw new Error(T('maq.grande'));
      J.estado = 'lee'; maqSubPintar();
      const A = {}; let leido = 0;
      for (const f of J.L) { const u8 = await maqLeer(f, (n) => { J.lei = leido + n; maqSubPintar(); }); leido += f.size; J.lei = leido;
        if (carpeta) { const r = (f.webkitRelativePath || f.name).split('/').slice(1).join('/') || f.name; A[r] = u8; } else A[f.name] = u8; }
      J.estado = 'arma'; maqSubPintar();
      let html, nombre = J.nombre.replace(/\.(html?|zip)$/i, '');
      const solo = Object.keys(A); 
      if (solo.length === 1 && /\.html?$/i.test(solo[0])) html = new TextDecoder().decode(A[solo[0]]);
      else { const Z = solo.length === 1 && maqExt(solo[0]) === 'zip' ? await maqZip(A[solo[0]]) : A; const P = maqPaquete(Z); html = P.html; J.det = P.n + ' ' + T('maq.archivos'); }
      if (html.length > MAQ_MAX) throw new Error(T('maq.grande') + ' · ' + maqMB(html.length));
      J.estado = 'guarda'; maqSubPintar();
      const j = await maqImportarTexto(nombre, html, ctrl); if (!j) throw new Error(T('maq.noAnda'));
      J.estado = 'listo'; J.jid = j.id; J.det = maqMB(html.length) + (J.det ? ' · ' + J.det : '');
    } catch (e) { J.estado = 'mal'; J.det = String(e && e.message === 'zip' ? T('maq.noZip') : e && e.message === 'deflate' ? T('maq.noZip') : e && e.message === 'html' ? T('maq.sinHtml') : (e && e.message) || e).slice(0, 120); }
    J.L = null; maqSubPintar();
  }
  if (MAQ.tab === 'sub') maqPanelDibujar();
}
function maqSubDibujar(p) {
  p.querySelector('.mqLista').innerHTML = MAQ.subs.slice().reverse().map((J) => `<div class="mqSub" data-sub="${J.id}"><b dir="auto"></b><small></small><i><u></u></i></div>`).join('');
  maqSubPintar();
}
function maqSubPintar() {
  const p = $('maqPan'); if (!p || p.classList.contains('oc')) return;
  // (el contador de la pestaña: los que faltan)
  const t = p.querySelector('[data-mq="tab:sub"]'); if (!t) { maqPanelDibujar(); return; }
  const n = MAQ.subs.filter((x) => x.estado !== 'listo' && x.estado !== 'mal').length; let c = t.querySelector('.mqN');
  if (n && !c) { c = document.createElement('span'); c.className = 'mqN'; t.appendChild(c); } if (c) { if (n) c.textContent = n; else c.remove(); }
  if (MAQ.tab !== 'sub') return;
  for (const J of MAQ.subs) {
    const e = p.querySelector(`[data-sub="${J.id}"]`); if (!e) continue;
    const pct = J.estado === 'listo' ? 1 : J.tam ? Math.min(1, J.lei / J.tam) * (J.estado === 'lee' ? 0.85 : 0.95) : 0;
    e.className = 'mqSub' + (J.estado === 'listo' ? ' ok' : J.estado === 'mal' ? ' mal' : '');
    e.querySelector('b').textContent = J.nombre;
    e.querySelector('small').textContent = J.estado === 'mal' ? J.det : T('maq.s_' + J.estado) + ' · ' + (J.estado === 'listo' ? J.det : maqMB(J.lei) + ' / ' + maqMB(J.tam));
    e.querySelector('u').style.width = (pct * 100).toFixed(1) + '%';
  }
}
// la foto de un juego tuyo (para la lista, la pantalla del gabinete y la comunidad): 320 × 240, recortada al centro
async function maqFotoPoner(id, f) {
  const j = await maqMio(id); if (!j) return;
  try {
    const bm = await createImageBitmap(f), c = document.createElement('canvas'); c.width = 320; c.height = 240; const g = c.getContext('2d');
    const s = Math.max(320 / bm.width, 240 / bm.height), w = bm.width * s, h = bm.height * s; g.drawImage(bm, (320 - w) / 2, (240 - h) / 2, w, h); bm.close();
    let q = 0.85, u = c.toDataURL('image/jpeg', q); while (u.length > 110000 && q > 0.3) u = c.toDataURL('image/jpeg', (q -= 0.1));   // (la comunidad acepta fotos de hasta 120 000)
    j.foto = u; await maqGuardar(j); MAQ.fotoDe.set(j.id, u); const ss = MAQ.sala.get(j.id); if (ss) ss.foto = u; maqTapaOlvidar(j.id); maqPanelDibujar(); aviso(T('maq.fotoOk'), 2);
  } catch (e) { aviso(T('maq.noFoto'), 3); }
}

// ---------------- la tapa (el cartel del juego: en la lista y en la pantalla del gabinete) ----------------
function maqTapaCanvas(j) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 192; const g = cv.getContext('2d');
  // (con foto: la foto; se carga una vez y, cuando está, se rehace la textura del gabinete)
  if (j.foto) {
    let im = MAQ.fotos.get(j.foto);
    if (!im) { im = new Image(); MAQ.fotos.set(j.foto, im); if (MAQ.fotos.size > 48) MAQ.fotos.delete(MAQ.fotos.keys().next().value); im.onload = () => maqTapaOlvidar(j.id); im.src = j.foto; }
    if (im.complete && im.naturalWidth) { g.drawImage(im, 0, 0, 256, 192); return cv; }
  }
  let h = 0; for (const ch of j.nombre || '') h = (h * 31 + ch.charCodeAt(0)) % 360;
  const gr = g.createLinearGradient(0, 0, 256, 192); gr.addColorStop(0, `hsl(${h},70%,22%)`); gr.addColorStop(1, `hsl(${(h + 60) % 360},80%,8%)`);
  g.fillStyle = gr; g.fillRect(0, 0, 256, 192);
  g.strokeStyle = `hsla(${(h + 180) % 360},90%,60%,0.35)`; g.lineWidth = 1; for (let y = 120; y < 192; y += 8) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
  for (let x = -256; x < 512; x += 24) { g.beginPath(); g.moveTo(128, 104); g.lineTo(x, 192); g.stroke(); }
  g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = 'bold 26px sans-serif'; g.shadowColor = `hsl(${(h + 180) % 360},90%,60%)`; g.shadowBlur = 12;
  const t = (j.nombre || '').toUpperCase(); g.fillText(t.length > 14 ? t.slice(0, 13) + '…' : t, 128, 80); g.shadowBlur = 0;
  g.font = '12px monospace'; g.fillStyle = '#ffe066'; g.fillText(j.id && j.id.startsWith('rb:') ? 'REZOBOX ARCADE' : (j.autor || '').slice(0, 22).toUpperCase(), 128, 104);
  return cv;
}
// (lo que se sabe del juego de un gabinete para su tapa: la foto, si es mío, de la sala o de la comunidad; se busca una vez)
function maqTapaDatos(m) {
  let f = MAQ.fotoDe.get(m.g);
  if (f === undefined) {
    const s = MAQ.sala.get(m.g); f = (s && s.foto) || ''; MAQ.fotoDe.set(m.g, f);
    if (!f && /^u:/.test(m.g)) maqMio(m.g).then((x) => { if (x && x.foto) { MAQ.fotoDe.set(m.g, x.foto); maqTapaOlvidar(m.g); } });
  }
  return { id: m.g, nombre: m.n, autor: '', foto: f || undefined };
}
function maqTapaOlvidar(id) { const t = MAQ.tapas.get(id); if (t && R.tex[t.k]) { R.gl.deleteTexture(R.tex[t.k].gl); delete R.tex[t.k]; } }
// la textura de la tapa para la pantalla del gabinete (una por juego; se rehace si se perdieron las texturas)
function maqTapaMat(j) {
  let t = MAQ.tapas.get(j.id);
  if (t && R.tex[t.k]) return t.mat;
  if (!t) { if (MAQ.tapas.size > 32) { const [k0, x] = MAQ.tapas.entries().next().value; if (R.tex[x.k]) { R.gl.deleteTexture(R.tex[x.k].gl); delete R.tex[x.k]; } MAQ.tapas.delete(k0); } t = { k: TX_PROPIA + 7000 + (MAQ.nTex = (MAQ.nTex || 0) + 1), mat: null }; MAQ.tapas.set(j.id, t); }
  // (cuadrada de 256: en WebGL 1 una de 256 × 192 con mipmaps no se completa y sale negra)
  const gl = R.gl, tx = gl.createTexture(), cv = document.createElement('canvas'); cv.width = cv.height = 256; cv.getContext('2d').drawImage(maqTapaCanvas(j), 0, 0, 256, 256);
  gl.bindTexture(gl.TEXTURE_2D, tx); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  R.tex[t.k] = { gl: tx };
  if (t.mat === null) { t.mat = matPropio('maqTapa' + t.k, [1, 1, 1], { pbr: [0.3, 0, 0.04], em: [0.15, 0.15, 0.15] }); const m = R.mats[t.mat]; m.tex = t.k; m.unlit = true; m.claveBase = ',,UNLIT,'; m.claveGam = ',,UNLIT'; }
  return t.mat;
}
// ---------------- la pantalla en vivo (como las máquinas del Hunter): el juego se ve en el gabinete, para todos ----------------
// El puente de adentro del juego copia su lienzo (8 veces por segundo, en 256 × 192) y lo manda acá; se dibuja en la
// pantalla 3D del gabinete. A la sala va una foto chica (160 × 120, JPEG) 4 veces por segundo, sólo si hay alguien cerca.
// Los demás la ven en ese gabinete y ven al que juega parado adelante, con las manos en la palanca y los botones.
const MAQV = { lienzo: new Map(), envT: 0, enviando: false, n: 0, chico: null, S: 384, ult: new Map() };
function maqVivo(clave) {
  let e = MAQV.lienzo.get(clave);
  // (lienzo en memoria, no en la GPU: se sube a la textura del juego sin compartir recursos entre contextos)
  // (cuadrado, como la tapa: con uno de 256 × 192 la placa lo dibujaba chico en una esquina del vidrio —Discord, 3.7: «que la
  // pantalla sí lo cubra bien»—; el vidrio es 4:3 y el cuadro se estira a él: lo de adentro va encajado en un 4:3)
  // (en memoria, no en la GPU —willReadFrequently—: subirlo desde un lienzo de la placa a la textura del juego compartía
  // recursos entre los dos contextos y el del juego se perdía)
  if (!e) { const cv = document.createElement('canvas'); cv.width = cv.height = MAQV.S; e = { cv, g: cv.getContext('2d', { willReadFrequently: true }), k: TX_PROPIA + 7600 + ++MAQV.n, mat: null, t: 0, sucio: false, de: null }; MAQV.lienzo.set(clave, e); }
  return e;
}
// (ar: ancho/alto del juego; se encaja en el 4:3 del vidrio, sin deformarlo, y lo que sobra queda negro)
function maqVivoPoner(clave, img, de, ar) {
  const e = maqVivo(clave), S = MAQV.S, g = e.g;
  try {
    if (img instanceof ImageData) { const t = MAQV.tmp || (MAQV.tmp = document.createElement('canvas')); if (t.width !== img.width || t.height !== img.height) { t.width = img.width; t.height = img.height; t.g = null; } (t.g || (t.g = t.getContext('2d', { willReadFrequently: true }))).putImageData(img, 0, 0); img = t; }
    ar = ar || (img.width / img.height) || 4 / 3;
    // (en el lienzo cuadrado cada eje va de 0 a S; en el vidrio, el ancho vale 4 y el alto 3)
    let w = S, h = S; if (ar > 4 / 3) h = S * (4 / 3) / ar; else w = S * ar / (4 / 3);
    g.fillStyle = '#000'; if (w < S || h < S) g.fillRect(0, 0, S, S);
    g.imageSmoothingEnabled = true; g.drawImage(img, (S - w) / 2, (S - h) / 2, w, h);
  } catch (x) { return; }
  e.t = performance.now(); e.sucio = true; e.de = de;
}
// la textura (se sube cuando llega un cuadro nuevo; sin mipmaps: 256 × 192 no es potencia de dos)
function maqVivoMat(e) {
  const gl = R.gl; let t = R.tex[e.k];
  if (!t) { const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); t = R.tex[e.k] = { gl: tx }; e.sucio = true; }
  if (e.sucio) { gl.bindTexture(gl.TEXTURE_2D, t.gl); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, e.cv); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); e.sucio = false; }
  if (e.mat === null) { e.mat = matPropio('maqVivo' + e.k, [1, 1, 1], { pbr: [0.3, 0, 0.04], em: [0.15, 0.15, 0.15] }); const m = R.mats[e.mat]; m.tex = e.k; m.unlit = true; m.claveBase = ',,UNLIT,'; m.claveGam = ',,UNLIT'; }
  return e.mat;
}
// un cuadro del juego que estoy jugando: a mi gabinete y (a veces) a la sala
function maqVivoCuadro(buf, ar) {
  const o = MAQ.obj; if (!o || !MAQ.j) { if (buf && buf.close) buf.close(); return; }
  const clave = claveObj(o);
  if (buf instanceof ImageData) maqVivoPoner(clave, buf, RED.ID, ar);
  else if (buf instanceof ArrayBuffer && buf.byteLength === 256 * 192 * 4) maqVivoPoner(clave, new ImageData(new Uint8ClampedArray(buf), 256, 192), RED.ID, 4 / 3);
  else return;
  MAQV.cuadros = (MAQV.cuadros || 0) + 1;
  // (cada cuánto copia el juego su lienzo: con alguien de la sala cerca, 15 por segundo —lo que va por la red—; solo, 1 —la
  // pantalla del gabinete queda tapada por el juego—. La copia espera a que la placa termine el cuadro: el puente además la
  // espacia solo si le sale cara —10 veces lo que tarda—, así nunca le come más de un 10 % al juego)
  let cerca = !!MAQV.siempre; if (!cerca && RED.on) for (const R2 of RED.remotos.values()) if (R2.P && R2.P.pos && R2.P.pos.distTo(o.b.pos) < 60) { cerca = true; break; }
  const ritmo = cerca ? 66 : 1000; if (ritmo !== MAQV.ritmo && MAQ.ifr) { MAQV.ritmo = ritmo; try { MAQ.ifr.contentWindow.postMessage({ rbMaq: 1, t: 'ritmo', ms: ritmo }, '*'); } catch (e) {} }
  // (a la sala: 15 por segundo —antes 4— en WebP de 192 × 144 —antes JPEG de 160 × 120—, cada uno apenas sale del juego:
  // los demás lo ven fluido y sin cola; si la codificación de uno no terminó, el siguiente se salta)
  const ahora = performance.now(); if (!RED.on || MAQV.enviando || ahora - MAQV.envT < 66) return;
  if (!cerca) return;   // (sólo si alguien de la sala está cerca del gabinete)
  MAQV.envT = ahora; MAQV.enviando = true;
  const c = MAQV.chico || (MAQV.chico = Object.assign(document.createElement('canvas'), { width: 192, height: 144 }));
  (c.ctx || (c.ctx = c.getContext('2d', { willReadFrequently: true }))).drawImage(maqVivo(clave).cv, 0, 0, 192, 144);   // (el cuadrado vuelve a 4:3)
  c.toBlob((b) => { if (!b) { MAQV.enviando = false; return; } const w = b.type === 'image/webp', fr = new FileReader(); fr.onload = () => { MAQV.enviando = false; const f = String(fr.result).split(',')[1] || ''; if (f && f.length < 60000) { MAQV.sec = (MAQV.sec || 0) + 1; publicar('a', w ? { k: 'maqv', o: clave, f, t: 'w', s: MAQV.sec } : { k: 'maqv', o: clave, f, s: MAQV.sec }); MAQV.enviados = (MAQV.enviados || 0) + 1; MAQV.bytes = f.length; } }; fr.readAsDataURL(b); }, 'image/webp', 0.5);
}
// el de otro: la foto a su gabinete, y él queda jugando ahí
async function maqVivoRed(d) {
  if (typeof d.o !== 'string' || typeof d.f !== 'string' || d.f.length > 60000) return;
  // (sin foto: un juego sin lienzo; igual se ve que está jugando)
  // (s: el número de cuadro; uno que termina de abrirse después de uno más nuevo no lo pisa)
  // (si el otro recargó, su cuenta vuelve a 1: lo de hace más de 3 s ya no vale)
  const k = d.i + '|' + d.o, s = +d.s || 0, viejo = () => { const u = MAQV.ult.get(k); return s && u && performance.now() - u.t < 3000 && s <= u.s; };
  if (viejo()) return;
  if (d.f) try { const b = await (await fetch('data:image/' + (d.t === 'w' ? 'webp' : 'jpeg') + ';base64,' + d.f)).blob(), bm = await createImageBitmap(b); if (viejo()) { bm.close(); return; } if (s) MAQV.ult.set(k, { s, t: performance.now() }); maqVivoPoner(d.o, bm, d.i, 4 / 3); bm.close(); } catch (x) { return; }
  const R2 = RED.remotos.get(d.i); if (R2 && R2.P) R2.P.maqJ = { o: d.o, t: performance.now() };
}
// la pantalla de cada gabinete con juego: un cartel sobre el vidrio (inclinado como él: 24° hacia atrás)
const MAQ_PANT = { c: [0, 1.205, 0.034], tam: [0.46, 0.33, 0.004], q: Quat.axis(1, 0, 0, -0.415) };
function maqDibujar() {
  // jugando yo: mi cuerpo en el gabinete (las manos en el panel) y, si el juego no tiene lienzo, aviso a la sala cada 2 s
  if (MAQ.j && MAQ.obj && JUG.cuerpo) {
    JUG.cuerpo.maqJ = { o: MAQ.obj, t: performance.now() };
    if (RED.on && performance.now() - MAQV.envT > 2000) { MAQV.envT = performance.now(); publicar('a', { k: 'maqv', o: claveObj(MAQ.obj), f: '' }); }
  }
  for (const o of OBJS) {
    if (o.nombre !== 'Arcade' || !o.maq || !R.gl) continue;
    const j = MAQ_INCLUIDOS.find((x) => x.id === o.maq.g) || maqTapaDatos(o.maq);
    const b = o.b, p = vadd(b.pos, b.q.rot(vsub(v3(MAQ_PANT.c[0], MAQ_PANT.c[1], MAQ_PANT.c[2]), o.c)));
    if (p.distTo(CAM.pos) > 40) continue;
    const e = MAQV.lienzo.get(claveObj(o)), vivo = e && performance.now() - e.t < 2500;
    dibujarCaja(p, MAQ_PANT.tam, b.q.clone().mul(MAQ_PANT.q), vivo ? maqVivoMat(e) : maqTapaMat(j));   // (mul cambia el que lo llama: una copia)
  }
}

// ---------------- usar un gabinete: la biblioteca ----------------
function maqUsar(o) {
  MAQ.obj = o; cerrarPaneles(); soltarPuntero();
  if (o.maq) { maqJugarId(o.maq.g, o.maq); return; }
  maqPanelAbrir();
}
function maqPanel() {
  let p = $('maqPan'); if (p) return p;
  p = document.createElement('div'); p.id = 'maqPan'; p.className = 'panel oc';
  p.innerHTML = `<div class="caja maqCaja"><h3>${glifo('dado')} <span class="mqTit"></span><button class="boton chico mqX" data-mq="cerrar">${glifo('no')}</button></h3>
    <div class="mqTabs"></div><div class="mqLista"></div>
    <div class="mqImp"><label class="boton">${glifo('subir')} <span class="mqTImp"></span><input type="file" class="mqArch" accept=".html,.htm,.zip,text/html,application/zip,application/x-zip-compressed" multiple hidden></label>
      <label class="boton gris mqCarpL">${glifo('carpeta')} <span class="mqTCarp"></span><input type="file" class="mqCarp" webkitdirectory multiple hidden></label>
      <input type="file" class="mqFoto" accept="image/*" hidden>
      <input class="mqUrl" maxlength="400" spellcheck="false" placeholder="https://..."><button class="boton chico" data-mq="url">${glifo('adelante')}</button>
      <select class="mqCtrl"></select></div><div class="mqNota"></div></div>`;
  document.body.appendChild(p);
  p.addEventListener('click', (e) => { const b = e.target.closest('[data-mq]'); if (b) maqAccion(b.dataset.mq); });
  // (3.8: varios a la vez, pesados, .zip y carpetas, con su avance en «Subiendo»)
  p.querySelector('.mqArch').addEventListener('change', (e) => { const L = [...(e.target.files || [])]; e.target.value = ''; if (L.length) maqSubir(L.map((f) => [f]), p.querySelector('.mqCtrl').value); });
  p.querySelector('.mqCarp').addEventListener('change', (e) => { const L = [...(e.target.files || [])]; e.target.value = ''; if (L.length) maqSubir([L], p.querySelector('.mqCtrl').value, true); });
  p.querySelector('.mqFoto').addEventListener('change', async (e) => { const f = e.target.files && e.target.files[0]; e.target.value = ''; if (f && MAQ.fotoPara) await maqFotoPoner(MAQ.fotoPara, f); });
  // (elegir una carpeta no existe en el celular —la vista web de Android no lo deja—: ahí, el .zip)
  if (!('webkitdirectory' in document.createElement('input')) || matchMedia('(pointer: coarse)').matches) p.querySelector('.mqCarpL').style.display = 'none';
  p.querySelector('.mqUrl').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') maqAccion('url'); });
  return p;
}
function maqPanelAbrir() { const p = maqPanel(); p.classList.remove('oc'); UI.abierto = 'maq'; soltarPuntero(); maqPanelDibujar(); }
function maqPanelCerrar() { const p = $('maqPan'); if (p) p.classList.add('oc'); if (UI.abierto === 'maq') UI.abierto = null; }
async function maqPanelDibujar() {
  const p = maqPanel(), n = (MAQ.dib = (MAQ.dib || 0) + 1);
  p.querySelector('.mqTit').textContent = T('maq.lib'); p.querySelector('.mqTImp').textContent = T('maq.importar');
  const sel = p.querySelector('.mqCtrl'); if (!sel.options.length) for (const k of Object.keys(MAQ_CTRL)) sel.add(new Option(T('maq.c_' + k), k));
  p.querySelector('.mqTCarp').textContent = T('maq.carpeta');
  const subiendo = MAQ.subs.filter((x) => x.estado !== 'listo' && x.estado !== 'mal').length;
  p.querySelector('.mqTabs').innerHTML = ['inc', 'mios', 'sala', 'com'].concat(MAQ.subs.length ? ['sub'] : []).map((k) => `<button class="${MAQ.tab === k ? 'sel' : ''}" data-mq="tab:${k}">${esc(T('maq.t_' + k))}${k === 'sub' && subiendo ? `<span class="mqN">${subiendo}</span>` : ''}</button>`).join('');
  if (MAQ.tab === 'sub') { maqSubDibujar(p); return; }
  let L = [];
  if (MAQ.tab === 'inc') L = MAQ_INCLUIDOS;
  else if (MAQ.tab === 'mios') L = (await maqMios()).sort((a, b) => (b.fecha || 0) - (a.fecha || 0));
  else if (MAQ.tab === 'sala') L = [...MAQ.sala.values()].concat(OBJS.filter((o) => o.maq && !MAQ.sala.has(o.maq.g) && !o.maq.g.startsWith('rb:')).map((o) => ({ id: o.maq.g, nombre: o.maq.n, autor: '', falta: true })));
  else if (MAQ.tab === 'com') L = await maqComunidad();
  if (n !== MAQ.dib) return;
  const mio = MAQ.tab === 'mios';
  p.querySelector('.mqLista').innerHTML = L.length ? L.map((j) => `<div class="mqIt" data-id="${esc(j.id)}"><img src="${j.foto || maqTapaCanvas(j).toDataURL('image/jpeg', 0.8)}"><div class="mqNom"><b dir="auto">${esc(j.nombre)}</b><span dir="auto">${esc(j.autor || '')}${mio && !j.url ? `<em>${maqMB(j.hg || (j.html || '').length || 0)}</em>` : ''}</span></div>
    <div class="mqBot"><button class="boton" data-mq="jugar:${esc(j.id)}">${glifo('jugar')} ${esc(T('maq.jugar'))}</button>${mio ? `<button class="boton chico" data-mq="foto:${esc(j.id)}" title="${esc(T('maq.foto'))}" aria-label="${esc(T('maq.foto'))}">${glifo('camara')}</button><button class="boton chico" data-mq="pub:${esc(j.id)}" title="${esc(T('maq.publicar'))}">${glifo('subir')}</button><button class="boton chico" data-mq="borrar:${esc(j.id)}" title="${esc(T('maq.borrar'))}">${glifo('basura')}</button>` : ''}</div></div>`).join('')
    : `<div class="spVacio">${esc(T(MAQ.tab === 'com' && MAQ.comErr ? 'maq.noTienda' : 'maq.vacia'))}</div>`;
}
async function maqAccion(a) {
  if (a === 'cerrar') { maqPanelCerrar(); return; }
  if (a.startsWith('tab:')) { MAQ.tab = a.slice(4); maqPanelDibujar(); return; }
  if (a === 'url') { const p = maqPanel(), u = p.querySelector('.mqUrl').value.trim(); const j = await maqImportarUrl(u, p.querySelector('.mqCtrl').value); if (j) { p.querySelector('.mqUrl').value = ''; MAQ.tab = 'mios'; maqPanelDibujar(); } else aviso(T('maq.urlMal'), 3); return; }
  if (a.startsWith('jugar:')) { const id = a.slice(6), j = MAQ.tab === 'com' ? await maqDeTienda(id) : await maqBuscar(id); if (j) maqElegir(j); else maqJugarId(id, null); return; }
  if (a.startsWith('borrar:')) { await maqBorrarMio(a.slice(7)); maqPanelDibujar(); return; }
  if (a.startsWith('pub:')) { const j = await maqBuscar(a.slice(4)); if (j) maqPublicar(j); }
  if (a.startsWith('foto:')) { MAQ.fotoPara = a.slice(5); maqPanel().querySelector('.mqFoto').click(); }
}
// poner un juego en el gabinete (y avisarle a la sala) y jugarlo
function maqElegir(j) {
  const o = MAQ.obj; if (!o) return;
  if (!j.id.startsWith('rb:') && !j.id.startsWith('t:')) MAQ.sala.set(j.id, j);   // (lo tengo yo: se lo paso a quien lo pida)
  o.maq = { g: j.id, n: j.nombre, c: j.ctrl || 'flechas', de: RED.on ? RED.ID : '' };
  if (RED.on) { publicar('a', { k: 'maq', o: claveObj(o), g: j.id, n: j.nombre.slice(0, 40), c: o.maq.c }); if (!o.remoto) redObjeto(); }
  maqPanelCerrar(); maqVistaAbrir(j);
}
// jugar el que tiene el gabinete (si no lo tengo, se le pide a la sala)
async function maqJugarId(id, info) {
  let j = await maqBuscar(id);
  if (!j && id.startsWith('t:')) j = await maqDeTienda(id.slice(2));
  if (!j && RED.on) { aviso(T('maq.bajando'), 4); j = await maqPedir(id, info && info.de); }
  if (j && j.grande) { aviso(T('maq.pesadoSala').replace('{n}', j.grande), 6); return; }
  if (!j) { aviso(T('maq.noHay'), 3); MAQ.tab = 'inc'; maqPanelAbrir(); return; }
  maqVistaAbrir(j);
}

// ---------------- jugar: el juego en el medio, el mundo atrás y los controles de la maquinita ----------------
function maqVista() {
  let v = $('maqVista'); if (v) return v;
  v = document.createElement('div'); v.id = 'maqVista'; v.className = 'oc';
  const bt = (k, t, cl) => `<button class="mqB ${cl || ''}" data-b="${k}">${t}</button>`;
  v.innerHTML = `<div class="mqMarco"><div class="mqBarra"><span class="mqJN" dir="auto"></span><select class="mqCtrlV"></select><button class="mqSalir mqAj" data-mqv="aj">${glifo('ajustar')}</button><button class="mqSalir" data-mqv="lib">${glifo('caja')}</button><button class="mqSalir" data-mqv="salir">${glifo('no')}</button></div><div class="mqHueco"></div></div>
    <div class="mqIzq"><div class="mqPalanca"><div class="mqBola"></div></div><div class="mqCruz">${bt('arr', glifo('subir'), 'cA')}${bt('izq', glifo('atras'), 'cI')}${bt('der', glifo('adelante'), 'cD')}${bt('aba', glifo('bajar'), 'cB')}</div></div>
    <div class="mqDer">${bt('Y', 'Y', 'bY')}${bt('X', 'X', 'bX')}${bt('B', 'B', 'bB')}${bt('A', 'A', 'bA')}</div>
    <div class="mqMed">${bt('select', 'SELECT', 'chico')}${bt('start', 'START', 'chico')}</div>`;
  document.body.appendChild(v);
  v.querySelector('[data-mqv=salir]').addEventListener('click', maqVistaCerrar);
  // (ajustar: el lienzo de un juego de tamaño fijo, agrandado al centro hasta llenar la pantalla; se recuerda por juego)
  v.querySelector('[data-mqv=aj]').addEventListener('click', () => { if (!MAQ.j) return; const A = (PREFS.maqAj = PREFS.maqAj || {}); if (A[MAQ.j.id]) delete A[MAQ.j.id]; else A[MAQ.j.id] = 1; guardarPrefs(); maqAjustar(); });
  v.querySelector('[data-mqv=lib]').addEventListener('click', () => { maqVistaCerrar(); MAQ.tab = 'inc'; maqPanelAbrir(); });   // (cambiar el juego del gabinete)
  const sel = v.querySelector('.mqCtrlV'); for (const k of Object.keys(MAQ_CTRL)) sel.add(new Option(T('maq.c_' + k), k));
  sel.addEventListener('change', () => { maqSoltarTodo(); MAQ.ctrl = sel.value; v.classList.toggle('mqSinCtrl', !MAQ_CTRL[MAQ.ctrl]); if (MAQ.j && MAQ.j.id.startsWith('u:')) { MAQ.j.ctrl = sel.value; maqGuardar(MAQ.j); } });
  // botones: apretar y soltar (con varios dedos a la vez)
  for (const b of v.querySelectorAll('.mqB')) {
    const k = b.dataset.b;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); b.setPointerCapture(e.pointerId); b.classList.add('ap'); maqTecla(k, true); });
    const suelta = () => { b.classList.remove('ap'); maqTecla(k, false); };
    b.addEventListener('pointerup', suelta); b.addEventListener('pointercancel', suelta); b.addEventListener('lostpointercapture', suelta);
  }
  // la palanca: hacia dónde se tira (con 8 direcciones) aprieta las teclas de la cruceta
  const pal = v.querySelector('.mqPalanca'), bola = v.querySelector('.mqBola'); let id = null;
  const mover = (e) => {
    const r = pal.getBoundingClientRect(), cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    let dx = PANT.rot ? e.clientY - cy : e.clientX - cx, dy = PANT.rot ? cx - e.clientX : e.clientY - cy; const R0 = r.width / 2, L = Math.hypot(dx, dy);
    if (L > R0) { dx *= R0 / L; dy *= R0 / L; }
    bola.style.transform = `translate(${dx}px,${dy}px)`;
    const u = 0.38 * R0; maqTecla('izq', dx < -u); maqTecla('der', dx > u); maqTecla('arr', dy < -u); maqTecla('aba', dy > u);
  };
  pal.addEventListener('pointerdown', (e) => { e.preventDefault(); id = e.pointerId; pal.setPointerCapture(id); mover(e); });
  pal.addEventListener('pointermove', (e) => { if (e.pointerId === id) mover(e); });
  const fin = () => { id = null; bola.style.transform = ''; for (const k of ['izq', 'der', 'arr', 'aba']) maqTecla(k, false); };
  pal.addEventListener('pointerup', fin); pal.addEventListener('pointercancel', fin);
  addEventListener('message', (e) => {
    if (!MAQ.ifr || e.source !== MAQ.ifr.contentWindow || !e.data) return;
    if (typeof e.data.rbMaqOk === 'string') { MAQ.eco.push(e.data.rbMaqOk); if (MAQ.eco.length > 50) MAQ.eco.shift(); }
    // (3.8: cada cuadro del juego, hasta 60 por segundo, hasta 320 de ancho con su proporción —antes 8 por segundo en 256 ×
    // 192—. Píxeles en memoria y no una imagen de la placa: una ImageBitmap del iframe, al cerrarlo, se llevaba el contexto)
    if (e.data.a > 0) { const ar = Math.min(2.4, Math.max(0.5, +e.data.a)); if (Math.abs(ar - (MAQ.ar || 0)) > 0.01) { MAQ.ar = ar; maqVista().style.setProperty('--mqAr', ar.toFixed(4)); } }
    if (e.data.rbMaqPx instanceof ArrayBuffer) { MAQV.copiaMs = +e.data.c || 0; MAQV.copiaCada = +e.data.i || 0; const w = e.data.w | 0, h = e.data.h | 0; if (w > 0 && h > 0 && w <= 400 && h <= 400 && e.data.rbMaqPx.byteLength === w * h * 4) maqVivoCuadro(new ImageData(new Uint8ClampedArray(e.data.rbMaqPx), w, h), w / h); }
  });
  return v;
}
function maqVistaAbrir(j) {
  const v = maqVista(); maqVistaQuitarJuego();
  MAQ.j = j; MAQ.ctrl = MAQ_CTRL[j.ctrl] !== undefined ? j.ctrl : 'flechas'; MAQ.eco.length = 0;
  MAQ.ar = 0; v.style.removeProperty('--mqAr'); MAQV.ritmo = 0;   // (4:3 hasta que llegue el primer cuadro del juego nuevo)
  v.querySelector('.mqJN').textContent = j.nombre; v.querySelector('.mqCtrlV').value = MAQ.ctrl; v.classList.toggle('mqSinCtrl', !MAQ_CTRL[MAQ.ctrl]);
  const f = document.createElement('iframe'); f.className = 'mqJuego'; f.setAttribute('allow', 'autoplay; fullscreen; gamepad');
  // (aislado: sin "allow-same-origin" no lee el almacenamiento ni la página del juego; una dirección de otro sitio sí
  // puede tener su propio origen, porque no es el nuestro)
  const ajeno = j.url && (() => { try { return new URL(j.url).origin !== location.origin; } catch (e) { return false; } })();
  f.setAttribute('sandbox', 'allow-scripts allow-pointer-lock' + (ajeno ? ' allow-same-origin' : ''));
  if (j.url) f.src = j.url; else f.srcdoc = maqConPuente(j.html);
  v.querySelector('.mqHueco').appendChild(f); MAQ.ifr = f;
  v.classList.remove('oc'); document.body.classList.add('maqOn'); UI.abierto = 'maqv'; soltarPuntero();
  maqPararseAdelante();
  f.addEventListener('load', () => { try { f.contentWindow.focus(); } catch (e) {} f.focus(); maqAjustar(); setTimeout(() => { if (MAQ.ifr === f) maqAjustar(); }, 1500); });
  maqAjustar();
  if (typeof sonar === 'function') sonar('Click', null, 0.5);
}
function maqAjustar() {
  const on = !!(MAQ.j && PREFS.maqAj && PREFS.maqAj[MAQ.j.id]), b = $('maqVista') && $('maqVista').querySelector('.mqAj'); if (b) { b.classList.toggle('sel', on); b.title = T('maq.ajustar'); b.setAttribute('aria-label', T('maq.ajustar')); }
  if (MAQ.ifr) try { MAQ.ifr.contentWindow.postMessage({ rbMaq: 1, t: 'ajustar', on }, '*'); } catch (e) {}
}
function maqVistaQuitarJuego() { maqSoltarTodo(); if (MAQ.ifr) { MAQ.ifr.remove(); MAQ.ifr = null; } }
function maqVistaCerrar() {
  maqVistaQuitarJuego(); const v = $('maqVista'); if (v) v.classList.add('oc');
  document.body.classList.remove('maqOn'); if (UI.abierto === 'maqv') UI.abierto = null; MAQ.j = null;
}
// el que juega se para adelante del gabinete, mirándolo (como en las máquinas del Hunter: los demás lo ven jugando)
// (pegado al frente: el panel sobresale 0,53 m del centro del gabinete; más lejos, el brazo no llega a los controles)
function maqLugar(o) {
  const b = o.b, fr = b.q.rot(v3(0, 0, 1)); fr.y = 0; if (fr.len() < 0.3) return null; fr.norm();
  const meta = vadd(b.pos, vscale(fr, 0.8)), piso = pisoBajo(v3(meta.x, b.pos.y + 1, meta.z), 3);
  return { p: v3(meta.x, (piso === null ? b.pos.y - 0.9 : piso) + 1, meta.z), yaw: Math.atan2(-fr.x, -fr.z) };
}
function maqPararseAdelante() {
  const o = MAQ.obj; if (!o || !JUG.vivo || JUG.vehiculo) return;
  const L = maqLugar(o); if (!L || L.p.distTo(JUG.pos) > 4) return;
  JUG.pos.copy(L.p); JUG.vel.set(0, 0, 0); JUG.yaw = L.yaw; JUG.pitch = 0.15; JUG.maqFijo = L.p.clone();
}
// las manos en el panel del gabinete (la izquierda en la palanca, la derecha en los botones): cinemática inversa de los
// dos brazos (celumano.js), con las posiciones de los huesos de cada personaje
const MAQ_PANEL = { izq: [-0.13, 0.04, 0.46], der: [0.12, 0.03, 0.46] };   // (en el gabinete, mirándolo de frente: +x a la derecha del que juega, y desde el centro, z hacia adelante)
function maqBrazos(P) {
  const J = P.maqJ, o = J && (typeof J.o === 'string' ? buscarObjeto(J.o) : J.o); if (!o || !o.b) { P.maqJ = null; return; }
  // (a los lejanos se los anima uno de cada tantos cuadros: en los otros la pose es la misma, que ya tiene la inclinación y
  // los brazos; volver a inclinarla la doblaba cada vez más —las manos quedaban a 30-40 cm del panel—)
  if (P.animN !== undefined && P.maqAnimN === P.animN) return; P.maqAnimN = P.animN;
  const md = P.md, h = P.D.h, b = o.b, up = v3(0, 1, 0);
  // inclinado hacia el gabinete, como se juega una maquinita: lo justo para que los brazos lleguen al panel (los altos se
  // inclinan más). Se reparte entre dos vértebras y se calcula una vez por personaje y gabinete
  const sps = [h.Spine, h.Spine1].filter((x) => x !== undefined), fw = v3(Math.sin(P.yaw), 0, Math.cos(P.yaw)), ej = vcross(up, fw).norm();
  const inclinar = (a) => { for (const i of sps) celmGirar(md, i, Quat.axis(ej.x, ej.y, ej.z, a / sps.length)); };
  md.actualizar();
  if (P.maqIncl === undefined || P.maqInclO !== o) {
    const r0 = sps.map((i) => md.r[i].slice()), meta = (L) => vadd(b.pos, b.q.rot(v3(L[0], L[1] + 0.04, L[2] + 0.06)));
    let elegido = 0.6;
    for (let a = 0.1; a <= 0.85; a += 0.05) {
      sps.forEach((i, k) => { md.r[i] = r0[k].slice(); }); md.sucio = true; md.actualizar(); inclinar(a);
      let ok2 = true;
      for (const [l, L] of [['Right', MAQ_PANEL.der], ['Left', MAQ_PANEL.izq]]) { const S = celmPos(md, h[l + 'Arm']), al = S.distTo(celmPos(md, h[l + 'ForeArm'])) + celmPos(md, h[l + 'ForeArm']).distTo(celmPos(md, h[l + 'Hand'])); if (S.distTo(meta(L)) > al * 0.97) ok2 = false; }
      if (ok2) { elegido = a; break; }
    }
    sps.forEach((i, k) => { md.r[i] = r0[k].slice(); }); md.sucio = true; md.actualizar();
    P.maqIncl = elegido; P.maqInclO = o;
  }
  inclinar(P.maqIncl);
  for (const [lado, L] of [['Right', MAQ_PANEL.der], ['Left', MAQ_PANEL.izq]]) {
    const sh = h[lado + 'Arm'], el = h[lado + 'ForeArm'], ha = h[lado + 'Hand']; if ([sh, el, ha].some((x) => x === undefined)) continue;
    const wrist = vadd(b.pos, b.q.rot(v3(L[0], L[1] + 0.04, L[2] + 0.06)));
    const S = celmPos(md, sh), a = S.distTo(celmPos(md, el)), c2 = celmPos(md, el).distTo(celmPos(md, ha));
    const dW = vsub(wrist, S), dist = Math.min(dW.len(), (a + c2) * 0.999), dn = dW.clone().norm();
    const afuera = vsub(S, celmPos(md, h.Spine2 !== undefined ? h.Spine2 : h.Spine1)); afuera.y = 0; afuera.norm();
    const polo = vadd(vscale(afuera, 0.6), vscale(up, -0.8)).norm();
    const cosA = clamp((a * a + dist * dist - c2 * c2) / (2 * a * dist), -1, 1), alto = a * Math.sqrt(1 - cosA * cosA);
    const lad = vsub(polo, vscale(dn, vdot(polo, dn))).norm(), codo = vadd(S, vadd(vscale(dn, a * cosA), vscale(lad, alto)));
    celmGirar(md, sh, celmDesde(vsub(celmPos(md, el), S).norm(), vsub(codo, S).norm()));
    celmGirar(md, el, celmDesde(vsub(celmPos(md, ha), celmPos(md, el)).norm(), vsub(wrist, celmPos(md, el)).norm()));
  }
}
// una tecla de PC al juego (por mensaje, al puente de adentro)
function maqTecla(boton, abajo) {
  const C = MAQ_CTRL[MAQ.ctrl]; if (!C || !MAQ.ifr) return;
  const k = C[boton]; if (!k) return;
  if (abajo === MAQ.apretadas.has(k)) return;
  if (abajo) MAQ.apretadas.add(k); else MAQ.apretadas.delete(k);
  try { MAQ.ifr.contentWindow.postMessage({ rbMaq: 1, t: abajo ? 'keydown' : 'keyup', key: k, code: maqCode(k) }, '*'); } catch (e) {}
}
function maqSoltarTodo() {
  if (MAQ.ifr) for (const k of MAQ.apretadas) try { MAQ.ifr.contentWindow.postMessage({ rbMaq: 1, t: 'keyup', key: k, code: maqCode(k) }, '*'); } catch (e) {}
  MAQ.apretadas.clear(); const v = $('maqVista'); if (v) for (const b of v.querySelectorAll('.mqB.ap')) b.classList.remove('ap');
}

// ---------------- en la sala ----------------
// lo que dice el estado del mundo de cada gabinete (los que se ven cuando uno entra tarde)
function maqDeMundo(o, x) { if (Array.isArray(x) && typeof x[0] === 'string' && /^(rb|u|w|t):[a-z0-9]{3,24}$/.test(x[0])) o.maq = { g: x[0], n: String(x[1] || '').slice(0, 40), c: MAQ_CTRL[x[2]] !== undefined ? x[2] : 'flechas', de: typeof x[3] === 'string' ? x[3] : o.dueno }; }
const maqAlMundo = (o) => (o.maq ? [o.maq.g, o.maq.n, o.maq.c, o.maq.de || RED.ID] : 0);
// el HTML de a pedazos (comprimido si el navegador sabe): 24 mil letras por mensaje, 8 por segundo
async function maqPedazos(j) {
  const txt = JSON.stringify({ n: j.nombre, a: j.autor || '', c: j.ctrl, h: j.html || '', u: j.url || '', f: j.foto || '' });
  let d = null, z = 0;
  if (typeof CompressionStream === 'function') { try { const b = new Uint8Array(await new Response(new Blob([txt]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); d = btoa(s); z = 1; } catch (e) {} }
  if (!d) d = txt;
  const P = []; for (let i = 0; i < d.length; i += 24000) P.push(d.slice(i, i + 24000));
  return { P, z };
}
async function maqMandar(j, para) {
  if (!RED.on || MAQ.mandando === j.id) return; MAQ.mandando = j.id;
  const { P, z } = await maqPedazos(j);
  // (hasta 400 pedazos: unos 7 MB comprimido, casi un minuto; uno más pesado no entra por la sala: se avisa al que lo pidió)
  if (P.length > 400) { publicar('a', { k: 'maqg', g: j.id, para, mb: maqMB(P.length * 18000) }); MAQ.mandando = null; return; }
  // (x: el número de pedazo; "i" no, que la red lo usa para el que manda)
  for (let x = 0; x < P.length; x++) { publicar('a', { k: 'maqd', g: j.id, para, x, n: P.length, z, d: P[x] }); await new Promise((ok) => setTimeout(ok, 125)); }
  MAQ.mandando = null;
}
function maqPedir(id, de) {
  if (MAQ.esperas.has(id)) return MAQ.esperas.get(id).p;
  let fin; const p = new Promise((ok) => { fin = ok; }); MAQ.esperas.set(id, { p, fin });
  publicar('a', { k: 'maqp', g: id, a: de || '' });
  setTimeout(() => { const e = MAQ.esperas.get(id); if (e && !MAQ.partes.has(id)) { MAQ.esperas.delete(id); e.fin(null); } }, 6000);
  return p;
}
async function maqRed(d) {
  if (d.k === 'maq') {
    const o = typeof d.o === 'string' ? buscarObjeto(d.o) : null; if (!o || o.nombre !== 'Arcade') return;
    maqDeMundo(o, [d.g, d.n, d.c, d.i]); if (!o.remoto) redObjeto();
    return;
  }
  if (d.k === 'maqp' && typeof d.g === 'string') {   // alguien quiere un juego: lo manda quien lo puso (o, si ése no está, el primero que lo tenga)
    if (d.a && d.a !== RED.ID && RED.remotos.has(d.a)) return;
    const j = MAQ.sala.get(d.g) || (await maqMio(d.g, true)); if (!j) return;
    if (!d.a || d.a !== RED.ID) await new Promise((ok) => setTimeout(ok, Math.random() * 1500));
    if (MAQ.partes.has(d.g) && MAQ.partes.get(d.g).ajeno) return;   // (ya lo está mandando otro)
    maqMandar(j, d.i); return;
  }
  if (d.k === 'maqg' && typeof d.g === 'string' && d.para === RED.ID) { const w = MAQ.esperas.get(d.g); if (w) { MAQ.esperas.delete(d.g); w.fin({ grande: String(d.mb || '').slice(0, 12) }); } return; }
  if (d.k === 'maqd' && typeof d.g === 'string' && typeof d.d === 'string') {
    const n = d.n | 0, i = d.x | 0; if (n < 1 || n > 400 || i < 0 || i >= n) return;
    let e = MAQ.partes.get(d.g); if (!e || e.n !== n) { e = { n, z: d.z ? 1 : 0, p: new Array(n), llegaron: 0, ajeno: d.i !== RED.ID }; MAQ.partes.set(d.g, e); }
    if (e.p[i] === undefined) { e.p[i] = d.d; e.llegaron++; if (n > 40 && e.llegaron % 40 === 0 && MAQ.esperas.has(d.g)) aviso(T('maq.bajando') + ' ' + Math.round(100 * e.llegaron / n) + ' %', 3); }
    if (e.llegaron < n) return;
    MAQ.partes.delete(d.g);
    let txt = e.p.join('');
    try {
      if (e.z) { const s = atob(txt), b = new Uint8Array(s.length); for (let k = 0; k < s.length; k++) b[k] = s.charCodeAt(k); txt = new TextDecoder().decode(await desgz(b)); }
      const x = JSON.parse(txt); if (!x || typeof x.n !== 'string') return;
      const j = { id: d.g, nombre: x.n.slice(0, 40), autor: String(x.a || '').slice(0, 24), ctrl: MAQ_CTRL[x.c] !== undefined ? x.c : 'flechas' };
      if (typeof x.u === 'string' && /^https:\/\//.test(x.u)) j.url = x.u; else j.html = String(x.h || '');
      if (typeof x.f === 'string' && /^data:image\/(jpeg|png|webp);base64,/.test(x.f) && x.f.length <= 120000) { j.foto = x.f; MAQ.fotoDe.set(d.g, x.f); maqTapaOlvidar(d.g); }
      MAQ.sala.set(d.g, j);
      const w = MAQ.esperas.get(d.g); if (w) { MAQ.esperas.delete(d.g); w.fin(j); }
    } catch (x) {}
  }
}

// ---------------- la comunidad (la tienda): ver, jugar y publicar ----------------
async function maqComunidad() {
  MAQ.comErr = false;
  try {
    const r = await (await fetch(`${TIENDA_URL}lista?tipo=juego&orden=pop&p=0`)).json();
    // (una tienda vieja no conoce "juego" y devuelve mods: se quedan afuera)
    const L = (r.items || []).filter((x) => x.tipo === 'juego' && /^[a-z0-9]{8}$/.test(x.id)).map((x) => ({ id: x.id, nombre: x.nombre, autor: x.autor, foto: /^data:image\//.test(x.icono || '') ? x.icono : null }));
    if (!L.length && r.items && r.items.length) MAQ.comErr = true;
    return L;
  } catch (e) { MAQ.comErr = true; return []; }
}
async function maqDeTienda(id) {
  try {
    const v = validarRB(await (await fetch(TIENDA_URL + 'item/' + id)).json());
    if (typeof v !== 'object' || v.formato !== 'rezobox-juego') return null;
    const j = { id: 't:' + id, nombre: v.nombre, autor: v.autor, ctrl: v.ctrl, html: v.html }; if (typeof v.foto === 'string' && /^data:image\//.test(v.foto)) j.foto = v.foto;
    MAQ.sala.set(j.id, j); MAQ.fotoDe.delete(j.id); maqTapaOlvidar(j.id); return j;
  } catch (e) { return null; }
}
async function maqPublicar(j) {
  if (!j.html) { aviso(T('maq.noTienda'), 3); return; }
  // (la comunidad guarda juegos de hasta 1,8 MB: uno más pesado se juega en el aparato y en la sala, pero no se publica)
  if (j.html.length > 1800000) { aviso(T('maq.pesadoTienda').replace('{n}', maqMB(j.html.length)), 6); return; }
  const foto = j.foto && j.foto.length <= 115000 ? j.foto : maqTapaCanvas(j).toDataURL('image/jpeg', 0.75);
  try {
    const r = await (await fetch(TIENDA_URL + 'publicar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ formato: 'rezobox-juego', nombre: j.nombre, autor: PREFS.nombre || 'Anónimo', descripcion: '', etiquetas: ['diversion'], foto, ctrl: j.ctrl, html: j.html }) })).json();
    if (r && r.id) aviso(T('maq.publicado'), 3); else aviso(T('maq.noTienda') + (r && r.error ? ' (' + r.error + ')' : ''), 4);
  } catch (e) { aviso(T('maq.noTienda'), 3); }
}
