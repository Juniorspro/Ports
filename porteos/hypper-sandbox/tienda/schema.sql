-- tienda de HypperX RezoBox (D1)
CREATE TABLE IF NOT EXISTS items (
  id TEXT PRIMARY KEY, tipo TEXT NOT NULL, nombre TEXT, autor TEXT, descripcion TEXT, etiquetas TEXT, icono TEXT, base TEXT,
  datos TEXT NOT NULL, fecha INTEGER, descargas INTEGER DEFAULT 0, likes INTEGER DEFAULT 0, denuncias INTEGER DEFAULT 0,
  oculto INTEGER DEFAULT 0, clave TEXT, ip TEXT, codigo INTEGER DEFAULT 0);
CREATE INDEX IF NOT EXISTS i_tipo ON items(tipo, oculto, fecha);
CREATE INDEX IF NOT EXISTS i_ip ON items(ip, fecha);
CREATE TABLE IF NOT EXISTS votos (id TEXT, ip TEXT, k TEXT, PRIMARY KEY (id, ip, k));
-- servers que crean los jugadores: siguen en la lista aunque estén vacíos; se borran solos a los 10 minutos sin nadie
-- (vivo = la última vez que tuvo jugadores) y el dueño los borra con su clave
CREATE TABLE IF NOT EXISTS salas (id TEXT PRIMARY KEY, datos TEXT NOT NULL, clave TEXT, ip TEXT, creada INTEGER, vivo INTEGER);
CREATE INDEX IF NOT EXISTS i_salas_vivo ON salas(vivo);
CREATE INDEX IF NOT EXISTS i_salas_ip ON salas(ip, creada);
