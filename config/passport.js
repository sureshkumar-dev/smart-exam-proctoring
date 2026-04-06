/**
 * Passport configuration: Local strategy (email + password) and Google OAuth.
 * Users stored with role and auth_provider.
 */

const passport = require('passport');
const LocalStrategy = require('passport-local').Strategy;
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const bcrypt = require('bcryptjs');
const db = require('./database');

passport.use(
  new LocalStrategy(
    { usernameField: 'email', passwordField: 'password' },
    (email, password, done) => {
      const normalized = (email || '').trim().toLowerCase();
      db.get('SELECT * FROM users WHERE email = ? AND auth_provider = ?', [normalized, 'manual'])
        .then((user) => {
          if (!user) return done(null, false, { message: 'Invalid email or password' });
          bcrypt.compare(password, user.password_hash, (err, match) => {
            if (err) return done(err);
            if (!match) return done(null, false, { message: 'Invalid email or password' });
            return done(null, { id: user.id, email: user.email, role: user.role, auth_provider: user.auth_provider, display_name: user.display_name });
          });
        })
        .catch((e) => done(e));
    }
  )
);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const BASE_URL = process.env.BASE_URL || 'http://localhost:3000';

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: BASE_URL + '/auth/google/callback',
      },
      (accessToken, refreshToken, profile, done) => {
        const email = profile.emails && profile.emails[0] && profile.emails[0].value;
        const googleId = profile.id;
        const displayName = profile.displayName || '';
        if (!email) return done(new Error('No email from Google'));
        db.get('SELECT * FROM users WHERE google_id = ? OR (email = ? AND auth_provider = ?)', [googleId, email.trim().toLowerCase(), 'google'])
          .then((user) => {
            if (user) {
              if (!user.google_id) {
                return db.run('UPDATE users SET google_id = ?, display_name = ? WHERE id = ?', [googleId, displayName, user.id]).then(() => user);
              }
              return db.run('UPDATE users SET display_name = ? WHERE id = ?', [displayName, user.id]).then(() => user);
            }
            return db.get('SELECT * FROM users WHERE email = ?', [email.trim().toLowerCase()]).then((existing) => {
              if (existing) {
                return db.run('UPDATE users SET google_id = ?, display_name = ?, auth_provider = ? WHERE id = ?', [googleId, displayName, 'google', existing.id]).then(() => db.get('SELECT * FROM users WHERE id = ?', [existing.id]));
              }
              return db.run(
                'INSERT INTO users (email, role, auth_provider, google_id, display_name) VALUES (?, ?, ?, ?, ?)',
                [email.trim().toLowerCase(), 'student', 'google', googleId, displayName]
              ).then((r) => db.get('SELECT * FROM users WHERE id = ?', [r.lastID]));
            });
          })
          .then((user) => {
            if (!user) return done(new Error('User not found after upsert'));
            done(null, { id: user.id, email: user.email, role: user.role, auth_provider: user.auth_provider, display_name: user.display_name });
          })
          .catch((e) => done(e));
      }
    )
  );
}

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser((id, done) => {
  db.get('SELECT id, email, role, auth_provider, display_name FROM users WHERE id = ?', [id])
    .then((user) => {
      if (!user) return done(null, null);
      done(null, { id: user.id, email: user.email, role: user.role, auth_provider: user.auth_provider, display_name: user.display_name });
    })
    .catch((e) => done(e));
});

module.exports = passport;
