import express from 'express';
import crypto from 'crypto';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import SibApiV3Sdk from 'sib-api-v3-sdk';
import User from '../models/User.js';
import { forgotPassword, resetPassword } from '../controllers/authControllers.js';

const router = express.Router();

// ✅ Setup Brevo API client
const defaultClient = SibApiV3Sdk.ApiClient.instance;
defaultClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;
const brevoEmail = new SibApiV3Sdk.TransactionalEmailsApi();

// ✅ Forgot Password (via controller)
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

// ✅ Request password reset using Brevo API
router.post('/request-reset', async (req, res) => {
  const { email } = req.body;
  console.log('📨 Incoming reset request for:', email);

  if (!email) {
    return res.status(400).json({ message: 'Email is required' });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log('❌ User not found');
      return res.status(404).json({ message: 'User not found' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.resetToken = token;
    user.resetTokenExpiry = Date.now() + 3600000;
    await user.save();

    const resetLink = `https://stunning-torrone-705f39.netlify.app/reset-password/${token}`;

    const emailData = {
      sender: { name: 'Password Reset', email: '9aabb2001@smtp-brevo.com' },
      to: [{ email: user.email }],
      subject: 'Password Reset',
      htmlContent: `<p>Click <a href="${resetLink}">here</a> to reset your password.</p>`
    };

    await brevoEmail.sendTransacEmail(emailData);

    console.log('✅ Reset email sent via Brevo API');
    res.json({ message: 'Reset link sent to your email' });
  } catch (err) {
    console.error('🔥 Reset request error:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

export default router;