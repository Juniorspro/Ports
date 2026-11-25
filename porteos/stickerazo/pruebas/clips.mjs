// Los clips con sonido para el buscador de stickers de WhatsApp (servidor/clips.js), punta a punta en el Worker de verdad
// (con la D1 de mentira): mandar un clip en pedazos, la revisión, aprobar (sin clave de GIPHY queda para subirlo a mano;
// con clave se sube a un GIPHY de mentira con el código como etiqueta), borrar, los límites y la página de admin.
// uso: node clips.mjs   (el video de prueba: /tmp/claude-0/sz_clips/prueba.mp4, de ffmpeg)
import fs from 'fs'; import http from 'http'; import { arrancar } from './servidor_local.mjs';
const PUERTO = 8993, BASE = process.env.SZ_BASE || '', B = `http://127.0.0.1:${PUERTO}${BASE}`, VIDEO = fs.readFileSync('/tmp/claude-0/sz_clips/prueba.mp4');
let fallas = 0; const ok = (c, t, d) => { console.log((c ? 'OK    ' : 'FALLA ') + t + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); if (!c) fallas++; };
// (un GIPHY de mentira: guarda lo que le subieron)
const subidas = []; const giphy = http.createServer(async (q, r) => { const p = []; for await (const c of q) p.push(c); const b = Buffer.concat(p);
  const f = await new Request('http://x', { method: 'POST', headers: { 'content-type': q.headers['content-type'] }, body: b }).formData();
  const file = f.get('file'); subidas.push({ ruta: q.url, api_key: f.get('api_key'), username: f.get('username'), tags: f.get('tags'), n: file ? file.size : 0, tipo: file ? file.type : '' });
  r.writeHead(200, { 'Content-Type': 'application/json' }); r.end(JSON.stringify({ data: { id: 'GiphyId123' }, meta: { status: 200 } })); });
await new Promise((ok) => giphy.listen(8994, ok));
const { srv, env } = await arrancar(PUERTO);
const api = async (ruta, o = {}, tok) => { const h = { ...(o.headers || {}) }; if (tok) h.Authorization = 'Bearer ' + tok; let body = o.body; if (o.json) { h['Content-Type'] = 'application/json'; body = JSON.stringify(o.json); }
  const r = await fetch(B + ruta, { method: o.method || 'GET', headers: h, body }); let j = null; const t = r.headers.get('content-type') || ''; if (t.includes('json')) j = await r.json(); else j = new Uint8Array(await r.arrayBuffer()); return { st: r.status, j }; };
const adm = { 'X-Admin': 'clave-admin' };
const A = (await api('/api/registro', { method: 'POST', json: { nombre: 'clipero' } })).j.token, Bt = (await api('/api/registro', { method: 'POST', json: { nombre: 'otra.persona' } })).j.token;
async function mandar(tok, titulo, datos = VIDEO, tipo = 'video/mp4', etiquetas = 'jaja, Mate!!, #fútbol') {
  const r = await api('/api/clips', { method: 'POST', json: { titulo, etiquetas, n: datos.length, tipo } }, tok); if (r.st !== 201) return r;
  for (let i = 0, k = 0; i < datos.length; i += r.j.parte, k++) { const s = await api(`/api/clips/${r.j.id}/partes/${k}`, { method: 'PUT', body: datos.subarray(i, i + r.j.parte), headers: { 'Content-Type': 'application/octet-stream' } }, tok); if (s.st !== 200) return s; }
  const l = await api(`/api/clips/${r.j.id}/listo`, { method: 'POST' }, tok); return { st: l.st, j: { ...r.j, ...l.j } };
}
ok((await api('/api/clips', { method: 'POST', json: { titulo: 'x', n: 5000, tipo: 'video/mp4' } })).st === 401, 'sin cuenta: no');
const c1 = await mandar(A, 'Che boludo 🧉');
ok(c1.st === 200 && /^sz[a-z2-9]{5}$/.test(c1.j.codigo) && c1.j.estado === 'revision', 'mandar en pedazos (' + Math.ceil(VIDEO.length / 1048576) + ' de 1 MB) → en revisión, con su código', c1.j);
const mios = (await api('/api/clips', {}, A)).j.clips;
ok(mios.length === 1 && mios[0].estado === 'revision' && mios[0].etiquetas.join() === 'jaja,mate,fútbol', 'tus clips: estado y etiquetas limpias', mios[0]);
ok((await api('/api/clips', {}, Bt)).j.clips.length === 0 && (await api(`/api/clips/${c1.j.id}`, { method: 'DELETE' }, Bt)).st === 404, 'otra cuenta no los ve ni los borra');
ok((await api('/api/clips', { method: 'POST', json: { titulo: 'a', n: 13 * 1048576, tipo: 'video/mp4' } }, A)).st === 400, 'más de 12 MB: no');
ok((await api('/api/clips', { method: 'POST', json: { titulo: 'a', n: 5000, tipo: 'image/gif' } }, A)).st === 400, 'algo que no es video: no');
ok((await api('/api/clips', { method: 'POST', json: { titulo: 'p0rn0 gratis', n: 5000, tipo: 'video/mp4' } }, A)).st === 400, 'título prohibido: no');
const falso = Buffer.alloc(3000, 7); const rf = await mandar(A, 'falso', falso);
ok(rf.st === 400 && /no es un video/.test(rf.j.error), 'un archivo que no empieza como MP4: no', rf.j);
const rIncompleto = await api('/api/clips', { method: 'POST', json: { titulo: 'medio', n: VIDEO.length, tipo: 'video/mp4' } }, A);
await api(`/api/clips/${rIncompleto.j.id}/partes/0`, { method: 'PUT', body: VIDEO.subarray(0, rIncompleto.j.parte) }, A);
ok((await api(`/api/clips/${rIncompleto.j.id}/listo`, { method: 'POST' }, A)).st === 409, 'si faltan pedazos, no se manda');
ok((await api('/admin/clips')).st === 200 && (await fetch(B + '/admin/clips').then((r) => r.text())).includes('Clips con sonido'), 'la página de admin');
ok((await api('/api/admin/clips')).st === 403, 'la lista de admin sin clave: no');
let L = (await api('/api/admin/clips?estado=revision', { headers: adm })).j; ok(L.clips.length === 1 && L.clips[0].codigo === c1.j.codigo && L.giphy === false, 'admin: el clip para revisar', { n: L.clips.length, giphy: L.giphy });
const v = await api(`/api/admin/clips/${c1.j.id}/video`, { headers: adm }); ok(v.st === 200 && v.j.length === VIDEO.length && Buffer.compare(Buffer.from(v.j), VIDEO) === 0, 'admin: el video llega entero (byte a byte)', v.j.length);
const ap = await api(`/api/admin/clips/${c1.j.id}`, { method: 'POST', json: { accion: 'aprobar' }, headers: adm }); ok(ap.j.estado === 'aprobado' && ap.j.manual, 'sin clave de GIPHY: queda aprobado para subirlo a mano', ap.j);
await api(`/api/admin/clips/${c1.j.id}`, { method: 'POST', json: { accion: 'publicado', giphy: 'KLIPY-abc' }, headers: adm });
const mios2 = (await api('/api/clips', {}, A)).j.clips; ok(mios2.find((c) => c.id === c1.j.id).estado === 'publicado' && mios2.length === 1, 'marcado «publicado» a mano: el dueño lo ve publicado (y no ve los que quedaron a medio subir)', mios2.map((c) => c.estado));
// con la clave de GIPHY (producción, con canal): se sube solo
Object.assign(env, { GIPHY_KEY: 'clave-giphy', GIPHY_CANAL: 'stickerazo', GIPHY_SUBIDA: 'http://127.0.0.1:8994/v1/gifs' });
const c2 = await mandar(A, 'Gol de media cancha', VIDEO, 'video/mp4', 'futbol, gol');
const ap2 = await api(`/api/admin/clips/${c2.j.id}`, { method: 'POST', json: { accion: 'aprobar' }, headers: adm });
const s = subidas[0] || {};
ok(ap2.j.estado === 'publicado' && ap2.j.giphy === 'GiphyId123' && s.api_key === 'clave-giphy' && s.username === 'stickerazo' && s.n === VIDEO.length && s.tipo === 'video/mp4' && s.tags.split(', ')[0] === c2.j.codigo && s.tags.includes('stickerazo') && s.tags.includes('gol'),
  'con clave: aprobar lo sube a GIPHY al canal, con el código y las etiquetas', { estado: ap2.j.estado, tags: s.tags, n: s.n });
const c3 = await mandar(Bt, 'No va'); await api(`/api/admin/clips/${c3.j.id}`, { method: 'POST', json: { accion: 'rechazar' }, headers: adm });
ok((await api('/api/clips', {}, Bt)).j.clips[0].estado === 'rechazado' && (await api(`/api/admin/clips/${c3.j.id}/video`, { headers: adm })).j.length === 0, 'rechazado: el dueño lo ve y el video se borra');
ok((await api(`/api/clips/${c2.j.id}`, { method: 'DELETE' }, A)).st === 200 && !(await api('/api/clips', {}, A)).j.clips.some((c) => c.id === c2.j.id), 'el dueño lo borra');
L = (await api('/api/admin/clips?estado=borrar', { headers: adm })).j; ok(L.clips.some((c) => c.id === c2.j.id), 'el que estaba en GIPHY queda en «sacar de GIPHY» para el admin');
let n = 0, ult; for (let k = 0; k < 8; k++) { ult = await api('/api/clips', { method: 'POST', json: { titulo: 'muchos ' + k, n: 5000, tipo: 'video/mp4' } }, Bt); if (ult.st === 201) n++; }
ok(ult.st === 429 && n === 6 - 1, 'hasta 6 por día por cuenta', { aceptados_mas: n, ultimo: ult.st });
await api('/api/yo', { method: 'DELETE' }, A);
ok((await api('/api/admin/clips?estado=publicado', { headers: adm })).j.clips.length === 0 && (await api('/api/admin/clips?estado=borrar', { headers: adm })).j.clips.length >= 2, 'al borrar la cuenta: sus clips se van (los de GIPHY, a «sacar de GIPHY»)');
srv.close(); giphy.close();
console.log(fallas ? `${fallas} FALLAS` : 'TODO BIEN'); process.exit(fallas ? 1 : 0);
