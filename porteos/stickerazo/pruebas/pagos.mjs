// Premium, la compra «de por vida» y las donaciones, punta a punta: el Worker de verdad (sobre SQLite) contra un PayPal
// de mentira en la compu (la misma API: permiso, órdenes, cobro, suscripciones y baja). Se prueba lo que haría un vivo:
// montos cambiados, órdenes de otra cuenta, suscripciones de otro plan o de otra cuenta, enlaces vencidos, cobrar dos
// veces la misma orden; y la baja, la renovación, el pase a «de por vida» y borrar la cuenta.
// uso: node pagos.mjs   (con SZ_BASE=/sz: como adentro del Worker de JXMod, con las tablas «sz_»)
import http from 'http'; import { arrancar } from './servidor_local.mjs';
const PP = 8961, PUERTO = 8962, BASE = process.env.SZ_BASE || '', B = `http://127.0.0.1:${PUERTO}${BASE}`, T = BASE ? 'sz_' : '';
let fallas = 0, bien = 0; const ok = (c, t) => { console.log((c ? 'OK    ' : 'FALLA ') + t); c ? bien++ : fallas++; };
const DIA = 86400e3;

// ---- el PayPal de mentira ----
const F = { ordenes: new Map(), subs: new Map(), bajas: [], truchar: null, n: 0, permisos: 0 };
const ppSrv = http.createServer(async (q, r) => {
  const partes = []; for await (const c of q) partes.push(c); let cuerpo = {}; try { cuerpo = JSON.parse(Buffer.concat(partes).toString() || "{}"); } catch (e) { /* el permiso viene como formulario */ }
  const dar = (st, j) => { r.writeHead(st, { 'Content-Type': 'application/json' }); r.end(j === undefined ? '' : JSON.stringify(j)); };
  const u = new URL(q.url, 'http://x'); let m;
  if (u.pathname === '/v1/oauth2/token') { F.permisos++; return q.headers.authorization === 'Basic ' + Buffer.from('cid:sec').toString('base64') ? dar(200, { access_token: 'tok-ok', expires_in: 32400 }) : dar(401, { error: 'invalid_client' }); }
  if (q.headers.authorization !== 'Bearer tok-ok') return dar(401, {});
  if (u.pathname === '/v2/checkout/orders' && q.method === 'POST') { const id = 'ORD' + String(++F.n).padStart(8, '0'); F.ordenes.set(id, { id, status: 'CREATED', pu: cuerpo.purchase_units[0] }); return dar(201, { id, status: 'CREATED' }); }
  const repr = (o) => ({ id: o.id, status: o.status, purchase_units: [{ reference_id: o.pu.reference_id, payments: o.cap ? { captures: [o.cap] } : undefined }] });
  if ((m = /^\/v2\/checkout\/orders\/([A-Z0-9]+)\/capture$/.exec(u.pathname))) {
    const o = F.ordenes.get(m[1]); if (!o) return dar(404, {}); if (o.status === 'COMPLETED') return dar(422, { name: 'UNPROCESSABLE_ENTITY', details: [{ issue: 'ORDER_ALREADY_CAPTURED' }] });
    o.status = 'COMPLETED'; o.cap = { id: 'CAP' + F.n, status: 'COMPLETED', custom_id: o.pu.custom_id, amount: { currency_code: o.pu.amount.currency_code, value: F.truchar || o.pu.amount.value } }; F.truchar = null;
    return dar(201, repr(o));
  }
  if ((m = /^\/v2\/checkout\/orders\/([A-Z0-9]+)$/.exec(u.pathname))) { const o = F.ordenes.get(m[1]); return o ? dar(200, repr(o)) : dar(404, {}); }
  if ((m = /^\/v1\/billing\/subscriptions\/(I-[A-Z0-9]+)\/cancel$/.exec(u.pathname))) { const s = F.subs.get(m[1]); if (!s) return dar(404, {}); if (s.status === 'CANCELLED') return dar(422, {}); s.status = 'CANCELLED'; F.bajas.push(m[1]); return dar(204); }
  if ((m = /^\/v1\/billing\/subscriptions\/(I-[A-Z0-9]+)$/.exec(u.pathname))) { const s = F.subs.get(m[1]); return s ? dar(200, { id: m[1], status: s.status, plan_id: s.plan, custom_id: s.cuenta, billing_info: s.status === 'ACTIVE' ? { next_billing_time: new Date(s.prox).toISOString() } : {} }) : dar(404, { name: 'RESOURCE_NOT_FOUND' }); }
  dar(404, {});
}).listen(PP);
const conPP = { SZ_PAYPAL_CLIENT_ID: 'cid', SZ_PAYPAL_SECRET: 'sec', SZ_PAYPAL_API: `http://127.0.0.1:${PP}`, SZ_PAYPAL_PLAN_MES: 'P-MES', SZ_PAYPAL_PLAN_ANIO: 'P-ANIO' };
const { srv, env: ENV } = await arrancar(PUERTO, 'clave-admin', conPP);
const db = (sql, ...a) => ENV.DB.prepare(sql.replace(/\b(usuarios|premium|pagos|tickets_pago|limites|ofertas)\b/g, T + '$1')).bind(...a);
const api = async (ruta, o = {}, tok, base = B) => { const h = { ...(o.headers || {}) }; if (tok) h.Authorization = 'Bearer ' + tok; if (o.json) { h['Content-Type'] = 'application/json'; o.body = JSON.stringify(o.json); } const r = await fetch(base + ruta, { ...o, headers: h }); const tx = await r.text(); let j = null; try { j = JSON.parse(tx); } catch (e) { /* html */ } return { st: r.status, j, tx, h: r.headers }; };
// (las altas desde una misma compu tienen límite por hora: en la prueba se limpia antes de cada una)
const cuenta = async (n) => { await db('DELETE FROM limites').run(); const r = await api('/api/registro', { method: 'POST', json: { nombre: n } }); return { tok: r.j.token, id: r.j.usuario.id, nombre: r.j.usuario.nombre }; };
const ticket = async (c) => new URL((await api('/api/premium/ticket', { method: 'POST' }, c.tok)).j.url).searchParams.get('t');
const pagar = async (t, tipo, monto) => { const o = await api('/api/pp/orden', { method: 'POST', json: { t, tipo, monto } }); if (!o.j || !o.j.id) return { orden: o }; return { orden: o, cobro: await api('/api/pp/capturar', { method: 'POST', json: { t, orden: o.j.id } }) }; };
const estado = async (c) => (await api('/api/premium', {}, c.tok)).j;

// ---- sin las claves de PayPal: todo apagado ----
// (las mismas cuentas y el mismo servidor, sin las claves)
const x = (await api('/api/registro', { method: 'POST', json: { nombre: 'apagado' } })).j; delete ENV.SZ_PAYPAL_CLIENT_ID;
const e0 = await api('/api/premium', {}, x.token), t0 = await api('/api/premium/ticket', { method: 'POST' }, x.token), p0 = await api('/premium?t=x');
ENV.SZ_PAYPAL_CLIENT_ID = 'cid';
ok(e0.st === 200 && e0.j.disponible === false && e0.j.yo.premium === false && e0.j.beneficios.length >= 4 && t0.st === 503 && p0.st === 503, 'sin las claves de PayPal: Premium se muestra como «muy pronto» y no se puede pagar');

// ---- con PayPal ----
const A = await cuenta('pagador'), Bc = await cuenta('otra.cuenta');
const e1 = await estado(A);
ok(e1.disponible && e1.precios.vida === '29.99' && e1.moneda === 'USD' && e1.yo.premium === false && e1.yo.donador === false, `prendido: precios ${e1.precios.mes} / ${e1.precios.anio} / ${e1.precios.vida} ${e1.moneda}, la cuenta sin Premium`);
const sinCuenta = await api('/api/premium/ticket', { method: 'POST' });
const tA = await ticket(A), tB = await ticket(Bc);
ok(sinCuenta.st === 401 && /^[A-Za-z0-9_-]{43}$/.test(tA) && tA !== tB, 'el ticket para la página: sólo con la cuenta, al azar y distinto para cada una');
const pg = await api('/premium?t=' + tA), pgMal = await api('/premium?t=' + 'x'.repeat(43));
const csp = pg.h.get('content-security-policy') || '';
ok(pg.st === 200 && pg.tx.includes('@pagador') && pg.tx.includes('"c":"cid"') && pg.tx.includes('P-ANIO') && /script-src 'nonce-[a-f0-9]{32}'/.test(csp) && csp.includes('paypal.com') && pg.h.get('cache-control') === 'no-store' && pg.h.get('x-frame-options') === 'DENY' && pgMal.st === 401,
  'la página de PayPal: para @pagador, con los planes, CSP con nonce y PayPal, sin caché ni marcos; con un ticket que no existe, «venció»');

// donación
const d1 = await pagar(tA, 'donacion', 0.5), d2 = await pagar(tA, 'donacion', 500), d3 = await pagar(tA, 'donacion', '3');
ok(d1.orden.st === 400 && d2.orden.st === 400 && d3.cobro.st === 200 && d3.cobro.j.compra === 'donacion' && d3.cobro.j.donador === true && d3.cobro.j.premium === false, 'donación: menos de US$ 1 o más de 200, no; US$ 3 → cobrada, insignia de Donador (y no da Premium)');
const otraVez = await api('/api/pp/capturar', { method: 'POST', json: { t: tA, orden: d3.orden.j.id } }), nPagos = (await db('SELECT COUNT(*) AS n FROM pagos WHERE usuario = ?', A.id).first()).n;
ok(otraVez.st === 200 && nPagos === 1, 'la misma orden dos veces (se cortó la conexión, tocó de nuevo): se anota una sola vez');
const robada = await api('/api/pp/capturar', { method: 'POST', json: { t: tB, orden: d3.orden.j.id } });
ok(robada.st === 409, 'la orden de otra cuenta, con mi ticket: no');

// «de por vida» con el monto cambiado (como si alguien tocara el pago): no se activa
F.truchar = '0.01'; const v1 = await pagar(tA, 'vida');
ok(v1.cobro.st === 409 && !(await estado(A)).yo.premium && (await db('SELECT COUNT(*) AS n FROM pagos WHERE usuario = ?', A.id).first()).n === 1, 'si lo cobrado no es el precio (US$ 0,01 en vez de 29,99): no se activa nada ni se anota');
// una orden hecha para A, cobrada con el ticket de B
const oA = await api('/api/pp/orden', { method: 'POST', json: { t: tA, tipo: 'vida' } }), cB = await api('/api/pp/capturar', { method: 'POST', json: { t: tB, orden: oA.j.id } });
ok(cB.st === 409 && !(await estado(Bc)).yo.premium, 'una orden armada para otra cuenta: no le da Premium a quien la cobra');

// suscripción por mes
const prox = Date.now() + 30 * DIA;
F.subs.set('I-MES0000001', { status: 'ACTIVE', plan: 'P-MES', cuenta: A.id, prox });
F.subs.set('I-AJENA00001', { status: 'ACTIVE', plan: 'P-MES', cuenta: Bc.id, prox });
F.subs.set('I-OTROPLAN01', { status: 'ACTIVE', plan: 'P-DE-OTRA-APP', cuenta: A.id, prox });
F.subs.set('I-PENDIENTE1', { status: 'APPROVAL_PENDING', plan: 'P-MES', cuenta: A.id, prox });
const sAj = await api('/api/pp/suscripcion', { method: 'POST', json: { t: tA, sub: 'I-AJENA00001' } }), sOp = await api('/api/pp/suscripcion', { method: 'POST', json: { t: tA, sub: 'I-OTROPLAN01' } }), sPe = await api('/api/pp/suscripcion', { method: 'POST', json: { t: tA, sub: 'I-PENDIENTE1' } });
ok(sAj.st === 409 && sOp.st === 409 && sPe.st === 409 && !(await estado(A)).yo.premium, 'suscripciones de otra cuenta, de otro plan o sin aprobar: no');
const s1 = await api('/api/pp/suscripcion', { method: 'POST', json: { t: tA, sub: 'I-MES0000001' } }), e2 = await estado(A);
ok(s1.st === 200 && e2.yo.premium && e2.yo.tipo === 'mes' && e2.yo.estado === 'activa' && Math.abs(e2.yo.hasta - (prox + 3 * DIA)) < 5000, 'suscripción por mes confirmada con PayPal: Premium hasta el próximo cobro (+3 días de margen)');
const perfil = (await api('/api/usuarios/pagador')).j.usuario;
ok(perfil.premium === true && perfil.donador === true, 'el perfil público muestra ✨ Premium y 💛 Donador');
// más lugar en la nube (con Google conectado)
await db('UPDATE usuarios SET google = ? WHERE id = ?', 'g-' + A.id, A.id).run();
const nube = (await api('/api/nube', {}, A.tok)).j;
ok(nube.cupo === 250 * 1024 * 1024 && nube.premium === true, `nube: con Premium, ${nube.cupo / 1048576} MB (en vez de 25)`);
// la página ya no ofrece pagar Premium (sí donar)
const pg2 = await api('/premium?t=' + tA);
ok(/Ya sos Premium/.test(pg2.tx) && /id="comprar" hidden/.test(pg2.tx), 'la página, con Premium: dice hasta cuándo y esconde los planes (donar sigue)');

// la renovación: cuando está por vencer, se pregunta a PayPal
F.subs.get('I-MES0000001').prox = Date.now() + 61 * DIA; await db('UPDATE premium SET revisado = 0 WHERE usuario = ?', A.id).run();
const e3 = await estado(A);
ok(Math.abs(e3.yo.hasta - (Date.now() + 64 * DIA)) < 10000, 'se renovó: al día siguiente se revisa con PayPal y sigue hasta el próximo cobro');

// la baja (el botón de baja): PayPal deja de cobrar y el Premium dura hasta el final de lo pagado
const baja = await api('/api/premium/baja', { method: 'POST' }, A.tok), e4 = await estado(A);
ok(baja.st === 200 && F.bajas.includes('I-MES0000001') && e4.yo.estado === 'cancelada' && e4.yo.premium && Math.abs(e4.yo.hasta - e3.yo.hasta) < 1000, 'dar de baja: PayPal deja de cobrar y el Premium sigue hasta el final de lo pagado');
const baja2 = await api('/api/premium/baja', { method: 'POST' }, A.tok);
ok(baja2.st === 409, '…y no se da de baja dos veces');
await db('UPDATE premium SET hasta = ? WHERE usuario = ?', Date.now() - 1000, A.id).run(); await db('UPDATE usuarios SET premium_hasta = ? WHERE id = ?', Date.now() - 1000, A.id).run();
const e5 = await estado(A), perfil2 = (await api('/api/usuarios/pagador')).j.usuario;
ok(!e5.yo.premium && e5.yo.donador && perfil2.premium === false && perfil2.donador === true, 'al pasar la fecha, deja de ser Premium (la insignia de Donador queda)');

// cambiar de plan y pasar a «de por vida»: lo anterior se da de baja solo
const C = await cuenta('cambia.plan'), tC = await ticket(C);
F.subs.set('I-MESC000001', { status: 'ACTIVE', plan: 'P-MES', cuenta: C.id, prox });
F.subs.set('I-ANIOC00001', { status: 'ACTIVE', plan: 'P-ANIO', cuenta: C.id, prox: Date.now() + 365 * DIA });
await api('/api/pp/suscripcion', { method: 'POST', json: { t: tC, sub: 'I-MESC000001' } }); await api('/api/pp/suscripcion', { method: 'POST', json: { t: tC, sub: 'I-ANIOC00001' } });
ok(F.bajas.includes('I-MESC000001') && (await estado(C)).yo.tipo === 'anio', 'pasar de mensual a anual: la mensual se da de baja sola');
const vC = await pagar(tC, 'vida'), eC = await estado(C);
ok(vC.cobro.st === 200 && eC.yo.tipo === 'vida' && eC.yo.premium && new Date(eC.yo.hasta).getFullYear() >= 2099 && F.bajas.includes('I-ANIOC00001'), '«de por vida» (US$ 29,99): Premium para siempre y la anual se da de baja sola');
const vC2 = await api('/api/pp/orden', { method: 'POST', json: { t: tC, tipo: 'vida' } });
ok(vC2.st === 409, 'no se puede comprar «de por vida» dos veces');

// devoluciones: si la compra «de por vida» figura devuelta en PayPal (o con contracargo), el Premium se va solo
const R = await cuenta('devolvio'), tR = await ticket(R), vR = await pagar(tR, 'vida');
ok(vR.cobro.st === 200 && (await estado(R)).yo.premium, '«de por vida» comprada');
F.ordenes.get(vR.orden.j.id).cap.status = 'REFUNDED'; await db('UPDATE premium SET revisado = 0 WHERE usuario = ?', R.id).run();
const eR = await estado(R), pR = (await api('/api/usuarios/devolvio')).j.usuario;
ok(!eR.yo.premium && eR.yo.estado === 'reembolsada' && pR.premium === false, 'si la plata se devolvió (arrepentimiento o contracargo), el Premium se quita solo');
// a mano desde el panel: quita el Premium y da de baja la suscripción
const Q = Bc, tQ = await ticket(Q);   // (las altas por compu tienen límite: se usa una cuenta que ya está)
F.subs.set('I-QUITAR0001', { status: 'ACTIVE', plan: 'P-MES', cuenta: Q.id, prox });
await api('/api/pp/suscripcion', { method: 'POST', json: { t: tQ, sub: 'I-QUITAR0001' } });
const qNo = await api('/api/admin/premium', { method: 'POST', json: { nombre: '@otra.cuenta' } }), qSi = await api('/api/admin/premium', { method: 'POST', json: { nombre: '@otra.cuenta' }, headers: { 'X-Admin': 'clave-admin' } });
ok(qNo.st === 403 && qSi.st === 200 && F.bajas.includes('I-QUITAR0001') && !(await estado(Q)).yo.premium, 'el panel quita el Premium a mano y da de baja la suscripción (sin la clave, no)');

// el enlace vence (2 horas)
await db('UPDATE tickets_pago SET vence = 0').run();
const venc = await api('/api/pp/orden', { method: 'POST', json: { t: tB, tipo: 'donacion', monto: 2 } });
ok(venc.st === 401 && /venció/.test(venc.j.error), 'el enlace de la página vence a las 2 horas');

// borrar la cuenta: la suscripción se da de baja y los pagos quedan sin nombre
const D = await cuenta('se.va'), tD = await ticket(D);
F.subs.set('I-BORRA00001', { status: 'ACTIVE', plan: 'P-MES', cuenta: D.id, prox });
await api('/api/pp/suscripcion', { method: 'POST', json: { t: tD, sub: 'I-BORRA00001' } });
const borr = await api('/api/yo', { method: 'DELETE' }, D.tok);
ok(borr.st === 200 && F.bajas.includes('I-BORRA00001') && !(await db('SELECT 1 FROM pagos WHERE usuario = ?', D.id).first()) && (await db("SELECT COUNT(*) AS n FROM pagos WHERE usuario = 'borrada'").first()).n === 1 && !(await db('SELECT 1 FROM premium WHERE usuario = ?', D.id).first()),
  'borrar la cuenta: la suscripción se da de baja en PayPal y lo cobrado queda anotado sin nombre');

// el panel: lo cobrado
const adm = await api('/api/admin/pagos', { headers: { 'X-Admin': 'clave-admin' } }), admNo = await api('/api/admin/pagos');
const tot = Object.fromEntries(adm.j.totales.map((x) => [x.tipo, x.n]));
ok(adm.st === 200 && admNo.st === 403 && tot.donacion === 1 && tot.mes === 4 && tot.anio === 1 && tot.vida === 2, `el panel ve lo cobrado (${adm.j.totales.map((x) => `${x.tipo} ${x.n}`).join(', ')}); sin la clave, no`);
ok(F.permisos <= 2, `el permiso de PayPal se pide una vez y se reusa (${F.permisos})`);

// ---- la oferta de bienvenida: de verdad, la cobra el servidor, y una sola vez por cuenta ----
const O = await cuenta('oferta'), eO0 = await estado(O);
ok(eO0.yo.oferta === null && eO0.yo.ofertaNueva === true, 'cuenta nueva: la oferta todavía no arrancó');
const of1 = await api('/api/premium/oferta', { method: 'POST' }, O.tok), of2 = await api('/api/premium/oferta', { method: 'POST' }, O.tok), hO = of1.j && of1.j.oferta && of1.j.oferta.hasta;
ok(of1.st === 200 && of1.j.oferta.vida === '19.99' && of1.j.oferta.antes === '29.99' && Math.abs(hO - (Date.now() + 48 * 3600e3)) < 60e3 && of2.j.oferta.hasta === hO, 'al mostrarla arranca: US$ 19,99 (antes 29,99) por 48 h, y no se reinicia');
const tO = await ticket(O), vO = await pagar(tO, 'vida');
ok(vO.orden.st === 200 && F.ordenes.get(vO.orden.j.id).pu.amount.value === '19.99' && vO.cobro.st === 200 && (await estado(O)).yo.tipo === 'vida', 'con la oferta, la orden de PayPal es de 19,99 y Premium de por vida se activa');
ok((await api('/api/premium/oferta', { method: 'POST' }, O.tok)).st === 409 && (await estado(O)).yo.oferta === null, 'ya Premium: no hay más oferta');
const O2 = await cuenta('oferta.vencida'); await api('/api/premium/oferta', { method: 'POST' }, O2.tok);
await db('UPDATE ofertas SET hasta = ? WHERE usuario = ?', Date.now() - 1000, O2.id).run();
const eO2 = await estado(O2), tO2 = await ticket(O2), oO2 = await api('/api/pp/orden', { method: 'POST', json: { t: tO2, tipo: 'vida' } }), re = await api('/api/premium/oferta', { method: 'POST' }, O2.tok);
ok(eO2.yo.oferta === null && eO2.yo.ofertaNueva === false && F.ordenes.get(oO2.j.id).pu.amount.value === '29.99' && !re.j.oferta, 'vencida: no aparece más, no vuelve a arrancar y la orden es de 29,99');
await db('UPDATE ofertas SET hasta = ? WHERE usuario = ?', Date.now() - 3 * 3600e3, O2.id).run();
F.truchar = '19.99'; const vO2 = await pagar(tO2, 'vida');
ok(vO2.cobro.st === 409 && !(await estado(O2)).yo.premium, 'cobrar 19,99 con la oferta vencida hace más de 2 h: no se activa');
console.log(`RESUMEN: ${bien} bien, ${fallas} fallas`);
srv.close(); ppSrv.close(); process.exit(fallas ? 1 : 0);
