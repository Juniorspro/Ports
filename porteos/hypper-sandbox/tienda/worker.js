// Tienda de HypperX RezoBox: mods (.rbmod), mapas (.rbmapa) y animaciones (.rbanim) que publica la gente. Cloudflare Worker + D1.
// Se valida todo antes de guardar (formato.js) y el juego vuelve a validar al instalar; el código de un mod corre en el
// juego dentro de un cuadro aislado. Denuncias: con 3 se oculta solo. El autor borra con la clave que recibe al publicar.
// También busca música en YouTube para la radio del juego (/api/yt): con la API oficial si hay clave (YT_KEY), si no
// leyendo la página de resultados; las búsquedas quedan en caché una hora.
// Y emisoras de radio por internet (Radio Browser) para que la radio suene en 3D: /api/radio busca, /api/radio/u/ID da la
// dirección del audio y /api/radio/play/ID lo pasa con permiso de otro sitio (sólo emisoras de esa lista, nunca cualquier URL).
// Verity (la compañera con IA del juego): /api/verity piensa (Workers AI) y /api/verity/voz habla (MeloTTS), gratis para
// todos con un tope por persona y otro por día para no pasar la cuota gratis de la cuenta; sin cuota contesta 503 y el
// juego piensa con un modelo público (Pollinations) desde la conexión de cada jugador; la voz la pone el navegador.
// Con la clave de Gemini del dueño (secreto GEMINI_KEY) piensa y habla mejor en los servers premium y para quien tenga su
// código; con más claves gratis opcionales (Groq, Cerebras, OpenRouter, Mistral, GitHub Models) se turnan; y
// /api/verity/crear arma mods, construcciones y animaciones.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS } });
import { validarRB as validar, ETIQUETAS_RB as ETIQUETAS, MAPAS_BASE_RB, verityMensajes, verityRespuesta, VERITY_VOCES, VERITY_GEMINI, VERITY_GEMINI_VOZ, verityAGemini, verityVozGemini, verityWav, verityCrearMensajes, verityCreacion, VERITY_GEMINI_CREA, VERITY_CLAVES, verityAbierto, verityTextoAbierto } from './formato.js';
const texto = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

async function huella(s) { const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); return [...h].map((b) => b.toString(16).padStart(2, '0')).join(''); }
const azar = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');

// ---------------- búsqueda de YouTube (sólo id, título, canal y duración) ----------------
const ytLimpio = (v) => ({ id: v.id, t: texto(v.t, 120), c: texto(v.c, 60), d: texto(v.d, 12) });
async function ytApi(q, key) {
  const u = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&maxResults=15&q=${encodeURIComponent(q)}&key=${key}`;
  const d = await (await fetch(u)).json();
  return (d.items || []).filter((x) => x.id && /^[\w-]{11}$/.test(x.id.videoId)).map((x) => ytLimpio({ id: x.id.videoId, t: x.snippet.title, c: x.snippet.channelTitle, d: '' }));
}
async function ytPagina(q) {
  const r = await fetch('https://www.youtube.com/results?sp=EgIQAQ%253D%253D&search_query=' + encodeURIComponent(q), { headers: {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36',
    'Accept-Language': 'es-419,es;q=0.9,en;q=0.8', Cookie: 'CONSENT=YES+1; SOCS=CAI' } });
  const h = await r.text(), i = h.indexOf('ytInitialData = '); if (i < 0) return [];
  const j = h.indexOf(';</script>', i); if (j < 0) return [];
  const datos = JSON.parse(h.slice(i + 16, j)), out = [];
  const txt = (o) => (o ? o.simpleText || (o.runs || []).map((x) => x.text).join('') : '');
  const recorrer = (o, prof) => {
    if (!o || typeof o !== 'object' || out.length >= 15 || prof > 40) return;
    if (o.videoRenderer && /^[\w-]{11}$/.test(o.videoRenderer.videoId || '')) {
      const v = o.videoRenderer; out.push(ytLimpio({ id: v.videoId, t: txt(v.title), c: txt(v.ownerText || v.longBylineText), d: txt(v.lengthText) })); return;
    }
    for (const k in o) recorrer(o[k], prof + 1);
  };
  recorrer(datos, 0);
  return out;
}

// ---------------- servers que crean los jugadores ----------------
// Sin límite de jugadores. Siguen en la lista aunque estén vacíos; a los 10 minutos sin nadie se borran solos (los que
// juegan avisan que siguen ahí con /vivo). Sólo el dueño (con la clave que recibe al crearlo) lo puede borrar.
const SALA_VACIA = 10 * 60e3;
function salaValida(x) {
  if (!x || typeof x !== 'object') return null;
  const b = (v) => (v ? 1 : 0), n = (v, a, z, d) => { const k = Number(v); return Number.isFinite(k) ? Math.min(z, Math.max(a, Math.round(k))) : d; };
  const nom = texto(x.n, 24); if (nom.length < 1) return null;
  return { n: nom, m: MAPAS_BASE_RB.includes(x.m) ? x.m : 'FlatGrass', mo: x.mo === 'PvP' ? 'PvP' : 'Free', pvp: b(x.pvp || x.mo === 'PvP'), rpg: b(x.rpg), nb: b(x.nb),
    mp: n(x.mp, 0, 5000, 1000), mv: n(x.mv, 0, 200, 40), pw: b(x.pw), ph: typeof x.ph === 'string' && /^[a-z0-9]{1,12}$/.test(x.ph) ? x.ph : '',
    du: typeof x.du === 'string' && /^[a-z0-9]{3,20}$/.test(x.du) ? x.du : '', dn: texto(x.dn, 16), rg: 1 };
}

// ---------------- emisoras de radio (Radio Browser: lista pública y libre) ----------------
const RB_HOSTS = ['de1', 'de2', 'fi1', 'nl1', 'at1'];
const RB_UA = { 'User-Agent': 'HypperXRezoBox/1.0 (+https://github.com/juniorspro/ports)' };
async function rbApi(ruta) {
  let err;
  for (const h of RB_HOSTS) {
    try { const r = await fetch(`https://${h}.api.radio-browser.info${ruta}`, { headers: RB_UA, signal: AbortSignal.timeout(6000) }); if (r.ok) return await r.json(); err = r.status; } catch (e) { err = e; }
  }
  throw new Error('radio-browser ' + err);
}
const CODECS = /^(MP3|AAC|AAC\+|OGG|OPUS|VORBIS)$/i;
const estLimpia = (x) => ({ id: x.stationuuid, t: texto(x.name, 80), c: texto(x.countrycode, 4), g: texto(String(x.tags || '').split(',').slice(0, 2).join(', '), 40),
  b: Math.max(0, Math.min(999, x.bitrate | 0)), k: texto(x.codec, 8), i: /^https:\/\/[^\s"'<>]{4,300}$/.test(x.favicon || '') ? x.favicon : '' });
const estOk = (x) => x && /^[0-9a-f-]{36}$/.test(x.stationuuid || '') && /^https?:\/\//.test(x.url_resolved || '') && !x.hls && CODECS.test(x.codec || '') && x.lastcheckok === 1;
async function estacion(id) {
  const ck = new Request('https://cache.rezobox/radio/u/' + id), c = caches.default, hit = await c.match(ck);
  if (hit) return hit.json();
  const L = await rbApi('/json/stations/byuuid/' + id), x = Array.isArray(L) && L[0];
  const d = estOk(x) ? { u: x.url_resolved, n: texto(x.name, 80) } : { u: '', n: '' };
  await c.put(ck, new Response(JSON.stringify(d), { headers: { 'Cache-Control': 'public, max-age=3600' } }));
  return d;
}

// ---------------- Verity: cerebro y voz ----------------
// Cuota gratis de Workers AI: 10 000 "neuronas" por día (se reinicia a las 0 UTC). Cada charla gasta ~6 y cada frase
// hablada ~2: se lleva la cuenta en D1 y se para a las 9000 (después el juego usa el modelo público, que limita por
// conexión: si lo llamara este servidor, todos compartirían un solo cupo). Por persona (IP con sal): 300 charlas y
// 500 frases por día.
const VER_MODELO = '@cf/meta/llama-3.1-8b-instruct-fp8-fast', VER_TOPE = 9000, VER_CHARLAS = 300, VER_FRASES = 500;
let IA_TABLA = false;
const hoy = () => new Date().toISOString().slice(0, 10);
async function iaTabla(env) {
  if (IA_TABLA) return;
  await env.DB.prepare('CREATE TABLE IF NOT EXISTS ia_uso (dia TEXT, ip TEXT, c INTEGER DEFAULT 0, v INTEGER DEFAULT 0, n REAL DEFAULT 0, PRIMARY KEY (dia, ip))').run();
  IA_TABLA = true;
}
// suma uno al contador de la persona (c: charlas, v: frases); devuelve el error si se pasó
async function iaCupo(env, ip, k) {
  await iaTabla(env);
  const f = await env.DB.prepare(`INSERT INTO ia_uso (dia, ip, c, v) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(dia, ip) DO UPDATE SET c = c + excluded.c, v = v + excluded.v RETURNING c, v`)
    .bind(hoy(), ip, k === 'c' ? 1 : 0, k === 'v' ? 1 : 0).first();
  return f && (k === 'c' ? f.c > VER_CHARLAS : f.v > VER_FRASES) ? 'Verity descansa: hablaste mucho hoy' : '';
}
async function iaQueda(env) { await iaTabla(env); const f = await env.DB.prepare("SELECT n FROM ia_uso WHERE dia = ?1 AND ip = '*'").bind(hoy()).first(); return !f || f.n < VER_TOPE; }
const iaGasto = (env, n) => env.DB.prepare("INSERT INTO ia_uso (dia, ip, n) VALUES (?1, '*', ?2) ON CONFLICT(dia, ip) DO UPDATE SET n = n + excluded.n").bind(hoy(), +n || 0).run();
// ---------------- las IAs del dueño (sus claves, como secretos), para todos ----------------
// Gemini (GEMINI_KEY) y las de VERITY_CLAVES que tengan su secreto (DEEPSEEK_KEY, GROQ_KEY, OPENROUTER_KEY, MISTRAL_KEY,
// CEREBRAS_KEY) y GitHub Models (GITHUB_MODELS_KEY): cada jugador elige en el menú de Verity cuál usa ("auto": la mejor
// que haya). Piensan sin apuro (pensamiento alto). Si una dice que no (sin cupo, sin saldo, error), descansa y se sigue
// con la próxima; al final, Workers AI. Topes por día: los de Google y los de cada persona.
const GEM_CHARLAS = 20000, GEM_FRASES = 3000;
const GEM_AGOTADO = new Map(); // modelo → día en que Google dijo que no hay más cupo
async function hmacHex(clave, msg) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(clave), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(msg)))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function verityCodigo(env) { const h = await hmacHex(env.GEMINI_KEY, 'rezobox-verity-codigo'), a = 'abcdefghjkmnpqrstuvwxyz23456789'; let c = ''; for (let i = 0; i < 8; i++) c += a[parseInt(h.slice(i * 2, i * 2 + 2), 16) % a.length]; return 'VRT-' + c.slice(0, 4) + '-' + c.slice(4); }
const verityToken = async (env) => (await hmacHex(env.GEMINI_KEY, 'rezobox-verity-dueno')).slice(0, 40);
// (ahora es para todos: el código del dueño sigue sirviendo, pero ya no hace falta)
const verityPremium = async (env) => (env.GEMINI_KEY ? 'todos' : '');
// cuenta un uso de Gemini (k: 'gt' texto, 'gv' voz); false si ya se pasó el tope del día
async function gemCupo(env, k) {
  await iaTabla(env);
  const f = await env.DB.prepare("INSERT INTO ia_uso (dia, ip, c) VALUES (?1, ?2, 1) ON CONFLICT(dia, ip) DO UPDATE SET c = c + 1 RETURNING c").bind(hoy(), '*' + k).first();
  return !f || f.c <= (k === 'gt' ? GEM_CHARLAS : GEM_FRASES);
}
async function gemini(env, modelo, cuerpo, ms) {
  if (GEM_AGOTADO.get(modelo) === hoy()) return { agotado: true };
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.GEMINI_KEY }, body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(ms || 60000) });
  if (r.status === 429) { GEM_AGOTADO.set(modelo, hoy()); return { agotado: true }; }
  if (!r.ok) return null;
  const d = await r.json(), p = d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts || [];
  return { texto: p.filter((x) => !x.thought).map((x) => x.text || '').join(''), audio: p.find((x) => x.inlineData) };
}
// probar los modelos de Gemini en orden con lo que hay que revisar (null si ninguno sirvió)
async function geminiPensar(env, modelos, cuerpo, ms, revisar) {
  if (!env.GEMINI_KEY || !(await gemCupo(env, 'gt'))) return null;
  for (const m of modelos) { try { const o = await gemini(env, m, cuerpo, ms); const v = o && !o.agotado && revisar(o.texto); if (v) return v; } catch (e) {} }
  return null;
}
// las otras IAs del dueño (estilo OpenAI)
const DUENO = [...Object.entries(VERITY_CLAVES).map(([id, P]) => ({ id, ...P })), { id: 'github_models', n: 'GitHub Models', u: 'https://models.github.ai/inference/chat/completions', m: ['openai/gpt-4.1-mini', 'openai/gpt-4.1'] }];
const PROV_DESCANSO = new Map();
const claveDe = (env, P) => env[P.id.toUpperCase() + '_KEY'];
async function abierto(env, P, msgs, max, ms, crear, revisar) {
  const key = claveDe(env, P); if (!key || (PROV_DESCANSO.get(P.id) || 0) > Date.now()) return null;
  for (const m of (crear && P.mc) || P.m) {
    try {
      const r = await fetch(P.u, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + key }, body: JSON.stringify(verityAbierto(env[P.id.toUpperCase() + '_MODEL'] || m, msgs, max, crear, !P.sinJSON)), signal: AbortSignal.timeout(ms) });
      // (sin saldo o clave mala: descansa una hora; sin cupo: lo que pida; un modelo que no existe: el próximo)
      if (r.status === 402 || r.status === 401 || r.status === 403) { PROV_DESCANSO.set(P.id, Date.now() + 3600e3); return null; }
      if (r.status === 429) { PROV_DESCANSO.set(P.id, Date.now() + Math.min(3600, +r.headers.get('Retry-After') || 60) * 1000); return null; }
      if (!r.ok) continue;
      const v = revisar(verityTextoAbierto(await r.json())); if (v) return { ...v, f: P.id };
    } catch (e) {}
  }
  return null;
}
// el orden: la que eligió primero (si no es "auto"), después Gemini, después las otras; Workers AI al final (si se puede)
async function verityElegir(env, msgs, ia, crear, tipo, conCF) {
  const revisar = crear ? (t) => verityCreacion(tipo, t) : (t) => verityRespuesta(t), max = crear ? 65536 : 8192, ms = crear ? 900000 : 90000;
  const gem = async () => { const v = await geminiPensar(env, crear ? VERITY_GEMINI_CREA : VERITY_GEMINI, verityAGemini(msgs, max, 'high'), ms, revisar); return v ? { ...v, f: 'gemini' } : null; };
  const otras = DUENO.filter((P) => claveDe(env, P)), elegida = otras.find((P) => P.id === ia);
  if (elegida) { const v = await abierto(env, elegida, msgs, max, ms, crear, revisar); if (v) return v; }
  { const v = await gem(); if (v) return v; }
  for (const P of otras) { if (P === elegida) continue; const v = await abierto(env, P, msgs, max, ms, crear, revisar); if (v) return v; }
  if (conCF && env.AI && (await iaQueda(env))) {
    try {
      const o = await env.AI.run(VER_MODELO, { messages: msgs, max_tokens: crear ? 2400 : 220, temperature: 0.7 });
      const u = (o && o.usage) || {}; await iaGasto(env, u.neurons || (u.prompt_tokens || (crear ? 2500 : 1000)) * 0.0045 + (u.completion_tokens || (crear ? 1500 : 80)) * 0.037);
      const v = revisar(o && (typeof o.response === 'string' ? o.response : JSON.stringify(o.response || '')));
      if (v) return { ...v, f: 'cf' };
    } catch (e) {}
  }
  return null;
}
const iaDe = (d) => (typeof d.ia === 'string' && /^[a-z_]{2,20}$/.test(d.ia) ? d.ia : 'auto');
const verityPensar = (env, msgs, ia) => verityElegir(env, msgs, ia, false, '', true);
// ---------------- Verity crea (mods, cosas en el mundo, animaciones): un JSON largo, pensado sin apuro ----------------
const VER_CREACIONES = 60;
const verityCrearPensar = (env, msgs, tipo, ia, conCF) => verityElegir(env, msgs, ia, true, tipo, conCF);
// qué IAs del dueño hay ahora (para el menú): las que tienen su clave y no están descansando
const verityIas = (env) => Object.fromEntries([['gemini', !!env.GEMINI_KEY && !VERITY_GEMINI.every((m) => GEM_AGOTADO.get(m) === hoy())], ...DUENO.map((P) => [P.id, !!claveDe(env, P) && (PROV_DESCANSO.get(P.id) || 0) <= Date.now()])]);
// el WAV de MeloTTS (44,1 kHz) pasado a 22 050 Hz mono de 16 bits: la mitad de peso y la voz igual de clara
function wavLiviano(b) {
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength); let p = 12, sr = 44100, ch = 1, bits = 16, ini = -1, largo = 0;
  while (p + 8 <= b.length) {
    const id = String.fromCharCode(b[p], b[p + 1], b[p + 2], b[p + 3]), n = dv.getUint32(p + 4, true);
    if (id === 'fmt ') { ch = dv.getUint16(p + 10, true); sr = dv.getUint32(p + 12, true); bits = dv.getUint16(p + 22, true); }
    if (id === 'data') { ini = p + 8; largo = Math.min(n, b.length - ini); break; }
    p += 8 + n + (n & 1);
  }
  if (ini < 0 || bits !== 16) return b;
  const k = Math.max(1, Math.round(sr / 22050)), nIn = Math.floor(largo / (2 * ch)), nOut = Math.floor(nIn / k), out = new Uint8Array(44 + nOut * 2), o = new DataView(out.buffer);
  for (let i = 0; i < nOut; i++) {
    let s = 0; for (let j = 0; j < k; j++) for (let c = 0; c < ch; c++) s += dv.getInt16(ini + ((i * k + j) * ch + c) * 2, true);
    o.setInt16(44 + i * 2, Math.round(s / (k * ch)), true);
  }
  const txt = (q, t) => { for (let i = 0; i < 4; i++) out[q + i] = t.charCodeAt(i); };
  txt(0, 'RIFF'); o.setUint32(4, 36 + nOut * 2, true); txt(8, 'WAVE'); txt(12, 'fmt '); o.setUint32(16, 16, true); o.setUint16(20, 1, true); o.setUint16(22, 1, true);
  o.setUint32(24, Math.round(sr / k), true); o.setUint32(28, Math.round(sr / k) * 2, true); o.setUint16(32, 2, true); o.setUint16(34, 16, true); txt(36, 'data'); o.setUint32(40, nOut * 2, true);
  return out;
}
async function bytesDe(o) {
  if (!o) return null;
  if (o instanceof ArrayBuffer) return new Uint8Array(o);
  if (o instanceof Uint8Array) return o;
  if (typeof o.getReader === 'function') return new Uint8Array(await new Response(o).arrayBuffer());
  const a = typeof o.audio === 'string' ? o.audio : o.result && typeof o.result.audio === 'string' ? o.result.audio : null; if (!a) return null;
  const s = atob(a), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return u;
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url), r = url.pathname.replace(/\/+$/, '');
    const ip = await huella((req.headers.get('CF-Connecting-IP') || '') + (env.SAL || 'rezobox'));
    try {
      if (req.method === 'GET' && r === '/api/lista') {
        const tipo = ['mapa', 'anim'].includes(url.searchParams.get('tipo')) ? url.searchParams.get('tipo') : 'mod', q = texto(url.searchParams.get('q'), 40), etq = url.searchParams.get('etq') || '';
        const orden = { nuevo: 'fecha DESC', desc: 'descargas DESC, fecha DESC', pop: '(likes * 3 + descargas) DESC, fecha DESC' }[url.searchParams.get('orden')] || '(likes * 3 + descargas) DESC, fecha DESC';
        const p = Math.max(0, Math.min(200, parseInt(url.searchParams.get('p'), 10) || 0));
        let where = 'tipo = ?1 AND oculto = 0'; const args = [tipo];
        if (q) { where += ' AND (nombre LIKE ?2 OR descripcion LIKE ?2 OR autor LIKE ?2)'; args.push('%' + q.replace(/[%_]/g, '') + '%'); }
        if (ETIQUETAS.includes(etq)) { where += ` AND etiquetas LIKE ?${args.length + 1}`; args.push('%"' + etq + '"%'); }
        const cat = url.searchParams.get('cat') || ''; // (animaciones: baile, gesto o acción; va en la columna "base")
        if (tipo === 'anim' && /^(baile|gesto|accion)$/.test(cat)) { where += ` AND base = ?${args.length + 1}`; args.push(cat); }
        const filas = await env.DB.prepare(`SELECT id, tipo, nombre, autor, descripcion, etiquetas, icono, base, fecha, descargas, likes, codigo FROM items WHERE ${where} ORDER BY ${orden} LIMIT 20 OFFSET ${p * 20}`).bind(...args).all();
        const total = await env.DB.prepare(`SELECT COUNT(*) AS n FROM items WHERE ${where}`).bind(...args).first();
        return json({ items: filas.results.map((f) => ({ ...f, etiquetas: JSON.parse(f.etiquetas || '[]') })), total: total ? total.n : 0 });
      }
      // los servers del juego bajan todos los mods (y después sólo los nuevos): datos completos, sin contar descargas.
      // "vivos" = los que siguen publicados (para soltar los borrados u ocultos)
      if (req.method === 'GET' && r === '/api/mods') {
        // (sin caché: una respuesta guardada de antes de que se suba un mod lo dejaría afuera de "vivos")
        const desde = Math.max(0, parseInt(url.searchParams.get('desde'), 10) || 0);
        const filas = await env.DB.prepare('SELECT id, fecha, datos FROM items WHERE tipo = ?1 AND oculto = 0 AND fecha > ?2 ORDER BY fecha ASC LIMIT 25').bind('mod', desde).all();
        const vivos = await env.DB.prepare('SELECT id FROM items WHERE tipo = ?1 AND oculto = 0').bind('mod').all();
        const partes = []; let tam = 0, corto = false;
        for (const f of filas.results) { if (partes.length && tam + f.datos.length > 6e6) { corto = true; break; } tam += f.datos.length; partes.push(`{"id":${JSON.stringify(f.id)},"fecha":${+f.fecha},"d":${f.datos}}`); }
        const cuerpo = `{"items":[${partes.join(',')}],"mas":${corto || filas.results.length === 25},"vivos":${JSON.stringify(vivos.results.map((x) => x.id))}}`;
        return new Response(cuerpo, { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS } });
      }
      let m;
      if (req.method === 'GET' && (m = /^\/api\/item\/([a-z0-9]{8})$/.exec(r))) {
        const f = await env.DB.prepare('SELECT datos, oculto FROM items WHERE id = ?1').bind(m[1]).first();
        if (!f || f.oculto) return json({ error: 'no existe' }, 404);
        await env.DB.prepare('UPDATE items SET descargas = descargas + 1 WHERE id = ?1').bind(m[1]).run();
        return new Response(f.datos, { headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } });
      }
      if (req.method === 'POST' && r === '/api/publicar') {
        const cuerpo = await req.text(); if (cuerpo.length > 1900000) return json({ error: 'muy grande (máximo 1,9 MB)' }, 413);
        let d; try { d = JSON.parse(cuerpo); } catch (e) { return json({ error: 'no es JSON' }, 400); }
        const v = validar(d); if (typeof v === 'string') return json({ error: v }, 400);
        const hora = await env.DB.prepare('SELECT COUNT(*) AS n FROM items WHERE ip = ?1 AND fecha > ?2').bind(ip, Date.now() - 3600e3).first();
        if (hora && hora.n >= 5) return json({ error: 'publicaste mucho: esperá una hora' }, 429);
        const id = azar(8), clave = azar(20); v.id = id;
        const icono = v.formato === 'rezobox-mod' ? v.icono : v.foto || '', tipo = { 'rezobox-mod': 'mod', 'rezobox-mapa': 'mapa', 'rezobox-anim': 'anim' }[v.formato];
        await env.DB.prepare('INSERT INTO items (id, tipo, nombre, autor, descripcion, etiquetas, icono, base, datos, fecha, clave, ip, codigo) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)')
          .bind(id, tipo, v.nombre, v.autor, v.descripcion, JSON.stringify(v.etiquetas), icono, (v.formato === 'rezobox-anim' ? v.cat : v.base) || null, JSON.stringify(v), Date.now(), await huella(clave), ip, v.codigo ? 1 : 0).run();
        return json({ id, clave });
      }
      if (req.method === 'POST' && (m = /^\/api\/(like|denunciar)\/([a-z0-9]{8})$/.exec(r))) {
        const k = m[1] === 'like' ? 'l' : 'd';
        const ya = await env.DB.prepare('SELECT 1 AS s FROM votos WHERE id = ?1 AND ip = ?2 AND k = ?3').bind(m[2], ip, k).first();
        if (!ya) {
          await env.DB.prepare('INSERT OR IGNORE INTO votos (id, ip, k) VALUES (?1, ?2, ?3)').bind(m[2], ip, k).run();
          if (k === 'l') await env.DB.prepare('UPDATE items SET likes = likes + 1 WHERE id = ?1').bind(m[2]).run();
          else await env.DB.prepare('UPDATE items SET denuncias = denuncias + 1, oculto = CASE WHEN denuncias + 1 >= 3 THEN 1 ELSE oculto END WHERE id = ?1').bind(m[2]).run();
        }
        return json({ ok: true });
      }
      if (req.method === 'POST' && (m = /^\/api\/borrar\/([a-z0-9]{8})$/.exec(r))) {
        const b = await req.json().catch(() => ({})), h = await huella(String(b.clave || ''));
        const admin = env.ADMIN_CLAVE && b.admin && (await huella(String(b.admin))) === (await huella(env.ADMIN_CLAVE));
        const res = admin ? await env.DB.prepare('DELETE FROM items WHERE id = ?1').bind(m[1]).run() : await env.DB.prepare('DELETE FROM items WHERE id = ?1 AND clave = ?2').bind(m[1], h).run();
        return json({ ok: !!(res.meta && res.meta.changes) });
      }
      if (req.method === 'GET' && r === '/api/yt') {
        const q = texto(url.searchParams.get('q'), 80); if (!q) return json({ items: [] });
        const ck = new Request('https://cache.rezobox/yt?q=' + encodeURIComponent(q.toLowerCase())), c = caches.default;
        const hit = await c.match(ck); if (hit) return hit;
        let items = [];
        if (env.YT_KEY) items = await ytApi(q, env.YT_KEY).catch(() => []);
        if (!items.length) items = await ytPagina(q).catch(() => []);
        const res = new Response(JSON.stringify({ items }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': items.length ? 'public, max-age=3600' : 'no-store', ...CORS } });
        if (items.length) await c.put(ck, res.clone());
        return res;
      }
      if (req.method === 'GET' && r === '/api/salas') {
        const ahora = Date.now();
        await env.DB.prepare('DELETE FROM salas WHERE vivo < ?1').bind(ahora - SALA_VACIA).run();
        const filas = await env.DB.prepare('SELECT id, datos, creada, vivo FROM salas ORDER BY creada DESC LIMIT 500').all();
        return json({ ahora, vacia: SALA_VACIA, salas: filas.results.map((f) => ({ ...JSON.parse(f.datos), id: f.id, creada: f.creada, vivo: f.vivo })) });
      }
      if (req.method === 'POST' && r === '/api/salas') {
        const d = salaValida(await req.clone().json().catch(() => null)); if (!d) return json({ error: 'server inválido' }, 400);
        const ahora = Date.now(), hora = await env.DB.prepare('SELECT COUNT(*) AS n FROM salas WHERE ip = ?1 AND creada > ?2').bind(ip, ahora - 3600e3).first();
        if (hora && hora.n >= 10) return json({ error: 'creaste muchos servers: esperá un rato' }, 429);
        // (el id lo propone el juego: la clave para entrar a un server con contraseña se calcula con él)
        const pide = await req.clone().json().catch(() => ({})), id = typeof pide.id === 'string' && /^[a-z0-9]{8}$/.test(pide.id) ? pide.id : azar(8), clave = azar(20);
        if (await env.DB.prepare('SELECT 1 AS s FROM salas WHERE id = ?1').bind(id).first()) return json({ error: 'id usado' }, 409);
        await env.DB.prepare('INSERT INTO salas (id, datos, clave, ip, creada, vivo) VALUES (?1, ?2, ?3, ?4, ?5, ?5)').bind(id, JSON.stringify(d), await huella(clave), ip, ahora).run();
        return json({ id, clave, sala: { ...d, id, creada: ahora, vivo: ahora } });
      }
      if (req.method === 'POST' && (m = /^\/api\/salas\/([a-z0-9]{8})\/vivo$/.exec(r))) {
        // alguien juega ahí: sigue vivo (se escribe como mucho cada 30 s)
        const ahora = Date.now(), res = await env.DB.prepare('UPDATE salas SET vivo = ?1 WHERE id = ?2 AND vivo < ?3').bind(ahora, m[1], ahora - 30e3).run();
        const existe = res.meta && res.meta.changes ? true : !!(await env.DB.prepare('SELECT 1 AS s FROM salas WHERE id = ?1 AND vivo >= ?2').bind(m[1], ahora - SALA_VACIA).first());
        return json({ ok: true, existe });
      }
      if (req.method === 'POST' && (m = /^\/api\/salas\/([a-z0-9]{8})\/borrar$/.exec(r))) {
        const b = await req.json().catch(() => ({})), h = await huella(String(b.clave || ''));
        const admin = env.ADMIN_CLAVE && b.admin && (await huella(String(b.admin))) === (await huella(env.ADMIN_CLAVE));
        const res = admin ? await env.DB.prepare('DELETE FROM salas WHERE id = ?1').bind(m[1]).run() : await env.DB.prepare('DELETE FROM salas WHERE id = ?1 AND clave = ?2').bind(m[1], h).run();
        return json({ ok: !!(res.meta && res.meta.changes) });
      }
      if (req.method === 'GET' && r === '/api/radio') {
        const q = texto(url.searchParams.get('q'), 60), tag = texto(url.searchParams.get('tag'), 30).toLowerCase();
        const ck = new Request('https://cache.rezobox/radio?q=' + encodeURIComponent(q.toLowerCase()) + '&tag=' + encodeURIComponent(tag)), c = caches.default;
        const hit = await c.match(ck); if (hit) return hit;
        const base = '/json/stations/search?limit=80&hidebroken=true&order=clickcount&reverse=true';
        let L = await rbApi(base + (tag ? '&tag=' + encodeURIComponent(tag) : '') + (q ? '&name=' + encodeURIComponent(q) : ''));
        // si el nombre no encuentra nada, se busca como género
        if (q && !tag && Array.isArray(L) && !L.filter(estOk).length) L = await rbApi(base + '&tag=' + encodeURIComponent(q.toLowerCase()));
        const vistos = new Set(), items = [];
        for (const x of Array.isArray(L) ? L : []) { if (!estOk(x)) continue; const k = String(x.name || '').toLowerCase().trim(); if (vistos.has(k)) continue; vistos.add(k); items.push(estLimpia(x)); if (items.length >= 30) break; }
        const res = new Response(JSON.stringify({ items }), { headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': items.length ? 'public, max-age=1800' : 'no-store', ...CORS } });
        if (items.length) await c.put(ck, res.clone());
        return res;
      }
      m = /^\/api\/radio\/u\/([0-9a-f-]{36})$/.exec(r);
      if (req.method === 'GET' && m) return json(await estacion(m[1]));
      m = /^\/api\/radio\/play\/([0-9a-f-]{36})$/.exec(r);
      if (req.method === 'GET' && m) {
        // el audio de una emisora de la lista, con permiso para que el juego lo pase por su sonido 3D
        const d = await estacion(m[1]); if (!d.u) return json({ error: 'emisora no disponible' }, 404);
        const up = await fetch(d.u, { headers: RB_UA, redirect: 'follow' });
        const tipo = up.headers.get('Content-Type') || '';
        if (!up.ok || !/^(audio\/|application\/ogg)/i.test(tipo)) { try { up.body && up.body.cancel(); } catch (e) {} return json({ error: 'la emisora no responde' }, 502); }
        return new Response(up.body, { headers: { 'Content-Type': tipo, 'Cache-Control': 'no-store', ...CORS } });
      }
      m = /^\/api\/radio\/clic\/([0-9a-f-]{36})$/.exec(r);
      if (req.method === 'GET' && m) { rbApi('/json/url/' + m[1]).catch(() => {}); return json({ ok: true }); }
      if (req.method === 'POST' && r === '/api/verity') {
        const cuerpo = await req.text(); if (cuerpo.length > 12000) return json({ error: 'muy grande' }, 413);
        let d; try { d = JSON.parse(cuerpo); } catch (e) { return json({ error: 'no es JSON' }, 400); }
        const msgs = verityMensajes(d); if (!msgs) return json({ error: 'pedido inválido' }, 400);
        const lim = await iaCupo(env, ip, 'c'); if (lim) return json({ error: lim }, 429);
        const v = await verityPensar(env, msgs, iaDe(d));
        return v ? json(v) : json({ error: 'sin cupo: usar el modelo público' }, 503);
      }
      if (req.method === 'POST' && r === '/api/verity/crear') {
        const cuerpo = await req.text(); if (cuerpo.length > 40000) return json({ error: 'muy grande' }, 413);
        let d; try { d = JSON.parse(cuerpo); } catch (e) { return json({ error: 'no es JSON' }, 400); }
        const msgs = verityCrearMensajes(d); if (!msgs) return json({ error: 'pedido inválido' }, 400);
        await iaTabla(env);
        const f = await env.DB.prepare("INSERT INTO ia_uso (dia, ip, c) VALUES (?1, ?2, 1) ON CONFLICT(dia, ip) DO UPDATE SET c = c + 1 RETURNING c").bind(hoy(), 'crea|' + ip).first();
        if (f && f.c > VER_CREACIONES) return json({ error: 'Verity ya creó mucho hoy' }, 429);
        // (sinCF: el juego prefiere probar antes los modelos gratis grandes que el chico de Workers AI)
        const v = await verityCrearPensar(env, msgs, d.tipo, iaDe(d), !d.sinCF);
        return v ? json(v) : json({ error: 'no pudo crearlo: usar el modelo público' }, 503);
      }
      if (req.method === 'GET' && r === '/api/verity/ias') return json({ ias: verityIas(env) });
      // el código secreto del dueño → su permiso para usar Gemini en cualquier server (10 intentos por día)
      if (req.method === 'POST' && r === '/api/verity/llave') {
        if (!env.GEMINI_KEY) return json({ error: 'sin Gemini' }, 503);
        await iaTabla(env);
        const f = await env.DB.prepare("INSERT INTO ia_uso (dia, ip, c) VALUES (?1, ?2, 1) ON CONFLICT(dia, ip) DO UPDATE SET c = c + 1 RETURNING c").bind(hoy(), 'llave|' + ip).first();
        if (f && f.c > 10) return json({ error: 'demasiados intentos' }, 429);
        let d = {}; try { d = JSON.parse(await req.text()); } catch (e) {}
        const cod = String(d.codigo || '').trim().toUpperCase().replace(/\s+/g, '');
        return cod && cod === (await verityCodigo(env)).toUpperCase() ? json({ tk: await verityToken(env) }) : json({ error: 'código incorrecto' }, 403);
      }
      if (req.method === 'GET' && r === '/api/verity/voz') {
        const l = url.searchParams.get('l') || '', t = texto(url.searchParams.get('t'), 240), noche = url.searchParams.get('n') === '1';
        // con Gemini: la voz natural (habla cualquier idioma)
        const prem = await verityPremium(env);
        if (prem && t && GEM_AGOTADO.get(VERITY_GEMINI_VOZ) !== hoy()) {
          const ck = new Request('https://cache.rezobox/verity/vozg/' + (noche ? 'n/' : '') + (await huella(t)).slice(0, 40)), c = caches.default, hit = await c.match(ck);
          const cab = { 'Content-Type': 'audio/wav', 'Cache-Control': 'public, max-age=604800', ...CORS };
          if (hit) return new Response(hit.body, { headers: cab });
          if (await gemCupo(env, 'gv')) {
            try {
              const o = await gemini(env, VERITY_GEMINI_VOZ, verityVozGemini(t, noche), 25000);
              if (o && o.audio) { const wav = wavLiviano(verityWav(o.audio.inlineData.data, o.audio.inlineData.mimeType)); await c.put(ck, new Response(wav, { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'public, max-age=604800' } })); return new Response(wav, { headers: cab }); }
            } catch (e) {}
          }
        }
        if (!VERITY_VOCES.includes(l) || !t) return json({ error: 'pedido inválido' }, 400);
        const ck = new Request('https://cache.rezobox/verity/voz/' + l + '/' + (await huella(l + '|' + t)).slice(0, 40)), c = caches.default, hit = await c.match(ck);
        const cab = { 'Content-Type': 'audio/wav', 'Cache-Control': 'public, max-age=604800', ...CORS };
        if (hit) return new Response(hit.body, { headers: cab });
        if (!env.AI) return json({ error: 'sin voz' }, 503);
        const lim = await iaCupo(env, ip, 'v'); if (lim) return json({ error: lim }, 429);
        if (!(await iaQueda(env))) return json({ error: 'cupo del día' }, 429);
        const wav = wavLiviano(await bytesDe(await env.AI.run('@cf/myshell-ai/melotts', { prompt: t, lang: l })) || new Uint8Array(0));
        if (wav.length < 100) return json({ error: 'sin voz' }, 502);
        await iaGasto(env, ((wav.length - 44) / 2 / 22050) * 18.7 / 60);
        await c.put(ck, new Response(wav, { headers: { 'Content-Type': 'audio/wav', 'Cache-Control': 'public, max-age=604800' } }));
        return new Response(wav, { headers: cab });
      }
      if (r === '' || r === '/api') return json({ tienda: 'HypperX RezoBox', formatos: ['rezobox-mod', 'rezobox-mapa', 'rezobox-anim'], etiquetas: ETIQUETAS });
      return json({ error: 'no encontrado' }, 404);
    } catch (e) {
      return json({ error: 'error del servidor' }, 500);
    }
  },
};
