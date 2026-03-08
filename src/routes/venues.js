'use strict';

const express = require('express');
const venueRepository = require('../repositories/venueRepository');
const { requireAuth, requireRole, requireClubAccess, validateCsrf } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// GET /api/clubs/:clubId/venues
router.get('/', requireAuth, requireClubAccess, async (req, res) => {
  try {
    const venues = await venueRepository.findVenuesByClubId(req.params.clubId);
    return res.json({ status: 'ok', venues });
  } catch (err) {
    console.error('List venues error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// POST /api/clubs/:clubId/venues
router.post('/', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin']), async (req, res) => {
  const { name, zip_code, street, house_number, city, link, google_maps_link } = req.body || {};
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ status: 'error', message: 'Name ist erforderlich.' });
  }
  try {
    const result = await venueRepository.createVenue(req.params.clubId, {
      name: name.trim(),
      zip_code,
      street,
      house_number,
      city,
      link,
      google_maps_link,
    });
    return res.status(201).json({ status: 'ok', venueId: result.insertId });
  } catch (err) {
    console.error('Create venue error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// PUT /api/clubs/:clubId/venues/:venueId
router.put('/:venueId', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin']), async (req, res) => {
  const { name, zip_code, street, house_number, city, link, google_maps_link } = req.body || {};
  if (!name || typeof name !== 'string' || name.trim().length === 0) {
    return res.status(400).json({ status: 'error', message: 'Name ist erforderlich.' });
  }
  try {
    const result = await venueRepository.updateVenue(req.params.venueId, {
      name: name.trim(),
      zip_code,
      street,
      house_number,
      city,
      link,
      google_maps_link,
    }, req.params.clubId);
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Spielstätte nicht gefunden.' });
    }
    return res.json({ status: 'ok', message: 'Spielstätte aktualisiert.' });
  } catch (err) {
    console.error('Update venue error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// DELETE /api/clubs/:clubId/venues/:venueId
router.delete('/:venueId', requireAuth, validateCsrf, requireClubAccess, requireRole(['PortalAdmin', 'VereinsAdmin']), async (req, res) => {
  try {
    const result = await venueRepository.deleteVenue(req.params.venueId, req.params.clubId);
    if (result.affectedRows === 0) {
      return res.status(404).json({ status: 'error', message: 'Spielstätte nicht gefunden.' });
    }
    return res.json({ status: 'ok', message: 'Spielstätte gelöscht.' });
  } catch (err) {
    console.error('Delete venue error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

module.exports = router;
