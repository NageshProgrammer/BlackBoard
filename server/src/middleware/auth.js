const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret_boardcollab_jwt_key_2026');

      const user = await User.findById(decoded.id).select('-password');
      if (!user) {
        // Fallback for guest token
        if (decoded.isGuest) {
          req.user = {
            _id: decoded.id,
            id: decoded.id,
            username: decoded.username || 'Guest',
            color: decoded.color || '#3B82F6',
            isGuest: true
          };
          return next();
        }
        return res.status(401).json({ success: false, message: 'User no longer exists' });
      }

      req.user = user;
      next();
    } catch (err) {
      return res.status(401).json({ success: false, message: 'Not authorized, token invalid or expired' });
    }
  } else {
    return res.status(401).json({ success: false, message: 'Not authorized, no token provided' });
  }
};

// Optional auth: allows guest access without rejecting request
const optionalAuth = async (req, res, next) => {
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    try {
      const token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'supersecret_boardcollab_jwt_key_2026');
      const user = await User.findById(decoded.id).select('-password');
      if (user) {
        req.user = user;
      } else if (decoded.isGuest) {
        req.user = {
          _id: decoded.id,
          id: decoded.id,
          username: decoded.username || 'Guest',
          color: decoded.color || '#3B82F6',
          isGuest: true
        };
      }
    } catch {
      // Ignored for optional
    }
  }
  next();
};

module.exports = { protect, optionalAuth };
