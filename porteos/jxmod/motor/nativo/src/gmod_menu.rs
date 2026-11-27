//! El menú de GMod de la versión personal (gmod_personal.js: jxpSubs, jxpOrden, jxpMenu; gmod_spawn.js): pestañas
//! Spawnlists, Weapons, Entities, NPCs y Vehicles con los íconos de GMod, a la izquierda las listas (los spawnlists de
//! fábrica de GMod en su árbol, las categorías de las listas del Lua —list.Set "Weapon", "NPC", "Vehicles"— y lo de cada
//! addon) y la grilla de spawnicons; la pestaña Addons es el panel «Mods» de siempre (prender, tienda).
use super::gmod_base::*;
use super::*;

/// las pestañas: nombre e ícono de 16 px de GMod (rb/jxp/ui/icon16)
pub const TABS: [(&str, &str); 7] = [("Spawnlists", "application_view_tile"), ("Weapons", "gun"), ("Entities", "bricks"), ("NPCs", "monkey"), ("Vehicles", "car"), ("Pill Packs", "user"), ("Addons", "plugin")];
pub const TAB_ADDONS: usize = 6;
/// la pestaña de los Pill Packs (gmod_pill.rs)
pub const TAB_PILLS: usize = 5;
/// (las armas de HL2 de la lista de GMod → las del juego: HL2_ARMAS de gmod_api.js)
const HL2_ARMAS: [(&str, &str); 14] = [("weapon_crowbar", "Crowbar"), ("weapon_physgun", "PhysicsGun"), ("gmod_tool", "ToolBaton"), ("weapon_rpg", "RPG"), ("weapon_pistol", "Pistol"), ("gmod_camera", "Camera"), ("weapon_fists", "Hands"), ("weapon_357", "Revolver"), ("weapon_smg1", "Smg"), ("weapon_ar2", "Akm"), ("weapon_shotgun", "Shotgun"), ("weapon_crossbow", "Crossbow"), ("weapon_stunstick", "Bat"), ("weapon_physcannon", "GravityGun")];

#[derive(Clone, Debug)]
pub struct ItemM { pub id: String, pub n: String, /** el ícono: "rb:<ruta en rb/>" o "gm:<archivo de un addon>" */ pub ic: Option<String> }
#[derive(Clone, Debug)]
pub struct CatM { pub n: String, pub nivel: u8, pub ic: String, pub items: Vec<ItemM> }
#[derive(Default)]
pub struct MenuGm { /** lo que se pide poner y necesita el motor (NPC y vehículos del juego) */ pub pend: Vec<String>, pub tab: usize, pub cat: usize, pub scroll: f32, pub cat0: usize, pub cats: Vec<Vec<CatM>>, pub hecho: bool, pub iconos: HashMap<String, Option<(i64, u32, u32)>> }
#[derive(Clone, Copy, Debug, PartialEq)]
pub enum BtnMenu { Tab(usize), Cat(usize), Item(usize), Cerrar, Arriba, Abajo }

/// la geometría del menú: el panel, las pestañas, la columna de listas (12 a la vista) y la grilla de la lista elegida
pub fn menu_geo(w: f32, h: f32, mg: &MenuGm) -> ([f32; 4], Vec<(BtnMenu, [f32; 4])>) {
    let (pw, ph) = (w * 0.92, h * 0.88); let (x0, y0) = ((w - pw) / 2.0, (h - ph) / 2.0); let fila = h * 0.07;
    let mut v = vec![(BtnMenu::Cerrar, [x0 + pw - fila * 1.05, y0 + fila * 0.1, fila * 0.9, fila * 0.8])];
    let tw = (pw - fila * 1.4) / TABS.len() as f32;
    for i in 0..TABS.len() { v.push((BtnMenu::Tab(i), [x0 + fila * 0.2 + i as f32 * tw, y0 + fila * 0.1, tw - fila * 0.15, fila * 0.8])); }
    if mg.tab == TAB_ADDONS { return ([x0, y0, pw, ph], v); }
    let (cx, cw) = (x0 + fila * 0.2, pw * 0.26); let cy = y0 + fila * 1.1; let ch = (ph - fila * 1.3) / 13.0;
    v.push((BtnMenu::Arriba, [cx, cy, cw / 2.0 - 2.0, ch * 0.9])); v.push((BtnMenu::Abajo, [cx + cw / 2.0, cy, cw / 2.0 - 2.0, ch * 0.9]));
    let cats = mg.cats.get(mg.tab).map(|c| c.len()).unwrap_or(0);
    for (k, i) in (mg.cat0..cats).take(12).enumerate() { v.push((BtnMenu::Cat(i), [cx, cy + ch * (k + 1) as f32, cw, ch * 0.92])); }
    let (gx, gy) = (cx + cw + fila * 0.3, cy); let (gw, gh) = (x0 + pw - gx - fila * 0.2, y0 + ph - gy - fila * 0.2);
    let celda = (h * 0.15).max(48.0); let cols = (gw / celda).floor().max(1.0) as usize; let lado = gw / cols as f32;
    let n = mg.cats.get(mg.tab).and_then(|c| c.get(mg.cat)).map(|c| c.items.len()).unwrap_or(0);
    for i in 0..n { let (fx, fy) = ((i % cols) as f32, (i / cols) as f32); let r = [gx + fx * lado + 2.0, gy + fy * lado + 2.0 - mg.scroll, lado - 4.0, lado - 4.0]; if r[1] + r[3] < gy || r[1] > gy + gh { continue; } if r[1] >= gy - 1.0 && r[1] + r[3] <= gy + gh + 1.0 { v.push((BtnMenu::Item(i), r)); } }
    ([x0, y0, pw, ph], v)
}
/// un PNG (RGB, RGBA, gris, paleta) a RGBA de 8 bits
pub fn png_a_rgba(b: &[u8]) -> Option<(u32, u32, Vec<u8>)> {
    let mut dec = png::Decoder::new(std::io::Cursor::new(b)); dec.set_transformations(png::Transformations::EXPAND | png::Transformations::STRIP_16);
    let mut r = dec.read_info().ok()?; let mut px = vec![0; r.output_buffer_size()]; let i = r.next_frame(&mut px).ok()?; px.truncate(i.buffer_size());
    let rgba = match i.color_type { png::ColorType::Rgba => px, png::ColorType::Rgb => px.chunks_exact(3).flat_map(|c| [c[0], c[1], c[2], 255]).collect(), png::ColorType::GrayscaleAlpha => px.chunks_exact(2).flat_map(|c| [c[0], c[0], c[0], c[1]]).collect(), png::ColorType::Grayscale => px.iter().flat_map(|&c| [c, c, c, 255]).collect(), _ => return None };
    Some((i.width, i.height, rgba))
}

impl Juego {
    /// arma las listas del menú (con el Lua de GMod ya montado: las de list.Set) y las de los addons
    pub fn gmod_menu_armar(&mut self) {
        let mut cats: Vec<Vec<CatM>> = vec![vec![]; TABS.len()];
        let base = |m: &str| m.rsplit('/').next().unwrap_or(m).trim_end_matches(".mdl").to_string();
        // Spawnlists: el árbol de GMod
        if let Some(mj) = &self.gmod.jxp {
            fn poner(mj: &MenuJxp, padre: i64, nivel: u8, out: &mut Vec<CatM>, base: &dyn Fn(&str) -> String) {
                for l in mj.listas.iter().filter(|l| l.padre == padre) {
                    out.push(CatM { n: l.n.clone(), nivel, ic: format!("jxp/ui/{}", l.ic), items: l.m.iter().map(|(m, ic)| ItemM { id: format!("gmprop:{m}"), n: base(m), ic: ic.then(|| format!("rb:jxp/iconos/{}.png", m.trim_end_matches(".mdl"))) }).collect() });
                    poner(mj, l.id, nivel + 1, out, base);
                }
            }
            poner(mj, 0, 0, &mut cats[0], &base);
        }
        let ent_ic = |k: &str, c: &str, set: Option<&std::collections::HashSet<String>>| -> Option<String> { let s = set?; [k, c].iter().map(|x| x.to_lowercase()).find(|x| s.contains(x)).map(|x| format!("rb:jxp/ui/entities/{x}.png")) };
        let jset = self.gmod.jxp.as_ref().map(|m| m.ent.clone()); let frases = self.gmod.jxp.as_ref().map(|m| m.frases.clone()).unwrap_or_default();
        if let Some(gm) = self.gmod.gm.as_mut() {
            let frase = |gm: &mut Gmod, s: &str| { let k = s.trim_start_matches('#'); match frases.get(&k.to_lowercase()) { Some(f) => f.clone(), None if s.starts_with('#') || k.contains('.') => gm.frase(k).unwrap_or_else(|| k.to_string()), None => s.to_string() } };
            let campo = |c: &[(String, String)], k: &str| c.iter().find(|x| x.0 == k).map(|x| x.1.clone()).unwrap_or_default();
            // Weapons: las de HL2 de game_hl2.lua (las del juego), por categoría
            let mut por: Vec<(String, Vec<ItemM>)> = vec![];
            let agregar = |por: &mut Vec<(String, Vec<ItemM>)>, c: String, it: ItemM| { match por.iter_mut().find(|x| x.0 == c) { Some(x) => x.1.push(it), None => por.push((c, vec![it])) } };
            for (k, c) in gm.lista("Weapon") {
                let Some(n) = HL2_ARMAS.iter().find(|x| x.0 == k).map(|x| x.1) else { continue }; let Some(ai) = ARMAS.iter().position(|a| a.n == n) else { continue };
                let cat = campo(&c, "Category"); let cat = if cat.trim().is_empty() { "Half-Life 2".to_string() } else { frase(gm, cat.trim()) };
                agregar(&mut por, cat, ItemM { id: format!("arma:{ai}"), n: ARMAS[ai].nom.to_string(), ic: Some(format!("rb:jxp/ui/entities/{k}.png")) });
            }
            cats[1] = por.into_iter().map(|(n, items)| CatM { n, nivel: 0, ic: "jxp/ui/games/16/hl2.png".into(), items }).collect();
            for (tab, lista, pre) in [(3usize, "NPC", "gmnpc"), (4, "Vehicles", "gmveh")] {
                let mut por: Vec<(String, Vec<ItemM>)> = vec![];
                for (k, c) in gm.lista(lista) {
                    let cat = campo(&c, "Category"); let cat = if cat.trim().is_empty() { "Other".to_string() } else { frase(gm, cat.trim()) };
                    let n = campo(&c, "Name"); let n = if n.trim().is_empty() { k.clone() } else { frase(gm, n.trim()) };
                    let ic = ent_ic(&k, &campo(&c, "Class"), jset.as_ref());
                    agregar(&mut por, cat, ItemM { id: format!("{pre}:{k}"), n, ic });
                }
                cats[tab] = por.into_iter().map(|(n, items)| CatM { n, nivel: 0, ic: format!("jxp/ui/icon16/{}.png", if tab == 3 { "monkey" } else { "car" }), items }).collect();
            }
        }
        // lo de cada addon: sus armas y sus entidades (con el ícono de su materials/entities o vgui/entities)
        for a in self.gmod.addons.iter().filter(|a| a.prendido) {
            let ic = |c: &str| Some(format!("gm:{c}"));
            if !a.sweps.is_empty() { cats[1].push(CatM { n: a.nombre.clone(), nivel: 0, ic: "jxp/ui/icon16/folder_brick.png".into(), items: a.sweps.iter().map(|(c, n)| ItemM { id: format!("gmswep:{c}"), n: n.clone(), ic: ic(c) }).collect() }); }
            if !a.sents.is_empty() { cats[2].push(CatM { n: a.nombre.clone(), nivel: 0, ic: "jxp/ui/icon16/folder_brick.png".into(), items: a.sents.iter().map(|(c, n)| ItemM { id: format!("gment:{c}"), n: n.clone(), ic: ic(c) }).collect() }); }
        }
        // (los personajes de los mods como NPC —sp.npcModelos— y, en Spawnlists, «Addons» con lo de cada addon, como
        // Browse › Addons del spawnmenu de GMod: sus modelos de jugador —ponérselo, como NPC, como muñeco—, sus NPC y
        // vehículos de las listas, sus armas, sus entidades y sus props: gmMenu y jxpSubs de la web)
        let pms = self.gmp_lista();
        let nom = |r: &str| r.rsplit('/').next().unwrap_or(r).trim_end_matches(".mdl").to_string();
        if !pms.is_empty() { cats[3].push(CatM { n: "Personajes de los mods".into(), nivel: 0, ic: "jxp/ui/icon16/monkey.png".into(), items: pms.iter().map(|x| ItemM { id: format!("gmnpcm:{}", x.0), n: format!("{} (NPC)", nom(&x.0)), ic: None }).collect() }); }
        let mut por_addon: Vec<CatM> = vec![];
        let infos: Vec<(String, Option<usize>, Vec<(String, String)>, Vec<(String, String)>)> = self.gmod.addons.iter().filter(|a| a.prendido).map(|a| (a.nombre.clone(), a.idx, a.sweps.clone(), a.sents.clone())).collect();
        let (npcs, vehs) = match self.gmod.gm.as_mut() { Some(g) => (g.lista("NPC"), g.lista("Vehicles")), None => (vec![], vec![]) };
        for (an, idx, sweps, sents) in infos {
            let Some(idx) = idx else { continue }; let Some(gm) = self.gmod.gm.as_ref() else { break };
            let mut it: Vec<ItemM> = vec![];
            let mios: Vec<&(String, String, String, bool)> = pms.iter().filter(|x| x.2 == an).collect();
            // (primero como NPC —lo que se espera al tocar un personaje en un menú de spawn—; ponérselo, con su nombre bien claro)
            for x in &mios { it.push(ItemM { id: format!("gmnpcm:{}", x.0), n: format!("{} (NPC)", nom(&x.0)), ic: None }); }
            for x in &mios { it.push(ItemM { id: format!("gmpm:{}", x.0), n: format!("{} (ponérmelo)", nom(&x.0)), ic: None }); }
            for x in &mios { it.push(ItemM { id: format!("gmrag:{}", x.0), n: format!("{} (muñeco)", nom(&x.0)), ic: None }); }
            let campo = |c: &[(String, String)], k: &str| c.iter().find(|x| x.0 == k).map(|x| x.1.clone()).unwrap_or_default();
            let mut fuera: Vec<String> = mios.iter().map(|x| x.0.clone()).collect();
            for (lista, pre, l) in [("NPC", "gmnpc", &npcs), ("Vehicles", "gmveh", &vehs)] {
                for (k, c) in l.iter() { if gm.addon_de_lista(lista, k).as_deref() != Some(an.as_str()) { continue; } let n = campo(c, "Name"); fuera.push(jxgmod::jugadores::ruta_mdl(&campo(c, "Model"))); it.push(ItemM { id: format!("{pre}:{k}"), n: if n.trim().is_empty() { k.clone() } else { n }, ic: jset.as_ref().and_then(|s| { let x = k.to_lowercase(); s.contains(&x).then(|| format!("rb:jxp/ui/entities/{x}.png")) }) }); }
            }
            for (c, n) in &sweps { it.push(ItemM { id: format!("gmswep:{c}"), n: n.clone(), ic: Some(format!("gm:{c}")) }); if let Some(w) = gm.mundo_arma(c) { fuera.push(jxgmod::jugadores::ruta_mdl(&w)); } }
            for (c, n) in &sents { it.push(ItemM { id: format!("gment:{c}"), n: n.clone(), ic: Some(format!("gm:{c}")) }); }
            // (sus props: los modelos sueltos que no son de otra cosa; los que tienen física primero —gmPropsMenu—)
            let arch = gm.archivos_addon(idx);
            let sueltos: Vec<String> = arch.iter().filter(|r| r.starts_with("models/") && r.ends_with(".mdl")).filter(|r| {
                let b = r.rsplit('/').next().unwrap_or(r);
                !(b.starts_with("v_") || b.starts_with("c_") || r.contains("/c_arms") || b.ends_with("_arms.mdl") || r.contains("/arms/") || fuera.contains(r) || b.starts_with("w_") || r.starts_with("models/weapons/") || b.ends_with("hand.mdl") || b.ends_with("hands.mdl") || r.contains("gib") || r.contains("debris") || r.contains("_chunk") || r.contains("shard"))
            }).cloned().collect();
            let con_fis: Vec<String> = sueltos.iter().filter(|r| arch.contains(&format!("{}.phy", &r[..r.len() - 4]))).cloned().collect();
            for r in if con_fis.is_empty() { sueltos } else { con_fis } { it.push(ItemM { id: format!("gmprop:{r}"), n: nom(&r), ic: None }); }
            if !it.is_empty() { por_addon.push(CatM { n: an.clone(), nivel: 1, ic: "jxp/ui/icon16/folder_brick.png".into(), items: it }); }
        }
        // (Pill Packs: los propios por categoría —como pillSubs— y los de cada Pill Pack del Workshop; arriba, volver)
        self.pill_leer_gm();
        {
            let volver = if self.pill_on() { vec![ItemM { id: "pillfin:".into(), n: "Volver a tu personaje".into(), ic: None }] } else { vec![] };
            let pr = gmod_pill::propios();
            for (c, n) in [("fnaf", "Five Nights at Freddy's"), ("terror", "Terror"), ("accion", "Acción"), ("mas", "Más personajes")] {
                let mut it = volver.clone(); it.extend(pr.iter().filter(|d| d.cat == c).map(|d| ItemM { id: format!("pill:{}", d.id), n: d.nom.clone(), ic: None }));
                cats[TAB_PILLS].push(CatM { n: n.into(), nivel: 0, ic: "jxp/ui/icon16/user.png".into(), items: it });
            }
            let mut packs: Vec<String> = vec![]; for d in &self.gmod.pill.gm { if !packs.contains(&d.cat) { packs.push(d.cat.clone()); } }
            for pk in packs {
                let mut it = volver.clone(); it.extend(self.gmod.pill.gm.iter().filter(|d| d.cat == pk).map(|d| ItemM { id: format!("pill:{}", d.id), n: d.nom.clone(), ic: d.gm.as_ref().map(|n| format!("gmpng:materials/pills/{n}.png")) }));
                cats[TAB_PILLS].push(CatM { n: pk.trim_start_matches("gm:").into(), nivel: 0, ic: "jxp/ui/icon16/pill.png".into(), items: it });
            }
        }
        if !por_addon.is_empty() { cats[0].push(CatM { n: "Addons".into(), nivel: 0, ic: "jxp/ui/icon16/plugin.png".into(), items: por_addon.iter().flat_map(|c| c.items.clone()).collect() }); cats[0].extend(por_addon); }
        self.gmod.menu.cats = cats; self.gmod.menu.hecho = true;
        let m = &mut self.gmod.menu; if m.cat >= m.cats[m.tab].len() { m.cat = 0; m.cat0 = 0; m.scroll = 0.0; }
    }
    /// (para las pruebas) ir a una pestaña y una lista; lo que hay en ella
    pub fn gmod_menu_ir(&mut self, tab: usize, cat: usize) -> Vec<String> { let m = &mut self.gmod.menu; m.tab = tab.min(TABS.len() - 1); m.cat = cat; m.cat0 = cat.saturating_sub(2); m.scroll = 0.0; m.cats.get(m.tab).and_then(|c| c.get(cat)).map(|c| c.items.iter().map(|i| i.id.clone()).collect()).unwrap_or_default() }
    pub fn gmod_menu_listas(&self) -> Vec<Vec<String>> { self.gmod.menu.cats.iter().map(|c| c.iter().map(|x| x.n.clone()).collect()).collect() }
    /// poner algo del menú
    pub fn gmod_menu_poner(&mut self, it: &str) {
        let lua = |k: &str, cuerpo: &str| format!("local k = {k:?}\nlocal tr = LocalPlayer():GetEyeTrace()\nlocal p = tr.HitPos + tr.HitNormal * 16\n{cuerpo}");
        let src = match it.split_once(':') {
            Some(("arma", k)) => { if let Ok(k) = k.parse::<usize>() { self.gmod_guardar_arma(); self.armas.elegir(&mut self.fis, k); } self.gmod.panel = false; return; }
            // (un modelo con esqueleto de Valve y física de muñeco: como muñeco de trapo, gmEsMuneco)
            Some(("gmprop", r)) if self.gs_es_muneco(r) => { self.gmod.menu.pend.push(format!("gmrag:{r}")); self.gmod.panel = false; return; }
            Some(("gmprop", m)) => lua(m, "local e = ents.Create(\"prop_physics\")\nif IsValid(e) then e:SetModel(k) e:SetPos(p) e:SetAngles(Angle(0, LocalPlayer():EyeAngles().y + 180, 0)) e:Spawn() e:Activate() end"),
            // (los NPC y los vehículos de las listas: su clase con su modelo y sus valores, como el spawnmenu de GMod)
            // (una clase del motor —npc_citizen, npc_combine_s, zombis…— es un NPC del juego, como gmnpcCrear; una clase del
            // addon —nextbots, SNPC— se crea con su Lua)
            // (lo de gmod_spawn.rs y gmod_pm.rs necesita el motor: queda pedido para el cuadro, gm_poner_juego)
            Some(("gmnpc" | "gmveh" | "gmnpcm" | "gmrag" | "gmpm" | "pill" | "pillfin", _)) => { self.gmod.menu.pend.push(it.to_string()); self.gmod.panel = false; return; }
            _ => { self.gmod_poner(it); self.gmod.panel = false; return; }
        };
        if self.gmod.gm.is_none() { self.gmod_arrancar(); }
        self.gmod_prestar(true);
        let r = self.gmod.gm.as_mut().map(|g| g.correr(&src, "menú", false));
        self.gmod_prestar(false);
        if let Some(Err(e)) = r { self.avisar(format!("No se pudo poner: {e}")); }
        self.gmod.panel = false;
    }
    /// un NPC de las listas con una clase del addon (nextbot, entidad con IA propia): esa entidad con su Lua (__gmCrearNPC)
    fn gm_npc_lua(&mut self, k: &str) {
        let src = format!("local k = {k:?}\nlocal tr = LocalPlayer():GetEyeTrace()\nlocal p = tr.HitPos + tr.HitNormal * 16\nlocal t = list.Get(\"NPC\")[k]\nif not t then return end\nlocal e = ents.Create(t.Class or \"npc_citizen\")\nif not IsValid(e) then return end\nif t.Model then e:SetModel(t.Model) end\nif t.KeyValues then for a, b in pairs(t.KeyValues) do e:SetKeyValue(a, b) end end\nif t.Skin then e:SetSkin(t.Skin) end\ne:SetPos(p + Vector(0, 0, t.Offset or 0)) e:SetAngles(Angle(0, LocalPlayer():EyeAngles().y + 180, 0)) e:Spawn() e:Activate()\nif t.Health then e:SetHealth(t.Health) end");
        if self.gmod.gm.is_none() { self.gmod_arrancar(); }
        self.gmod_prestar(true);
        let r = self.gmod.gm.as_mut().map(|g| g.correr(&src, "menú", false));
        self.gmod_prestar(false);
        if let Some(Err(e)) = r { self.avisar(format!("No se pudo poner: {e}")); }
    }
    /// lo del menú que necesita el motor: los NPC de las listas (gmnpcCrear; los de una clase del addon, con su Lua), los
    /// vehículos (gmvehPrefab), un modelo de personaje como NPC o como muñeco y ponerse un modelo de jugador
    fn gm_poner_juego(&mut self, m: &mut Motor3d, it: &str) {
        match it.split_once(':') {
            Some(("gmnpc", k)) => { if !self.gs_npc_lista(m, k) { self.gm_npc_lua(k); } }
            Some(("gmveh", k)) => { if !self.gs_veh_poner(m, k) { self.avisar(format!("No se pudo poner {k}: falta su modelo")); } }
            Some(("gmnpcm", r)) => self.gs_npc_modelo(m, r),
            Some(("gmrag", r)) => self.gs_rag_modelo(m, r),
            Some(("gmpm", r)) => self.gmp_elegir(m, &format!("gmpm:{r}")),
            Some(("pill", id)) => { self.pill_aplicar(m, id); self.gmod.menu.hecho = false; }
            Some(("pillfin", _)) => { self.pill_fin(m); self.gmod.menu.hecho = false; }
            _ => {}
        }
    }
    /// los íconos de la grilla que se ven (de a 8 por cuadro) y las listas la primera vez
    pub fn gmod_menu_paso(&mut self, m: &mut Motor3d) {
        for it in std::mem::take(&mut self.gmod.menu.pend) { self.gm_poner_juego(m, &it); }
        if !self.gmod.panel { return; }
        if !self.gmod.menu.hecho { self.gmod_menu_armar(); }
        if self.gmod.menu.tab == TAB_ADDONS { return; }
        let (w, h) = self.gmod.pantalla; let (_, bs) = menu_geo(w, h, &self.gmod.menu);
        let mg = &self.gmod.menu; let cats = mg.cats.get(mg.tab);
        let mut quiero: Vec<String> = bs.iter().filter_map(|(b, _)| match b { BtnMenu::Item(i) => cats.and_then(|c| c.get(mg.cat)).and_then(|c| c.items.get(*i)).and_then(|it| it.ic.clone()), BtnMenu::Cat(i) => cats.and_then(|c| c.get(*i)).map(|c| format!("rb:{}", c.ic)), _ => None }).collect();
        quiero.extend(TABS.iter().map(|t| format!("rb:jxp/ui/icon16/{}.png", t.1)));
        let mut n = 0;
        for k in quiero {
            if n >= 8 { break; } if self.gmod.menu.iconos.contains_key(&k) { continue; } n += 1;
            let b: Option<Vec<u8>> = if let Some(r) = k.strip_prefix("gmpng:") { self.gmod.gm.as_ref().and_then(|g| g.archivo(r)).map(|x| x.to_vec()) } else if let Some(r) = k.strip_prefix("rb:") { self.gmod.lector_rb.as_ref().and_then(|l| l(r, 0, usize::MAX)) } else if let Some(c) = k.strip_prefix("gm:") {
                // (el ícono de un arma o entidad de un addon: su .png o su .vtf de entities/)
                let gm = self.gmod.gm.as_ref(); let png = ["materials/entities/", "materials/vgui/entities/"].iter().find_map(|d| gm.and_then(|g| g.archivo(&format!("{d}{c}.png")))).map(|x| x.to_vec());
                png.or_else(|| { let v = gm.and_then(|g| g.archivo(&format!("materials/vgui/entities/{c}.vtf")))?; let t = jxgmod::formatos::vtf(&v, 128).ok()?; let px = jxgmod::formatos::vtf_rgba(&t); let mut o = vec![]; { let mut e = png::Encoder::new(&mut o, t.w as u32, t.h as u32); e.set_color(png::ColorType::Rgba); e.set_depth(png::BitDepth::Eight); e.write_header().ok()?.write_image_data(&px).ok()?; } Some(o) })
            } else { None };
            // (PNG, o WebP: los íconos del menú de la personal van en WebP adentro de la APK —armar_nativo.py—, con el mismo nombre)
            let tex = b.and_then(|b| if b.starts_with(b"\x89PNG") { png_a_rgba(&b) } else { crate::pincel::decodificar(&b) }).and_then(|(w, h, px)| {
                let id = self.gm_id_pub(); let cab = Cabecera { mapa: String::new(), w: 0, h: 0, cam: None, luz: None, mallas: vec![], mats: vec![], texs: vec![Tex { id, n: k.clone(), w, h, a: 1, o: 0 }], lms: vec![], items: vec![], agua: None, cielo: None };
                unsafe { m.cargar(&Escena { c: cab, datos: px }) }.ok().map(|_| (id, w, h))
            });
            self.gmod.menu.iconos.insert(k, tex);
        }
    }
    pub fn gmod_menu_toque(&mut self, x: f32, y: f32, w: f32, h: f32) -> bool {
        let (_, bs) = menu_geo(w, h, &self.gmod.menu);
        let Some(b) = bs.into_iter().find(|(_, r)| x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3]).map(|x| x.0) else { return true };
        let mg = &mut self.gmod.menu;
        match b {
            BtnMenu::Cerrar => self.gmod.panel = false,
            BtnMenu::Tab(i) => { mg.tab = i; mg.cat = 0; mg.cat0 = 0; mg.scroll = 0.0; if i == TAB_ADDONS { self.gmod.scroll = 0.0; } }
            BtnMenu::Cat(i) => { mg.cat = i; mg.scroll = 0.0; }
            BtnMenu::Arriba => mg.cat0 = mg.cat0.saturating_sub(6),
            BtnMenu::Abajo => { let n = mg.cats.get(mg.tab).map(|c| c.len()).unwrap_or(0); mg.cat0 = (mg.cat0 + 6).min(n.saturating_sub(1)); }
            BtnMenu::Item(i) => { if let Some(id) = mg.cats.get(mg.tab).and_then(|c| c.get(mg.cat)).and_then(|c| c.items.get(i)).map(|it| it.id.clone()) { self.gmod_menu_poner(&id); } }
        }
        true
    }
    /// el menú: el panel, las pestañas, las listas y los nombres de la grilla (los íconos van aparte: `gmod_menu_iconos`)
    pub fn gmod_menu_dibujar(&self, l: &Letras, u: &mut Vec<f32>, wf: f32, hf: f32, t: f32) {
        let mg = &self.gmod.menu; let (c, bs) = menu_geo(wf, hf, mg); let bl = [1.0f32; 4]; let osc = [0.12, 0.13, 0.15, 1.0];
        if mg.tab != TAB_ADDONS { l.caja(u, c[0], c[1], c[2], c[3], hf * 0.015, [0.86, 0.87, 0.89, 0.97]); }
        let cats = mg.cats.get(mg.tab);
        for (b, r) in &bs {
            let txt = |l: &Letras, u: &mut Vec<f32>, s: &str, x: f32, col: [f32; 4], max: f32| { let mut ts = r[3] * 0.45; while l.ancho(ts, s) > max && ts > 6.0 { ts *= 0.9; } l.texto(u, x, r[1] + (r[3] - ts) / 2.0, ts, col, s); };
            match b {
                BtnMenu::Cerrar => { l.caja(u, r[0], r[1], r[2], r[3], r[3] * 0.2, [0.75, 0.2, 0.2, 0.95]); txt(l, u, "×", r[0] + r[2] * 0.35, bl, r[2]); }
                BtnMenu::Tab(i) => { let sel = *i == mg.tab; l.caja(u, r[0], r[1], r[2], r[3], r[3] * 0.2, if sel { [0.97, 0.97, 0.98, 1.0] } else { [0.62, 0.65, 0.7, 0.95] }); txt(l, u, TABS[*i].0, r[0] + r[3] * 0.9, osc, r[2] - r[3]); }
                BtnMenu::Arriba | BtnMenu::Abajo => { l.caja(u, r[0], r[1], r[2], r[3], r[3] * 0.2, [0.7, 0.72, 0.76, 0.95]); txt(l, u, if *b == BtnMenu::Arriba { "Subir" } else { "Bajar" }, r[0] + r[2] * 0.3, osc, r[2] * 0.7); }
                BtnMenu::Cat(i) => { let Some(ct) = cats.and_then(|c| c.get(*i)) else { continue }; let sel = *i == mg.cat; if sel { l.caja(u, r[0], r[1], r[2], r[3], 3.0, [0.25, 0.5, 0.85, 0.9]); } let ind = r[3] * (1.05 + ct.nivel as f32 * 0.6); txt(l, u, &format!("{} ({})", ct.n, ct.items.len()), r[0] + ind, if sel { bl } else { osc }, r[2] - ind - 4.0); }
                BtnMenu::Item(i) => {
                    let Some(it) = cats.and_then(|c| c.get(mg.cat)).and_then(|c| c.items.get(*i)) else { continue };
                    l.caja(u, r[0], r[1], r[2], r[3], r[3] * 0.06, [0.78, 0.8, 0.83, 1.0]);
                    let con_ic = it.ic.as_ref().and_then(|k| mg.iconos.get(k)).map(|x| x.is_some()).unwrap_or(false);
                    if !con_ic { let ts = r[3] * 0.11; let mut s = it.n.clone(); while l.ancho(ts, &s) > r[2] - 6.0 && s.len() > 3 { s.pop(); } l.texto(u, r[0] + 3.0, r[1] + r[3] / 2.0 - ts / 2.0, ts, osc, &s); }
                }
            }
        }
        if mg.tab != TAB_ADDONS && cats.map(|c| c.is_empty()).unwrap_or(true) { l.texto(u, c[0] + c[2] * 0.3, c[1] + c[3] * 0.4, t * 0.8, osc, "Nada en esta pestaña"); }
    }
    /// los íconos del menú (spawnicons, los de las pestañas y las listas): cada uno con su textura
    pub fn gmod_menu_iconos(&self, wf: f32, hf: f32, extra: &mut Vec<(i64, Vec<f32>)>) {
        let mg = &self.gmod.menu; let (_, bs) = menu_geo(wf, hf, mg); let cats = mg.cats.get(mg.tab);
        let mut quad = |k: &str, r: [f32; 4]| { let Some(Some((id, _, _))) = mg.iconos.get(k) else { return }; let g = match extra.iter_mut().find(|e| e.0 == *id) { Some(g) => g, None => { extra.push((*id, vec![])); extra.last_mut().unwrap() } };
            let ps = [(r[0], r[1], 0.0, 0.0), (r[0] + r[2], r[1], 1.0, 0.0), (r[0] + r[2], r[1] + r[3], 1.0, 1.0), (r[0], r[1] + r[3], 0.0, 1.0)]; for i in [0, 1, 2, 0, 2, 3] { let (x, y, uu, vv) = ps[i]; g.1.extend_from_slice(&[x, y, uu, vv, 1.0, 1.0, 1.0, 1.0]); } };
        for (b, r) in &bs {
            match b {
                BtnMenu::Tab(i) => { let s = r[3] * 0.55; quad(&format!("rb:jxp/ui/icon16/{}.png", TABS[*i].1), [r[0] + r[3] * 0.2, r[1] + (r[3] - s) / 2.0, s, s]); }
                BtnMenu::Cat(i) => { if let Some(ct) = cats.and_then(|c| c.get(*i)) { let s = r[3] * 0.7; quad(&format!("rb:{}", ct.ic), [r[0] + r[3] * (0.2 + ct.nivel as f32 * 0.6), r[1] + (r[3] - s) / 2.0, s, s]); } }
                BtnMenu::Item(i) => { if let Some(k) = cats.and_then(|c| c.get(mg.cat)).and_then(|c| c.items.get(*i)).and_then(|it| it.ic.clone()) { quad(&k, [r[0] + 2.0, r[1] + 2.0, r[2] - 4.0, r[3] - 4.0]); } }
                _ => {}
            }
        }
    }
}
