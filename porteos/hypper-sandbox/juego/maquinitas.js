// ---------------- maquinitas: juegos HTML en los gabinetes (el prop Arcade) ----------------
// Se usa un gabinete (E o el botón de usar) y se elige un juego de la biblioteca: los que trae el juego, los tuyos
// (importados de un .html o de una dirección, guardados en el navegador), los que puso alguien en la sala y los de la
// comunidad (la tienda). El juego se juega en el medio de la pantalla con el mundo atrás; en el celular los controles
// de siempre se van y aparecen los de la maquinita (palanca o cruceta, A B X Y, Select y Start), que le mandan teclas
// de PC al juego. Los juegos corren aislados: un iframe sandbox sin permiso de mismo origen (no leen nada del juego ni
// del navegador); un puente chico adentro recibe las teclas y le da al juego un localStorage de mentira.
// En la sala, el gabinete dice qué juego tiene y quien lo puso le pasa el HTML (comprimido, de a pedazos) al que lo quiera.
const MAQ = { lib: [], libOk: false, obj: null, j: null, vista: null, ifr: null, apretadas: new Set(), sala: new Map(), partes: new Map(), esperas: new Map(), tapas: new Map(), tab: 'inc', eco: [], com: null };
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
addEventListener('message',function(e){var m=e.data;if(!m||m.rbMaq!==1)return;var k=m.key,n=KC[k]||(k.length===1?k.toUpperCase().charCodeAt(0):0);
var ev=new KeyboardEvent(m.t,{key:k,code:m.code,bubbles:true,cancelable:true});try{Object.defineProperty(ev,'keyCode',{get:function(){return n}});Object.defineProperty(ev,'which',{get:function(){return n}})}catch(x){}
var a=document.activeElement,t=a&&a!==document.body?a:(document.querySelector('canvas')||document.body||document);t.dispatchEvent(ev);
try{parent.postMessage({rbMaqOk:m.t+':'+k},'*')}catch(x){}});})();<\/script>`;
const maqConPuente = (h) => (/<head[^>]*>/i.test(h) ? h.replace(/<head[^>]*>/i, (m) => m + MAQ_PUENTE) : MAQ_PUENTE + h);

// ---------------- los juegos que trae (hechos para RezoBox) ----------------
const MAQ_HTML = (t, js) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${t}</title>
<style>html,body{margin:0;height:100%;background:#000;overflow:hidden}canvas{display:block;width:100%;height:100%;object-fit:contain;image-rendering:pixelated}</style></head>
<body><canvas id="c" width="320" height="240"></canvas><script>var c=document.getElementById('c'),g=c.getContext('2d'),K={},P={};
addEventListener('keydown',function(e){K[e.key.toLowerCase()]=1;P[e.key.toLowerCase()]=1;if(/^(arrow| )/i.test(e.key))e.preventDefault()});addEventListener('keyup',function(e){K[e.key.toLowerCase()]=0});
function tec(){for(var i=0;i<arguments.length;i++)if(K[arguments[i]])return 1;return 0}function pul(){for(var i=0;i<arguments.length;i++)if(P[arguments[i]])return 1;return 0}
function txt(s,x,y,z,col){g.fillStyle=col||'#fff';g.font=(z||10)+'px monospace';g.textAlign='center';g.fillText(s,x,y)}
${js}
var u=performance.now();function bucle(n){var dt=Math.min(0.05,(n-u)/1000);u=n;paso(dt);P={};requestAnimationFrame(bucle)}requestAnimationFrame(bucle);<\/script></body></html>`;
const MAQ_INCLUIDOS = [
  { id: 'rb:serpiente', nombre: 'Serpiente', autor: 'RezoBox', ctrl: 'flechas', html: MAQ_HTML('Serpiente', `var N=20,M=15,S,d,nd,f,pt,t,v,vivo=0,mx=0;
function nueva(){S=[[10,7],[9,7],[8,7]];d=[1,0];nd=d;pt=0;t=0;v=0.14;vivo=1;comida()}function comida(){do{f=[Math.random()*N|0,Math.random()*M|0]}while(S.some(function(s){return s[0]==f[0]&&s[1]==f[1]}))}
function paso(dt){if(!vivo){if(pul(' ','enter'))nueva()}else{if(tec('arrowup','w')&&d[1]!=1)nd=[0,-1];if(tec('arrowdown','s')&&d[1]!=-1)nd=[0,1];if(tec('arrowleft','a')&&d[0]!=1)nd=[-1,0];if(tec('arrowright','d')&&d[0]!=-1)nd=[1,0];
t+=dt;while(t>v){t-=v;d=nd;var h=[(S[0][0]+d[0]+N)%N,(S[0][1]+d[1]+M)%M];if(S.some(function(s){return s[0]==h[0]&&s[1]==h[1]})){vivo=0;mx=Math.max(mx,pt);break}S.unshift(h);if(h[0]==f[0]&&h[1]==f[1]){pt++;v=Math.max(0.06,v*0.96);comida()}else S.pop()}}
g.fillStyle='#071a10';g.fillRect(0,0,320,240);g.fillStyle='#0d2a1a';for(var i=0;i<N;i++)for(var j=0;j<M;j++)if((i+j)%2)g.fillRect(i*16,j*16,16,16);
g.fillStyle='#ff3355';g.fillRect(f[0]*16+3,f[1]*16+3,10,10);S.forEach(function(s,i){g.fillStyle=i?'#3ddc84':'#b6ffce';g.fillRect(s[0]*16+1,s[1]*16+1,14,14)});
txt(pt+'',300,14,12,'#ffe066');if(!vivo)txt(S.length>3?'GAME OVER  '+pt+'  (MAX '+mx+')':'SERPIENTE',160,110,16,'#fff'),txt('START / ESPACIO',160,135,10,'#9fe')}
nueva();vivo=0;S=[[10,7],[9,7],[8,7]];` ) },
  { id: 'rb:ladrillos', nombre: 'Ladrillos', autor: 'RezoBox', ctrl: 'flechas', html: MAQ_HTML('Ladrillos', `var px,bx,by,vx,vy,pega,L,vidas,pt,niv,vivo=0;
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
  { id: 'rb:meteoros', nombre: 'Meteoros', autor: 'RezoBox', ctrl: 'flechas', html: MAQ_HTML('Meteoros', `var sx,B,R,E,pt,vidas,ce,t,inv,vivo=0,st=[];for(var i=0;i<60;i++)st.push([Math.random()*320,Math.random()*240,Math.random()*40+10]);
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
      const r = indexedDB.open('rezobox-juegos', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('j', { keyPath: 'id' });
      r.onsuccess = () => ok(r.result); r.onerror = () => ok(null);
    } catch (e) { ok(null); }
  }));
}
async function maqMios() {
  const db = await maqDB(); if (!db) return MAQ.memoria || [];
  return new Promise((ok) => { try { const r = db.transaction('j').objectStore('j').getAll(); r.onsuccess = () => ok(r.result || []); r.onerror = () => ok([]); } catch (e) { ok([]); } });
}
async function maqGuardar(j) {
  const db = await maqDB();
  if (!db) { MAQ.memoria = (MAQ.memoria || []).filter((x) => x.id !== j.id).concat([j]); return true; }   // (sin IndexedDB: hasta recargar)
  return new Promise((ok) => { try { const t = db.transaction('j', 'readwrite'); t.objectStore('j').put(j); t.oncomplete = () => ok(true); t.onerror = () => ok(false); } catch (e) { ok(false); } });
}
async function maqBorrarMio(id) {
  const db = await maqDB(); if (!db) { MAQ.memoria = (MAQ.memoria || []).filter((x) => x.id !== id); return; }
  return new Promise((ok) => { try { const t = db.transaction('j', 'readwrite'); t.objectStore('j').delete(id); t.oncomplete = () => ok(); t.onerror = () => ok(); } catch (e) { ok(); } });
}
// un juego por su id (incluido, tuyo, de la sala o de la comunidad), o null
async function maqBuscar(id) {
  const inc = MAQ_INCLUIDOS.find((x) => x.id === id); if (inc) return inc;
  if (MAQ.sala.has(id)) return MAQ.sala.get(id);
  return (await maqMios()).find((x) => x.id === id) || null;
}
// importar: un .html (texto) o una dirección; el id sale del contenido (el mismo juego, el mismo id en todos lados)
async function maqHuella(s) {
  try { const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); return [...h.slice(0, 6)].map((b) => b.toString(16).padStart(2, '0')).join(''); }
  catch (e) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return (h >>> 0).toString(16); }
}
async function maqImportarTexto(nombre, html, ctrl) {
  if (typeof html !== 'string' || html.length < 20) return null;
  if (html.length > 3e6) { aviso(T('maq.grande'), 3); return null; }
  const j = { id: 'u:' + (await maqHuella(html)), nombre: (nombre || 'Juego').replace(/\.html?$/i, '').slice(0, 40), autor: PREFS.nombre || '', ctrl: MAQ_CTRL[ctrl] !== undefined ? ctrl : 'flechas', html, fecha: Date.now() };
  await maqGuardar(j); return j;
}
async function maqImportarUrl(url, ctrl) {
  if (!/^https:\/\/[^\s]+$/i.test(url || '')) return null;
  // (si se puede leer, se guarda el HTML con la dirección de base para que encuentre lo suyo; si no, se juega desde ahí)
  try { const r = await fetch(url); if (r.ok) { const h = await r.text(); if (/<html|<script|<canvas|<body/i.test(h)) return maqImportarTexto(decodeURIComponent(url.split('/').filter(Boolean).pop() || 'Juego'), h.replace(/<head[^>]*>/i, (m) => m + `<base href="${esc(url)}">`), ctrl); } } catch (e) {}
  const j = { id: 'w:' + (await maqHuella(url)), nombre: (url.split('/').filter(Boolean).pop() || 'Juego').slice(0, 40), autor: PREFS.nombre || '', ctrl: MAQ_CTRL[ctrl] !== undefined ? ctrl : 'flechas', url, fecha: Date.now() };
  await maqGuardar(j); return j;
}

// ---------------- la tapa (el cartel del juego: en la lista y en la pantalla del gabinete) ----------------
function maqTapaCanvas(j) {
  const cv = document.createElement('canvas'); cv.width = 256; cv.height = 192; const g = cv.getContext('2d');
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
// la textura de la tapa para la pantalla del gabinete (una por juego; se rehace si se perdieron las texturas)
function maqTapaMat(j) {
  let t = MAQ.tapas.get(j.id);
  if (t && R.tex[t.k]) return t.mat;
  if (!t) { if (MAQ.tapas.size > 32) { const [k0, x] = MAQ.tapas.entries().next().value; if (R.tex[x.k]) { R.gl.deleteTexture(R.tex[x.k].gl); delete R.tex[x.k]; } MAQ.tapas.delete(k0); } t = { k: DATA.tx.length + 7000 + (MAQ.nTex = (MAQ.nTex || 0) + 1), mat: null }; MAQ.tapas.set(j.id, t); }
  // (cuadrada de 256: en WebGL 1 una de 256 × 192 con mipmaps no se completa y sale negra)
  const gl = R.gl, tx = gl.createTexture(), cv = document.createElement('canvas'); cv.width = cv.height = 256; cv.getContext('2d').drawImage(maqTapaCanvas(j), 0, 0, 256, 256);
  gl.bindTexture(gl.TEXTURE_2D, tx); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, cv); gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false); gl.generateMipmap(gl.TEXTURE_2D);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  R.tex[t.k] = { gl: tx };
  if (t.mat === null) { t.mat = matPropio('maqTapa' + t.k, [1, 1, 1], { pbr: [0.3, 0, 0.04], em: [0.15, 0.15, 0.15] }); const m = R.mats[t.mat]; m.tex = t.k; m.unlit = true; m.claveBase = ',,UNLIT,'; m.claveGam = ',,UNLIT'; }
  return t.mat;
}
// la pantalla de cada gabinete con juego: un cartel sobre el vidrio (inclinado como él: 24° hacia atrás)
const MAQ_PANT = { c: [0, 1.205, 0.034], tam: [0.46, 0.33, 0.004], q: Quat.axis(1, 0, 0, -0.415) };
function maqDibujar() {
  for (const o of OBJS) {
    if (o.nombre !== 'Arcade' || !o.maq || !R.gl) continue;
    const j = MAQ_INCLUIDOS.find((x) => x.id === o.maq.g) || { id: o.maq.g, nombre: o.maq.n, autor: '' };
    const b = o.b, p = vadd(b.pos, b.q.rot(vsub(v3(MAQ_PANT.c[0], MAQ_PANT.c[1], MAQ_PANT.c[2]), o.c)));
    if (p.distTo(CAM.pos) > 40) continue;
    dibujarCaja(p, MAQ_PANT.tam, b.q.clone().mul(MAQ_PANT.q), maqTapaMat(j));   // (mul cambia el que lo llama: una copia)
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
    <div class="mqImp"><label class="boton">${glifo('subir')} <span class="mqTImp"></span><input type="file" accept=".html,.htm,text/html" hidden></label>
      <input class="mqUrl" maxlength="400" spellcheck="false" placeholder="https://..."><button class="boton chico" data-mq="url">${glifo('adelante')}</button>
      <select class="mqCtrl"></select></div><div class="mqNota"></div></div>`;
  document.body.appendChild(p);
  p.addEventListener('click', (e) => { const b = e.target.closest('[data-mq]'); if (b) maqAccion(b.dataset.mq); });
  p.querySelector('input[type=file]').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    if (f.size > 3e6) { aviso(T('maq.grande'), 3); return; }
    const j = await maqImportarTexto(f.name, await f.text(), p.querySelector('.mqCtrl').value); if (j) { MAQ.tab = 'mios'; maqPanelDibujar(); aviso(j.nombre, 2); }
  });
  p.querySelector('.mqUrl').addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') maqAccion('url'); });
  return p;
}
function maqPanelAbrir() { const p = maqPanel(); p.classList.remove('oc'); UI.abierto = 'maq'; soltarPuntero(); maqPanelDibujar(); }
function maqPanelCerrar() { const p = $('maqPan'); if (p) p.classList.add('oc'); if (UI.abierto === 'maq') UI.abierto = null; }
async function maqPanelDibujar() {
  const p = maqPanel(), n = (MAQ.dib = (MAQ.dib || 0) + 1);
  p.querySelector('.mqTit').textContent = T('maq.lib'); p.querySelector('.mqTImp').textContent = T('maq.importar');
  const sel = p.querySelector('.mqCtrl'); if (!sel.options.length) for (const k of Object.keys(MAQ_CTRL)) sel.add(new Option(T('maq.c_' + k), k));
  p.querySelector('.mqTabs').innerHTML = ['inc', 'mios', 'sala', 'com'].map((k) => `<button class="${MAQ.tab === k ? 'sel' : ''}" data-mq="tab:${k}">${esc(T('maq.t_' + k))}</button>`).join('');
  let L = [];
  if (MAQ.tab === 'inc') L = MAQ_INCLUIDOS;
  else if (MAQ.tab === 'mios') L = (await maqMios()).sort((a, b) => (b.fecha || 0) - (a.fecha || 0));
  else if (MAQ.tab === 'sala') L = [...MAQ.sala.values()].concat(OBJS.filter((o) => o.maq && !MAQ.sala.has(o.maq.g) && !o.maq.g.startsWith('rb:')).map((o) => ({ id: o.maq.g, nombre: o.maq.n, autor: '', falta: true })));
  else if (MAQ.tab === 'com') L = await maqComunidad();
  if (n !== MAQ.dib) return;
  const mio = MAQ.tab === 'mios';
  p.querySelector('.mqLista').innerHTML = L.length ? L.map((j) => `<div class="mqIt" data-id="${esc(j.id)}"><img src="${j.foto || maqTapaCanvas(j).toDataURL('image/jpeg', 0.8)}"><div class="mqNom"><b dir="auto">${esc(j.nombre)}</b><span dir="auto">${esc(j.autor || '')}</span></div>
    <button class="boton" data-mq="jugar:${esc(j.id)}">${glifo('jugar')} ${esc(T('maq.jugar'))}</button>${mio ? `<button class="boton chico" data-mq="pub:${esc(j.id)}" title="${esc(T('maq.publicar'))}">${glifo('subir')}</button><button class="boton chico" data-mq="borrar:${esc(j.id)}" title="${esc(T('maq.borrar'))}">${glifo('basura')}</button>` : ''}</div>`).join('')
    : `<div class="spVacio">${esc(T(MAQ.tab === 'com' && MAQ.comErr ? 'maq.noTienda' : 'maq.vacia'))}</div>`;
}
async function maqAccion(a) {
  if (a === 'cerrar') { maqPanelCerrar(); return; }
  if (a.startsWith('tab:')) { MAQ.tab = a.slice(4); maqPanelDibujar(); return; }
  if (a === 'url') { const p = maqPanel(), u = p.querySelector('.mqUrl').value.trim(); const j = await maqImportarUrl(u, p.querySelector('.mqCtrl').value); if (j) { p.querySelector('.mqUrl').value = ''; MAQ.tab = 'mios'; maqPanelDibujar(); } else aviso(T('maq.urlMal'), 3); return; }
  if (a.startsWith('jugar:')) { const id = a.slice(6), j = MAQ.tab === 'com' ? await maqDeTienda(id) : await maqBuscar(id); if (j) maqElegir(j); else maqJugarId(id, null); return; }
  if (a.startsWith('borrar:')) { await maqBorrarMio(a.slice(7)); maqPanelDibujar(); return; }
  if (a.startsWith('pub:')) { const j = await maqBuscar(a.slice(4)); if (j) maqPublicar(j); }
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
  if (!j) { aviso(T('maq.noHay'), 3); MAQ.tab = 'inc'; maqPanelAbrir(); return; }
  maqVistaAbrir(j);
}

// ---------------- jugar: el juego en el medio, el mundo atrás y los controles de la maquinita ----------------
function maqVista() {
  let v = $('maqVista'); if (v) return v;
  v = document.createElement('div'); v.id = 'maqVista'; v.className = 'oc';
  const bt = (k, t, cl) => `<button class="mqB ${cl || ''}" data-b="${k}">${t}</button>`;
  v.innerHTML = `<div class="mqMarco"><div class="mqBarra"><span class="mqJN" dir="auto"></span><select class="mqCtrlV"></select><button class="mqSalir" data-mqv="lib">${glifo('caja')}</button><button class="mqSalir" data-mqv="salir">${glifo('no')}</button></div><div class="mqHueco"></div></div>
    <div class="mqIzq"><div class="mqPalanca"><div class="mqBola"></div></div><div class="mqCruz">${bt('arr', glifo('subir'), 'cA')}${bt('izq', glifo('atras'), 'cI')}${bt('der', glifo('adelante'), 'cD')}${bt('aba', glifo('bajar'), 'cB')}</div></div>
    <div class="mqDer">${bt('Y', 'Y', 'bY')}${bt('X', 'X', 'bX')}${bt('B', 'B', 'bB')}${bt('A', 'A', 'bA')}</div>
    <div class="mqMed">${bt('select', 'SELECT', 'chico')}${bt('start', 'START', 'chico')}</div>`;
  document.body.appendChild(v);
  v.querySelector('[data-mqv=salir]').addEventListener('click', maqVistaCerrar);
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
  addEventListener('message', (e) => { if (MAQ.ifr && e.source === MAQ.ifr.contentWindow && e.data && typeof e.data.rbMaqOk === 'string') { MAQ.eco.push(e.data.rbMaqOk); if (MAQ.eco.length > 50) MAQ.eco.shift(); } });
  return v;
}
function maqVistaAbrir(j) {
  const v = maqVista(); maqVistaQuitarJuego();
  MAQ.j = j; MAQ.ctrl = MAQ_CTRL[j.ctrl] !== undefined ? j.ctrl : 'flechas'; MAQ.eco.length = 0;
  v.querySelector('.mqJN').textContent = j.nombre; v.querySelector('.mqCtrlV').value = MAQ.ctrl; v.classList.toggle('mqSinCtrl', !MAQ_CTRL[MAQ.ctrl]);
  const f = document.createElement('iframe'); f.className = 'mqJuego'; f.setAttribute('allow', 'autoplay; fullscreen; gamepad');
  // (aislado: sin "allow-same-origin" no lee el almacenamiento ni la página del juego; una dirección de otro sitio sí
  // puede tener su propio origen, porque no es el nuestro)
  const ajeno = j.url && (() => { try { return new URL(j.url).origin !== location.origin; } catch (e) { return false; } })();
  f.setAttribute('sandbox', 'allow-scripts allow-pointer-lock' + (ajeno ? ' allow-same-origin' : ''));
  if (j.url) f.src = j.url; else f.srcdoc = maqConPuente(j.html);
  v.querySelector('.mqHueco').appendChild(f); MAQ.ifr = f;
  v.classList.remove('oc'); document.body.classList.add('maqOn'); UI.abierto = 'maqv'; soltarPuntero();
  f.addEventListener('load', () => { try { f.contentWindow.focus(); } catch (e) {} f.focus(); });
  if (typeof sonar === 'function') sonar('Click', null, 0.5);
}
function maqVistaQuitarJuego() { maqSoltarTodo(); if (MAQ.ifr) { MAQ.ifr.remove(); MAQ.ifr = null; } }
function maqVistaCerrar() {
  maqVistaQuitarJuego(); const v = $('maqVista'); if (v) v.classList.add('oc');
  document.body.classList.remove('maqOn'); if (UI.abierto === 'maqv') UI.abierto = null; MAQ.j = null;
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
  const txt = JSON.stringify({ n: j.nombre, a: j.autor || '', c: j.ctrl, h: j.html || '', u: j.url || '' });
  let d = null, z = 0;
  if (typeof CompressionStream === 'function') { try { const b = new Uint8Array(await new Response(new Blob([txt]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()); let s = ''; for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); d = btoa(s); z = 1; } catch (e) {} }
  if (!d) d = txt;
  const P = []; for (let i = 0; i < d.length; i += 24000) P.push(d.slice(i, i + 24000));
  return { P, z };
}
async function maqMandar(j, para) {
  if (!RED.on || MAQ.mandando === j.id) return; MAQ.mandando = j.id;
  const { P, z } = await maqPedazos(j);
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
    const j = MAQ.sala.get(d.g) || (await maqMios()).find((x) => x.id === d.g); if (!j) return;
    if (!d.a || d.a !== RED.ID) await new Promise((ok) => setTimeout(ok, Math.random() * 1500));
    if (MAQ.partes.has(d.g) && MAQ.partes.get(d.g).ajeno) return;   // (ya lo está mandando otro)
    maqMandar(j, d.i); return;
  }
  if (d.k === 'maqd' && typeof d.g === 'string' && typeof d.d === 'string') {
    const n = d.n | 0, i = d.x | 0; if (n < 1 || n > 200 || i < 0 || i >= n) return;
    let e = MAQ.partes.get(d.g); if (!e || e.n !== n) { e = { n, z: d.z ? 1 : 0, p: new Array(n), llegaron: 0, ajeno: d.i !== RED.ID }; MAQ.partes.set(d.g, e); }
    if (e.p[i] === undefined) { e.p[i] = d.d; e.llegaron++; }
    if (e.llegaron < n) return;
    MAQ.partes.delete(d.g);
    let txt = e.p.join('');
    try {
      if (e.z) { const s = atob(txt), b = new Uint8Array(s.length); for (let k = 0; k < s.length; k++) b[k] = s.charCodeAt(k); txt = new TextDecoder().decode(await desgz(b)); }
      const x = JSON.parse(txt); if (!x || typeof x.n !== 'string') return;
      const j = { id: d.g, nombre: x.n.slice(0, 40), autor: String(x.a || '').slice(0, 24), ctrl: MAQ_CTRL[x.c] !== undefined ? x.c : 'flechas' };
      if (typeof x.u === 'string' && /^https:\/\//.test(x.u)) j.url = x.u; else j.html = String(x.h || '');
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
    const j = { id: 't:' + id, nombre: v.nombre, autor: v.autor, ctrl: v.ctrl, html: v.html }; MAQ.sala.set(j.id, j); return j;
  } catch (e) { return null; }
}
async function maqPublicar(j) {
  if (!j.html) { aviso(T('maq.noTienda'), 3); return; }
  const foto = maqTapaCanvas(j).toDataURL('image/jpeg', 0.75);
  try {
    const r = await (await fetch(TIENDA_URL + 'publicar', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ formato: 'rezobox-juego', nombre: j.nombre, autor: PREFS.nombre || 'Anónimo', descripcion: '', etiquetas: ['diversion'], foto, ctrl: j.ctrl, html: j.html }) })).json();
    if (r && r.id) aviso(T('maq.publicado'), 3); else aviso(T('maq.noTienda') + (r && r.error ? ' (' + r.error + ')' : ''), 4);
  } catch (e) { aviso(T('maq.noTienda'), 3); }
}
