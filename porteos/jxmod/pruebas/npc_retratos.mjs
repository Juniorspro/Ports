// el panel «NPC nuevos» de la Tool Gun: todas las miniaturas de personajes se ven (ninguna imagen rota)
// uso: node npc_retratos.mjs URL_HTML
import { abrir } from './base.mjs';
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
const { b, p, err, ev } = await abrir(process.argv[2], true);
await ev(`PREFS.bienvenida = true; inicioMostrar(false); empezarPartida('FlatGrass'); 1`); await p.waitForTimeout(2500);
await ev(`npcPanel(null); 1`); await p.waitForTimeout(2500);
const r = await ev(`(() => { const L = [...document.querySelectorAll('#npcPan .npcSkins img')]; const rotas = L.filter((i) => !i.complete || !i.naturalWidth).map((i) => i.parentElement.dataset.npcs); return { total: L.length, rotas }; })()`);
await p.screenshot({ path: 'npc_retratos.png' });
ok('todas las miniaturas de «NPC nuevos» se ven', r.total > 10 && !r.rotas.length, r);
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`); await b.close(); process.exit(0);
