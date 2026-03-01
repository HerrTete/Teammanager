'use strict';

const ical = require('ical-generator');

function generateEventICal(event) {
  const calendar = ical.default({ name: 'Teammanager' });

  const startDate = new Date(`${event.date}T${event.time || '00:00:00'}`);
  // Default 2-hour duration
  const endDate = new Date(startDate.getTime() + 2 * 60 * 60 * 1000);

  calendar.createEvent({
    start: startDate,
    end: endDate,
    summary: event.title,
    location: event.location_text || event.address || '',
    description: event.opponent ? `Gegner: ${event.opponent}` : '',
  });

  return calendar.toString();
}

module.exports = { generateEventICal };
