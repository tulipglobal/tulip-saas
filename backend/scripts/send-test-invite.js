#!/usr/bin/env node
// One-off script: send a test donor invite email to info@tulipglobal.org
// Usage: node scripts/send-test-invite.js
//
// Run this on the production server where SMTP credentials are configured.

require('dotenv').config()
const { sendEmail } = require('../services/emailService')

const inviteUrl = 'https://donor.tulipds.com/accept-invite?token=test-verification-token'
const orgName = 'Tulip Global Association'
const donorName = 'Gulf Foundation'
const agreementTitle = 'Test Email Button Fix'

async function main() {
  console.log('Sending test donor invite email to info@tulipglobal.org ...')

  const info = await sendEmail({
    to: 'info@tulipglobal.org',
    subject: `${orgName} has invited you to view verified records on Tulip DS`,
    text: `${orgName} has invited you (${donorName}) to view their verified financial records for "${agreementTitle}" on Tulip DS.\n\nAccept your invitation here:\n${inviteUrl}\n\nThis is a test email to verify the invite system is working.`,
    html: [
      '<div style="font-family:sans-serif;max-width:560px;margin:0 auto;padding:30px">',
      '<div style="text-align:center;margin-bottom:30px">',
      '<h1 style="color:#0c7aed;font-size:24px;margin:0">Tulip DS</h1>',
      '<p style="color:#64748b;font-size:13px;margin-top:4px">Verification Infrastructure</p>',
      '</div>',
      '<h2 style="color:#1e293b;font-size:20px">You\'ve been invited</h2>',
      '<p style="color:#475569;line-height:1.6">',
      `<strong>${orgName}</strong> has invited you (${donorName}) to view their verified financial records for <strong>${agreementTitle}</strong> on Tulip DS.`,
      '</p>',
      '<div style="text-align:center;margin:30px 0">',
      `<a href="${inviteUrl}" style="display:inline-block;padding:14px 28px;background-color:#0c7aed;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:600;font-size:15px">Accept Invitation</a>`,
      '</div>',
      `<p style="color:#475569;font-size:12px;text-align:center;margin-top:8px">Or copy this link: <a href="${inviteUrl}" style="color:#0c7aed;word-break:break-all">${inviteUrl}</a></p>`,
      '<p style="color:#94a3b8;font-size:13px">This is a <strong>test email</strong> to verify the donor invite system is working correctly.</p>',
      '<hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>',
      '<p style="color:#94a3b8;font-size:11px;text-align:center">Tulip DS</p>',
      '</div>'
    ].join('')
  })

  console.log('Email sent successfully!')
  console.log('Message ID:', info.messageId)
  console.log('Response:', info.response)
}

main().catch(err => {
  console.error('Failed to send email:', err.message)
  process.exit(1)
})
