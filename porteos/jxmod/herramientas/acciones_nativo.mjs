// Qué hace cada tecla de un mod (juego/acciones.js, tal cual: se ejecuta) para JXMod nativo: la lista de acciones (id,
// nombre, ícono, palabras, prioridad), lo que cada tecla ya significa (ACC_PREVIO) y las fijas (ACC_FIJA) →
// motor/nativo/src/acciones_web.json (lo lee teclas_mod.rs). Uso: node herramientas/acciones_nativo.mjs
import fs from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const aqui = path.dirname(fileURLToPath(import.meta.url));
const ctx = { console }; vm.createContext(ctx);
vm.runInContext(fs.readFileSync(path.join(aqui, '..', 'juego', 'acciones.js'), 'utf8'), ctx, { filename: 'acciones.js' });
const r = vm.runInContext('({ acc: ACC.map((a) => ({ id: a[0], es: a[1], glifo: a[3], pal: a[4], prio: a[5] })), previo: ACC_PREVIO, fija: ACC_FIJA })', ctx);
const sal = path.join(aqui, '..', 'motor', 'nativo', 'src', 'acciones_web.json');
fs.writeFileSync(sal, JSON.stringify(r));
console.log('acciones:', r.acc.length, '· previas:', Object.keys(r.previo).length, '· fijas:', Object.keys(r.fija).length, '→', path.relative(process.cwd(), sal));
