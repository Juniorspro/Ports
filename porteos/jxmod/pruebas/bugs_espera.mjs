// Panel (sugerencia ee5sjde9): «Un apartado de registros de actualizaciones … y un mensaje de "Espera [tiempo] para volver a
// publicar un bug/idea"». En «Bugs y sugerencias»: la pestaña Novedades (todas las versiones, la última arriba) y, si
// publicaste hace poco, el aviso arriba del formulario con la cuenta regresiva y Publicar apagado hasta que se pueda.
// uso: node bugs_espera.mjs URL_HTML [CARPETA]
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = '/tmp/claude-0/bugs_espera'] = process.argv; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
for (const celu of [false, true]) {
  const { b, p, err, ev } = await abrir(HTML, celu); const k = celu ? 'celu' : 'pc';
  await ev(`PREFS.bienvenida = true; idiomaAplicar('es'); try { localStorage.setItem('jx_bug_ult', String(Date.now() - 30000)); } catch (e) {} inicioPanel('bugs'); 1`);
  await p.waitForSelector('.rbPan_bugs'); await p.click('[data-rb="bg:nuevo"]'); await p.waitForSelector('.bgForm');
  const a = await p.evaluate(() => ({ txt: (document.querySelector('.bgEspera') || {}).textContent || '', apagado: document.querySelector('[data-rb="bg:publicar"]').disabled }));
  await p.screenshot({ path: `${D}/${k}_1_espera.png` });
  ok(`${k}: publicaste hace 30 s → arriba «Esperá 2:30 para volver a publicar un bug» y Publicar apagado`, /Esperá 2:(29|30) para volver a publicar un bug/.test(a.txt) && a.apagado, a);
  await p.waitForTimeout(2200);
  const t2 = await p.evaluate(() => (document.querySelector('.bgEsperaTxt') || {}).textContent || '');
  ok(`${k}: la cuenta baja sola`, /2:2[6-8]/.test(t2), t2);
  await p.click('[data-rb="bg:ftipo|sug"]'); await p.waitForTimeout(300);
  const t3 = await p.evaluate(() => (document.querySelector('.bgEsperaTxt') || {}).textContent || '');
  ok(`${k}: si es una idea, dice «una idea»`, /para volver a publicar una idea/.test(t3), t3);
  // (se cumple el tiempo: el aviso se va y se prende Publicar)
  await ev(`try { localStorage.setItem('jx_bug_ult', String(Date.now() - 10 * 60e3)); } catch (e) {} 1`); await p.waitForTimeout(1500);
  const f = await p.evaluate(() => ({ aviso: !!document.querySelector('.bgEspera'), apagado: document.querySelector('[data-rb="bg:publicar"]').disabled }));
  ok(`${k}: al cumplirse el tiempo se va el aviso y se prende Publicar`, !f.aviso && !f.apagado, f);
  // la pestaña Novedades
  await p.click('[data-rb="bg:cancelar"]'); await p.click('[data-rb="bg:tab|nov"]'); await p.waitForSelector('.bgNov');
  const total = await ev(`NOVEDADES.length`);
  const n = await p.evaluate((total) => ({ items: document.querySelectorAll('.bgNovItem').length, total, primera: document.querySelector('.bgNovItem b').textContent, marca: (document.querySelector('.bgNovItem.nueva i') || {}).textContent, sinInstalar: ![...document.querySelectorAll('.bgNovItem p')].some((x) => /se instala encima|desinstal/i.test(x.textContent)), boton: !!document.querySelector('[data-rb="bg:nuevo"]') }), total);
  await p.screenshot({ path: `${D}/${k}_2_novedades.png` });
  ok(`${k}: Novedades: las ${n.total} versiones, la última arriba (JXMod ${n.primera}) marcada, sin instrucciones de instalación y sin botón de publicar`, n.items === n.total && n.total >= 24 && /3\.9\.10|3\.9\.1\d/.test(n.primera) && n.marca === 'la última' && n.sinInstalar && !n.boton, n);
  await ev(`idiomaAplicar('en'); inicioPanel('bugs'); 1`); await p.waitForTimeout(400);
  const en = await p.evaluate(() => ({ tab: [...document.querySelectorAll('.rbTab')].map((x) => x.textContent.trim()), p: (document.querySelector('.bgNovItem p') || {}).textContent || '' }));
  ok(`${k}: en inglés, la pestaña «Updates» y las notas en inglés`, en.tab.includes('Updates') && /^(Fixes|New|Fix)/.test(en.p), { tab: en.tab, p: en.p.slice(0, 50) });
  const js = err.filter((x) => !/favicon|ERR_|net::|404|WebSocket|mqtt|wss:|Failed to fetch|CORS/i.test(x));
  ok(`${k}: sin errores de JS`, !js.length, js.slice(0, 4));
  await b.close();
}
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); process.exit(0);
