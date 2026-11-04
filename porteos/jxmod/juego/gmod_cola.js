// ---------------- descargas en segundo plano ----------------
// Los addons del Workshop (mods, mapas, personajes) van a una cola y se bajan solos: se puede cerrar la tienda, entrar a
// una partida o a un server y seguir jugando mientras tanto. Cada uno, al terminar, se monta y se activa ahí mismo (su
// Lua corre, sus armas, props y NPCs aparecen en el menú Q, sus mapas en la lista, sus personajes en Personajes → Mods) y
// se avisa qué trajo. Arriba, al centro, una pastilla con lo que está bajando (tocándola se ven todas y se cancelan).
// La cola queda guardada: si se cierra el juego a la mitad, lo que faltaba sigue solo al volver a abrirlo.
const GMC = { l: [], activos: 0, el: null, abierta: false, dib: 0, traba: 75000, trabaLarga: 180000 };
// (de a uno en celulares con poca memoria: descomprimir dos addons grandes a la vez los cerraba)
const gmcMax = () => (navigator.deviceMemory && navigator.deviceMemory <= 4 ? 1 : 2);
const gmcDe = (id) => GMC.l.find((x) => x.id === String(id) && x.estado !== 'listo' && x.estado !== 'error') || null;
function gmcGuardar() {
  try { localStorage.setItem('jx_cola', JSON.stringify(GMC.l.filter((x) => x.estado === 'espera' || x.estado === 'bajando').map((x) => ({ id: x.id, n: x.n, img: x.img })))); } catch (e) {}
}
// poner un addon en la cola; devuelve una promesa con el addon ya montado (la misma si ya estaba en la cola)
function gmcPoner(id, meta) {
  id = String(id); meta = meta || {};
  if (typeof GMOD !== 'undefined' && GMOD.addons.has(id)) { const A = GMOD.addons.get(id); return Promise.resolve(A.listo).then(() => A); }
  const ya = gmcDe(id); if (ya) return ya.prom;
  const x = { id, n: meta.nombre || id, img: meta.img || '', p: 0, fase: 'espera', estado: 'espera', t0: Date.now(), callado: !!meta.callado };
  x.prom = new Promise((ok, mal) => { x.ok = ok; x.mal = mal; }); x.prom.catch(() => {});
  GMC.l.push(x); gmcGuardar(); gmcSeguir(); gmcDibujar(true);
  return x.prom;
}
function gmcSeguir() {
  while (GMC.activos < gmcMax()) { const x = GMC.l.find((y) => y.estado === 'espera'); if (!x) break; gmcBajar(x); }
}
// (una descarga que no avanza nada —ni un byte— en 75 s, o 3 min mientras se descomprime o se monta, se da por trabada:
// se corta ese intento y se vuelve a intentar solo, hasta 3 veces; después queda con «Reintentar»)
const GMC_TRABA_MS = (fase) => (fase === 'montando' || fase === 'descomprimiendo' ? GMC.trabaLarga : GMC.traba);
async function gmcBajar(x) {
  x.estado = 'bajando'; x.fase = 'conectando'; x.p = 0; GMC.activos++; x.intentos = (x.intentos || 0) + 1; const gen = (x.gen = (x.gen || 0) + 1); x.tP = Date.now(); gmcDibujar(true);
  // (cancelar a la mitad, o un intento viejo que siguió solo después de darse por trabado: el aviso de avance tira un
  // error y esa bajada se corta ahí)
  const prog = (p, fase) => {
    if (x.cancelar || x.gen !== gen) throw Object.assign(new Error('cancelado'), { cancelado: true });
    const q = Math.max(x.p, Math.min(1, p || 0)); if (q > x.p + 1e-4 || (fase && fase !== x.fase)) x.tP = Date.now(); x.p = q; if (fase) x.fase = fase; gmcDibujar();
  };
  let vig = 0, reintentar = false;
  const trabada = new Promise((_, mal) => { vig = setInterval(() => { if (Date.now() - x.tP > GMC_TRABA_MS(x.fase)) { clearInterval(vig); mal(Object.assign(new Error(T('gmc.trabada')), { trabado: true })); } }, 2000); });
  try {
    const A = await Promise.race([(async () => { const A = await gmInstalar(x.id, { nombre: x.n, img: x.img }, null, prog); if (A && A.listo) await A.listo; return A; })(), trabada]);
    if (x.cancelar) { gmQuitar(x.id); throw Object.assign(new Error('cancelado'), { cancelado: true }); }
    x.estado = 'listo'; x.p = 1; x.A = A; x.ok(A);
    if (!x.callado) gmcAvisoListo(A);
  } catch (e) {
    // (trabada o sin red: otra vez, solo, hasta 3 intentos; lo que no existe o no tiene archivo, no)
    const red = e && (e.trabado || e.name === 'TypeError');
    if (red && !x.cancelar && x.intentos < 3) { reintentar = true; x.gen++; }
    else {
      x.estado = 'error'; x.err = e && e.cancelado ? '' : String((e && e.message) || e).slice(0, 120); x.mal(e);
      if (!(e && e.cancelado) && !x.callado) { const sin = !!(e && e.sinArchivo); gmcAviso((sin ? T('gm.sinArchivo') : x.err) + ' · ' + x.n, 4); }
    }
  } finally {
    clearInterval(vig); GMC.activos--;
    if (reintentar) { x.estado = 'espera'; x.fase = 'reintento'; x.p = 0; }
    gmcGuardar(); gmcSeguir(); gmcDibujar(true);
    // (lo terminado se ve un rato con su tilde y después se va de la lista; lo que falló, más, con «Reintentar»)
    if (!reintentar) setTimeout(() => { const i = GMC.l.indexOf(x); if (i >= 0 && (x.estado === 'listo' || x.estado === 'error')) { GMC.l.splice(i, 1); gmcDibujar(true); } }, x.estado === 'error' && x.err ? 30000 : 5000);
    gmcRefrescarVistas();
  }
}
// «Reintentar» en uno que falló: sale de la lista y vuelve a la cola desde cero
function gmcReintentar(id) {
  const x = GMC.l.find((y) => y.id === String(id) && y.estado === 'error'); if (!x) return;
  GMC.l.splice(GMC.l.indexOf(x), 1); gmcPoner(x.id, { nombre: x.n, img: x.img, callado: x.callado });
}
function gmcCancelar(id) {
  const x = gmcDe(id); if (!x) return;
  if (x.estado === 'espera') { GMC.l.splice(GMC.l.indexOf(x), 1); const e = Object.assign(new Error('cancelado'), { cancelado: true }); x.mal(e); gmcGuardar(); gmcDibujar(true); gmcRefrescarVistas(); return; }
  x.cancelar = true; x.fase = 'cancelando'; gmcDibujar(true);
}
// (la tienda, Personajes y el menú Q, si están a la vista, con el estado nuevo)
function gmcRefrescarVistas() {
  try { if (typeof RB !== 'undefined' && RB.t && RB.t.tab === 'gmod' && typeof gmTiendaDibujar === 'function') gmTiendaDibujar(); } catch (e) {}
  try { if (typeof pjmDibujar === 'function') pjmDibujar(); } catch (e) {}
}
const gmcAviso = (t, s) => { if (typeof JUEGO !== 'undefined' && JUEGO.estado === 'juego' && typeof aviso === 'function' && !(typeof rbVisible === 'function' && rbVisible())) aviso(t, s || 4); else if (typeof menuAviso === 'function') menuAviso(t); };
// qué trajo y dónde está: armas, entidades, NPCs, vehículos, props, mapas, personajes, modos de juego
function gmcAvisoListo(A) {
  if (!A) return;
  const n = (k, c) => (c ? c + ' ' + T(k) : ''), mapas = typeof GBSP !== 'undefined' ? [...GBSP.mapas.values()].filter((m) => m.id === A.id).length : 0;
  const pms = typeof gmpLista === 'function' ? gmpLista().filter((r) => A.G && A.G.archivos.has(r)).length : 0;
  const partes = [n('gm.t.Weapon', (A.sweps || []).length), n('gm.t.Entity', (A.sents || []).length), n('gm.t.NPC', A.listas && A.listas.NPC ? A.listas.NPC.size : 0), n('gm.t.Vehicle', A.listas && A.listas.Vehicles ? A.listas.Vehicles.size : 0), n('gm.modelos', (A.props || []).length)].filter(Boolean);
  let t = T('gmc.listo') + ': ' + A.nombre;
  if (partes.length) t += ' · ' + partes.slice(0, 3).join(' · ') + ' · ' + T('gmc.enQ');
  if (mapas) t += ' · ' + T('gmc.mapa');
  if (pms) t += ' · ' + T('gmc.pj');
  gmcAviso(t, 5);
}
// al abrir el juego: lo que quedó a medio bajar la última vez
function gmcReanudar() {
  let L = []; try { L = JSON.parse(localStorage.getItem('jx_cola') || '[]') || []; } catch (e) {}
  for (const x of L) if (x && /^[\w:.-]{1,40}$/.test(String(x.id)) && !(GMOD.addons.has(String(x.id)))) gmcPoner(x.id, { nombre: x.n, img: x.img });
}
// ---- la pastilla de descargas (en el menú y jugando) ----
function gmcDibujar(ya) {
  const t = performance.now(); if (!ya && t - GMC.dib < 200) { if (!GMC.pend) GMC.pend = setTimeout(() => { GMC.pend = 0; gmcDibujar(true); }, 220); return; } GMC.dib = t;
  try { if (typeof RB !== 'undefined' && RB.t && RB.t.tab === 'gmod' && RB.t.ficha && typeof gmTiendaDibujar === 'function') gmTiendaDibujar(); } catch (e) {}
  let E = GMC.el;
  if (!GMC.l.length) { if (E) E.classList.add('oc'); GMC.abierta = false; return; }
  if (!E) {
    E = GMC.el = document.createElement('div'); E.id = 'gmCola'; document.body.appendChild(E);
    E.addEventListener('pointerdown', (e) => e.stopPropagation());
    E.addEventListener('click', (e) => { e.stopPropagation(); const r = e.target.closest('[data-gmcr]'); if (r) { gmcReintentar(r.dataset.gmcr); return; } const b = e.target.closest('[data-gmc]'); if (b) { gmcCancelar(b.dataset.gmc); return; } GMC.abierta = !GMC.abierta; gmcDibujar(true); });
  }
  const vivos = GMC.l.filter((x) => x.estado === 'espera' || x.estado === 'bajando'), cur = GMC.l.find((x) => x.estado === 'bajando') || vivos[0] || GMC.l[GMC.l.length - 1];
  const pct = (x) => Math.round(x.p * 100) + '%', fase = (x) => x.estado === 'listo' ? T('gmc.listo') : x.estado === 'error' ? (x.err ? T('gmc.error') : T('gmc.cancelado')) : x.estado === 'espera' ? (x.fase === 'reintento' ? T('gmc.reintento') + ' (' + (x.intentos + 1) + '/3)' : T('gmc.espera')) : x.fase === 'cancelando' ? T('gmc.cancelando') : x.fase === 'descomprimiendo' ? T('gm.descomp') : x.fase === 'conectando' ? T('gmc.conectando') : x.fase === 'montando' ? T('gmc.montando') : T('gm.bajando');
  const fila = (x) => `<div class="gmcF ${x.estado}"><b dir="auto">${esc(x.n)}</b><span>${esc(fase(x))}${x.estado === 'bajando' ? ' ' + pct(x) : ''}</span>${x.estado === 'espera' || x.estado === 'bajando' ? `<button data-gmc="${esc(x.id)}" aria-label="${esc(T('cancelar'))}">✕</button>` : x.estado === 'error' && x.err ? `<button class="gmcR" data-gmcr="${esc(x.id)}">${esc(T('reintentar'))}</button>` : ''}<i style="width:${x.estado === 'listo' ? 100 : Math.round(x.p * 100)}%"></i></div>`;
  E.className = (GMC.abierta ? 'abierta' : '') + (vivos.length ? '' : ' fin');
  E.innerHTML = `<div class="gmcCab"><span class="gmcIco"></span><b dir="auto">${esc(cur.n)}</b><span>${cur.estado === 'bajando' ? pct(cur) : esc(fase(cur))}</span>${vivos.length > 1 ? `<em>+${vivos.length - 1}</em>` : ''}<i style="width:${cur.estado === 'listo' ? 100 : Math.round(cur.p * 100)}%"></i></div>` + (GMC.abierta ? `<div class="gmcLista">${GMC.l.map(fila).join('')}</div>` : '');
}

// ---------------- textos (es, en, pt, id, ms, fil, ja, th, tr, ar, ru, uk, fr, de) ----------------
Object.assign(IDI3, {
  'gmc.listo': ['Instalado y activo', 'Installed and active', 'Instalado e ativo', 'Terpasang dan aktif', 'Dipasang dan aktif', 'Naka-install at aktibo', 'インストール済み・有効', 'ติดตั้งและเปิดใช้แล้ว', 'Kuruldu ve etkin', 'مثبّت ومفعّل', 'Установлено и включено', 'Встановлено й увімкнено', 'Installé et actif', 'Installiert und aktiv'],
  'gmc.enQ': ['en el menú Q', 'in the Q menu', 'no menu Q', 'di menu Q', 'dalam menu Q', 'sa Q menu', 'Qメニューに追加', 'อยู่ในเมนู Q', 'Q menüsünde', 'في قائمة Q', 'в меню Q', 'у меню Q', 'dans le menu Q', 'im Q-Menü'],
  'gmc.mapa': ['mapa nuevo en Nueva partida', 'new map in New game', 'mapa novo em Novo jogo', 'peta baru di Permainan baru', 'peta baharu dalam Permainan baharu', 'bagong mapa sa Bagong laro', '新しいマップは「新しいゲーム」に', 'แผนที่ใหม่ในเกมใหม่', 'yeni harita Yeni oyun’da', 'خريطة جديدة في لعبة جديدة', 'новая карта в «Новой игре»', 'нова мапа в «Новій грі»', 'nouvelle carte dans Nouvelle partie', 'neue Karte unter Neues Spiel'],
  'gmc.pj': ['personaje nuevo en Personajes → Mods', 'new character in Characters → Mods', 'personagem novo em Personagens → Mods', 'karakter baru di Karakter → Mod', 'watak baharu dalam Watak → Mod', 'bagong karakter sa Mga karakter → Mods', '新キャラはキャラクター → Mod に', 'ตัวละครใหม่ใน ตัวละคร → ม็อด', 'yeni karakter Karakterler → Modlar’da', 'شخصية جديدة في الشخصيات ← المودات', 'новый персонаж в «Персонажи → Моды»', 'новий персонаж у «Персонажі → Моди»', 'nouveau personnage dans Personnages → Mods', 'neuer Charakter unter Charaktere → Mods'],
  'gmc.espera': ['En cola', 'Queued', 'Na fila', 'Mengantre', 'Dalam baris gilir', 'Nakapila', '待機中', 'อยู่ในคิว', 'Sırada', 'في الانتظار', 'В очереди', 'У черзі', 'En attente', 'In der Warteschlange'],
  'gmc.error': ['No se pudo', 'Failed', 'Falhou', 'Gagal', 'Gagal', 'Hindi nagawa', '失敗', 'ไม่สำเร็จ', 'Başarısız', 'تعذّر', 'Не удалось', 'Не вдалося', 'Échec', 'Fehlgeschlagen'],
  'gmc.cancelado': ['Cancelado', 'Cancelled', 'Cancelado', 'Dibatalkan', 'Dibatalkan', 'Kinansela', 'キャンセル済み', 'ยกเลิกแล้ว', 'İptal edildi', 'أُلغي', 'Отменено', 'Скасовано', 'Annulé', 'Abgebrochen'],
  'gmc.cancelando': ['Cancelando', 'Cancelling', 'Cancelando', 'Membatalkan', 'Membatalkan', 'Kinakansela', 'キャンセル中', 'กำลังยกเลิก', 'İptal ediliyor', 'جارٍ الإلغاء', 'Отмена', 'Скасування', 'Annulation', 'Wird abgebrochen'],
  'gmc.conectando': ['Conectando', 'Connecting', 'Conectando', 'Menghubungkan', 'Menyambung', 'Kumokonekta', '接続中', 'กำลังเชื่อมต่อ', 'Bağlanıyor', 'جارٍ الاتصال', 'Подключение', 'Підключення', 'Connexion', 'Verbinde'],
  'gmc.montando': ['Instalando', 'Installing', 'Instalando', 'Memasang', 'Memasang', 'Ini-install', 'インストール中', 'กำลังติดตั้ง', 'Kuruluyor', 'جارٍ التثبيت', 'Установка', 'Встановлення', 'Installation', 'Installiere'],
  'gmc.reintento': ['Se trabó, otra vez', 'Stalled, retrying', 'Travou, de novo', 'Macet, mencoba lagi', 'Tersekat, cuba lagi', 'Naipit, uulitin', '止まったので再試行', 'ค้าง กำลังลองใหม่', 'Takıldı, yeniden', 'تعطّل، إعادة', 'Зависло, ещё раз', 'Зависло, ще раз', 'Bloqué, nouvel essai', 'Hängt, neuer Versuch'],
  'gmc.trabada': ['La descarga se trabó', 'The download stalled', 'O download travou', 'Unduhan macet', 'Muat turun tersekat', 'Naipit ang download', 'ダウンロードが止まりました', 'การดาวน์โหลดค้าง', 'İndirme takıldı', 'تعطّل التنزيل', 'Загрузка зависла', 'Завантаження зависло', 'Le téléchargement est bloqué', 'Der Download hängt'],
  'reintentar': ['Reintentar', 'Retry', 'Tentar de novo', 'Coba lagi', 'Cuba lagi', 'Subukan muli', '再試行', 'ลองใหม่', 'Tekrar dene', 'أعد المحاولة', 'Повторить', 'Повторити', 'Réessayer', 'Erneut'],
  'cancelar': ['Cancelar', 'Cancel', 'Cancelar', 'Batal', 'Batal', 'Kanselahin', 'キャンセル', 'ยกเลิก', 'İptal', 'إلغاء', 'Отмена', 'Скасувати', 'Annuler', 'Abbrechen']
});
