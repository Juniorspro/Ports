// ---------------- Stickerazo Premium, la compra «de por vida» y las donaciones (con PayPal) ----------------
// Apagado hasta que estén las claves de una app de PayPal (developer.paypal.com → Apps & Credentials, cuenta Business):
//   SZ_PAYPAL_CLIENT_ID (variable) y SZ_PAYPAL_SECRET (secreto: «wrangler secret put SZ_PAYPAL_SECRET», nunca en el repo)
//   SZ_PAYPAL_MODO = 'live' para cobrar de verdad (si no, sandbox: plata de mentira para probar)
//   SZ_PAYPAL_PLAN_MES y SZ_PAYPAL_PLAN_ANIO: los planes de la suscripción (los crea herramientas/paypal_planes.mjs)
// PayPal no deja pagar adentro de una WebView, así que (como entrar con Google):
//  1. la app pide un ticket (POST /api/premium/ticket, con la cuenta) y abre en el navegador <servidor>/premium?t=…
//  2. esa página tiene los botones de PayPal. Las compras sueltas (de por vida, donación) las crea y las cobra el
//     servidor (/api/pp/orden y /api/pp/capturar); la suscripción la crea PayPal con el plan y el id de la cuenta
//     (custom_id) y el servidor la confirma (/api/pp/suscripcion).
//  3. nunca se cree lo que dice el navegador: todo se le pregunta a la API de PayPal (monto, moneda, estado y que sea
//     de esta cuenta). La app pregunta GET /api/premium y se entera sola.
// La suscripción se vuelve a revisar con PayPal cuando está por vencer (o una vez por día): si se dio de baja, el
// Premium sigue hasta el final de lo pagado. Baja desde la app: POST /api/premium/baja (el «botón de baja»).
// Devoluciones: sólo las que pide la ley (10 días desde la primera compra). La «de por vida» se revisa con PayPal cada
// 6 horas durante 180 días: si la plata se devolvió o hubo un contracargo, el Premium se va solo. Para las otras (o a
// mano), el panel: POST /api/admin/premium {nombre} quita el Premium y da de baja la suscripción.
// De PayPal se guarda el id de la suscripción o de la orden, el monto, la moneda y la fecha. Nada de tarjetas ni mails.
// En las pruebas: SZ_PAYPAL_API (un PayPal de mentira en la compu).
export const PRECIOS = { mes: '1.99', anio: '14.99', vida: '29.99' }, MONEDA = 'USD', DONACION = { min: 1, max: 200 };
export const BENEFICIOS = [
  ['🚫', 'Sin anuncios, nunca', 'Si la app suma publicidad, a vos no te aparece.'],
  ['✨', 'Insignia Premium', 'En tu perfil y al lado de tu @ en la comunidad.'],
  ['☁️', '10 veces más lugar en tu cuenta', '250 MB y 400 packs guardados, en vez de 25 MB y 80.'],
  ['💍', 'Anillo dorado', 'Tu foto de perfil con un anillo dorado que brilla.'],
  ['💛', 'Bancás la app', 'Ayudás a que Stickerazo siga gratis para todos.'],
];
const DIA = 86400e3, GRACIA = 3 * DIA, VIDA = 4102444800000;   // (la «de por vida»: hasta el 1/1/2100)
const PERIODO = { mes: 31 * DIA, anio: 366 * DIA };
export const ESQUEMA_PAGOS = [
  'CREATE TABLE IF NOT EXISTS premium (usuario TEXT PRIMARY KEY, tipo TEXT NOT NULL, ref TEXT NOT NULL, estado TEXT NOT NULL, hasta INTEGER NOT NULL, revisado INTEGER NOT NULL, creado INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS pagos (id TEXT PRIMARY KEY, usuario TEXT NOT NULL, tipo TEXT NOT NULL, monto TEXT NOT NULL, moneda TEXT NOT NULL, creado INTEGER NOT NULL)',
  'CREATE TABLE IF NOT EXISTS tickets_pago (t TEXT PRIMARY KEY, usuario TEXT NOT NULL, vence INTEGER NOT NULL)',
];
const enc = new TextEncoder();
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha = async (s) => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s))));
const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
export const pagosPrendidos = (env) => !!(env.SZ_PAYPAL_CLIENT_ID && env.SZ_PAYPAL_SECRET);
const apiPP = (env) => env.SZ_PAYPAL_API || (env.SZ_PAYPAL_MODO === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com');
export const sdkPP = (env) => env.SZ_PAYPAL_SDK || 'https://www.paypal.com/sdk/js';
const esSuscripcion = (t) => t === 'mes' || t === 'anio';
// (la donación: de 1 a 200 dólares, con dos decimales; lo que no cumple, null)
export const montoDonacion = (v) => { const n = Math.round(Number(v) * 100) / 100; return isFinite(n) && n >= DONACION.min && n <= DONACION.max ? n.toFixed(2) : null; };

// ---- la API de PayPal (con el permiso de la app, que dura unas horas) ----
let TOK = null;
async function token(env) {
  if (TOK && TOK.de === env.SZ_PAYPAL_CLIENT_ID && TOK.vence > Date.now()) return TOK.t;
  const r = await fetch(apiPP(env) + '/v1/oauth2/token', { method: 'POST', body: 'grant_type=client_credentials',
    headers: { Authorization: 'Basic ' + btoa(env.SZ_PAYPAL_CLIENT_ID + ':' + env.SZ_PAYPAL_SECRET), 'Content-Type': 'application/x-www-form-urlencoded' } });
  if (!r.ok) throw new Error('PayPal no dio permiso: ' + r.status);
  const j = await r.json(); TOK = { t: j.access_token, vence: Date.now() + Math.max(60, (j.expires_in || 3000) - 120) * 1000, de: env.SZ_PAYPAL_CLIENT_ID };
  return TOK.t;
}
async function pp(env, metodo, ruta, cuerpo, idem) {
  const h = { Authorization: 'Bearer ' + (await token(env)), 'Content-Type': 'application/json', Prefer: 'return=representation' };
  if (idem) h['PayPal-Request-Id'] = idem;
  const r = await fetch(apiPP(env) + ruta, { method: metodo, headers: h, body: cuerpo ? JSON.stringify(cuerpo) : undefined });
  let j = {}; try { j = await r.json(); } catch (e) { /* sin cuerpo (204) */ }
  return { ok: r.ok, st: r.status, j };
}
const cancelar = (env, sub, motivo) => pp(env, 'POST', `/v1/billing/subscriptions/${encodeURIComponent(sub)}/cancel`, { reason: motivo });

// ---- lo que tiene cada cuenta ----
async function marcarUsuario(db, u) {
  const p = await db.prepare('SELECT hasta FROM premium WHERE usuario = ?').bind(u).first();
  const d = await db.prepare("SELECT COUNT(*) AS n FROM pagos WHERE usuario = ? AND tipo = 'donacion'").bind(u).first();
  await db.prepare('UPDATE usuarios SET premium_hasta = ?, donador = ? WHERE id = ?').bind(p ? p.hasta : 0, d.n ? 1 : 0, u).run();
}
/** la suscripción, como la ve PayPal: si es de esta cuenta y de uno de nuestros planes, queda anotada (o null).
 *  nueva: recién aprobada, tiene que estar activa */
async function revisarSuscripcion(env, db, u, sub, nueva = false) {
  const r = await pp(env, 'GET', '/v1/billing/subscriptions/' + encodeURIComponent(sub));
  if (!r.ok) return null;
  const s = r.j, tipo = s.plan_id && s.plan_id === env.SZ_PAYPAL_PLAN_MES ? 'mes' : s.plan_id && s.plan_id === env.SZ_PAYPAL_PLAN_ANIO ? 'anio' : null;
  if (!tipo || s.custom_id !== u) return null;
  const ahora = Date.now(), previo = await db.prepare('SELECT * FROM premium WHERE usuario = ?').bind(u).first();
  if (previo && previo.tipo === 'vida') return previo;
  let estado, hasta;
  if (s.status === 'ACTIVE' || s.status === 'APPROVED') {
    const prox = Date.parse((s.billing_info && s.billing_info.next_billing_time) || '');
    estado = 'activa'; hasta = (isFinite(prox) ? prox : ahora + PERIODO[tipo]) + GRACIA;
  } else {
    if (nueva) return null;
    // (dada de baja, suspendida —no se pudo cobrar— o vencida: hasta el final de lo que se pagó)
    estado = 'cancelada'; hasta = previo && previo.ref === sub ? previo.hasta : ahora;
  }
  await db.prepare('INSERT OR REPLACE INTO premium (usuario, tipo, ref, estado, hasta, revisado, creado) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(u, tipo, sub, estado, hasta, ahora, previo ? previo.creado : ahora).run();
  await marcarUsuario(db, u);
  return { usuario: u, tipo, ref: sub, estado, hasta, previo };
}
// (la compra «de por vida»: si en PayPal figura devuelta o con contracargo, se quita)
const DEVUELTA = ['REFUNDED', 'PARTIALLY_REFUNDED', 'REVERSED'];
async function revisarCompra(env, db, u, p) {
  const r = await pp(env, 'GET', '/v2/checkout/orders/' + encodeURIComponent(p.ref)); if (!r.ok) return null;
  const cap = ((((r.j.purchase_units || [])[0] || {}).payments || {}).captures || [])[0] || {};
  if (DEVUELTA.includes(cap.status)) return quitarPremium(env, db, u, 'reembolsada');
  await db.prepare('UPDATE premium SET revisado = ? WHERE usuario = ?').bind(Date.now(), u).run();
  return null;
}
/** sacar el Premium (devolución, contracargo o a mano desde el panel): se da de baja la suscripción si había */
export async function quitarPremium(env, db, u, motivo = 'quitada') {
  const p = await db.prepare('SELECT * FROM premium WHERE usuario = ?').bind(u).first(); if (!p) return null;
  if (esSuscripcion(p.tipo) && p.estado === 'activa' && pagosPrendidos(env)) { try { await cancelar(env, p.ref, 'Premium quitado: ' + motivo); } catch (e) { /* nada */ } }
  const ahora = Date.now();
  await db.prepare('UPDATE premium SET estado = ?, hasta = ?, revisado = ? WHERE usuario = ?').bind(motivo, ahora, ahora, u).run();
  await marcarUsuario(db, u);
  return { ...p, estado: motivo, hasta: ahora };
}
export async function estadoPremium(env, db, u, revisar = true) {
  let p = await db.prepare('SELECT * FROM premium WHERE usuario = ?').bind(u).first();
  if (p && revisar && pagosPrendidos(env) && p.tipo === 'vida' && p.estado === 'vida' && Date.now() - p.revisado > 6 * 3600e3) {
    const c = await db.prepare('SELECT creado FROM pagos WHERE id = ?').bind(p.ref).first();
    if (c && Date.now() - c.creado < 180 * DIA) { try { p = (await revisarCompra(env, db, u, p)) || p; } catch (e) { /* PayPal no contesta: después */ } }
  }
  if (p && revisar && pagosPrendidos(env) && esSuscripcion(p.tipo) && p.estado === 'activa' && (p.hasta - Date.now() < 2 * DIA || Date.now() - p.revisado > DIA)) {
    try { const n = await revisarSuscripcion(env, db, u, p.ref); if (n) p = n; } catch (e) { /* PayPal no contesta: queda lo que había */ }
  }
  const d = await db.prepare("SELECT COUNT(*) AS n FROM pagos WHERE usuario = ? AND tipo = 'donacion'").bind(u).first();
  return { premium: !!p && p.hasta > Date.now(), tipo: p ? p.tipo : null, estado: p ? p.estado : null, hasta: p ? p.hasta : 0, donador: d.n > 0 };
}
/** al borrar una cuenta: la suscripción se da de baja (que no se le cobre más) y los pagos quedan sin nombre (los
 *  registros de lo cobrado se guardan por ley, pero ya no se pueden atar a nadie) */
export async function pagosAlBorrar(env, db, u) {
  const p = await db.prepare('SELECT * FROM premium WHERE usuario = ?').bind(u).first();
  if (p && esSuscripcion(p.tipo) && p.estado === 'activa' && pagosPrendidos(env)) { try { await cancelar(env, p.ref, 'Cuenta borrada'); } catch (e) { /* se reintenta a mano */ } }
  await db.batch([db.prepare('DELETE FROM premium WHERE usuario = ?').bind(u), db.prepare('DELETE FROM tickets_pago WHERE usuario = ?').bind(u),
    db.prepare("UPDATE pagos SET usuario = 'borrada' WHERE usuario = ?").bind(u)]);
}
/** el ticket de la página de pagos → la cuenta (o null si no está o venció) */
export async function cuentaDelTicket(db, t) {
  if (!/^[A-Za-z0-9_-]{40,64}$/.test(String(t || ''))) return null;
  const x = await db.prepare('SELECT usuario, vence FROM tickets_pago WHERE t = ?').bind(await sha(t)).first();
  return x && x.vence > Date.now() ? x.usuario : null;
}

/** las rutas /api/premium… y /api/pp/…; devuelve la respuesta o null si no es de acá */
export async function pagosRutas(req, env, db, yo, r, metodo, servidor, { json, error, limite, cuerpo }) {
  if (r !== 'premium' && !r.startsWith('premium/') && !r.startsWith('pp/')) return null;
  const prendido = pagosPrendidos(env);
  if (r === 'premium' && metodo === 'GET')
    return json({ disponible: prendido, precios: PRECIOS, moneda: MONEDA, donacion: DONACION, beneficios: BENEFICIOS, yo: yo ? await estadoPremium(env, db, yo.id, prendido) : null });
  if (!prendido) return error('Premium todavía no está prendido', 503);
  if (r === 'premium/ticket' && metodo === 'POST') {
    if (!yo) return error('Entrá con tu cuenta', 401);
    if (!(await limite('ppticket:' + yo.id, 30, 3600))) return error('Probá de nuevo en un rato', 429);
    const t = b64u(crypto.getRandomValues(new Uint8Array(32))), ahora = Date.now();
    await db.batch([db.prepare('DELETE FROM tickets_pago WHERE vence < ?').bind(ahora), db.prepare('INSERT INTO tickets_pago (t, usuario, vence) VALUES (?, ?, ?)').bind(await sha(t), yo.id, ahora + 2 * 3600e3)]);
    return json({ url: `${servidor}/premium?t=${t}` });
  }
  if (r === 'premium/baja' && metodo === 'POST') {
    if (!yo) return error('Entrá con tu cuenta', 401);
    const p = await db.prepare('SELECT * FROM premium WHERE usuario = ?').bind(yo.id).first();
    if (!p || !esSuscripcion(p.tipo) || p.estado !== 'activa') return error('No tenés una suscripción para dar de baja', 409);
    const c = await cancelar(env, p.ref, 'Baja desde Stickerazo');
    if (!c.ok && c.st !== 422) return error('PayPal no contestó. Probá de nuevo en un rato.', 502);   // (422: ya estaba dada de baja)
    await db.prepare("UPDATE premium SET estado = 'cancelada', revisado = ? WHERE usuario = ?").bind(Date.now(), yo.id).run();
    return json({ ok: true, ...(await estadoPremium(env, db, yo.id, false)) });
  }
  // (lo que manda la página de PayPal, con el ticket)
  if (r.startsWith('pp/') && metodo === 'POST') {
    const d = await cuerpo(), u = await cuentaDelTicket(db, d.t);
    if (!u) return error('El enlace venció. Volvé a la app y tocá Premium de nuevo.', 401);
    if (!(await limite('pp:' + u, 60, 3600))) return error('Probá de nuevo en un rato', 429);
    if (r === 'pp/orden') {
      const tipo = d.tipo === 'vida' || d.tipo === 'donacion' ? d.tipo : null; if (!tipo) return error('Mal armado');
      if (tipo === 'vida' && (await estadoPremium(env, db, u, false)).tipo === 'vida') return error('Ya tenés Premium de por vida', 409);
      const monto = tipo === 'vida' ? PRECIOS.vida : montoDonacion(d.monto);
      if (!monto) return error(`La donación va de US$ ${DONACION.min} a US$ ${DONACION.max}`);
      const o = await pp(env, 'POST', '/v2/checkout/orders', { intent: 'CAPTURE', purchase_units: [{ reference_id: tipo, custom_id: u,
        description: tipo === 'vida' ? 'Stickerazo Premium de por vida' : 'Donación a Stickerazo', amount: { currency_code: MONEDA, value: monto } }] });
      if (!o.ok || !o.j.id) return error('PayPal no contestó. Probá de nuevo.', 502);
      return json({ id: o.j.id });
    }
    if (r === 'pp/capturar') {
      const id = String(d.orden || ''); if (!/^[A-Z0-9-]{5,40}$/.test(id)) return error('Mal armado');
      const ya = await db.prepare('SELECT usuario, tipo FROM pagos WHERE id = ?').bind(id).first();
      if (ya) return ya.usuario === u ? json({ ok: true, ...(await estadoPremium(env, db, u, false)), compra: ya.tipo }) : error('Esa orden es de otra cuenta', 409);
      let c = await pp(env, 'POST', `/v2/checkout/orders/${id}/capture`, {}, 'cobro-' + id);
      // (si ya estaba cobrada —se cortó la conexión a la mitad—, se lee cómo quedó)
      if (!c.ok) { const g = await pp(env, 'GET', `/v2/checkout/orders/${id}`); if (g.ok && g.j.status === 'COMPLETED') c = g; else return error('No se pudo cobrar. No se te descontó nada.', 402); }
      const pu = (c.j.purchase_units || [])[0] || {}, cap = ((pu.payments || {}).captures || [])[0] || {};
      const tipo = pu.reference_id, valor = cap.amount && cap.amount.value, moneda = cap.amount && cap.amount.currency_code;
      if (c.j.status !== 'COMPLETED' || (cap.custom_id || pu.custom_id) !== u || moneda !== MONEDA || !(tipo === 'vida' ? valor === PRECIOS.vida : tipo === 'donacion' && montoDonacion(valor) === valor))
        return error('El pago no coincide con lo pedido. Escribinos y lo arreglamos.', 409);
      if (cap.status !== 'COMPLETED') return json({ ok: false, pendiente: true, error: 'PayPal dejó el pago en revisión. Cuando lo apruebe, escribinos y lo activamos.' }, 202);
      const ahora = Date.now(), previo = await db.prepare('SELECT * FROM premium WHERE usuario = ?').bind(u).first();
      const ops = [db.prepare('INSERT OR IGNORE INTO pagos (id, usuario, tipo, monto, moneda, creado) VALUES (?, ?, ?, ?, ?, ?)').bind(id, u, tipo, valor, moneda, ahora)];
      if (tipo === 'vida') {
        ops.push(db.prepare('INSERT OR REPLACE INTO premium (usuario, tipo, ref, estado, hasta, revisado, creado) VALUES (?, ?, ?, ?, ?, ?, ?)').bind(u, 'vida', id, 'vida', VIDA, ahora, previo ? previo.creado : ahora));
        // (si pagaba por mes o por año, esa suscripción se da de baja: no se le cobra más)
        if (previo && esSuscripcion(previo.tipo) && previo.estado === 'activa') { try { await cancelar(env, previo.ref, 'Pasó a Premium de por vida'); } catch (e) { /* nada */ } }
      }
      await db.batch(ops); await marcarUsuario(db, u);
      return json({ ok: true, ...(await estadoPremium(env, db, u, false)), compra: tipo });
    }
    if (r === 'pp/suscripcion') {
      const sub = String(d.sub || ''); if (!/^I-[A-Z0-9]{6,30}$/.test(sub)) return error('Mal armado');
      const n = await revisarSuscripcion(env, db, u, sub, true);
      if (!n) return error('No pudimos confirmar la suscripción con PayPal. Si se te cobró, escribinos.', 409);
      if (n.tipo === 'vida') { try { await cancelar(env, sub, 'Ya tenía Premium de por vida'); } catch (e) { /* nada */ } return error('Ya tenés Premium de por vida: dimos de baja esta suscripción.', 409); }
      // (si cambió de plan, la suscripción anterior se da de baja)
      if (n.previo && esSuscripcion(n.previo.tipo) && n.previo.estado === 'activa' && n.previo.ref !== sub) { try { await cancelar(env, n.previo.ref, 'Cambió de plan'); } catch (e) { /* nada */ } }
      await db.prepare('INSERT OR IGNORE INTO pagos (id, usuario, tipo, monto, moneda, creado) VALUES (?, ?, ?, ?, ?, ?)').bind(sub, u, n.tipo, PRECIOS[n.tipo], MONEDA, Date.now()).run();
      return json({ ok: true, ...(await estadoPremium(env, db, u, false)), compra: n.tipo });
    }
  }
  return error('No existe', 404);
}

// ---- la página con los botones de PayPal (la abre la app en el navegador) ----
const fecha = (t) => new Date(t).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Argentina/Buenos_Aires' });
export function paginaPremium(env, { t, usuario, est, apiBase, origen }) {
  const n = hex(crypto.getRandomValues(new Uint8Array(16))), esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const ahorro = Math.round((1 - Number(PRECIOS.anio) / (12 * Number(PRECIOS.mes))) * 100), plata = (v) => 'US$ ' + String(v).replace('.', ',');
  const estado = !est.premium ? '' : est.tipo === 'vida' ? 'Ya sos Premium de por vida ✨' : est.estado === 'activa' ? `Ya sos Premium ✨ · se renueva el ${fecha(est.hasta - GRACIA)}` : `Sos Premium hasta el ${fecha(est.hasta)} (la diste de baja)`;
  const datos = JSON.stringify({ c: env.SZ_PAYPAL_CLIENT_ID, t, u: usuario.id, api: apiBase, planes: { mes: env.SZ_PAYPAL_PLAN_MES || '', anio: env.SZ_PAYPAL_PLAN_ANIO || '' }, est, sdk: sdkPP(env) }).replace(/</g, '\\u003c');
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer">
<title>Stickerazo Premium</title><style>
@font-face{font-family:L;src:url(${origen}/a/fuentes/LuckiestGuy.ttf)}
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;padding:20px 16px 40px;color:#f6f3fc;font:16px/1.5 system-ui,-apple-system,Roboto,sans-serif;
background:#0b0910 radial-gradient(60vmax 40vmax at 10% 0%,rgba(255,62,138,.35),transparent 70%) no-repeat,radial-gradient(50vmax 40vmax at 100% 100%,rgba(255,178,26,.25),transparent 70%) no-repeat}
.c{width:100%;max-width:460px;margin:0 auto}.logo{font:400 30px/1 L;text-align:center;transform:rotate(-3deg);margin:6px 0 4px}.logo span{color:#ff3e8a}.logo b{font-weight:400;color:#f5a800}
h1{font:400 30px/1.1 L;text-align:center;margin:14px 0 4px;background:linear-gradient(90deg,#ffe14d,#ffb21a,#ff3e8a);-webkit-background-clip:text;background-clip:text;color:transparent}
.yo{text-align:center;color:#d8d1e8;margin:0 0 16px;font-size:14.5px}.yo b{color:#fff}.est{text-align:center;color:#5fe39a;font-weight:800;margin:0 0 16px}
.ben{list-style:none;padding:14px 16px;margin:0 0 18px;border-radius:22px;background:rgba(255,255,255,.06);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1)}
.ben li{display:flex;gap:12px;padding:7px 0;align-items:flex-start}.ben i{font-style:normal;font-size:22px;line-height:1.2}.ben b{display:block}.ben small{color:#bdb5d0;font-size:13.5px}
.planes{display:grid;gap:10px;margin-bottom:14px}.plan{display:flex;align-items:center;gap:12px;width:100%;text-align:left;padding:14px 16px;border-radius:18px;border:2px solid rgba(255,255,255,.12);background:rgba(255,255,255,.04);color:inherit;font:inherit;cursor:pointer}
.plan.act{border-color:#ffd23f;background:rgba(255,210,63,.09)}.plan b{font-size:17px}.plan small{display:block;color:#bdb5d0;font-size:13px}.plan .p{margin-left:auto;font-weight:800;font-size:17px;white-space:nowrap}
.tag{display:inline-block;margin-left:6px;padding:2px 8px;border-radius:99px;background:#ff3e8a;color:#fff;font-size:11.5px;font-weight:800;vertical-align:2px}
.bot{min-height:50px;margin:6px 0 4px;color-scheme:light}.nota{color:#a79fbd;font-size:12.5px;text-align:center;margin:8px 0}.nota a{color:#ffd23f}
h2{font:400 22px/1 L;margin:28px 0 6px;text-align:center}.don{display:flex;gap:8px;justify-content:center;flex-wrap:wrap;margin:12px 0}
.don button,.don input{padding:11px 16px;border-radius:99px;border:2px solid rgba(255,255,255,.14);background:rgba(255,255,255,.05);color:#fff;font:700 16px system-ui;cursor:pointer}
.don button.act{border-color:#ffd23f;color:#ffd23f}.don input{width:120px;text-align:center}.ok{text-align:center;padding:40px 0}.ok h3{font:400 28px/1.15 L;margin:10px 0}.mal{color:#ff8a8a;text-align:center;font-weight:700;min-height:1.5em}
a.b{display:inline-block;margin-top:14px;color:#fff;text-decoration:none;font-weight:800;padding:14px 26px;border-radius:99px;background:linear-gradient(135deg,#ff3e8a,#ff7a1a)}
</style></head><body><div class="c" id="c"><div class="logo"><span>Sticker</span><b>azo</b></div>
<h1>Premium</h1><p class="yo">Para la cuenta <b>@${esc(usuario.nombre)}</b></p>${estado ? `<p class="est">${esc(estado)}</p>` : ''}
<ul class="ben">${BENEFICIOS.map(([i, b, s]) => `<li><i>${i}</i><span><b>${esc(b)}</b><small>${esc(s)}</small></span></li>`).join('')}</ul>
<div id="comprar"${est.premium ? ' hidden' : ''}><div class="planes" id="planes">
<button class="plan" data-p="mes"><span><b>Por mes</b><small>Se renueva solo. Lo das de baja cuando quieras.</small></span><span class="p">${plata(PRECIOS.mes)}</span></button>
<button class="plan act" data-p="anio"><span><b>Por año <span class="tag">Ahorrás ${ahorro} %</span></b><small>Un solo pago por año. Se renueva solo.</small></span><span class="p">${plata(PRECIOS.anio)}</span></button>
<button class="plan" data-p="vida"><span><b>De por vida</b><small>Un solo pago y listo, para siempre.</small></span><span class="p">${plata(PRECIOS.vida)}</span></button></div>
<div class="bot" id="bSub"></div><div class="bot" id="bVida" hidden></div>
<p class="nota">Los precios están en dólares; PayPal te muestra cuánto es en tu moneda antes de pagar. Las suscripciones se renuevan solas: para que no se cobre el período siguiente, dala de baja antes de la fecha de renovación (en la app: Perfil → Premium → Dar de baja). No hay devoluciones, salvo el arrepentimiento que da la ley: 10 días desde la primera compra (<a href="${origen}/terminos#premium">términos</a>).</p></div>
<h2>¿Querés donar? 💛</h2><p class="nota">Lo que quieras, una sola vez. Te llevás la insignia de Donador. Las donaciones no se devuelven.</p>
<div class="don" id="don"><button data-v="1">US$ 1</button><button data-v="3" class="act">US$ 3</button><button data-v="5">US$ 5</button><button data-v="10">US$ 10</button><input id="otro" inputmode="decimal" placeholder="Otro"></div>
<div class="bot" id="bDon"></div><p class="mal" id="mal"></p>
<p class="nota">Pagás en PayPal: Stickerazo no ve ni guarda tu tarjeta. <a href="${origen}/terminos">Términos</a> · <a href="${origen}/privacidad">Privacidad</a></p></div>
<script nonce="${n}">window.__D=${datos};</script>
<script nonce="${n}">(function(){var D=window.__D,$=function(i){return document.getElementById(i)},plan='anio',don='3';
function mal(e){$('mal').textContent=(e&&e.message)||'No se pudo. Probá de nuevo.'}
function post(r,b){b.t=D.t;return fetch(D.api+r,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)}).then(function(x){return x.json().then(function(j){if(!x.ok||j.ok===false)throw new Error(j.error||'No se pudo');return j})})}
function listo(j){var don=j.compra==='donacion';if(/Android/i.test(navigator.userAgent))setTimeout(function(){location.href='stickerazo://pack/premium'},2200);$('c').innerHTML='<div class="ok"><div style="font-size:60px">'+(don?'💛':'✨')+'</div><h3>'+(don?'¡Gracias por bancar Stickerazo!':'¡Ya sos Premium!')+'</h3><p>'+(don?'Ya tenés la insignia de Donador.':'Volvé a la app: se activa sola.')+'</p><a class="b" href="stickerazo://pack/premium">Volver a Stickerazo</a></div>'}
$('planes').onclick=function(ev){var b=ev.target.closest('[data-p]');if(!b)return;plan=b.dataset.p;[].forEach.call($('planes').children,function(x){x.classList.toggle('act',x===b)});$('bSub').hidden=plan==='vida';$('bVida').hidden=plan!=='vida'};
$('don').onclick=function(ev){var b=ev.target.closest('[data-v]');if(!b)return;don=b.dataset.v;$('otro').value='';[].forEach.call($('don').querySelectorAll('button'),function(x){x.classList.toggle('act',x===b)})};
$('otro').oninput=function(){don=$('otro').value.replace(',','.');[].forEach.call($('don').querySelectorAll('button'),function(x){x.classList.remove('act')})};
function cargar(q,ns){return new Promise(function(ok,no){var s=document.createElement('script');s.src=D.sdk+'?client-id='+encodeURIComponent(D.c)+'&currency=USD&components=buttons&disable-funding=paylater,credit'+q;s.setAttribute('data-namespace',ns);s.setAttribute('data-csp-nonce','${n}');s.nonce='${n}';s.onload=ok;s.onerror=no;document.head.appendChild(s)})}
var est={shape:'pill',height:48};
cargar('&intent=capture','ppPago').then(function(){
 if(!D.est.premium)ppPago.Buttons({style:Object.assign({label:'buynow'},est),createOrder:function(){$('mal').textContent='';return post('/pp/orden',{tipo:'vida'}).then(function(j){return j.id})},onApprove:function(d){return post('/pp/capturar',{orden:d.orderID}).then(listo)},onError:mal}).render('#bVida');
 ppPago.Buttons({style:Object.assign({label:'donate'},est),createOrder:function(){$('mal').textContent='';return post('/pp/orden',{tipo:'donacion',monto:don}).then(function(j){return j.id})},onApprove:function(d){return post('/pp/capturar',{orden:d.orderID}).then(listo)},onError:mal}).render('#bDon');
 if(D.est.premium||!D.planes.mes)return;
 return cargar('&vault=true&intent=subscription','ppSub').then(function(){ppSub.Buttons({style:Object.assign({label:'subscribe'},est),createSubscription:function(d,a){$('mal').textContent='';return a.subscription.create({plan_id:D.planes[plan],custom_id:D.u})},onApprove:function(d){return post('/pp/suscripcion',{sub:d.subscriptionID}).then(listo)},onError:mal}).render('#bSub')});
}).catch(function(){mal(new Error('No se pudo cargar PayPal. Fijate la conexión y recargá.'))});
})();</script></body></html>`;
  const pay = 'https://*.paypal.com https://*.paypalobjects.com', sdk = new URL(sdkPP(env)).origin;
  return new Response(html, { headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${n}' ${sdk} ${pay}; frame-src ${pay}; child-src ${pay}; connect-src 'self' ${new URL(apiBase).origin} ${sdk} ${pay}; style-src 'unsafe-inline' ${pay}; font-src ${new URL(origen).origin} ${pay}; img-src https: data:; form-action ${pay}`,
  } });
}
