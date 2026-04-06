/**
 * SQLite database connection and initialization.
 * Tables: users, exams, questions, sessions, malpractice_events, evidence.
 */

const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const DB_PATH = path.join(__dirname, '..', 'proctoring.db');
let db = null;

function getDb() {
  if (db) return db;
  db = new sqlite3.Database(DB_PATH, (err) => {
    if (err) console.error('Database open error:', err);
  });
  return db;
}

function run(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().run(sql, params, function (err) {
      if (err) reject(err);
      else resolve({ lastID: this.lastID, changes: this.changes });
    });
  });
}

function get(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().get(sql, params, (err, row) => {
      if (err) reject(err);
      else resolve(row || null);
    });
  });
}

function all(sql, params = []) {
  return new Promise((resolve, reject) => {
    getDb().all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function initDatabase() {
  const database = getDb();
  return new Promise((resolve, reject) => {
    database.serialize(() => {
      database.run(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          email TEXT UNIQUE NOT NULL,
          password_hash TEXT,
          role TEXT NOT NULL CHECK(role IN ('admin','student','proctor')),
          auth_provider TEXT NOT NULL DEFAULT 'manual' CHECK(auth_provider IN ('manual','google')),
          google_id TEXT UNIQUE,
          display_name TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `, (err) => { if (err) return reject(err); });

      database.run(`
        CREATE TABLE IF NOT EXISTS exams (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          title TEXT NOT NULL,
          duration_minutes INTEGER NOT NULL,
          student_key TEXT NOT NULL UNIQUE,
          proctor_key TEXT NOT NULL UNIQUE,
          admin_key TEXT NOT NULL UNIQUE,
          created_by INTEGER NOT NULL,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (created_by) REFERENCES users(id)
        )
      `, (err) => { if (err) return reject(err); });

      database.run(`
        CREATE TABLE IF NOT EXISTS questions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          exam_id INTEGER NOT NULL,
          type TEXT NOT NULL CHECK(type IN ('mcq','text')),
          question_text TEXT NOT NULL,
          options TEXT,
          correct_answer TEXT,
          order_index INTEGER DEFAULT 0,
          FOREIGN KEY (exam_id) REFERENCES exams(id)
        )
      `, (err) => { if (err) return reject(err); });

      database.run(`
        CREATE TABLE IF NOT EXISTS sessions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          exam_id INTEGER NOT NULL,
          user_id INTEGER NOT NULL,
          status TEXT DEFAULT 'active' CHECK(status IN ('active','terminated','submitted')),
          malpractice_score INTEGER DEFAULT 0,
          started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          ended_at DATETIME,
          FOREIGN KEY (exam_id) REFERENCES exams(id),
          FOREIGN KEY (user_id) REFERENCES users(id)
        )
      `, (err) => { if (err) return reject(err); });

      database.run(`
        CREATE TABLE IF NOT EXISTS session_answers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL,
          question_id INTEGER NOT NULL,
          answer_text TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES sessions(id),
          FOREIGN KEY (question_id) REFERENCES questions(id)
        )
      `, (err) => { if (err) return reject(err); });

      database.run(`
        CREATE TABLE IF NOT EXISTS malpractice_events (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          session_id INTEGER NOT NULL,
          event_type TEXT NOT NULL,
          score_added INTEGER NOT NULL,
          details TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (session_id) REFERENCES sessions(id)
        )
      `, (err) => { if (err) return reject(err); });

      database.run(`
        CREATE TABLE IF NOT EXISTS evidence (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id INTEGER NOT NULL,
  event_id INTEGER,
  file_path TEXT NOT NULL,
  details TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id),
  FOREIGN KEY (event_id) REFERENCES malpractice_events(id)
)`, (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  });
}

module.exports = {
  getDb,
  run,
  get,
  all,
  initDatabase,
};
