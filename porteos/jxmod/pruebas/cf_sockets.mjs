// Para las pruebas que cargan tienda/worker.js en Node: «cloudflare:sockets» (la conexión TCP de los correos) sólo existe
// en Cloudflare; acá se resuelve a uno de mentira que no conecta. Se importa antes de cargar el worker.
import { register } from 'node:module';
const falso = 'data:text/javascript,' + encodeURIComponent('export const connect = () => { throw new Error("sin cloudflare:sockets en Node"); };');
register('data:text/javascript,' + encodeURIComponent(`export async function resolve(s, c, sig) { if (s === 'cloudflare:sockets') return { url: ${JSON.stringify(falso)}, shortCircuit: true }; return sig(s, c); }`));
