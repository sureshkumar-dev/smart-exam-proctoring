/**
 * Authentication routes: manual signup/login and Google OAuth.
 * Maintains user sessions; stores users with role and auth_provider.
 */

const express = require('express');
const passport = require('passport');
const bcrypt = require('bcryptjs');
const db = require('../config/database');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/signup', (req, res, next) => {
  const { email, displayName, password, role } = req.body;
  if (!email || !password || !role) {
    return res.status(400).json({ error: 'Email, password, and role are required' });
  }
  const allowedRoles = ['admin', 'student', 'proctor'];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  bcrypt.hash(password, 10, (err, hash) => {
    if (err) return res.status(500).json({ error: 'Failed to hash password' });
    db.run(
      'INSERT INTO users (email, display_name, password_hash, role, auth_provider) VALUES (?, ?, ?, ?, ?)',
      [email.trim().toLowerCase(), displayName || null, hash, role, 'manual']
    )
      .then((r) => db.get('SELECT id, email, display_name, role, auth_provider FROM users WHERE id = ?', [r.lastID]))
      .then((user) => {
        if (!user) return res.status(500).json({ error: 'User not found after signup' });
        req.login(user, (e) => {
          if (e) return res.status(500).json({ error: 'Login failed' });
          res.json({ user: { id: user.id, email: user.email, display_name: user.display_name, role: user.role, auth_provider: user.auth_provider } });
        });
      })
      .catch((e) => {
        if (e.message && e.message.indexOf('UNIQUE') !== -1) {
          return res.status(400).json({ error: 'Email already registered' });
        }
        res.status(500).json({ error: e.message || 'Signup failed' });
      });
  });
});

router.post('/login', (req, res, next) => {
  passport.authenticate('local', (err, user, info) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!user) return res.status(401).json({ error: info && info.message ? info.message : 'Invalid credentials' });
    req.login(user, (loginErr) => {
      if (loginErr) return res.status(500).json({ error: 'Login failed' });
      res.json({ user: { id: user.id, email: user.email, role: user.role, auth_provider: user.auth_provider } });
    });
  })(req, res, next);
});

router.get('/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: err.message });
    req.session.destroy(() => {
      res.redirect('/');
    });
  });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      role: req.user.role,
      auth_provider: req.user.auth_provider,
      display_name: req.user.display_name,
    },
  });
});

router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

router.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: '/login.html?error=google' }),
  (req, res) => {
    res.redirect('/dashboard.html');
  }
);

module.exports = router;
