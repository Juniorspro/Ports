// ---------------- API de mods con código ----------------
// Cada mod (o mapa) con "codigo" corre en un cuadro aislado (sandbox="allow-scripts", sin el mismo origen): no ve la página,
// ni lo guardado, ni las claves; habla con el juego sólo por mensajes. Del lado del mod queda el objeto global "rb":
//   rb.on('inicio' | 'tick' | 'boton' | 'tecla' | 'muerte' | 'fin', fn)   rb.estado (jugador y mundo, se actualiza solo)
//   rb.aviso(texto, seg)  rb.boton(id, texto)  rb.quitarBoton(id)  rb.jugador({ vel_max, salto, vida, pos, vel, yaw, tercera })
//   rb.mundo({ gravedad, hora, ciclo })  await rb.crear(nombre, [x,y,z], { yaw, congelado })  rb.borrar(id)  rb.mover(id, { pos, vel, congelado })
//   await rb.objetos()  rb.explosion([x,y,z], radio, daño)  rb.arma(nombre)  rb.sonido(nombre, [x,y,z], vol)  rb.nota(hz, seg, [x,y,z], vol, tipo)
//   await rb.rayo([x,y,z], [dx,dy,dz], max)  await rb.catalogo()  await rb.guardar(clave, valor)  await rb.leer(clave)
//   await rb.entidad(tipo, [x,y,z], { parámetros }, yaw)  rb.quitarEntidad(id)  rb.nativo('volar' | 'ragdoll' | 'scp', sí/no)
const MODAPI = { mods: [], botones: new Map(), tTick: 0, errores: 0 };
// (si un mod manda algo que no se puede copiar, p. ej. una promesa sin await, se avisa como error del mod)
const MODAPI_RB = `(function(){var L={},sig=0,esp={};function man(m){try{parent.postMessage(m,'*')}catch(x){parent.postMessage({rbmod:1,k:'error',d:m.k+': '+String(x&&x.message||x)},'*')}}
function env(k,d){man({rbmod:1,k:k,d:d})}
function ped(k,d){return new Promise(function(r){var id=++sig;esp[id]=r;man({rbmod:1,k:k,d:d,id:id})})}
var rb=self.rb={estado:{},on:function(e,f){(L[e]=L[e]||[]).push(f)},aviso:function(t,s){env('aviso',{t:String(t),s:s})},
boton:function(id,t){env('boton',{id:String(id),t:String(t)})},quitarBoton:function(id){env('quitarBoton',{id:String(id)})},
jugador:function(c){env('jugador',c)},mundo:function(c){env('mundo',c)},crear:function(n,p,o){return ped('crear',{n:n,p:p,o:o||{}})},
borrar:function(id){env('borrar',{id:id})},mover:function(id,c){env('mover',{id:id,c:c})},objetos:function(){return ped('objetos',{})},
explosion:function(p,r,d){env('explosion',{p:p,r:r,d:d})},arma:function(n){env('arma',{n:n})},sonido:function(n,p,v){env('sonido',{n:n,p:p,v:v})},
nota:function(hz,s,p,v,t){env('nota',{hz:hz,s:s,p:p,v:v,t:t})},rayo:function(o,d,m){return ped('rayo',{o:o,d:d,m:m})},
catalogo:function(){return ped('catalogo',{})},entidad:function(t,p,prm,y){return ped('entidad',{t:t,p:p,prm:prm||{},yaw:y||0})},
quitarEntidad:function(id){env('quitarEntidad',{id:id})},nativo:function(n,s){env('nativo',{n:n,s:s!==false})},guardar:function(k,v){return ped('guardar',{k:String(k),v:v})},leer:function(k){return ped('leer',{k:String(k)})}};
addEventListener('message',function(e){var m=e.data;if(!m||!m.rbhost)return;if(m.id){var r=esp[m.id];if(r){delete esp[m.id];r(m.d)}return}
if(m.k==='estado'){rb.estado=m.d;return}(L[m.k]||[]).forEach(function(f){try{f(m.d)}catch(x){env('error',String(x&&x.message||x))}})});
onerror=function(msg){env('error',String(msg))};})();`;
const modNum = (v, def) => (Number.isFinite(+v) ? +v : def);
const modVec = (v) => (Array.isArray(v) && v.length === 3 && v.every((x) => Number.isFinite(+x)) ? v3(+v[0], +v[1], +v[2]) : null);

function modapiCargar(lista) {
  modapiDescargar();
  for (const m of lista) {
    if (!m.codigo) continue;
    const ifr = document.createElement('iframe');
    ifr.setAttribute('sandbox', 'allow-scripts'); ifr.style.display = 'none'; ifr.title = 'mod';
    ifr.srcdoc = '<!doctype html><meta charset="utf-8"><script>' + MODAPI_RB + '<\/script><script>' + m.codigo.replace(/<\/script/gi, '<\\/script') + '\n<\/script>';
    const M = { id: m.id, nombre: m.nombre, ifr, objs: new Set(), listo: false };
    ifr.onload = () => { M.listo = true; modapiA(M, 'estado', modapiEstado()); modapiA(M, 'inicio', { mapa: MUNDO.nombre, rol: JUG.rol || null }); };
    document.body.appendChild(ifr); MODAPI.mods.push(M);
  }
}
function modapiDescargar() {
  for (const M of MODAPI.mods) { modapiA(M, 'fin', {}); setTimeout(() => M.ifr.remove(), 50); }
  MODAPI.mods.length = 0;
  MODAPI.botones.clear(); if (typeof modMenuBoton === 'function') modMenuBoton();
}
function modapiA(M, k, d, id) { try { M.ifr.contentWindow.postMessage({ rbhost: 1, k, d, id }, '*'); } catch (e) {} }
function modapiEvento(k, d) { for (const M of MODAPI.mods) if (M.listo) modapiA(M, k, d); }
function modapiEstado() {
  return { jugador: { pos: [JUG.pos.x, JUG.pos.y, JUG.pos.z], vel: [JUG.vel.x, JUG.vel.y, JUG.vel.z], yaw: JUG.yaw, pitch: JUG.pitch, vida: JUG.vida, vivo: JUG.vivo,
    suelo: JUG.suelo, vehiculo: !!JUG.vehiculo, nombre: PREFS.nombre, rol: JUG.rol || null }, mundo: { nombre: MUNDO.nombre, gravedad: MUNDO.gravedad, hora: DIA.hora }, t: TIEMPO.t };
}
function modapiPaso(dt) {
  if (!MODAPI.mods.length || JUEGO.estado !== 'juego') return;
  MODAPI.tTick += dt; if (MODAPI.tTick < 1 / 15) return;
  const e = modapiEstado(), d = MODAPI.tTick; MODAPI.tTick = 0;
  for (const M of MODAPI.mods) if (M.listo) { modapiA(M, 'estado', e); modapiA(M, 'tick', { dt: d, t: e.t }); }
}
// los botones de un mod van al menú MOD de arriba (texto o "ico:nombre")
function modapiBoton(M, id, texto) {
  const k = M.id + ':' + id; let b = MODAPI.botones.get(k);
  if (!b) { b = { M, id }; MODAPI.botones.set(k, b); }
  b.t = String(texto).slice(0, 24); modMenuBoton();
}
addEventListener('message', (e) => {
  const m = e.data; if (!m || !m.rbmod) return;
  const M = MODAPI.mods.find((x) => x.ifr.contentWindow === e.source); if (!M) return;
  const d = m.d || {}, resp = (v) => modapiA(M, null, v, m.id);
  try {
    switch (m.k) {
      case 'aviso': aviso(String(d.t).slice(0, 200), Math.min(10, modNum(d.s, 2.5))); break;
      case 'boton': modapiBoton(M, String(d.id).slice(0, 24), d.t); break;
      case 'quitarBoton': { const k = M.id + ':' + String(d.id); if (MODAPI.botones.delete(k)) modMenuBoton(); break; }
      case 'jugador': {
        if (d.vel_max !== undefined) JUG.vel_max = modNum(d.vel_max, JUG.vel_max); if (d.salto !== undefined) JUG.salto = modNum(d.salto, JUG.salto);
        if (d.vida !== undefined) JUG.vida = modNum(d.vida, JUG.vida); if (d.yaw !== undefined) JUG.yaw = modNum(d.yaw, JUG.yaw);
        const p = modVec(d.pos), v = modVec(d.vel); if (p) JUG.pos.copy(p); if (v) JUG.vel.copy(v);
        if (d.tercera !== undefined) JUG.tercera = !!d.tercera; break;
      }
      case 'mundo': if (d.gravedad !== undefined) { MUNDO.gravedad = modNum(d.gravedad, 1); PH.gscale = MUNDO.gravedad; } if (d.hora !== undefined) { DIA.hora = ((modNum(d.hora, 12) % 24) + 24) % 24; DIA.aplicada = -1; } if (d.ciclo !== undefined) DIA.ciclo = !!d.ciclo; break;
      case 'crear': {
        const p = modVec(d.p); if (!p || M.objs.size >= 3000) { resp(null); break; }
        const o = crearObjeto(String(d.n), p, Quat.euler(modNum(d.o.yaw, 0), 0), { congelado: !!d.o.congelado });
        if (o) { M.objs.add(o.id); resp(o.id); } else resp(null); break;
      }
      case 'borrar': { const o = OBJS.find((x) => x.id === d.id); if (o) borrarObjeto(o); break; }
      case 'mover': { const o = OBJS.find((x) => x.id === d.id); if (!o) break; const c = d.c || {}, p = modVec(c.pos), v = modVec(c.vel);
        if (p) o.b.pos.copy(p); if (v) o.b.vel.copy(v); if (c.congelado !== undefined) o.b.frozen = !!c.congelado; o.b.wake && o.b.wake(); o.b.updateWorld && o.b.updateWorld(); break; }
      case 'objetos': resp(OBJS.slice(0, 3000).map((o) => ({ id: o.id, n: o.nombre, p: [o.b.pos.x, o.b.pos.y, o.b.pos.z], mio: M.objs.has(o.id) }))); break;
      case 'explosion': { const p = modVec(d.p); if (p) explosion(p, Math.min(200, modNum(d.r, 5)), modNum(d.d, 50)); break; }
      case 'arma': if (typeof darArma === 'function') darArma(String(d.n)); break;
      case 'sonido': sonar(String(d.n), modVec(d.p), Math.min(4, modNum(d.v, 1))); break;
      case 'nota': notaTocar(modNum(d.hz, 440), Math.min(10, modNum(d.s, 0.5)), modVec(d.p), Math.min(2, modNum(d.v, 0.6)), String(d.t || 'piano')); break;
      case 'rayo': { const o = modVec(d.o), dir = modVec(d.d); if (!o || !dir) { resp(null); break; } const h = raycast(o, dir.norm(), Math.min(2000, modNum(d.m, 100)), null);
        resp(h ? { t: h.t, p: [h.p.x, h.p.y, h.p.z], n: h.n ? [h.n.x, h.n.y, h.n.z] : null, id: h.body && h.body.obj ? h.body.obj.id : null } : null); break; }
      case 'catalogo': resp(Object.keys(DATA.pfPorNombre || {})); break;
      case 'entidad': {
        const v = validarRB({ formato: 'rezobox-mapa', nombre: 'mod', base: 'FlatGrass', entidades: [{ t: d.t, p: d.p, yaw: d.yaw, prm: d.prm }] }), x = typeof v === 'object' && v.entidades[0];
        if (!x || (M.ents = M.ents || new Set()).size >= 300) { resp(null); break; }
        const e = entidadCrear(x, { red: !!RED.on }); if (e) { e.mod = M.id; M.ents.add(e.id); entidadRed('ent', e); } resp(e ? e.id : null); break;
      }
      case 'quitarEntidad': { const e = ENTS.lista.find((x) => x.id === d.id && x.mod === M.id); if (e) { entidadQuitar(e); entidadRed('entb', e); M.ents.delete(e.id); } break; }
      case 'nativo': { const n = String(d.n); if (n === 'volar') natVolar(!!d.s); else if (n === 'ragdoll') natRag(!!d.s); else if (n === 'scp') natScp(!!d.s); break; }
      case 'guardar': { const v = JSON.stringify(d.v); if (v && v.length < 200000) try { localStorage.setItem('rbmod_' + M.id + '_' + d.k.slice(0, 40), v); resp(true); } catch (x) { resp(false); } else resp(false); break; }
      case 'leer': { let v = null; try { v = JSON.parse(localStorage.getItem('rbmod_' + M.id + '_' + d.k.slice(0, 40)) || 'null'); } catch (x) {} resp(v); break; }
      case 'error': if (MODAPI.errores++ < 5) { console.warn('mod', M.nombre, d); aviso(M.nombre + ': ' + String(d).slice(0, 80), 3); } break;
    }
  } catch (x) { if (MODAPI.errores++ < 5) console.warn('mod', M.nombre, x); }
});
addEventListener('keydown', (e) => { if (JUEGO.estado === 'juego' && MODAPI.mods.length && !e.repeat) modapiEvento('tecla', { code: e.code }); });

// notas con un sintetizador (piano, órgano, campana), en el lugar si hay posición (espacial)
function notaTocar(hz, seg, pos, vol, tipo) {
  if (!AUD.ctx) return; const c = AUD.ctx, t = c.currentTime, g = c.createGain(), salida = AUD.master || c.destination;
  let dst = g; if (pos && c.createPanner) { const p = c.createPanner(); p.panningModel = 'HRTF'; p.distanceModel = 'inverse'; p.refDistance = 3; p.rolloffFactor = 1.1; p.positionX.value = pos.x; p.positionY.value = pos.y; p.positionZ.value = pos.z; g.connect(p); p.connect(salida); dst = null; }
  if (dst) g.connect(salida);
  const parciales = tipo === 'organo' ? [[1, 0.5], [2, 0.3], [3, 0.2], [4, 0.1]] : tipo === 'campana' ? [[1, 0.6], [2.76, 0.3], [5.4, 0.15]] : [[1, 0.6], [2, 0.25], [3, 0.12], [4.2, 0.06]];
  for (const [k, a] of parciales) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = hz * k; const ga = c.createGain(); ga.gain.value = a; o.connect(ga); ga.connect(g); o.start(t); o.stop(t + seg + 0.05); }
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol * 0.5), t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + seg);
}
