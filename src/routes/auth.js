// routes/auth.js
const express = require('express');
const router = express.Router();
const { body, validationResult } = require('express-validator');
const jwt = require('jsonwebtoken');
const User = require('../Model/user');
const Branch = require('../Model/branch');
const { authenticate } = require('../middleware/Auth');
const logger = require('../utils/loggers');

// Login
router.post(
  '/login',
  body('username').notEmpty().trim(),
  body('password').notEmpty(),
  async (req, res) => {
    try {
      console.log("LOGIN HIT");

      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          errors: errors.array()
        });
      }

      const { username, password } = req.body;

      console.log("Finding user...");
      const user = await User.findOne({ username });

      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      console.log("Comparing password...");
      const isPasswordValid = await user.comparePassword(password);

      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          error: 'Invalid credentials'
        });
      }

      console.log("Generating token...");

      const token = jwt.sign(
        {
          id: user._id,
          username: user.username,
          role: user.role,
          branchId: user.branchId
        },
        process.env.JWT_SECRET,
        {
          expiresIn: process.env.JWT_EXPIRE || '7d'
        }
      );

      res.json({
  success: true,
  token,
  user: {
    id: user._id,
    username: user.username,
    email: user.email,
    role: user.role,
    branchId: user.branchId
  }
});

    } catch (error) {
      console.error("LOGIN ERROR:", error);
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
);

// Get current user
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }
    
    let branchInfo = null;
    if (user.branchId) {
      branchInfo = await Branch.findById(user.branchId).select('name code address phone email posConfig');
    }
    
    res.json({
      success: true,
      data: {
        id: user._id,
        username: user.username,
        email: user.email,
        role: user.role,
        branch: branchInfo,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    logger.error('Get current user error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Change password
router.post('/change-password', authenticate, [
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, errors: errors.array() });
    }
    
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user.id);
    
    const isValid = await user.comparePassword(currentPassword);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Current password is incorrect' });
    }
    
    user.password = newPassword;
    await user.save();
    
    logger.info(`Password changed for user ${user.username}`);
    res.json({ success: true, message: 'Password changed successfully' });
  } catch (error) {
    logger.error('Change password error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Logout (client-side token removal, this endpoint is for logging)
router.post('/logout', authenticate, async (req, res) => {
  logger.info(`User ${req.user.username} logged out`);
  res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = router;