//! Los idiomas de JXMod nativo, los mismos 14 de la web: sus textos (juego/idiomas.js e idiomas3.js, sacados con
//! herramientas/idiomas_nativo.mjs a idiomas_web.json.gz) y los de la nativa (idiomas_nativo.tsv: una fila por texto, en el
//! orden de CODIGOS, separados por tabulación), buscados por el texto en castellano. Las letras de dibujo (pincel.rs de la
//! nativa y texto.rs) pasan cada texto por `tr`: lo que no está en las tablas queda como está.
//! El árabe va con las letras unidas (las formas de presentación, FE70–FEFC: el atlas no arma texto) y se da vuelta al
//! dibujarlo (`visual`); el japonés y el tailandés, que no separan las palabras con espacios, se cortan entre letras
//! (`piezas`).
use std::borrow::Cow;
use std::collections::HashMap;
use std::io::Read;
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::OnceLock;

pub const CODIGOS: [&str; 14] = ["es", "en", "pt", "id", "ms", "fil", "ja", "th", "tr", "ar", "ru", "uk", "fr", "de"];
pub const NOMBRES: [&str; 14] = ["Español", "English", "Português", "Bahasa Indonesia", "Bahasa Melayu", "Filipino", "日本語", "ไทย", "Türkçe", "العربية", "Русский", "Українська", "Français", "Deutsch"];
const WEB: &[u8] = include_bytes!("idiomas_web.json.gz");
const NATIVA: &str = include_str!("idiomas_nativo.tsv");
const AR: usize = 9;

static ACTUAL: AtomicUsize = AtomicUsize::new(0);
thread_local! { static CRUDO: std::cell::Cell<bool> = const { std::cell::Cell::new(false) }; }
/// lo que se dibuja adentro va tal cual, sin traducir (los nombres de los idiomas, lo que escribe la gente)
pub fn crudo<R>(f: impl FnOnce() -> R) -> R { let a = CRUDO.with(|c| c.replace(true)); let r = f(); CRUDO.with(|c| c.set(a)); r }
/// el idioma elegido (índice de CODIGOS; 0, castellano)
pub fn actual() -> usize { ACTUAL.load(Ordering::Relaxed) }
pub fn poner(i: usize) { ACTUAL.store(i.min(CODIGOS.len() - 1), Ordering::Relaxed); }
pub fn codigo() -> &'static str { CODIGOS[actual()] }
/// el índice de un código de idioma («pt-BR», «in» —indonesio en Android viejo—, «tl» —filipino—…)
pub fn de_codigo(c: &str) -> Option<usize> {
    let c = c.trim().to_ascii_lowercase(); let c = c.split(['-', '_']).next().unwrap_or("");
    let c = match c { "in" => "id", "tl" => "fil", x => x };
    CODIGOS.iter().position(|x| *x == c)
}

struct Tabla { idx: HashMap<String, usize>, filas: Vec<Vec<String>> }
fn agregar(t: &mut Tabla, mut v: Vec<String>) {
    if v.first().map_or(true, |s| s.is_empty()) { return; }
    v.resize(CODIGOS.len(), String::new());
    match t.idx.get(&v[0]) {
        Some(&i) => { for (j, s) in v.into_iter().enumerate() { if !s.is_empty() { t.filas[i][j] = s; } } }
        None => { t.idx.insert(v[0].clone(), t.filas.len()); t.filas.push(v); }
    }
}
fn tabla() -> &'static Tabla {
    static T: OnceLock<Tabla> = OnceLock::new();
    T.get_or_init(|| {
        let mut t = Tabla { idx: HashMap::new(), filas: vec![] };
        let mut s = String::new();
        if flate2::read::GzDecoder::new(WEB).read_to_string(&mut s).is_ok() {
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&s) {
                for f in v["f"].as_array().into_iter().flatten() {
                    agregar(&mut t, f.as_array().into_iter().flatten().map(|x| x.as_str().unwrap_or("").to_string()).collect());
                }
            }
        }
        // (los de la nativa, después: si alguno ya estaba en la web, mandan los de acá)
        for r in NATIVA.lines() { if r.is_empty() || r.starts_with('#') { continue; } agregar(&mut t, r.split('\t').map(|x| x.trim().to_string()).collect()); }
        // (lo que falta en un idioma va en inglés, como en la web; y el árabe, con las letras unidas)
        for f in &mut t.filas {
            for j in 2..CODIGOS.len() { if f[j].is_empty() { f[j] = f[1].clone(); } }
            f[AR] = unir_arabe(&f[AR]);
        }
        t
    })
}
/// el texto en el idioma elegido (o el mismo, si está en castellano o no está en las tablas)
pub fn tr(s: &str) -> &str {
    let i = actual(); if i == 0 || s.is_empty() || CRUDO.with(|c| c.get()) { return s; }
    let t = tabla();
    match t.idx.get(s) { Some(&r) if !t.filas[r][i].is_empty() => &t.filas[r][i], _ => s }
}
/// cuántos textos hay traducidos (para el panel de Idioma y las pruebas)
pub fn cuantos() -> usize { tabla().filas.len() }

// ---- el árabe: las letras unidas (cada una en su forma: sola, al final, al principio o en el medio) ----
/// (la letra, su primera forma de presentación, cuántas formas tiene: 1 no se une, 2 sólo con la de antes, 4 con las dos)
const FORMAS: [(char, u32, u8); 36] = [
    ('ء', 0xFE80, 1), ('آ', 0xFE81, 2), ('أ', 0xFE83, 2), ('ؤ', 0xFE85, 2), ('إ', 0xFE87, 2), ('ئ', 0xFE89, 4), ('ا', 0xFE8D, 2), ('ب', 0xFE8F, 4),
    ('ة', 0xFE93, 2), ('ت', 0xFE95, 4), ('ث', 0xFE99, 4), ('ج', 0xFE9D, 4), ('ح', 0xFEA1, 4), ('خ', 0xFEA5, 4), ('د', 0xFEA9, 2), ('ذ', 0xFEAB, 2),
    ('ر', 0xFEAD, 2), ('ز', 0xFEAF, 2), ('س', 0xFEB1, 4), ('ش', 0xFEB5, 4), ('ص', 0xFEB9, 4), ('ض', 0xFEBD, 4), ('ط', 0xFEC1, 4), ('ظ', 0xFEC5, 4),
    ('ع', 0xFEC9, 4), ('غ', 0xFECD, 4), ('ف', 0xFED1, 4), ('ق', 0xFED5, 4), ('ك', 0xFED9, 4), ('ل', 0xFEDD, 4), ('م', 0xFEE1, 4), ('ن', 0xFEE5, 4),
    ('ه', 0xFEE9, 4), ('و', 0xFEED, 2), ('ى', 0xFEEF, 2), ('ي', 0xFEF1, 4),
];
fn forma(c: char) -> Option<(u32, u8)> { if c == 'ـ' { return Some((0x640, 4)); } FORMAS.iter().find(|x| x.0 == c).map(|x| (x.1, x.2)) }
/// las marcas (vocales cortas y demás): no cuentan para unir
fn marca(c: char) -> bool { matches!(c as u32, 0x610..=0x61A | 0x64B..=0x65F | 0x670 | 0x6D6..=0x6ED) }
/// el árabe con las letras unidas (para lo que no pasa por `tr`, como los nombres de los idiomas)
pub fn unir_arabe(s: &str) -> String {
    if !s.chars().any(|c| forma(c).is_some()) { return s.to_string(); }
    let v: Vec<char> = s.chars().collect(); let mut o = String::with_capacity(s.len() * 2);
    // (la letra de antes y la de después que no sean marcas)
    let ant = |i: usize| v[..i].iter().rev().find(|c| !marca(**c)).copied();
    let sig = |i: usize| v[i + 1..].iter().find(|c| !marca(**c)).copied();
    let une_despues = |c: Option<char>| c.and_then(forma).map_or(false, |f| f.1 == 4);
    let une_antes = |c: Option<char>| c.and_then(forma).map_or(false, |f| f.1 >= 2);
    let mut i = 0;
    while i < v.len() {
        let c = v[i];
        let Some((f0, n)) = forma(c) else { o.push(c); i += 1; continue };
        if c == 'ـ' { o.push(c); i += 1; continue; }
        let con_antes = n >= 2 && une_despues(ant(i));
        // (lam con alef: una sola letra)
        if c == 'ل' {
            let j = (i + 1..v.len()).find(|&j| !marca(v[j]));
            if let Some(j) = j { let lig = match v[j] { 'آ' => Some(0xFEF5), 'أ' => Some(0xFEF7), 'إ' => Some(0xFEF9), 'ا' => Some(0xFEFB), _ => None };
                if let Some(l) = lig { o.extend(char::from_u32(l + con_antes as u32)); for k in i + 1..j { o.push(v[k]); } i = j + 1; continue; } }
        }
        let con_despues = n == 4 && une_antes(sig(i));
        let k = match (con_antes, con_despues) { (false, false) => 0, (true, false) => 1, (false, true) => 2, (true, true) => 3 };
        let k = if n == 2 { k.min(1) } else if n == 1 { 0 } else { k };
        o.extend(char::from_u32(f0 + k as u32)); i += 1;
    }
    o
}

// ---- de derecha a izquierda: el orden en que se dibujan las letras ----
fn rtl(c: char) -> bool { matches!(c as u32, 0x590..=0x8FF | 0xFB1D..=0xFDFF | 0xFE70..=0xFEFF) }
fn ltr(c: char) -> bool { c.is_alphabetic() && !rtl(c) }
fn espejo(c: char) -> char { match c { '(' => ')', ')' => '(', '[' => ']', ']' => '[', '{' => '}', '}' => '{', '«' => '»', '»' => '«', '<' => '>', '>' => '<', x => x } }
/// el texto en el orden en que se dibuja (de izquierda a derecha): lo árabe al revés, con lo latino y los números adentro
/// en su orden; el renglón va de derecha a izquierda si su primera letra es árabe
pub fn visual(s: &str) -> Cow<'_, str> {
    if !s.chars().any(rtl) { return Cow::Borrowed(s); }
    let v: Vec<char> = s.chars().collect(); let n = v.len();
    let base_rtl = v.iter().find(|c| rtl(**c) || ltr(**c)).map_or(true, |c| rtl(*c));
    // (la dirección de cada letra: las fuertes, la suya; los números, de izquierda a derecha; lo neutro, la de sus vecinas
    // si coinciden y si no la del renglón)
    let fuerte = |c: char| if rtl(c) { Some(true) } else if ltr(c) || c.is_ascii_digit() { Some(false) } else { None };
    let mut d = vec![base_rtl; n];
    for i in 0..n {
        d[i] = match fuerte(v[i]) { Some(x) => x, None => {
            let a = v[..i].iter().rev().find_map(|c| fuerte(*c)).unwrap_or(base_rtl);
            let b = v[i + 1..].iter().find_map(|c| fuerte(*c)).unwrap_or(base_rtl);
            if a == b { a } else { base_rtl }
        } };
        // (las marcas van con su letra)
        if marca(v[i]) && i > 0 { d[i] = d[i - 1]; }
    }
    // los tramos de una misma dirección
    let mut tramos: Vec<(bool, Vec<char>)> = vec![];
    for i in 0..n { match tramos.last_mut() { Some(t) if t.0 == d[i] => t.1.push(v[i]), _ => tramos.push((d[i], vec![v[i]])) } }
    if base_rtl { tramos.reverse(); }
    let mut o = String::with_capacity(s.len());
    for (r, t) in tramos {
        if !r { o.extend(t); continue; }
        // (al revés de a grupos: la letra y sus marcas, en ese orden, para que la marca quede sobre su letra)
        let mut grupos: Vec<Vec<char>> = vec![];
        for c in t { if marca(c) { if let Some(g) = grupos.last_mut() { g.push(c); continue; } } grupos.push(vec![espejo(c)]); }
        for g in grupos.into_iter().rev() { o.extend(g); }
    }
    Cow::Owned(o)
}

// ---- dónde se puede cortar el renglón ----
fn cjk(c: char) -> bool { matches!(c as u32, 0x2E80..=0x9FFF | 0xF900..=0xFAFF | 0xFF00..=0xFFEF) }
/// las que no pueden empezar un renglón (los cierres y las pequeñas del japonés)
fn no_empieza(c: char) -> bool { "、。，．・：；？！」』）】〕〉》ー…ぁぃぅぇぉっゃゅょァィゥェォッャュョ)]}.,!?:;%".contains(c) }
fn thai_inicial(c: char) -> bool { matches!(c as u32, 0xE40..=0xE44) }
fn thai_consonante(c: char) -> bool { matches!(c as u32, 0xE01..=0xE2E) }
/// el párrafo en pedazos que no se cortan, cada uno con si va un espacio antes: las palabras, y en el japonés y el
/// tailandés (sin espacios) también entre letras
pub fn piezas(p: &str) -> Vec<(bool, &str)> {
    let mut o = vec![];
    for (k, pal) in p.split(' ').enumerate() {
        let mut ini = 0; let mut ant: Option<char> = None; let mut primera = true;
        for (i, c) in pal.char_indices() {
            let corta = match ant { None => false, Some(a) =>
                ((cjk(c) || cjk(a)) && !no_empieza(c) && !matches!(a, '「' | '『' | '（' | '(' | '【'))
                || (thai_inicial(c) && !thai_inicial(a)) || (thai_consonante(c) && !thai_inicial(a) && (thai_consonante(a) || matches!(a as u32, 0xE30..=0xE3A | 0xE45..=0xE4E))) };
            if corta && i > ini { o.push((primera && k > 0, &pal[ini..i])); primera = false; ini = i; }
            ant = Some(c);
        }
        o.push((primera && k > 0, &pal[ini..]));
    }
    o
}

#[cfg(test)]
mod pruebas {
    use super::*;
    #[test]
    fn traduce() {
        poner(1); assert_eq!(tr("Ajustes"), "Settings"); assert_eq!(tr("no está"), "no está"); poner(0); assert_eq!(tr("Ajustes"), "Ajustes");
        assert!(cuantos() > 900);
    }
    #[test]
    fn arabe() {
        // (لا: la ligadura; سلام: s ini, l medio + alef final → ligadura final; م sola)
        assert_eq!(unir_arabe("لا"), "\u{FEFB}");
        assert_eq!(unir_arabe("سلام"), "\u{FEB3}\u{FEFC}\u{FEE1}");
        assert_eq!(visual("ab"), "ab");
        assert_eq!(visual("\u{FEB3}\u{FEFC} 12"), "12 \u{FEFC}\u{FEB3}");
    }
    #[test]
    fn cortes() {
        let v = piezas("日本語のテスト。です"); assert!(v.len() > 4 && v.iter().all(|p| !p.1.starts_with('。')));
        let v = piezas("hola mundo"); assert_eq!(v, vec![(false, "hola"), (true, "mundo")]);
    }
}
