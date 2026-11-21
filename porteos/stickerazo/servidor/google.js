// ---------------- entrar a Stickerazo con Google (obligatorio para la comunidad) ----------------
// Google no deja iniciar sesión adentro de una WebView, así que (como JXMod):
//  1. la app arma un verificador al azar v y abre en el navegador del celu  <servidor>/entrar?e=SHA256(v)
//  2. esa página (de un origen que Google tiene autorizado) muestra el botón de Google; Google le da un ID token con e
//     como «nonce» y la página lo manda a POST /api/google
//  3. acá se revisa la firma (claves públicas de Google), el emisor, la audiencia (el cliente de Google), el vencimiento y
//     el nonce, y queda una «entrada» esperando 10 minutos atada a e
//  4. la app pregunta cada segundo y medio en POST /api/google/listo con v: si SHA256(v) = e se lleva la sesión, una sola
//     vez (ver la dirección de la página no alcanza para llevársela). Si esa cuenta de Google todavía no tiene @, recibe un
//     «ticket» para elegirlo (POST /api/registro {nombre, ticket}); si la app ya tenía una cuenta vieja (sólo @), se le
//     vincula esta cuenta de Google.
// De Google se guarda lo mínimo: una huella del identificador de la cuenta (SHA-256 de «sz-google:» + sub). Ni el mail, ni
// el nombre, ni la foto de Google.
// También: borrar la cuenta desde la web (<servidor>/borrar, con Google) y el cliente de Google de la configuración
// (SZ_GOOGLE_CLIENT_ID, o el de JXMod: GOOGLE_CLIENT_ID). Sin cliente, Google queda apagado y vale el @ solo.
// En las pruebas: SZ_JWKS_PRUEBA (las claves públicas de mentira con las que firman sus tokens).
const enc = new TextEncoder();
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');
export const sha256 = async (s) => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s))));
const deB64u = (s) => { s = String(s).replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
export const clienteGoogle = (env) => (env && (env.SZ_GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_ID)) || '';
export const googleObligatorio = (env) => !!clienteGoogle(env);
export const huellaGoogle = (sub) => sha256('sz-google:' + sub);

let JWKS = null, jwksT = 0;
async function claves(env, forzar) {
  if (env.SZ_JWKS_PRUEBA) return JSON.parse(env.SZ_JWKS_PRUEBA).keys;
  if (JWKS && !forzar && Date.now() - jwksT < 3600e3) return JWKS;
  const r = await fetch('https://www.googleapis.com/oauth2/v3/certs', { cf: { cacheTtl: 3600 } });
  if (!r.ok) throw new Error('claves de Google: ' + r.status);
  JWKS = (await r.json()).keys || []; jwksT = Date.now(); return JWKS;
}
/** el ID token de Google, revisado (o null). nonce: el e de la entrada; recien: que sea de los últimos minutos */
export async function verificarGoogle(jwt, env, { nonce, recien } = {}) {
  const p = String(jwt || '').split('.'); if (p.length !== 3) return null;
  let cab, dat; try { cab = JSON.parse(new TextDecoder().decode(deB64u(p[0]))); dat = JSON.parse(new TextDecoder().decode(deB64u(p[1]))); } catch (e) { return null; }
  if (cab.alg !== 'RS256' || !cab.kid) return null;
  let k = (await claves(env)).find((x) => x.kid === cab.kid); if (!k && !env.SZ_JWKS_PRUEBA) k = (await claves(env, true)).find((x) => x.kid === cab.kid); if (!k) return null;
  const clave = await crypto.subtle.importKey('jwk', { kty: k.kty, n: k.n, e: k.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  if (!(await crypto.subtle.verify('RSASSA-PKCS1-v1_5', clave, deB64u(p[2]), enc.encode(p[0] + '.' + p[1])))) return null;
  const ahora = Date.now() / 1000;
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(dat.iss)) return null;
  if (dat.aud !== clienteGoogle(env)) return null;
  if (!(dat.exp > ahora - 60) || (dat.iat && dat.iat > ahora + 300)) return null;
  if (recien && !(dat.iat > ahora - recien)) return null;
  if (nonce !== undefined && dat.nonce !== nonce) return null;
  if (!dat.sub) return null;
  return dat;
}

// ---- las páginas con el botón de Google (entrar desde la app, y borrar la cuenta desde la web) ----
const TEXTOS = {
  entrar: { titulo: 'Entrá a Stickerazo', sub: 'Con tu cuenta de Google publicás tus packs, seguís gente y tu perfil queda guardado.',
    aviso: 'Si alguien te mandó este enlace, no sigas: es para el celular donde tocaste «Entrar con Google».',
    listo: '¡Listo{n}! Volvé a Stickerazo', listo2: 'Ya podés cerrar esta pestaña: la app entra sola.', boton: 'Volver a Stickerazo', vencido: 'Pasó mucho tiempo. Volvé a la app y tocá «Entrar con Google» de nuevo.' },
  borrar: { titulo: 'Borrar tu cuenta', sub: 'Entrá con la misma cuenta de Google que usás en Stickerazo y la borramos al instante, con todo lo tuyo.',
    aviso: 'Se borran tu perfil, tus packs publicados, tus me gusta, a quién seguís, tu foto y tu portada. No se puede deshacer.',
    listo: 'Listo{n}: tu cuenta se borró', listo2: 'Los stickers que tenés guardados en el celular quedan en tu celular.', boton: '', vencido: 'Probá de nuevo.' },
};
export function paginaGoogle(env, { modo, e, apiBase, origen }) {
  const T = TEXTOS[modo], n = hex(crypto.getRandomValues(new Uint8Array(16))), esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const datos = JSON.stringify({ c: clienteGoogle(env), e: e || '', modo, api: apiBase, T }).replace(/</g, '\\u003c');
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer">
<title>${esc(T.titulo)} · Stickerazo</title><style>
@font-face{font-family:L;src:url(${origen}/a/fuentes/LuckiestGuy.ttf)}
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:16px;color:#f6f3fc;font:16px/1.5 system-ui,-apple-system,Roboto,sans-serif;
background:#0b0910 radial-gradient(60vmax 40vmax at 10% 0%,rgba(255,62,138,.35),transparent 70%) no-repeat,radial-gradient(50vmax 40vmax at 100% 100%,rgba(124,77,255,.32),transparent 70%) no-repeat}
.c{width:100%;max-width:440px;text-align:center;padding:30px 24px;border-radius:28px;background:rgba(255,255,255,.06);box-shadow:inset 0 0 0 1px rgba(255,255,255,.1),0 30px 80px rgba(0,0,0,.5);backdrop-filter:blur(14px)}
.logo{font:400 34px/1 L;transform:rotate(-3deg);margin:4px 0 18px;text-shadow:3px 0 0 #fff,-3px 0 0 #fff,0 3px 0 #fff,0 -3px 0 #fff,2px 2px 0 #fff,-2px 2px 0 #fff,2px -2px 0 #fff,-2px -2px 0 #fff,0 8px 20px rgba(255,62,138,.5)}
.logo span{color:#ff3e8a}.logo b{font-weight:400;color:#f5a800}h1{font-size:22px;margin:0 0 6px}p{margin:8px 0;color:#d8d1e8}.av{font-size:13.5px;color:#ffd23f;margin-top:18px}
#g{display:flex;justify-content:center;margin:22px 0 6px;min-height:46px}.ok{color:#5fe39a;font-size:20px;font-weight:800}.mal{color:#ff8a8a}
a.b{display:inline-block;margin-top:16px;color:#fff;text-decoration:none;font-weight:800;padding:14px 26px;border-radius:99px;background:linear-gradient(135deg,#ff3e8a,#ff7a1a);box-shadow:0 10px 30px rgba(255,62,138,.4)}</style></head>
<body><div class="c"><div class="logo"><span>Sticker</span><b>azo</b></div><h1>${esc(T.titulo)}</h1><p id="s">${esc(T.sub)}</p><div id="g"></div><p class="av" id="a">${esc(T.aviso)}</p></div>
<script nonce="${n}">window.__D=${datos};</script>
<script nonce="${n}">(function(){var D=window.__D,T=D.T,$=function(i){return document.getElementById(i)};
function fin(t,c){$('g').innerHTML='';$('a').textContent='';var s=$('s');s.textContent=t;s.className=c||''}
function listo(nom){fin(T.listo.replace('{n}',nom?', @'+nom:''),'ok');var p=document.createElement('p');p.textContent=T.listo2;$('s').after(p);
 if(T.boton){var a=document.createElement('a');a.className='b';a.href='stickerazo://pack/entrar';a.textContent=T.boton;p.after(a)}}
if(!D.c){fin('Entrar con Google todavía no está prendido.','mal');return}
window.__cb=function(r){fin('…');fetch(D.api+(D.modo==='borrar'?'/google/borrar':'/google'),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({credencial:r.credential,e:D.e})})
 .then(function(x){return x.json()}).then(function(j){if(j&&j.ok)listo(j.nombre);else fin((j&&j.error)||T.vencido,'mal')}).catch(function(){fin('No se pudo. Probá de nuevo.','mal')})};
window.__ini=function(){var o={client_id:D.c,callback:window.__cb,ux_mode:'popup',auto_select:false,cancel_on_tap_outside:false,itp_support:true};if(D.e)o.nonce=D.e;google.accounts.id.initialize(o);
 google.accounts.id.renderButton($('g'),{theme:'filled_black',size:'large',shape:'pill',text:'continue_with',locale:'es-419',width:290})};
var s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.nonce='${n}';s.onload=window.__ini;s.onerror=function(){fin('No se pudo cargar Google. Probá de nuevo.','mal')};document.head.appendChild(s)})();</script></body></html>`;
  return new Response(html, { headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${n}' https://accounts.google.com/gsi/client; frame-src https://accounts.google.com/gsi/; connect-src 'self' ${origen.replace(/\/sz$/, '')} https://accounts.google.com/gsi/; style-src 'unsafe-inline' https://accounts.google.com/gsi/style; font-src ${origen.replace(/\/sz$/, '')}; img-src https: data:`,
  } });
}
