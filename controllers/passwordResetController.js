/**
 * controllers/passwordResetController.js
 *
 * Handles the two-step password-reset flow:
 *   POST /api/auth/forgot-password          → forgotPassword
 *   POST /api/auth/reset-password/:token    → resetPassword
 *
 * Security:
 *  - Raw token is NEVER stored in DB — only its SHA-256 hash is saved.
 *  - Token expires in 15 minutes.
 *  - Existing JWT login/register logic is completely untouched.
 */

const crypto     = require("crypto");
const User       = require("../models/User");
const sendEmail  = require("../utils/sendEmail");

/* ── Helper: SHA-256 hash of a raw token ────────────────────────────────────── */
const hashToken = (rawToken) =>
  crypto.createHash("sha256").update(rawToken).digest("hex");

/* ── Reusable HTML email template ────────────────────────────────────────────── */
const buildResetEmailHTML = (resetUrl) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Password Reset</title>
</head>
<body style="margin:0;padding:0;background:#0f0f11;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f0f11;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="480" cellpadding="0" cellspacing="0"
          style="background:#1a1a2e;border-radius:16px;overflow:hidden;
                 border:1px solid rgba(139,92,246,0.25);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#6d28d9,#4f46e5);
                       padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;
                         letter-spacing:-0.5px;">
                🔐 Password Reset Request
              </h1>
              <p style="margin:8px 0 0;color:rgba(255,255,255,0.75);font-size:14px;">
                Neon Relay Chat
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px;">
              <p style="margin:0 0 16px;color:#c4c4d4;font-size:15px;line-height:1.6;">
                Hi there,
              </p>
              <p style="margin:0 0 24px;color:#c4c4d4;font-size:15px;line-height:1.6;">
                We received a request to reset the password for your account.
                Click the button below to choose a new password:
              </p>

              <!-- CTA Button -->
              <div style="text-align:center;margin:28px 0;">
                <a href="${resetUrl}"
                   style="display:inline-block;padding:14px 36px;
                          background:linear-gradient(135deg,#6d28d9,#4f46e5);
                          color:#fff;text-decoration:none;border-radius:10px;
                          font-size:15px;font-weight:600;letter-spacing:0.3px;">
                  Reset My Password
                </a>
              </div>

              <!-- Raw link fallback -->
              <p style="margin:0 0 8px;color:#8888aa;font-size:13px;">
                If the button doesn't work, copy and paste this link:
              </p>
              <p style="margin:0 0 28px;word-break:break-all;">
                <a href="${resetUrl}"
                   style="color:#818cf8;font-size:13px;text-decoration:underline;">
                  ${resetUrl}
                </a>
              </p>

              <!-- Warning -->
              <div style="background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.25);
                          border-radius:10px;padding:14px 16px;margin-bottom:24px;">
                <p style="margin:0;color:#fca5a5;font-size:13px;line-height:1.6;">
                  ⏱ This link will expire in <strong>15 minutes</strong>.<br/>
                  If you didn't request this, you can safely ignore this email —
                  your password will not change.
                </p>
              </div>

              <p style="margin:0;color:#555577;font-size:13px;">
                — The Neon Relay Chat Team
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#13131f;padding:18px 40px;text-align:center;
                       border-top:1px solid rgba(139,92,246,0.15);">
              <p style="margin:0;color:#444466;font-size:12px;">
                This email was sent automatically. Please do not reply.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

/* ── FORGOT PASSWORD ─────────────────────────────────────────────────────────── */

/**
 * forgotPassword
 * Body: { email }
 *
 * 1. Find user by email.
 * 2. Generate a cryptographically secure raw token (32 bytes → 64-char hex).
 * 3. Hash it and save hash + 15-min expiry to the user document.
 * 4. Send a branded HTML email with the reset link.
 */
const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email || typeof email !== "string") {
      return res.status(400).json({ error: "Please provide a valid email address." });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });

    // Return 200 regardless to prevent email enumeration.
    const genericMsg =
      "If an account with that email exists, a reset link has been sent. Check your inbox (and spam folder).";

    if (!user) {
      return res.status(200).json({ message: genericMsg });
    }

    // Generate raw token (goes to user), hash the one we store.
    const rawToken    = crypto.randomBytes(32).toString("hex");
    const hashedToken = hashToken(rawToken);

    user.resetPasswordToken  = hashedToken;
    user.resetPasswordExpire = new Date(Date.now() + 15 * 60 * 1000); // 15 min
    await user.save({ validateBeforeSave: false });

    const resetUrl = `${process.env.CLIENT_URL || "http://localhost:5173"}/reset-password/${rawToken}`;

    // ── Send email ─────────────────────────────────────────────────────────────
    try {
      await sendEmail({
        to:      user.email,
        subject: "Password Reset Request — Neon Relay Chat",
        html:    buildResetEmailHTML(resetUrl),
      });

      console.log(`[forgotPassword] Reset email sent to: ${user.email}`);
    } catch (emailError) {
      // Roll back the token if email sending fails so user can retry cleanly.
      user.resetPasswordToken  = null;
      user.resetPasswordExpire = null;
      await user.save({ validateBeforeSave: false });

      console.error("[forgotPassword] Email send failed:", emailError.message);
      return res.status(500).json({
        error:
          "Failed to send reset email. Please check server email configuration and try again.",
      });
    }

    return res.status(200).json({ message: genericMsg });
  } catch (error) {
    console.error("[forgotPassword] Unexpected error:", error.message);
    return res.status(500).json({ error: "Server error. Please try again." });
  }
};

/* ── RESET PASSWORD ──────────────────────────────────────────────────────────── */

/**
 * resetPassword
 * Params: { token }  — raw token from the email link
 * Body:   { password, confirmPassword }
 *
 * 1. Hash the incoming raw token.
 * 2. Find user whose stored hash matches AND whose expiry is still in the future.
 * 3. Validate new password strength (≥ 6 chars, letter + number).
 * 4. Update password — pre-save bcrypt hook in User.js handles hashing.
 * 5. Clear reset fields.
 */
const resetPassword = async (req, res) => {
  try {
    const { token }                     = req.params;
    const { password, confirmPassword } = req.body;

    if (!token) {
      return res.status(400).json({ error: "Reset token is missing." });
    }

    if (!password || !confirmPassword) {
      return res.status(400).json({ error: "Please provide and confirm your new password." });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ error: "Passwords do not match." });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters long." });
    }

    if (!/(?=.*[a-zA-Z])(?=.*\d)/.test(password)) {
      return res.status(400).json({
        error: "Password must contain at least one letter and one number.",
      });
    }

    // Hash incoming token and look for a matching, non-expired record.
    const hashedToken = hashToken(token);

    const user = await User.findOne({
      resetPasswordToken:  hashedToken,
      resetPasswordExpire: { $gt: new Date() },
    });

    if (!user) {
      return res.status(400).json({
        error: "Reset link is invalid or has expired. Please request a new one.",
      });
    }

    // Update password — the bcrypt pre-save hook in User.js handles hashing.
    user.password            = password;
    user.resetPasswordToken  = null;
    user.resetPasswordExpire = null;
    await user.save();

    console.log(`[resetPassword] Password reset successful for: ${user.email}`);

    return res.status(200).json({
      message: "Password reset successful. You can now log in with your new password.",
    });
  } catch (error) {
    console.error("[resetPassword] Error:", error.message);
    return res.status(500).json({ error: "Server error. Please try again." });
  }
};

module.exports = { forgotPassword, resetPassword };
