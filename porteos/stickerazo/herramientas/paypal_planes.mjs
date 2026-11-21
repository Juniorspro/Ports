// Crea en PayPal el producto «Stickerazo Premium» y los 2 planes de la suscripción (por mes y por año), con los precios
// de servidor/pagos.js, y dice qué poner en Cloudflare para prender Premium. Se corre una sola vez (y otra si cambian
// los precios: los planes viejos siguen cobrando a quien ya estaba suscripto).
// Las claves de la app de PayPal (developer.paypal.com → Apps & Credentials) se leen de un archivo FUERA del repo, con
// el Client ID en la primera línea y el Secret en la segunda:
// uso: node herramientas/paypal_planes.mjs /root/.paypal/claves.txt [live]   (sin «live»: sandbox, plata de mentira)
import { readFileSync } from 'node:fs';
import { PRECIOS, MONEDA } from '../servidor/pagos.js';
const [, , archivo, modo] = process.argv;
if (!archivo) { console.error('uso: node herramientas/paypal_planes.mjs ARCHIVO_CON_LAS_CLAVES [live]'); process.exit(1); }
const [id, secreto] = readFileSync(archivo, 'utf8').trim().split(/\s+/);
const API = modo === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
const tk = await (await fetch(API + '/v1/oauth2/token', { method: 'POST', body: 'grant_type=client_credentials',
  headers: { Authorization: 'Basic ' + Buffer.from(id + ':' + secreto).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' } })).json();
if (!tk.access_token) { console.error('PayPal no aceptó las claves:', tk.error_description || tk.error); process.exit(1); }
const pp = async (ruta, cuerpo) => { const r = await fetch(API + ruta, { method: 'POST', headers: { Authorization: 'Bearer ' + tk.access_token, 'Content-Type': 'application/json', Prefer: 'return=representation' }, body: JSON.stringify(cuerpo) }); const j = await r.json(); if (!r.ok) throw new Error(ruta + ': ' + JSON.stringify(j)); return j; };
const prod = await pp('/v1/catalogs/products', { name: 'Stickerazo Premium', type: 'SERVICE', category: 'SOFTWARE', description: 'Sin anuncios, insignia, más lugar para tus packs y anillo dorado en Stickerazo.' });
const plan = (nombre, unidad, precio) => pp('/v1/billing/plans', { product_id: prod.id, name: nombre, status: 'ACTIVE',
  billing_cycles: [{ frequency: { interval_unit: unidad, interval_count: 1 }, tenure_type: 'REGULAR', sequence: 1, total_cycles: 0, pricing_scheme: { fixed_price: { value: precio, currency_code: MONEDA } } }],
  payment_preferences: { auto_bill_outstanding: true, payment_failure_threshold: 2 } });
const mes = await plan('Stickerazo Premium por mes', 'MONTH', PRECIOS.mes), anio = await plan('Stickerazo Premium por año', 'YEAR', PRECIOS.anio);
console.log(`Listo (${modo === 'live' ? 'de verdad' : 'sandbox'}). En porteos/jxmod/tienda/wrangler.toml, en [vars]:
  SZ_PAYPAL_CLIENT_ID = "${id}"
  SZ_PAYPAL_PLAN_MES = "${mes.id}"
  SZ_PAYPAL_PLAN_ANIO = "${anio.id}"${modo === 'live' ? '\n  SZ_PAYPAL_MODO = "live"' : ''}
y el secreto (no va en el repo): npx wrangler secret put SZ_PAYPAL_SECRET`);
