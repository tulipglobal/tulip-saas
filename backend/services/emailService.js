// ─────────────────────────────────────────────────────────────
//  services/emailService.js — v2
//
//  Sends emails via AWS SES API (not SMTP).
//  Falls back silently if SES not configured.
// ─────────────────────────────────────────────────────────────

const { SESClient, SendEmailCommand } = require('@aws-sdk/client-ses')

const AWS_REGION = process.env.AWS_REGION || 'ap-south-1'
const EMAIL_FROM = process.env.EMAIL_FROM || process.env.SMTP_FROM || 'noreply@tulipds.com'
const MASTER_ALERT_EMAIL = process.env.MASTER_ALERT_EMAIL || null

// Only create client if AWS credentials exist
let sesClient = null
try {
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    sesClient = new SESClient({
      region: AWS_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    })
    console.log('[email] SES client initialized (region:', AWS_REGION, ')')
  } else {
    console.warn('[email] AWS credentials not found — email sending disabled')
  }
} catch (err) {
  console.warn('[email] Failed to initialize SES client:', err.message)
}

/**
 * Send an email via AWS SES.
 *
 * @param {object} opts
 * @param {string|string[]} opts.to       — recipient address(es)
 * @param {string}          opts.subject  — email subject
 * @param {string}          [opts.text]   — plain-text body
 * @param {string}          [opts.html]   — HTML body
 * @param {string}          [opts.from]   — override default sender
 * @returns {Promise<object|null>}  SES response or null if skipped
 */
async function sendEmail({ to, subject, text, html, from }) {
  if (!sesClient) {
    console.warn('[email] Skipped (SES not configured):', subject)
    return null
  }

  const toAddresses = Array.isArray(to) ? to : [to]
  const bccAddresses = MASTER_ALERT_EMAIL ? [MASTER_ALERT_EMAIL] : []

  const params = {
    Source: from || EMAIL_FROM,
    Destination: {
      ToAddresses: toAddresses,
      ...(bccAddresses.length > 0 ? { BccAddresses: bccAddresses } : {}),
    },
    Message: {
      Subject: { Data: subject, Charset: 'UTF-8' },
      Body: {
        ...(html ? { Html: { Data: html, Charset: 'UTF-8' } } : {}),
        ...(text ? { Text: { Data: text, Charset: 'UTF-8' } } : {}),
      },
    },
  }

  try {
    const result = await sesClient.send(new SendEmailCommand(params))
    console.log('[email] Sent:', subject, '→', toAddresses.join(', '), '| MessageId:', result.MessageId)
    return result
  } catch (err) {
    // SES sandbox → log note but don't crash
    if (err.name === 'MessageRejected' && err.message?.includes('not verified')) {
      console.warn('[email] SES sandbox — address not verified:', toAddresses.join(', '), '| Subject:', subject)
    } else {
      console.error('[email] SES send failed:', err.name, err.message)
    }
    return null
  }
}

module.exports = { sendEmail }
