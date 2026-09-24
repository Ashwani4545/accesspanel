const express = require('express');
const { body } = require('express-validator');
const rateLimit = require('express-rate-limit');

const {
  signup,
  login,
  refresh,
  logout,
  getProfile,
} = require('../controllers/authController');
const { requireAuth } = require('../middleware/authMiddleware');

const router = express.Router();

// Slow down brute-force attempts against the login endpoint
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts. Please try again later.' },
});

const signupValidation = [
  body('name').trim().isLength({ min: 2, max: 60 }).withMessage('Name must be 2-60 characters.'),
  body('email').isEmail().withMessage('Enter a valid email address.').normalizeEmail(),
  body('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters.')
    .matches(/\d/)
    .withMessage('Password must contain at least one number.')
    .matches(/[A-Za-z]/)
    .withMessage('Password must contain at least one letter.'),
];

const loginValidation = [
  body('email').isEmail().withMessage('Enter a valid email address.').normalizeEmail(),
  body('password').notEmpty().withMessage('Password is required.'),
];

router.post('/signup', signupValidation, signup);
router.post('/login', loginLimiter, loginValidation, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', requireAuth, getProfile);

module.exports = router;
