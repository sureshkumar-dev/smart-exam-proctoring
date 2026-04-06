#!/usr/bin/env node

/**
 * Database Reset Script
 * 
 * This script safely clears all data from the proctoring database
 * while preserving the table structure.
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

const DB_PATH = path.join(__dirname, 'proctoring.db');

console.log('🗃️  DATABASE RESET SCRIPT');
console.log('Database path:', DB_PATH);
console.log('');

// Check if database file exists
if (fs.existsSync(DB_PATH)) {
  console.log('📁 Found existing database file');
  
  // Create backup before clearing
  const backupPath = path.join(__dirname, `proctoring_backup_${Date.now()}.db`);
  fs.copyFileSync(DB_PATH, backupPath);
  console.log('💾 Backup created:', backupPath);
  
  // Delete the old database file
  fs.unlinkSync(DB_PATH);
  console.log('🗑️  Old database file deleted');
} else {
  console.log('📁 No existing database file found');
}

// Create fresh database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error creating fresh database:', err);
    process.exit(1);
  }
  
  console.log('✅ Fresh database created successfully');
  
  // Initialize tables with same structure as original
  db.serialize(() => {
    // Users table
    db.run(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT,
        role TEXT NOT NULL,
        auth_provider TEXT NOT NULL DEFAULT 'manual',
        google_id TEXT,
        display_name TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) console.error('❌ Error creating users table:', err);
    });

    // Exams table
    db.run(`
      CREATE TABLE IF NOT EXISTS exams (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        duration_minutes INTEGER NOT NULL,
        student_key TEXT UNIQUE NOT NULL,
        proctor_key TEXT UNIQUE NOT NULL,
        admin_key TEXT UNIQUE NOT NULL,
        created_by INTEGER NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `, (err) => {
      if (err) console.error('❌ Error creating exams table:', err);
    });

    // Questions table
    db.run(`
      CREATE TABLE IF NOT EXISTS questions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam_id INTEGER NOT NULL,
        type TEXT NOT NULL,
        question_text TEXT NOT NULL,
        options TEXT,
        correct_answer TEXT,
        order_index INTEGER,
        FOREIGN KEY (exam_id) REFERENCES exams (id)
      )
    `, (err) => {
      if (err) console.error('❌ Error creating questions table:', err);
    });

    // Sessions table
    db.run(`
      CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        exam_id INTEGER NOT NULL,
        user_id INTEGER NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        malpractice_score INTEGER DEFAULT 0,
        started_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        ended_at DATETIME,
        FOREIGN KEY (exam_id) REFERENCES exams (id),
        FOREIGN KEY (user_id) REFERENCES users (id)
      )
    `, (err) => {
      if (err) console.error('❌ Error creating sessions table:', err);
    });

    // Session answers table
    db.run(`
      CREATE TABLE IF NOT EXISTS session_answers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        question_id INTEGER NOT NULL,
        answer TEXT,
        FOREIGN KEY (session_id) REFERENCES sessions (id),
        FOREIGN KEY (question_id) REFERENCES questions (id)
      )
    `, (err) => {
      if (err) console.error('❌ Error creating session_answers table:', err);
    });

    // Malpractice events table
    db.run(`
      CREATE TABLE IF NOT EXISTS malpractice_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        event_type TEXT NOT NULL,
        score_added INTEGER DEFAULT 0,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions (id)
      )
    `, (err) => {
      if (err) console.error('❌ Error creating malpractice_events table:', err);
    });

    // Evidence table
    db.run(`
      CREATE TABLE IF NOT EXISTS evidence (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        event_type TEXT,
        details TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions (id)
      )
    `, (err) => {
      if (err) console.error('❌ Error creating evidence table:', err);
    });

    console.log('✅ All database tables created successfully');
    console.log('');
    console.log('🎯 Database reset complete!');
    console.log('📋 Ready for fresh start');
    console.log('');
    console.log('💡 Next steps:');
    console.log('   1. Start server: node server.js');
    console.log('   2. Create admin account');
    console.log('   3. Create exam and test');
    console.log('');
    
    db.close((err) => {
      if (err) {
        console.error('❌ Error closing database:', err);
      } else {
        console.log('✅ Database connection closed');
      }
    });
  });
});
