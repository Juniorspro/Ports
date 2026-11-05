// ---------------- qué hace cada tecla de un mod (para mostrar su ícono y su nombre en el botón) ----------------
// Los mods de GMod piden teclas (KEY_V, IN_ZOOM, el bind "impulse 100"...) y en el celu salían como botones con la letra
// sola («V», «L», «C»). Acá se lee el Lua alrededor de cada tecla —los nombres de las funciones que llama, los comandos,
// los textos y los comentarios— y se le da puntos a cada acción conocida; gana la que más suma (con un mínimo: si no, el
// botón queda con la letra, como antes). Las teclas de siempre de Source (Z zoom, F linterna, R recargar...) suman un poco
// de entrada, pero lo que dice el código manda: la F de la Lightsaber es la Fuerza, no la linterna.
// Cada acción: [id, nombre corto (es), (en), glifo, palabras (minúsculas: pedazos de nombres, comandos o textos), prioridad
// para ordenar los botones (más alto, más cerca del pulgar)]
const ACC = [
  ['zoom', 'Zoom', 'Zoom', 'lupa', ['zoom', 'scope', 'binocular', 'magnif', 'telescop', 'fov', 'acercar', 'mira telesc'], 9],
  ['apuntar', 'Apuntar', 'Aim', 'mira', ['ironsight', 'iron sight', 'aimdown', 'ads', 'aim', 'apuntar', 'sights'], 9],
  ['recargar', 'Recargar', 'Reload', 'girar', ['reload', 'recarg', 'magazine'], 8],
  ['linterna', 'Linterna', 'Light', 'linterna', ['flashlight', 'linterna', 'torch', 'lantern', 'lamp', 'luzlinterna'], 7],
  ['vision', 'Visión', 'Vision', 'ojo', ['nightvision', 'night vision', 'nvg', 'nvision', 'nightshot', 'thermal', 'termica', 'infrared', 'vision nocturna', 'goggle', 'visor'], 7],
  ['grabar', 'Grabar', 'Record', 'video', ['record', 'grabar', 'camcorder', 'vhs', 'filmar', 'tape', 'video file', 'standby'], 6],
  ['enfocar', 'Enfocar', 'Focus', 'mira', ['focus', 'enfocar', 'autofocus', 'enfoque'], 5],
  ['guardarArma', 'Guardar', 'Holster', 'bajar', ['holster', 'put away', 'put the', 'guardar el arma', 'enfundar', 'lower weapon'], 4],
  ['soltar', 'Soltar', 'Drop', 'abajo', ['drop', 'soltar', 'set down', 'set the', 'dejar', 'tirar al piso'], 4],
  ['foto', 'Foto', 'Photo', 'camara', ['screenshot', 'photo', 'foto', 'snapshot', 'capture', 'picture'], 5],
  ['granada', 'Granada', 'Grenade', 'granada', ['grenade', 'granada', 'frag', 'throwable', 'molotov', 'flashbang'], 7],
  ['gancho', 'Gancho', 'Hook', 'enviar', ['grapple', 'grappling', 'gancho', 'hook shot', 'rope', 'zipline', 'swing'], 6],
  ['lanzar', 'Lanzar', 'Throw', 'enviar', ['throw', 'lanzar', 'tirar', 'toss', 'launch', 'yeet'], 6],
  ['golpe', 'Golpe', 'Melee', 'cuchillo', ['melee', 'knife', 'cuchillo', 'stab', 'bash', 'punch', 'golpe', 'slash', 'kick', 'patada'], 7],
  ['poder', 'Poder', 'Power', 'rayo', ['force', '~power', 'ability', 'habilidad', 'poder', 'skill', 'spell', 'magic', 'ultimate', '~special', 'superpower'], 8],
  ['escudo', 'Escudo', 'Shield', 'escudo', ['shield', 'escudo', '~block', '~guard', 'parry', 'deflect', 'bloquear'], 6],
  ['modo', 'Modo', 'Mode', 'rafaga', ['firemode', 'fire mode', 'selectivefire', 'burst', 'semi', 'auto fire', '~mode', '~modo'], 5],
  ['silenciador', 'Silenc.', 'Silencer', 'volumen', ['silencer', 'suppressor', 'silenciador', 'silenced'], 4],
  ['inspeccionar', 'Ver arma', 'Inspect', 'ojo', ['inspect', 'inspeccion', 'examine', 'customiz', 'attachment', 'accesorio'], 4],
  ['usar', 'Usar', 'Use', 'mano', ['+use', 'interact', 'usar', 'pickup', 'pick up', 'grab', 'agarrar', 'open door', 'activate'], 6],
  ['puerta', 'Puerta', 'Door', 'puerta', ['door', 'puerta', '~lock', 'unlock', 'hatch', 'gate'], 5],
  ['encender', 'Prender', 'Toggle', 'power', ['~toggle', '~enable', 'setenabled', 'turn on', 'switch on', 'ignite', '~activar', 'encender', 'prender', 'onoff'], 5],
  ['luces', 'Luces', 'Lights', 'foco', ['headlight', 'lights', 'luces', 'faros', 'highbeam', 'lightbar'], 6],
  ['bocina', 'Bocina', 'Horn', 'bocina', ['horn', 'bocina', 'honk', 'klaxon'], 6],
  ['sirena', 'Sirena', 'Siren', 'sirena', ['siren', 'sirena', 'elsiren', 'emergency'], 6],
  ['turbo', 'Turbo', 'Boost', 'rayo', ['boost', 'turbo', 'nitro', 'afterburn', 'thrust', 'dash'], 6],
  ['motor', 'Motor', 'Engine', 'power', ['engine', 'motor', 'ignition', 'startengine'], 5],
  ['subir', 'Subir', 'Up', 'subir', ['ascend', 'altitude up', 'subir', 'climb'], 3],
  ['bajar', 'Bajar', 'Down', 'bajar', ['descend', 'bajar', 'altitude down'], 3],
  ['volar', 'Volar', 'Fly', 'alas', ['fly', 'volar', 'jetpack', 'flight', 'hover', 'glide', 'levitat', 'wings'], 7],
  ['noclip', 'Atravesar', 'Noclip', 'fantasma', ['noclip', 'ghost', 'fantasma', 'intangible'], 4],
  ['camara', 'Cámara', 'Camera', 'vista', ['thirdperson', 'third person', 'tercera', 'firstperson', 'calcview', 'view mode', 'switch camera'], 6],
  ['inclinarIz', 'Incl. ←', 'Lean ←', 'atras', ['leanleft', 'lean left', 'inclin izq', 'peekleft'], 4],
  ['inclinarDe', 'Incl. →', 'Lean →', 'adelante', ['leanright', 'lean right', 'inclin der', 'peekright'], 4],
  ['correr', 'Correr', 'Sprint', 'rayo', ['+speed', 'correr', 'sprint'], 4],
  ['caminar', 'Caminar', 'Walk', 'persona', ['+walk', 'walk', 'caminar', 'slow'], 2],
  ['menu', 'Menú', 'Menu', 'ajustes', ['menu', 'settings', 'options', '~config', 'ajustes', 'control deck'], 5],
  ['inventario', 'Inventario', 'Inventory', 'caja', ['inventory', 'inventario', 'backpack', 'mochila', 'loadout', 'bag'], 5],
  ['mapa', 'Mapa', 'Map', 'mapa', ['minimap', 'mapa', 'radar', 'gps', 'waypoint', 'open map'], 4],
  ['tienda', 'Tienda', 'Shop', 'mas', ['shop', 'buy', 'tienda', 'comprar', 'store', 'purchase'], 4],
  ['siguiente', 'Siguiente', 'Next', 'adelante', ['invnext', 'siguiente', 'selectnext', 'select next'], 3],
  ['anterior', 'Anterior', 'Prev', 'atras', ['invprev', 'anterior', 'selectprev', 'select prev'], 3],
  ['elegir', 'Elegir', 'Select', 'punto', ['~select', 'elegir', '~choose', '~slot'], 2],
  ['deshacer', 'Deshacer', 'Undo', 'atras', ['undo', 'deshacer', 'revert'], 4],
  ['aparecer', 'Crear', 'Spawn', 'mas', ['~spawn', 'crear', 'summon', '~create', '~place'], 4],
  ['borrar', 'Borrar', 'Remove', 'basura', ['~remove', 'delete', 'borrar', '~clear', 'destroy', 'despawn'], 4],
  ['musica', 'Música', 'Music', 'musica', ['music', 'musica', 'song', 'playlist', 'sheetmusic', 'radio', 'tune'], 5],
  ['volumen', 'Volumen', 'Volume', 'volumen', ['volume', 'volumen', 'mute'], 3],
  ['voz', 'Hablar', 'Voice', 'micro', ['voice', 'voz', 'talk', 'mic', 'walkie', 'speak'], 5],
  ['chat', 'Chat', 'Chat', 'chat', ['chat', 'message', 'mensaje', 'say', 'emote menu'], 3],
  ['emote', 'Emote', 'Emote', 'musica', ['emote', 'dance', 'bailar', 'taunt', 'gesture'], 5],
  ['salir', 'Salir', 'Leave', 'salir', ['leave', 'exit', 'salir', 'quit', 'eject', 'instrument_leave'], 4],
  ['ayuda', 'Ayuda', 'Help', 'pregunta', ['help', 'ayuda', 'gm_showhelp', 'tutorial', 'guide'], 3],
  ['equipo', 'Equipo', 'Team', 'gente', ['team', 'equipo', 'gm_showteam', 'squad', 'faction'], 3],
  ['curar', 'Curar', 'Heal', 'corazon', ['heal', 'curar', 'medkit', 'bandage', 'curacion'], 5],
  ['marcar', 'Marcar', 'Mark', 'punto', ['mark', 'ping', 'marcar'], 3],
  ['bloquear', 'Trabar', 'Lock', 'candado', ['lockon', 'lock on', 'trabar', 'fijar'], 4],
];
const ACC_ID = new Map(ACC.map((a) => [a[0], a]));
// (lo que la tecla ya significa en Source/GMod o por costumbre: suma de entrada, menos que el código)
// (las IN_ que son una acción del motor —correr, caminar, recargar, zoom, granada— pesan mucho: el mod usa esa tecla para eso)
const ACC_PREVIO = { 'in:ZOOM': ['zoom', 8], 'bind:+zoom': ['zoom', 8], 'in:RELOAD': ['recargar', 8], 'bind:+reload': ['recargar', 6], 'in:USE': ['usar', 5], 'bind:+use': ['usar', 5],
  'bind:impulse 100': ['linterna', 1.2], 'bind:impulse 201': ['foto', 1], 'in:GRENADE1': ['granada', 8], 'in:GRENADE2': ['granada', 8], 'in:SPEED': ['correr', 8], 'in:WALK': ['caminar', 8], 'in:ATTACK2': ['apuntar', 4],
  'bind:+menu': ['menu', 2], 'bind:+menu_context': ['menu', 2], 'bind:invnext': ['siguiente', 3], 'bind:invprev': ['anterior', 3], 'bind:gm_showhelp': ['ayuda', 3], 'bind:gm_showteam': ['equipo', 3],
  'key:KeyZ': ['zoom', 1], 'key:KeyF': ['linterna', 1], 'key:KeyR': ['recargar', 1], 'key:KeyG': ['granada', 1], 'key:KeyN': ['vision', 1], 'key:KeyH': ['bocina', 0.5], 'key:KeyL': ['luces', 0.5], 'key:KeyV': ['golpe', 0.5],
  'key:KeyI': ['inventario', 1], 'key:KeyM': ['mapa', 1], 'key:KeyB': ['tienda', 0.5], 'key:KeyQ': ['menu', 0.5], 'key:KeyC': ['menu', 0.5], 'key:KeyT': ['foto', 0.3], 'key:KeyX': ['emote', 0.3] };
// partir el texto en palabras sueltas: los nombres en camelCase y con guiones bajos también (ToggleNightVision → toggle night vision)
function accPalabras(s) {
  // (los nombres de las teclas no describen nada: en «KeyPressed(IN_RELOAD) and KeyDown(IN_USE)», la E salía «recargar»)
  return ' ' + String(s).replace(/\b(IN|KEY|MOUSE)_[A-Z0-9_]+\b/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_\-.:()[\]{}"',;=<>!~]+/g, ' ').toLowerCase().replace(/\s+/g, ' ') + ' ';
}
// el texto alrededor de un uso de la tecla: un poco antes (el comentario o el nombre de la función) y bastante después (lo
// que hace). En un PlayerBindPress, hasta el bind siguiente
function accVentana(s, i, largo) {
  let antes = s.slice(Math.max(0, i - 160), i); const despues = s.slice(i + (largo || 0), i + (largo || 0) + 320);
  // (hasta donde empieza otra tecla: en una tabla de teclas —Def("key_zoom", …, KEY_Z, …)— la línea de abajo es de otra)
  const j = despues.search(/\bbind\s*==|\b(KEY|IN)_[A-Z0-9]+\b/);
  const k = Math.max(antes.search(/\b(KEY|IN)_[A-Z0-9]+\b[^]*$/) >= 0 ? antes.lastIndexOf('\n', antes.search(/\b(KEY|IN)_[A-Z0-9]+\b(?![^]*\b(KEY|IN)_[A-Z0-9]+\b)/)) + 1 : 0, 0);
  if (k > 0) antes = antes.slice(k);
  // (la misma línea: muchos mods declaran la tecla con su descripción al lado —CreateClientConVar("x_key", KEY_N, …,
  // "Key: toggle night vision")—, y eso es lo que más dice)
  const l0 = s.lastIndexOf('\n', i) + 1, l1 = s.indexOf('\n', i), linea = s.slice(l0, l1 < 0 ? s.length : l1).slice(0, 400);
  return { antes, despues: j > 12 ? despues.slice(0, j) : despues, linea, textos: (linea.match(/"[^"\n]{3,160}"|'[^'\n]{3,160}'/g) || []).join(' ') };
}
// la acción de una tecla: { id, es, en, glifo, prio, puntos } o null
// (estas son siempre lo que dicen: el motor las usa para eso, aunque el código de al lado hable de otra cosa —un arma
// apaga la mira al correr y decía «ironsights» junto a IN_SPEED—)
const ACC_FIJA = { 'in:SPEED': 'correr', 'in:WALK': 'caminar', 'in:ZOOM': 'zoom', 'bind:+zoom': 'zoom', 'in:RELOAD': 'recargar', 'bind:+reload': 'recargar', 'in:GRENADE1': 'granada', 'in:GRENADE2': 'granada', 'bind:invnext': 'siguiente', 'bind:invprev': 'anterior', 'bind:gm_showhelp': 'ayuda', 'bind:gm_showteam': 'equipo' };
const accDeId = (id, puntos) => { const A = ACC_ID.get(id); return A ? { id: A[0], es: A[1], en: A[2], glifo: A[3], prio: A[5], puntos } : null; };
function accDe(clave, ventanas) {
  if (ACC_FIJA[clave]) return accDeId(ACC_FIJA[clave], 99);
  const P = new Map(), sumar = (id, v) => P.set(id, (P.get(id) || 0) + v);
  const pre = ACC_PREVIO[clave]; if (pre) sumar(pre[0], pre[1]);
  for (const w of ventanas || []) {
    const a = accPalabras(w.antes), d = accPalabras(w.despues), t = accPalabras(w.textos || ''), l = accPalabras(w.linea || '');
    for (const [id, , , , pal] of ACC) for (const p0 of pal) {
      // (las cortas —"ads", "fov"— sólo como palabra entera; las que empiezan con ~ son genéricas —toggle, mode— y pesan menos)
      const debil = p0[0] === '~', q = (debil ? p0.slice(1) : p0).trim(), suelta = q.length <= 3;
      const re = suelta ? ' ' + q + ' ' : q, largo = (q.length >= 6 ? 1.5 : q.length >= 4 ? 1.2 : 1) * (debil ? 0.4 : 1);
      if (t.includes(re)) sumar(id, 3.2 * largo);   // (un texto en la misma línea: la descripción de la tecla)
      else if (l.includes(re)) sumar(id, 2 * largo);
      else if (d.includes(re)) sumar(id, 1.6 * largo);
      else if (a.includes(re)) sumar(id, 0.8 * largo);
    }
  }
  let mejor = null; for (const [id, v] of P) if (!mejor || v > mejor[1]) mejor = [id, v];
  if (!mejor || mejor[1] < 1.6) return null;
  return accDeId(mejor[0], +mejor[1].toFixed(1));
}
// las ventanas de una tecla en un texto (todos sus usos, hasta 6)
function accVentanasDe(s, tok) {
  const L = [], re = new RegExp(tok.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + (/^[A-Z_0-9]+$/.test(tok) ? '\\b' : ''), 'g'); let m;
  while ((m = re.exec(s)) && L.length < 6) {
    if (/\bfrom\s*=\s*$/.test(s.slice(Math.max(0, m.index - 12), m.index))) continue;   // (la tecla vieja que un mod está cambiando por otra)
    L.push(accVentana(s, m.index, m[0].length));
  }
  return L;
}
const accNombre = (a) => (a ? (PREFS.lang === 'es' || !PREFS.lang ? a.es : a.en) : '');
// el botón: el ícono de la acción, su nombre abajo y la tecla chiquita en la esquina; sin acción, la letra como antes
function accBotonHTML(acc, tecla) {
  const t = String(tecla == null ? '' : tecla).slice(0, 6);
  if (!acc) return `<b class="ctlLetra${t.length > 2 ? ' larga' : ''}">${esc(t)}</b>`;
  return `<i class="accIco">${glifo(acc.glifo)}</i><small class="accTxt">${esc(accNombre(acc))}</small>${t ? `<b class="accTecla">${esc(t)}</b>` : ''}`;
}
