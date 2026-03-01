'use strict';

const { generateEventICal } = require('../../../src/services/ical');

describe('iCal Service', () => {
  test('generates valid iCal string', () => {
    const event = {
      title: 'Testspiel',
      date: '2024-06-15',
      time: '18:00:00',
      location_text: 'Stadion',
      opponent: 'FC Gegner',
    };
    const result = generateEventICal(event);
    expect(result).toContain('BEGIN:VCALENDAR');
    expect(result).toContain('Testspiel');
    expect(result).toContain('END:VCALENDAR');
  });

  test('handles event without time', () => {
    const event = { title: 'Training', date: '2024-06-15' };
    const result = generateEventICal(event);
    expect(result).toContain('BEGIN:VCALENDAR');
    expect(result).toContain('Training');
  });
});
