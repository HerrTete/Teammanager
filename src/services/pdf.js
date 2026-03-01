'use strict';

const PDFDocument = require('pdfkit');

function generateSchedulePDF(games, clubLogo) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    if (clubLogo) {
      try {
        doc.image(clubLogo, 50, 30, { width: 60 });
        doc.moveDown(4);
      } catch (_e) { /* skip logo on error */ }
    }

    doc.fontSize(18).text('Spielplan', { align: 'center' });
    doc.moveDown();

    if (!games || games.length === 0) {
      doc.fontSize(12).text('Keine Spiele vorhanden.');
    } else {
      games.forEach((game) => {
        doc.fontSize(12).text(`${game.date || ''} ${game.time || ''} - ${game.title}`, { underline: true });
        if (game.opponent) doc.fontSize(10).text(`Gegner: ${game.opponent}`);
        if (game.location_text) doc.fontSize(10).text(`Ort: ${game.location_text}`);
        doc.moveDown(0.5);
      });
    }

    doc.end();
  });
}

function generateAttendanceListPDF(event, attendees, clubLogo) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const buffers = [];
    doc.on('data', (chunk) => buffers.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(buffers)));
    doc.on('error', reject);

    if (clubLogo) {
      try {
        doc.image(clubLogo, 50, 30, { width: 60 });
        doc.moveDown(4);
      } catch (_e) { /* skip logo on error */ }
    }

    doc.fontSize(18).text(`Anwesenheitsliste: ${event.title}`, { align: 'center' });
    doc.fontSize(12).text(`Datum: ${event.date || ''} ${event.time || ''}`, { align: 'center' });
    doc.moveDown();

    if (!attendees || attendees.length === 0) {
      doc.fontSize(12).text('Keine Teilnehmer.');
    } else {
      attendees.forEach((a, i) => {
        doc.fontSize(11).text(`${i + 1}. ${a.username || a.name || 'Unbekannt'} - ${a.status || 'pending'}`);
      });
    }

    doc.end();
  });
}

module.exports = { generateSchedulePDF, generateAttendanceListPDF };
