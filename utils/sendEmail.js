/**
 * utils/sendEmail.js
 *
 * Reusable Nodemailer email sender configured for Gmail SMTP.
 *
 * Requires in .env:
 *   EMAIL_USER  — your Gmail address
 *   EMAIL_PASS  — your Gmail App Password (16 chars, NOT your normal password)
 *
 * How to get an App Password:
 *   Google Account → Security → 2-Step Verification → App passwords → Mail
 *
 * Usage:
 *   await sendEmail({
 *     to:      "recipient@example.com",
 *     subject: "Hello",
 *     html:    "<p>Message body</p>",
 *   });
 */

const nodemailer = require("nodemailer");

/**
 * sendEmail
 * @param {object} options
 * @param {string} options.to      — recipient email address
 * @param {string} options.subject — email subject line
 * @param {string} options.html    — HTML email body
 * @returns {Promise<object>}      — Nodemailer info object
 */
const sendEmail = async ({ to, subject, html }) => {
  // ── Validate config at call-time so mistakes surface early ────────────────
  if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
    throw new Error(
      "Email credentials missing. Set EMAIL_USER and EMAIL_PASS in your .env file."
    );
  }

  // ── Create transporter ─────────────────────────────────────────────────────
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // Gmail App Password
    },
  });

  // ── Mail options ───────────────────────────────────────────────────────────
  const mailOptions = {
    from: `"Neon Relay Chat" <${process.env.EMAIL_USER}>`,
    to,
    subject,
    html,
  };

  // ── Send ───────────────────────────────────────────────────────────────────
  const info = await transporter.sendMail(mailOptions);
  console.log(`[sendEmail] Message sent to ${to} — ID: ${info.messageId}`);
  return info;
};

module.exports = sendEmail;
