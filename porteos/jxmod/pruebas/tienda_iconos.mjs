// la tienda en íconos cuadrados por secciones: en Mods se ven secciones (oficiales de jugar, los que ponen cosas, de
// la gente) con íconos cuadrados (≥ 4 por fila en la compu, ≥ 3 en el celular acostado), sin textos largos ni botones en
// la grilla; tocar uno abre su ficha (nombre, datos, descripción entera y los botones) y esconde el buscador; Instalar
// desde la ficha lo instala y aparecen Quitar y Activado; Volver vuelve a la grilla con la marca de activado; Emotes por
// categoría; sin errores. (compu y celular)
// uso: node tienda_iconos.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const D = (process.argv[3] || '.') + '/';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
for (const celu of [false, true]) {
  const tag = celu ? 'celu' : 'pc';
  const { b, p, err, ev } = await abrir(process.argv[2], celu);
  await ev(`PREFS.bienvenida = true; localStorage.removeItem('rb_instalados'); INST.of = {}; for (const k in PREFS.mods) delete PREFS.mods[k]; inicioMostrar(true); RB.t.tab = 'mod'; RB.t.vista = 'explorar'; RB.t.ficha = null; inicioPanel('tienda'); 1`);
  await p.waitForTimeout(2500);
  const g = await ev(`(() => { const T = [...document.querySelectorAll('.rbTiendaG .rbTile')], r = T.map((x) => x.querySelector('.rbTileIco').getBoundingClientRect());
    const fila = r.filter((x) => Math.abs(x.top - r[0].top) < 2).length; return { n: T.length, secc: [...document.querySelectorAll('.rbSecc')].map((x) => x.textContent), fila, cuadrado: r.every((x) => Math.abs(x.width - x.height) < 2), botones: document.querySelectorAll('.rbTiendaG .rbTile button').length, ancho: Math.round(r[0] && r[0].width) }; })()`);
  await p.screenshot({ path: D + 'tienda_grilla_' + tag + '.png' });
  ok(`${tag}: Mods en secciones con íconos cuadrados (≥ ${celu ? 3 : 4} por fila), sin botones en la grilla`, g.n >= 8 && g.secc.length >= 2 && g.fila >= (celu ? 3 : 4) && g.cuadrado && g.botones === 0, g);
  // tocar uno: la ficha
  const id = await ev(`(() => { const x = RB.t.items.find((m) => m.oficial && modTipo(m) !== 'asset'); return x && x.id; })()`);
  const el = await p.$(`.rbTile[data-rb="ver:${id}"]`); await el.click(); await p.waitForTimeout(300);
  const f = await ev(`(() => { const F = document.querySelector('.rbFicha'); return F && { nombre: F.querySelector('h3').textContent, desc: F.querySelector('p').textContent.length, instalar: !!F.querySelector('[data-rb^="instalar:"]'), buscador: !document.querySelector('.rbBarra').classList.contains('oc'), dentro: F.getBoundingClientRect().right <= innerWidth + 1 }; })()`);
  await p.screenshot({ path: D + 'tienda_ficha_' + tag + '.png' });
  ok(`${tag}: tocar uno abre su ficha (nombre, descripción, Instalar) y esconde el buscador`, f && f.nombre.length > 1 && f.desc > 10 && f.instalar && !f.buscador && f.dentro, f);
  await (await p.$('.rbFicha [data-rb^="instalar:"]')).click(); await p.waitForTimeout(400);
  const f2 = await ev(`(() => { const F = document.querySelector('.rbFicha'); return { quitar: !!F.querySelector('[data-rb^="quitar:"]'), act: !!F.querySelector('[data-rb^="act:"]'), on: !!(PREFS.mods['${id}']) }; })()`);
  ok(`${tag}: Instalar desde la ficha lo instala (y queda activado), aparecen Quitar y Activado`, f2.quitar && f2.act && f2.on, f2);
  await (await p.$('.rbFicha [data-rb="fichaNo"]')).click(); await p.waitForTimeout(300);
  const v = await ev(`(() => { const t = document.querySelector('.rbTile[data-rb="ver:${id}"]'); return { grilla: !!t, marca: !!(t && t.querySelector('.rbTileOn')), buscador: !document.querySelector('.rbBarra').classList.contains('oc') }; })()`);
  ok(`${tag}: Volver vuelve a la grilla y el instalado tiene su marca de activado`, v.grilla && v.marca && v.buscador, v);
  // emotes por categoría
  await ev(`inicioAccion('tab:anim', document.body); 1`); await p.waitForTimeout(1500);
  const e = await ev(`({ secc: document.querySelectorAll('.rbSecc').length, n: document.querySelectorAll('.rbTiendaG .rbTile').length })`);
  await p.screenshot({ path: D + 'tienda_emotes_' + tag + '.png' });
  ok(`${tag}: Emotes en secciones por categoría`, e.secc >= 3 && e.n >= 10, e);
  ok(`${tag}: sin errores`, err.filter((x) => !/WebSocket|ERR_CONNECTION|net::|404|Failed to fetch|tienda/i.test(x)).length === 0, err.filter((x) => !/WebSocket|ERR_CONNECTION|net::|404/.test(x)).slice(0, 4));
  await b.close();
}
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
