'use strict';

const nodemailer = require('nodemailer');
const emailConfig = require('../config/email');
const logger = require('../config/logger');

/**
 * Outbound email. Credentials live only in backend/.env — the browser holds no
 * mail configuration at all.
 */

let transporter = null;
let warnedMissingConfig = false;

function getTransporter() {
  if (transporter) return transporter;

  if (!emailConfig.isConfigured) {
    if (!warnedMissingConfig) {
      logger.warn('EMAIL_USER / EMAIL_PASS are not set — outbound email is disabled');
      warnedMissingConfig = true;
    }
    return null;
  }

  transporter = nodemailer.createTransport(emailConfig.transport);
  return transporter;
}

/**
 * Sends mail and reports success as a boolean instead of throwing. Callers treat
 * email as best-effort: a contact enquiry or a paid booking must never be lost
 * because the SMTP server was briefly unreachable.
 */
async function sendMail({ to, subject, html, text, replyTo }) {
  const mailer = getTransporter();
  if (!mailer || !to) return false;

  try {
    await mailer.sendMail({
      from: emailConfig.from,
      to,
      subject,
      text,
      html,
      ...(replyTo ? { replyTo } : {}),
    });
    return true;
  } catch (err) {
    logger.error('Failed to send email', { subject, error: err.message });
    return false;
  }
}

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function layout(title, rows, footer = '') {
  const body = rows
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== '')
    .map(
      ([label, value]) =>
        `<tr>
           <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;font-size:13px;white-space:nowrap;">${escapeHtml(label)}</td>
           <td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#111827;font-size:14px;font-weight:600;">${escapeHtml(value)}</td>
         </tr>`
    )
    .join('');

  return `<div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f8fafc;padding:24px;">
    <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
      <div style="background:#1e293b;padding:20px 24px;">
        <h1 style="margin:0;color:#fff;font-size:18px;font-weight:700;">${escapeHtml(title)}</h1>
      </div>
      <table style="width:100%;border-collapse:collapse;">${body}</table>
      ${footer ? `<div style="padding:16px 24px;color:#6b7280;font-size:13px;line-height:1.6;">${escapeHtml(footer)}</div>` : ''}
      <div style="padding:12px 24px;background:#f8fafc;border-top:1px solid #e2e8f0;color:#94a3b8;font-size:12px;">
        ${escapeHtml(emailConfig.appName)}
      </div>
    </div>
  </div>`;
}

function sendContactNotificationToAdmin(enquiry) {
  return sendMail({
    to: emailConfig.adminRecipient,
    // Reply goes to the enquirer, not to the notification mailbox.
    replyTo: enquiry.email || undefined,
    subject: `New booking enquiry: ${enquiry.eventName} — ${enquiry.name}`,
    html: layout('New Booking Enquiry', [
      ['Name', enquiry.name],
      ['Phone', enquiry.phone],
      ['Email', enquiry.email],
      ['Event', enquiry.eventName],
      ['Members', enquiry.members],
      ['Message', enquiry.message],
    ]),
    text: `New enquiry from ${enquiry.name} (${enquiry.phone}) about ${enquiry.eventName}`,
  });
}

function sendContactConfirmationToCustomer(enquiry) {
  if (!enquiry.email) return Promise.resolve(false);

  return sendMail({
    to: enquiry.email,
    subject: `We received your enquiry — ${emailConfig.appName}`,
    html: layout(
      `Thanks, ${enquiry.name}!`,
      [
        ['Event', enquiry.eventName],
        ['Your phone', enquiry.phone],
      ],
      'Our team has received your enquiry and will contact you shortly to discuss the details.'
    ),
    text: `Hi ${enquiry.name}, we received your enquiry about ${enquiry.eventName} and will contact you shortly.`,
  });
}

function sendBookingReceipt(booking, payment) {
  if (!booking.customer?.email) return Promise.resolve(false);

  return sendMail({
    to: booking.customer.email,
    subject: `Booking confirmed — ${booking.eventTitle} (${booking.reference})`,
    html: layout(
      'Booking Confirmed',
      [
        ['Reference', booking.reference],
        ['Event', booking.eventTitle],
        ['Tickets', booking.quantity],
        ['Amount paid', `${booking.currency} ${booking.totalAmount.toLocaleString('en-IN')}`],
        ['Receipt no.', payment?.receiptNumber],
        ['Payment ID', payment?.razorpayPaymentId],
      ],
      'Please keep this email — the reference number above is your proof of booking.'
    ),
    text: `Booking ${booking.reference} confirmed for ${booking.eventTitle}. Amount paid: ${booking.currency} ${booking.totalAmount}.`,
  });
}

module.exports = {
  sendMail,
  sendContactNotificationToAdmin,
  sendContactConfirmationToCustomer,
  sendBookingReceipt,
};
