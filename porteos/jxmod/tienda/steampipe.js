// ---------------- SteamPipe para la tienda: los addons del Workshop que Steam no da como archivo directo ----------------
// Más o menos la mitad de los addons de GMod no tienen file_url: están en el CDN de Steam (SteamPipe), cifrados y en
// pedazos. Para bajarlos hacen falta dos cosas que sólo da un cliente de Steam conectado: la clave del depósito (4000, el
// de los addons de GMod) y el código del manifiesto. El worker entra anónimo (como un servidor dedicado de GMod, sin
// cuenta ni contraseña) por el WebSocket de Steam, pide las dos cosas y se va. Lo pesado (bajar los pedazos, descifrarlos
// y descomprimirlos) lo hace el juego en el aparato de cada uno; el worker sólo les pone el permiso para que una página
// los pueda pedir (el CDN de Steam no lo trae), y sólo de los servidores de contenido de Steam.

// ---- protobuf mínimo (lo justo para estos mensajes) ----
function pbVar(o, n) { n = BigInt.asUintN(64, BigInt(n)); while (n >= 0x80n) { o.push(Number(n & 0x7fn) | 0x80); n >>= 7n; } o.push(Number(n)); }
export function pbCodificar(campos) {
  const o = [];
  for (const [f, t, v] of campos) {
    if (v === undefined || v === null) continue;
    if (t === 'v') { pbVar(o, f << 3); pbVar(o, v); }
    else if (t === 'f64') { pbVar(o, (f << 3) | 1); let n = BigInt.asUintN(64, BigInt(v)); for (let i = 0; i < 8; i++) { o.push(Number(n & 0xffn)); n >>= 8n; } }
    else { const b = t === 's' ? new TextEncoder().encode(String(v)) : v; pbVar(o, (f << 3) | 2); pbVar(o, b.length); for (let i = 0; i < b.length; i++) o.push(b[i]); }
  }
  return new Uint8Array(o);
}
// campo → lista de valores (varint y fixed64 como BigInt, fixed32 como número, el resto como bytes)
export function pbLeer(b) {
  const m = new Map(); let i = 0;
  const vi = () => { let r = 0n, s = 0n; for (;;) { if (i >= b.length) throw new Error('pb corto'); const x = b[i++]; r |= BigInt(x & 0x7f) << s; if (!(x & 0x80)) return r; s += 7n; } };
  while (i < b.length) {
    const k = Number(vi()), f = k >>> 3, t = k & 7; let v;
    if (t === 0) v = vi();
    else if (t === 1) { v = 0n; for (let j = 7; j >= 0; j--) v = (v << 8n) | BigInt(b[i + j]); i += 8; }
    else if (t === 2) { const n = Number(vi()); v = b.subarray(i, i + n); i += n; }
    else if (t === 5) { v = (b[i] | (b[i + 1] << 8) | (b[i + 2] << 16) | (b[i + 3] << 24)) >>> 0; i += 4; }
    else throw new Error('pb tipo ' + t);
    if (!m.has(f)) m.set(f, []); m.get(f).push(v);
  }
  return m;
}
const pb1 = (m, f) => (m.has(f) ? m.get(f)[0] : undefined);
const hex = (b) => [...b].map((x) => x.toString(16).padStart(2, '0')).join('');

// ---- los mensajes del cliente de Steam (EMsg) ----
const EM = { PICSProductInfoRequest: 8903, PICSProductInfoResponse: 8904, PICSAccessTokenRequest: 8905, PICSAccessTokenResponse: 8906, Multi: 1, ServiceMethodResponse: 147, ServiceMethodCallFromClient: 151, ClientLogOff: 706, ClientLogOnResponse: 751, ClientLoggedOff: 757, ClientGetDepotDecryptionKey: 5438, ClientGetDepotDecryptionKeyResponse: 5439, ClientLogon: 5514, ClientHello: 9805 };
const PROTOCOLO = 65580, ANON = 0x01A0000000000000n;   // (cuenta anónima del universo público, como entra un servidor dedicado)
function msg(emsg, cab, cuerpo) {
  const h = pbCodificar(cab), o = new Uint8Array(8 + h.length + cuerpo.length), dv = new DataView(o.buffer);
  dv.setUint32(0, (emsg | 0x80000000) >>> 0, true); dv.setUint32(4, h.length, true); o.set(h, 8); o.set(cuerpo, 8 + h.length);
  return o;
}
async function gunzip(b) { return new Uint8Array(await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()); }

async function abrirWS(url) {
  if (typeof WebSocketPair !== 'undefined') {   // (Cloudflare Workers: el WebSocket de salida se abre con fetch)
    const r = await fetch(url.replace(/^wss:/, 'https:'), { headers: { Upgrade: 'websocket' } });
    const ws = r.webSocket; if (!ws) throw new Error('Steam no abrió el WebSocket (' + r.status + ')');
    ws.accept(); return ws;
  }
  const ws = new WebSocket(url); ws.binaryType = 'arraybuffer';
  await new Promise((ok, mal) => { ws.addEventListener('open', ok, { once: true }); ws.addEventListener('error', () => mal(new Error('Steam no conecta')), { once: true }); });
  return ws;
}

class Sesion {
  constructor(ws) {
    this.ws = ws; this.sid = ANON; this.ses = 0; this.job = 1n; this.esperan = new Map(); this.porEMsg = new Map(); this.vivo = true;
    ws.addEventListener('message', (e) => { this.recibir(new Uint8Array(e.data)).catch(() => {}); });
    ws.addEventListener('close', () => { this.vivo = false; for (const f of [...this.esperan.values(), ...this.porEMsg.values()]) f(null); this.esperan.clear(); this.porEMsg.clear(); });
  }
  async recibir(b) {
    if (b.length < 8) return;
    const dv = new DataView(b.buffer, b.byteOffset, b.byteLength), cr = dv.getUint32(0, true), emsg = cr & 0x7fffffff;
    if (!(cr & 0x80000000)) return;
    const hl = dv.getUint32(4, true), h = pbLeer(b.subarray(8, 8 + hl)), cuerpo = b.subarray(8 + hl);
    if (emsg === EM.Multi) {
      const m = pbLeer(cuerpo); let d = pb1(m, 2) || new Uint8Array(0); if (Number(pb1(m, 1) || 0n) > 0) d = await gunzip(d);
      for (let i = 0; i + 4 <= d.length;) { const n = (d[i] | (d[i + 1] << 8) | (d[i + 2] << 16) | (d[i + 3] << 24)) >>> 0; await this.recibir(d.subarray(i + 4, i + 4 + n)); i += 4 + n; }
      return;
    }
    const r = { emsg, h, cuerpo: pbLeer(cuerpo) }, jt = pb1(h, 11);
    if (jt !== undefined && this.esperan.has(jt)) { const f = this.esperan.get(jt); this.esperan.delete(jt); f(r); return; }
    const g = this.porEMsg.get(emsg); if (g) { this.porEMsg.delete(emsg); g(r); }
  }
  enviar(emsg, cuerpo, extra) { this.ws.send(msg(emsg, [[1, 'f64', this.sid], [2, 'v', this.ses], ...(extra || [])], cuerpo)); }
  esperar(emsg, ms) {
    return new Promise((ok, mal) => {
      const t = setTimeout(() => { this.porEMsg.delete(emsg); mal(new Error('Steam no contestó')); }, ms);
      this.porEMsg.set(emsg, (r) => { clearTimeout(t); r ? ok(r) : mal(new Error('Steam cortó')); });
    });
  }
  pedir(emsg, cuerpo, nombre, ms = 12000) {
    const j = this.job++;
    return new Promise((ok, mal) => {
      const t = setTimeout(() => { this.esperan.delete(j); mal(new Error('Steam no contestó')); }, ms);
      this.esperan.set(j, (r) => { clearTimeout(t); r ? ok(r) : mal(new Error('Steam cortó')); });
      this.enviar(emsg, cuerpo, [[10, 'f64', j], ...(nombre ? [[12, 's', nombre]] : [])]);
    });
  }
  async entrar() {
    this.ws.send(msg(EM.ClientHello, [[1, 'f64', 0n], [2, 'v', 0]], pbCodificar([[1, 'v', PROTOCOLO]])));
    const esp = this.esperar(EM.ClientLogOnResponse, 15000);
    this.enviar(EM.ClientLogon, pbCodificar([[1, 'v', PROTOCOLO], [3, 'v', 0], [5, 'v', 1771], [6, 's', 'english'], [7, 'v', 16]]));
    const r = await esp, er = Number(pb1(r.cuerpo, 1) || 0n);
    if (er !== 1) throw new Error('Steam no dejó entrar (EResult ' + er + ')');
    this.sid = pb1(r.h, 1) || this.sid; this.ses = Number(BigInt.asIntN(32, pb1(r.h, 2) || 0n));
  }
  async claveDeposito(app, dep) {
    const r = await this.pedir(EM.ClientGetDepotDecryptionKey, pbCodificar([[1, 'v', dep], [2, 'v', app]]));
    const er = Number(pb1(r.cuerpo, 1) ?? 2n), k = pb1(r.cuerpo, 3);
    if (er !== 1 || !k || k.length !== 32) throw new Error('Steam no dio la clave del depósito (EResult ' + er + ')');
    return new Uint8Array(k);
  }
  async codigoManifiesto(app, dep, man) {
    try {
      const r = await this.pedir(EM.ServiceMethodCallFromClient, pbCodificar([[1, 'v', app], [2, 'v', dep], [3, 'v', BigInt(man)], [4, 's', 'public']]), 'ContentServerDirectory.GetManifestRequestCode#1');
      const er = Number(pb1(r.h, 13) ?? 1n); if (er !== 1) return 0n;
      return pb1(r.cuerpo, 1) || 0n;
    } catch (e) { return 0n; }
  }
  // la información pública de una app (sus depósitos y el manifiesto de cada uno en la rama pública), como app_info_print
  async appInfo(app) {
    const t = await this.pedir(EM.PICSAccessTokenRequest, pbCodificar([[2, 'v', app]]));
    let tok = 0n; for (const x of t.cuerpo.get(3) || []) { const m = pbLeer(x); if (Number(pb1(m, 1) || 0n) === app) tok = pb1(m, 2) || 0n; }
    const r = await this.pedir(EM.PICSProductInfoRequest, pbCodificar([[2, 'b', pbCodificar([[1, 'v', app], [2, 'v', tok]])]]), null, 20000);
    const a = (r.cuerpo.get(1) || []).map(pbLeer).find((m) => Number(pb1(m, 1) || 0n) === app); if (!a) throw new Error('Steam no dio la app ' + app);
    let buf = pb1(a, 5);
    if (!buf || !buf.length) {   // (las grandes vienen por HTTP)
      const host = pb1(r.cuerpo, 8), sha = pb1(a, 4); if (!host || !sha) throw new Error('sin appinfo');
      const g = await fetch('https://' + new TextDecoder().decode(host) + '/appinfo/' + app + '/sha/' + hex(sha) + '.txt.gz'); buf = await gunzip(new Uint8Array(await g.arrayBuffer()));
    }
    return vdfLeer(new TextDecoder().decode(buf).replace(/\0+$/, ''));
  }
  salir() { try { if (this.vivo) this.enviar(EM.ClientLogOff, new Uint8Array(0)); } catch (e) {} try { this.ws.close(1000, 'listo'); } catch (e) {} }
}

// KeyValues de texto de Valve ("clave" "valor" y "clave" { ... }) → objeto
export function vdfLeer(t) {
  let i = 0; const L = t.length;
  const esp = () => { for (;;) { while (i < L && /\s/.test(t[i])) i++; if (t[i] === '/' && t[i + 1] === '/') { while (i < L && t[i] !== '\n') i++; continue; } return; } };
  const tok = () => { esp(); if (t[i] === '"') { let o = ''; i++; while (i < L && t[i] !== '"') { if (t[i] === '\\' && i + 1 < L) { i++; o += t[i] === 'n' ? '\n' : t[i]; } else o += t[i]; i++; } i++; return o; } let o = ''; while (i < L && !/[\s{}"]/.test(t[i])) o += t[i++]; return o; };
  const bloque = () => { const o = {}; for (;;) { esp(); if (i >= L || t[i] === '}') { i++; return o; } const k = tok(); esp(); if (t[i] === '{') { i++; o[k] = bloque(); } else o[k] = tok(); } };
  return bloque();
}
// los servidores de conexión de Steam por WebSocket (puerto 443) y los del CDN, una hora en memoria
let _cms = null, _cmsT = 0, _cdn = null, _cdnT = 0;
// (Steam ahora reparte servidores de WebSocket también en el puerto 27018: en algunas zonas venían sólo así y, como se
// aceptaba sólo el 443, la lista quedaba vacía: "Steam no dio servidores". Los mismos servidores atienden en el 443, así
// que se usa el nombre con el 443. Si la lista no viene, se usa la última buena o una de respaldo)
const CM_HOST = /^([a-z0-9-]+(?:\.[a-z0-9-]+)*\.steamserver\.net):(\d{2,5})$/;
const CM_RESPALDO = ['cmp1-lax1', 'cmp2-lax1', 'cmp1-sea1', 'cmp2-sea1', 'cmp1-dfw2', 'cmp2-dfw2'].map((h) => h + '.steamserver.net:443');
async function servidoresCM() {
  if (_cms && Date.now() - _cmsT < 3600e3) return _cms;
  const l = [];
  for (const u of ['https://api.steampowered.com/ISteamDirectory/GetCMListForConnect/v1/?cellid=0&cmtype=websockets&maxcount=60', 'https://api.steampowered.com/ISteamDirectory/GetCMList/v1/?cellid=0']) {
    try {
      const r = (await (await fetch(u)).json()).response || {};
      const eps = (r.serverlist || []).filter((x) => x && typeof x === 'object' && x.type === 'websockets').sort((a, b) => (a.wtd_load || 0) - (b.wtd_load || 0)).map((x) => x.endpoint).concat(r.serverlist_websockets || []);
      for (const e of eps) { const m = CM_HOST.exec(String(e)); if (m) l.push(m[1] + ':443'); }
    } catch (e) {}
    if (l.length) break;
  }
  const u = [...new Set(l)];
  _cms = u.length ? u : _cms || CM_RESPALDO; _cmsT = u.length ? Date.now() : Date.now() - 3300e3;   // (sin lista: se reintenta en 5 min)
  return _cms;
}
export const CDN_HOST = /^[a-z0-9-]+(\.[a-z0-9-]+)*\.steamcontent\.com$/;
export async function servidoresCDN() {
  if (_cdn && Date.now() - _cdnT < 3600e3) return _cdn;
  let d = {}; try { d = await (await fetch('https://api.steampowered.com/IContentServerDirectoryService/GetServersForSteamPipe/v1/?cell_id=0&max_servers=30')).json(); } catch (e) {}
  const l = ((d.response && d.response.servers) || []).filter((x) => x.https_support !== 'unavailable' && CDN_HOST.test(x.vhost || '')).sort((a, b) => (a.weighted_load || 0) - (b.weighted_load || 0)).map((x) => x.vhost);
  const u = [...new Set(l)].slice(0, 8);
  // (sin lista: la última buena o unos de respaldo, y se vuelve a pedir en 5 min)
  _cdn = u.length ? u : _cdn || ['cache1-lax1', 'cache2-lax1', 'cache5-lax1', 'cache2-sea1', 'cache3-sea1', 'cache5-sea1'].map((h) => h + '.steamcontent.com'); _cdnT = u.length ? Date.now() : Date.now() - 3300e3; return _cdn;
}

// la clave del depósito y el código del manifiesto de un addon (entra anónimo, pide y se va; reintenta en otro servidor)
let _claves = new Map();
export async function steampipeAcceso(app, dep, man) {
  const cms = await servidoresCM(); let ult = null;
  for (let i = 0; i < Math.min(3, cms.length); i++) {
    const cm = cms[(i + Math.floor(Math.random() * Math.min(4, cms.length))) % cms.length]; let s = null;
    try {
      s = new Sesion(await abrirWS('wss://' + cm + '/cmsocket/'));
      await s.entrar();
      const ck = app + ':' + dep, k = _claves.get(ck) || (await s.claveDeposito(app, dep)); _claves.set(ck, k);
      const codigo = await s.codigoManifiesto(app, dep, man);
      return { clave: hex(k), codigo: codigo.toString() };
    } catch (e) { ult = e; } finally { if (s) s.salir(); }
  }
  throw ult || new Error('Steam no responde');
}

// el contenido base de un depósito de un servidor dedicado (p. ej. 4020/4021: el de GMod, con HL2, sus episodios y CS:S):
// el manifiesto de la rama pública (de la información de la app, una hora en memoria), la clave y el código
let _baseMan = new Map();
export async function steampipeDeposito(app, dep) {
  const cms = await servidoresCM(); let ult = null;
  for (let i = 0; i < Math.min(3, cms.length); i++) {
    let s = null;
    try {
      s = new Sesion(await abrirWS('wss://' + cms[i] + '/cmsocket/')); await s.entrar();
      let man = _baseMan.get(app + ':' + dep);
      if (!man || Date.now() - man.t > 3600e3) {
        const a = await s.appInfo(app), d = ((a.appinfo || a).depots || {})[dep], m = d && d.manifests && d.manifests.public;
        const gid = m && (typeof m === 'string' ? m : m.gid); if (!/^\d{5,20}$/.test(gid || '')) throw new Error('sin manifiesto para ' + dep);
        man = { gid, t: Date.now() }; _baseMan.set(app + ':' + dep, man);
      }
      const ck = app + ':' + dep, k = _claves.get(ck) || (await s.claveDeposito(app, dep)); _claves.set(ck, k);
      const codigo = await s.codigoManifiesto(app, dep, man.gid);
      return { app, dep, man: man.gid, clave: hex(k), codigo: codigo.toString() };
    } catch (e) { ult = e; } finally { if (s) s.salir(); }
  }
  throw ult || new Error('Steam no responde');
}
// (para pruebas y herramientas: abre una sesión anónima, corre f(sesión) y la cierra)
export async function steampipePrueba(f) {
  const cms = await servidoresCM(); let s = null;
  try { s = new Sesion(await abrirWS('wss://' + cms[0] + '/cmsocket/')); await s.entrar(); return await f(s); } finally { if (s) s.salir(); }
}
