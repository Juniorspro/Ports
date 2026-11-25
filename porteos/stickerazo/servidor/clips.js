// ---------------- clips con sonido para el buscador de stickers de WhatsApp («el KLIPY de Stickerazo») ----------------
// WhatsApp (desde la 2.26.46) busca stickers con sonido en GIPHY y en KLIPY: no se le puede poner otro proveedor (las
// direcciones están fijas en su código), pero sí publicar ahí. Stickerazo publica en SU canal los clips que manda la gente,
// después de revisarlos, y cada uno lleva su código («sz» + 5 letras) como etiqueta: el usuario lo escribe en el buscador
// de stickers de WhatsApp y le aparece el suyo, con sonido. Nadie vincula su WhatsApp ni se hace cuentas en otro lado.
//  POST   /api/clips {titulo, etiquetas, n, tipo}   → {id, codigo, parte}   empieza una subida (6 por día por cuenta)
//  PUT    /api/clips/:id/partes/:i                  el pedazo i del video (de a `parte` bytes; MP4 o WebM, ≤ 12 MB)
//  POST   /api/clips/:id/listo                      → {estado: 'revision'}  cuando llegaron todos los pedazos
//  GET    /api/clips                                → tus clips: {id, codigo, titulo, estado, creado}
//  DELETE /api/clips/:id                            lo borra de acá (si ya estaba en GIPHY, queda pedido para sacarlo)
// Moderación (X-Admin), con la página /admin/clips:
//  GET  /api/admin/clips?estado=revision            la lista       GET /api/admin/clips/:id/video   el archivo
//  POST /api/admin/clips/:id {accion}               aprobar | rechazar | publicado (subido a mano) | sacado
//   «aprobar»: con GIPHY_KEY (clave de producción con subida) y GIPHY_CANAL lo sube a GIPHY (upload.giphy.com/v1/gifs, con
//   las etiquetas, el código y «stickerazo»); sin ellas queda «aprobado» para subirlo a mano (a KLIPY o GIPHY).
// Estados: subiendo → revision → aprobado → publicado | rechazado | borrar (borrado por el dueño, falta sacarlo de GIPHY).
export const MAX_CLIP = 12 * 1024 * 1024, PARTE = 1024 * 1024, POR_DIA = 6;
export const ESQUEMA_CLIPS = [
  'CREATE TABLE IF NOT EXISTS clips (id TEXT PRIMARY KEY, codigo TEXT NOT NULL UNIQUE, usuario TEXT NOT NULL, titulo TEXT NOT NULL, etiquetas TEXT NOT NULL, tipo TEXT NOT NULL, n INTEGER NOT NULL, estado TEXT NOT NULL, giphy TEXT, nota TEXT, creado INTEGER NOT NULL, revisado INTEGER)',
  'CREATE INDEX IF NOT EXISTS i_clips_usuario ON clips(usuario, creado)',
  'CREATE INDEX IF NOT EXISTS i_clips_estado ON clips(estado, creado)',
  'CREATE TABLE IF NOT EXISTS clip_partes (clip TEXT NOT NULL, i INTEGER NOT NULL, datos BLOB NOT NULL, PRIMARY KEY (clip, i))',
];
export const TABLAS_CLIPS = 'clips|clip_partes';
const LETRAS = 'abcdefghjkmnpqrstuvwxyz23456789';
const azar = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((x) => LETRAS[x % LETRAS.length]).join('');
const ID = /^[a-z0-9]{12}$/;
const TIPOS = { 'video/mp4': 'mp4', 'video/webm': 'webm' };
let listo = null;
const preparar = (db) => (listo ||= db.batch(ESQUEMA_CLIPS.map((s) => db.prepare(s))).catch((e) => { listo = null; throw e; }));

// (las etiquetas: palabras sueltas en minúscula, sin signos; hasta 8)
export function limpiarEtiquetas(x) {
  const l = (Array.isArray(x) ? x : String(x || '').split(/[,#\n]/)).map((t) => String(t).toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N} ]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 24)).filter((t) => t.length >= 2);
  return [...new Set(l)].slice(0, 8);
}
const publico = (c) => ({ id: c.id, codigo: c.codigo, titulo: c.titulo, etiquetas: c.etiquetas ? c.etiquetas.split(',') : [], estado: c.estado, creado: c.creado, giphy: c.giphy || null, nota: c.nota || null });
// (el video entero, juntando los pedazos)
async function video(db, id) {
  const { results } = await db.prepare('SELECT datos FROM clip_partes WHERE clip = ? ORDER BY i').bind(id).all();
  const partes = results.map((r) => new Uint8Array(r.datos)), n = partes.reduce((s, p) => s + p.length, 0), out = new Uint8Array(n);
  let o = 0; for (const p of partes) { out.set(p, o); o += p.length; }
  return out;
}
const esVideo = (b, tipo) => tipo === 'mp4' ? b.length > 12 && String.fromCharCode(...b.slice(4, 8)) === 'ftyp' : b.length > 4 && b[0] === 0x1a && b[1] === 0x45 && b[2] === 0xdf && b[3] === 0xa3;

// subirlo a GIPHY, al canal de Stickerazo (necesita una clave de producción aprobada para subir con «username»)
export async function subirAGiphy(env, c, datos) {
  const f = new FormData();
  f.append('api_key', env.GIPHY_KEY); f.append('username', env.GIPHY_CANAL);
  f.append('tags', [c.codigo, 'stickerazo', ...(c.etiquetas ? c.etiquetas.split(',') : [])].join(', '));
  f.append('file', new Blob([datos], { type: c.tipo === 'mp4' ? 'video/mp4' : 'video/webm' }), `${c.codigo}.${c.tipo}`);
  const r = await fetch(env.GIPHY_SUBIDA || 'https://upload.giphy.com/v1/gifs', { method: 'POST', body: f });
  let j = {}; try { j = await r.json(); } catch (e) { /* sin cuerpo */ }
  if (!r.ok || !(j.data && j.data.id)) throw new Error('GIPHY no lo aceptó (' + r.status + (j.meta && j.meta.msg ? ': ' + j.meta.msg : '') + ')');
  return String(j.data.id);
}

/** las rutas /api/clips…; devuelve la respuesta o null si no es de acá */
export async function clipsRutas(req, db, yo, r, metodo, { json, error, limite, cuerpo, textoProhibido }) {
  if (r !== 'clips' && !r.startsWith('clips/')) return null;
  if (!yo) return error('Entrá con tu cuenta para publicar con sonido', 401);
  await preparar(db);
  let m;
  if (r === 'clips' && metodo === 'GET') {
    const { results } = await db.prepare("SELECT * FROM clips WHERE usuario = ? AND estado NOT IN ('borrar', 'subiendo') ORDER BY creado DESC LIMIT 100").bind(yo.id).all();
    return json({ clips: results.map(publico) });
  }
  if (r === 'clips' && metodo === 'POST') {
    const d = await cuerpo(), titulo = String(d.titulo || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 60), etiquetas = limpiarEtiquetas(d.etiquetas);
    const n = Math.floor(+d.n || 0), tipo = TIPOS[String(d.tipo || '').split(';')[0]];
    if (!tipo) return error('Tiene que ser un video MP4 o WebM');
    if (n < 1000 || n > MAX_CLIP) return error('El clip tiene que pesar menos de 12 MB');
    if (!titulo) return error('Ponele un título');
    if (textoProhibido(titulo + ' ' + etiquetas.join(' '))) return error('Ese texto no se puede publicar');
    if (!(await limite('clips:' + yo.id, POR_DIA, 86400))) return error(`Hasta ${POR_DIA} clips por día. Mañana podés mandar más.`, 429);
    let codigo; for (let k = 0; k < 6 && !codigo; k++) { const c = 'sz' + azar(5); if (!(await db.prepare('SELECT 1 FROM clips WHERE codigo = ?').bind(c).first())) codigo = c; }
    if (!codigo) return error('Probá de nuevo', 503);
    // (las subidas que quedaron por la mitad hace más de un día, afuera)
    const viejas = (await db.prepare("SELECT id FROM clips WHERE usuario = ? AND estado = 'subiendo' AND creado < ?").bind(yo.id, Date.now() - 86400e3).all()).results;
    for (const v of viejas) await db.batch([db.prepare('DELETE FROM clip_partes WHERE clip = ?').bind(v.id), db.prepare('DELETE FROM clips WHERE id = ?').bind(v.id)]);
    const id = azar(12);
    await db.prepare("INSERT INTO clips (id, codigo, usuario, titulo, etiquetas, tipo, n, estado, creado) VALUES (?, ?, ?, ?, ?, ?, ?, 'subiendo', ?)").bind(id, codigo, yo.id, titulo, etiquetas.join(','), tipo, n, Date.now()).run();
    return json({ id, codigo, parte: PARTE }, 201);
  }
  if (!(m = /^clips\/([a-z0-9]{12})(?:\/(partes\/(\d{1,2})|listo))?$/.exec(r)) || !ID.test(m[1])) return error('No existe', 404);
  const c = await db.prepare('SELECT * FROM clips WHERE id = ? AND usuario = ?').bind(m[1], yo.id).first();
  if (!c || c.estado === 'borrar') return error('No existe', 404);
  if (m[3] !== undefined && metodo === 'PUT') {
    if (c.estado !== 'subiendo') return error('Ese clip ya se mandó', 409);
    const i = +m[3], total = Math.ceil(c.n / PARTE), b = new Uint8Array(await req.arrayBuffer());
    const esperado = i === total - 1 ? c.n - i * PARTE : PARTE;
    if (i >= total || b.length !== esperado) return error('Ese pedazo no va');
    if (i === 0 && !esVideo(b, c.tipo)) return error('Eso no es un video');
    await db.prepare('INSERT OR REPLACE INTO clip_partes (clip, i, datos) VALUES (?, ?, ?)').bind(c.id, i, b).run();
    return json({ ok: true });
  }
  if (m[2] === 'listo' && metodo === 'POST') {
    if (c.estado !== 'subiendo') return json({ estado: c.estado });
    const total = Math.ceil(c.n / PARTE), hay = (await db.prepare('SELECT COUNT(*) AS k, COALESCE(SUM(LENGTH(datos)), 0) AS t FROM clip_partes WHERE clip = ?').bind(c.id).first());
    if (hay.k !== total || hay.t !== c.n) return error('Faltan pedazos del video', 409);
    await db.prepare("UPDATE clips SET estado = 'revision' WHERE id = ?").bind(c.id).run();
    return json({ estado: 'revision', codigo: c.codigo });
  }
  if (!m[2] && metodo === 'DELETE') {
    // (si ya estaba en GIPHY, el video se borra igual pero queda marcado para sacarlo de allá a mano: GIPHY no lo deja por API)
    if (c.giphy) await db.batch([db.prepare("UPDATE clips SET estado = 'borrar' WHERE id = ?").bind(c.id), db.prepare('DELETE FROM clip_partes WHERE clip = ?').bind(c.id)]);
    else await db.batch([db.prepare('DELETE FROM clip_partes WHERE clip = ?').bind(c.id), db.prepare('DELETE FROM clips WHERE id = ?').bind(c.id)]);
    return json({ ok: true });
  }
  return error('No existe', 404);
}

/** la moderación: /api/admin/clips… (ya pasó la clave de admin) */
export async function clipsAdmin(req, env, db, r, metodo, { json, error, cuerpo }) {
  if (r !== 'admin/clips' && !r.startsWith('admin/clips/')) return null;
  await preparar(db);
  let m;
  if (r === 'admin/clips' && metodo === 'GET') {
    const estado = new URL(req.url).searchParams.get('estado') || 'revision';
    const { results } = await db.prepare('SELECT * FROM clips WHERE estado = ? ORDER BY creado LIMIT 200').bind(estado).all();
    return json({ clips: results.map((c) => ({ ...publico(c), usuario: c.usuario, n: c.n, tipo: c.tipo })), giphy: !!(env.GIPHY_KEY && env.GIPHY_CANAL) });
  }
  if (!(m = /^admin\/clips\/([a-z0-9]{12})(\/video)?$/.exec(r))) return error('No existe', 404);
  const c = await db.prepare('SELECT * FROM clips WHERE id = ?').bind(m[1]).first();
  if (!c) return error('No existe', 404);
  if (m[2] && metodo === 'GET') return new Response(await video(db, c.id), { headers: { 'Content-Type': c.tipo === 'mp4' ? 'video/mp4' : 'video/webm', 'Cache-Control': 'no-store', 'Content-Disposition': `inline; filename="${c.codigo}.${c.tipo}"` } });
  if (!m[2] && metodo === 'POST') {
    const { accion, giphy } = await cuerpo(), ahora = Date.now();
    if (accion === 'rechazar') { await db.batch([db.prepare("UPDATE clips SET estado = 'rechazado', revisado = ? WHERE id = ?").bind(ahora, c.id), db.prepare('DELETE FROM clip_partes WHERE clip = ?').bind(c.id)]); return json({ estado: 'rechazado' }); }
    if (accion === 'publicado') { await db.prepare("UPDATE clips SET estado = 'publicado', giphy = COALESCE(?, giphy), revisado = ? WHERE id = ?").bind(giphy ? String(giphy).slice(0, 40) : null, ahora, c.id).run(); return json({ estado: 'publicado' }); }
    if (accion === 'sacado') { await db.batch([db.prepare('DELETE FROM clip_partes WHERE clip = ?').bind(c.id), db.prepare('DELETE FROM clips WHERE id = ?').bind(c.id)]); return json({ ok: true }); }
    if (accion === 'aprobar') {
      if (!['revision', 'aprobado'].includes(c.estado)) return error('Ese clip está ' + c.estado, 409);
      if (!(env.GIPHY_KEY && env.GIPHY_CANAL)) { await db.prepare("UPDATE clips SET estado = 'aprobado', revisado = ? WHERE id = ?").bind(ahora, c.id).run(); return json({ estado: 'aprobado', manual: true }); }
      try {
        const id = await subirAGiphy(env, c, await video(db, c.id));
        await db.prepare("UPDATE clips SET estado = 'publicado', giphy = ?, nota = NULL, revisado = ? WHERE id = ?").bind(id, ahora, c.id).run();
        return json({ estado: 'publicado', giphy: id });
      } catch (e) {
        await db.prepare("UPDATE clips SET estado = 'aprobado', nota = ?, revisado = ? WHERE id = ?").bind(String(e.message).slice(0, 200), ahora, c.id).run();
        return json({ estado: 'aprobado', error: e.message });
      }
    }
    return error('¿Qué hago?');
  }
  return error('No existe', 404);
}

// la página para revisar los clips (pide la clave de admin y la guarda en el navegador)
export const PAGINA_ADMIN_CLIPS = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Clips con sonido · Stickerazo</title>
<style>:root{color-scheme:dark}body{margin:0;font:15px system-ui,sans-serif;background:#14121c;color:#f5f3fb}main{max-width:760px;margin:0 auto;padding:16px}
h1{font-size:22px}.f{display:flex;gap:8px;flex-wrap:wrap;margin:10px 0}button,select,input{font:inherit;border-radius:10px;border:0;padding:9px 13px;background:#2c2840;color:inherit}
button.si{background:#25d366;color:#04260f;font-weight:700}button.no{background:#ff5a5f;color:#2a0507;font-weight:700}.c{background:#201d2c;border-radius:16px;padding:12px;margin:12px 0}
video{width:100%;max-width:360px;aspect-ratio:1;background:#000;border-radius:12px;display:block}small{color:#a7a2bb}code{color:#ffd23f;font-size:17px}</style></head><body><main>
<h1>Clips con sonido</h1><p><small>Aprobados se suben al canal de Stickerazo en GIPHY (si está la clave); si no, bajalo y subilo a mano a KLIPY o GIPHY con el código como etiqueta y marcalo «publicado».</small></p>
<div class="f"><select id="e"><option value="revision">Para revisar</option><option value="aprobado">Aprobados (falta subir)</option><option value="publicado">Publicados</option><option value="borrar">Borrados por el dueño (sacar de GIPHY)</option><option value="rechazado">Rechazados</option></select><button id="r">Actualizar</button></div>
<div id="l"></div></main><script>
const base=location.pathname.replace(/\\/admin\\/clips\\/?$/,'');let clave=localStorage.getItem('sz_admin')||'';
async function pedir(r,o={}){if(!clave){clave=prompt('Clave de admin')||'';localStorage.setItem('sz_admin',clave);}o.headers={...(o.headers||{}),'X-Admin':clave};const x=await fetch(base+'/api/'+r,o);if(x.status===403){localStorage.removeItem('sz_admin');clave='';throw new Error('Clave incorrecta');}return x;}
const esc=(s)=>String(s).replace(/[&<>"]/g,(c)=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function lista(){const l=document.getElementById('l');l.textContent='Cargando…';try{const j=await (await pedir('admin/clips?estado='+document.getElementById('e').value)).json();
l.innerHTML=j.clips.length?'':'<p><small>No hay.</small></p>';for(const c of j.clips){const d=document.createElement('div');d.className='c';
d.innerHTML='<b>'+esc(c.titulo)+'</b> · <code>'+c.codigo+'</code><br><small>'+esc(c.etiquetas.join(', '))+' · '+Math.round(c.n/1024)+' KB · '+new Date(c.creado).toLocaleString()+(c.nota?' · '+esc(c.nota):'')+(c.giphy?' · GIPHY '+esc(c.giphy):'')+'</small>'+(['revision','aprobado'].includes(c.estado)?'<video controls playsinline preload="none"></video><div class="f"><button class="si" data-a="aprobar">'+(j.giphy?'Aprobar y subir a GIPHY':'Aprobar')+'</button><button data-a="bajar">Bajar</button><button data-a="publicado">Ya lo subí a mano</button><button class="no" data-a="rechazar">Rechazar</button></div>':c.estado==='borrar'?'<div class="f"><button data-a="sacado">Ya lo saqué de GIPHY</button></div>':'');
const v=d.querySelector('video');if(v)pedir('admin/clips/'+c.id+'/video').then((x)=>x.blob()).then((b)=>{v.src=URL.createObjectURL(b);});
d.onclick=async(ev)=>{const b=ev.target.closest('[data-a]');if(!b)return;const a=b.dataset.a;
if(a==='bajar'){const x=await pedir('admin/clips/'+c.id+'/video');const u=URL.createObjectURL(await x.blob());const e=document.createElement('a');e.href=u;e.download=c.codigo+'.'+c.tipo;e.click();return;}
const g=a==='publicado'?prompt('ID de GIPHY o KLIPY (opcional)')||'':'';b.disabled=true;const x=await (await pedir('admin/clips/'+c.id,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({accion:a,giphy:g})})).json();
if(x.error)alert(x.error);lista();};l.appendChild(d);}}catch(e){l.textContent=e.message;}}
document.getElementById('r').onclick=lista;document.getElementById('e').onchange=lista;lista();
</script></body></html>`;

// al borrar la cuenta: sus clips (los que ya estaban en GIPHY quedan marcados para sacarlos de allá)
export async function borrarClips(db, usuario) {
  await preparar(db);
  const { results } = await db.prepare('SELECT id, giphy FROM clips WHERE usuario = ?').bind(usuario).all();
  for (const c of results) {
    await db.prepare('DELETE FROM clip_partes WHERE clip = ?').bind(c.id).run();
    if (c.giphy) await db.prepare("UPDATE clips SET estado = 'borrar' WHERE id = ?").bind(c.id).run(); else await db.prepare('DELETE FROM clips WHERE id = ?').bind(c.id).run();
  }
}
