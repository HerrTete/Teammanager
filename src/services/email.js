'use strict';

const nodemailer = require('nodemailer');

let mailTransporter;

async function getMailTransporter() {
  if (mailTransporter) return mailTransporter;
  if (process.env.SMTP_HOST) {
    mailTransporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  } else {
    // Dev/test fallback: log to console
    mailTransporter = {
      sendMail: async (opts) => {
        console.log('[DEV] E-Mail would be sent:');
        console.log('  To:', opts.to);
        console.log('  Subject:', opts.subject);
        console.log('  Text:', opts.text);
        return { messageId: 'dev-only' };
      },
    };
  }
  return mailTransporter;
}

const FROM_ADDRESS = process.env.SMTP_FROM || 'Teammanager <no-reply@teammanager.local>';

async function sendNotificationEmail(to, subject, text) {
  const transporter = await getMailTransporter();
  return transporter.sendMail({ from: FROM_ADDRESS, to, subject, text });
}

async function sendInvitation(to, clubName, role, code) {
  const baseUrl = process.env.APP_URL || 'http://localhost:3000';
  const link = `${baseUrl}/invitation?code=${encodeURIComponent(code)}`;
  const text = `Sie wurden eingeladen, dem Verein "${clubName}" als ${role} beizutreten.\n\nKlicken Sie auf den folgenden Link, um die Einladung anzunehmen:\n${link}\n\nOder verwenden Sie den Code: ${code}`;
  return sendNotificationEmail(to, `Teammanager – Einladung zu ${clubName}`, text);
}

async function sendAttendanceReminder(to, eventTitle, eventDate) {
  const text = `Erinnerung: Bitte geben Sie Ihre Zu-/Absage für "${eventTitle}" am ${eventDate} ab.`;
  return sendNotificationEmail(to, `Teammanager – Erinnerung: ${eventTitle}`, text);
}

async function sendEscalation(to, eventTitle, playerName) {
  const text = `Eskalation: ${playerName} hat noch keine Rückmeldung für "${eventTitle}" gegeben.`;
  return sendNotificationEmail(to, `Teammanager – Eskalation: ${eventTitle}`, text);
}

module.exports = { getMailTransporter, sendNotificationEmail, sendInvitation, sendAttendanceReminder, sendEscalation };
