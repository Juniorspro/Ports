# Íconos de RezoBox dibujados a mano (SVG plano): azulejo de un color, dibujo blanco y a lo sumo un acento.
# Uso: python3 -I herramientas/iconos.py juego/iconos   (armar.py los mete en la página)
import os, sys
OUT = sys.argv[1]
W = '#ffffff'
def osc(h, k=0.72):
    h = h.lstrip('#'); r, g, b = (int(h[i:i+2], 16) for i in (0, 2, 4))
    return '#%02x%02x%02x' % (int(r*k), int(g*k), int(b*k))
C = dict(azul='#2f7de1', cielo='#1fa2d8', violeta='#7c5ce0', rosa='#e2468f', rojo='#e04343', naranja='#f07a1a', ambar='#f2a514', amarillo='#e8b80c',
         verde='#2fae55', menta='#13a594', pizarra='#4a5568', noche='#2b3354', marron='#9a6431', negro='#262a33', indigo='#4b4fc9', cian='#0ea5c6')
I = {}
def ic(nombre, color, cuerpo): I[nombre] = (C[color], cuerpo)
ic('volar', 'cielo', '''<path fill="{W}" d="M12 40c10-1 19-5 25-12 4-5 9-11 15-13-1 6-4 11-8 15 4-1 7-1 9 0-4 5-9 8-15 9 3 1 5 2 6 4-6 3-13 3-19 1-5 3-9 4-13 3z"/>
<circle cx="45.5" cy="19" r="1.6" fill="{D}"/>''')
ic('scp', 'noche', '''<g fill="none" stroke="{W}" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round">
<path d="M23 31l19-6"/><path d="M24 31l-5 7-6 6"/><path d="M26 31l1 8-4 8"/><path d="M41 25l9 6-2 13"/><path d="M42 26l1 9-6 9"/></g>
<ellipse cx="17" cy="31" rx="6.2" ry="5.4" fill="{W}"/><circle cx="14.6" cy="31" r="1.4" fill="#ff4d4d"/><circle cx="18.8" cy="31.4" r="1.4" fill="#ff4d4d"/>''')
ic('energia', 'naranja', '''<path fill="{W}" opacity=".35" d="M32 9l4 9 9-5-3 10 10 1-8 7 8 7-10 1 3 10-9-5-4 9-4-9-9 5 3-10-10-1 8-7-8-7 10-1-3-10 9 5z"/>
<circle cx="32" cy="32" r="11" fill="{W}"/><circle cx="32" cy="32" r="5.5" fill="#ffd34d"/>''')
ic('luna', 'noche', '''<path fill="{W}" d="M37 12a20 20 0 1 0 15 30 16 16 0 1 1-15-30z"/>
<path fill="{W}" d="M47 15l1.2 3 3 1.2-3 1.2-1.2 3-1.2-3-3-1.2 3-1.2zM51 28l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>''')
ic('salto', 'verde', '''<path fill="none" stroke="{W}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" d="M20 50h24M22 45l20-4-20-4 20-4"/>
<path fill="{W}" d="M32 8l11 12h-7v8h-8v-8h-7z"/>''')
ic('veloz', 'ambar', '''<path fill="{W}" d="M36 8L18 35h11l-4 21 21-29H35z"/>
<path fill="none" stroke="{W}" stroke-width="3" stroke-linecap="round" opacity=".7" d="M9 26h7M7 33h8M10 40h6"/>''')
ic('balas', 'pizarra', '''<path fill="none" stroke="{W}" stroke-width="5.5" stroke-linecap="round" d="M32 32c-4-6-7-9-11-9-5 0-8 4-8 9s3 9 8 9c4 0 7-3 11-9s7-9 11-9c5 0 8 4 8 9s-3 9-8 9c-4 0-7-3-11-9z"/>''')
ic('dios', 'azul', '''<path fill="{W}" d="M32 9l18 6v13c0 13-8 22-18 27-10-5-18-14-18-27V15z"/>
<path fill="{D}" d="M32 19l3.6 7.4 8.1 1.2-5.9 5.7 1.4 8.1-7.2-3.8-7.2 3.8 1.4-8.1-5.9-5.7 8.1-1.2z"/>''')
ic('lenta', 'menta', '''<path fill="none" stroke="{W}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" d="M19 10h26M19 54h26M22 10c0 12 10 15 10 22s-10 10-10 22M42 10c0 12-10 15-10 22s10 10 10 22"/>
<path fill="{W}" d="M25 17h14c-2 5-7 7-7 10-0-3-5-5-7-10zM24 51c1-6 8-9 8-12 0 3 7 6 8 12z"/>''')
ic('boom', 'rojo', '''<path fill="{W}" d="M33 7l4 12 10-8-2 13 12-1-9 9 10 7-13 1 4 12-11-7-6 11-3-12-11 6 4-12-12-2 10-8-9-8 13 0-3-12 10 8z"/>
<circle cx="32" cy="32" r="7" fill="#ffd34d"/>''')
ic('ragdoll', 'ambar', '''<circle cx="41" cy="15" r="6.5" fill="{W}"/>
<g fill="none" stroke="{W}" stroke-width="4.6" stroke-linecap="round" stroke-linejoin="round"><path d="M37 22L28 37"/><path d="M35 25l-10-6-6 4"/><path d="M34 27l10 4 3 8"/><path d="M28 37l-10 2-5 8"/><path d="M28 37l5 9-3 8"/></g>
<path fill="none" stroke="{W}" stroke-width="2.2" stroke-linecap="round" opacity=".7" d="M50 9l3-3M52 15h4M47 5l1-4"/>''')
ic('piano', 'violeta', '''<rect x="10" y="17" width="44" height="30" rx="3" fill="{W}"/>
<g fill="{D}"><rect x="17.5" y="17" width="4.5" height="17" rx="1"/><rect x="26.5" y="17" width="4.5" height="17" rx="1"/><rect x="39" y="17" width="4.5" height="17" rx="1"/></g>
<g stroke="{D}" stroke-width="1.4"><path d="M20 34v13M28.8 34v13M36.8 34v13M45 34v13"/></g>''')
ic('ciclope', 'noche', '''<path fill="{W}" d="M23 50v-5c-5-3-8-9-8-16 0-10 7-17 16-17s16 7 16 17c0 7-3 13-8 16v5z"/>
<path fill="#ff5a4f" opacity=".9" d="M44 24.5l18-7v19l-18-6.5z"/>
<rect x="13" y="23" width="35" height="8.5" rx="4.2" fill="#d8232a"/><rect x="16" y="25" width="16" height="2.4" rx="1.2" fill="#ff9a8f"/>''')
ic('radio', 'rojo', '''<path fill="none" stroke="{W}" stroke-width="3" stroke-linecap="round" d="M44 19l6-10M22 19v-4h20v4"/>
<rect x="9" y="19" width="46" height="28" rx="5" fill="{W}"/>
<circle cx="21" cy="34" r="7.5" fill="{D}"/><circle cx="43" cy="34" r="7.5" fill="{D}"/><circle cx="21" cy="34" r="2.6" fill="{W}"/><circle cx="43" cy="34" r="2.6" fill="{W}"/>
<rect x="28" y="23" width="8" height="5" rx="1.5" fill="#ffd34d"/>''')
ic('rampa', 'naranja', '''<path fill="{W}" d="M8 52V18h4c2 16 12 28 30 30h14v4z"/>
<rect x="9" y="11" width="12" height="6" rx="2" fill="{W}"/><circle cx="12" cy="18" r="2" fill="{D}"/><circle cx="18" cy="18" r="2" fill="{D}"/>''')
ic('boton_autos', 'pizarra', '''<path fill="{W}" d="M18 18l3-6h18l4 6h3a2 2 0 0 1 2 2v5H12v-5a2 2 0 0 1 2-2z"/><circle cx="20" cy="25" r="3.2" fill="{D}"/><circle cx="40" cy="25" r="3.2" fill="{D}"/>
<ellipse cx="32" cy="47" rx="17" ry="6" fill="{W}"/><path fill="#e04343" d="M20 46v-5a12 4.5 0 0 1 24 0v5a12 4.5 0 0 1-24 0z"/>''')
ic('teleport', 'violeta', '''<ellipse cx="32" cy="46" rx="18" ry="6" fill="none" stroke="{W}" stroke-width="4"/>
<ellipse cx="32" cy="46" rx="9" ry="2.8" fill="{W}"/>
<path fill="none" stroke="{W}" stroke-width="3.5" stroke-linecap="round" d="M22 38V22M32 36V12M42 38V22" opacity=".85"/>''')
ic('zona_muerte', 'negro', '''<path fill="{W}" d="M32 10c-11 0-18 7-18 17 0 6 3 10 7 12v7h22v-7c4-2 7-6 7-12 0-10-7-17-18-17z"/>
<circle cx="25" cy="28" r="5" fill="#e04343"/><circle cx="39" cy="28" r="5" fill="#e04343"/><path fill="{D}" d="M32 33l3 5h-6z"/>
<path fill="{D}" d="M26 41h3v5h-3zM30.5 41h3v5h-3zM35 41h3v5h-3z"/>''')
ic('cartel', 'marron', '''<rect x="29" y="30" width="6" height="25" rx="1.5" fill="{W}"/>
<path fill="{W}" d="M11 13h36l7 8-7 8H11z"/><path fill="none" stroke="{D}" stroke-width="2.5" stroke-linecap="round" d="M17 19h20M17 24h14"/>''')
ic('luz', 'amarillo', '''<path fill="{W}" d="M32 13a14 14 0 0 0-8 25.5c1.5 1.2 2 2.6 2 4.5h12c0-1.9.5-3.3 2-4.5A14 14 0 0 0 32 13z"/>
<rect x="26" y="45" width="12" height="4" rx="1.5" fill="{W}"/><rect x="28" y="51" width="8" height="3.5" rx="1.5" fill="{W}"/>
<path fill="none" stroke="{W}" stroke-width="3" stroke-linecap="round" d="M32 5v3M14 13l2 2M50 13l-2 2M8 27h3M53 27h3"/>''')
ic('impulso', 'verde', '''<ellipse cx="32" cy="48" rx="20" ry="6" fill="{W}"/><ellipse cx="32" cy="47" rx="12" ry="3" fill="{D}"/>
<path fill="none" stroke="{W}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round" d="M21 30l11-10 11 10M21 40l11-10 11 10"/>''')
ic('meta', 'pizarra', '''<rect x="13" y="9" width="4" height="47" rx="2" fill="{W}"/>
<path fill="{W}" d="M17 11h33v22H17z"/>
<path fill="{D}" d="M17 11h5.5v5.5H17zM28 11h5.5v5.5H28zM39 11h5.5v5.5H39zM22.5 16.5H28V22h-5.5zM33.5 16.5H39V22h-5.5zM44.5 16.5H50V22h-5.5zM17 22h5.5v5.5H17zM28 22h5.5v5.5H28zM39 22h5.5v5.5H39zM22.5 27.5H28V33h-5.5zM33.5 27.5H39V33h-5.5zM44.5 27.5H50V33h-5.5z"/>''')
ic('musica', 'rosa', '''<path fill="{W}" d="M24 14l26-5v29a6.5 6.5 0 1 1-4-6V18l-18 3.5V43a6.5 6.5 0 1 1-4-6z"/>''')
ic('mod', 'azul', '''<path fill="{W}" d="M12 22h10a5 5 0 1 1 9 0h11v10a5 5 0 1 1 0 9v11H31a5 5 0 1 0-9 0H12V41a5 5 0 1 0 0-9z"/>''')
ic('fuego', 'rojo', '''<path fill="{W}" d="M33 8c2 9-9 13-11 23-2 9 4 18 10 19 8 1 15-6 15-15 0-7-4-10-5-15-3 4-5 6-8 6 3-5 2-12-1-18z"/>
<path fill="#ffd34d" d="M32 30c3 5 9 7 8 13-1 4-4 6-8 6s-7-3-6-8c1-4 5-6 6-11z"/>''')
ic('cohete', 'indigo', '''<path fill="#ffb02e" d="M26 43l6 13 6-13z"/>
<path fill="{W}" d="M32 7c7 6 10 15 10 26v11H22V33c0-11 3-20 10-26z"/>
<path fill="{W}" d="M22 33l-7 9v6l7-4zM42 33l7 9v6l-7-4z"/><circle cx="32" cy="24" r="4.5" fill="{D}"/>''')
ic('robot', 'menta', '''<path fill="none" stroke="{W}" stroke-width="3" stroke-linecap="round" d="M32 14V8"/><circle cx="32" cy="7" r="3" fill="{W}"/>
<rect x="13" y="15" width="38" height="32" rx="9" fill="{W}"/><rect x="8" y="26" width="5" height="11" rx="2" fill="{W}"/><rect x="51" y="26" width="5" height="11" rx="2" fill="{W}"/>
<circle cx="24" cy="29" r="4.5" fill="{D}"/><circle cx="40" cy="29" r="4.5" fill="{D}"/><rect x="24" y="38" width="16" height="3.5" rx="1.75" fill="{D}"/>''')
ic('dino', 'verde', '''<path fill="{W}" d="M10 31C10 19 21 12 35 12c11 0 19 4 19 11v3c0 2-1 4-3 4H34l13 4c2 1 2 3 1 5-3 4-9 7-17 7-8 0-13-3-16-7v10H10z"/>
<path fill="{W}" d="M37 30h3.4l-1.7 3.4zM42.5 30h3.4l-1.7 3.4zM48 30h3l-1.5 3z"/><circle cx="37" cy="20" r="2.8" fill="{D}"/><circle cx="50" cy="19" r="1.2" fill="{D}"/>
<path fill="none" stroke="{D}" stroke-width="2" stroke-linecap="round" d="M22 23c2-2 4-2 6 0" opacity=".6"/>''')
ic('auto', 'rojo', '''<path fill="{W}" d="M15 27l5-9c1-2 3-3 5-3h14c2 0 4 1 5 3l5 9h3a3 3 0 0 1 3 3v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9a3 3 0 0 1 3-3z"/>
<path fill="{D}" d="M21 26l3.5-6.5h6.5V26zM34 26v-6.5h6.5L44 26z"/><circle cx="19" cy="42" r="6" fill="{D}"/><circle cx="45" cy="42" r="6" fill="{D}"/><circle cx="19" cy="42" r="2.4" fill="{W}"/><circle cx="45" cy="42" r="2.4" fill="{W}"/>''')
ic('arma', 'pizarra', '''<path fill="{W}" d="M9 20h40l4 3v5H31l-3 4h-6l-4 18h-9l4-19-4-2z"/><rect x="49" y="17" width="5" height="3" rx="1" fill="{W}"/>
<circle cx="40" cy="24" r="2" fill="{D}"/><path fill="none" stroke="{W}" stroke-width="3" d="M27 32c1 4 4 5 7 4"/>''')
ic('bomba', 'negro', '''<circle cx="29" cy="37" r="17" fill="{W}"/><rect x="35" y="16" width="9" height="7" rx="2" transform="rotate(40 39.5 19.5)" fill="{W}"/>
<path fill="none" stroke="{W}" stroke-width="2.6" stroke-linecap="round" d="M43 15c2-4 5-5 8-3"/>
<path fill="#ffb02e" d="M52 6l1.4 3.4 3.6.6-2.8 2.3.8 3.6-3-2-3 2 .8-3.6-2.8-2.3 3.6-.6z"/><circle cx="23" cy="31" r="3.5" fill="{D}" opacity=".35"/>''')
ic('iman', 'rojo', '''<path fill="{W}" d="M14 12h12v20a6 6 0 0 0 12 0V12h12v20a18 18 0 0 1-36 0z"/>
<path fill="{D}" d="M14 12h12v8H14zM38 12h12v8H38z"/>''')
ic('tornado', 'cielo', '''<g fill="{W}"><rect x="10" y="11" width="44" height="6" rx="3"/><rect x="15" y="21" width="36" height="6" rx="3"/><rect x="19" y="31" width="26" height="6" rx="3"/><rect x="25" y="41" width="18" height="5.5" rx="2.75"/><rect x="28" y="50" width="10" height="5" rx="2.5"/></g>''')
ic('hielo', 'cian', '''<g fill="none" stroke="{W}" stroke-width="4" stroke-linecap="round"><path d="M32 9v46M12 20.5l40 23M12 43.5l40-23"/>
<path d="M26 12l6 5 6-5M26 52l6-5 6 5M12.5 28l7.5-3-1.5-8M51.5 36l-7.5 3 1.5 8M12.5 36l7.5 3-1.5 8M51.5 28l-7.5-3 1.5-8"/></g>''')
ic('corona', 'ambar', '''<path fill="{W}" d="M10 22l11 9 11-15 11 15 11-9-5 24H15z"/><rect x="15" y="48" width="34" height="5" rx="2" fill="{W}"/>
<circle cx="10" cy="20" r="3.5" fill="{W}"/><circle cx="32" cy="14" r="3.5" fill="{W}"/><circle cx="54" cy="20" r="3.5" fill="{W}"/><circle cx="32" cy="38" r="3.5" fill="#e04343"/>''')
ic('alien', 'verde', '''<path fill="{W}" d="M32 9c12 0 20 8 20 18 0 13-11 26-20 28-9-2-20-15-20-28C12 17 20 9 32 9z"/>
<ellipse cx="23.5" cy="29" rx="6.5" ry="4" transform="rotate(30 23.5 29)" fill="{D}"/><ellipse cx="40.5" cy="29" rx="6.5" ry="4" transform="rotate(-30 40.5 29)" fill="{D}"/><path fill="none" stroke="{D}" stroke-width="2.5" stroke-linecap="round" d="M28 43c3 1.5 5 1.5 8 0"/>''')
ic('fiesta', 'rosa', '''<path fill="{W}" d="M10 54l11-32 21 21z"/><path fill="none" stroke="{D}" stroke-width="3" d="M14 43l8 8M17 34l14 14"/>
<g><rect x="36" y="12" width="5" height="5" rx="1" transform="rotate(20 38.5 14.5)" fill="#ffd34d"/><rect x="47" y="22" width="5" height="5" rx="1" transform="rotate(-25 49.5 24.5)" fill="{W}"/><circle cx="30" cy="11" r="2.8" fill="{W}"/><circle cx="52" cy="38" r="2.8" fill="#ffd34d"/><path fill="none" stroke="{W}" stroke-width="2.8" stroke-linecap="round" d="M27 20c3-3 7-3 9 0M43 36c3-2 6-1 8 2"/></g>''')
ic('shuriken', 'pizarra', '''<path fill="{W}" d="M32 6l6 20 20 6-20 6-6 20-6-20-20-6 20-6z"/><circle cx="32" cy="32" r="4.5" fill="{D}"/>''')
ic('planeta', 'indigo', '''<circle cx="32" cy="32" r="14" fill="{W}"/>
<ellipse cx="32" cy="32" rx="25" ry="8" transform="rotate(-20 32 32)" fill="none" stroke="{W}" stroke-width="3.5"/>
<path fill="{W}" d="M18.5 28a14 14 0 0 1 27 0" /><path fill="none" stroke="{D}" stroke-width="2" d="M21 37c5 2 15 2 22-2" opacity=".6"/>''')
os.makedirs(OUT, exist_ok=True)
for n, (c, cuerpo) in I.items():
    svg = ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect x="1" y="1" width="62" height="62" rx="14" fill="%s"/>' % c
           + cuerpo.replace('{W}', W).replace('{D}', osc(c)).replace('\n', '') + '</svg>')
    open(os.path.join(OUT, n + '.svg'), 'w').write(svg)
print(len(I), 'íconos')
