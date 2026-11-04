// ---------------- cuentas de JXMod con Google: para jugar en multijugador y guardar el progreso en la nube ----------------
// Sirve igual en la página web y en la app, sin importar desde dónde se abrió el juego (un archivo, la app, otra página):
//  1. el juego arma un verificador al azar v y abre /api/cuenta/entrar?e=SHA256(v) (en la app, en el navegador del celular,
//     porque Google no deja iniciar sesión dentro de una WebView)
//  2. esa página, de este worker (es el único origen que hay que autorizar en Google), muestra el botón de Google
//  3. Google le da a la página un ID token con e como nonce; la página lo manda a /api/cuenta/google y acá se verifica la
//     firma (claves públicas de Google), el emisor, la audiencia (GOOGLE_CLIENT_ID), el vencimiento y el nonce; se crea o
//     actualiza el usuario y una sesión, que queda esperando 10 minutos atada a e
//  4. el juego pregunta cada segundo y medio en /api/cuenta/listo con v: si SHA256(v) = e se lleva la sesión, una sola vez
//     (ver la dirección de la página no alcanza para llevársela)
// La sesión es un token al azar de 32 bytes del que acá sólo se guarda la huella; dura 90 días y se renueva al usarse.
// Del usuario se guarda lo mínimo: el id de Google (sub), el nombre y la foto. Sin GOOGLE_CLIENT_ID todo esto queda
// apagado (config dice google: false) y el juego no pide iniciar sesión.
// El progreso: claves sueltas (construcciones, noches, datos de mods...) con su fecha; al subir gana la más nueva de cada
// una, así dos aparatos de la misma cuenta no se pisan. Topes: 512 KB por clave y 4 MB por cuenta.
const DIA = 86400e3, SESION_DIAS = 90, MAX_CLAVE = 512 * 1024, MAX_CUENTA = 4 * 1024 * 1024;
const enc = new TextEncoder();
const hex = (u8) => [...u8].map((b) => b.toString(16).padStart(2, '0')).join('');
const sha = async (s) => hex(new Uint8Array(await crypto.subtle.digest('SHA-256', enc.encode(s))));
const b64u = (s) => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
const azarHex = (n) => hex(crypto.getRandomValues(new Uint8Array(n)));
const limpiar = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);

let tablasListas = false;
async function tablas(env) {
  if (tablasListas) return;
  await env.DB.batch([
    env.DB.prepare('CREATE TABLE IF NOT EXISTS usuarios (id TEXT PRIMARY KEY, sub TEXT UNIQUE, nombre TEXT, foto TEXT, creado INTEGER, visto INTEGER)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS sesiones (h TEXT PRIMARY KEY, usuario TEXT, creada INTEGER, vence INTEGER)'),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS i_ses_usuario ON sesiones(usuario)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS entradas (e TEXT PRIMARY KEY, token TEXT, usuario TEXT, vence INTEGER, ip TEXT)'),
    env.DB.prepare('CREATE TABLE IF NOT EXISTS progreso (usuario TEXT, k TEXT, v TEXT, fecha INTEGER, PRIMARY KEY (usuario, k))'),
  ]);
  tablasListas = true;
}

// ---- el ID token de Google ----
let JWKS = null, jwksT = 0;
async function clavesGoogle(forzar) {
  if (JWKS && !forzar && Date.now() - jwksT < 3600e3) return JWKS;
  const r = await fetch('https://www.googleapis.com/oauth2/v3/certs', { cf: { cacheTtl: 3600 } });
  if (!r.ok) throw new Error('claves de Google: ' + r.status);
  JWKS = (await r.json()).keys || []; jwksT = Date.now(); return JWKS;
}
async function verificarGoogle(jwt, env, nonce) {
  const p = String(jwt || '').split('.'); if (p.length !== 3) return null;
  let cab, dat; try { cab = JSON.parse(new TextDecoder().decode(b64u(p[0]))); dat = JSON.parse(new TextDecoder().decode(b64u(p[1]))); } catch (e) { return null; }
  if (cab.alg !== 'RS256' || !cab.kid) return null;
  let k = (await clavesGoogle()).find((x) => x.kid === cab.kid); if (!k) k = (await clavesGoogle(true)).find((x) => x.kid === cab.kid); if (!k) return null;
  const clave = await crypto.subtle.importKey('jwk', { kty: k.kty, n: k.n, e: k.e, alg: 'RS256', ext: true }, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', clave, b64u(p[2]), enc.encode(p[0] + '.' + p[1])); if (!ok) return null;
  const ahora = Date.now() / 1000;
  if (!['accounts.google.com', 'https://accounts.google.com'].includes(dat.iss)) return null;
  if (dat.aud !== env.GOOGLE_CLIENT_ID) return null;
  if (!(dat.exp > ahora - 60) || (dat.iat && dat.iat > ahora + 300)) return null;
  if (nonce && dat.nonce !== nonce) return null;
  if (!dat.sub) return null;
  return dat;
}

// ---- la sesión del pedido (Authorization: Bearer <token>) ----
async function sesionDe(req, env) {
  const m = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.get('Authorization') || ''); if (!m) return null;
  await tablas(env);
  const h = await sha('s' + m[1]), s = await env.DB.prepare('SELECT s.usuario, s.vence, u.nombre, u.foto FROM sesiones s JOIN usuarios u ON u.id = s.usuario WHERE s.h = ?1').bind(h).first();
  if (!s || s.vence < Date.now()) return null;
  // (se renueva al usarse, como mucho una vez por día)
  if (s.vence - Date.now() < (SESION_DIAS - 1) * DIA) await env.DB.batch([env.DB.prepare('UPDATE sesiones SET vence = ?2 WHERE h = ?1').bind(h, Date.now() + SESION_DIAS * DIA), env.DB.prepare('UPDATE usuarios SET visto = ?2 WHERE id = ?1').bind(s.usuario, Date.now())]);
  return { id: s.usuario, nombre: s.nombre, foto: s.foto };
}
export const cuentaActiva = (env) => !!(env && env.GOOGLE_CLIENT_ID);
// para otras rutas (crear un server): el usuario de la sesión, o null
export async function cuentaUsuario(req, env) { try { return cuentaActiva(env) ? await sesionDe(req, env) : null; } catch (e) { return null; } }

// ---- la página de entrada ----
const TX = {
  es: ['Iniciar sesión en JXMod', 'Con tu cuenta de Google jugás en multijugador y tu progreso queda guardado.', 'Si alguien te mandó este enlace, no sigas: es para el aparato donde tocaste «Iniciar sesión».', '¡Listo, {n}!', 'Ya podés volver al juego.', 'Volver a JXMod', 'No se pudo iniciar sesión. Probá de nuevo.', 'El enlace venció: tocá «Iniciar sesión» otra vez en el juego.', 'El inicio de sesión todavía no está configurado.'],
  en: ['Sign in to JXMod', 'With your Google account you can play multiplayer and your progress is saved.', 'If someone sent you this link, stop: it is for the device where you tapped “Sign in”.', 'All set, {n}!', 'You can go back to the game now.', 'Back to JXMod', 'Could not sign in. Please try again.', 'This link expired: tap “Sign in” again in the game.', 'Sign-in is not set up yet.'],
  pt: ['Entrar no JXMod', 'Com sua conta Google você joga no multijogador e seu progresso fica salvo.', 'Se alguém te mandou este link, não continue: ele é para o aparelho onde você tocou em «Entrar».', 'Pronto, {n}!', 'Já pode voltar ao jogo.', 'Voltar ao JXMod', 'Não foi possível entrar. Tente de novo.', 'O link expirou: toque em «Entrar» de novo no jogo.', 'O login ainda não está configurado.'],
  id: ['Masuk ke JXMod', 'Dengan akun Google kamu bisa main multipemain dan progresmu tersimpan.', 'Jika seseorang mengirimimu tautan ini, berhenti: ini untuk perangkat tempat kamu menekan “Masuk”.', 'Beres, {n}!', 'Sekarang kamu bisa kembali ke game.', 'Kembali ke JXMod', 'Gagal masuk. Coba lagi.', 'Tautan kedaluwarsa: tekan “Masuk” lagi di game.', 'Masuk belum disiapkan.'],
  ms: ['Log masuk ke JXMod', 'Dengan akaun Google anda boleh bermain berbilang pemain dan kemajuan anda disimpan.', 'Jika seseorang menghantar pautan ini, berhenti: ia untuk peranti tempat anda menekan “Log masuk”.', 'Siap, {n}!', 'Anda boleh kembali ke permainan.', 'Kembali ke JXMod', 'Gagal log masuk. Cuba lagi.', 'Pautan tamat tempoh: tekan “Log masuk” sekali lagi dalam permainan.', 'Log masuk belum disediakan.'],
  fil: ['Mag-sign in sa JXMod', 'Sa Google account mo, makakapaglaro ka ng multiplayer at naseseyb ang progreso mo.', 'Kung may nagpadala sa iyo ng link na ito, huwag ituloy: para ito sa device kung saan mo pinindot ang “Mag-sign in”.', 'Ayos na, {n}!', 'Puwede ka nang bumalik sa laro.', 'Bumalik sa JXMod', 'Hindi naka-sign in. Subukan ulit.', 'Nag-expire ang link: pindutin ulit ang “Mag-sign in” sa laro.', 'Hindi pa naka-set up ang pag-sign in.'],
  ja: ['JXModにログイン', 'Googleアカウントでマルチプレイができ、進行状況が保存されます。', 'このリンクを誰かから送られた場合は進まないでください。「ログイン」を押した端末用です。', '完了しました、{n}さん！', 'ゲームに戻れます。', 'JXModに戻る', 'ログインできませんでした。もう一度お試しください。', 'リンクの期限が切れました。ゲームでもう一度「ログイン」を押してください。', 'ログインはまだ設定されていません。'],
  th: ['ลงชื่อเข้าใช้ JXMod', 'ใช้บัญชี Google เพื่อเล่นผู้เล่นหลายคนและบันทึกความคืบหน้า', 'ถ้ามีคนส่งลิงก์นี้ให้คุณ อย่าทำต่อ: ลิงก์นี้สำหรับเครื่องที่คุณแตะ “ลงชื่อเข้าใช้”', 'เรียบร้อย {n}!', 'กลับไปที่เกมได้เลย', 'กลับไป JXMod', 'ลงชื่อเข้าใช้ไม่สำเร็จ ลองอีกครั้ง', 'ลิงก์หมดอายุ: แตะ “ลงชื่อเข้าใช้” ในเกมอีกครั้ง', 'ยังไม่ได้ตั้งค่าการลงชื่อเข้าใช้'],
  tr: ['JXMod’a giriş yap', 'Google hesabınla çok oyunculu oynar, ilerlemeni kaydedersin.', 'Bu bağlantıyı biri gönderdiyse devam etme: “Giriş yap”a dokunduğun cihaz içindir.', 'Tamam, {n}!', 'Artık oyuna dönebilirsin.', 'JXMod’a dön', 'Giriş yapılamadı. Tekrar dene.', 'Bağlantının süresi doldu: oyunda tekrar “Giriş yap”a dokun.', 'Giriş henüz ayarlanmadı.'],
  ar: ['تسجيل الدخول إلى JXMod', 'بحساب Google تلعب متعدد اللاعبين ويُحفظ تقدّمك.', 'إن أرسل لك أحدهم هذا الرابط فلا تكمل: إنه للجهاز الذي ضغطت فيه «تسجيل الدخول».', 'تم يا {n}!', 'يمكنك العودة إلى اللعبة الآن.', 'العودة إلى JXMod', 'تعذّر تسجيل الدخول. حاول مجددًا.', 'انتهت صلاحية الرابط: اضغط «تسجيل الدخول» مجددًا في اللعبة.', 'تسجيل الدخول غير مُعدّ بعد.'],
  ru: ['Вход в JXMod', 'С аккаунтом Google можно играть по сети, а прогресс сохраняется.', 'Если эту ссылку вам кто-то прислал, не продолжайте: она для устройства, где вы нажали «Войти».', 'Готово, {n}!', 'Можно вернуться в игру.', 'Вернуться в JXMod', 'Не удалось войти. Попробуйте ещё раз.', 'Ссылка устарела: нажмите «Войти» в игре ещё раз.', 'Вход пока не настроен.'],
  uk: ['Вхід у JXMod', 'З акаунтом Google можна грати в мережі, а прогрес зберігається.', 'Якщо це посилання вам хтось надіслав, не продовжуйте: воно для пристрою, де ви натиснули «Увійти».', 'Готово, {n}!', 'Можна повертатися до гри.', 'Повернутися в JXMod', 'Не вдалося увійти. Спробуйте ще раз.', 'Посилання застаріло: натисніть «Увійти» в грі ще раз.', 'Вхід ще не налаштовано.'],
  fr: ['Se connecter à JXMod', 'Avec ton compte Google, tu joues en multijoueur et ta progression est sauvegardée.', 'Si quelqu’un t’a envoyé ce lien, arrête-toi : il est pour l’appareil où tu as touché « Se connecter ».', 'C’est bon, {n} !', 'Tu peux retourner au jeu.', 'Retour à JXMod', 'Connexion impossible. Réessaie.', 'Le lien a expiré : touche « Se connecter » à nouveau dans le jeu.', 'La connexion n’est pas encore configurée.'],
  de: ['Bei JXMod anmelden', 'Mit deinem Google-Konto spielst du im Mehrspielermodus und dein Fortschritt wird gespeichert.', 'Wenn dir jemand diesen Link geschickt hat, mach nicht weiter: Er ist für das Gerät, auf dem du „Anmelden“ getippt hast.', 'Fertig, {n}!', 'Du kannst jetzt zum Spiel zurück.', 'Zurück zu JXMod', 'Anmeldung fehlgeschlagen. Versuch es noch einmal.', 'Der Link ist abgelaufen: Tippe im Spiel erneut auf „Anmelden“.', 'Die Anmeldung ist noch nicht eingerichtet.'],
};
function pagina(env, e, l, app) {
  const X = TX[l] || TX.en, n = azarHex(16), esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const datos = JSON.stringify({ c: env.GOOGLE_CLIENT_ID || '', e, l, app: !!app, X }).replace(/</g, '\\u003c');
  const html = `<!doctype html><html lang="${esc(l)}"${l === 'ar' ? ' dir="rtl"' : ''}><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer">
<title>${esc(X[0])}</title><style>
:root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#101217;color:#eef0f4;font:16px/1.45 Roboto,system-ui,Arial,sans-serif;padding:16px}
.c{width:100%;max-width:420px;background:#1b1e25;border:1px solid #2b2f39;border-radius:14px;padding:26px 22px;text-align:center;box-shadow:0 8px 30px #0007}
h1{font-size:21px;margin:0 0 8px}p{margin:8px 0;color:#c6cad3}.av{font-size:13px;color:#e8b04b;margin-top:16px}#g{display:flex;justify-content:center;margin:20px 0 6px;min-height:44px}
.ok{color:#5fd38a;font-size:19px;font-weight:700}.mal{color:#ff8a80}a.b{display:inline-block;margin-top:14px;background:#2f86de;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:10px}
.logo{font:900 26px Roboto,Arial,sans-serif;letter-spacing:1px;margin-bottom:10px}.logo b{color:#2f86de}</style></head><body><div class="c"><div class="logo">JX<b>Mod</b></div>
<h1>${esc(X[0])}</h1><p id="s">${esc(X[1])}</p><div id="g"></div><p class="av" id="a">${esc(X[2])}</p></div>
<script nonce="${n}">window.__D=${datos};</script>
<script nonce="${n}">(function(){var D=window.__D,X=D.X,$=function(i){return document.getElementById(i)};
function fin(t,c){$('g').innerHTML='';$('a').textContent='';var s=$('s');s.textContent=t;s.className=c||''}
function listo(nom){fin(X[3].replace('{n}',nom||''),'ok');var p=document.createElement('p');p.textContent=X[4];$('s').after(p);
 if(D.app){var a=document.createElement('a');a.className='b';a.href='jxmod://cuenta';a.textContent=X[5];p.after(a)}
 try{if(window.opener){window.opener.postMessage({jxCuenta:D.e},'*');setTimeout(function(){window.close()},1200)}}catch(e){}}
if(!D.c){fin(X[8],'mal');return}
window.__cb=function(r){fin('…');fetch('/api/cuenta/google',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({credential:r.credential,e:D.e})})
 .then(function(x){return x.json()}).then(function(j){if(j&&j.ok)listo(j.nombre);else fin(j&&j.vencido?X[7]:X[6],'mal')}).catch(function(){fin(X[6],'mal')})};
window.__ini=function(){google.accounts.id.initialize({client_id:D.c,callback:window.__cb,nonce:D.e,ux_mode:'popup',auto_select:false,cancel_on_tap_outside:false,itp_support:true});
 google.accounts.id.renderButton($('g'),{theme:'filled_blue',size:'large',shape:'pill',text:'continue_with',locale:D.l,width:280})};
var s=document.createElement('script');s.src='https://accounts.google.com/gsi/client';s.async=true;s.nonce='${n}';s.onload=window.__ini;s.onerror=function(){fin(X[6],'mal')};document.head.appendChild(s)})();</script></body></html>`;
  return new Response(html, { headers: {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
    'Cross-Origin-Opener-Policy': 'same-origin-allow-popups',
    'Content-Security-Policy': `default-src 'none'; script-src 'nonce-${n}' https://accounts.google.com/gsi/client; frame-src https://accounts.google.com/gsi/; connect-src 'self' https://accounts.google.com/gsi/; style-src 'unsafe-inline' https://accounts.google.com/gsi/style; img-src https: data:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`,
  } });
}

// ---- las rutas (/api/cuenta/...): devuelve la respuesta, o null si no es de acá ----
export async function cuentaRutas(req, env, url, r, ip, json) {
  if (!r.startsWith('/api/cuenta')) return null;
  if (r === '/api/cuenta/config') return json({ google: cuentaActiva(env) });
  if (!cuentaActiva(env)) return json({ error: 'sin configurar', google: false }, 503);
  await tablas(env);
  const L = Object.keys(TX), ahora = Date.now();
  if (req.method === 'GET' && r === '/api/cuenta/entrar') {
    const e = String(url.searchParams.get('e') || '').toLowerCase(), l = L.includes(url.searchParams.get('l')) ? url.searchParams.get('l') : 'en';
    if (!/^[a-f0-9]{64}$/.test(e)) return new Response('bad request', { status: 400 });
    return pagina(env, e, l, url.searchParams.get('app') === '1');
  }
  if (req.method === 'POST' && r === '/api/cuenta/google') {
    const b = await req.json().catch(() => ({})), e = String(b.e || '').toLowerCase();
    if (!/^[a-f0-9]{64}$/.test(e)) return json({ error: 'datos inválidos' }, 400);
    const hora = await env.DB.prepare('SELECT COUNT(*) AS n FROM entradas WHERE ip = ?1 AND vence > ?2').bind(ip, ahora).first();
    if (hora && hora.n >= 20) return json({ error: 'muchos: esperá unos minutos' }, 429);
    const g = await verificarGoogle(b.credential, env, e); if (!g) return json({ error: 'token inválido' }, 401);
    const nombre = limpiar(g.name || g.given_name || 'Jugador', 40), foto = /^https:\/\/[a-z0-9.-]+\.googleusercontent\.com\//.test(g.picture || '') ? String(g.picture).slice(0, 300) : '';
    let u = await env.DB.prepare('SELECT id FROM usuarios WHERE sub = ?1').bind(String(g.sub)).first();
    const id = u ? u.id : azarHex(12);
    if (u) await env.DB.prepare('UPDATE usuarios SET nombre = ?2, foto = ?3, visto = ?4 WHERE id = ?1').bind(id, nombre, foto, ahora).run();
    else await env.DB.prepare('INSERT INTO usuarios (id, sub, nombre, foto, creado, visto) VALUES (?1, ?2, ?3, ?4, ?5, ?5)').bind(id, String(g.sub), nombre, foto, ahora).run();
    const token = azarHex(32);
    await env.DB.batch([
      env.DB.prepare('INSERT INTO sesiones (h, usuario, creada, vence) VALUES (?1, ?2, ?3, ?4)').bind(await sha('s' + token), id, ahora, ahora + SESION_DIAS * DIA),
      env.DB.prepare('INSERT OR REPLACE INTO entradas (e, token, usuario, vence, ip) VALUES (?1, ?2, ?3, ?4, ?5)').bind(e, token, id, ahora + 600e3, ip),
      env.DB.prepare('DELETE FROM entradas WHERE vence < ?1').bind(ahora),
      env.DB.prepare('DELETE FROM sesiones WHERE vence < ?1').bind(ahora),
    ]);
    return json({ ok: true, nombre });
  }
  if (req.method === 'POST' && r === '/api/cuenta/listo') {
    const b = await req.json().catch(() => ({})), v = String(b.v || '');
    if (!/^[A-Za-z0-9_-]{32,128}$/.test(v)) return json({ error: 'datos inválidos' }, 400);
    const e = await sha(v), x = await env.DB.prepare('SELECT token, usuario, vence FROM entradas WHERE e = ?1').bind(e).first();
    if (!x) return json({ espera: true });
    await env.DB.prepare('DELETE FROM entradas WHERE e = ?1').bind(e).run();
    if (x.vence < ahora) return json({ vencido: true }, 410);
    const u = await env.DB.prepare('SELECT id, nombre, foto FROM usuarios WHERE id = ?1').bind(x.usuario).first();
    return json({ token: x.token, usuario: u });
  }
  const yo = await sesionDe(req, env);
  if (!yo) return json({ error: 'sin sesión' }, 401);
  if (req.method === 'GET' && r === '/api/cuenta/yo') return json({ usuario: yo });
  if (req.method === 'POST' && r === '/api/cuenta/salir') {
    const m = /^Bearer ([a-f0-9]{64})$/.exec(req.headers.get('Authorization') || '');
    if (m) await env.DB.prepare('DELETE FROM sesiones WHERE h = ?1').bind(await sha('s' + m[1])).run();
    return json({ ok: true });
  }
  // el progreso: GET trae todo (o lo cambiado desde ?desde=); POST sube claves { k: { v, f } } y gana la más nueva
  if (req.method === 'GET' && r === '/api/cuenta/progreso') {
    const desde = Math.max(0, +url.searchParams.get('desde') || 0);
    const f = await env.DB.prepare('SELECT k, v, fecha FROM progreso WHERE usuario = ?1 AND fecha > ?2').bind(yo.id, desde).all();
    const o = {}; for (const x of f.results) o[x.k] = { v: x.v, f: x.fecha };
    return json({ datos: o, ahora });
  }
  if (req.method === 'POST' && r === '/api/cuenta/progreso') {
    const b = await req.json().catch(() => null), D = b && b.datos;
    if (!D || typeof D !== 'object' || Array.isArray(D)) return json({ error: 'datos inválidos' }, 400);
    const K = Object.keys(D).slice(0, 400), ante = await env.DB.prepare('SELECT k, fecha, length(v) AS n FROM progreso WHERE usuario = ?1').bind(yo.id).all();
    const vie = new Map(ante.results.map((x) => [x.k, x])); let total = ante.results.reduce((s, x) => s + (x.n || 0), 0);
    const ops = [], gano = [], perdio = {};
    for (const k of K) {
      if (!/^[\w:.\-]{1,120}$/.test(k)) continue;
      const it = D[k] || {}, f = Math.min(ahora + 60e3, Math.max(0, +it.f || 0)), borrar = it.v === null, v = borrar ? '' : String(it.v == null ? '' : it.v);
      if (v.length > MAX_CLAVE) continue;
      const x = vie.get(k);
      if (x && x.fecha >= f) { perdio[k] = x.fecha; continue; }   // (lo de la nube es más nuevo: queda eso)
      const nuevo = total - (x ? x.n || 0 : 0) + v.length; if (nuevo > MAX_CUENTA) return json({ error: 'lleno', tope: MAX_CUENTA }, 413);
      total = nuevo; gano.push(k);
      // (borrar deja la clave vacía con su fecha: si no, otro aparato con lo viejo la volvía a subir)
      ops.push(env.DB.prepare('INSERT OR REPLACE INTO progreso (usuario, k, v, fecha) VALUES (?1, ?2, ?3, ?4)').bind(yo.id, k, borrar ? null : v, f));
    }
    for (let i = 0; i < ops.length; i += 50) await env.DB.batch(ops.slice(i, i + 50));
    return json({ ok: true, guardadas: gano.length, masNuevas: perdio, ahora });
  }
  return json({ error: 'no existe' }, 404);
}
