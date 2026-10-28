import fs from "node:fs";
import path from "node:path";
import initSqlJs from "sql.js";
import pg from "pg";
const tables = `CREATE TABLE IF NOT EXISTS records (kind TEXT NOT NULL, id TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (kind,id))`;
export async function createStore() {
  if (process.env.DATABASE_URL) {
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 5,
      ssl:
        process.env.DATABASE_SSL === "true"
          ? { rejectUnauthorized: true }
          : undefined,
    });
    await pool.query(tables);
    return {
      async all(kind) {
        const r = await pool.query("SELECT value FROM records WHERE kind=$1", [
          kind,
        ]);
        return r.rows.map((x) => JSON.parse(x.value));
      },
      async get(kind, id) {
        const r = await pool.query(
          "SELECT value FROM records WHERE kind=$1 AND id=$2",
          [kind, id],
        );
        return r.rows[0] ? JSON.parse(r.rows[0].value) : null;
      },
      async set(kind, id, value) {
        await pool.query(
          "INSERT INTO records(kind,id,value) VALUES($1,$2,$3) ON CONFLICT(kind,id) DO UPDATE SET value=excluded.value",
          [kind, id, JSON.stringify(value)],
        );
      },
      async insert(kind, id, value) {
        const r = await pool.query(
          "INSERT INTO records(kind,id,value) VALUES($1,$2,$3) ON CONFLICT(kind,id) DO NOTHING RETURNING id",
          [kind, id, JSON.stringify(value)],
        );
        return r.rowCount > 0;
      },
      async remove(kind, id) {
        await pool.query("DELETE FROM records WHERE kind=$1 AND id=$2", [
          kind,
          id,
        ]);
      },
      async close() {
        await pool.end();
      },
      type: "postgres",
    };
  }
  if (process.env.NODE_ENV === "production" && !process.env.DATA_DIR)
    throw new Error(
      "Production requires DATABASE_URL or a DATA_DIR on a persistent disk.",
    );
  const dir = process.env.DATA_DIR || path.resolve("data");
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, "biom.sqlite");
  const SQL = await initSqlJs();
  const db = new SQL.Database(
    fs.existsSync(file) ? fs.readFileSync(file) : undefined,
  );
  db.run(tables);
  const persist = () => {
    const temp = file + ".tmp";
    const bytes = Buffer.from(db.export());
    fs.writeFileSync(temp, bytes);
    try {
      fs.renameSync(temp, file);
    } catch (e) {
      if (
        process.platform === "win32" &&
        ["EPERM", "EACCES"].includes(e.code)
      ) {
        fs.copyFileSync(temp, file);
      } else throw e;
    }
  };
  const rows = (query, args) => {
    const stmt = db.prepare(query);
    try {
      stmt.bind(args);
      const result = [];
      while (stmt.step()) result.push(stmt.getAsObject());
      return result;
    } finally {
      stmt.free();
    }
  };
  persist();
  return {
    async all(kind) {
      return rows("SELECT value FROM records WHERE kind=?", [kind]).map((x) =>
        JSON.parse(x.value),
      );
    },
    async get(kind, id) {
      const r = rows("SELECT value FROM records WHERE kind=? AND id=?", [
        kind,
        id,
      ]);
      return r[0] ? JSON.parse(r[0].value) : null;
    },
    async set(kind, id, value) {
      db.run(
        "INSERT INTO records(kind,id,value) VALUES(?,?,?) ON CONFLICT(kind,id) DO UPDATE SET value=excluded.value",
        [kind, id, JSON.stringify(value)],
      );
      persist();
    },
    async insert(kind, id, value) {
      db.run("INSERT OR IGNORE INTO records(kind,id,value) VALUES(?,?,?)", [
        kind,
        id,
        JSON.stringify(value),
      ]);
      const changed = db.getRowsModified() > 0;
      if (changed) persist();
      return changed;
    },
    async remove(kind, id) {
      db.run("DELETE FROM records WHERE kind=? AND id=?", [kind, id]);
      persist();
    },
    async close() {
      persist();
      db.close();
    },
    type: "sqlite",
  };
}
