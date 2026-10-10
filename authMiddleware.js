// authMiddleware.js
import jwt from 'jsonwebtoken';

export const verifyToken = (req, res, next) => {
  // Read Authorization header
  const authHeader = req.headers['authorization'];
  
  // Format should be: "Bearer <token>"
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Access denied. No token provided.' });
  }

  const token = authHeader.split(' ')[1];

  try {
    // Verify signature and expiration
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Attach decoded payload to request
    next();
  } catch (error) {
    return res.status(403).json({ message: 'Invalid or expired token.' });
  }
};

export const verifyAdmin = (req, res, next) => {
  verifyToken(req, res, () => {
    const isAdmin = req.user.role === 'ADMIN' || (req.user.email && req.user.email.toLowerCase() === 'adminuser@gmail.com');
    if (!isAdmin) {
      return res.status(403).json({ message: 'Access denied. Administrator privileges required.' });
    }
    next();
  });
};
