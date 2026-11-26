//! La firma de los parches de código (codigo.rs): SHA-512 y la verificación de firmas Ed25519 (RFC 8032). Portado de
//! TweetNaCl (Bernstein, Lange, Schwabe y otros; dominio público): la aritmética en 16 trozos de 16 bits, sin tablas. Sólo
//! verifica —la clave privada que firma está fuera del repo—. Lento comparado con una biblioteca, pero se usa una vez por
//! parche (unos ms).

type Gf = [i64; 16];
const GF0: Gf = [0; 16];
const GF1: Gf = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
const D: Gf = [0x78a3, 0x1359, 0x4dca, 0x75eb, 0xd8ab, 0x4141, 0x0a4d, 0x0070, 0xe898, 0x7779, 0x4079, 0x8cc7, 0xfe73, 0x2b6f, 0x6cee, 0x5203];
const D2: Gf = [0xf159, 0x26b2, 0x9b94, 0xebd6, 0xb156, 0x8283, 0x149a, 0x00e0, 0xd130, 0xeef3, 0x80f2, 0x198e, 0xfce7, 0x56df, 0xd9dc, 0x2406];
const X: Gf = [0xd51a, 0x8f25, 0x2d60, 0xc956, 0xa7b2, 0x9525, 0xc760, 0x692c, 0xdc5c, 0xfdd6, 0xe231, 0xc0a4, 0x53fe, 0xcd6e, 0x36d3, 0x2169];
const Y: Gf = [0x6658, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666, 0x6666];
const I: Gf = [0xa0b0, 0x4a0e, 0x1b27, 0xc4ee, 0xe478, 0xad2f, 0x1806, 0x2f43, 0xd7a7, 0x3dfb, 0x0099, 0x2b4d, 0xdf0b, 0x4fc1, 0x2480, 0x2b83];
const L: [i64; 32] = [0xed, 0xd3, 0xf5, 0x5c, 0x1a, 0x63, 0x12, 0x58, 0xd6, 0x9c, 0xf7, 0xa2, 0xde, 0xf9, 0xde, 0x14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0x10];

fn car(o: &mut Gf) {
    for i in 0..16 {
        o[i] += 1 << 16;
        let c = o[i] >> 16;
        let j = if i < 15 { i + 1 } else { 0 };
        o[j] += c - 1 + if i == 15 { 37 * (c - 1) } else { 0 };
        o[i] -= c << 16;
    }
}
fn sel(p: &mut Gf, q: &mut Gf, b: i64) { let c = !(b - 1); for i in 0..16 { let t = c & (p[i] ^ q[i]); p[i] ^= t; q[i] ^= t; } }
fn pack25519(n: &Gf) -> [u8; 32] {
    let mut t = *n; let mut m = GF0;
    car(&mut t); car(&mut t); car(&mut t);
    for _ in 0..2 {
        m[0] = t[0] - 0xffed;
        for i in 1..15 { m[i] = t[i] - 0xffff - ((m[i - 1] >> 16) & 1); m[i - 1] &= 0xffff; }
        m[15] = t[15] - 0x7fff - ((m[14] >> 16) & 1);
        let b = (m[15] >> 16) & 1;
        m[14] &= 0xffff;
        sel(&mut t, &mut m, 1 - b);
    }
    let mut o = [0u8; 32];
    for i in 0..16 { o[2 * i] = (t[i] & 0xff) as u8; o[2 * i + 1] = (t[i] >> 8) as u8; }
    o
}
fn neq(a: &Gf, b: &Gf) -> bool { pack25519(a) != pack25519(b) }
fn par(a: &Gf) -> u8 { pack25519(a)[0] & 1 }
fn unpack25519(n: &[u8]) -> Gf { let mut o = GF0; for i in 0..16 { o[i] = n[2 * i] as i64 + ((n[2 * i + 1] as i64) << 8); } o[15] &= 0x7fff; o }
fn a(x: &Gf, y: &Gf) -> Gf { let mut o = GF0; for i in 0..16 { o[i] = x[i] + y[i]; } o }
fn z(x: &Gf, y: &Gf) -> Gf { let mut o = GF0; for i in 0..16 { o[i] = x[i] - y[i]; } o }
fn m(x: &Gf, y: &Gf) -> Gf {
    let mut t = [0i64; 31];
    for i in 0..16 { for j in 0..16 { t[i + j] += x[i] * y[j]; } }
    for i in 0..15 { t[i] += 38 * t[i + 16]; }
    let mut o = GF0; o.copy_from_slice(&t[..16]);
    car(&mut o); car(&mut o); o
}
fn s(x: &Gf) -> Gf { m(x, x) }
fn pow2523(i: &Gf) -> Gf { let mut c = *i; for k in (0..=250).rev() { c = s(&c); if k != 1 { c = m(&c, i); } } c }
fn inv(i: &Gf) -> Gf { let mut c = *i; for k in (0..=253).rev() { c = s(&c); if k != 2 && k != 4 { c = m(&c, i); } } c }

type P = [Gf; 4];
fn add(p: &mut P, q: &P) {
    let aa = m(&z(&p[1], &p[0]), &z(&q[1], &q[0]));
    let b = m(&a(&p[0], &p[1]), &a(&q[0], &q[1]));
    let c = m(&m(&p[3], &q[3]), &D2);
    let d0 = m(&p[2], &q[2]); let d = a(&d0, &d0);
    let (e, f, g, h) = (z(&b, &aa), z(&d, &c), a(&d, &c), a(&b, &aa));
    p[0] = m(&e, &f); p[1] = m(&h, &g); p[2] = m(&g, &f); p[3] = m(&e, &h);
}
fn cswap(p: &mut P, q: &mut P, b: u8) { for i in 0..4 { sel(&mut p[i], &mut q[i], b as i64); } }
fn pack(p: &P) -> [u8; 32] { let zi = inv(&p[2]); let (tx, ty) = (m(&p[0], &zi), m(&p[1], &zi)); let mut r = pack25519(&ty); r[31] ^= par(&tx) << 7; r }
fn scalarmult(q: &mut P, sc: &[u8]) -> P {
    let mut p: P = [GF0, GF1, GF1, GF0];
    for i in (0..256).rev() {
        let b = (sc[i / 8] >> (i & 7)) & 1;
        cswap(&mut p, q, b); let pc = p; add(q, &pc); let pc = p; add(&mut p, &pc); cswap(&mut p, q, b);
    }
    p
}
fn scalarbase(sc: &[u8]) -> P { let mut q: P = [X, Y, GF1, m(&X, &Y)]; scalarmult(&mut q, sc) }
fn mod_l(x: &mut [i64; 64]) -> [u8; 32] {
    for i in (32..64).rev() {
        let mut carry = 0i64; let mut j = i - 32;
        while j < i - 12 { x[j] += carry - 16 * x[i] * L[j - (i - 32)]; carry = (x[j] + 128) >> 8; x[j] -= carry << 8; j += 1; }
        x[j] += carry; x[i] = 0;
    }
    let mut carry = 0i64;
    for j in 0..32 { x[j] += carry - (x[31] >> 4) * L[j]; carry = x[j] >> 8; x[j] &= 255; }
    for j in 0..32 { x[j] -= carry * L[j]; }
    let mut r = [0u8; 32];
    for i in 0..32 { x[i + 1] += x[i] >> 8; r[i] = (x[i] & 255) as u8; }
    r
}
fn reduce(h: &[u8; 64]) -> [u8; 32] { let mut x = [0i64; 64]; for i in 0..64 { x[i] = h[i] as i64; } mod_l(&mut x) }
fn unpackneg(pk: &[u8; 32]) -> Option<P> {
    let mut r: P = [GF0, GF0, GF1, GF0];
    r[1] = unpack25519(pk);
    let num0 = s(&r[1]); let den0 = m(&num0, &D);
    let num = z(&num0, &r[2]); let den = a(&r[2], &den0);
    let den2 = s(&den); let den4 = s(&den2); let den6 = m(&den4, &den2);
    let mut t = m(&m(&den6, &num), &den);
    t = pow2523(&t); t = m(&m(&m(&t, &num), &den), &den);
    r[0] = m(&t, &den);
    let chk = m(&s(&r[0]), &den); if neq(&chk, &num) { r[0] = m(&r[0], &I); }
    let chk = m(&s(&r[0]), &den); if neq(&chk, &num) { return None; }
    if par(&r[0]) == (pk[31] >> 7) { r[0] = z(&GF0, &r[0]); }
    r[3] = m(&r[0], &r[1]);
    Some(r)
}

/// ¿`firma` (64 bytes) es la de `msj` con la clave pública `pk`?
pub fn verificar(pk: &[u8; 32], msj: &[u8], firma: &[u8; 64]) -> bool {
    // (S tiene que ser menor que el orden del grupo: si no, la misma firma tendría variantes)
    if firma[63] & 0xe0 != 0 { return false; }
    let Some(mut q) = unpackneg(pk) else { return false };
    let mut d = Vec::with_capacity(64 + msj.len()); d.extend_from_slice(&firma[..32]); d.extend_from_slice(pk); d.extend_from_slice(msj);
    let h = reduce(&sha512(&d));
    let mut p = scalarmult(&mut q, &h);
    let sb = scalarbase(&firma[32..]);
    add(&mut p, &sb);
    pack(&p) == firma[..32]
}

// ---------------- SHA-512 (FIPS 180-4) ----------------
const K: [u64; 80] = [
    0x428a2f98d728ae22, 0x7137449123ef65cd, 0xb5c0fbcfec4d3b2f, 0xe9b5dba58189dbbc, 0x3956c25bf348b538, 0x59f111f1b605d019, 0x923f82a4af194f9b, 0xab1c5ed5da6d8118,
    0xd807aa98a3030242, 0x12835b0145706fbe, 0x243185be4ee4b28c, 0x550c7dc3d5ffb4e2, 0x72be5d74f27b896f, 0x80deb1fe3b1696b1, 0x9bdc06a725c71235, 0xc19bf174cf692694,
    0xe49b69c19ef14ad2, 0xefbe4786384f25e3, 0x0fc19dc68b8cd5b5, 0x240ca1cc77ac9c65, 0x2de92c6f592b0275, 0x4a7484aa6ea6e483, 0x5cb0a9dcbd41fbd4, 0x76f988da831153b5,
    0x983e5152ee66dfab, 0xa831c66d2db43210, 0xb00327c898fb213f, 0xbf597fc7beef0ee4, 0xc6e00bf33da88fc2, 0xd5a79147930aa725, 0x06ca6351e003826f, 0x142929670a0e6e70,
    0x27b70a8546d22ffc, 0x2e1b21385c26c926, 0x4d2c6dfc5ac42aed, 0x53380d139d95b3df, 0x650a73548baf63de, 0x766a0abb3c77b2a8, 0x81c2c92e47edaee6, 0x92722c851482353b,
    0xa2bfe8a14cf10364, 0xa81a664bbc423001, 0xc24b8b70d0f89791, 0xc76c51a30654be30, 0xd192e819d6ef5218, 0xd69906245565a910, 0xf40e35855771202a, 0x106aa07032bbd1b8,
    0x19a4c116b8d2d0c8, 0x1e376c085141ab53, 0x2748774cdf8eeb99, 0x34b0bcb5e19b48a8, 0x391c0cb3c5c95a63, 0x4ed8aa4ae3418acb, 0x5b9cca4f7763e373, 0x682e6ff3d6b2b8a3,
    0x748f82ee5defb2fc, 0x78a5636f43172f60, 0x84c87814a1f0ab72, 0x8cc702081a6439ec, 0x90befffa23631e28, 0xa4506cebde82bde9, 0xbef9a3f7b2c67915, 0xc67178f2e372532b,
    0xca273eceea26619c, 0xd186b8c721c0c207, 0xeada7dd6cde0eb1e, 0xf57d4f7fee6ed178, 0x06f067aa72176fba, 0x0a637dc5a2c898a6, 0x113f9804bef90dae, 0x1b710b35131c471b,
    0x28db77f523047d84, 0x32caab7b40c72493, 0x3c9ebe0a15c9bebc, 0x431d67c49c100d4c, 0x4cc5d4becb3e42b6, 0x597f299cfc657e2a, 0x5fcb6fab3ad6faec, 0x6c44198c4a475817,
];
/// el SHA-512 de `d`
pub fn sha512(d: &[u8]) -> [u8; 64] {
    let mut h: [u64; 8] = [0x6a09e667f3bcc908, 0xbb67ae8584caa73b, 0x3c6ef372fe94f82b, 0xa54ff53a5f1d36f1, 0x510e527fade682d1, 0x9b05688c2b3e6c1f, 0x1f83d9abfb41bd6b, 0x5be0cd19137e2179];
    let mut m = d.to_vec(); let bits = (d.len() as u128) * 8;
    m.push(0x80); while m.len() % 128 != 112 { m.push(0); } m.extend_from_slice(&bits.to_be_bytes());
    let mut w = [0u64; 80];
    for blq in m.chunks_exact(128) {
        for t in 0..16 { w[t] = u64::from_be_bytes(blq[t * 8..t * 8 + 8].try_into().unwrap()); }
        for t in 16..80 {
            let s0 = w[t - 15].rotate_right(1) ^ w[t - 15].rotate_right(8) ^ (w[t - 15] >> 7);
            let s1 = w[t - 2].rotate_right(19) ^ w[t - 2].rotate_right(61) ^ (w[t - 2] >> 6);
            w[t] = w[t - 16].wrapping_add(s0).wrapping_add(w[t - 7]).wrapping_add(s1);
        }
        let [mut a, mut b, mut c, mut d, mut e, mut f, mut g, mut hh] = h;
        for t in 0..80 {
            let s1 = e.rotate_right(14) ^ e.rotate_right(18) ^ e.rotate_right(41);
            let ch = (e & f) ^ (!e & g);
            let t1 = hh.wrapping_add(s1).wrapping_add(ch).wrapping_add(K[t]).wrapping_add(w[t]);
            let s0 = a.rotate_right(28) ^ a.rotate_right(34) ^ a.rotate_right(39);
            let maj = (a & b) ^ (a & c) ^ (b & c);
            let t2 = s0.wrapping_add(maj);
            hh = g; g = f; f = e; e = d.wrapping_add(t1); d = c; c = b; b = a; a = t1.wrapping_add(t2);
        }
        for (x, y) in h.iter_mut().zip([a, b, c, d, e, f, g, hh]) { *x = x.wrapping_add(y); }
    }
    let mut o = [0u8; 64]; for (i, x) in h.iter().enumerate() { o[i * 8..i * 8 + 8].copy_from_slice(&x.to_be_bytes()); } o
}

/// de hexadecimal a bytes
pub fn de_hex(s: &str) -> Option<Vec<u8>> { if s.len() % 2 != 0 { return None; } (0..s.len() / 2).map(|i| u8::from_str_radix(s.get(i * 2..i * 2 + 2)?, 16).ok()).collect() }
pub fn a_hex(b: &[u8]) -> String { b.iter().map(|x| format!("{x:02x}")).collect() }

#[cfg(test)]
mod pruebas {
    use super::*;
    #[test]
    fn sha512_abc() {
        assert_eq!(a_hex(&sha512(b"abc")), "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f");
        assert_eq!(a_hex(&sha512(b"")), "cf83e1357eefb8bdf1542850d66d8007d620e4050b5715dc83f4a921d36ce9ce47d0d13c5d85f2b0ff8318d2877eec2f63b931bd47417a81a538327af927da3e");
        // (más de un bloque)
        let largo = vec![b'a'; 1000]; assert_eq!(&a_hex(&sha512(&largo))[..16], "67ba5535a46e3f86");
    }
    #[test]
    fn rfc8032() {
        let v = [
            ("d75a980182b10ab7d54bfed3c964073a0ee172f3daa62325af021a68f707511a", "", "e5564300c360ac729086e2cc806e828a84877f1eb8e5d974d873e065224901555fb8821590a33bacc61e39701cf9b46bd25bf5f0595bbe24655141438e7a100b"),
            ("3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c", "72", "92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00"),
        ];
        for (pk, m, f) in v {
            let pk: [u8; 32] = de_hex(pk).unwrap().try_into().unwrap(); let m = de_hex(m).unwrap(); let mut f: [u8; 64] = de_hex(f).unwrap().try_into().unwrap();
            assert!(verificar(&pk, &m, &f), "la firma buena no pasó");
            f[10] ^= 1; assert!(!verificar(&pk, &m, &f), "pasó una firma cambiada");
            f[10] ^= 1; let mut m2 = m.clone(); m2.push(0); assert!(!verificar(&pk, &m2, &f), "pasó con otro mensaje");
        }
    }
}
