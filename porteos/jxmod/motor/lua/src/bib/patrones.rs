//! Los patrones de Lua (como lstrlib.c, y como `luaPatrones` de la web), sobre bytes.
use crate::valor::Valor;
use crate::{Error, Estado};

pub(crate) struct Coincidencia {
    pub ini: usize,
    pub fin: usize,
    pub caps: Vec<Valor>,
}

struct M<'a> {
    e: &'a Estado,
    s: &'a [u8],
    p: &'a [u8],
    /// (inicio, largo): largo -1 = abierta, -2 = de posición
    caps: Vec<(usize, isize)>,
    pasos: u32,
}

fn clase(c: u8, cl: u8) -> bool {
    let lo = cl.to_ascii_lowercase();
    let r = match lo {
        b'a' => c.is_ascii_alphabetic(),
        b'd' => c.is_ascii_digit(),
        b'l' => c.is_ascii_lowercase(),
        b's' => c == b' ' || (9..=13).contains(&c),
        b'u' => c.is_ascii_uppercase(),
        b'w' => c.is_ascii_alphanumeric(),
        b'x' => c.is_ascii_hexdigit(),
        b'p' => c.is_ascii_punctuation(),
        b'c' => c < 32 || c == 127,
        b'g' => c > 32 && c < 127,
        _ => return cl == c,
    };
    if cl == lo { r } else { !r }
}

/// ¿c está en el conjunto [...] que empieza en p[i] y termina en p[fin] (el ']')?
fn en_set(c: u8, p: &[u8], mut i: usize, fin: usize) -> bool {
    let at = |k: usize| p.get(k).copied().unwrap_or(0);
    let mut neg = false;
    i += 1;
    if at(i) == b'^' { neg = true; i += 1; }
    while i < fin {
        if at(i) == b'%' {
            i += 1;
            if clase(c, at(i)) { return !neg; }
            i += 1;
        } else if at(i + 1) == b'-' && i + 2 < fin {
            if at(i) <= c && c <= at(i + 2) { return !neg; }
            i += 3;
        } else {
            if at(i) == c { return !neg; }
            i += 1;
        }
    }
    neg
}

impl<'a> M<'a> {
    fn fin_clase(&self, mut i: usize) -> Result<usize, Error> {
        let p = self.p;
        let c = match p.get(i) { Some(&c) => c, None => return Err(self.e.error("malformed pattern")) };
        i += 1;
        if c == b'%' {
            if i >= p.len() { return Err(self.e.error("malformed pattern (ends with '%')")); }
            return Ok(i + 1);
        }
        if c == b'[' {
            if p.get(i) == Some(&b'^') { i += 1; }
            loop {
                if i >= p.len() { return Err(self.e.error("malformed pattern (missing ']')")); }
                let cc = p[i];
                i += 1;
                if cc == b'%' { i += 1; }
                if p.get(i) == Some(&b']') { break; }
            }
            return Ok(i + 1);
        }
        Ok(i)
    }
    #[inline]
    fn uno(&self, si: usize, pi: usize, ep: usize) -> bool {
        if si >= self.s.len() { return false; }
        let c = self.s[si];
        match self.p[pi] {
            b'.' => true,
            b'%' => clase(c, self.p.get(pi + 1).copied().unwrap_or(0)),
            b'[' => en_set(c, self.p, pi, ep - 1),
            x => x == c,
        }
    }
    fn coincidir(&mut self, mut si: usize, mut pi: usize) -> Result<Option<usize>, Error> {
        self.pasos += 1;
        if self.pasos > 2_000_000 { return Err(self.e.error("patrón demasiado complejo")); }
        let (s, p) = (self.s, self.p);
        loop {
            if pi >= p.len() { return Ok(Some(si)); }
            match p[pi] {
                b'(' => {
                    let pos = p.get(pi + 1) == Some(&b')');
                    self.caps.push((si, if pos { -2 } else { -1 }));
                    let r = self.coincidir(si, pi + if pos { 2 } else { 1 })?;
                    if r.is_none() { self.caps.pop(); }
                    return Ok(r);
                }
                b')' => {
                    let k = match self.caps.iter().rposition(|c| c.1 == -1) { Some(k) => k, None => return Err(self.e.error("invalid pattern capture")) };
                    self.caps[k].1 = (si - self.caps[k].0) as isize;
                    let r = self.coincidir(si, pi + 1)?;
                    if r.is_none() { self.caps[k].1 = -1; }
                    return Ok(r);
                }
                b'$' if pi + 1 == p.len() => return Ok(if si == s.len() { Some(si) } else { None }),
                b'%' => {
                    let n = p.get(pi + 1).copied().unwrap_or(0);
                    if n == b'b' {
                        if pi + 3 > p.len() { return Err(self.e.error("missing arguments to %b")); }
                        let a = p[pi + 2];
                        let b = p.get(pi + 3).copied();
                        if s.get(si) != Some(&a) { return Ok(None); }
                        let mut cont = 1;
                        let mut k = si + 1;
                        while k < s.len() {
                            let ch = s[k];
                            if Some(ch) == b { cont -= 1; if cont == 0 { break; } } else if ch == a { cont += 1; }
                            k += 1;
                        }
                        if k >= s.len() { return Ok(None); }
                        si = k + 1;
                        pi += 4;
                        continue;
                    }
                    if n == b'f' {
                        pi += 2;
                        if p.get(pi) != Some(&b'[') { return Err(self.e.error("missing '[' after '%f' in pattern")); }
                        let ep = self.fin_clase(pi)?;
                        let prev = if si == 0 { 0 } else { s[si - 1] };
                        let cur = if si < s.len() { s[si] } else { 0 };
                        if !en_set(prev, p, pi, ep - 1) && en_set(cur, p, pi, ep - 1) { pi = ep; continue; }
                        return Ok(None);
                    }
                    if n.is_ascii_digit() {
                        let d = (n - b'0') as usize;
                        let c = if d >= 1 { self.caps.get(d - 1).copied() } else { None };
                        let (ci, cl) = match c { Some(c) if c.1 >= 0 => c, _ => return Err(self.e.error("invalid capture index")) };
                        let t = &s[ci..ci + cl as usize];
                        if s[si..].starts_with(t) { si += t.len(); pi += 2; continue; }
                        return Ok(None);
                    }
                }
                _ => {}
            }
            let ep = self.fin_clase(pi)?;
            match p.get(ep) {
                Some(b'?') => {
                    if self.uno(si, pi, ep) {
                        if let Some(r) = self.coincidir(si + 1, ep + 1)? { return Ok(Some(r)); }
                    }
                    pi = ep + 1;
                }
                Some(b'+') => {
                    if !self.uno(si, pi, ep) { return Ok(None); }
                    return self.max_exp(si + 1, pi, ep);
                }
                Some(b'*') => return self.max_exp(si, pi, ep),
                Some(b'-') => loop {
                    if let Some(r) = self.coincidir(si, ep + 1)? { return Ok(Some(r)); }
                    if self.uno(si, pi, ep) { si += 1; } else { return Ok(None); }
                },
                _ => {
                    if !self.uno(si, pi, ep) { return Ok(None); }
                    si += 1;
                    pi = ep;
                }
            }
        }
    }
    fn max_exp(&mut self, si: usize, pi: usize, ep: usize) -> Result<Option<usize>, Error> {
        let mut i = 0;
        while self.uno(si + i, pi, ep) { i += 1; }
        loop {
            if let Some(r) = self.coincidir(si + i, ep + 1)? { return Ok(Some(r)); }
            if i == 0 { return Ok(None); }
            i -= 1;
        }
    }
    fn capturas(&self) -> Vec<Valor> {
        self.caps.iter().map(|&(i, l)| {
            if l == -2 { Valor::Num((i + 1) as f64) } else if l < 0 { Valor::from("") } else { Valor::from(&self.s[i..i + l as usize]) }
        }).collect()
    }
}

/// probar en la posición si (con ^ al principio del patrón o sin él: la web lo saltea siempre)
pub(crate) fn una_vez(e: &Estado, s: &[u8], p: &[u8], si: usize) -> Result<Option<Coincidencia>, Error> {
    let anc = p.first() == Some(&b'^');
    let mut m = M { e, s, p, caps: vec![], pasos: 0 };
    Ok(m.coincidir(si, if anc { 1 } else { 0 })?.map(|fin| Coincidencia { ini: si, fin, caps: m.capturas() }))
}

/// buscar desde si hacia adelante
pub(crate) fn buscar(e: &Estado, s: &[u8], p: &[u8], si: usize) -> Result<Option<Coincidencia>, Error> {
    let anc = p.first() == Some(&b'^');
    let mut i = si;
    while i <= s.len() {
        let mut m = M { e, s, p, caps: vec![], pasos: 0 };
        if let Some(fin) = m.coincidir(i, if anc { 1 } else { 0 })? { return Ok(Some(Coincidencia { ini: i, fin, caps: m.capturas() })); }
        if anc { break; }
        i += 1;
    }
    Ok(None)
}
