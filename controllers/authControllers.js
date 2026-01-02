import crypto from 'crypto';
import User from '../models/User.js';
import SibApiV3Sdk from 'sib-api-v3-sdk';

// ✅ Setup Brevo API client
const defaultClient = SibApiV3Sdk.ApiClient.instance;
defaultClient.authentications['api-key'].apiKey = process.env.BREVO_API_KEY;
const brevoEmail = new SibApiV3Sdk.TransactionalEmailsApi();

// ✅ Forgot Password
export async function forgotPassword(req, res) {
  const { email } = req.body;
  console.log("📨 Forgot password request received for:", email);

  try {
    const user = await User.findOne({ email });
    if (!user) {
      console.log("❌ User not found");
      return res.status(404).json({ message: 'User not found' });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    user.resetPasswordExpire = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetLink = `${process.env.CLIENT_URL}/reset-password/${resetToken}`;
    console.log("🔗 Reset link:", resetLink);

    // Send email via Brevo
    const emailData = {
      sender: { name: 'Password Reset', email: process.env.BREVO_SENDER },
      to: [{ email: user.email }],
      subject: 'Password Reset',
      htmlContent: `<p>Click <a href="${resetLink}">here</a> to reset your password.</p>`
    };

    await brevoEmail.sendTransacEmail(emailData);

    console.log("📤 Email sent to:", user.email);
    res.json({ message: 'Reset link sent to your email' });
  } catch (err) {
    console.error("🔥 Error in forgotPassword:", err);
    res.status(500).json({ message: 'Server error' });
  }
}

// ✅ Reset Password
export async function resetPassword(req, res) {
  const { token } = req.params;
  const { password } = req.body;
  console.log("🔒 Reset password request with token:", token);

  try {
    // Hash token to compare with DB
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() },
    });

    if (!user) {
      console.log("❌ Invalid or expired token");
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    // Update password
    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    await user.save();

    console.log("✅ Password updated for:", user.email);
    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error("🔥 Error in resetPassword:", err);
    res.status(500).json({ message: 'Server error' });
  }
}
