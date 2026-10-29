// ---------------- idiomas de HypperX RezoBox (textos propios; el menú clásico usa los del juego si existen) ----------------
// Cada idioma es una sola cadena separada por "|" en el orden de IDI_K (se revisa en las pruebas que coincidan).
const IDIOMAS_RB = {
  es: ['Español', '🇪🇸', 'SP'], en: ['English', '🇬🇧', 'EN'], pt: ['Português', '🇧🇷', 'PO'], id: ['Bahasa Indonesia', '🇮🇩', 'ID'],
  ms: ['Bahasa Melayu', '🇲🇾', 'EN'], fil: ['Filipino', '🇵🇭', 'EN'], ja: ['日本語', '🇯🇵', 'EN'], th: ['ไทย', '🇹🇭', 'EN'],
  tr: ['Türkçe', '🇹🇷', 'EN'], ar: ['العربية', '🇸🇦', 'EN'], ru: ['Русский', '🇷🇺', 'RU'], uk: ['Українська', '🇺🇦', 'UA'],
  fr: ['Français', '🇫🇷', 'EN'], de: ['Deutsch', '🇩🇪', 'EN'],
};
const IDI_K = ('m.nueva m.multi m.tienda m.personajes m.opciones m.clasico m.salir volver empezar unJugador hora h.normal h.dia h.tarde h.noche h.ciclo ' +
  'sinMods modsAct c.todos c.tierra c.espacio c.comunidad t.mods t.mapas buscar o.pop o.nuevo o.desc e.todas e.jugabilidad e.fisica e.armas e.personajes ' +
  'e.diversion e.construccion e.vehiculos e.aventura e.pvp e.otros v.tienda v.instalados instalar quitar activado oficial por descargas cargando sinRes ' +
  'errRed publicar p.mod p.mapa p.archivo nombre desc etiquetas icono publicado clave denunciar meGusta jugar f.gravedad f.velocidad f.salto f.tiempo ' +
  'f.explosion f.municion f.invencible f.skin f.hora ninguna exportar mapaBase objetos nadaConstr b.tit b.idioma b.nombre b.seguir salirAviso aplicaMods ' +
  'instalado errFormato goku.n goku.d luna.n luna.d salto.n salto.d veloz.n veloz.d balas.n balas.d dios.n dios.d lenta.n lenta.d boom.n boom.d ' +
  'm.Desert m.DesertV2 m.FlatGrass m.City m.Base m.BaseV2 m.Mars m.Space').split(' ');
const IDI_T = {
  es: 'Empezar partida nueva|Buscar partida multijugador|Mods y mapas|Personajes|Opciones|Menú clásico|Salir|Volver|Empezar partida|Un jugador|Hora|Normal|Día|Atardecer|Noche|Ciclo día/noche|' +
    'Sin mods|mods activos|Todos los mapas|Tierra|Espacio|Comunidad|Mods|Mapas|Buscar…|Populares|Nuevos|Más descargados|Todas|Jugabilidad|Física|Armas|Personajes|' +
    'Diversión|Construcción|Vehículos|Aventura|PvP|Otros|Explorar|Instalados|Instalar|Quitar|Activado|Oficial|por|descargas|Cargando…|No hay resultados|' +
    'No se pudo conectar con la tienda|Publicar|Crear un mod|Publicar mi construcción|Subir archivo (.rbmod / .rbmapa)|Nombre|Descripción|Etiquetas|Ícono|¡Publicado!|Guardá esta clave para poder borrarlo:|Denunciar|Me gusta|Jugar|Gravedad|Velocidad|Salto|Velocidad del tiempo|' +
    'Explosiones|Munición infinita|Invencible|Personaje|Hora fija|Ninguna|Descargar archivo|Mapa base|objetos|Construí algo y guardalo (pausa → Guardar) para poder publicarlo|¡Bienvenido a HypperX RezoBox!|Elegí tu idioma|Tu nombre|Continuar|Para salir, cerrá la pestaña|Se aplican al empezar una partida|' +
    'Instalado|El archivo no es un mod o mapa válido|Goku|Aparecés como Goku: corrés y saltás como un Saiyajin.|Gravedad lunar|Todo cae despacio: saltos largos y props que flotan.|Súper salto|Saltás cuatro veces más alto.|Velocidad|Caminás y corrés casi al doble.|Munición infinita|Las armas nunca se quedan sin balas.|Modo Dios|No recibís daño de nada.|Cámara lenta|El mundo va a la mitad de velocidad.|Explosiones gigantes|Explosiones mucho más grandes y fuertes.|' +
    'Desierto|Desierto II|Pasto plano|Ciudad|Base|Base II|Marte|Espacio',
  en: 'Start New Game|Find Multiplayer Game|Mods & Maps|Characters|Options|Classic menu|Quit|Back|Start Game|Single Player|Time|Default|Day|Sunset|Night|Day/night cycle|' +
    'No mods|mods on|All maps|Earth|Space|Community|Mods|Maps|Search…|Popular|Newest|Most downloaded|All|Gameplay|Physics|Weapons|Characters|' +
    'Fun|Building|Vehicles|Adventure|PvP|Other|Browse|Installed|Install|Remove|Enabled|Official|by|downloads|Loading…|No results|' +
    'Could not reach the store|Publish|Create a mod|Publish my build|Upload file (.rbmod / .rbmapa)|Name|Description|Tags|Icon|Published!|Keep this key to be able to delete it:|Report|Like|Play|Gravity|Speed|Jump|Time speed|' +
    'Explosions|Infinite ammo|Invincible|Character|Fixed time|None|Download file|Base map|objects|Build something and save it (pause → Save) to publish it|Welcome to HypperX RezoBox!|Choose your language|Your name|Continue|To quit, close the tab|Applied when a match starts|' +
    'Installed|This file is not a valid mod or map|Goku|Spawn as Goku: run and jump like a Saiyan.|Moon gravity|Everything falls slowly: long jumps and floating props.|Super jump|Jump four times higher.|Speed|Walk and run almost twice as fast.|Infinite ammo|Weapons never run out of ammo.|God mode|You take no damage at all.|Slow motion|The world runs at half speed.|Huge explosions|Much bigger and stronger explosions.|' +
    'Desert|Desert II|Flatgrass|City|Base|Base II|Mars|Space',
  pt: 'Começar novo jogo|Procurar jogo multijogador|Mods e mapas|Personagens|Opções|Menu clássico|Sair|Voltar|Começar jogo|Um jogador|Hora|Padrão|Dia|Pôr do sol|Noite|Ciclo dia/noite|' +
    'Sem mods|mods ativos|Todos os mapas|Terra|Espaço|Comunidade|Mods|Mapas|Buscar…|Populares|Novos|Mais baixados|Todas|Jogabilidade|Física|Armas|Personagens|' +
    'Diversão|Construção|Veículos|Aventura|PvP|Outros|Explorar|Instalados|Instalar|Remover|Ativado|Oficial|por|downloads|Carregando…|Sem resultados|' +
    'Não foi possível conectar à loja|Publicar|Criar um mod|Publicar minha construção|Enviar arquivo (.rbmod / .rbmapa)|Nome|Descrição|Etiquetas|Ícone|Publicado!|Guarde esta chave para poder apagá-lo:|Denunciar|Curtir|Jogar|Gravidade|Velocidade|Pulo|Velocidade do tempo|' +
    'Explosões|Munição infinita|Invencível|Personagem|Hora fixa|Nenhuma|Baixar arquivo|Mapa base|objetos|Construa algo e salve (pausa → Salvar) para publicar|Bem-vindo ao HypperX RezoBox!|Escolha seu idioma|Seu nome|Continuar|Para sair, feche a aba|Aplicados ao começar uma partida|' +
    'Instalado|O arquivo não é um mod ou mapa válido|Goku|Você aparece como Goku: corre e pula como um Saiyajin.|Gravidade lunar|Tudo cai devagar: pulos longos e objetos flutuando.|Super pulo|Pula quatro vezes mais alto.|Velocidade|Anda e corre quase o dobro.|Munição infinita|As armas nunca ficam sem balas.|Modo Deus|Você não recebe dano.|Câmera lenta|O mundo vai na metade da velocidade.|Explosões gigantes|Explosões muito maiores e mais fortes.|' +
    'Deserto|Deserto II|Grama plana|Cidade|Base|Base II|Marte|Espaço',
  id: 'Mulai permainan baru|Cari permainan multipemain|Mod & peta|Karakter|Opsi|Menu klasik|Keluar|Kembali|Mulai|Pemain tunggal|Waktu|Normal|Siang|Senja|Malam|Siklus siang/malam|' +
    'Tanpa mod|mod aktif|Semua peta|Bumi|Luar angkasa|Komunitas|Mod|Peta|Cari…|Populer|Terbaru|Paling banyak diunduh|Semua|Gameplay|Fisika|Senjata|Karakter|' +
    'Seru|Bangunan|Kendaraan|Petualangan|PvP|Lainnya|Jelajahi|Terpasang|Pasang|Hapus|Aktif|Resmi|oleh|unduhan|Memuat…|Tidak ada hasil|' +
    'Tidak bisa terhubung ke toko|Terbitkan|Buat mod|Terbitkan bangunanku|Unggah file (.rbmod / .rbmapa)|Nama|Deskripsi|Tag|Ikon|Diterbitkan!|Simpan kunci ini untuk bisa menghapusnya:|Laporkan|Suka|Main|Gravitasi|Kecepatan|Lompat|Kecepatan waktu|' +
    'Ledakan|Amunisi tak terbatas|Kebal|Karakter|Waktu tetap|Tidak ada|Unduh file|Peta dasar|objek|Bangun sesuatu dan simpan (jeda → Simpan) untuk menerbitkannya|Selamat datang di HypperX RezoBox!|Pilih bahasamu|Namamu|Lanjut|Untuk keluar, tutup tab|Berlaku saat permainan dimulai|' +
    'Terpasang|File ini bukan mod atau peta yang valid|Goku|Muncul sebagai Goku: lari dan lompat seperti Saiyan.|Gravitasi bulan|Semua jatuh pelan: lompatan jauh dan benda melayang.|Super lompat|Lompat empat kali lebih tinggi.|Kecepatan|Jalan dan lari hampir dua kali lipat.|Amunisi tak terbatas|Senjata tidak pernah kehabisan peluru.|Mode dewa|Kamu tidak menerima kerusakan.|Gerak lambat|Dunia berjalan setengah kecepatan.|Ledakan raksasa|Ledakan jauh lebih besar dan kuat.|' +
    'Gurun|Gurun II|Rumput datar|Kota|Pangkalan|Pangkalan II|Mars|Luar angkasa',
  ms: 'Mula permainan baharu|Cari permainan berbilang pemain|Mod & peta|Watak|Pilihan|Menu klasik|Keluar|Kembali|Mula|Pemain tunggal|Masa|Biasa|Siang|Senja|Malam|Kitaran siang/malam|' +
    'Tiada mod|mod aktif|Semua peta|Bumi|Angkasa|Komuniti|Mod|Peta|Cari…|Popular|Terbaharu|Paling banyak dimuat turun|Semua|Permainan|Fizik|Senjata|Watak|' +
    'Seronok|Binaan|Kenderaan|Pengembaraan|PvP|Lain-lain|Teroka|Dipasang|Pasang|Buang|Aktif|Rasmi|oleh|muat turun|Memuatkan…|Tiada hasil|' +
    'Tidak dapat menyambung ke kedai|Terbitkan|Cipta mod|Terbitkan binaan saya|Muat naik fail (.rbmod / .rbmapa)|Nama|Penerangan|Tag|Ikon|Diterbitkan!|Simpan kunci ini untuk memadamnya:|Laporkan|Suka|Main|Graviti|Kelajuan|Lompat|Kelajuan masa|' +
    'Letupan|Peluru tanpa had|Kebal|Watak|Masa tetap|Tiada|Muat turun fail|Peta asas|objek|Bina sesuatu dan simpan (jeda → Simpan) untuk menerbitkannya|Selamat datang ke HypperX RezoBox!|Pilih bahasa anda|Nama anda|Teruskan|Untuk keluar, tutup tab|Digunakan apabila permainan bermula|' +
    'Dipasang|Fail ini bukan mod atau peta yang sah|Goku|Muncul sebagai Goku: lari dan lompat seperti Saiyan.|Graviti bulan|Semua jatuh perlahan: lompatan jauh dan objek terapung.|Super lompat|Lompat empat kali lebih tinggi.|Kelajuan|Berjalan dan berlari hampir dua kali ganda.|Peluru tanpa had|Senjata tidak pernah kehabisan peluru.|Mod dewa|Anda tidak menerima kerosakan.|Gerak perlahan|Dunia bergerak separuh kelajuan.|Letupan gergasi|Letupan jauh lebih besar dan kuat.|' +
    'Gurun|Gurun II|Rumput rata|Bandar|Pangkalan|Pangkalan II|Marikh|Angkasa',
  fil: 'Magsimula ng bagong laro|Maghanap ng multiplayer|Mga mod at mapa|Mga karakter|Mga opsyon|Klasikong menu|Lumabas|Bumalik|Simulan|Isang manlalaro|Oras|Default|Araw|Takipsilim|Gabi|Siklo ng araw/gabi|' +
    'Walang mod|mod na naka-on|Lahat ng mapa|Lupa|Kalawakan|Komunidad|Mga mod|Mga mapa|Maghanap…|Sikat|Pinakabago|Pinakamaraming na-download|Lahat|Gameplay|Pisika|Armas|Karakter|' +
    'Kasiyahan|Pagtatayo|Sasakyan|Pakikipagsapalaran|PvP|Iba pa|Mag-browse|Naka-install|I-install|Alisin|Naka-on|Opisyal|ni|download|Naglo-load…|Walang resulta|' +
    'Hindi makakonekta sa tindahan|I-publish|Gumawa ng mod|I-publish ang aking ginawa|Mag-upload ng file (.rbmod / .rbmapa)|Pangalan|Paglalarawan|Mga tag|Icon|Na-publish!|Itago ang susing ito para mabura ito:|I-report|Like|Maglaro|Grabidad|Bilis|Talon|Bilis ng oras|' +
    'Pagsabog|Walang-katapusang bala|Hindi tinatablan|Karakter|Nakapirming oras|Wala|I-download ang file|Batayang mapa|bagay|Gumawa ng kahit ano at i-save (pause → Save) para mai-publish|Maligayang pagdating sa HypperX RezoBox!|Piliin ang iyong wika|Iyong pangalan|Magpatuloy|Para lumabas, isara ang tab|Naaapply pagsimula ng laro|' +
    'Naka-install|Hindi wastong mod o mapa ang file|Goku|Lalabas ka bilang Goku: tumakbo at tumalon na parang Saiyan.|Grabidad ng buwan|Mabagal bumagsak ang lahat: malalayong talon at lumulutang na bagay.|Super talon|Tumalon nang apat na beses na mas mataas.|Bilis|Lumakad at tumakbo nang halos doble.|Walang-katapusang bala|Hindi nauubusan ng bala ang armas.|God mode|Hindi ka tinatablan ng pinsala.|Slow motion|Kalahating bilis ang mundo.|Higanteng pagsabog|Mas malaki at mas malakas na pagsabog.|' +
    'Disyerto|Disyerto II|Patag na damuhan|Lungsod|Base|Base II|Mars|Kalawakan',
  ja: '新しいゲームを始める|マルチプレイを探す|MODとマップ|キャラクター|オプション|クラシックメニュー|終了|戻る|ゲーム開始|シングルプレイ|時間|標準|昼|夕方|夜|昼夜サイクル|' +
    'MODなし|個のMODが有効|すべてのマップ|地上|宇宙|コミュニティ|MOD|マップ|検索…|人気|新着|ダウンロード数|すべて|ゲームプレイ|物理|武器|キャラクター|' +
    'おもしろ|建築|乗り物|冒険|PvP|その他|探す|インストール済み|インストール|削除|有効|公式|作者|ダウンロード|読み込み中…|結果なし|' +
    'ストアに接続できません|公開する|MODを作る|自分の建築を公開|ファイルをアップロード (.rbmod / .rbmapa)|名前|説明|タグ|アイコン|公開しました！|削除するにはこのキーを保存してください:|通報|いいね|プレイ|重力|速さ|ジャンプ|時間の速さ|' +
    '爆発|弾薬無限|無敵|キャラクター|時間固定|なし|ファイルをダウンロード|ベースマップ|オブジェクト|何か建てて保存（ポーズ → 保存）すると公開できます|HypperX RezoBoxへようこそ！|言語を選んでください|あなたの名前|続ける|終了するにはタブを閉じてください|ゲーム開始時に適用されます|' +
    'インストール済み|有効なMODまたはマップではありません|悟空|悟空として登場：サイヤ人のように走って跳ぶ。|月の重力|すべてがゆっくり落ちる：大ジャンプと浮かぶ物。|スーパージャンプ|4倍高く跳べる。|スピード|歩きも走りもほぼ2倍。|弾薬無限|武器の弾が切れない。|ゴッドモード|ダメージを一切受けない。|スローモーション|世界が半分の速さになる。|巨大爆発|爆発がずっと大きく強くなる。|' +
    '砂漠|砂漠II|草原|街|基地|基地II|火星|宇宙',
  th: 'เริ่มเกมใหม่|หาเกมผู้เล่นหลายคน|ม็อดและแผนที่|ตัวละคร|ตัวเลือก|เมนูคลาสสิก|ออก|กลับ|เริ่มเกม|ผู้เล่นคนเดียว|เวลา|ปกติ|กลางวัน|ยามเย็น|กลางคืน|วงจรกลางวัน/กลางคืน|' +
    'ไม่มีม็อด|ม็อดที่เปิด|แผนที่ทั้งหมด|โลก|อวกาศ|ชุมชน|ม็อด|แผนที่|ค้นหา…|ยอดนิยม|ใหม่ล่าสุด|ดาวน์โหลดมากที่สุด|ทั้งหมด|เกมเพลย์|ฟิสิกส์|อาวุธ|ตัวละคร|' +
    'สนุก|สิ่งก่อสร้าง|ยานพาหนะ|ผจญภัย|PvP|อื่นๆ|เลือกดู|ติดตั้งแล้ว|ติดตั้ง|ลบ|เปิดอยู่|ทางการ|โดย|ดาวน์โหลด|กำลังโหลด…|ไม่พบผลลัพธ์|' +
    'เชื่อมต่อร้านค้าไม่ได้|เผยแพร่|สร้างม็อด|เผยแพร่สิ่งที่ฉันสร้าง|อัปโหลดไฟล์ (.rbmod / .rbmapa)|ชื่อ|คำอธิบาย|แท็ก|ไอคอน|เผยแพร่แล้ว!|เก็บรหัสนี้ไว้เพื่อลบภายหลัง:|รายงาน|ถูกใจ|เล่น|แรงโน้มถ่วง|ความเร็ว|กระโดด|ความเร็วเวลา|' +
    'การระเบิด|กระสุนไม่จำกัด|อมตะ|ตัวละคร|เวลาคงที่|ไม่มี|ดาวน์โหลดไฟล์|แผนที่พื้นฐาน|วัตถุ|สร้างอะไรสักอย่างแล้วบันทึก (หยุด → บันทึก) เพื่อเผยแพร่|ยินดีต้อนรับสู่ HypperX RezoBox!|เลือกภาษาของคุณ|ชื่อของคุณ|ต่อไป|หากต้องการออก ให้ปิดแท็บ|ใช้เมื่อเริ่มเกม|' +
    'ติดตั้งแล้ว|ไฟล์นี้ไม่ใช่ม็อดหรือแผนที่ที่ถูกต้อง|โกคู|เกิดเป็นโกคู: วิ่งและกระโดดแบบชาวไซย่า|แรงโน้มถ่วงดวงจันทร์|ทุกอย่างตกช้าลง: กระโดดไกลและของลอยได้|ซูเปอร์จั๊มพ์|กระโดดสูงขึ้นสี่เท่า|ความเร็ว|เดินและวิ่งเร็วเกือบสองเท่า|กระสุนไม่จำกัด|อาวุธไม่มีวันหมดกระสุน|โหมดเทพ|ไม่ได้รับความเสียหายเลย|สโลว์โมชัน|โลกเคลื่อนที่ช้าลงครึ่งหนึ่ง|ระเบิดยักษ์|ระเบิดใหญ่และแรงขึ้นมาก|' +
    'ทะเลทราย|ทะเลทราย II|ทุ่งหญ้า|เมือง|ฐาน|ฐาน II|ดาวอังคาร|อวกาศ',
  tr: 'Yeni oyun başlat|Çok oyunculu oyun bul|Modlar ve haritalar|Karakterler|Seçenekler|Klasik menü|Çık|Geri|Oyunu başlat|Tek oyunculu|Saat|Varsayılan|Gündüz|Gün batımı|Gece|Gece/gündüz döngüsü|' +
    'Mod yok|mod açık|Tüm haritalar|Dünya|Uzay|Topluluk|Modlar|Haritalar|Ara…|Popüler|En yeni|En çok indirilen|Tümü|Oynanış|Fizik|Silahlar|Karakterler|' +
    'Eğlence|İnşaat|Araçlar|Macera|PvP|Diğer|Göz at|Yüklü|Yükle|Kaldır|Açık|Resmî|yapan|indirme|Yükleniyor…|Sonuç yok|' +
    'Mağazaya bağlanılamadı|Yayınla|Mod oluştur|Yapımımı yayınla|Dosya yükle (.rbmod / .rbmapa)|Ad|Açıklama|Etiketler|Simge|Yayınlandı!|Silebilmek için bu anahtarı sakla:|Bildir|Beğen|Oyna|Yerçekimi|Hız|Zıplama|Zaman hızı|' +
    'Patlamalar|Sonsuz cephane|Ölümsüz|Karakter|Sabit saat|Yok|Dosyayı indir|Temel harita|nesne|Bir şey inşa et ve kaydet (duraklat → Kaydet), sonra yayınla|HypperX RezoBox\'a hoş geldin!|Dilini seç|Adın|Devam|Çıkmak için sekmeyi kapat|Maç başlarken uygulanır|' +
    'Yüklü|Bu dosya geçerli bir mod veya harita değil|Goku|Goku olarak doğ: bir Saiyan gibi koş ve zıpla.|Ay yerçekimi|Her şey yavaş düşer: uzun zıplamalar ve süzülen eşyalar.|Süper zıplama|Dört kat yükseğe zıpla.|Hız|Neredeyse iki kat hızlı yürü ve koş.|Sonsuz cephane|Silahların mermisi hiç bitmez.|Tanrı modu|Hiç hasar almazsın.|Ağır çekim|Dünya yarı hızda akar.|Dev patlamalar|Çok daha büyük ve güçlü patlamalar.|' +
    'Çöl|Çöl II|Düz çimen|Şehir|Üs|Üs II|Mars|Uzay',
  ar: 'ابدأ لعبة جديدة|ابحث عن لعبة جماعية|المودات والخرائط|الشخصيات|الخيارات|القائمة الكلاسيكية|خروج|رجوع|ابدأ اللعبة|لاعب واحد|الوقت|افتراضي|نهار|غروب|ليل|دورة النهار والليل|' +
    'بدون مودات|مودات مفعّلة|كل الخرائط|الأرض|الفضاء|المجتمع|المودات|الخرائط|بحث…|الأشهر|الأحدث|الأكثر تحميلاً|الكل|أسلوب اللعب|فيزياء|أسلحة|شخصيات|' +
    'مرح|بناء|مركبات|مغامرة|PvP|أخرى|تصفّح|المثبّتة|تثبيت|إزالة|مفعّل|رسمي|بواسطة|تحميل|جارٍ التحميل…|لا توجد نتائج|' +
    'تعذّر الاتصال بالمتجر|نشر|أنشئ مودًا|انشر بنائي|ارفع ملفًا (.rbmod / .rbmapa)|الاسم|الوصف|الوسوم|الأيقونة|تم النشر!|احتفظ بهذا المفتاح لتتمكن من حذفه:|إبلاغ|إعجاب|العب|الجاذبية|السرعة|القفز|سرعة الزمن|' +
    'الانفجارات|ذخيرة لا نهائية|لا يُقهر|الشخصية|وقت ثابت|لا شيء|تنزيل الملف|الخريطة الأساسية|عناصر|ابنِ شيئًا واحفظه (إيقاف مؤقت ← حفظ) لتنشره|مرحبًا بك في HypperX RezoBox!|اختر لغتك|اسمك|متابعة|للخروج، أغلق علامة التبويب|تُطبَّق عند بدء اللعبة|' +
    'مثبّت|هذا الملف ليس مودًا أو خريطة صالحة|غوكو|تظهر بشخصية غوكو: اركض واقفز مثل السايان.|جاذبية القمر|كل شيء يسقط ببطء: قفزات طويلة وأشياء تطفو.|قفزة خارقة|اقفز أعلى بأربع مرات.|السرعة|امشِ واركض بضعف السرعة تقريبًا.|ذخيرة لا نهائية|لا تنفد ذخيرة الأسلحة أبدًا.|وضع الإله|لا تتلقى أي ضرر.|حركة بطيئة|يسير العالم بنصف السرعة.|انفجارات عملاقة|انفجارات أكبر وأقوى بكثير.|' +
    'الصحراء|الصحراء 2|العشب المسطح|المدينة|القاعدة|القاعدة 2|المريخ|الفضاء',
  ru: 'Начать новую игру|Найти сетевую игру|Моды и карты|Персонажи|Настройки|Классическое меню|Выход|Назад|Начать игру|Одиночная игра|Время|Обычное|День|Закат|Ночь|Смена дня и ночи|' +
    'Без модов|модов включено|Все карты|Земля|Космос|Сообщество|Моды|Карты|Поиск…|Популярные|Новые|Самые скачиваемые|Все|Геймплей|Физика|Оружие|Персонажи|' +
    'Веселье|Строительство|Транспорт|Приключения|PvP|Другое|Обзор|Установленные|Установить|Удалить|Включён|Официальный|от|скачиваний|Загрузка…|Ничего не найдено|' +
    'Не удалось подключиться к магазину|Опубликовать|Создать мод|Опубликовать мою постройку|Загрузить файл (.rbmod / .rbmapa)|Название|Описание|Теги|Значок|Опубликовано!|Сохраните этот ключ, чтобы потом удалить:|Пожаловаться|Нравится|Играть|Гравитация|Скорость|Прыжок|Скорость времени|' +
    'Взрывы|Бесконечные патроны|Неуязвимость|Персонаж|Фиксированное время|Нет|Скачать файл|Базовая карта|объектов|Постройте что-нибудь и сохраните (пауза → Сохранить), чтобы опубликовать|Добро пожаловать в HypperX RezoBox!|Выберите язык|Ваше имя|Продолжить|Чтобы выйти, закройте вкладку|Применяются при начале игры|' +
    'Установлен|Файл не является модом или картой|Гоку|Появляешься как Гоку: бегаешь и прыгаешь как сайян.|Лунная гравитация|Всё падает медленно: длинные прыжки и парящие предметы.|Суперпрыжок|Прыжки в четыре раза выше.|Скорость|Ходьба и бег почти вдвое быстрее.|Бесконечные патроны|У оружия никогда не кончаются патроны.|Режим бога|Ты не получаешь урона.|Замедление|Мир идёт вдвое медленнее.|Огромные взрывы|Взрывы намного больше и сильнее.|' +
    'Пустыня|Пустыня II|Равнина|Город|База|База II|Марс|Космос',
  uk: 'Почати нову гру|Знайти мережеву гру|Моди та мапи|Персонажі|Налаштування|Класичне меню|Вийти|Назад|Почати гру|Одиночна гра|Час|Звичайний|День|Захід сонця|Ніч|Зміна дня і ночі|' +
    'Без модів|модів увімкнено|Усі мапи|Земля|Космос|Спільнота|Моди|Мапи|Пошук…|Популярні|Нові|Найбільше завантажень|Усі|Геймплей|Фізика|Зброя|Персонажі|' +
    'Розваги|Будівництво|Транспорт|Пригоди|PvP|Інше|Огляд|Встановлені|Встановити|Видалити|Увімкнено|Офіційний|від|завантажень|Завантаження…|Нічого не знайдено|' +
    'Не вдалося підключитися до магазину|Опублікувати|Створити мод|Опублікувати мою будову|Завантажити файл (.rbmod / .rbmapa)|Назва|Опис|Теги|Іконка|Опубліковано!|Збережіть цей ключ, щоб потім видалити:|Поскаржитися|Подобається|Грати|Гравітація|Швидкість|Стрибок|Швидкість часу|' +
    'Вибухи|Нескінченні набої|Невразливість|Персонаж|Фіксований час|Немає|Завантажити файл|Базова мапа|об\'єктів|Збудуйте щось і збережіть (пауза → Зберегти), щоб опублікувати|Ласкаво просимо до HypperX RezoBox!|Оберіть мову|Ваше ім\'я|Продовжити|Щоб вийти, закрийте вкладку|Застосовуються на початку гри|' +
    'Встановлено|Файл не є модом або мапою|Гоку|З\'являєшся як Гоку: бігаєш і стрибаєш як саян.|Місячна гравітація|Усе падає повільно: довгі стрибки та предмети, що ширяють.|Суперстрибок|Стрибки вчетверо вищі.|Швидкість|Ходьба й біг майже вдвічі швидші.|Нескінченні набої|У зброї ніколи не закінчуються набої.|Режим бога|Ти не отримуєш шкоди.|Уповільнення|Світ іде вдвічі повільніше.|Величезні вибухи|Вибухи набагато більші й сильніші.|' +
    'Пустеля|Пустеля II|Рівнина|Місто|База|База II|Марс|Космос',
  fr: 'Nouvelle partie|Trouver une partie multijoueur|Mods et cartes|Personnages|Options|Menu classique|Quitter|Retour|Lancer la partie|Solo|Heure|Par défaut|Jour|Coucher de soleil|Nuit|Cycle jour/nuit|' +
    'Aucun mod|mods actifs|Toutes les cartes|Terre|Espace|Communauté|Mods|Cartes|Rechercher…|Populaires|Nouveaux|Plus téléchargés|Tous|Gameplay|Physique|Armes|Personnages|' +
    'Fun|Construction|Véhicules|Aventure|PvP|Autres|Parcourir|Installés|Installer|Retirer|Activé|Officiel|par|téléchargements|Chargement…|Aucun résultat|' +
    'Impossible de joindre la boutique|Publier|Créer un mod|Publier ma construction|Envoyer un fichier (.rbmod / .rbmapa)|Nom|Description|Étiquettes|Icône|Publié !|Gardez cette clé pour pouvoir le supprimer :|Signaler|J\'aime|Jouer|Gravité|Vitesse|Saut|Vitesse du temps|' +
    'Explosions|Munitions infinies|Invincible|Personnage|Heure fixe|Aucune|Télécharger le fichier|Carte de base|objets|Construisez quelque chose et sauvegardez (pause → Sauver) pour le publier|Bienvenue dans HypperX RezoBox !|Choisissez votre langue|Votre nom|Continuer|Pour quitter, fermez l\'onglet|Appliqués au début d\'une partie|' +
    'Installé|Ce fichier n\'est pas un mod ou une carte valide|Goku|Vous apparaissez en Goku : courez et sautez comme un Saiyan.|Gravité lunaire|Tout tombe lentement : longs sauts et objets flottants.|Super saut|Sautez quatre fois plus haut.|Vitesse|Marchez et courez presque deux fois plus vite.|Munitions infinies|Les armes ne manquent jamais de balles.|Mode Dieu|Vous ne subissez aucun dégât.|Ralenti|Le monde va à moitié vitesse.|Explosions géantes|Des explosions bien plus grandes et fortes.|' +
    'Désert|Désert II|Plaine|Ville|Base|Base II|Mars|Espace',
  de: 'Neues Spiel starten|Mehrspielerspiel suchen|Mods & Karten|Charaktere|Optionen|Klassisches Menü|Beenden|Zurück|Spiel starten|Einzelspieler|Uhrzeit|Standard|Tag|Sonnenuntergang|Nacht|Tag/Nacht-Zyklus|' +
    'Keine Mods|Mods aktiv|Alle Karten|Erde|Weltraum|Community|Mods|Karten|Suchen…|Beliebt|Neueste|Meiste Downloads|Alle|Gameplay|Physik|Waffen|Charaktere|' +
    'Spaß|Bauen|Fahrzeuge|Abenteuer|PvP|Sonstiges|Durchsuchen|Installiert|Installieren|Entfernen|Aktiviert|Offiziell|von|Downloads|Wird geladen…|Keine Ergebnisse|' +
    'Keine Verbindung zum Shop|Veröffentlichen|Mod erstellen|Meinen Bau veröffentlichen|Datei hochladen (.rbmod / .rbmapa)|Name|Beschreibung|Tags|Symbol|Veröffentlicht!|Bewahre diesen Schlüssel auf, um es löschen zu können:|Melden|Gefällt mir|Spielen|Schwerkraft|Tempo|Sprung|Zeittempo|' +
    'Explosionen|Unendlich Munition|Unverwundbar|Charakter|Feste Uhrzeit|Keine|Datei herunterladen|Basiskarte|Objekte|Bau etwas und speichere es (Pause → Speichern), um es zu veröffentlichen|Willkommen bei HypperX RezoBox!|Wähle deine Sprache|Dein Name|Weiter|Zum Beenden den Tab schließen|Gilt beim Start einer Partie|' +
    'Installiert|Diese Datei ist kein gültiger Mod und keine Karte|Goku|Du erscheinst als Goku: renne und springe wie ein Saiyajin.|Mondschwerkraft|Alles fällt langsam: weite Sprünge und schwebende Objekte.|Supersprung|Springe viermal so hoch.|Tempo|Gehe und renne fast doppelt so schnell.|Unendlich Munition|Waffen gehen nie die Kugeln aus.|Gottmodus|Du nimmst keinen Schaden.|Zeitlupe|Die Welt läuft mit halber Geschwindigkeit.|Riesige Explosionen|Viel größere und stärkere Explosionen.|' +
    'Wüste|Wüste II|Flachland|Stadt|Basis|Basis II|Mars|Weltraum',
};
const _idiCache = {};
function T(k) {
  const l = IDI_T[PREFS.lang] ? PREFS.lang : 'en';
  const a = _idiCache[l] || (_idiCache[l] = IDI_T[l].split('|')), i = IDI_K.indexOf(k);
  return (i >= 0 && a[i]) || (IDI_T.en.split('|')[i]) || k;
}
// el idioma del juego (menú clásico) que corresponde; si no tiene, inglés
function idiomaAplicar(l) {
  if (!IDIOMAS_RB[l]) l = 'en';
  PREFS.lang = l; PREFS.idioma = IDIOMAS_RB[l][2]; guardarPrefs();
  document.documentElement.lang = l; if (typeof menuTextosVivos === 'function') menuTextosVivos();
}
// primera vez: el idioma del teléfono si lo tenemos
function idiomaDelAparato() {
  for (const n of navigator.languages || [navigator.language || 'en']) { const c = String(n).toLowerCase().split('-')[0]; if (IDIOMAS_RB[c]) return c; if (c === 'tl') return 'fil'; }
  return 'en';
}
