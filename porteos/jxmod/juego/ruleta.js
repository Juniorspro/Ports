// ---------------- la ruleta de emotes (como la de Fortnite) ----------------
// Discord: «ruleta de emotes como Fortnite». Mantener apretado el botón de emotes (o la B) abre la ruleta en el medio de
// la pantalla; se desliza el dedo (o se mueve el mouse) hacia uno de los 5 lugares y al soltar el personaje lo hace. Un
// toque corto sigue abriendo el panel de emotes. Soltar en el medio deja la ruleta abierta: se toca un emote o «Editar
// emotes», que deja elegir qué va en cada lugar (desde el panel, con sus secciones y el buscador). Se guarda en el aparato.
const RUL = { n: 5, abierto: false, fija: false, editar: false, sel: -1, mx: 0, my: 0, quien: null, tecla: '', x0: 0, y0: 0, timer: 0, asignar: -1, por: null };
// los emotes de cada lugar: los elegidos o, si nunca se eligieron, los favoritos, los últimos usados y los clásicos
function rulSlots() {
  let L = Array.isArray(PREFS.ruleta) ? PREFS.ruleta.slice(0, RUL.n).map((x) => (typeof x === 'string' && x ? x : null)) : null;
  // (el baile del nene del bote, «aura farming», viene puesto)
  if (!L) { const C = []; for (const id of [...((EMO && EMO.fav) || []), ...((EMO && EMO.rec) || []), 'c:99_01', ...((DATA && DATA.emotes) || [])]) if (!C.includes(id)) C.push(id); L = C.slice(0, RUL.n); }
  while (L.length < RUL.n) L.push(null);
  return L;
}
function rulInfo(id) {
  if (!id) return null;
  if (!RUL.por) RUL.por = new Map(emoLista().map((e) => [e.id, e]));
  return RUL.por.get(id) || { id, n: emoNom(id, id), cat: 'otro' };
}
function rulImg(e) {
  if (!e) return `<div class="rulVacio">+</div>`;
  if (e.mio && !e.foto && !e.mini) { const C = emoClip(e.id); if (C) { try { e.mini = EMO.minis[e.id] || (EMO.minis[e.id] = emoMini(C)); } catch (er) {} } }
  return e.foto ? `<img src="${esc(e.foto)}" alt="">` : DATA.ico[e.ico] ? `<img src="${icono(e.ico)}" alt="">` : e.mini ? emoMiniSVG(e.mini, e.cat) : `<div class="emoCatIco">${emoIcoCat(e.cat)}</div>`;
}
function rulDibujar() {
  let R = $('ruleta');
  if (!R) {
    R = document.createElement('div'); R.id = 'ruleta'; ($('emotes') && $('emotes').parentNode || document.body).appendChild(R);
    R.addEventListener('click', (ev) => {
      if (!RUL.fija) return;
      const x = ev.target.closest('[data-rulx]'); if (x) { ev.stopPropagation(); const L = rulSlots(); L[+x.dataset.rulx] = null; PREFS.ruleta = L; guardarPrefs(); rulDibujar(); return; }
      const l = ev.target.closest('[data-rul]');
      if (l) { const i = +l.dataset.rul; if (RUL.editar) { rulElegirPara(i); return; } const id = rulSlots()[i]; if (id) { rulCerrar(); rulHacer(id); } else rulElegirPara(i); return; }
      if (ev.target.closest('.rulEd')) { RUL.editar = !RUL.editar; rulDibujar(); return; }
      if (ev.target.closest('.rulCerrar') || !ev.target.closest('.rulRueda')) rulCerrar();
    });
    R.addEventListener('mousemove', (ev) => { if (!RUL.abierto || RUL.fija || ENT.bloqueado) return; const r = R.querySelector('.rulRueda').getBoundingClientRect(); RUL.mx = ev.clientX - (r.left + r.width / 2); RUL.my = ev.clientY - (r.top + r.height / 2); rulElegir(); });
  }
  const L = rulSlots(), sel = RUL.sel;
  R.className = RUL.abierto ? (RUL.fija ? 'fija' : '') + (RUL.editar ? ' editar' : '') : 'oc';
  const lug = L.map((id, i) => {
    const a = (i / RUL.n) * Math.PI * 2, x = 50 + 37 * Math.sin(a), y = 50 - 37 * Math.cos(a), e = rulInfo(id);
    return `<div class="rulLug${i === sel ? ' sel' : ''}${id ? '' : ' vacio'}" data-rul="${i}" style="left:${x.toFixed(2)}%;top:${y.toFixed(2)}%">${rulImg(e)}<b dir="auto">${esc(e ? e.n : T('rul.vacio'))}</b>${RUL.editar && id ? `<span class="rulX" data-rulx="${i}" title="${esc(T('quitar'))}">×</span>` : ''}</div>`;
  }).join('');
  const nom = sel >= 0 ? (rulInfo(L[sel]) || { n: T('rul.vacio') }).n : RUL.editar ? T('rul.editando') : T('rul.ayuda');
  R.innerHTML = `<div class="rulRueda">${lug}<div class="rulCentro"><div class="rulNom" dir="auto">${esc(nom)}</div>${RUL.fija ? `<button class="boton rulEd">${esc(T(RUL.editar ? 'rul.listo' : 'rul.editar'))}</button>` : ''}</div></div>${RUL.fija ? `<button class="boton gris rulCerrar">${esc(T('cerrar'))}</button>` : ''}`;
}
// el lugar hacia donde va el dedo o el mouse (en el medio, ninguno)
function rulElegir() {
  const d = Math.hypot(RUL.mx, RUL.my); let s = -1;
  if (d > (RUL.quien === 'tecla' && ENT.bloqueado ? 26 : 30)) { let a = Math.atan2(RUL.mx, -RUL.my); if (a < 0) a += Math.PI * 2; s = Math.round(a / (Math.PI * 2 / RUL.n)) % RUL.n; }
  // (con el mouse trabado, el puntero no se va lejos: queda en el borde de la ruleta)
  if (d > 140) { RUL.mx *= 140 / d; RUL.my *= 140 / d; }
  if (s !== RUL.sel) { RUL.sel = s; if (RUL.abierto) rulDibujar(); }
}
function rulAbrir(fija) {
  RUL.abierto = true; RUL.fija = !!fija; RUL.por = null; if (!fija) { RUL.sel = -1; RUL.editar = false; }
  if (fija) { UI.abierto = 'ruleta'; soltarPuntero(); }
  rulDibujar();
}
function rulCerrar() {
  clearTimeout(RUL.timer); const era = RUL.abierto; RUL.abierto = RUL.fija = RUL.editar = false; RUL.sel = -1; RUL.quien = null;
  if (UI.abierto === 'ruleta') UI.abierto = null;
  if (era) rulDibujar();
}
function rulHacer(id) { if (typeof emote === 'function') emote(id); if (typeof emoUsado === 'function') emoUsado(id); }
// elegir qué va en un lugar: el panel de emotes, y al tocar uno vuelve a la ruleta
function rulElegirPara(i) {
  RUL.asignar = i; RUL.abierto = false; rulDibujar(); UI.abierto = null; abrirEmotes(); if (typeof emoDibujar === 'function') emoDibujar();
}
function rulAsignar(id) {
  const L = rulSlots(); L[RUL.asignar] = id; PREFS.ruleta = L; guardarPrefs(); RUL.asignar = -1;
  cerrarPaneles(); RUL.editar = true; rulAbrir(true);
}
// lo que llega de la entrada: apretar (tecla o dedo), mover el dedo, soltar
function rulApretar(quien, x, y) {
  RUL.quien = quien; RUL.x0 = x; RUL.y0 = y; RUL.mx = RUL.my = 0; RUL.sel = -1;
  clearTimeout(RUL.timer); RUL.timer = setTimeout(() => { if (RUL.quien === quien && !RUL.abierto) rulAbrir(false); }, 230);
}
function rulMover(x, y) {
  if (RUL.quien !== 'toque') return;
  RUL.mx = x - RUL.x0; RUL.my = y - RUL.y0;
  if (!RUL.abierto && Math.hypot(RUL.mx, RUL.my) > 30) { clearTimeout(RUL.timer); rulAbrir(false); }
  rulElegir();
}
function rulSoltar() {
  const quien = RUL.quien; if (!quien) return; clearTimeout(RUL.timer); RUL.quien = null;
  if (!RUL.abierto) { pulso('emotes'); return; }   // (un toque corto: el panel de emotes, como siempre)
  if (RUL.fija) return;
  const id = RUL.sel >= 0 ? rulSlots()[RUL.sel] : null;
  if (RUL.sel < 0) { rulAbrir(true); return; }   // (soltó en el medio: queda abierta para tocar uno o editar)
  rulCerrar(); if (id) rulHacer(id); else rulElegirPara(RUL.sel);
}
// ¿la tecla o el botón de emotes va a la ruleta? (en el juego, sin otro panel abierto)
const rulPuede = () => typeof JUEGO !== 'undefined' && JUEGO.estado === 'juego' && !UI.abierto && JUG.vivo;
Object.assign(IDI3, {
  'rul.editar': ['Editar emotes', 'Edit emotes', 'Editar emotes', 'Ubah emote', 'Sunting emote', 'I-edit ang emotes', 'エモートを編集', 'แก้ไขอีโมต', 'İfadeleri düzenle', 'تعديل التعبيرات', 'Изменить эмоции', 'Змінити емоції', 'Modifier les emotes', 'Emotes bearbeiten'],
  'rul.listo': ['Listo', 'Done', 'Pronto', 'Selesai', 'Siap', 'Tapos', '完了', 'เสร็จ', 'Tamam', 'تم', 'Готово', 'Готово', 'Terminé', 'Fertig'],
  'rul.vacio': ['Vacío', 'Empty', 'Vazio', 'Kosong', 'Kosong', 'Walang laman', '空き', 'ว่าง', 'Boş', 'فارغ', 'Пусто', 'Порожньо', 'Vide', 'Leer'],
  'rul.ayuda': ['Deslizá hacia un emote y soltá', 'Slide to an emote and let go', 'Deslize até um emote e solte', 'Geser ke emote lalu lepas', 'Leret ke emote dan lepaskan', 'I-slide sa emote at bitawan', 'エモートの方へスライドして離す', 'เลื่อนไปที่อีโมตแล้วปล่อย', 'Bir ifadeye kaydır ve bırak', 'اسحب إلى تعبير ثم اترك', 'Проведи к эмоции и отпусти', 'Проведи до емоції й відпусти', 'Glisse vers une emote et relâche', 'Zu einem Emote ziehen und loslassen'],
  'rul.editando': ['Tocá un lugar para elegir su emote', 'Tap a slot to choose its emote', 'Toque um espaço para escolher o emote', 'Ketuk slot untuk memilih emote', 'Ketik slot untuk pilih emote', 'I-tap ang slot para pumili ng emote', '枠をタップしてエモートを選ぶ', 'แตะช่องเพื่อเลือกอีโมต', 'İfadesini seçmek için bir yere dokun', 'المس خانة لاختيار تعبيرها', 'Нажми на ячейку, чтобы выбрать эмоцию', 'Торкнись комірки, щоб вибрати емоцію', 'Touche un emplacement pour choisir son emote', 'Tippe auf einen Platz, um sein Emote zu wählen'],
  'rul.elegir': ['Elegí el emote para el lugar {n} de la ruleta', 'Choose the emote for wheel slot {n}', 'Escolha o emote para o espaço {n} da roleta', 'Pilih emote untuk slot roda {n}', 'Pilih emote untuk slot roda {n}', 'Piliin ang emote para sa slot {n} ng wheel', 'ホイールの枠{n}のエモートを選ぶ', 'เลือกอีโมตสำหรับช่อง {n} ของวงล้อ', 'Çarkın {n}. yeri için ifadeyi seç', 'اختر التعبير للخانة {n} في العجلة', 'Выбери эмоцию для ячейки {n} колеса', 'Вибери емоцію для комірки {n} колеса', 'Choisis l’emote pour l’emplacement {n} de la roue', 'Wähle das Emote für Platz {n} im Rad'],
  'rul.boton': ['Ruleta', 'Wheel', 'Roleta', 'Roda', 'Roda', 'Wheel', 'ホイール', 'วงล้อ', 'Çark', 'العجلة', 'Колесо', 'Колесо', 'Roue', 'Rad'],
});
