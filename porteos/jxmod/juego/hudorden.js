// ---------------- el orden de los botones de arriba a la izquierda (celular) ----------------
// Tres filas, cada una con lo suyo (la proximidad agrupa: lo que está junto se entiende como de lo mismo):
//  1. el sistema: pausa (siempre primera, en la esquina, como en todos los juegos), chat, celular, micrófono, voces;
//  2. lo de crear: props, MOD, GMod, spawn de los mods, Verity;
//  3. las teclas de los mods fijadas, con ícono y nombre.
// Los que se ven van en fila y sin huecos; el orden de cada fila (y en qué fila va cada uno) lo puede cambiar el jugador
// con «Ordenar» (lo más usado más cerca del pulgar) o con «Ordenar con IA». Se guarda en las posiciones del HUD
// (PREFS.hudPos._orden), así «De fábrica», «Cancelar» y «Guardar» del editor valen también para esto.
const HUD_ZONAS = {
  sis: { y: -72, l: ['[data-btn=pausa]', '[data-btn=chat]', '[data-btn=celular]', '#vozBt', '#vocesBt'] },
  crear: { y: -168, l: ['[data-btn=menu]', '.modmBt', '.gmbBt', '.smBt', '#verBt'] },
  hab: { y: -264, l: ['#bgmb0', '#bgmb1', '#bgmb2', '#bgmb3', '#bgmb4', '#bgmb5'] },
};
// (como pide la guía de diseño —diseno/guia_diseno.json—: 32 px de las esquinas, filas cada 96, a lo sumo 6 por fila)
const HUD_ZX0 = 72, HUD_ZPASO = 96, HUD_ZMAX = 6;
// lo que la guía le dice a la IA (armar.py lo pone desde diseno/guia_diseno.json)
const GUIA_DISENO = null;
// (nombres cortos para la IA y para guardar: el selector de cada uno)
const HUD_ZID = { pausa: '[data-btn=pausa]', chat: '[data-btn=chat]', celular: '[data-btn=celular]', microfono: '#vozBt', voces: '#vocesBt', props: '[data-btn=menu]', mod: '.modmBt', gmod: '.gmbBt', spawn: '.smBt', verity: '#verBt',
  tecla1: '#bgmb0', tecla2: '#bgmb1', tecla3: '#bgmb2', tecla4: '#bgmb3', tecla5: '#bgmb4', tecla6: '#bgmb5' };
const HUD_ZSEL = Object.fromEntries(Object.entries(HUD_ZID).map(([k, v]) => [v, k]));
const hudZonaDe = (s) => { for (const z in HUD_ZONAS) if (HUD_ZONAS[z].l.includes(s)) return z; return null; };
// el orden de cada fila: el elegido (si es válido) y, lo que falte, en su fila de siempre
function hudZonasListas(orden) {
  const L = {}, ya = new Set(); for (const z in HUD_ZONAS) L[z] = [];
  if (orden && typeof orden === 'object') for (const z in HUD_ZONAS) for (const s of Array.isArray(orden[z]) ? orden[z] : []) if (hudZonaDe(s) && !ya.has(s) && L[z].length < HUD_ZMAX) { L[z].push(s); ya.add(s); }
  for (const z in HUD_ZONAS) for (const s of HUD_ZONAS[z].l) if (!ya.has(s)) { (L[z].length < HUD_ZMAX ? L[z] : L[Object.keys(L).find((k) => L[k].length < HUD_ZMAX)] || L[z]).push(s); ya.add(s); }
  // (la pausa siempre primera de la primera fila)
  const p = HUD_ZONAS.sis.l[0]; for (const z in L) { const i = L[z].indexOf(p); if (i >= 0) L[z].splice(i, 1); } L.sis.unshift(p); if (L.sis.length > HUD_ZMAX) L.crear.unshift(L.sis.pop());
  return L;
}
// dónde va cada uno de los que se ven (en la referencia 1280×720, desde arriba a la izquierda)
function hudZonasPos(vis, orden) {
  const o = {}, L = hudZonasListas(orden);
  for (const z in L) { let i = 0; for (const s of L[z]) { if (!vis(s)) continue; o[s] = [HUD_ZX0 + HUD_ZPASO * i, HUD_ZONAS[z].y]; i++; } }
  return o;
}
// ---- cuánto se usa cada uno (para ordenar: lo más usado, más cerca del pulgar) ----
const HUD_USO = { n: 0, t: 0 };
function hudUsoContar(e) {
  if (!document.body.classList.contains('tactil') || (typeof CTL !== 'undefined' && CTL.edit)) return;
  const t = e.target && e.target.closest ? e.target : null; if (!t) return;
  for (const s in HUD_ZSEL) if (t.closest(s)) { const u = PREFS.hudUso || (PREFS.hudUso = {}); u[HUD_ZSEL[s]] = Math.min(1e6, (u[HUD_ZSEL[s]] || 0) + 1); if (++HUD_USO.n % 5 === 0 && typeof guardarPrefs === 'function') guardarPrefs(); return; }
}
document.addEventListener('pointerdown', hudUsoContar, true);
// «Ordenar»: cada fila por cuánto se usó (la pausa primera); las que nunca se tocaron, en el orden de siempre
function hudOrdenAuto() {
  const u = PREFS.hudUso || {}, o = {};
  for (const z in HUD_ZONAS) { const L = HUD_ZONAS[z].l.map((s, i) => [s, i]); L.sort((a, b) => (u[HUD_ZSEL[b[0]]] || 0) - (u[HUD_ZSEL[a[0]]] || 0) || a[1] - b[1]); o[z] = L.map((x) => x[0]); }
  return hudZonasListas(o);
}
// ---- «Ordenar con IA»: el Gemini del dueño (por la tienda); si no, tu propia clave de Gemini; si no, la IA pública ----
const HUD_IA_REGLAS = 'Sos diseñador de interfaces de juegos para celular (horizontal). Ordená los botones de arriba a la izquierda del HUD táctil de un sandbox en 3 filas: "sis" (sistema: pausa, chat, celular, micrófono, voces), "crear" (menús de crear: props, mod, gmod, spawn, verity) y "hab" (teclas de mods). Reglas: pausa siempre primera de "sis"; máximo 6 por fila; agrupá por función (proximidad de la Gestalt); dentro de cada fila, a la izquierda lo más usado (más cerca del pulgar izquierdo, ley de Fitts); no repitas ni inventes ids; si un botón de una fila se usa muchísimo más que el resto y es parecido a otra fila, podés moverlo. Contestá SOLO un JSON: {"sis":[ids],"crear":[ids],"hab":[ids],"razon":"una frase"}.';
function hudIAPedido() {
  const u = PREFS.hudUso || {}, nom = (s) => { const e = document.querySelector(s); return e ? (e.title || e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 40) : ''; };
  const b = Object.entries(HUD_ZID).map(([id, s]) => ({ id, fila: hudZonaDe(s), nombre: nom(s), usos: u[id] || 0, hay: !!document.querySelector(s) && !document.querySelector(s).classList.contains('oc') }));
  const g = typeof GUIA_DISENO !== 'undefined' && GUIA_DISENO && GUIA_DISENO.para_ia ? GUIA_DISENO.para_ia : '';
  return { botones: b, guia: g, pantalla: [VW(), VH()] };
}
// lo que contestó la IA → el orden (sólo ids conocidos, sin repetir, máximo 6 por fila, la pausa primera); null si no sirve
function hudIALeer(txt) {
  let o = null; if (txt && typeof txt === 'object') o = txt;
  else { const m = /\{[\s\S]*\}/.exec(String(txt || '').replace(/```(json)?/g, '')); if (m) try { o = JSON.parse(m[0]); } catch (e) { o = null; } }
  if (!o || typeof o !== 'object') return null;
  const r = {}; let n = 0; for (const z in HUD_ZONAS) r[z] = (Array.isArray(o[z]) ? o[z] : []).map((id) => HUD_ZID[String(id).toLowerCase()]).filter(Boolean).slice(0, HUD_ZMAX), n += r[z].length;
  if (n < 4) return null;
  return { orden: hudZonasListas(r), razon: typeof o.razon === 'string' ? o.razon.slice(0, 200) : '' };
}
async function hudOrdenIA() {
  const q = hudIAPedido(), msgs = [{ role: 'system', content: HUD_IA_REGLAS + (q.guia ? '\nGuía: ' + q.guia.slice(0, 1200) : '') }, { role: 'user', content: JSON.stringify({ botones: q.botones, pantalla: q.pantalla }) }];
  const tiempo = (ms) => { const c = new AbortController(); setTimeout(() => c.abort(), ms); return c.signal; };
  // 1. el Gemini del dueño, por la tienda
  try { const r = await fetch(TIENDA_URL + 'ia/hud', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(q), signal: tiempo(30000) }); if (r.ok) { const d = await r.json(), x = hudIALeer(d && d.zonas && typeof d.zonas === 'object' ? Object.assign({}, d.zonas, { razon: d.razon }) : d); if (x) return Object.assign(x, { ia: 'Gemini' }); } } catch (e) {}
  // 2. tu propia clave de Gemini (la de Verity)
  try { if (typeof verGemPropia === 'function' && verGemPropia() && typeof verGemPedir === 'function') { const d = await verGemPedir('gemini-2.5-flash', { systemInstruction: { parts: [{ text: msgs[0].content }] }, contents: [{ role: 'user', parts: [{ text: msgs[1].content }] }], generationConfig: { responseMimeType: 'application/json', temperature: 0.2 } }, 30000); const x = d && hudIALeer(d.texto); if (x) return Object.assign(x, { ia: 'Gemini' }); } } catch (e) {}
  // 3. la IA pública
  try { if (typeof verPublicoTexto === 'function') { const t = await verPublicoTexto(msgs, 45000); const x = hudIALeer(t && (t.texto || t)); if (x) return Object.assign(x, { ia: 'IA' }); } } catch (e) {}
  return null;
}
// (los botones del editor: «Ordenar» y «Ordenar con IA»; dejan el orden en el borrador y las filas sin posiciones propias)
function hudOrdenAplicar(orden) {
  if (typeof CTL === 'undefined' || !CTL.edit) return;
  for (const z in HUD_ZONAS) for (const s of HUD_ZONAS[z].l) delete CTL.borrador[s];
  CTL.borrador._orden = orden; if (typeof ctlMostrar === 'function') ctlMostrar(); else hudDisponer();
}
async function hudOrdenBoton(conIA, b) {
  if (!conIA) { hudOrdenAplicar(hudOrdenAuto()); if (typeof aviso === 'function') aviso(T('hud.ordenado'), 2.5); return; }
  if (b) { b.disabled = true; b.dataset.t = b.textContent; b.textContent = T('hud.pensando'); }
  let x = null; try { x = await hudOrdenIA(); } catch (e) { x = null; }
  if (b) { b.disabled = false; b.textContent = b.dataset.t || T('hud.ordenarIA'); }
  if (!x) { hudOrdenAplicar(hudOrdenAuto()); if (typeof aviso === 'function') aviso(T('hud.iaNo'), 3.5); return; }
  hudOrdenAplicar(x.orden); if (typeof aviso === 'function') aviso(T('hud.iaSi').replace('%i', x.ia) + (x.razon ? ': ' + x.razon : ''), 5);
}
Object.assign(IDI3, {
  'hud.ordenar': ['Ordenar', 'Arrange', 'Organizar', 'Atur', 'Susun', 'Ayusin', '整理', 'จัดเรียง', 'Düzenle', 'ترتيب', 'Упорядочить', 'Упорядкувати', 'Ranger', 'Ordnen'],
  'hud.ordenarIA': ['Ordenar con IA', 'Arrange with AI', 'Organizar com IA', 'Atur dengan AI', 'Susun dengan AI', 'Ayusin gamit ang AI', 'AIで整理', 'จัดเรียงด้วย AI', 'YZ ile düzenle', 'ترتيب بالذكاء الاصطناعي', 'Упорядочить с ИИ', 'Упорядкувати з ШІ', 'Ranger avec l’IA', 'Mit KI ordnen'],
  'hud.pensando': ['Pensando…', 'Thinking…', 'Pensando…', 'Berpikir…', 'Berfikir…', 'Nag-iisip…', '考え中…', 'กำลังคิด…', 'Düşünüyor…', 'يفكر…', 'Думаю…', 'Думаю…', 'Réflexion…', 'Denke nach…'],
  'hud.ordenado': ['Botones ordenados: lo que más usás, más cerca del pulgar', 'Buttons arranged: what you use most is closest to your thumb', 'Botões organizados: o que você mais usa fica mais perto do polegar', 'Tombol diatur: yang paling sering dipakai paling dekat ke jempol', 'Butang disusun: yang paling kerap digunakan paling dekat dengan ibu jari', 'Naayos ang mga button: ang pinakaginagamit mo ang pinakamalapit sa hinlalaki', 'ボタンを整理：よく使うものほど親指の近くに', 'จัดปุ่มแล้ว: ปุ่มที่ใช้บ่อยอยู่ใกล้นิ้วโป้ง', 'Düğmeler düzenlendi: en çok kullandığın başparmağına en yakın', 'تم ترتيب الأزرار: الأكثر استخدامًا أقرب إلى إبهامك', 'Кнопки упорядочены: самые нужные ближе к большому пальцу', 'Кнопки впорядковано: найпотрібніші ближче до великого пальця', 'Boutons rangés : les plus utilisés près du pouce', 'Tasten geordnet: die meistgenutzten am nächsten am Daumen'],
  'hud.iaSi': ['Ordenado por %i', 'Arranged by %i', 'Organizado por %i', 'Diatur oleh %i', 'Disusun oleh %i', 'Inayos ng %i', '%iが整理しました', 'จัดเรียงโดย %i', '%i tarafından düzenlendi', 'رتبه %i', 'Упорядочено: %i', 'Упорядковано: %i', 'Rangé par %i', 'Geordnet von %i'],
  'hud.iaNo': ['La IA no contestó: se ordenó por lo que más usás', 'The AI did not answer: arranged by what you use most', 'A IA não respondeu: organizado pelo que você mais usa', 'AI tidak menjawab: diatur menurut yang paling sering dipakai', 'AI tidak menjawab: disusun mengikut yang paling kerap digunakan', 'Hindi sumagot ang AI: inayos ayon sa pinakaginagamit mo', 'AIが応答しないため、よく使う順に整理しました', 'AI ไม่ตอบ: จัดเรียงตามที่ใช้บ่อย', 'YZ yanıt vermedi: en çok kullandığına göre düzenlendi', 'لم يرد الذكاء الاصطناعي: رُتبت حسب الأكثر استخدامًا', 'ИИ не ответил: упорядочено по частоте', 'ШІ не відповів: впорядковано за частотою', 'L’IA n’a pas répondu : rangé selon l’usage', 'Die KI hat nicht geantwortet: nach Nutzung geordnet'],
});
