// Una D1 de mentira sobre SQLite (node:sqlite), para correr el servidor de la comunidad sin Cloudflare.
import { DatabaseSync } from 'node:sqlite';
export function d1(archivo = ':memory:') {
  const db = new DatabaseSync(archivo);
  const val = (v) => (v instanceof ArrayBuffer ? new Uint8Array(v) : typeof v === 'boolean' ? (v ? 1 : 0) : v === undefined ? null : v);
  const st = (sql, a = []) => ({
    bind: (...x) => st(sql, x.map(val)),
    first: async () => db.prepare(sql).get(...a) ?? null,
    all: async () => ({ results: db.prepare(sql).all(...a) }),
    run: async () => { const i = db.prepare(sql).run(...a); return { meta: { changes: Number(i.changes), last_row_id: Number(i.lastInsertRowid) } }; },
    x() { const q = db.prepare(sql); return /^\s*select/i.test(sql) ? { results: q.all(...a) } : { meta: { changes: Number(q.run(...a).changes) } }; },
  });
  return { prepare: (s) => st(s), batch: async (L) => { db.exec('BEGIN'); try { const r = L.map((s) => s.x()); db.exec('COMMIT'); return r; } catch (e) { db.exec('ROLLBACK'); throw e; } }, _db: db };
}
