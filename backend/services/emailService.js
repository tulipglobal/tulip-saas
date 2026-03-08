// ─────────────────────────────────────────────────────────────
//  services/emailService.js — v1
//
//  Sends emails via AWS SES SMTP using nodemailer.
// ─────────────────────────────────────────────────────────────

const nodemailer = require('nodemailer')

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

/**
 * Send an email.
 *
 * @param {object} opts
 * @param {string}          opts.to       — recipient address
 * @param {string}          opts.subject  — email subject
 * @param {string}          [opts.text]   — plain-text body
 * @param {string}          [opts.html]   — HTML body
 * @param {string}          [opts.from]   — override default sender
 * @returns {Promise<object>}  nodemailer info object
 */
async function sendEmail({ to, subject, text, html, from }) {
  const info = await transporter.sendMail({
    from:    from || process.env.SMTP_FROM || 'noreply@tulipglobal.org',
    to,
    subject,
    text,
    html,
  })
  return info
}

module.exports = { sendEmail, transporter }
