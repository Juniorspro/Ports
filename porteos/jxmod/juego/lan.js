// ---------------- partida en la red local (LAN / Wi-Fi), sin internet ----------------
// En la app de Android (apk/web/src/com/jxmod/app/Lan.java) el que hace de anfitrión corre un broker MQTT chico en su
// celular (el mismo protocolo del multijugador de siempre: red.js no cambia, sólo la dirección del broker), anuncia la
// partida por la red cada segundo y, en el mismo puerto, sirve el juego por HTTP. Los demás entran:
//  - con la app: la partida aparece sola en la lista (el anuncio por UDP) o se escribe la IP; la conexión pasa por el
//    puente de la app (ws://127.0.0.1:8767/lan/IP:8765/mqtt: la página de la app es https y el navegador no la deja abrir
//    un ws:// a otra IP de la red —contenido mixto—; a 127.0.0.1 sí);
//  - sin la app (compu, iPhone, otro Android): abriendo http://IP:8765/ en el navegador; el juego viene del celular del
//    anfitrión y se conecta a él. Desde la versión web de siempre (https) no se puede: el navegador bloquea el ws:// a la
//    red local; se avisa y se ofrece abrir http://IP:8765/.
// Sin internet no hay tienda ni cuenta de Google (en la red de casa no se pide), ni los paquetes aparte que no estén ya
// guardados en ese aparato; y en http://IP los navegadores no dan el micrófono (sólo en https o en la misma compu).
const LAN = { host: null, buscando: false, lista: [], t: 0, srv: undefined, ips: [] };
const LAN_PUERTO = 8765;
const lanApp = () => { try { return !!(window.JXNativo && JXNativo.lan && JXNativo.lan() >= 1); } catch (e) { return false; } };
// lo que anuncia un anfitrión (llega de la red: se limpia todo)
function lanDatos(d, ip, puerto) {
  if (!d || typeof d !== 'object' || !/^\d{1,3}(\.\d{1,3}){3}$/.test(String(ip || ''))) return null;
  const du = typeof d.du === 'string' && /^[a-z0-9]{3,20}$/.test(d.du) ? d.du : '';
  if (!du) return null;
  return { ip, puerto: num(+d.p || +puerto, 1, 65535, LAN_PUERTO) | 0, n: limpio(d.n, 16) || '?', s: limpio(d.s, 24) || 'LAN', m: mapaValido(d.m) ? d.m : 'FlatGrass', du, j: num(+d.j, 0, 999, 0) | 0 };
}
// la sala de una partida en la red: el mismo id para todos (sale del anfitrión), sin la tienda ni la lista pública
function lanSala(H, url) {
  return { id: 'lan' + H.du, n: H.s, m: H.m, mo: 'Free', of: 0, rg: 0, pvp: 1, rpg: 1, nb: 1, mp: 1000, mv: 40, pw: 0, du: H.du, dn: H.n, lan: url };
}
// ¿esta página la sirve un anfitrión de la red (http://IP:8765/)? Sus datos, de /lan.json
async function lanServida() {
  if (LAN.srv !== undefined) return LAN.srv;
  LAN.srv = null;
  if (location.protocol !== 'http:' || /^(localhost|127\.)/.test(location.hostname) && !Q.has('lan')) return null;
  try { const c = typeof AbortController === 'function' ? new AbortController() : null; if (c) setTimeout(() => c.abort(), 3000); const d = await (await fetch('/lan.json', { cache: 'no-store', signal: c ? c.signal : undefined })).json(); LAN.srv = lanDatos(d, location.hostname, +location.port || 80); }
  catch (e) { LAN.srv = null; }
  return LAN.srv;
}
// ---- ser anfitrión (sólo en la app) ----
function lanHostear() {
  if (!lanApp()) { rbAviso(T('lan.soloApp')); return; }
  RED.ID = RED.ID || idRed();
  const m = mapaValido(RB.srv.m) ? RB.srv.m : mapaValido(PREFS.mapa) ? PREFS.mapa : 'FlatGrass', nom = limpio(PREFS.nombre, 16) || 'Player', sala = (nom + ' · LAN').slice(0, 24);
  let r = null; try { r = JSON.parse(JXNativo.lanHostear(nom, sala, m, RED.ID)); } catch (e) { r = null; }
  if (!r || !r.ok) { rbAviso(T('lan.noHost')); return; }
  LAN.host = { puerto: r.puerto | 0 || LAN_PUERTO, ips: Array.isArray(r.ips) ? r.ips.filter((x) => /^\d{1,3}(\.\d{1,3}){3}$/.test(x)) : [] };
  entrarSala(lanSala({ du: RED.ID, n: nom, s: sala, m }, 'ws://127.0.0.1:' + LAN.host.puerto + '/mqtt'));
}
// al volver al menú (irMenuPrincipal): si eras anfitrión, la partida se cierra
function lanSalir() {
  if (LAN.host && lanApp()) { try { JXNativo.lanParar(); } catch (e) {} }
  LAN.host = null;
}
// ---- buscar y entrar ----
function lanBuscar(si) {
  LAN.buscando = !!si; clearInterval(LAN.tBusca); LAN.tBusca = 0;
  if (lanApp()) { try { JXNativo.lanBuscar(!!si); } catch (e) {} }
  if (!si) return;
  const leer = () => {
    if (RB.panel !== 'lan' || !rbVisible()) { lanBuscar(false); return; }
    let L = [];
    if (lanApp()) { try { L = JSON.parse(JXNativo.lanHosts() || '[]').map((x) => { let d = null; try { d = JSON.parse(x.d); } catch (e) {} return lanDatos(d, x.ip, d && d.p); }).filter(Boolean); } catch (e) { L = []; } }
    if (LAN.srv) L = [LAN.srv, ...L.filter((H) => H.du !== LAN.srv.du)];
    LAN.lista = L; lanDibujarLista();
  };
  leer(); LAN.tBusca = setInterval(leer, 1000);
}
// la dirección del broker de un anfitrión desde acá (o null: hay que abrir el juego del anfitrión, por el contenido mixto)
function lanUrl(H) {
  if (LAN.srv && H.du === LAN.srv.du) return 'ws://' + location.host + '/mqtt';   // (la página la sirve ese anfitrión)
  if (lanApp()) { let p = 0; try { p = JXNativo.lanPuente(); } catch (e) {} return p ? 'ws://127.0.0.1:' + p + '/lan/' + H.ip + ':' + H.puerto + '/mqtt' : null; }
  if (location.protocol === 'http:') return 'ws://' + H.ip + ':' + H.puerto + '/mqtt';
  return null;
}
function lanUnirse(H) {
  const url = lanUrl(H);
  if (!url) { if (location.protocol === 'https:' && !lanApp()) { location.href = 'http://' + H.ip + ':' + H.puerto + '/'; return; } rbAviso(T('lan.noLlega')); return; }
  lanBuscar(false); entrarSala(lanSala(H, url));
}
// entrar escribiendo la IP (con :puerto si no es el de siempre): se piden los datos de la partida a /lan.json
async function lanUnirseIp(txt) {
  const m = /^\s*(\d{1,3}(?:\.\d{1,3}){3})(?::(\d{2,5}))?\s*$/.exec(String(txt || ''));
  if (!m) { rbAviso(T('lan.ipMal')); return; }
  const ip = m[1], puerto = +(m[2] || LAN_PUERTO);
  let base = null;
  if (lanApp()) { let p = 0; try { p = JXNativo.lanPuente(); } catch (e) {} if (p) base = 'http://127.0.0.1:' + p + '/lan/' + ip + ':' + puerto; }
  else if (location.protocol === 'http:') base = 'http://' + ip + ':' + puerto;
  else { location.href = 'http://' + ip + ':' + puerto + '/'; return; }   // (https sin la app: el juego del anfitrión)
  let H = null;
  try { const c = typeof AbortController === 'function' ? new AbortController() : null; if (c) setTimeout(() => c.abort(), 4000); H = lanDatos(await (await fetch(base + '/lan.json', { cache: 'no-store', signal: c ? c.signal : undefined })).json(), ip, puerto); } catch (e) { H = null; }
  if (!H) { rbAviso(T('lan.noLlega')); return; }
  H.ip = ip; lanUnirse(H);
}
// ---- el panel ----
function panelLan(P) {
  const app = lanApp(), https = location.protocol === 'https:' && !app;
  const ips = app ? (() => { try { return JSON.parse(JXNativo.lanIps() || '[]'); } catch (e) { return []; } })() : [];
  const m = mapaValido(RB.srv.m) ? RB.srv.m : mapaValido(PREFS.mapa) ? PREFS.mapa : 'FlatGrass';
  P.innerHTML = `<div class="rbPanCab">${glifo('wifi')} ${esc(T('lan.tit'))}<span class="rbEsp"></span></div>
    <div class="lanCuerpo">
      <section class="lanSec"><b>${glifo('mas')} ${esc(T('lan.hostTit'))}</b>
        <p>${esc(app ? T('lan.hostTx') : T('lan.soloApp'))}</p>
        ${app ? `<div class="lanFila"><span class="lanMapa"><i class="mpFoto" style="background-image:url(${icono(MAPA_ICONO[m] || MAPA_ICONO.FlatGrass)})"></i>${esc(mapaNom(m))}</span>
          <button class="rbBtnG rbChico" data-rb="lanHost">${glifo('jugar')} ${esc(T('lan.crear'))}</button></div>
          ${ips.length ? `<p class="lanIp">${esc(T('lan.sinApp').replace('{u}', 'http://' + ips[0] + ':' + LAN_PUERTO))}</p>` : `<p class="lanIp">${esc(T('lan.sinRed'))}</p>`}` : ''}
      </section>
      <section class="lanSec"><b>${glifo('gente')} ${esc(T('lan.buscar'))}</b>
        <div class="mpLista lanLista" id="lanLista"></div>
        <div class="lanFila"><input id="lanIp" type="text" inputmode="decimal" autocomplete="off" maxlength="21" placeholder="${esc(T('lan.ip'))}">
          <button class="rbBtnG rbChico" data-rb="lanIp">${esc(T('mp.entrar'))}</button></div>
        ${https ? `<p class="lanIp">${esc(T('lan.https'))}</p>` : ''}
      </section>
    </div>
    <div class="rbPanPie"><button class="rbBtnGris" data-rb="multi">${glifo('atras')} ${esc(T('volver'))}</button></div>`;
  const inp = P.querySelector('#lanIp'); inp.addEventListener('keydown', (e) => { e.stopPropagation(); if (e.key === 'Enter') lanUnirseIp(inp.value); });
  lanServida().then(() => { if (RB.panel === 'lan') lanBuscar(true); });
  lanDibujarLista();
}
function lanDibujarLista() {
  const c = RB.el && RB.el.querySelector('#lanLista'); if (!c) return;
  const html = LAN.lista.map((H) => `<div class="mpSala lanSala"><i class="mpFoto" style="background-image:url(${icono(MAPA_ICONO[H.m] || MAPA_ICONO.FlatGrass)})"></i>
      <div class="mpInfo"><b dir="auto">${esc(H.s)}</b><small>${esc(mapaNom(H.m))} · ${esc(H.ip)}${H.puerto !== LAN_PUERTO ? ':' + H.puerto : ''}</small></div>
      <span class="mpN">${glifo('gente')} ${H.j}</span><button class="rbBtnG rbChico" data-rb="lanEntrar:${esc(H.du)}">${esc(T('mp.entrar'))}</button></div>`).join('')
    || `<div class="rbVacio">${esc(lanApp() || LAN.srv ? T('lan.buscando') : T('lan.webBusca'))}</div>`;
  if (c.dataset.h !== html) { c.dataset.h = html; c.innerHTML = html; }
}
// (las acciones de este panel: rbmenus.js las pasa acá primero)
function lanAccion(a, v) {
  switch (a) {
    case 'lan': inicioPanel('lan'); return true;
    case 'lanHost': lanHostear(); return true;
    case 'lanIp': { const i = RB.el && RB.el.querySelector('#lanIp'); lanUnirseIp(i ? i.value : ''); return true; }
    case 'lanEntrar': { const H = LAN.lista.find((x) => x.du === v); if (H) lanUnirse(H); return true; }
  }
  return false;
}
// abierto desde un anfitrión (http://IP:8765/): se avisa en el inicio cómo entrar a su partida
setTimeout(() => { lanServida().then((H) => { if (H && typeof menuAviso === 'function') menuAviso(T('lan.servida').replace('{n}', H.n)); }); }, 2500);
// el ícono de la red (wifi)
GLIFOS.wifi = '<path d="M2.5 9.2a14 14 0 0 1 19 0M5.6 12.6a9.4 9.4 0 0 1 12.8 0M8.7 16a4.8 4.8 0 0 1 6.6 0" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/><circle cx="12" cy="19.2" r="1.6" fill="currentColor"/>';
// ---- textos (es, en, pt, id, ms, fil, ja, th, tr, ar, ru, uk, fr, de) ----
Object.assign(IDI3, {
  'lan.boton': ['LAN / Wi-Fi', 'LAN / Wi-Fi', 'LAN / Wi-Fi', 'LAN / Wi-Fi', 'LAN / Wi-Fi', 'LAN / Wi-Fi', 'LAN / Wi-Fi', 'LAN / Wi-Fi', 'LAN / Wi-Fi', 'LAN / Wi-Fi', 'LAN / Wi-Fi', 'LAN / Wi-Fi', 'LAN / Wi-Fi', 'LAN / WLAN'],
  'lan.tit': ['Red local (LAN / Wi-Fi), sin internet', 'Local network (LAN / Wi-Fi), no internet', 'Rede local (LAN / Wi-Fi), sem internet', 'Jaringan lokal (LAN / Wi-Fi), tanpa internet', 'Rangkaian setempat (LAN / Wi-Fi), tanpa internet', 'Lokal na network (LAN / Wi-Fi), walang internet', 'ローカルネットワーク（LAN / Wi-Fi）、インターネット不要', 'เครือข่ายท้องถิ่น (LAN / Wi-Fi) ไม่ต้องใช้อินเทอร์เน็ต', 'Yerel ağ (LAN / Wi-Fi), internetsiz', 'شبكة محلية (LAN / Wi-Fi) بدون إنترنت', 'Локальная сеть (LAN / Wi-Fi), без интернета', 'Локальна мережа (LAN / Wi-Fi), без інтернету', 'Réseau local (LAN / Wi-Fi), sans internet', 'Lokales Netzwerk (LAN / WLAN), ohne Internet'],
  'lan.hostTit': ['Ser anfitrión', 'Host a game', 'Ser o anfitrião', 'Jadi tuan rumah', 'Jadi hos', 'Mag-host', 'ホストになる', 'เป็นโฮสต์', 'Sunucu ol', 'استضافة لعبة', 'Стать хостом', 'Стати хостом', 'Héberger', 'Gastgeber sein'],
  'lan.hostTx': ['Tu celular hace de servidor: los demás se unen desde la misma red Wi-Fi o desde tu punto de acceso, sin internet.', 'Your phone is the server: the others join from the same Wi-Fi or your hotspot, no internet needed.', 'Seu celular vira o servidor: os outros entram pelo mesmo Wi-Fi ou pelo seu ponto de acesso, sem internet.', 'Ponselmu jadi server: yang lain bergabung dari Wi-Fi yang sama atau hotspotmu, tanpa internet.', 'Telefon anda jadi pelayan: yang lain sertai dari Wi-Fi yang sama atau hotspot anda, tanpa internet.', 'Ang phone mo ang server: sasali ang iba mula sa parehong Wi-Fi o sa hotspot mo, walang internet.', 'あなたのスマホがサーバーになります。同じWi-Fiかテザリングから、インターネットなしで参加できます。', 'มือถือของคุณเป็นเซิร์ฟเวอร์ คนอื่นเข้าร่วมจาก Wi-Fi เดียวกันหรือฮอตสปอตของคุณ ไม่ต้องใช้อินเทอร์เน็ต', 'Telefonun sunucu olur: diğerleri aynı Wi-Fi’dan veya erişim noktandan, internetsiz katılır.', 'هاتفك هو الخادم: ينضم الآخرون من نفس شبكة Wi-Fi أو من نقطة الاتصال، بدون إنترنت.', 'Твой телефон станет сервером: остальные подключаются через тот же Wi-Fi или твою точку доступа, без интернета.', 'Твій телефон стане сервером: інші приєднуються через той самий Wi-Fi або твою точку доступу, без інтернету.', 'Ton téléphone devient le serveur : les autres rejoignent depuis le même Wi-Fi ou ton point d’accès, sans internet.', 'Dein Handy ist der Server: Die anderen treten über dasselbe WLAN oder deinen Hotspot bei, ohne Internet.'],
  'lan.crear': ['Crear partida en la red', 'Start network game', 'Criar partida na rede', 'Buat permainan jaringan', 'Cipta permainan rangkaian', 'Gumawa ng laro sa network', 'ネットワークゲームを作る', 'สร้างเกมในเครือข่าย', 'Ağ oyunu başlat', 'بدء لعبة على الشبكة', 'Создать игру в сети', 'Створити гру в мережі', 'Créer une partie réseau', 'Netzwerkspiel starten'],
  'lan.sinApp': ['Sin la app (compu, iPhone): abrí {u} en el navegador', 'Without the app (PC, iPhone): open {u} in the browser', 'Sem o app (PC, iPhone): abra {u} no navegador', 'Tanpa aplikasi (PC, iPhone): buka {u} di browser', 'Tanpa aplikasi (PC, iPhone): buka {u} dalam pelayar', 'Kung walang app (PC, iPhone): buksan ang {u} sa browser', 'アプリなし（PC・iPhone）：ブラウザで {u} を開く', 'ไม่มีแอป (PC, iPhone): เปิด {u} ในเบราว์เซอร์', 'Uygulama yoksa (PC, iPhone): tarayıcıda {u} adresini aç', 'بدون التطبيق (كمبيوتر، iPhone): افتح {u} في المتصفح', 'Без приложения (ПК, iPhone): открой {u} в браузере', 'Без застосунку (ПК, iPhone): відкрий {u} у браузері', 'Sans l’appli (PC, iPhone) : ouvre {u} dans le navigateur', 'Ohne App (PC, iPhone): {u} im Browser öffnen'],
  'lan.sinRed': ['No estás en una red Wi-Fi: conectate a una o prendé el punto de acceso', 'You are not on a Wi-Fi network: join one or turn on your hotspot', 'Você não está em uma rede Wi-Fi: conecte-se a uma ou ligue o ponto de acesso', 'Kamu tidak di jaringan Wi-Fi: sambungkan atau nyalakan hotspot', 'Anda tiada dalam rangkaian Wi-Fi: sambung atau hidupkan hotspot', 'Wala ka sa Wi-Fi: kumonekta o buksan ang hotspot', 'Wi-Fiにつながっていません。接続するかテザリングをオンに', 'คุณไม่ได้อยู่ในเครือข่าย Wi-Fi: เชื่อมต่อหรือเปิดฮอตสปอต', 'Bir Wi-Fi ağında değilsin: bağlan veya erişim noktasını aç', 'لست على شبكة Wi-Fi: اتصل بواحدة أو شغّل نقطة الاتصال', 'Ты не в сети Wi-Fi: подключись или включи точку доступа', 'Ти не в мережі Wi-Fi: підключись або увімкни точку доступу', 'Tu n’es pas sur un réseau Wi-Fi : connecte-toi ou active le point d’accès', 'Du bist in keinem WLAN: verbinde dich oder schalte den Hotspot ein'],
  'lan.buscar': ['Partidas en esta red', 'Games on this network', 'Partidas nesta rede', 'Permainan di jaringan ini', 'Permainan dalam rangkaian ini', 'Mga laro sa network na ito', 'このネットワークのゲーム', 'เกมในเครือข่ายนี้', 'Bu ağdaki oyunlar', 'الألعاب على هذه الشبكة', 'Игры в этой сети', 'Ігри в цій мережі', 'Parties sur ce réseau', 'Spiele in diesem Netzwerk'],
  'lan.buscando': ['Buscando partidas en la red…', 'Looking for games on the network…', 'Procurando partidas na rede…', 'Mencari permainan di jaringan…', 'Mencari permainan dalam rangkaian…', 'Naghahanap ng laro sa network…', 'ネットワークでゲームを探しています…', 'กำลังค้นหาเกมในเครือข่าย…', 'Ağda oyun aranıyor…', 'جارٍ البحث عن ألعاب على الشبكة…', 'Ищем игры в сети…', 'Шукаємо ігри в мережі…', 'Recherche de parties sur le réseau…', 'Suche Spiele im Netzwerk…'],
  'lan.webBusca': ['El navegador no puede buscar en la red: escribí la IP del anfitrión', 'The browser cannot scan the network: type the host’s IP', 'O navegador não consegue procurar na rede: digite o IP do anfitrião', 'Browser tidak bisa memindai jaringan: ketik IP tuan rumah', 'Pelayar tidak boleh mengimbas rangkaian: taip IP hos', 'Hindi kaya ng browser na mag-scan ng network: i-type ang IP ng host', 'ブラウザではネットワークを探せません。ホストのIPを入力してください', 'เบราว์เซอร์ค้นหาในเครือข่ายไม่ได้: พิมพ์ IP ของโฮสต์', 'Tarayıcı ağı tarayamaz: sunucunun IP’sini yaz', 'لا يمكن للمتصفح البحث في الشبكة: اكتب عنوان IP للمضيف', 'Браузер не может искать в сети: введи IP хоста', 'Браузер не може шукати в мережі: введи IP хоста', 'Le navigateur ne peut pas scanner le réseau : tape l’IP de l’hôte', 'Der Browser kann das Netzwerk nicht durchsuchen: gib die IP des Gastgebers ein'],
  'lan.ip': ['IP del anfitrión (ej. 192.168.1.5)', 'Host IP (e.g. 192.168.1.5)', 'IP do anfitrião (ex. 192.168.1.5)', 'IP tuan rumah (mis. 192.168.1.5)', 'IP hos (cth. 192.168.1.5)', 'IP ng host (hal. 192.168.1.5)', 'ホストのIP（例：192.168.1.5）', 'IP ของโฮสต์ (เช่น 192.168.1.5)', 'Sunucu IP’si (örn. 192.168.1.5)', 'عنوان IP للمضيف (مثل 192.168.1.5)', 'IP хоста (напр. 192.168.1.5)', 'IP хоста (напр. 192.168.1.5)', 'IP de l’hôte (ex. 192.168.1.5)', 'IP des Gastgebers (z. B. 192.168.1.5)'],
  'lan.ipMal': ['Escribí una IP como 192.168.1.5', 'Type an IP like 192.168.1.5', 'Digite um IP como 192.168.1.5', 'Ketik IP seperti 192.168.1.5', 'Taip IP seperti 192.168.1.5', 'Mag-type ng IP gaya ng 192.168.1.5', '192.168.1.5 のようにIPを入力', 'พิมพ์ IP เช่น 192.168.1.5', '192.168.1.5 gibi bir IP yaz', 'اكتب عنوان IP مثل 192.168.1.5', 'Введи IP вида 192.168.1.5', 'Введи IP на кшталт 192.168.1.5', 'Tape une IP comme 192.168.1.5', 'Gib eine IP wie 192.168.1.5 ein'],
  'lan.noHost': ['No se pudo abrir la partida en la red', 'Could not start the network game', 'Não foi possível abrir a partida na rede', 'Tidak bisa membuat permainan jaringan', 'Tidak dapat memulakan permainan rangkaian', 'Hindi masimulan ang laro sa network', 'ネットワークゲームを開始できませんでした', 'เริ่มเกมในเครือข่ายไม่ได้', 'Ağ oyunu başlatılamadı', 'تعذّر بدء اللعبة على الشبكة', 'Не удалось создать игру в сети', 'Не вдалося створити гру в мережі', 'Impossible de lancer la partie réseau', 'Netzwerkspiel konnte nicht gestartet werden'],
  'lan.noLlega': ['No se encontró una partida en esa dirección', 'No game found at that address', 'Nenhuma partida encontrada nesse endereço', 'Tidak ada permainan di alamat itu', 'Tiada permainan di alamat itu', 'Walang laro sa address na iyon', 'そのアドレスにゲームが見つかりません', 'ไม่พบเกมที่ที่อยู่นั้น', 'O adreste oyun bulunamadı', 'لم يتم العثور على لعبة في هذا العنوان', 'По этому адресу игра не найдена', 'За цією адресою гру не знайдено', 'Aucune partie à cette adresse', 'An dieser Adresse wurde kein Spiel gefunden'],
  'lan.soloApp': ['Para ser anfitrión hace falta la app de Android (el navegador no puede abrir un servidor). Para unirte, escribí la IP del anfitrión.', 'Hosting needs the Android app (a browser cannot run a server). To join, type the host’s IP.', 'Para ser anfitrião é preciso o app de Android (o navegador não pode abrir um servidor). Para entrar, digite o IP do anfitrião.', 'Jadi tuan rumah butuh aplikasi Android (browser tidak bisa menjalankan server). Untuk bergabung, ketik IP tuan rumah.', 'Menjadi hos perlukan aplikasi Android (pelayar tidak boleh menjalankan pelayan). Untuk sertai, taip IP hos.', 'Kailangan ang Android app para mag-host (hindi kaya ng browser magpatakbo ng server). Para sumali, i-type ang IP ng host.', 'ホストにはAndroidアプリが必要です（ブラウザではサーバーを開けません）。参加するにはホストのIPを入力してください。', 'การเป็นโฮสต์ต้องใช้แอป Android (เบราว์เซอร์เปิดเซิร์ฟเวอร์ไม่ได้) หากจะเข้าร่วม ให้พิมพ์ IP ของโฮสต์', 'Sunucu olmak için Android uygulaması gerekir (tarayıcı sunucu açamaz). Katılmak için sunucunun IP’sini yaz.', 'الاستضافة تحتاج تطبيق أندرويد (المتصفح لا يستطيع تشغيل خادم). للانضمام اكتب عنوان IP للمضيف.', 'Чтобы стать хостом, нужно приложение для Android (браузер не может запустить сервер). Чтобы присоединиться, введи IP хоста.', 'Щоб стати хостом, потрібен застосунок для Android (браузер не може запустити сервер). Щоб приєднатися, введи IP хоста.', 'Pour héberger, il faut l’appli Android (un navigateur ne peut pas lancer de serveur). Pour rejoindre, tape l’IP de l’hôte.', 'Zum Hosten braucht es die Android-App (ein Browser kann keinen Server starten). Zum Beitreten die IP des Gastgebers eingeben.'],
  'lan.https': ['Desde esta página (https) el navegador no deja conectarse a la red local: al entrar se abre el juego del anfitrión (http://IP:8765).', 'From this page (https) the browser blocks local network connections: joining opens the host’s game (http://IP:8765).', 'Desta página (https) o navegador bloqueia a rede local: ao entrar abre o jogo do anfitrião (http://IP:8765).', 'Dari halaman ini (https) browser memblokir jaringan lokal: bergabung akan membuka game tuan rumah (http://IP:8765).', 'Dari halaman ini (https) pelayar menyekat rangkaian setempat: menyertai akan membuka permainan hos (http://IP:8765).', 'Mula sa page na ito (https) hinaharang ng browser ang lokal na network: bubuksan ang laro ng host (http://IP:8765).', 'このページ（https）ではブラウザがローカル接続を止めます。参加するとホストのゲーム（http://IP:8765）が開きます。', 'จากหน้านี้ (https) เบราว์เซอร์บล็อกเครือข่ายท้องถิ่น: เมื่อเข้าร่วมจะเปิดเกมของโฮสต์ (http://IP:8765)', 'Bu sayfadan (https) tarayıcı yerel ağı engeller: katılınca sunucunun oyunu açılır (http://IP:8765).', 'من هذه الصفحة (https) يمنع المتصفح الاتصال بالشبكة المحلية: عند الانضمام تُفتح لعبة المضيف (http://IP:8765).', 'С этой страницы (https) браузер не пускает в локальную сеть: при входе откроется игра хоста (http://IP:8765).', 'З цієї сторінки (https) браузер не пускає в локальну мережу: при вході відкриється гра хоста (http://IP:8765).', 'Depuis cette page (https) le navigateur bloque le réseau local : rejoindre ouvre le jeu de l’hôte (http://IP:8765).', 'Von dieser Seite (https) blockiert der Browser das lokale Netz: Beitreten öffnet das Spiel des Gastgebers (http://IP:8765).'],
  'lan.servida': ['Estás en la red de {n}: Multijugador → LAN / Wi-Fi para entrar a su partida', 'You are on {n}’s network: Multiplayer → LAN / Wi-Fi to join their game', 'Você está na rede de {n}: Multijogador → LAN / Wi-Fi para entrar na partida', 'Kamu di jaringan {n}: Multiplayer → LAN / Wi-Fi untuk bergabung', 'Anda dalam rangkaian {n}: Berbilang pemain → LAN / Wi-Fi untuk sertai', 'Nasa network ka ni {n}: Multiplayer → LAN / Wi-Fi para sumali', '{n}のネットワークです。マルチプレイ → LAN / Wi-Fi で参加', 'คุณอยู่ในเครือข่ายของ {n}: ผู้เล่นหลายคน → LAN / Wi-Fi เพื่อเข้าร่วม', '{n} ağındasın: Çok oyunculu → LAN / Wi-Fi ile katıl', 'أنت على شبكة {n}: متعدد اللاعبين ← LAN / Wi-Fi للانضمام', 'Ты в сети {n}: Мультиплеер → LAN / Wi-Fi, чтобы войти', 'Ти в мережі {n}: Мультиплеєр → LAN / Wi-Fi, щоб увійти', 'Tu es sur le réseau de {n} : Multijoueur → LAN / Wi-Fi pour rejoindre', 'Du bist im Netzwerk von {n}: Mehrspieler → LAN / WLAN zum Beitreten'],
});
