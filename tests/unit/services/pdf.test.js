'use strict';

const { generateSchedulePDF, generateAttendanceListPDF } = require('../../../src/services/pdf');

describe('PDF Service', () => {
  test('generateSchedulePDF returns a Buffer', async () => {
    const games = [
      { title: 'Spiel 1', date: '2024-06-01', time: '18:00', opponent: 'FC Gegner', location_text: 'Stadion' },
    ];
    const buffer = await generateSchedulePDF(games, null);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test('generateSchedulePDF handles empty games list', async () => {
    const buffer = await generateSchedulePDF([], null);
    expect(Buffer.isBuffer(buffer)).toBe(true);
  });

  test('generateAttendanceListPDF returns a Buffer', async () => {
    const event = { title: 'Testspiel', date: '2024-06-01', time: '18:00' };
    const attendees = [
      { username: 'user1', status: 'accepted' },
      { username: 'user2', status: 'declined' },
    ];
    const buffer = await generateAttendanceListPDF(event, attendees, null);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(0);
  });
});
