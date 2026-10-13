// Juega la progresion del principio llamando al juego directo: lugares y tareas en orden, mide y saca fotos.
// Uso: node progreso.mjs URL PREFIJO_FOTOS [ids separados por coma]
import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
const [url, pre, lista = 'rocky_plateau,find_shelter,build_door,deadwood_valley,build_workstation,craft_hatchet,craft_shovel,craft_sword,deadwood_valley'] = process.argv.slice(2);
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 873, height: 393 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const errores = [];
p.on('pageerror', (e) => errores.push(e.message));
await p.addInitScript(() => { try { localStorage.clear(); } catch (e) {} });
await p.goto(url);
await p.waitForFunction(() => window.prueba && window.prueba.listo, null, { timeout: 60000 });
let n = 0;
for (const id of lista.split(',')) {
  const r = await p.evaluate((id) => {
    const q = Quests.buscar(id);
    if (!q) return { id, error: 'no existe' };
    for (const c of q.costs || []) { const k = String(c.resource).toLowerCase(); Prog.recursos[k] = Math.max(Prog.recursos[k] || 0, c.amount); Prog.recursos[k] -= c.amount; }
    const esc = q.sections || q.encounters ? Escenas.partida(id) : Escenas.tarea(q, 'lugares');
    Juego.cambiar(esc);
    let i = 0;
    for (; i < 30 * 600; i++) {
      esc.paso();
      const L = prueba.partida;
      if (q.sections || q.encounters) { if (L.completo || L.perdido) break; } else if (Prog.completos[id]) break;
    }
    const L = prueba.partida;
    return { id, pasos: i, completo: !!Prog.completos[id] || !!(L && L.completo), perdido: !!(L && L.perdido && (q.sections || q.encounters)),
      hp: L && L.heroe.hp, rec: JSON.stringify(Prog.recursos), items: Object.keys(Prog.items).join(','), personajes: L && L.personajes.length };
  }, id);
  console.log(JSON.stringify(r));
  await p.waitForTimeout(300);
  await p.screenshot({ path: `${pre}${n++}.png` });
}
console.log('habilitados:', await p.evaluate(() => Quests.habilitados().map((q) => q.id).join(',')));
console.log('errores de la página:', errores.length, errores.slice(0, 5).join(' | '));
await b.close();
