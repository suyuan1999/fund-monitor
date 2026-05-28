const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

let SQL;
let db;

function getDbPath() {
  try {
    const { app } = require('electron');
    const dir = app.getPath('userData');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'fund-monitor.db');
  } catch (_) {
    const dir = path.join(__dirname, '..', '..', 'data');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    return path.join(dir, 'fund-monitor.db');
  }
}

async function initDatabase() {
  if (db) return db;

  SQL = await initSqlJs();

  const dbPath = getDbPath();

  if (fs.existsSync(dbPath)) {
    const buffer = fs.readFileSync(dbPath);
    db = new SQL.Database(buffer);
  } else {
    db = new SQL.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS bloggers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nickname TEXT NOT NULL,
      xhs_url TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      avatar_url TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS notes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      blogger_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      note_url TEXT DEFAULT '',
      source TEXT DEFAULT 'auto' CHECK(source IN ('auto', 'manual')),
      note_date TEXT DEFAULT (date('now', 'localtime')),
      fetched_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (blogger_id) REFERENCES bloggers(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS analysis (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      date TEXT NOT NULL UNIQUE,
      summary TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now', 'localtime'))
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  const defaults = {
    ai_enabled: 'true',
    push_enabled: 'true',
    auto_fetch_enabled: 'true',
    auto_fetch_time: '14:30',
    sct_sendkey: '',
    ai_api_key: '',
    ai_provider: 'deepseek',
    reminder_time: '20:00',
    xhs_cookie: '',
  };

  for (const [key, value] of Object.entries(defaults)) {
    db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', [key, value]);
  }

  saveDb();
  return db;
}

function saveDb() {
  const dbPath = getDbPath();
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(dbPath, buffer);
}

// ===== Blogger CRUD =====

function addBlogger(nickname, xhsUrl, tags = []) {
  db.run('INSERT INTO bloggers (nickname, xhs_url, tags) VALUES (?, ?, ?)', [
    nickname,
    xhsUrl,
    JSON.stringify(tags),
  ]);
  const result = db.exec('SELECT last_insert_rowid() as id');
  const id = result[0].values[0][0];
  saveDb();
  return { id, nickname, xhs_url: xhsUrl, tags };
}

function getBloggers() {
  const result = db.exec(`
    SELECT b.*,
      (SELECT COUNT(*) FROM notes WHERE blogger_id = b.id) as note_count,
      (SELECT MAX(fetched_at) FROM notes WHERE blogger_id = b.id) as last_fetch
    FROM bloggers b
    ORDER BY b.created_at DESC
  `);
  return rowsToObjects(result);
}

function updateBlogger(id, data) {
  const fields = [];
  const values = [];
  for (const [key, val] of Object.entries(data)) {
    if (['nickname', 'xhs_url', 'tags', 'avatar_url'].includes(key)) {
      fields.push(`${key} = ?`);
      values.push(key === 'tags' ? JSON.stringify(val) : val);
    }
  }
  if (fields.length === 0) return null;
  values.push(id);
  db.run(`UPDATE bloggers SET ${fields.join(', ')} WHERE id = ?`, values);
  saveDb();
  const result = db.exec('SELECT * FROM bloggers WHERE id = ?', [id]);
  return rowsToObjects(result)[0];
}

function deleteBlogger(id) {
  db.run('DELETE FROM notes WHERE blogger_id = ?', [id]);
  db.run('DELETE FROM bloggers WHERE id = ?', [id]);
  saveDb();
}

function searchBloggers(keyword) {
  const result = db.exec(
    `SELECT b.*,
      (SELECT COUNT(*) FROM notes WHERE blogger_id = b.id) as note_count
    FROM bloggers b
    WHERE b.nickname LIKE ? OR b.tags LIKE ?
    ORDER BY b.created_at DESC`,
    [`%${keyword}%`, `%${keyword}%`]
  );
  return rowsToObjects(result);
}

// ===== Notes CRUD =====

function addNote(bloggerId, content, source = 'auto', noteUrl = '', noteDate = null) {
  const actualDate = noteDate || new Date().toISOString().slice(0, 10);

  // Dedup: skip if same URL already exists for this blogger on this note date
  if (noteUrl) {
    const existing = db.exec(
      'SELECT id FROM notes WHERE blogger_id = ? AND note_url = ? AND note_date = ?',
      [bloggerId, noteUrl, actualDate]
    );
    if (existing.length > 0 && existing[0].values.length > 0) {
      return { skipped: true, id: existing[0].values[0][0] };
    }
  }
  db.run(
    'INSERT INTO notes (blogger_id, content, source, note_url, note_date) VALUES (?, ?, ?, ?, ?)',
    [bloggerId, content, source, noteUrl, actualDate]
  );
  saveDb();
  return { skipped: false };
}

function getNotesByBlogger(bloggerId) {
  const result = db.exec(
    'SELECT * FROM notes WHERE blogger_id = ? ORDER BY note_date DESC, fetched_at DESC',
    [bloggerId]
  );
  return rowsToObjects(result);
}

function getTodayNotes() {
  const result = db.exec(
    `SELECT n.*, b.nickname as blogger_nickname
     FROM notes n
     JOIN bloggers b ON n.blogger_id = b.id
     WHERE n.note_date = date('now', 'localtime')
     ORDER BY n.fetched_at DESC`
  );
  return rowsToObjects(result);
}

// ===== Analysis CRUD =====

function saveAnalysis(date, summary) {
  db.run(
    "INSERT OR REPLACE INTO analysis (date, summary, created_at) VALUES (?, ?, datetime('now', 'localtime'))",
    [date, summary]
  );
  saveDb();
}

function getAnalysis(date) {
  if (date) {
    const result = db.exec('SELECT * FROM analysis WHERE date = ?', [date]);
    const rows = rowsToObjects(result);
    return rows[0] || null;
  }
  const result = db.exec('SELECT * FROM analysis ORDER BY date DESC');
  return rowsToObjects(result);
}

// ===== Settings CRUD =====

function getSetting(key) {
  const result = db.exec('SELECT value FROM settings WHERE key = ?', [key]);
  if (result.length > 0 && result[0].values.length > 0) {
    return result[0].values[0][0];
  }
  return null;
}

function setSetting(key, value) {
  db.run('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', [key, String(value)]);
  saveDb();
}

function getAllSettings() {
  const result = db.exec('SELECT * FROM settings');
  if (result.length === 0) return {};
  const rows = rowsToObjects(result);
  const settings = {};
  for (const row of rows) {
    settings[row.key] = row.value;
  }
  return settings;
}

// ===== Helpers =====

function rowsToObjects(result) {
  if (!result || result.length === 0) return [];
  const { columns, values } = result[0];
  return values.map((row) => {
    const obj = {};
    columns.forEach((col, i) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

module.exports = {
  initDatabase,
  addBlogger,
  getBloggers,
  updateBlogger,
  deleteBlogger,
  searchBloggers,
  addNote,
  getNotesByBlogger,
  getTodayNotes,
  saveAnalysis,
  getAnalysis,
  getSetting,
  setSetting,
  getAllSettings,
};
