//! La censura del chat (censura.js, la parte local: siempre prendida, sin internet): insultos, groserías, contenido
//! sexual y odio en varios idiomas aunque vengan disfrazados (mayúsculas, acentos, letras repetidas «puuuta», números por
//! letras «sh1t», letras separadas «p.u.t.a») y datos personales (teléfonos, mails). Cada letra tapada es un `*`.
//! Las mismas reglas que las expresiones de la web, escritas a mano (no hay regex en la nativa). La revisión con la IA
//! de la web no está.

/// raíces (sin acentos, en minúscula, sin letras repetidas); «*» al final = cualquier final de palabra
const LISTA: &[&str] = &[
    // español
    "puta", "putas", "puto", "putos", "putita", "putitas", "putito", "putazo", "putear", "puteada", "puton", "hijueput*", "hijodeput*", "hdp", "pendej*", "mierd*", "cabron*", "verga", "vergas", "vergazo", "vrg", "culer*", "culiad*", "culo", "culos", "marica", "maricas", "maricon*", "joto", "jotos", "zora", "zoras",
    "malparid*", "gonorea", "chinga*", "chingad*", "pinche*", "mamon*", "mamaguev*", "mamahuev*", "gilipol*", "imbecil*", "idiot*", "estupid*", "retrasad*", "mogolic*", "subnormal*",
    "conchetumare", "conchesumare", "ctm", "csm", "ptm", "lpm", "lpmqtp", "chupal*", "chupam*", "pija", "pijas", "orto", "pelotud*", "sexo", "porno*", "xxx",
    "pene", "penes", "vagina*", "teta", "tetas", "nudes", "violar", "violad*", "violacion*", "matate", "suicidate", "kys", "cogerte", "cojer", "garch*", "trolo", "trolos", "travelo", "sudaca", "sudacas", "panchit*", "bastard*",
    // inglés
    "fuck*", "fck*", "fk", "fuk*", "shit*", "sht", "bitch*", "biatch", "asshole*", "ashole*", "dick", "dicks", "dickhead*", "cock", "cocks", "pusy", "pussies", "cunt*", "slut*", "whore*", "hoe", "hoes", "fag", "fags", "fagot*",
    "niger", "nigers", "niga", "nigas", "nigah", "nigaz", "retard*", "motherfuck*", "mf", "stfu", "wtf", "porn*", "sexy", "nude", "nudes", "rape", "raped", "raping", "rapist", "rapists", "dumbas*", "jackas*", "twat*", "wanker*", "prick*", "penis*", "kill yourself", "concha de tu madre", "concha tu madre", "la concha de", "tu vieja en tanga",
    // portugués
    "pora", "caralh*", "bucet*", "foda", "foder*", "fodase", "fodas*", "viado", "viados", "viadinho", "arombad*", "merda*", "desgracad*", "fdp", "vsf", "pqp", "otari*", "cuzao", "babac*",
    // otros
    "merde", "putain*", "conard*", "salope*", "encule*", "scheis*", "scheiß*", "arschloch*", "fotze*", "hurensohn*", "wichser*", "cazo", "cazi", "vafancul*", "stronz*", "putan*",
    "amk", "siktir*", "orospu*", "anjing", "bangsat*", "kontol*", "memek*", "ngentot*", "goblok*", "putangina*", "tangina*", "gago",
    "блят*", "бляд*", "сука", "суки", "хуй*", "хуе*", "пизд*", "ебат*", "ебан*", "пидор*", "мудак*",
];
/// (las que en otro idioma son palabras comunes no van: «tanga» en español es ropa)
const NO: &[&str] = &["cazo", "hoe", "mf"];

/// CENS_LEET: números y signos por letras
fn leet(c: char) -> Option<char> {
    Some(match c { '0' => 'o', '1' => 'i', '3' => 'e', '4' => 'a', '5' => 's', '7' => 't', '8' => 'b', '@' => 'a', '$' => 's', '!' => 'i', '|' => 'i', '€' => 'e', '¡' => 'i', _ => return None })
}
/// sin acento (lo de normalize('NFD') y sacar las marcas): las letras latinas con tilde, diéresis, etc.
fn sin_tilde(c: char) -> char {
    match c {
        'á' | 'à' | 'â' | 'ä' | 'ã' | 'å' | 'ā' | 'ă' | 'ą' => 'a', 'é' | 'è' | 'ê' | 'ë' | 'ē' | 'ė' | 'ę' | 'ě' => 'e',
        'í' | 'ì' | 'î' | 'ï' | 'ī' | 'į' => 'i', 'ó' | 'ò' | 'ô' | 'ö' | 'õ' | 'ō' | 'ő' => 'o', 'ú' | 'ù' | 'û' | 'ü' | 'ū' | 'ů' | 'ű' | 'ų' => 'u',
        'ý' | 'ÿ' => 'y', 'ç' | 'ć' | 'č' => 'c', 'ñ' | 'ń' | 'ň' => 'n', 'ś' | 'š' | 'ş' => 's', 'ź' | 'ż' | 'ž' => 'z', 'ď' => 'd', 'ľ' | 'ĺ' | 'ł' => 'l', 'ř' | 'ŕ' => 'r', 'ť' | 'ţ' => 't', 'ğ' => 'g',
        'й' => 'и', 'ё' => 'е', x => x,
    }
}
fn minus(c: char) -> char { c.to_lowercase().next().unwrap_or(c) }
/// censNormal: minúscula, sin acentos, ñ → n, números por letras, sólo letras y espacios, sin letras repetidas
fn normal(w: &str) -> String {
    let mut o = String::new(); let mut ant: Option<char> = None;
    for c in w.chars() {
        let c = sin_tilde(minus(c)); let c = leet(c).unwrap_or(c);
        if !(c.is_alphabetic() || c.is_whitespace()) { continue; }
        if c.is_alphabetic() && ant == Some(c) { continue; }
        o.push(c); ant = Some(c);
    }
    o
}
/// las raíces normalizadas (con «*»: cualquier final) y las frases
struct Raices { palabras: Vec<(String, bool)>, frases: Vec<String> }
fn raices() -> &'static Raices {
    static R: std::sync::OnceLock<Raices> = std::sync::OnceLock::new();
    R.get_or_init(|| Raices {
        palabras: LISTA.iter().filter(|w| !NO.contains(w) && !w.contains(' ')).map(|w| (normal(&w.replace('*', "")), w.ends_with('*'))).collect(),
        frases: LISTA.iter().filter(|w| w.contains(' ')).map(|w| normal(w)).collect(),
    })
}
/// censMala: ¿es una palabra mala (normalizada, de 2 letras o más)?
fn mala(w: &str) -> bool {
    let n = normal(w); if n.chars().count() < 2 { return false; }
    raices().palabras.iter().any(|(r, todo)| if *todo { n.starts_with(r.as_str()) && n[r.len()..].chars().all(char::is_alphabetic) } else { n == *r })
}
fn tapar(cs: &mut [char], a: usize, b: usize) { for c in &mut cs[a..b] { if !c.is_whitespace() { *c = '*'; } } }
/// \w de las expresiones de JavaScript (sin la bandera u): letras ASCII, números y _
fn w_js(c: char) -> bool { c.is_ascii_alphanumeric() || c == '_' }
/// la clase de las letras de palabras: [\p{L}\p{N}@$!|€¡]
fn de_palabra(c: char) -> bool { c.is_alphabetic() || c.is_numeric() || "@$!|€¡".contains(c) }
/// [\p{L}\p{N}@$]: lo que cuenta como letra suelta
fn suelta(c: char) -> bool { c.is_alphabetic() || c.is_numeric() || c == '@' || c == '$' }
fn separador(c: char) -> bool { c.is_whitespace() || "._-*,".contains(c) }

/// censurar: el texto con lo malo tapado (cada letra, un *)
pub fn censurar(t: &str) -> String {
    if t.is_empty() { return String::new(); }
    let mut cs: Vec<char> = t.chars().collect(); let n = cs.len();
    // mails: [\w.+-]+@[\w-]+\.[\w.]+
    let mut i = 0;
    while i < n {
        if cs[i] == '@' {
            let mut a = i; while a > 0 && (w_js(cs[a - 1]) || ".+-".contains(cs[a - 1])) { a -= 1; }
            let mut b = i + 1; while b < n && (w_js(cs[b]) || cs[b] == '-') { b += 1; }
            if a < i && b > i + 1 && b < n && cs[b] == '.' {
                let mut c = b + 1; while c < n && (w_js(cs[c]) || cs[c] == '.') { c += 1; }
                if c > b + 1 { tapar(&mut cs, a, c); i = c; continue; }
            }
        }
        i += 1;
    }
    // teléfonos: \+?\d[\d\s().-]{5,}\d con 8 números o más (y que no sea un número con ceros, como 10000000)
    let mut i = 0;
    while i < n {
        let ini = if cs[i] == '+' && i + 1 < n && cs[i + 1].is_ascii_digit() { Some(i) } else if cs[i].is_ascii_digit() { Some(i) } else { None };
        if let Some(a) = ini {
            let d0 = if cs[a] == '+' { a + 1 } else { a };
            let mut b = d0 + 1; while b < n && (cs[b].is_ascii_digit() || cs[b].is_whitespace() || "().-".contains(cs[b])) { b += 1; }
            // (termina en un número: el último del tramo; el medio, de 5 o más)
            let mut fin = b; while fin > d0 + 1 && !cs[fin - 1].is_ascii_digit() { fin -= 1; }
            if fin >= d0 + 7 {
                let ds: String = cs[a..fin].iter().filter(|c| c.is_ascii_digit()).collect();
                let ceros = ds.len() > 1 && ds[1..].chars().all(|c| c == '0');
                if ds.len() >= 8 && !ceros { tapar(&mut cs, a, fin); }
                i = fin.max(i + 1); continue;
            }
        }
        i += 1;
    }
    // palabra por palabra
    let mut i = 0;
    while i < n {
        if de_palabra(cs[i]) { let mut b = i; while b < n && de_palabra(cs[b]) { b += 1; } let w: String = cs[i..b].iter().collect(); if mala(&w) { tapar(&mut cs, i, b); } i = b; } else { i += 1; }
    }
    // letras sueltas separadas («p u t a», «p.u.t.a», «f-u-c-k»): al principio o después de un espacio, 3 o más
    let mut i = 0;
    while i < n {
        if (i == 0 || cs[i - 1].is_whitespace()) && suelta(cs[i]) {
            let (mut k, mut u) = (i, 0);
            loop { if k < n && suelta(cs[k]) && (k + 1 == n || separador(cs[k + 1])) { k += 1; while k < n && separador(cs[k]) { k += 1; } u += 1; } else { break; } }
            if u >= 3 {
                let w: String = cs[i..k].iter().filter(|c| !separador(**c)).collect();
                if w.chars().count() >= 3 && mala(&w) { for c in &mut cs[i..k] { if suelta(*c) { *c = '*'; } } }
                i = k; continue;
            }
        }
        i += 1;
    }
    // frases de varias palabras (en una copia del mismo largo: sin acentos ni números por letras, en minúscula)
    let sl: Vec<char> = cs.iter().map(|&c| { let b = minus(leet(c).unwrap_or(c)); sin_tilde(b) }).collect();
    for f in &raices().frases {
        let pal: Vec<Vec<char>> = f.split(' ').map(|p| p.chars().collect()).collect();
        let mut i = 0;
        while i < n {
            match frase_en(&sl, i, &pal) { Some(fin) if fin > i => { tapar(&mut cs, i, fin); i = fin; } _ => i += 1 }
        }
    }
    cs.into_iter().collect()
}
/// ¿empieza en `i` la frase (cada letra una o más veces, entre letras [\W_]*, entre palabras [\s\W_]+)? hasta dónde
fn frase_en(s: &[char], i: usize, pal: &[Vec<char>]) -> Option<usize> {
    fn letra(s: &[char], i: usize, pal: &[Vec<char>], p: usize, l: usize) -> Option<usize> {
        let c = pal[p][l]; if i >= s.len() || s[i] != c { return None; }
        let mut j = i + 1; while j < s.len() && s[j] == c { j += 1; }
        // (codicioso con vuelta atrás: de lo más largo a lo más corto)
        let mut k = j;
        while k > i {
            if l + 1 < pal[p].len() {
                let mut m = k; loop { if let Some(f) = letra(s, m, pal, p, l + 1) { return Some(f); } if m < s.len() && !w_js(s[m]) { m += 1; } else { break; } }
            } else if p + 1 < pal.len() {
                let mut m = k; while m < s.len() && !w_js(s[m]) { m += 1; }
                while m > k { if let Some(f) = letra(s, m, pal, p + 1, 0) { return Some(f); } m -= 1; }
            } else { return Some(k); }
            k -= 1;
        }
        None
    }
    letra(s, i, pal, 0, 0)
}

#[cfg(test)]
mod pruebas {
    use super::censurar;
    #[test]
    fn tapa() {
        assert_eq!(censurar("hola che"), "hola che");
        assert_eq!(censurar("sos un puuuto"), "sos un ******");
        assert_eq!(censurar("sh1t"), "****");
        assert_eq!(censurar("p.u.t.a"), "*.*.*.*");
        assert_eq!(censurar("me compré una tanga"), "me compré una tanga");
        assert_eq!(censurar("kill yourself"), "**** ********");
    }
}
