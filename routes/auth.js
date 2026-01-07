const express = require('express');
const router = express.Router();
const User = require('../models/User');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const SibApiV3Sdk = require('sib-api-v3-sdk');

// ✅ Setup Brevo API
const defaultClient = SibApiV3Sdk.ApiClient.instance;
defaultClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;
const brevoEmail = new SibApiV3Sdk.TransactionalEmailsApi();

// ✅ Register
router.post('/register', async (req, res) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password) {
    return res.status(400).json({ message: 'All fields are required' });
  }
  if (password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }

  try {
    let user = await User.findOne({ email: email.toLowerCase() });
    if (user) return res.status(400).json({ message: 'Email already registered' });

    const hashed = await bcrypt.hash(password, 12);
    user = new User({ username, email: email.toLowerCase(), password: hashed });
    await user.save();

    console.log('✅ User registered:', email);
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    console.error('❌ Register error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '24h' });
    
    console.log('✅ Login successful:', email);
    res.json({ message: 'Login successful', token, user: { id: user._id, username: user.username, email: user.email } });
  } catch (err) {
    console.error('❌ Login error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// ✅ Request Password Reset - FIXED SENDER EMAIL
router.post('/request-reset', async (req, res) => {
  const { email } = req.body;
  console.log('📧 Reset request for:', email);
  
  if (!email) return res.status(400).json({ message: 'Email is required' });

  try {
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      console.log('⚠️ User not found');
      return res.json({ message: 'If an account exists, a reset link has been sent.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    user.resetToken = hashedToken;
    user.resetTokenExpiry = Date.now() + 3600000; // 1 hour
    await user.save({ validateBeforeSave: false });

    const resetLink = `${process.env.FRONTEND_URL || 'https://password-reset-frontend-prod.netlify.app'}/reset-password/${token}`;
    
    console.log('🔗 Reset link:', resetLink);

    // ✅ FIXED: Use verified sender email
    const sendSmtpEmail = {
      sender: { 
        name: 'Password Reset Team',
        email: 'gokulakrishna578@gmail.com'  // ✅ YOUR VERIFIED EMAIL
      },
      to: [{ 
        email: user.email,
        name: user.username 
      }],
      subject: 'Password Reset Request',
      htmlContent: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Password Reset Request</h2>
          <p>Hello ${user.username},</p>
          <p>You requested to reset your password. Click the button below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetLink}" 
               style="background-color: #2563eb; 
                      color: white; 
                      padding: 14px 28px; 
                      text-decoration: none; 
                      border-radius: 6px;
                      display: inline-block;
                      font-weight: bold;">
              Reset Password
            </a>
          </div>
          <p>Or copy this link: <a href="${resetLink}">${resetLink}</a></p>
          <p style="color: #666; margin-top: 30px;">This link expires in 1 hour.</p>
          <p style="color: #999; font-size: 12px;">If you didn't request this, ignore this email.</p>
        </div>
      `
    };

    await brevoEmail.sendTransacEmail(sendSmtpEmail);
    
    console.log('✅ Email sent via Brevo to:', email);
    res.json({ message: 'If an account exists, a reset link has been sent.' });
  } catch (err) {
    console.error('❌ Reset error:', err);
    console.error('Brevo error:', err.response ? err.response.body : err.message);
    res.status(500).json({ message: 'Unable to send reset email' });
  }
});

// ✅ Reset Password
router.post('/reset-password/:token', async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;
  
  console.log('🔄 Reset password attempt');
  
  if (!password || password.length < 8) {
    return res.status(400).json({ message: 'Password must be at least 8 characters' });
  }

  try {
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');
    const user = await User.findOne({ resetToken: hashedToken, resetTokenExpiry: { $gt: Date.now() } });
    
    if (!user) {
      console.log('❌ Invalid or expired token');
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    user.password = await bcrypt.hash(password, 12);
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    console.log('✅ Password reset successful for:', user.email);
    res.json({ message: 'Password reset successful' });
  } catch (err) {
    console.error('❌ Reset password error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;