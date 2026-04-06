/**
 * Authentication and authorization middleware.
 * requireAuth: user must be logged in.
 * requireRole(role): user must be logged in and have the given role.
 */

function requireAuth(req, res, next) {
  if (!req.isAuthenticated || !req.isAuthenticated()) {
    if (req.xhr || req.headers.accept && req.headers.accept.indexOf('application/json') !== -1) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    return res.redirect('/login.html');
  }
  next();
}

function requireRole(role) {
  return function (req, res, next) {
    if (!req.isAuthenticated || !req.isAuthenticated()) {
      if (req.xhr || req.headers.accept && req.headers.accept.indexOf('application/json') !== -1) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      return res.redirect('/login.html');
    }
    if (req.user.role !== role) {
      if (req.xhr || req.headers.accept && req.headers.accept.indexOf('application/json') !== -1) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      return res.redirect('/');
    }
    next();
  };
}

module.exports = {
  requireAuth,
  requireRole,
};
