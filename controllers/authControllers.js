import crypto from 'crypto';
import User from '../models/User.js';
import nodemailer from 'nodemailer';

export async function forgotPassword(req, res) {
  const { email } = req.body;
  console.log("📨 Forgot password request received for:", email);

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log("❌ User not found");
      return res.status(404).json({ message: 'User not found' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    user.resetToken = token;
    user.resetTokenExpiry = Date.now() + 3600000;
    await user.save();
    console.log("✅ Token generated and saved:", token);

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    const resetLink = `${process.env.CLIENT_URL}/reset-password/${token}`;
    console.log("🔗 Reset link:", resetLink);

    await transporter.sendMail({
      to: user.email,
      subject: 'Password Reset',
      html: `<p>Click <a href="${resetLink}">here</a> to reset your password.</p>`,
    });

    console.log("📤 Email sent to:", user.email);
    res.json({ message: 'Reset link sent to your email' });
  } catch (err) {
    console.error("🔥 Error in forgotPassword:", err);
    res.status(500).json({ message: 'Server error' });
  }
}

export async function resetPassword(req, res) {
  const { token } = req.params;
  const { password } = req.body;
  console.log("🔒 Reset password request with token:", token);

  try {
    const user = await User.findOne({
      resetToken: token,
      resetTokenExpiry: { $gt: Date.now() },
    });

    if (!user) {
      console.log("❌ Invalid or expired token");
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    user.password = password;
    user.resetToken = undefined;
    user.resetTokenExpiry = undefined;
    await user.save();

    console.log("✅ Password updated for:", user.email);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error("🔥 Error in resetPassword:", err);
    res.status(500).json({ message: 'Server error' });
  }
}