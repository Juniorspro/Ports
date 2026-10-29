// Tienda de HypperX RezoBox: mods (.rbmod) y mapas (.rbmapa) que publica la gente. Cloudflare Worker + D1.
// Los mods y mapas son SÓLO DATOS (nada de código): acá se valida todo con límites antes de guardar, y el juego
// vuelve a validar al instalar. Denuncias: con 3 se oculta solo. El autor borra con la clave que recibe al publicar.
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' };
const json = (o, st = 200) => new Response(JSON.stringify(o), { status: st, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...CORS } });
import { validarRB as validar, ETIQUETAS_RB as ETIQUETAS } from './formato.js';
const texto = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

async function huella(s) { const h = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))); return [...h].map((b) => b.toString(16).padStart(2, '0')).join(''); }
const azar = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => 'abcdefghijkmnpqrstuvwxyz23456789'[b % 32]).join('');

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url), r = url.pathname.replace(/\/+$/, '');
    const ip = await huella((req.headers.get('CF-Connecting-IP') || '') + (env.SAL || 'rezobox'));
    try {
      if (req.method === 'GET' && r === '/api/lista') {
        const tipo = url.searchParams.get('tipo') === 'mapa' ? 'mapa' : 'mod', q = texto(url.searchParams.get('q'), 40), etq = url.searchParams.get('etq') || '';
        const orden = { nuevo: 'fecha DESC', desc: 'descargas DESC, fecha DESC', pop: '(likes * 3 + descargas) DESC, fecha DESC' }[url.searchParams.get('orden')] || '(likes * 3 + descargas) DESC, fecha DESC';
        const p = Math.max(0, Math.min(200, parseInt(url.searchParams.get('p'), 10) || 0));
        let where = 'tipo = ?1 AND oculto = 0'; const args = [tipo];
        if (q) { where += ' AND (nombre LIKE ?2 OR descripcion LIKE ?2 OR autor LIKE ?2)'; args.push('%' + q.replace(/[%_]/g, '') + '%'); }
        if (ETIQUETAS.includes(etq)) { where += ` AND etiquetas LIKE ?${args.length + 1}`; args.push('%"' + etq + '"%'); }
        const filas = await env.DB.prepare(`SELECT id, tipo, nombre, autor, descripcion, etiquetas, icono, base, fecha, descargas, likes FROM items WHERE ${where} ORDER BY ${orden} LIMIT 20 OFFSET ${p * 20}`).bind(...args).all();
        const total = await env.DB.prepare(`SELECT COUNT(*) AS n FROM items WHERE ${where}`).bind(...args).first();
        return json({ items: filas.results.map((f) => ({ ...f, etiquetas: JSON.parse(f.etiquetas || '[]') })), total: total ? total.n : 0 });
      }
      let m;
      if (req.method === 'GET' && (m = /^\/api\/item\/([a-z0-9]{8})$/.exec(r))) {
        const f = await env.DB.prepare('SELECT datos, oculto FROM items WHERE id = ?1').bind(m[1]).first();
        if (!f || f.oculto) return json({ error: 'no existe' }, 404);
        await env.DB.prepare('UPDATE items SET descargas = descargas + 1 WHERE id = ?1').bind(m[1]).run();
        return new Response(f.datos, { headers: { 'Content-Type': 'application/json; charset=utf-8', ...CORS } });
      }
      if (req.method === 'POST' && r === '/api/publicar') {
        const cuerpo = await req.text(); if (cuerpo.length > 300000) return json({ error: 'muy grande (máximo 300 KB)' }, 413);
        let d; try { d = JSON.parse(cuerpo); } catch (e) { return json({ error: 'no es JSON' }, 400); }
        const v = validar(d); if (typeof v === 'string') return json({ error: v }, 400);
        const hora = await env.DB.prepare('SELECT COUNT(*) AS n FROM items WHERE ip = ?1 AND fecha > ?2').bind(ip, Date.now() - 3600e3).first();
        if (hora && hora.n >= 5) return json({ error: 'publicaste mucho: esperá una hora' }, 429);
        const id = azar(8), clave = azar(20); v.id = id;
        const icono = v.formato === 'rezobox-mod' ? v.icono : v.foto || '';
        await env.DB.prepare('INSERT INTO items (id, tipo, nombre, autor, descripcion, etiquetas, icono, base, datos, fecha, clave, ip) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12)')
          .bind(id, v.formato === 'rezobox-mod' ? 'mod' : 'mapa', v.nombre, v.autor, v.descripcion, JSON.stringify(v.etiquetas), icono, v.base || null, JSON.stringify(v), Date.now(), await huella(clave), ip).run();
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
      if (r === '' || r === '/api') return json({ tienda: 'HypperX RezoBox', formatos: ['rezobox-mod', 'rezobox-mapa'], etiquetas: ETIQUETAS });
      return json({ error: 'no encontrado' }, 404);
    } catch (e) {
      return json({ error: 'error del servidor' }, 500);
    }
  },
};
