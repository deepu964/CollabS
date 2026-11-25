import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { db } from '../db/database.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();
const JWT_SECRET = process.env.JWT_SECRET || 'collabs_secure_jwt_secret_key_2026';
const TOKEN_EXPIRY = '7d';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/auth/register
 * Registers a new individual user account.
 */
router.post('/register', async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    // 1. Validation
    if (!name || name.trim().length < 2) {
      return res.status(400).json({
        success: false,
        error: 'Please enter your full name (at least 2 characters).'
      });
    }

    if (!email || !EMAIL_REGEX.test(email.trim().toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: 'Please enter a valid email address.'
      });
    }

    if (!password || password.length < 6) {
      return res.status(400).json({
        success: false,
        error: 'Password must be at least 6 characters long.'
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        error: 'Passwords do not match.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = name.trim();

    // 2. Duplicate Email Check
    const existing = db.findUserByEmail(cleanEmail);
    if (existing) {
      return res.status(409).json({
        success: false,
        error: 'An account with this email address already exists. Please sign in instead.'
      });
    }

    // 3. Password Hashing (Bcrypt)
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // 4. Create User Record
    const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
    const avatar = `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(cleanName)}&backgroundColor=5856d6,0a8491,248a3d,ea580c`;

    const newUser = {
      id: userId,
      name: cleanName,
      email: cleanEmail,
      password: hashedPassword,
      avatar,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    db.createUser(newUser);

    // 5. Issue JWT Token
    const token = jwt.sign(
      { id: newUser.id, email: newUser.email, name: newUser.name },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    const { password: _, ...safeUser } = newUser;

    return res.status(201).json({
      success: true,
      message: 'Account created successfully.',
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('[Auth API] Registration error:', err);
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred during registration. Please try again.'
    });
  }
});

/**
 * POST /api/auth/login
 * Authenticates user credentials and returns JWT session token.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        error: 'Please provide both email and password.'
      });
    }

    const cleanEmail = email.trim().toLowerCase();
    const user = db.findUserByEmail(cleanEmail);

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    // Compare bcrypt hash
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: 'Invalid email or password.'
      });
    }

    // Issue JWT Token
    const token = jwt.sign(
      { id: user.id, email: user.email, name: user.name },
      JWT_SECRET,
      { expiresIn: TOKEN_EXPIRY }
    );

    const { password: _, ...safeUser } = user;

    return res.status(200).json({
      success: true,
      message: 'Signed in successfully.',
      token,
      user: safeUser
    });
  } catch (err) {
    console.error('[Auth API] Login error:', err);
    return res.status(500).json({
      success: false,
      error: 'An internal error occurred during sign in. Please try again.'
    });
  }
});

/**
 * GET /api/auth/me
 * Retrieves current authenticated user profile using token.
 */
router.get('/me', verifyToken, (req, res) => {
  return res.status(200).json({
    success: true,
    user: req.user
  });
});

/**
 * POST /api/auth/logout
 * Acknowledges user sign out.
 */
router.post('/logout', (req, res) => {
  return res.status(200).json({
    success: true,
    message: 'Signed out successfully.'
  });
});

export default router;
