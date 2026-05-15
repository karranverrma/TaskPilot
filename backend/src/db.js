const { Database } = require('node-sqlite3-wasm');
const fs = require('fs');
const path = require('path');

const DB_PATH = process.env.DB_PATH || path.join(__dirname, '../../data/taskpilot.db');
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const _db = new Database(DB_PATH);
_db.run(`PRAGMA journal_mode=WAL`);
_db.run(`PRAGMA foreign_keys=ON`);

_db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT DEFAULT 'member',
    created_at TEXT DEFAULT (datetime('now'))
  )`);
_db.run(`CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    owner_id INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now'))
  )`);
_db.run(`CREATE TABLE IF NOT EXISTS project_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    user_id INTEGER NOT NULL,
    role TEXT DEFAULT 'member',
    joined_at TEXT DEFAULT (datetime('now')),
    UNIQUE(project_id, user_id)
  )`);
_db.run(`CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT DEFAULT 'todo',
    priority TEXT DEFAULT 'medium',
    assigned_to INTEGER,
    due_date TEXT,
    created_by INTEGER NOT NULL,
    created_at TEXT DEFAULT (datetime('now')),
    updated_at TEXT DEFAULT (datetime('now'))
  )`);

// Wrap API to match better-sqlite3 (spread params instead of array)
const db = {
  prepare(sql) {
    const stmt = _db.prepare(sql);
    return {
      run(...params) {
        return stmt.run(params.flat());
      },
      get(...params) {
        return stmt.get(params.flat());
      },
      all(...params) {
        return stmt.all(params.flat());
      }
    };
  },
  exec(sql) { _db.run(sql); },
  transaction(fn) {
    return (...args) => {
      _db.run('BEGIN');
      try {
        const result = fn(...args);
        _db.run('COMMIT');
        return result;
      } catch (e) {
        _db.run('ROLLBACK');
        throw e;
      }
    };
  }
};

module.exports = db;
