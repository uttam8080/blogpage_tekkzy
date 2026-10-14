// authRoutes.js - Authentication routes using PostgreSQL ('pg')
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { verifyToken } from './authMiddleware.js';
import pool from './db.js';

const router = express.Router();

// 1. REGISTER ROUTE
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All fields are required.' });
    }

    // Check if user already exists in PostgreSQL
    const existingResult = await pool.query(
      'SELECT id FROM "User" WHERE LOWER(email) = LOWER($1)',
      [email.trim()]
    );

    if (existingResult.rows.length > 0) {
      return res.status(409).json({ message: 'User already exists with this email.' });
    }

    // Hash password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const role = (email.toLowerCase().trim() === 'adminuser@gmail.com') ? 'ADMIN' : 'USER';
    const userId = crypto.randomUUID();

    // Save user to PostgreSQL
    const insertResult = await pool.query(
      `INSERT INTO "User" (id, username, email, password, role, "createdAt", "updatedAt")
       VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
       RETURNING id, username, email, role, "createdAt"`,
      [userId, username.trim(), email.toLowerCase().trim(), hashedPassword, role]
    );

    const newUser = insertResult.rows[0];

    res.status(201).json({ 
      message: 'User registered successfully!',
      userId: newUser.id,
      role: newUser.role
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during registration', error: error.message });
  }
});

// 2. LOGIN ROUTE
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    // Find user in PostgreSQL
    const userResult = await pool.query(
      'SELECT * FROM "User" WHERE LOWER(email) = LOWER($1)',
      [email.trim()]
    );

    if (userResult.rows.length === 0) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    const user = userResult.rows[0];

    // Compare password with hashed password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password.' });
    }

    // Determine user role (adminuser@gmail.com is ADMIN)
    const role = (user.role === 'ADMIN' || user.email.toLowerCase() === 'adminuser@gmail.com') ? 'ADMIN' : 'USER';

    // Generate JWT token
    const payload = {
      userId: user.id,
      email: user.email,
      username: user.username,
      role
    };

    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: process.env.JWT_EXPIRES_IN || '1h'
    });

    res.status(200).json({
      message: 'Login successful!',
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role
      }
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during login', error: error.message });
  }
});

// 3. PROTECTED ROUTE (Requires Token)
router.get('/profile', verifyToken, async (req, res) => {
  try {
    // Fetch latest user details from PostgreSQL (omitting password)
    const result = await pool.query(
      'SELECT id, username, email, role, "createdAt" FROM "User" WHERE id = $1',
      [req.user.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'User not found in database.' });
    }

    res.status(200).json({
      message: 'Welcome to your private profile!',
      user: result.rows[0]
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error fetching profile', error: error.message });
  }
});

// 4. FORGOT PASSWORD (Generate Reset Token)
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    // Verify user exists in PostgreSQL
    const result = await pool.query(
      'SELECT id, email FROM "User" WHERE LOWER(email) = LOWER($1)',
      [email.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'No account registered with this email address.' });
    }

    const user = result.rows[0];

    // Generate a temporary 15-minute reset token
    const resetToken = jwt.sign(
      { userId: user.id, email: user.email, purpose: 'password_reset' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.status(200).json({
      message: 'Reset authorization verified! Please enter your new password.',
      resetToken,
      email: user.email
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error processing request', error: error.message });
  }
});

// 5. RESET PASSWORD (Verify Token & Update Password in PostgreSQL)
router.post('/reset-password', async (req, res) => {
  try {
    const { email, resetToken, newPassword } = req.body;

    if (!email || !resetToken || !newPassword) {
      return res.status(400).json({ message: 'Email, reset token, and new password are required.' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters long.' });
    }

    // Verify reset token
    let decoded;
    try {
      decoded = jwt.verify(resetToken, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(403).json({ message: 'Reset token is invalid or has expired. Please request a new one.' });
    }

    if (decoded.email.toLowerCase() !== email.toLowerCase().trim() || decoded.purpose !== 'password_reset') {
      return res.status(403).json({ message: 'Invalid reset token credentials.' });
    }

    // Hash the new password with bcrypt
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    // Update password in PostgreSQL
    const updateResult = await pool.query(
      'UPDATE "User" SET password = $1, "updatedAt" = NOW() WHERE LOWER(email) = LOWER($2) RETURNING id',
      [hashedPassword, email.trim()]
    );

    if (updateResult.rows.length === 0) {
      return res.status(404).json({ message: 'User not found to update password.' });
    }

    res.status(200).json({
      message: 'Password successfully updated in database! You can now sign in.'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error resetting password', error: error.message });
  }
});

export default router;
