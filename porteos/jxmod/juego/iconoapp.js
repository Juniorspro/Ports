// ---------------- el ícono de la app (como en Discord: Ajustes → Ícono de la app) ----------------
// Los que vienen (iconosapp.js, armados por herramientas/iconos_app.py) y uno con tu imagen:
//  - Android (la app): el que vienen cambia el ícono de verdad (Web.java: una entrada del lanzador por ícono, prendida
//    sólo la elegida; el lanzador lo cambia en unos segundos). Tu imagen: Android no deja que una app se ponga un ícono
//    cualquiera, así que se agrega un acceso directo con tu imagen (como «Tu logo»);
//  - iPhone/iPad (la app instalada): los que vienen con el cambio de ícono de iOS (avisa el sistema);
//  - iPhone/iPad en Safari: el elegido (o tu imagen) es el que queda al «Agregar a inicio», y también se puede bajar el
//    instalador (.mobileconfig) con ese ícono;
//  - en la compu: se guarda para cuando la instales.
const ICAPP = { k: 'jx_icono_app', kp: 'jx_icono_propio' };
const icappNativo = () => !!(window.JXNativo && JXNativo.iconoApp);
const icappIOSApp = () => !!(window.webkit && window.webkit.messageHandlers && window.webkit.messageHandlers.jx);
function icappElegido() { try { return localStorage.getItem(ICAPP.k) || (icappNativo() && JXNativo.iconoActual ? JXNativo.iconoActual() : 'clasico'); } catch (e) { return 'clasico'; } }
function icappPropio() { try { const u = localStorage.getItem(ICAPP.kp); return u && /^data:image\/png;base64,/.test(u) ? u : null; } catch (e) { return null; } }
// (la imagen del ícono para «Agregar a inicio» de Safari y para el instalador: 180 px)
function icappImagen(id) { if (id === 'propio') return icappPropio(); const x = ICONOS_APP.find((i) => i.id === id); return x ? x.png : null; }
function icappPonerEnSafari(id) {
  const u = id === 'propio' ? icappPropio() : (typeof JX_APPWEB !== 'undefined' ? 'app/icono-' + id + '-180.png' : icappImagen(id)); if (!u) return;
  let l = document.querySelector('link[rel=apple-touch-icon]'); if (!l) { l = document.createElement('link'); l.rel = 'apple-touch-icon'; document.head.appendChild(l); }
  l.href = u;
}
// tu imagen → un PNG cuadrado de 512 (recortada al medio, sin estirar)
async function icappLeer(file) {
  const url = URL.createObjectURL(file);
  try {
    const im = await new Promise((ok, mal) => { const i = new Image(); i.onload = () => ok(i); i.onerror = mal; i.src = url; });
    const w = im.naturalWidth, h = im.naturalHeight; if (!w || !h) return null;
    const c = document.createElement('canvas'); c.width = c.height = 512; const g = c.getContext('2d'), s = Math.max(512 / w, 512 / h);
    g.fillStyle = '#000'; g.fillRect(0, 0, 512, 512); g.drawImage(im, (512 - w * s) / 2, (512 - h * s) / 2, w * s, h * s);
    return c.toDataURL('image/png');
  } catch (e) { return null; } finally { URL.revokeObjectURL(url); }
}
// el instalador para iPhone/iPad (perfil de configuración con un «web clip»: queda como una app en la pantalla de inicio,
// a pantalla completa, con el ícono elegido). Se baja y se instala desde Ajustes → Perfil descargado
function icappPerfil(id) {
  const img = (icappImagen(id) || ICONOS_APP[0].png).split(',')[1], uu = () => (crypto.randomUUID ? crypto.randomUUID() : 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => ((Math.random() * 16) | 0).toString(16))).toUpperCase();
  const url = typeof JX_APPWEB !== 'undefined' ? new URL('index.html', location.href).href : 'https://raw.githack.com/Juniorspro/Ports/claude/ports-continuation-dm754a/web/index.html';
  const u1 = uu(), u2 = uu();
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>PayloadContent</key><array><dict>
<key>FullScreen</key><true/><key>IsRemovable</key><true/><key>Precomposed</key><true/><key>IgnoreManifestScope</key><true/>
<key>Icon</key><data>${img}</data><key>Label</key><string>JXMod</string><key>URL</key><string>${url}</string>
<key>PayloadType</key><string>com.apple.webClip.managed</string><key>PayloadVersion</key><integer>1</integer>
<key>PayloadIdentifier</key><string>com.jxmod.webclip.${u1}</string><key>PayloadUUID</key><string>${u1}</string><key>PayloadDisplayName</key><string>JXMod</string>
</dict></array>
<key>PayloadDisplayName</key><string>JXMod</string><key>PayloadDescription</key><string>JXMod en la pantalla de inicio</string>
<key>PayloadIdentifier</key><string>com.jxmod.perfil.${u2}</string><key>PayloadUUID</key><string>${u2}</string>
<key>PayloadType</key><string>Configuration</string><key>PayloadVersion</key><integer>1</integer><key>PayloadRemovalDisallowed</key><false/>
</dict></plist>`;
}
function icappBajarPerfil(id) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([icappPerfil(id)], { type: 'application/x-apple-aspen-config' }));
  a.download = 'JXMod.mobileconfig'; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
}
function icappSeccion() {
  const sel = icappElegido(), propio = icappPropio();
  const tile = (id, n, png) => `<button class="icTile${id === sel ? ' sel' : ''}" data-ic="${id}"><img alt="" src="${png}"><span>${esc(n)}</span></button>`;
  return `<h4>${esc(T('ic.titulo'))}</h4><p class="lgAyuda">${esc(T(icappNativo() ? 'ic.ayudaAndroid' : icappIOSApp() ? 'ic.ayudaIOS' : (typeof IOS !== 'undefined' && IOS) ? 'ic.ayudaSafari' : 'ic.ayudaWeb'))}</p>
    <div class="icGrilla">${ICONOS_APP.map((x) => tile(x.id, T('ic.' + x.id) || x.n, x.png)).join('')}
      <button class="icTile icPropio${sel === 'propio' ? ' sel' : ''}" data-ic="propio">${propio ? `<img alt="" src="${propio}">` : `<i class="icMas">${glifo('mas')}</i>`}<span>${esc(T('ic.tuya'))}</span></button></div>
    <input type="file" id="icArch" accept="image/png,image/jpeg,image/webp,image/gif" class="oc">
    ${(typeof IOS !== 'undefined' && IOS) && !icappIOSApp() ? `<button class="ajBtn gris" id="icPerfil">${esc(T('ic.perfil'))}</button>` : ''}
    <p class="lgEst" id="icEst"></p>`;
}
function icappConectar() {
  const est = (t) => { const e = $('icEst'); if (e) e.textContent = t; };
  const marcar = (id) => { for (const b of document.querySelectorAll('.icTile')) b.classList.toggle('sel', b.dataset.ic === id); };
  const aplicar = (id) => {
    try { localStorage.setItem(ICAPP.k, id); } catch (e) {}
    marcar(id);
    if (icappNativo()) {
      if (id === 'propio') { const u = icappPropio(); const r = u && JXNativo.accesoDirecto ? JXNativo.accesoDirecto('JXMod', u.split(',')[1]) : 'mal'; est(T(r === 'ok' ? 'ic.atajoOk' : r === 'no' ? 'ic.atajoNo' : 'ic.mal')); return; }
      est(T(JXNativo.iconoApp(id) === 'ok' ? 'ic.okAndroid' : 'ic.mal')); return;
    }
    if (icappIOSApp()) { if (id === 'propio') { est(T('ic.propioIOS')); return; } try { window.webkit.messageHandlers.jx.postMessage({ k: 'icono', id }); est(T('ic.okIOS')); } catch (e) { est(T('ic.mal')); } return; }
    icappPonerEnSafari(id); est(T((typeof IOS !== 'undefined' && IOS) ? 'ic.okSafari' : 'ic.okWeb'));
  };
  const g = document.querySelector('.icGrilla'); if (!g) return;
  g.onclick = (e) => { const b = e.target.closest('[data-ic]'); if (!b) return; if (b.dataset.ic === 'propio' && (!icappPropio() || b.classList.contains('sel'))) { $('icArch').click(); return; } aplicar(b.dataset.ic); };
  $('icArch').onchange = async (e) => {
    const f = e.target.files && e.target.files[0]; e.target.value = ''; if (!f) return;
    if (f.size > 25e6) { est(T('lg.grande')); return; }
    const u = await icappLeer(f); if (!u) { est(T('lg.mal')); return; }
    try { localStorage.setItem(ICAPP.kp, u); } catch (x) { est(T('lg.sinLugar')); return; }
    const t = g.querySelector('.icPropio'); if (t) t.innerHTML = `<img alt="" src="${u}"><span>${esc(T('ic.tuya'))}</span>`;
    aplicar('propio');
  };
  if ($('icPerfil')) $('icPerfil').onclick = () => { icappBajarPerfil(icappElegido()); est(T('ic.perfilAyuda')); };
}
// al abrir el juego en Safari: el ícono elegido es el de «Agregar a inicio»
try { const id = localStorage.getItem(ICAPP.k); if (id && id !== 'clasico' && !icappNativo()) icappPonerEnSafari(id); } catch (e) {}
Object.assign(IDI3, {
  'ic.titulo': ['Ícono de la app', 'App icon', 'Ícone do app', 'Ikon aplikasi', 'Ikon aplikasi', 'Icon ng app', 'アプリのアイコン', 'ไอคอนแอป', 'Uygulama simgesi', 'أيقونة التطبيق', 'Значок приложения', 'Значок застосунку', 'Icône de l’app', 'App-Symbol'],
  'ic.ayudaAndroid': ['Elegí cómo se ve JXMod en tu pantalla de inicio. El lanzador lo cambia en unos segundos (algunos cierran la app al cambiarlo).', 'Choose how JXMod looks on your home screen. The launcher updates it in a few seconds (some close the app when it changes).', 'Escolha como o JXMod aparece na tela inicial. O launcher troca em alguns segundos (alguns fecham o app ao trocar).', 'Pilih tampilan JXMod di layar utama. Launcher menggantinya dalam beberapa detik (beberapa menutup aplikasi saat diganti).', 'Pilih rupa JXMod di skrin utama. Pelancar menukarnya dalam beberapa saat (ada yang menutup aplikasi).', 'Piliin ang itsura ng JXMod sa home screen. Papalitan ito ng launcher sa ilang segundo (may mga nagsasara ng app).', 'ホーム画面での JXMod の見た目を選べます。数秒で切り替わります（アプリが閉じる場合あり）。', 'เลือกหน้าตา JXMod บนหน้าจอหลัก ตัวเรียกใช้จะเปลี่ยนในไม่กี่วินาที (บางเครื่องปิดแอป)', 'Ana ekranda JXMod’un görünümünü seç. Başlatıcı birkaç saniyede değiştirir (bazıları uygulamayı kapatır).', 'اختر شكل JXMod على الشاشة الرئيسية. يتغير خلال ثوانٍ (قد يُغلق التطبيق).', 'Выбери, как JXMod выглядит на главном экране. Значок сменится за несколько секунд (иногда приложение закрывается).', 'Обери, як JXMod виглядає на головному екрані. Значок зміниться за кілька секунд (іноді застосунок закривається).', 'Choisis l’apparence de JXMod sur l’écran d’accueil. Le lanceur la change en quelques secondes (certains ferment l’app).', 'Wähle, wie JXMod auf dem Startbildschirm aussieht. Der Launcher ändert es in Sekunden (manche schließen die App).'],
  'ic.ayudaIOS': ['Elegí cómo se ve JXMod en tu pantalla de inicio. iOS te avisa cuando lo cambia.', 'Choose how JXMod looks on your home screen. iOS will tell you when it changes.', 'Escolha como o JXMod aparece na tela inicial. O iOS avisa quando trocar.', 'Pilih tampilan JXMod di layar utama. iOS akan memberi tahu.', 'Pilih rupa JXMod di skrin utama. iOS akan memaklumkan.', 'Piliin ang itsura ng JXMod. Sasabihan ka ng iOS.', 'ホーム画面での見た目を選べます。iOS が知らせます。', 'เลือกหน้าตา JXMod iOS จะแจ้งเมื่อเปลี่ยน', 'Ana ekrandaki görünümü seç. iOS haber verir.', 'اختر شكل JXMod. سيخبرك iOS بالتغيير.', 'Выбери значок JXMod. iOS сообщит о смене.', 'Обери значок JXMod. iOS повідомить про зміну.', 'Choisis l’icône de JXMod. iOS te préviendra.', 'Wähle das JXMod-Symbol. iOS sagt Bescheid.'],
  'ic.ayudaSafari': ['El que elijas es el que queda al agregarla a inicio (Compartir → «Agregar a inicio»). Si ya la tenés, borrala y agregala de nuevo, o bajá el instalador.', 'The one you pick is used when you add it to the home screen (Share → "Add to Home Screen"). If you already have it, remove and add it again, or download the installer.', 'O escolhido é usado ao adicionar à tela inicial. Se já tem, remova e adicione de novo, ou baixe o instalador.', 'Yang dipilih dipakai saat menambahkan ke layar utama. Jika sudah ada, hapus lalu tambahkan lagi, atau unduh penginstal.', 'Yang dipilih digunakan semasa menambah ke skrin utama. Jika sudah ada, buang dan tambah semula, atau muat turun pemasang.', 'Ito ang gagamitin pag idinagdag sa home screen. Kung meron na, alisin at idagdag ulit, o i-download ang installer.', 'ホーム画面に追加するときに使われます。追加済みなら削除して追加し直すか、インストーラーを。', 'ใช้ตอนเพิ่มไปที่หน้าจอหลัก ถ้ามีแล้วให้ลบแล้วเพิ่มใหม่ หรือดาวน์โหลดตัวติดตั้ง', 'Ana ekrana eklerken kullanılır. Zaten varsa silip yeniden ekle ya da yükleyiciyi indir.', 'يُستخدم عند الإضافة إلى الشاشة الرئيسية. إن كان موجودًا احذفه وأضفه مجددًا أو نزّل المثبّت.', 'Используется при добавлении на экран «Домой». Если уже есть — удали и добавь снова или скачай установщик.', 'Використовується під час додавання на початковий екран. Якщо вже є — видали й додай знову або завантаж інсталятор.', 'Utilisé en ajoutant à l’écran d’accueil. Si c’est déjà fait, supprime et rajoute, ou télécharge l’installeur.', 'Wird beim Hinzufügen zum Home-Bildschirm benutzt. Wenn schon vorhanden: löschen und neu hinzufügen oder Installer laden.'],
  'ic.ayudaWeb': ['Se usa cuando instales JXMod en este aparato.', 'It is used when you install JXMod on this device.', 'É usado quando instalar o JXMod neste aparelho.', 'Dipakai saat memasang JXMod di perangkat ini.', 'Digunakan semasa memasang JXMod.', 'Gagamitin pag ini-install ang JXMod.', 'この端末に JXMod を入れるときに使われます。', 'ใช้ตอนติดตั้ง JXMod ในเครื่องนี้', 'JXMod’u bu cihaza kurarken kullanılır.', 'يُستخدم عند تثبيت JXMod على هذا الجهاز.', 'Используется при установке JXMod.', 'Використовується під час встановлення JXMod.', 'Utilisé à l’installation de JXMod.', 'Wird beim Installieren von JXMod benutzt.'],
  'ic.tuya': ['Tu imagen', 'Your image', 'Sua imagem', 'Gambarmu', 'Imej anda', 'Larawan mo', '自分の画像', 'รูปของคุณ', 'Kendi resmin', 'صورتك', 'Своя картинка', 'Своє зображення', 'Ton image', 'Dein Bild'],
  'ic.perfil': ['Bajar el instalador para iPhone', 'Download the iPhone installer', 'Baixar o instalador para iPhone', 'Unduh penginstal iPhone', 'Muat turun pemasang iPhone', 'I-download ang installer para sa iPhone', 'iPhone 用インストーラーをダウンロード', 'ดาวน์โหลดตัวติดตั้ง iPhone', 'iPhone yükleyicisini indir', 'تنزيل مثبّت iPhone', 'Скачать установщик для iPhone', 'Завантажити інсталятор для iPhone', 'Télécharger l’installeur iPhone', 'iPhone-Installer laden'],
  'ic.perfilAyuda': ['Tocá «Permitir», después Ajustes → «Perfil descargado» → Instalar. Queda JXMod en tu pantalla de inicio con ese ícono.', 'Tap "Allow", then Settings → "Profile Downloaded" → Install. JXMod appears on your home screen with that icon.', 'Toque «Permitir», depois Ajustes → «Perfil baixado» → Instalar.', 'Ketuk «Izinkan», lalu Pengaturan → «Profil Diunduh» → Instal.', 'Ketik «Benarkan», kemudian Tetapan → «Profil Dimuat Turun» → Pasang.', 'I-tap ang «Payagan», tapos Settings → «Profile Downloaded» → Install.', '「許可」→ 設定 →「プロファイルがダウンロード済み」→ インストール。', 'แตะ «อนุญาต» แล้วไปที่ การตั้งค่า → «ดาวน์โหลดโปรไฟล์แล้ว» → ติดตั้ง', '«İzin Ver», sonra Ayarlar → «Profil İndirildi» → Yükle.', 'اضغط «سماح» ثم الإعدادات ← «تم تنزيل ملف التعريف» ← تثبيت.', 'Нажми «Разрешить», затем Настройки → «Профиль загружен» → Установить.', 'Натисни «Дозволити», потім Параметри → «Профіль завантажено» → Інсталювати.', 'Touche « Autoriser », puis Réglages → « Profil téléchargé » → Installer.', 'Tippe „Zulassen“, dann Einstellungen → „Profil geladen“ → Installieren.'],
  'ic.okAndroid': ['Listo: el ícono cambia en unos segundos.', 'Done: the icon changes in a few seconds.', 'Pronto: o ícone muda em alguns segundos.', 'Selesai: ikon berubah dalam beberapa detik.', 'Siap: ikon bertukar dalam beberapa saat.', 'Tapos: magbabago ang icon sa ilang segundo.', '完了：数秒でアイコンが変わります。', 'เสร็จแล้ว: ไอคอนจะเปลี่ยนในไม่กี่วินาที', 'Tamam: simge birkaç saniyede değişir.', 'تم: تتغير الأيقونة خلال ثوانٍ.', 'Готово: значок сменится через несколько секунд.', 'Готово: значок зміниться за кілька секунд.', 'C’est fait : l’icône change dans quelques secondes.', 'Fertig: Das Symbol ändert sich in Sekunden.'],
  'ic.okIOS': ['Listo.', 'Done.', 'Pronto.', 'Selesai.', 'Siap.', 'Tapos.', '完了。', 'เสร็จแล้ว', 'Tamam.', 'تم.', 'Готово.', 'Готово.', 'C’est fait.', 'Fertig.'],
  'ic.okSafari': ['Listo: es el que queda al agregarla a inicio.', 'Done: it is used when you add it to the home screen.', 'Pronto: é o usado ao adicionar à tela inicial.', 'Selesai: dipakai saat ditambahkan ke layar utama.', 'Siap: digunakan semasa ditambah ke skrin utama.', 'Tapos: ito ang gagamitin sa home screen.', '完了：ホーム画面に追加するときに使われます。', 'เสร็จแล้ว: ใช้ตอนเพิ่มไปหน้าจอหลัก', 'Tamam: ana ekrana eklerken kullanılır.', 'تم: يُستخدم عند الإضافة إلى الشاشة الرئيسية.', 'Готово: будет на экране «Домой».', 'Готово: буде на початковому екрані.', 'C’est fait : utilisé sur l’écran d’accueil.', 'Fertig: Wird auf dem Home-Bildschirm benutzt.'],
  'ic.okWeb': ['Guardado.', 'Saved.', 'Salvo.', 'Tersimpan.', 'Disimpan.', 'Nai-save.', '保存しました。', 'บันทึกแล้ว', 'Kaydedildi.', 'تم الحفظ.', 'Сохранено.', 'Збережено.', 'Enregistré.', 'Gespeichert.'],
  'ic.atajoOk': ['Android no deja que una app se ponga cualquier imagen de ícono: se agregó un acceso directo con tu imagen.', 'Android does not let apps use any image as their icon: a shortcut with your image was added.', 'O Android não deixa usar qualquer imagem como ícone: foi adicionado um atalho com sua imagem.', 'Android tidak mengizinkan gambar apa pun sebagai ikon: pintasan dengan gambarmu ditambahkan.', 'Android tidak membenarkan sebarang imej sebagai ikon: pintasan dengan imej anda ditambah.', 'Hindi pinapayagan ng Android ang kahit anong larawan bilang icon: nagdagdag ng shortcut na may larawan mo.', 'Android では任意の画像をアイコンにできないため、その画像のショートカットを追加しました。', 'Android ไม่ให้ใช้รูปใดๆ เป็นไอคอน จึงเพิ่มทางลัดที่มีรูปของคุณ', 'Android her resmi simge yapmaya izin vermiyor: resminle bir kısayol eklendi.', 'لا يسمح Android بأي صورة كأيقونة: أُضيف اختصار بصورتك.', 'Android не разрешает любую картинку как значок: добавлен ярлык с твоей картинкой.', 'Android не дозволяє будь-яке зображення як значок: додано ярлик із твоїм зображенням.', 'Android n’autorise pas n’importe quelle image comme icône : un raccourci avec ton image a été ajouté.', 'Android erlaubt kein beliebiges Bild als Symbol: Eine Verknüpfung mit deinem Bild wurde hinzugefügt.'],
  'ic.atajoNo': ['Tu lanzador no deja agregar accesos directos.', 'Your launcher does not allow shortcuts.', 'Seu launcher não permite atalhos.', 'Launcher-mu tidak mengizinkan pintasan.', 'Pelancar anda tidak membenarkan pintasan.', 'Hindi pinapayagan ng launcher ang shortcut.', 'ランチャーがショートカットに対応していません。', 'ตัวเรียกใช้ไม่รองรับทางลัด', 'Başlatıcın kısayola izin vermiyor.', 'المشغّل لا يسمح بالاختصارات.', 'Лаунчер не позволяет ярлыки.', 'Лаунчер не дозволяє ярлики.', 'Ton lanceur n’accepte pas les raccourcis.', 'Dein Launcher erlaubt keine Verknüpfungen.'],
  'ic.propioIOS': ['En la app de iPhone sólo se pueden los que vienen; con tu imagen, usá el instalador desde Safari.', 'The iPhone app can only use the included icons; for your image, use the installer from Safari.', 'No app de iPhone só os incluídos; com sua imagem, use o instalador pelo Safari.', 'Di app iPhone hanya ikon bawaan; untuk gambarmu, pakai penginstal dari Safari.', 'Aplikasi iPhone hanya ikon sedia ada; untuk imej anda, guna pemasang dari Safari.', 'Sa iPhone app, mga kasama lang; para sa larawan mo, gamitin ang installer sa Safari.', 'iPhone アプリでは付属のアイコンのみ。自分の画像は Safari のインストーラーで。', 'แอป iPhone ใช้ได้เฉพาะไอคอนที่มี ใช้รูปของคุณผ่านตัวติดตั้งใน Safari', 'iPhone uygulamasında yalnızca hazır simgeler; kendi resmin için Safari’deki yükleyiciyi kullan.', 'في تطبيق iPhone الأيقونات المرفقة فقط؛ لصورتك استخدم المثبّت من Safari.', 'В приложении для iPhone только встроенные; для своей картинки — установщик из Safari.', 'У застосунку для iPhone лише вбудовані; для свого зображення — інсталятор із Safari.', 'Dans l’app iPhone, seulement les icônes fournies ; pour ton image, utilise l’installeur depuis Safari.', 'In der iPhone-App nur die mitgelieferten; für dein Bild den Installer in Safari nutzen.'],
  'ic.mal': ['No se pudo cambiar el ícono.', 'Could not change the icon.', 'Não deu para trocar o ícone.', 'Gagal mengganti ikon.', 'Gagal menukar ikon.', 'Hindi napalitan ang icon.', 'アイコンを変更できませんでした。', 'เปลี่ยนไอคอนไม่ได้', 'Simge değiştirilemedi.', 'تعذّر تغيير الأيقونة.', 'Не удалось сменить значок.', 'Не вдалося змінити значок.', 'Impossible de changer l’icône.', 'Symbol konnte nicht geändert werden.'],
  'ic.clasico': ['Clásico', 'Classic', 'Clássico', 'Klasik', 'Klasik', 'Klasiko', 'クラシック', 'คลาสสิก', 'Klasik', 'كلاسيكي', 'Классика', 'Класика', 'Classique', 'Klassisch'],
  'ic.noche': ['Noche', 'Night', 'Noite', 'Malam', 'Malam', 'Gabi', 'ナイト', 'กลางคืน', 'Gece', 'ليل', 'Ночь', 'Ніч', 'Nuit', 'Nacht'],
  'ic.dorado': ['Dorado', 'Gold', 'Dourado', 'Emas', 'Emas', 'Ginto', 'ゴールド', 'ทอง', 'Altın', 'ذهبي', 'Золото', 'Золото', 'Doré', 'Gold'],
  'ic.neon': ['Neón', 'Neon', 'Neon', 'Neon', 'Neon', 'Neon', 'ネオン', 'นีออน', 'Neon', 'نيون', 'Неон', 'Неон', 'Néon', 'Neon'],
  'ic.rojo': ['Rojo', 'Red', 'Vermelho', 'Merah', 'Merah', 'Pula', 'レッド', 'แดง', 'Kırmızı', 'أحمر', 'Красный', 'Червоний', 'Rouge', 'Rot'],
  'ic.blanco': ['Blanco', 'White', 'Branco', 'Putih', 'Putih', 'Puti', 'ホワイト', 'ขาว', 'Beyaz', 'أبيض', 'Белый', 'Білий', 'Blanc', 'Weiß'],
  'ic.azul': ['Azul', 'Blue', 'Azul', 'Biru', 'Biru', 'Asul', 'ブルー', 'น้ำเงิน', 'Mavi', 'أزرق', 'Синий', 'Синій', 'Bleu', 'Blau'],
  'ic.vhs': ['VHS', 'VHS', 'VHS', 'VHS', 'VHS', 'VHS', 'VHS', 'VHS', 'VHS', 'VHS', 'VHS', 'VHS', 'VHS', 'VHS'],
});
