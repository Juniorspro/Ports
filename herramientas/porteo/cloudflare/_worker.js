// porteo: la puerta de una versión web privada en Cloudflare Pages (la sube subir.py). Es el "modo
// avanzado" de Pages: este worker atiende TODOS los pedidos antes que los archivos, así que sin la
// cookie firmada no sale nada del juego (ni la página ni los bloques): sólo la página para poner la
// clave. Se hace acá y no con Cloudflare Access porque Access hay que activarlo a mano en el panel
// de la cuenta; si está, conviene Access.
//
// La clave es un secreto del proyecto (CLAVE, lo pone subir.py) y nunca va en el repo. La cookie es
// el vencimiento firmado con HMAC usando la clave: no se guarda nada en el servidor, y cambiar la
// clave cierra todas las sesiones de una.
//
// Pasan sin clave sólo el service worker, el manifest y los íconos: para instalar la app el
// navegador los puede pedir sin cookies, y no tienen nada del juego.
//
// Adentro de otra página (Rezona y los visores de HTML muestran el archivo en un cuadro, y el
// lanzador abre el juego en un cuadro propio) la cookie no sirve: los navegadores no mandan una
// SameSite=Lax a un cuadro de otro sitio, y el WebView de Android ni guarda cookies de terceros. Ahí
// la sesión va en la ruta, /__s/<vence>.<firma>/… (la misma firma que la cookie): las direcciones de
// la página son relativas, así que todo lo que pide cuelga solo de esa ruta. Por eso tampoco va
// X-Frame-Options: sin la clave, en un cuadro también se ve sólo la puerta.
const COOKIE = 'porteo';
const DURA = 365 * 24 * 3600;   // un año: instalada, la app arranca sin red y no vuelve a pedir la clave
const ENTRAR = '/__entrar';
const SESION = '/__s/';
// lo que cuenta la página (qué teléfono, si hay WebGL 2, hasta dónde llegó, los errores): va a los
// registros del worker ("wrangler pages deployment tail", que con muchos pedidos juntos se saltea
// algunos) y, si el proyecto tiene un KV atado como REGISTRO, también ahí (14 días; lo lee
// registro.py). Sólo con sesión
const REGISTRO = '/__registro';
const DURA_REGISTRO = 14 * 24 * 3600;
const LIBRES = new Set(['/sw.js', '/manifest.webmanifest', '/icono-192.png', '/icono-512.png']);

// lo del servidor del juego que se deja pasar, y de dónde pueden venir las canciones
const GD_RUTA = '/__gd/';
const GD_SERVIDOR = 'https://www.boomlings.com/database/';
const GD_PERMITIDOS = /^(accounts\/loginGJAccount|getGJLevels21|downloadGJLevel22|getGJSongInfo|getGJDailyLevel|getGJMapPacks21|getGJGauntlets21|getGJLevelLists|getGJUsers20|getGJUserInfo20|getGJScores20|getGJLevelScores211|getGJComments21|getGJAccountComments20|uploadGJLevel21|getGJRewards|getGJChallenges|likeGJItem211|getCustomContentURL)\.php$/;
const GD_AUDIO = /^https:\/\/([a-z0-9-]+\.)*(ngfiles\.com|newgrounds\.com|b-cdn\.net|geometrydashcontent\.com|geometrydashfiles\.b-cdn\.net)\//;
async function gdPost(ep, cuerpo) {
  return fetch(GD_SERVIDOR + ep, { method: 'POST', body: cuerpo, headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': '', Accept: '*/*' } });
}
async function gd(req, ep, url) {
  const priv = { 'Cache-Control': 'private, no-store', 'X-Robots-Tag': 'noindex, nofollow' };
  if (ep === 'audio') {
    let u = url.searchParams.get('u');
    const ng = url.searchParams.get('ng');
    if (!u && /^\d{1,9}$/.test(ng || '')) { // canción por id: el servidor dice dónde está
      const t = await (await gdPost('getGJSongInfo.php', 'songID=' + ng + '&secret=Wmfd2893gb7')).text();
      const m = /~\|~10~\|~([^~]+)/.exec(t); if (m && /^https?%3A|^https?:/.test(m[1])) u = decodeURIComponent(m[1]);
      // sin dirección: la descarga de Newgrounds redirige al mp3
      if (!u) u = 'https://www.newgrounds.com/audio/download/' + ng;
    }
    if (!u || !GD_AUDIO.test(u)) return new Response('no', { status: 400, headers: priv });
    const r = await fetch(u, { cf: { cacheTtl: 2592000, cacheEverything: true } });
    if (!r.ok) return new Response('no', { status: r.status, headers: priv });
    return new Response(r.body, { status: 200, headers: { 'Content-Type': r.headers.get('Content-Type') || 'audio/mpeg', 'Cache-Control': 'private, max-age=31536000' } });
  }
  if (!GD_PERMITIDOS.test(ep) || req.method !== 'POST') return new Response('-1', { status: 400, headers: priv });
  const r = await gdPost(ep, await req.text());
  return new Response(await r.text(), { status: r.ok ? 200 : r.status, headers: Object.assign({ 'Content-Type': 'text/plain; charset=utf-8' }, priv) });
}

const utf8 = new TextEncoder();
async function firmar(clave, que) {
  const k = await crypto.subtle.importKey('raw', utf8.encode(clave), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const f = new Uint8Array(await crypto.subtle.sign('HMAC', k, utf8.encode(que)));
  let s = '';
  for (const b of f) s += b.toString(16).padStart(2, '0');
  return s;
}

// compara sin cortar en la primera diferencia: el tiempo no dice cuánto coincide
function iguales(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

// la clave se escribe como sea: con guiones, espacios o mayúsculas
const normal = (s) => String(s == null ? '' : s).toLowerCase().replace(/[^a-z0-9]/g, '');

async function firmaValida(clave, vence, firma) {
  if (Number(vence) * 1000 < Date.now()) return false;
  return iguales(firma, await firmar(clave, 'sesion|' + vence));
}

async function sesionValida(req, clave) {
  const m = /(?:^|;\s*)porteo=(\d{1,12})\.([0-9a-f]{64})(?:;|$)/.exec(req.headers.get('Cookie') || '');
  return !!m && firmaValida(clave, m[1], m[2]);
}

const PAGINA = `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Privado</title>
<style>
  :root { --fondo: #f6f7f9; --texto: #1d2129; --suave: #5b6472; --acento: #d6336c; --borde: #d7dbe2; --campo: #fff; --error: #c92a2a; }
  @media (prefers-color-scheme: dark) { :root { --fondo: #15181d; --texto: #e8eaed; --suave: #a0a8b4; --acento: #f06595; --borde: #2c323b; --campo: #1f242b; --error: #ff8787; } }
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; padding: 24px 16px; box-sizing: border-box;
         background: var(--fondo); color: var(--texto); font: 16px/1.5 system-ui, sans-serif; }
  main { width: 100%; max-width: 360px; }
  h1 { font-size: 22px; margin: 0 0 6px; }
  p { margin: 0 0 18px; color: var(--suave); }
  input { box-sizing: border-box; width: 100%; padding: 12px; border: 1px solid var(--borde); border-radius: 10px;
          background: var(--campo); color: var(--texto); font: inherit; letter-spacing: .04em; }
  button { width: 100%; margin-top: 12px; padding: 12px; border: 0; border-radius: 10px; background: var(--acento);
           color: #fff; font: inherit; font-weight: 600; cursor: pointer; }
  .error { color: var(--error); margin: 10px 0 0; }
</style>
</head>
<body>
<main>
  <h1>Página privada</h1>
  <p>Poné la clave para entrar. Queda guardada en este navegador.</p>
  <form method="post" action="${ENTRAR}">
    <input name="clave" type="password" autocomplete="current-password" autocapitalize="off" spellcheck="false" aria-label="Clave" required autofocus>
    <input name="ruta" type="hidden" value="">
    <button type="submit">Entrar</button>
    <p class="error" role="alert" id="error" hidden>Esa no es la clave.</p>
  </form>
</main>
<script>
  (function () {
    var f = document.querySelector('form');
    // adentro de otra página la cookie no viaja: la sesión va en la dirección (ver SESION)
    var enCuadro = window.top !== window;
    function entrar() {
      if (!enCuadro) { f.submit(); return; }
      var cuerpo = new URLSearchParams({ clave: f.clave.value, ruta: '1' });
      fetch('${ENTRAR}', { method: 'POST', body: cuerpo, headers: { Accept: 'application/json' }, credentials: 'omit' })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (j.ruta) location.replace(j.ruta);
          else document.getElementById('error').hidden = false;
        })
        // sin fetch (o sin poder leer la respuesta): el formulario, que con ruta=1 vuelve a la ruta
        .catch(function () { f.ruta.value = '1'; f.submit(); });
    }
    f.addEventListener('submit', function (e) { e.preventDefault(); entrar(); });
    // el enlace con la clave después del # (no viaja al servidor ni queda en sus registros): entra solo
    var m = /[#&]clave=([^&]+)/.exec(location.hash);
    if (m) {
      try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* queda en la barra */ }
      f.clave.value = decodeURIComponent(m[1]);
      entrar();
    }
  })();
</script>
</body>
</html>
`;

const CERRADO = {
  'Content-Type': 'text/html; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Robots-Tag': 'noindex, nofollow',
  'Referrer-Policy': 'no-referrer',
};

function pagina(error) {
  const html = error ? PAGINA.replace('id="error" hidden', 'id="error"') : PAGINA;
  return new Response(html, { status: 401, headers: CERRADO });
}

// la respuesta de la entrada desde un cuadro (la lee el fetch de la puerta). Con
// Access-Control-Allow-Origin por si el cuadro no tiene origen propio (un sandbox sin
// allow-same-origin): sin la clave no dice nada que no diga ya la puerta
function json(estado, datos) {
  return new Response(JSON.stringify(datos), {
    status: estado,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': '*' },
  });
}

export default {
  async fetch(req, env, ctx) {
    const clave = normal(env.CLAVE);
    // sin clave configurada no se abre nada (mejor cerrado que abierto por un descuido)
    if (clave.length < 12) {
      return new Response('Falta configurar la clave (CLAVE) del proyecto.', { status: 503, headers: CERRADO });
    }
    const url = new URL(req.url);
    // la sesión en la ruta (en un cuadro): se valida y se saca, y lo de después es lo pedido
    let ruta = url.pathname, prefijo = '';
    if (ruta.startsWith(SESION)) {
      const s = /^\/__s\/(\d{1,12})\.([0-9a-f]{64})(\/.*)?$/.exec(ruta);
      if (!s || !(await firmaValida(clave, s[1], s[2]))) return pagina(false);
      prefijo = SESION + s[1] + '.' + s[2];
      // sin la barra, lo relativo de la página no colgaría de la sesión
      if (!s[3]) return new Response(null, { status: 308, headers: { Location: prefijo + '/' + url.search, 'Cache-Control': 'no-store' } });
      ruta = s[3];
    }

    if (ruta === ENTRAR) {
      if (req.method !== 'POST') return new Response(null, { status: 303, headers: { Location: prefijo + '/', 'Cache-Control': 'no-store' } });
      let datos = null;
      try { datos = await req.formData(); } catch (e) { /* sin formulario: clave vacía */ }
      const intento = datos ? datos.get('clave') : '';
      const enRuta = !!datos && datos.get('ruta') === '1';
      const comoJson = (req.headers.get('Accept') || '').includes('application/json');
      // se comparan las firmas y no las claves: mismo largo siempre
      if (iguales(await firmar(clave, 'clave|' + normal(intento)), await firmar(clave, 'clave|' + clave))) {
        const vence = Math.floor(Date.now() / 1000) + DURA;
        const firma = await firmar(clave, 'sesion|' + vence);
        if (enRuta) {
          const destino = SESION + vence + '.' + firma + '/';
          if (comoJson) return json(200, { ruta: destino });
          return new Response(null, { status: 303, headers: { Location: destino, 'Cache-Control': 'no-store' } });
        }
        const cookie = `${COOKIE}=${vence}.${firma}; Path=/; Max-Age=${DURA}; HttpOnly; Secure; SameSite=Lax`;
        return new Response(null, { status: 303, headers: { Location: '/', 'Set-Cookie': cookie, 'Cache-Control': 'no-store' } });
      }
      // probar claves de a montones, no
      await new Promise((ok) => setTimeout(ok, 700));
      return comoJson ? json(401, { error: 'clave' }) : pagina(true);
    }

    const libre = LIBRES.has(ruta);
    if (!libre && !prefijo && !(await sesionValida(req, clave))) return pagina(false);

    // intermediario del servidor de Geometry Dash (sólo con sesión): el navegador no puede hablarle
    // directo (no manda CORS y corta los pedidos con User-Agent de navegador)
    if (ruta.startsWith(GD_RUTA)) return gd(req, ruta.slice(GD_RUTA.length), url);

    if (ruta === REGISTRO) {
      if (req.method === 'POST') {
        const texto = (await req.text()).slice(0, 16384);
        console.log('porteo-registro ' + texto);
        // la clave ordena por fecha; el teléfono va aparte para saber de quién es cada línea
        if (env.REGISTRO) {
          const clave = Date.now().toString(36).padStart(9, '0') + '-' + Math.random().toString(36).slice(2, 6);
          const meta = { ua: (req.headers.get('User-Agent') || '').slice(0, 200) };
          ctx.waitUntil(env.REGISTRO.put(clave, texto, { expirationTtl: DURA_REGISTRO, metadata: meta }).catch(() => {}));
        }
      }
      return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    }

    const r = await env.ASSETS.fetch(prefijo ? new Request(new URL(ruta + url.search, url.origin), req) : req);
    const h = new Headers(r.headers);
    h.set('X-Robots-Tag', 'noindex, nofollow');
    // los bloques llevan el hash en el nombre: no cambian nunca. "private": que no los guarde
    // ningún caché compartido, sólo el navegador de quien tiene la clave
    if (ruta.startsWith('/b/') && r.status === 200) h.set('Cache-Control', 'private, max-age=31536000, immutable');
    else h.set('Cache-Control', libre ? 'no-cache' : 'private, no-cache');
    if (prefijo) {
      // las redirecciones de Pages (/index.html → /) vuelven a la sesión, y la dirección (que la
      // lleva) no sale en el Referer hacia otros sitios
      const destino = h.get('Location');
      if (destino) {
        const d = new URL(destino, url.origin + ruta);
        if (d.origin === url.origin) h.set('Location', prefijo + d.pathname + d.search + d.hash);
      }
      h.set('Referrer-Policy', 'same-origin');
    }
    return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
  },
};
