const jwt = require('jsonwebtoken');
const pool = require('../db/pool');

function signToken(user) {
  return jwt.sign(
    { id: user.id, role: user.role, email: user.email, name: user.name },
    process.env.JWT_SECRET || 'dev-secret',
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
}

function setAuthCookie(res, token) {
  res.cookie('token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true',
    maxAge: 7 * 24 * 60 * 60 * 1000
  });
}

function clearAuthCookie(res) {
  res.clearCookie('token', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.COOKIE_SECURE === 'true'
  });
}

async function attachUser(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const bearer = header.startsWith('Bearer ') ? header.slice(7) : null;
    const token = bearer || req.cookies?.token;
    if (!token) {
      req.user = null;
      return next();
    }
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev-secret');
    const [rows] = await pool.execute(
      'SELECT id, name, email, role, phone, notes, created_at FROM users WHERE id = :id LIMIT 1',
      { id: payload.id }
    );
    req.user = rows[0] || null;
    next();
  } catch {
    req.user = null;
    next();
  }
}

function requireAuth(req, res, next) {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  next();
}

function requireAdmin(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  next();
}

function ensureSessionId(req, res, next) {
  let sid = req.cookies?.sid;
  if (!sid) {
    sid = require('crypto').randomBytes(24).toString('hex');
    res.cookie('sid', sid, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.COOKIE_SECURE === 'true',
      maxAge: 30 * 24 * 60 * 60 * 1000
    });
  }
  req.sessionId = sid;
  next();
}

module.exports = {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  attachUser,
  requireAuth,
  requireAdmin,
  ensureSessionId
};
