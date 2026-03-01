'use strict';

describe('Email Service', () => {
  beforeEach(() => {
    jest.resetModules();
    delete process.env.SMTP_HOST;
  });

  test('getMailTransporter returns dev transporter when no SMTP_HOST', async () => {
    const { getMailTransporter } = require('../../../src/services/email');
    const transporter = await getMailTransporter();
    expect(transporter).toBeDefined();
    expect(typeof transporter.sendMail).toBe('function');
  });

  test('sendNotificationEmail sends via dev transporter', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const { sendNotificationEmail } = require('../../../src/services/email');
    const result = await sendNotificationEmail('test@example.com', 'Subject', 'Body');
    expect(result.messageId).toBe('dev-only');
    consoleSpy.mockRestore();
  });

  test('sendInvitation sends invitation email', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const { sendInvitation } = require('../../../src/services/email');
    const result = await sendInvitation('test@example.com', 'FC Test', 'Spieler', 'code123');
    expect(result.messageId).toBe('dev-only');
    consoleSpy.mockRestore();
  });

  test('sendAttendanceReminder sends reminder', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const { sendAttendanceReminder } = require('../../../src/services/email');
    const result = await sendAttendanceReminder('test@example.com', 'Testspiel', '2024-06-01');
    expect(result.messageId).toBe('dev-only');
    consoleSpy.mockRestore();
  });

  test('sendEscalation sends escalation email', async () => {
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    const { sendEscalation } = require('../../../src/services/email');
    const result = await sendEscalation('trainer@example.com', 'Testspiel', 'Max Mustermann');
    expect(result.messageId).toBe('dev-only');
    consoleSpy.mockRestore();
  });
});
