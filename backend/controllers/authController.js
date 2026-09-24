const { validationResult } = require('express-validator');
const User = require('../models/User');
const { generateAccessToken, generateRefreshToken } = require('../utils/generateTokens');

const MAX_FAILED_ATTEMPTS = 5;
const LOCK_TIME_MS = 15 * 60 * 1000; // 15 minutes
const REFRESH_COOKIE_NAME = 'refreshToken';

const refreshCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/auth',
};

function handleValidation(req, res) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(400).json({ message: 'Validation failed', errors: errors.array() });
    return false;
  }
  return true;
}

// POST /api/auth/signup
async function signup(req, res) {
  if (!handleValidation(req, res)) return;

  try {
    const { name, email, password } = req.body;

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'An account with this email already exists.' });
    }

    const user = await User.create({ name, email, password });

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    user.refreshTokens.push({ token: refreshToken });
    user.lastLogin = new Date();
    await user.save();

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
    res.status(201).json({
      message: 'Account created successfully.',
      accessToken,
      user: user.toSafeObject(),
    });
  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Something went wrong while creating your account.' });
  }
}

// POST /api/auth/login
async function login(req, res) {
  if (!handleValidation(req, res)) return;

  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    // Use the same generic message whether the email exists or not
    const genericError = { message: 'Incorrect email or password.' };

    if (!user) {
      return res.status(401).json(genericError);
    }

    if (user.isLocked) {
      const minutesLeft = Math.ceil((user.lockUntil - Date.now()) / 60000);
      return res.status(423).json({
        message: `Account temporarily locked due to repeated failed attempts. Try again in ${minutesLeft} minute(s).`,
      });
    }

    const isMatch = await user.comparePassword(password);

    if (!isMatch) {
      user.failedLoginAttempts += 1;
      if (user.failedLoginAttempts >= MAX_FAILED_ATTEMPTS) {
        user.lockUntil = new Date(Date.now() + LOCK_TIME_MS);
        user.failedLoginAttempts = 0;
      }
      await user.save();
      return res.status(401).json(genericError);
    }

    // Successful login: reset lockout state
    user.failedLoginAttempts = 0;
    user.lockUntil = null;
    user.lastLogin = new Date();

    const accessToken = generateAccessToken(user);
    const refreshToken = generateRefreshToken(user);
    user.refreshTokens.push({ token: refreshToken });
    // Keep only the last 5 refresh tokens per user (basic multi-device support)
    if (user.refreshTokens.length > 5) {
      user.refreshTokens = user.refreshTokens.slice(-5);
    }
    await user.save();

    res.cookie(REFRESH_COOKIE_NAME, refreshToken, refreshCookieOptions);
    res.status(200).json({
      message: 'Logged in successfully.',
      accessToken,
      user: user.toSafeObject(),
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Something went wrong while logging in.' });
  }
}

// POST /api/auth/refresh
// Reads the refresh token from the httpOnly cookie and issues a new access token
async function refresh(req, res) {
  const jwt = require('jsonwebtoken');
  const token = req.cookies?.[REFRESH_COOKIE_NAME];

  if (!token) {
    return res.status(401).json({ message: 'No refresh token provided.' });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_REFRESH_SECRET);
    const user = await User.findById(payload.sub);

    if (!user || !user.refreshTokens.some((rt) => rt.token === token)) {
      return res.status(401).json({ message: 'Refresh token is invalid or was revoked.' });
    }

    const accessToken = generateAccessToken(user);
    res.status(200).json({ accessToken });
  } catch (err) {
    return res.status(401).json({ message: 'Refresh token is invalid or expired.' });
  }
}

// POST /api/auth/logout
async function logout(req, res) {
  const token = req.cookies?.[REFRESH_COOKIE_NAME];

  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const payload = jwt.decode(token);
      if (payload?.sub) {
        await User.findByIdAndUpdate(payload.sub, {
          $pull: { refreshTokens: { token } },
        });
      }
    } catch (err) {
      // Ignore decode errors on logout; still clear the cookie below
    }
  }

  res.clearCookie(REFRESH_COOKIE_NAME, { path: '/api/auth' });
  res.status(200).json({ message: 'Logged out successfully.' });
}

// GET /api/auth/me
async function getProfile(req, res) {
  res.status(200).json({ user: req.user.toSafeObject() });
}

module.exports = { signup, login, refresh, logout, getProfile };
