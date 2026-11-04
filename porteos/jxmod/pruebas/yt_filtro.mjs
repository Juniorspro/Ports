// el filtro de YouTube (radio y tele): búsquedas con contenido adulto, gore, drogas o insultos fuertes (en varios
// idiomas y disfrazadas) no se hacen ni salen a internet; 60 títulos normales (canciones, juegos, memes) pasan todos;
// de los resultados se sacan al instante los malos por título o canal, y lo que la IA veta se saca después; lo que pone
// otro en la sala con un título malo no suena (ni se carga el video) y si la IA lo veta después se corta; un video sin
// título (de un mapa) se revisa con el título de YouTube; la IA de verdad (gratis) veta un título adulto sutil y deja
// los normales; sin errores.
// uso: node yt_filtro.mjs URL_HTML [CARPETA_FOTOS]
import { abrir } from './base.mjs';
const D = (process.argv[3] || '.') + '/';
const { b, p, err, ev } = await abrir(process.argv[2]);
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d) : '')); };
await ev(`PREFS.bienvenida = true; GFX.auto = false; PREFS.gfx = 'medio'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForTimeout(1500); await p.waitForFunction(() => window.__ev(`JUG.suelo`), null, { timeout: 15000 });
const malas = ['porn', 'p0rn videos', 's.e.x.y girls', 'videos +18', 'hentai anime', 'xxx', 'chicas desnudas', 'NSFW compilation', 'gore real', 'beheading video', 'como hacer cocaina', 'puta madre cancion', 'fuck this', 'nudes leak', 'onlyfans leak', 'p u t a', 'sexo', 'стриптиз', 'хуй', 'caralho', 'erotic dance', 'striptease', 'pornhub', 'rule34'];
const buenas = ['música para jugar', 'fnaf song', 'Lady Gaga - Stupid Love', 'Minecraft parkour', 'lofi hip hop radio', 'Despacito', 'Bad Bunny', 'Shakira Bzrp Session', 'Rick Astley Never Gonna Give You Up', 'Skibidi toilet', 'Among Us song', 'Fortnite montage', 'GTA 5 funny moments', 'Sexta sinfonía Beethoven', 'Essex county', 'Middlesex', 'sextet jazz', 'Mozart Requiem', 'Daft Punk Get Lucky', 'Queen Bohemian Rhapsody', 'Imagine Dragons Believer', 'Coldplay Yellow', 'BTS Dynamite', 'Blackpink How You Like That', 'Michael Jackson Thriller', 'Poppy Playtime chapter 3', 'Five Nights at Freddys trailer', 'Roblox doors', 'One Piece opening', 'Naruto Blue Bird', 'Dragon Ball Z Cha-La', 'Mario Kart music', 'Tetris theme', 'Undertale Megalovania', 'Terraria OST', 'Pokemon theme', 'Sonic Green Hill', 'Doom Eternal OST', 'Ultrakill Order', 'cumbia villera', 'reggaeton viejo', 'Karol G Provenza', 'Peso Pluma', 'Eminem Lose Yourself', 'Linkin Park Numb', 'Metallica Enter Sandman', 'AC/DC Thunderstruck', 'Nirvana Smells Like Teen Spirit', 'Gorillaz Feel Good', 'Ed Sheeran Shape of You', 'The Weeknd Blinding Lights', 'Dua Lipa Levitating', 'Bruno Mars 24k Magic', 'Calvin Harris Summer', 'Avicii Wake Me Up', 'Alan Walker Faded', 'Marshmello Alone', 'Kpop dance practice', 'tutorial de cocina', 'noticias de hoy'];
const t1 = await ev(`(() => ({ malas: ${JSON.stringify(malas)}.filter((q) => !ytMalo(q)), buenas: ${JSON.stringify(buenas)}.filter((q) => ytMalo(q)) }))()`);
ok(`las ${malas.length} búsquedas malas (disfrazadas, varios idiomas) se bloquean`, t1.malas.length === 0, t1.malas);
ok(`los ${buenas.length} títulos normales pasan (0 bloqueados de más)`, t1.buenas.length === 0, t1.buenas);
// el panel de la radio: una búsqueda mala no sale a internet; los resultados se filtran (y la IA saca después)
const panel = await ev(`(async () => {
  const f0 = window.fetch, pedidos = []; const ia0 = iaJSON;
  window.fetch = async (u, o) => { u = String(u); pedidos.push(u); if (u.includes('yt?q=')) return new Response(JSON.stringify({ items: [
    { id: 'aaaaaaaaaaa', t: 'Musica tranquila', c: 'Canal' }, { id: 'bbbbbbbbbbb', t: 'Sexy girls dance', c: 'X' }, { id: 'ccccccccccc', t: 'Lofi beats', c: 'NSFW channel' },
    { id: 'ddddddddddd', t: 'Spicy late night dance (adults)', c: 'Y' }, { id: 'eeeeeeeeeee', t: 'Minecraft music', c: 'Z' } ] })); return f0(u, o); };
  let lista = null; window.iaJSON = iaJSON = async (sis, txt) => { lista = JSON.parse(txt); return { o: { no: lista.filter((x) => /spicy/i.test(x[1])).map((x) => x[0]) }, ia: 'prueba' }; };
  entidadPonerMod('radio', true); const R0 = ENTS.lista.find((x) => x.t === 'radio' && x.dueno === 'yo'); radioAbrir(R0); radioModo('yt');
  pedidos.length = 0; await radioBuscar('videos porno', ''); const bloq = { pedidos: pedidos.filter((u) => u.includes('yt?q=')).length, res: RADIO.res.length, texto: $('radioRes').textContent };
  await radioBuscar('musica', ''); await new Promise((r) => setTimeout(r, 300));
  const res = RADIO.res.map((x) => x.id[0]), aIA = lista && lista.map((x) => x[1]);
  window.fetch = f0; window.iaJSON = iaJSON = ia0; radioCerrar(); return { bloq, res, aIA }; })()`);
await p.screenshot({ path: D + 'yt_filtro.png' });
ok('búsqueda mala: no sale a internet y el panel avisa', panel.bloq.pedidos === 0 && panel.bloq.res === 0 && /filtro|filter/i.test(panel.bloq.texto), panel.bloq);
ok('resultados: los malos por título o canal salen al instante y lo que la IA veta sale después (quedan a, e)', panel.res.join('') === 'ae' && panel.aIA && panel.aIA.length === 3, panel);
// la sala: lo que pone otro
const red = await ev(`(async () => {
  const ia0 = iaJSON, f0 = window.fetch; let veto = false; window.iaJSON = iaJSON = async (s, txt) => ({ o: { no: veto ? [0] : [] }, ia: 'prueba' });
  window.fetch = async (u, o) => { u = String(u); if (u.includes('oembed')) return new Response(JSON.stringify({ title: 'Hot strip club night uncensored', author_name: 'X' })); return f0(u, o); };
  const R0 = ENTS.lista.find((x) => x.t === 'radio' && x.dueno === 'yo'); R0.dueno = 'otro'; const yo = R0.b.pos.clone(); JUG.pos.set(yo.x + 2, yo.y + 1, yo.z);
  radioPoner(R0, 'fffffffffff', 0, 'Sexy video xxx', false); await new Promise((r) => setTimeout(r, 900));
  const malo = { suena: YT.fuente === R0, vetado: R0.vetado === 'fffffffffff' };
  radioPoner(R0, 'ggggggggggg', 0, 'Musica para jugar', false); await new Promise((r) => setTimeout(r, 900)); const bueno = YT.fuente === R0 && YT.vid === 'ggggggggggg';
  veto = true; radioPoner(R0, 'hhhhhhhhhhh', 0, 'Algo raro de noche', false); await new Promise((r) => setTimeout(r, 1200)); const iaCorta = { suena: YT.fuente === R0, vetado: R0.vetado === 'hhhhhhhhhhh' };
  veto = false; R0.tit = ''; radioPoner(R0, 'iiiiiiiiiii', 0, '', false); await new Promise((r) => setTimeout(r, 1200)); const sinTit = { suena: YT.fuente === R0, vetado: R0.vetado === 'iiiiiiiiiii' };
  radioPoner(R0, '', 0, '', false); R0.dueno = 'yo'; window.iaJSON = iaJSON = ia0; window.fetch = f0; return { malo, bueno, iaCorta, sinTit }; })()`);
ok('sala: un video de otro con título malo no suena; uno normal sí', !red.malo.suena && red.malo.vetado && red.bueno, red);
ok('sala: si la IA lo veta, se corta; un video sin título se revisa con el de YouTube', !red.iaCorta.suena && red.iaCorta.vetado && !red.sinTit.suena && red.sinTit.vetado, red);
// la IA de verdad
const ia = await ev(`(async () => { YTF.ok.clear(); const t0 = performance.now(); const no = await ytIA([{ id: 'v1', t: 'Lofi hip hop radio - beats to relax/study to', c: 'Lofi Girl' }, { id: 'v2', t: 'Hot girls in tiny bikinis twerking compilation 🔥 (uncut)', c: 'Spicy Clips' }, { id: 'v3', t: 'Minecraft Parkour Gameplay No Copyright', c: 'Gameplay' }, { id: 'v4', t: 'Real street fight knockout blood compilation', c: 'Fights' }], 15000); return { no: no ? [...no] : null, ms: Math.round(performance.now() - t0) }; })()`);
ok('la IA gratis de verdad veta lo adulto sutil y lo violento real, y deja lo normal', ia.no && ia.no.includes('v2') && !ia.no.includes('v1') && !ia.no.includes('v3'), ia);
ok('sin errores', err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404|Failed to fetch|429|503/.test(e)).length === 0, err.filter((e) => !/WebSocket|ERR_CONNECTION|net::|404/.test(e)).slice(0, 4));
console.log(R.every(Boolean) ? 'TODO BIEN' : 'HAY FALLAS', R.filter(Boolean).length + '/' + R.length);
await b.close();
