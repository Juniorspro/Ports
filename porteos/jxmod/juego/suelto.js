// El HTML suelto que se actualiza solo (JXMod.html de un solo archivo: armar.py con SUELTO=1 pone esto primero en la página,
// antes que todo lo demás; no es parte del juego).
// - Mientras se juega mira web/version.json en el repo. Si hay una versión nueva, baja lo de la web con código (index.html,
//   juego.bin y, sólo si cambió el paquete, pk.bin), lo abre con la clave de esa versión (web/suelto.json la trae cifrada con
//   la que va acá: herramientas/suelto.py), lo comprueba y lo guarda en este navegador (IndexedDB). Avisa que está lista.
// - Al abrir el HTML: si hay guardada una versión más nueva que la de este archivo, la de adentro no arranca (el resto de la
//   página queda como texto, sin ejecutarse: <plaintext>) y se abre la guardada en la misma página (document.open). El
//   paquete, si es el mismo, sale del de adentro (no se baja de nuevo). Si algo falla, recarga con la de adentro.
// (sin let/const a nivel de la página, y sin la etiqueta de cierre de script escrita entera: va adentro del HTML)
(function () {
  var C = /*SUELTO*/null;   // { cod, ver, pkh, pkn, kw, bases }
  if (!C) return;
  var LS = 'jx_suelto', DB = 'jxmod_suelto', FIN = '</' + 'script>';
  var leerMeta = function () { try { return JSON.parse(localStorage.getItem(LS) || 'null'); } catch (e) { return null; } };
  var anotarMeta = function (m) { try { if (m) localStorage.setItem(LS, JSON.stringify(m)); else localStorage.removeItem(LS); } catch (e) {} };
  var ssLeer = function (k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } };
  var ssPoner = function (k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} };
  var aviso = function (t) { try { console.warn('JXMod (HTML suelto): ' + t); } catch (e) {} };

  // ---- lo guardado (IndexedDB: «v» = {cod, ver, shell, gz, pkh}; «pk» = {pkh, u8}, sólo si el paquete no es el de adentro)
  function idb() {
    return new Promise(function (ok, mal) {
      var r = indexedDB.open(DB, 1);
      r.onupgradeneeded = function () { r.result.createObjectStore('d'); };
      r.onsuccess = function () { ok(r.result); }; r.onerror = function () { mal(r.error); };
    });
  }
  function idbLeer(k) {
    return idb().then(function (db) {
      return new Promise(function (ok, mal) {
        var q = db.transaction('d', 'readonly').objectStore('d').get(k);
        q.onsuccess = function () { db.close(); ok(q.result); }; q.onerror = function () { db.close(); mal(q.error); };
      });
    });
  }
  function idbPoner(o) {   // (undefined: se borra)
    return idb().then(function (db) {
      return new Promise(function (ok, mal) {
        var tx = db.transaction('d', 'readwrite'), s = tx.objectStore('d');
        for (var k in o) if (o[k] === undefined) s.delete(k); else s.put(o[k], k);
        tx.oncomplete = function () { db.close(); ok(); }; tx.onerror = tx.onabort = function () { db.close(); mal(tx.error); };
      });
    });
  }

  // ---- 1. al abrir: ¿hay una versión guardada más nueva que la de este archivo?
  var meta = leerMeta();
  var usar = !!(meta && meta.listo && meta.cod > C.cod && ssLeer('jx_suelto_falla') !== String(meta.cod));
  var corriendo = usar ? meta : { cod: C.cod, ver: C.ver, pkh: C.pkh };
  var E = window.__jxSuelto = { C: C, usar: usar, corriendo: corriendo, estado: usar ? 'abriendo' : 'adentro', pedidos: 0 };
  if (usar) {
    document.write('<style>html,body{background:#000;margin:0}</style><plaintext style="display:none">');
    abrirGuardada(meta).catch(function (e) {
      aviso('la ' + meta.ver + ' guardada no abrió (' + e + '): va la de este archivo');
      ssPoner('jx_suelto_falla', String(meta.cod)); anotarMeta(null); location.reload();
    });
  } else if (meta && meta.cod <= C.cod) {
    // (este archivo es igual o más nuevo que lo guardado: lo guardado ya no sirve)
    anotarMeta(null); setTimeout(function () { idbPoner({ v: undefined, pk: undefined }).catch(function () {}); }, 5000);
  }

  // el paquete de adentro (base64 en pedazos de 1 MB), del texto que quedó en <plaintext>
  function pkDeAdentro() {
    return new Promise(function (ok, mal) {
      var leer = function () {
        var el = document.querySelector('plaintext'); if (!el) return mal(new Error('sin la página de adentro'));
        var t = el.textContent, A = '<script class="pk" type="text/plain">', u = new Uint8Array(C.pkn), o = 0, i = 0;
        el.textContent = '';
        for (;;) {
          var a = t.indexOf(A, i); if (a < 0) break; a += A.length;
          var b = t.indexOf(FIN, a); if (b < 0) break;
          var s = t.slice(a, b);
          if (typeof Uint8Array.fromBase64 === 'function') { var x = Uint8Array.fromBase64(s); u.set(x, o); o += x.length; }
          else { var bs = atob(s); for (var j = 0; j < bs.length; j++) u[o++] = bs.charCodeAt(j); }
          i = b;
        }
        if (o !== C.pkn) return mal(new Error('paquete de adentro incompleto: ' + o + ' de ' + C.pkn));
        ok(u);
      };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', leer); else leer();
    });
  }
  var quitar = function (h, a, b) { var i = h.indexOf(a), j = h.indexOf(b, i); return i >= 0 && j > i ? h.slice(0, i) + h.slice(j + b.length) : h; };
  async function abrirGuardada(m) {
    var v = await idbLeer('v'); if (!v || v.cod !== m.cod) throw new Error('no está guardada');
    var pk;
    if (v.pkh === C.pkh) pk = await pkDeAdentro();
    else { var p = await idbLeer('pk'); if (!p || p.pkh !== v.pkh) throw new Error('falta su paquete'); pk = p.u8; }
    // la página de la versión nueva (la de la web), sin el pedido del código ni lo de la app web instalable
    var h = quitar(quitar(v.shell, '<!--jxPuerta-->', '<!--/jxPuerta-->'), '<!--jxAppWeb-->', '<!--/jxAppWeb-->');
    if (h.indexOf('data-src="pk.bin"') < 0 || h.indexOf('<script id="jsgz" type="text/plain">') < 0) throw new Error('página distinta');
    h = h.replace('data-src="pk.bin"', 'data-src="' + URL.createObjectURL(new Blob([pk])) + '"');
    // (el arranque de esa página le pide el juego a jxCodigoJuego —como la web con código— y se lo damos ya abierto)
    var gz = v.gz; v = null;
    window.jxCodigoJuego = function () { var g = gz; gz = null; return Promise.resolve(g); };
    E.estado = 'guardada';
    document.open(); document.write(h); document.close();
    escuchar();
    if (!m.visto) setTimeout(function () { var mm = leerMeta(); if (mm && mm.cod === m.cod) { mm.visto = 1; anotarMeta(mm); } cartel('ya', m.ver); }, 6000);
  }

  // ---- 2. mientras se juega: buscar la versión nueva y bajarla
  var b64 = function (s) { return Uint8Array.from(atob(s), function (c) { return c.charCodeAt(0); }); };
  var hex = async function (u) { return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256', u)), function (x) { return x.toString(16).padStart(2, '0'); }).join(''); };
  async function traer(rel, tipo) {
    var err = null;
    for (var i = 0; i < C.bases.length; i++) {
      try {
        E.pedidos++;
        var r = await fetch(C.bases[i] + rel, { cache: 'no-store' });
        if (r.ok) return tipo === 'json' ? await r.json() : new Uint8Array(await r.arrayBuffer());
        err = new Error(rel + ' ' + r.status);
      } catch (e) { err = e; }
    }
    throw err;
  }
  async function aes(k, d) {
    var kk = await crypto.subtle.importKey('raw', k, 'AES-GCM', false, ['decrypt']);
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-GCM', iv: d.slice(0, 12) }, kk, d.slice(12)));
  }
  async function paquete(k, pn, d) {
    var m = new Uint8Array(k.length + 13); m.set(k); m.set(new TextEncoder().encode('jxmod-paquete'), k.length);
    var kp = await crypto.subtle.importKey('raw', await crypto.subtle.digest('SHA-256', m), 'AES-CTR', false, ['decrypt']);
    var ctr = new Uint8Array(16); ctr.set(b64(pn));
    return new Uint8Array(await crypto.subtle.decrypt({ name: 'AES-CTR', counter: ctr, length: 64 }, kp, d));
  }
  var buscando = false, ultima = 0;
  async function buscar(forzar) {
    if (buscando || (!forzar && Date.now() - ultima < 10 * 60e3)) return E.estado;
    buscando = true; ultima = Date.now();
    try {
      var j = await traer('version.json?t=' + Date.now(), 'json');
      if (!j || !(j.codigo > corriendo.cod)) return (E.estado = 'al día');
      var m = leerMeta();
      if (m && m.listo && m.cod >= j.codigo) { cartel('lista', m.ver); return (E.estado = 'lista'); }
      if (!(window.crypto && crypto.subtle && window.indexedDB)) return (E.estado = 'sin lugar para guardarla');
      E.estado = 'bajando ' + j.version;
      var s = await traer('suelto.json?t=' + Date.now(), 'json');
      if (!s || s.cod !== j.codigo) return (E.estado = 'todavía no está entera');   // (el caché todavía tiene la anterior)
      var K = await aes(b64(C.kw), b64(s.k));
      var bin = await traer('juego.bin?v=' + s.v, 'bin'); if ((await hex(bin)).slice(0, 12) !== s.v) return (E.estado = 'juego.bin distinto');
      var gz = await aes(K, bin); bin = null;
      var sh = await traer('index.html?v=' + s.v, 'bin'); if ((await hex(sh)).slice(0, 16) !== s.sh) return (E.estado = 'index.html distinto');
      var shell = new TextDecoder().decode(sh); sh = null;
      var pk = null, guardar = { v: { cod: s.cod, ver: j.version, shell: shell, gz: gz, pkh: s.pkh } };
      if (s.pkh === C.pkh) guardar.pk = undefined;   // (el paquete es el de adentro)
      else {
        var p = await idbLeer('pk').catch(function () { return null; });
        if (!(p && p.pkh === s.pkh)) {
          pk = await paquete(K, s.pn, await traer('pk.bin?v=' + s.v, 'bin'));
          if (await hex(pk) !== s.pkh) return (E.estado = 'pk.bin distinto');
          guardar.pk = { pkh: s.pkh, u8: pk };
        }
      }
      await idbPoner(guardar);
      anotarMeta({ cod: s.cod, ver: j.version, pkh: s.pkh, listo: 1 });
      cartel('lista', j.version);
      return (E.estado = 'lista');
    } catch (e) { aviso('no se pudo buscar la versión nueva: ' + e); return (E.estado = 'falló: ' + e); }
    finally { buscando = false; }
  }
  E.buscar = buscar;

  // ---- el cartel (arriba, chico; se va solo)
  var TX = {
    es: { lista: 'JXMod %s ya se bajó: se pone sola la próxima vez que entres.', ya: 'Ya tenés JXMod %s.', boton: 'Ponerla ahora' },
    en: { lista: 'JXMod %s is downloaded: it installs itself next time you open the game.', ya: 'You now have JXMod %s.', boton: 'Update now' },
    pt: { lista: 'JXMod %s já baixou: entra sozinha na próxima vez que você abrir.', ya: 'Agora você tem JXMod %s.', boton: 'Atualizar agora' },
  };
  var mostrado = {};
  function cartel(tipo, ver) {
    if (mostrado[tipo + ver] || !document.body) return; mostrado[tipo + ver] = 1;
    var T = TX[(navigator.language || 'es').slice(0, 2)] || TX.en, viejo = document.getElementById('jxSuelto'); if (viejo) viejo.remove();
    var d = document.createElement('div'); d.id = 'jxSuelto';
    d.setAttribute('style', 'position:fixed;z-index:2147483000;left:50%;top:max(10px,env(safe-area-inset-top));transform:translateX(-50%);max-width:min(92vw,560px);display:flex;align-items:center;gap:10px;padding:9px 10px 9px 14px;border-radius:14px;background:rgba(20,23,30,.94);border:1px solid rgba(255,206,110,.4);box-shadow:0 6px 24px rgba(0,0,0,.5);color:#fff;font:600 14px/1.3 system-ui,-apple-system,sans-serif');
    var t = document.createElement('span'); t.textContent = T[tipo].replace('%s', ver); d.appendChild(t);
    if (tipo === 'lista') {
      var bt = document.createElement('button'); bt.textContent = T.boton;
      bt.setAttribute('style', 'flex:none;height:34px;padding:0 12px;border:0;border-radius:10px;background:#2f7cf6;color:#fff;font:700 14px system-ui,-apple-system,sans-serif');
      bt.onclick = function () { location.reload(); }; d.appendChild(bt);
    }
    var x = document.createElement('button'); x.textContent = '×'; x.setAttribute('aria-label', 'cerrar');
    x.setAttribute('style', 'flex:none;width:30px;height:30px;border:0;border-radius:8px;background:transparent;color:#9aa3b2;font:700 20px system-ui');
    x.onclick = function () { d.remove(); }; d.appendChild(x);
    // (el juego no deja tocar fuera de lo suyo: el cartel frena esos eventos para que sus botones anden)
    ['pointerdown', 'touchstart', 'mousedown', 'pointerup', 'touchend', 'mouseup'].forEach(function (ev) { d.addEventListener(ev, function (e) { e.stopPropagation(); }); });
    document.body.appendChild(d);
    setTimeout(function () { d.remove(); }, tipo === 'lista' ? 15000 : 6000);
  }

  // cuándo buscar: al rato de abrir, cada media hora y al volver a la página (si pasaron 10 minutos)
  // (document.open borra lo que escuchaba la página vieja: escuchar() se vuelve a llamar después de abrir la guardada)
  function escuchar() { document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') buscar(false); }); }
  if (!usar) escuchar();
  setTimeout(function () { buscar(true); }, 20000);
  setInterval(function () { buscar(false); }, 30 * 60e3);
})();
