const express = require('express');
const router = express.Router();
const User = require('../models/User');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const { Resend } = require('resend');

// ✅ Register
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  console.log('Incoming register request:', req.body);

  if (!username || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  try {
    const existing = await User.findOne({ email });
    if (existing) {
      console.log('Email already registered');
      return res.status(400).json({ message: 'Email already registered' });
    }

    const hashed = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashed });
    await user.save();

    console.log('User registered successfully');
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('Register error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ✅ Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  console.log('Incoming login request:', req.body);

  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found');
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const match = await bcrypt.compare(password, user.password);
    if (!match) {
      console.log('Password mismatch');
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
    console.log('Login successful');
    res.json({ message: 'Login successful', token });
  } catch (err) {
    console.error('Login error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ✅ Request password reset
router.post('/request-reset', async (req, res) => {
  const { email } = req.body;
  console.log('Incoming reset request for:', email);

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log('User not found');
      return res.status(404).json({ message: 'User not found' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.resetToken = token;
    user.resetTokenExpiry = Date.now() + 3600000;
    await user.save();

    const resetLink = `https://stunning-torrone-705f39.netlify.app/reset-password/${token}`;
    const resend = new Resend(process.env.RESEND_API_KEY);

    const { data, error } = await resend.emails.send({
      from: 'Gokulakrishna <onboarding@resend.dev>',
      to: user.email,
      subject: 'Password Reset',
      html: `<p>Click <a href="${resetLink}">here</a> to reset your password.</p>`,
    });

    if (error) {
      console.error('❌ Resend error:', error);
      return res.status(500).json({ message: 'Failed to send reset email' });
    }

    console.log('✅ Reset email sent via Resend:', data.id);
    res.json({ message: 'Reset link sent to your email' });
  } catch (err) {
    console.error('Reset request error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// ✅ Reset password
router.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  console.log('Incoming reset-password request:', token);

  if (!password) {
    return res.status(400).json({ message: 'New password is required' });
  }

  try {
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() }
    });

    if (!user) {
      console.log('Invalid or expired token');
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    console.log('Password reset successful');
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('Reset error:', err.message);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

module.exports = router;