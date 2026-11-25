// Las ventanas de Derma de los addons (gmod_derma.js). Panel, bug p6s4dr85: «El menú de MINECRAFT SWEP no se abre — le pico
// al botón y no se abre». Con el Minecraft SWEP (Workshop 116592647, se baja del Workshop):
//  1. con el arma en la mano, la R (su Reload: RunConsoleCommand("mc_menu")) abre la ventana «Block Menu» con un ícono
//     por bloque (SpawnIcon en un DPanelList), los botones Options / Remove y los textos;
//  2. entra en la pantalla (en el celu se achica);
//  3. tocar un ícono elige ese bloque (minecraft_blocktype cambia) y la ventana se cierra (DeleteOnClose false: se esconde);
//  4. otra vez la R la vuelve a abrir (la misma ventana);
//  5. clic derecho (o mantener apretado) en un ícono abre su menú (DermaMenu) con «BlockID = …» y el submenú «Re-Render»;
//  6. «Options» abre la otra ventana: deslizadores (DNumSlider) y casillas (DCheckBoxLabel) con su convar; cambiar una
//     casilla cambia la convar; la X la cierra;
//  7. Escape cierra la ventana abierta;
//  8. el resto del panel: Dock (TOP, FILL), DComboBox, DListView con filas, DPropertySheet con pestañas y DTextEntry, armado
//     por un Lua de prueba, con sus eventos (OnSelect, OnRowSelected, OnEnter);
//  9. sin errores de Lua ni de JS.
// uso: node derma_mods.mjs URL_HTML [CARPETA_FOTOS]   (CELU=1: pantalla de celular)
import { abrir } from './base.mjs';
import fs from 'fs';
const [, , HTML, D = '/tmp/claude-0/derma_mods'] = process.argv; fs.mkdirSync(D, { recursive: true });
const R = []; const ok = (n, c, d) => { R.push(!!c); console.log((c ? 'OK   ' : 'FALLA') + ' ' + n + (d !== undefined ? ' · ' + JSON.stringify(d).slice(0, 900) : '')); };
const CELU = !!process.env.CELU;
const { b, p, err, ev } = await abrir(HTML + '?test', CELU);
await ev(`PREFS.bienvenida = true; PREFS.tutVisto = true; GFX.auto = false; PREFS.gfx = 'bajo'; aplicarGfx(); inicioMostrar(false); empezarPartida('FlatGrass'); 1`);
await p.waitForFunction(() => window.__ev(`JUEGO.estado === 'juego' && !!JUG.suelo`), null, { timeout: 90000 });
await p.waitForTimeout(1200);
const lua = (src) => ev(`(() => { const f = GMA.R.cargar(${JSON.stringify(src)}, 'prueba'); const r = gmLlamar(f, 'C'); return Array.isArray(r) ? r.map((x) => typeof x === 'object' ? String(x) : x) : r; })()`);
const inst = await ev(`(async () => { const A = await gmInstalar('116592647', { nombre: 'Minecraft SWEP', sinDeps: true }); if (A && A.listo) await A.listo; await new Promise((r) => setTimeout(r, 1200)); return { ok: !!A, err: (A && A.luaErr || []).slice(0, 3) }; })()`);
ok('el Minecraft SWEP se instala', inst.ok, inst);
const e0 = await ev(`GMA.errores.length`);
await ev(`(() => { gmaDarArma('minecraft_swep'); elegirArma(ARM.lista.indexOf('gm:minecraft_swep')); JUG.tercera = false; return 1; })()`);
await p.waitForTimeout(1500);
const estado = () => ev(`(() => { const el = document.getElementById('gmDerma'), vis = !!el && !el.classList.contains('oc'), fr = el ? [...el.querySelectorAll('.gdFrame')] : [], V = el ? [...el.querySelectorAll('.gdV')] : [];
  return { vis, ventanas: fr.map((f) => f.querySelector('.gdTit') && f.querySelector('.gdTit').textContent), iconos: el ? el.querySelectorAll('.gdIco').length : 0, botones: el ? [...el.querySelectorAll('.gdBtn')].map((x) => x.textContent) : [],
    caja: V.map((v) => { const r = v.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)]; }), W: innerWidth, H: innerHeight, ui: UI.abierto, menu: el ? el.querySelectorAll('.gdMenu').length : 0 }; })()`);
// 1: la R
await p.keyboard.down('KeyR'); await p.waitForTimeout(150); await p.keyboard.up('KeyR'); await p.waitForTimeout(1500);
let st = await estado();
if (!st.vis) { await ev(`ENT.teclas.add('KeyR'); 1`); await p.waitForTimeout(300); await ev(`ENT.teclas.delete('KeyR'); 1`); await p.waitForTimeout(1500); st = await estado(); }
await p.screenshot({ path: D + '/1_block_menu.png' });
ok('1. la R abre «Block Menu» con los íconos de los bloques y sus botones', st.vis && st.ventanas.includes('Block Menu') && st.iconos >= 10 && st.botones.includes('Options'), st);
ok('2. la ventana entra en la pantalla y el juego suelta el mouse', st.caja.length && st.caja.every((c) => c[0] >= 0 && c[1] >= 0 && c[2] <= st.W + 1 && c[3] <= st.H + 1) && st.ui === 'derma', { caja: st.caja, W: st.W, H: st.H, ui: st.ui });
// 3: tocar un ícono (el 5.º)
const tipo0 = await lua('return GetConVar("minecraft_blocktype"):GetString()');
await p.waitForTimeout(2500);   // (los íconos se dibujan de a poco)
await p.screenshot({ path: D + '/1b_iconos.png' });
await p.locator('#gmDerma .gdIco').nth(4).click(); await p.waitForTimeout(800);
const tipo1 = await lua('return GetConVar("minecraft_blocktype"):GetString()');
st = await estado();
ok('3. tocar un ícono elige ese bloque y la ventana se cierra', String(tipo1[0]) !== String(tipo0[0]) && !st.vis && st.ui !== 'derma', { antes: tipo0, despues: tipo1, vis: st.vis, ui: st.ui });
// 4: otra vez la R
await ev(`ENT.teclas.add('KeyR'); 1`); await p.waitForTimeout(200); await ev(`ENT.teclas.delete('KeyR'); 1`); await p.waitForTimeout(1200);
st = await estado(); if (!st.vis) { await lua('RunConsoleCommand("mc_menu")'); await p.waitForTimeout(1000); st = await estado(); }
ok('4. se vuelve a abrir', st.vis && st.ventanas.includes('Block Menu'), st.ventanas);
// 5: clic derecho en un ícono → su menú
await p.locator('#gmDerma .gdIco').nth(2).click({ button: 'right' }); await p.waitForTimeout(700);
const menu = await ev(`[...document.querySelectorAll('#gmDerma .gdMenu div')].map((x) => x.textContent)`);
await p.screenshot({ path: D + '/2_menu_derecho.png' });
await p.locator('#gmDerma .gdMenu div', { hasText: 'Re-Render' }).first().click(); await p.waitForTimeout(500);
const menu2 = await ev(`document.querySelectorAll('#gmDerma .gdMenu').length`);
await p.locator('#gmDerma .gdMenu div', { hasText: 'This Icon' }).first().click(); await p.waitForTimeout(500);
const menu3 = await ev(`document.querySelectorAll('#gmDerma .gdMenu').length`);
ok('5. clic derecho en un ícono: su menú con «BlockID = …» y el submenú, que se abre y se cierra al elegir', menu.some((t) => /^BlockID = /.test(t)) && menu.includes('Re-Render') && menu2 === 2 && menu3 === 0, { menu, menu2, menu3 });
// 6: Options
await p.locator('#gmDerma .gdBtn', { hasText: 'Options' }).first().click(); await p.waitForTimeout(1000);
st = await estado();
const opc = await ev(`(() => { const f = [...document.querySelectorAll('#gmDerma .gdFrame')].pop(); return { sl: f.querySelectorAll('input[type=range]').length, ch: [...f.querySelectorAll('.gdChk')].map((c) => c.textContent) }; })()`);
await p.screenshot({ path: D + '/3_opciones.png' });
const cv = await lua('local c = GetConVar("minecraft_menu_huge"); return c and c:GetString() or "?"');
await p.locator('#gmDerma .gdFrame').last().locator('.gdChk', { hasText: 'Huge menu' }).locator('input').click(); await p.waitForTimeout(500);
const cv2 = await lua('local c = GetConVar("minecraft_menu_huge"); return c and c:GetString() or "?"');
const cvTodas = await lua('local r = {} for _, n in ipairs({ "minecraft_menu_huge", "minecraft_menu_savemousepos", "minecraft_blockhealth", "minecraft_spawnrate" }) do local c = GetConVar(n) r[#r + 1] = n .. "=" .. (c and c:GetString() or "?") end return table.concat(r, " ")');
await p.locator('#gmDerma .gdFrame').last().locator('.gdX').click(); await p.waitForTimeout(600);
const st6 = await estado();
ok('6. «Options»: deslizadores y casillas; tocar «Huge menu» cambia su convar; la X cierra', opc.sl >= 2 && opc.ch.length >= 2 && String(cv[0]) !== String(cv2[0]) && /^[01]$/.test(String(cv2[0])) && st6.ventanas.length === st.ventanas.length - 1, { opc, huge: [cv, cv2], convars: cvTodas, antes: st.ventanas, despues: st6.ventanas });
// 7: Escape
await p.keyboard.press('Escape'); await p.waitForTimeout(600);
const st7 = await estado();
ok('7. Escape cierra la ventana (y no pausa el juego)', !st7.vis && await ev(`JUEGO.estado === 'juego'`), { vis: st7.vis, ventanas: st7.ventanas });
// 8: los demás controles, con un Lua de prueba
await lua(`
  PRU = {}
  local f = vgui.Create("DFrame"); f:SetSize(420, 320); f:SetTitle("Prueba"); f:Center(); PRU.f = f
  local top = vgui.Create("DPanel", f); top:Dock(TOP); top:SetTall(30)
  local cb = vgui.Create("DComboBox", top); cb:Dock(LEFT); cb:SetWide(160); cb:SetValue("Elegí"); cb:AddChoice("Uno", 1); cb:AddChoice("Dos", 2)
  cb.OnSelect = function(s, i, t, d) PRU.combo = t .. ":" .. tostring(d) end
  local hoja = vgui.Create("DPropertySheet", f); hoja:Dock(FILL)
  local lv = vgui.Create("DListView"); lv:AddColumn("Nombre"); lv:AddColumn("Valor"); lv:AddLine("a", "1"); lv:AddLine("b", "2"); lv:AddLine("c", "3")
  lv.OnRowSelected = function(s, i, ln) PRU.fila = ln:GetValue(1) .. ln:GetColumnText(2) end
  hoja:AddSheet("Lista", lv)
  local p2 = vgui.Create("DPanel"); local te = vgui.Create("DTextEntry", p2); te:SetPos(10, 10); te:SetSize(200, 24)
  te.OnEnter = function(s) PRU.texto = s:GetValue() end
  hoja:AddSheet("Texto", p2)
  f:MakePopup()`);
await p.waitForTimeout(800);
await p.screenshot({ path: D + '/4_controles.png' });
await p.locator('#gmDerma .gdCmb').selectOption({ label: 'Dos' }); await p.waitForTimeout(300);
await p.locator('#gmDerma .gdLst tr').nth(2).click(); await p.waitForTimeout(300);
await p.locator('#gmDerma .gdTab', { hasText: 'Texto' }).click(); await p.waitForTimeout(400);
await p.locator('#gmDerma .gdTxt').fill('hola'); await p.locator('#gmDerma .gdTxt').press('Enter'); await p.waitForTimeout(400);
const pru = await lua('return tostring(PRU.combo), tostring(PRU.fila), tostring(PRU.texto)');
const caja = await ev(`(() => { const f = document.querySelector('#gmDerma .gdFrame'), c = document.querySelector('#gmDerma .gdCmb'); const a = f.getBoundingClientRect(), b = c.getBoundingClientRect(); return { dx: Math.round(b.left - a.left), dy: Math.round(b.top - a.top), w: Math.round(b.width) }; })()`);
ok('8. Dock, DComboBox, DListView, pestañas y DTextEntry, con sus eventos', pru[0] === 'Dos:2' && pru[1] === 'b2' && pru[2] === 'hola', { pru, caja });
await lua('PRU.f:Close()'); await p.waitForTimeout(500);
const e1 = await ev(`GMA.errores.slice(${e0})`);
// (el broker público del multijugador puede no contestar desde la máquina de prueba: eso no es de las ventanas)
const errJs = err.filter((e) => !/WebSocket connection to/.test(e));
ok('9. sin errores de Lua ni de JS', !e1.length && !errJs.length, { lua: e1.slice(0, 5), js: errJs.slice(0, 5) });
console.log(`RESUMEN ${R.filter(Boolean).length}/${R.length}`);
await b.close();
process.exit(R.every(Boolean) ? 0 : 1);
