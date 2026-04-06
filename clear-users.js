#!/usr/bin/env node

/**
 * Clear Users Script
 * 
 * This script removes all user accounts and login credentials
 * while keeping exams, questions, sessions, and other data intact.
 */

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3');

const DB_PATH = path.join(__dirname, 'proctoring.db');

console.log('👥 CLEAR USERS SCRIPT');
console.log('Database path:', DB_PATH);
console.log('');

// Check if database file exists
if (!fs.existsSync(DB_PATH)) {
  console.log('❌ Database file not found:', DB_PATH);
  console.log('Please start the server first to create the database.');
  process.exit(1);
}

console.log('📁 Found existing database file');

// Create backup before clearing users
const backupPath = path.join(__dirname, `proctoring_backup_users_${Date.now()}.db`);
fs.copyFileSync(DB_PATH, backupPath);
console.log('💾 Backup created:', backupPath);

// Connect to database
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error('❌ Error connecting to database:', err);
    process.exit(1);
  }
  
  console.log('✅ Connected to database');
  console.log('');
  
  // Clear users table
  db.run('DELETE FROM users', function(err) {
    if (err) {
      console.error('❌ Error clearing users table:', err);
      db.close();
      process.exit(1);
    }
    
    console.log(`🗑️  Cleared ${this.changes} user accounts from users table`);
    
    // Reset auto-increment counter
    db.run('DELETE FROM sqlite_sequence WHERE name = "users"', function(err) {
      if (err) {
        console.error('❌ Error resetting user ID counter:', err);
      } else {
        console.log('🔄 Reset user ID counter to start from 1');
      }
      
      // Check what other data remains
      console.log('');
      console.log('📊 Remaining data in database:');
      
      // Count exams
      db.get('SELECT COUNT(*) as count FROM exams', (err, row) => {
        if (!err) {
          console.log(`   📝 Exams: ${row.count}`);
        }
        
        // Count questions
        db.get('SELECT COUNT(*) as count FROM questions', (err, row) => {
          if (!err) {
            console.log(`   ❓ Questions: ${row.count}`);
          }
          
          // Count sessions
          db.get('SELECT COUNT(*) as count FROM sessions', (err, row) => {
            if (!err) {
              console.log(`   🎯 Sessions: ${row.count}`);
            }
            
            // Count evidence
            db.get('SELECT COUNT(*) as count FROM evidence', (err, row) => {
              if (!err) {
                console.log(`   📸 Evidence: ${row.count}`);
              }
              
              console.log('');
              console.log('✅ Users cleared successfully!');
              console.log('🎯 Database ready for fresh user accounts');
              console.log('');
              console.log('💡 Next steps:');
              console.log('   1. Start server: node server.js');
              console.log('   2. Create new admin account via signup');
              console.log('   3. Create student/proctor accounts as needed');
              console.log('   4. Test with fresh credentials');
              console.log('');
              console.log('📋 What was preserved:');
              console.log('   ✅ All exams and questions');
              console.log('   ✅ All session data');
              console.log('   ✅ All evidence files');
              console.log('   ✅ All malpractice events');
              console.log('   ❌ Only user accounts were removed');
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
        });
      });
    });
  });
});
