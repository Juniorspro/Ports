//! El léxico: de bytes a fichas, como `luaLexico` de la web. Lua 5.1 más lo de GMod: `!=`, `&&`, `||`, `!`, comentarios
//! `//` y `/* */`, y la palabra `continue`. Los números de LuaJIT con sufijo (1LL, 1ULL, 1i) se leen sin el sufijo.
use std::rc::Rc;

use crate::valor::Cadena;

#[derive(Clone, Debug, PartialEq)]
pub(crate) enum T {
    Nom(Rc<Cadena>),
    Num(f64),
    Cad(Rc<Cadena>),
    // palabras
    And, Break, Do, Else, Elseif, End, False, For, Function, Goto, If, In, Local, Nil, Not, Or, Repeat, Return, Then,
    True, Until, While, Continue,
    // símbolos
    Mas, Menos, Por, Barra, Porc, Pot, Numeral, Igual2, Distinto, MenorIg, MayorIg, Menor, Mayor, Asig, AbreP, CierraP,
    AbreL, CierraL, AbreC, CierraC, PuntoComa, DosPuntos, Coma, Punto, Concat, Tres, DosDos,
    Eof,
}

impl T {
    /// cómo se muestra en los mensajes de error de sintaxis (como la web: JSON.stringify del valor, o 'ficha')
    pub(crate) fn mostrar(&self) -> String {
        match self {
            T::Nom(s) | T::Cad(s) => json_texto(s.bytes()),
            T::Num(n) => crate::numeros::js_tostring(*n),
            otro => format!("'{}'", otro.nombre()),
        }
    }
    pub(crate) fn nombre(&self) -> &'static str {
        match self {
            T::Nom(_) => "nom", T::Num(_) => "num", T::Cad(_) => "str",
            T::And => "and", T::Break => "break", T::Do => "do", T::Else => "else", T::Elseif => "elseif", T::End => "end",
            T::False => "false", T::For => "for", T::Function => "function", T::Goto => "goto", T::If => "if", T::In => "in",
            T::Local => "local", T::Nil => "nil", T::Not => "not", T::Or => "or", T::Repeat => "repeat", T::Return => "return",
            T::Then => "then", T::True => "true", T::Until => "until", T::While => "while", T::Continue => "continue",
            T::Mas => "+", T::Menos => "-", T::Por => "*", T::Barra => "/", T::Porc => "%", T::Pot => "^", T::Numeral => "#",
            T::Igual2 => "==", T::Distinto => "~=", T::MenorIg => "<=", T::MayorIg => ">=", T::Menor => "<", T::Mayor => ">",
            T::Asig => "=", T::AbreP => "(", T::CierraP => ")", T::AbreL => "{", T::CierraL => "}", T::AbreC => "[",
            T::CierraC => "]", T::PuntoComa => ";", T::DosPuntos => ":", T::Coma => ",", T::Punto => ".", T::Concat => "..",
            T::Tres => "...", T::DosDos => "::", T::Eof => "eof",
        }
    }
}

/// JSON.stringify de un texto (para los mensajes)
pub(crate) fn json_texto(b: &[u8]) -> String {
    let s = String::from_utf8_lossy(b);
    let mut o = String::from("\"");
    for c in s.chars() {
        match c {
            '"' => o.push_str("\\\""),
            '\\' => o.push_str("\\\\"),
            '\n' => o.push_str("\\n"),
            '\r' => o.push_str("\\r"),
            '\t' => o.push_str("\\t"),
            '\u{8}' => o.push_str("\\b"),
            '\u{c}' => o.push_str("\\f"),
            c if (c as u32) < 0x20 => o.push_str(&format!("\\u{:04x}", c as u32)),
            c => o.push(c),
        }
    }
    o.push('"');
    o
}

pub(crate) struct Ficha {
    pub t: T,
    pub ln: u32,
}

fn palabra(w: &[u8]) -> Option<T> {
    Some(match w {
        b"and" => T::And, b"break" => T::Break, b"do" => T::Do, b"else" => T::Else, b"elseif" => T::Elseif, b"end" => T::End,
        b"false" => T::False, b"for" => T::For, b"function" => T::Function, b"goto" => T::Goto, b"if" => T::If, b"in" => T::In,
        b"local" => T::Local, b"nil" => T::Nil, b"not" => T::Not, b"or" => T::Or, b"repeat" => T::Repeat,
        b"return" => T::Return, b"then" => T::Then, b"true" => T::True, b"until" => T::Until, b"while" => T::While,
        b"continue" => T::Continue,
        _ => return None,
    })
}

#[inline] fn es_letra(c: u8) -> bool { c.is_ascii_alphabetic() || c == b'_' || c > 127 }
#[inline] fn es_alnum(c: u8) -> bool { c.is_ascii_alphanumeric() || c == b'_' || c > 127 }

pub(crate) fn lexico(src: &[u8], archivo: &str) -> Result<Vec<Ficha>, String> {
    let mut t: Vec<Ficha> = Vec::with_capacity(src.len() / 4 + 16);
    let n = src.len();
    let mut i = 0usize;
    let mut ln: u32 = 1;
    let at = |k: usize| -> u8 { if k < n { src[k] } else { 0 } };
    macro_rules! err { ($ln:expr, $($m:tt)*) => { return Err(format!("{}:{}: {}", archivo, $ln, format!($($m)*))) } }
    // [[ ]] o [==[ ]==]: j apunta al '['; devuelve (contenido, fin) o None si no es cadena larga
    let largo = |j: usize, ln: &mut u32| -> Result<Option<(Vec<u8>, usize)>, String> {
        let mut k = j + 1;
        let mut eq = 0;
        while at(k) == b'=' { eq += 1; k += 1; }
        if at(k) != b'[' { return Ok(None); }
        let mut cierre = vec![b']'];
        cierre.extend(std::iter::repeat(b'=').take(eq));
        cierre.push(b']');
        let mut s = k + 1;
        if at(s) == b'\r' { s += 1; }
        if at(s) == b'\n' { s += 1; }
        let e = match buscar(src, &cierre, s) { Some(e) => e, None => return Err(format!("{}:{}: cadena larga sin cerrar", archivo, ln)) };
        for &c in &src[j..e] { if c == b'\n' { *ln += 1; } }
        Ok(Some((src[s..e].to_vec(), e + cierre.len())))
    };
    while i < n {
        let c = src[i];
        if c == b'\n' { ln += 1; i += 1; continue; }
        if c == b'\r' { if at(i + 1) != b'\n' { ln += 1; } i += 1; continue; }
        if c == b' ' || c == b'\t' || c == 0x0c || c == 0x0b { i += 1; continue; }
        if c == 0xEF && at(i + 1) == 0xBB && at(i + 2) == 0xBF { i += 3; continue; }
        if c == b'-' && at(i + 1) == b'-' {
            if at(i + 2) == b'[' {
                if let Some((_, fin)) = largo(i + 2, &mut ln)? { i = fin; continue; }
            }
            while i < n && src[i] != b'\n' && src[i] != b'\r' { i += 1; }
            continue;
        }
        if c == b'/' && at(i + 1) == b'/' { while i < n && src[i] != b'\n' && src[i] != b'\r' { i += 1; } continue; }
        if c == b'/' && at(i + 1) == b'*' {
            let f = match buscar(src, b"*/", i + 2) { Some(e) => e + 2, None => n };
            for &x in &src[i..f] { if x == b'\n' { ln += 1; } }
            i = f;
            continue;
        }
        if i == 0 && c == b'#' && at(1) == b'!' { while i < n && src[i] != b'\n' { i += 1; } continue; }
        let l0 = ln;
        if es_letra(c) {
            let mut j = i + 1;
            while j < n && es_alnum(src[j]) { j += 1; }
            let w = &src[i..j];
            t.push(Ficha { t: palabra(w).unwrap_or_else(|| T::Nom(Cadena::interna(w))), ln: l0 });
            i = j;
            continue;
        }
        if c.is_ascii_digit() || (c == b'.' && at(i + 1).is_ascii_digit()) {
            let mut j;
            let v: f64;
            if c == b'0' && (at(i + 1) == b'x' || at(i + 1) == b'X') {
                j = i + 2;
                while j < n && (src[j].is_ascii_hexdigit() || src[j] == b'.') { j += 1; }
                let s = &src[i + 2..j];
                let (ip, fp) = match s.iter().position(|&c| c == b'.') { Some(p) => (&s[..p], &s[p + 1..]), None => (s, &s[s.len()..]) };
                let mut entero: u128 = 0;
                let mut x = 0f64;
                let mut exacto = true;
                for &d in ip {
                    let d = (d as char).to_digit(16).unwrap_or(0);
                    if exacto { match entero.checked_mul(16).and_then(|e| e.checked_add(d as u128)) { Some(e) => entero = e, None => { exacto = false; x = entero as f64 * 16.0 + d as f64; } } } else { x = x * 16.0 + d as f64; }
                }
                let mut val = if exacto { entero as f64 } else { x };
                if !fp.is_empty() {
                    let mut f = 0f64;
                    for &d in fp { f = f * 16.0 + (d as char).to_digit(16).unwrap_or(0) as f64; }
                    val += f / 16f64.powi(fp.len() as i32);
                }
                if at(j) == b'p' || at(j) == b'P' {
                    j += 1;
                    let mut e = j;
                    if at(e) == b'+' || at(e) == b'-' { e += 1; }
                    while at(e).is_ascii_digit() { e += 1; }
                    let ex: i32 = std::str::from_utf8(&src[j..e]).ok().and_then(|s| s.parse().ok()).unwrap_or(0);
                    val *= 2f64.powi(ex);
                    j = e;
                }
                v = val;
            } else {
                j = i;
                while j < n && (src[j].is_ascii_digit() || src[j] == b'.') { j += 1; }
                if at(j) == b'e' || at(j) == b'E' {
                    j += 1;
                    if at(j) == b'+' || at(j) == b'-' { j += 1; }
                    while at(j).is_ascii_digit() { j += 1; }
                }
                let txt = &src[i..j];
                match crate::numeros::texto_a_num(txt) {
                    Some(x) if x.is_finite() || txt == b"inf" => v = x,
                    _ => err!(ln, "número malo {}", String::from_utf8_lossy(txt)),
                }
            }
            while matches!(at(j), b'u' | b'U' | b'l' | b'L' | b'i') { j += 1; }
            t.push(Ficha { t: T::Num(v), ln: l0 });
            i = j;
            continue;
        }
        if c == b'"' || c == b'\'' {
            let mut j = i + 1;
            let mut s: Vec<u8> = Vec::new();
            while j < n && src[j] != c {
                let ch = src[j];
                if ch == b'\n' { err!(ln, "cadena sin cerrar"); }
                if ch == b'\\' {
                    j += 1;
                    let ch = at(j);
                    let m = match ch {
                        b'n' => Some(b'\n'), b't' => Some(b'\t'), b'r' => Some(b'\r'), b'a' => Some(7), b'b' => Some(8),
                        b'f' => Some(12), b'v' => Some(11), b'\\' => Some(b'\\'), b'"' => Some(b'"'), b'\'' => Some(b'\''),
                        b'\n' => Some(b'\n'), b'[' => Some(b'['), b']' => Some(b']'),
                        _ => None,
                    };
                    if let Some(m) = m { if ch == b'\n' { ln += 1; } s.push(m); j += 1; continue; }
                    if ch == b'x' {
                        let h = &src[(j + 1).min(n)..(j + 3).min(n)];
                        s.push(std::str::from_utf8(h).ok().and_then(|h| u8::from_str_radix(h, 16).ok()).unwrap_or(0));
                        j += 3;
                        continue;
                    }
                    if ch == b'z' {
                        j += 1;
                        while j < n && src[j].is_ascii_whitespace() { if src[j] == b'\n' { ln += 1; } j += 1; }
                        continue;
                    }
                    if ch == b'u' && at(j + 1) == b'{' {
                        let e = buscar(src, b"}", j).unwrap_or(n);
                        let cp = std::str::from_utf8(&src[(j + 2).min(e)..e]).ok().and_then(|h| u32::from_str_radix(h, 16).ok()).unwrap_or(0xfffd);
                        let mut buf = [0u8; 4];
                        s.extend_from_slice(char::from_u32(cp).unwrap_or('\u{fffd}').encode_utf8(&mut buf).as_bytes());
                        j = e + 1;
                        continue;
                    }
                    if ch.is_ascii_digit() {
                        let mut k = j;
                        while k < j + 3 && at(k).is_ascii_digit() { k += 1; }
                        let v: u32 = std::str::from_utf8(&src[j..k]).unwrap().parse().unwrap_or(0);
                        s.push((v & 255) as u8);
                        j = k;
                        continue;
                    }
                    if j < n { s.push(ch); }
                    j += 1;
                    continue;
                }
                s.push(ch);
                j += 1;
            }
            if j >= n { err!(ln, "cadena sin cerrar"); }
            t.push(Ficha { t: T::Cad(if s.len() <= 40 { Cadena::interna(&s) } else { Cadena::desde_vec(s) }), ln: l0 });
            i = j + 1;
            continue;
        }
        if c == b'[' && (at(i + 1) == b'[' || at(i + 1) == b'=') {
            if let Some((v, fin)) = largo(i, &mut ln)? {
                t.push(Ficha { t: T::Cad(Cadena::desde_vec(v)), ln: l0 });
                i = fin;
                continue;
            }
        }
        if c == b'.' && at(i + 1) == b'.' && at(i + 2) == b'.' { t.push(Ficha { t: T::Tres, ln: l0 }); i += 3; continue; }
        let dos = match (c, at(i + 1)) {
            (b'=', b'=') => Some(T::Igual2), (b'~', b'=') | (b'!', b'=') => Some(T::Distinto), (b'<', b'=') => Some(T::MenorIg),
            (b'>', b'=') => Some(T::MayorIg), (b'.', b'.') => Some(T::Concat), (b':', b':') => Some(T::DosDos),
            (b'&', b'&') => Some(T::And), (b'|', b'|') => Some(T::Or),
            _ => None,
        };
        if let Some(x) = dos { t.push(Ficha { t: x, ln: l0 }); i += 2; continue; }
        let uno = match c {
            b'+' => T::Mas, b'-' => T::Menos, b'*' => T::Por, b'/' => T::Barra, b'%' => T::Porc, b'^' => T::Pot,
            b'#' => T::Numeral, b'<' => T::Menor, b'>' => T::Mayor, b'=' => T::Asig, b'(' => T::AbreP, b')' => T::CierraP,
            b'{' => T::AbreL, b'}' => T::CierraL, b'[' => T::AbreC, b']' => T::CierraC, b';' => T::PuntoComa,
            b':' => T::DosPuntos, b',' => T::Coma, b'.' => T::Punto, b'!' => T::Not,
            b'&' | b'|' | b'~' => err!(ln, "operador {} no existe en Lua 5.1", c as char),
            _ => {
                let txt = String::from_utf8_lossy(&src[i..(i + 1).min(n)]).to_string();
                err!(ln, "caracter raro {}", json_texto(txt.as_bytes()))
            }
        };
        t.push(Ficha { t: uno, ln: l0 });
        i += 1;
    }
    t.push(Ficha { t: T::Eof, ln });
    Ok(t)
}

fn buscar(h: &[u8], aguja: &[u8], desde: usize) -> Option<usize> {
    if desde > h.len() || aguja.is_empty() { return None; }
    let primero = aguja[0];
    let mut i = desde;
    while i + aguja.len() <= h.len() {
        match h[i..].iter().position(|&c| c == primero) {
            None => return None,
            Some(p) => {
                i += p;
                if i + aguja.len() <= h.len() && &h[i..i + aguja.len()] == aguja { return Some(i); }
                i += 1;
            }
        }
    }
    None
}
