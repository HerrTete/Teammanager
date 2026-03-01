'use strict';

const express = require('express');
const { pool } = require('../db');
const { requireAuth, requireClubAccess, validateCsrf } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// Parse @mentions from message body and create notifications (scoped to club members)
async function processMentions(body, senderId, messageId, clubId) {
  if (!body || !messageId) return;
  const mentionRegex = /@(\w+)/g;
  let match;
  while ((match = mentionRegex.exec(body)) !== null) {
    const mentionedUsername = match[1];
    try {
      // Only match users who are members of the same club
      const [users] = await pool.execute(
        'SELECT u.id FROM users u INNER JOIN club_members cm ON cm.user_id = u.id WHERE u.username = ? AND cm.club_id = ?',
        [mentionedUsername, clubId]
      );
      if (users.length > 0 && users[0].id !== senderId) {
        await pool.execute(
          'INSERT INTO notifications (user_id, type, title, message, reference_type, reference_id) VALUES (?, ?, ?, ?, ?, ?)',
          [users[0].id, 'mention', 'Sie wurden erwähnt', `Sie wurden in einer Nachricht erwähnt.`, 'message', messageId]
        );
      }
    } catch (err) {
      console.error('Process mention error:', err.message);
    }
  }
}

// GET /api/clubs/:clubId/messages
router.get('/', requireAuth, requireClubAccess, async (req, res) => {
  try {
    const [messages] = await pool.execute(
      'SELECT m.id, m.sender_id, m.subject, m.body, m.target_type, m.target_id, m.parent_id, m.created_at, u.username AS sender_name FROM messages m INNER JOIN users u ON m.sender_id = u.id WHERE m.target_type = ? AND m.target_id = ? AND m.parent_id IS NULL ORDER BY m.created_at DESC LIMIT 100',
      ['club', req.params.clubId]
    );
    return res.json({ status: 'ok', messages });
  } catch (err) {
    console.error('List messages error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// POST /api/clubs/:clubId/messages
router.post('/', requireAuth, validateCsrf, requireClubAccess, async (req, res) => {
  const { subject, body, target_type, target_id } = req.body || {};
  if (!body || typeof body !== 'string' || body.trim().length === 0) {
    return res.status(400).json({ status: 'error', message: 'Nachrichtentext ist erforderlich.' });
  }
  const finalTargetType = target_type || 'club';
  const finalTargetId = target_id || req.params.clubId;
  const validTargetTypes = ['user', 'team', 'club', 'sport', 'game', 'training'];
  if (!validTargetTypes.includes(finalTargetType)) {
    return res.status(400).json({ status: 'error', message: 'Ungültiger Zieltyp.' });
  }
  try {
    const [result] = await pool.execute(
      'INSERT INTO messages (sender_id, subject, body, target_type, target_id) VALUES (?, ?, ?, ?, ?)',
      [req.session.userId, subject || null, body.trim(), finalTargetType, finalTargetId]
    );
    const messageId = result.insertId;

    // Create recipients based on target
    if (finalTargetType === 'user') {
      await pool.execute('INSERT INTO message_recipients (message_id, user_id) VALUES (?, ?)', [messageId, finalTargetId]);
    } else if (finalTargetType === 'team') {
      const [players] = await pool.execute('SELECT user_id FROM players WHERE team_id = ?', [finalTargetId]);
      const [trainers] = await pool.execute('SELECT user_id FROM team_trainers WHERE team_id = ?', [finalTargetId]);
      const userIds = new Set([...players.map(p => p.user_id), ...trainers.map(t => t.user_id)]);
      for (const uid of userIds) {
        if (uid !== req.session.userId) {
          await pool.execute('INSERT INTO message_recipients (message_id, user_id) VALUES (?, ?)', [messageId, uid]);
        }
      }
    } else if (finalTargetType === 'club') {
      const [members] = await pool.execute('SELECT user_id FROM club_members WHERE club_id = ?', [finalTargetId]);
      for (const m of members) {
        if (m.user_id !== req.session.userId) {
          await pool.execute('INSERT INTO message_recipients (message_id, user_id) VALUES (?, ?)', [messageId, m.user_id]);
        }
      }
    }

    await processMentions(body, req.session.userId, messageId, req.params.clubId);

    return res.status(201).json({ status: 'ok', messageId });
  } catch (err) {
    console.error('Send message error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// GET /api/clubs/:clubId/messages/:messageId
router.get('/:messageId', requireAuth, requireClubAccess, async (req, res) => {
  try {
    const [messages] = await pool.execute(
      'SELECT m.id, m.sender_id, m.subject, m.body, m.target_type, m.target_id, m.parent_id, m.created_at, u.username AS sender_name FROM messages m INNER JOIN users u ON m.sender_id = u.id WHERE m.id = ?',
      [req.params.messageId]
    );
    if (messages.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Nachricht nicht gefunden.' });
    }
    const [replies] = await pool.execute(
      'SELECT m.id, m.sender_id, m.body, m.created_at, u.username AS sender_name FROM messages m INNER JOIN users u ON m.sender_id = u.id WHERE m.parent_id = ? ORDER BY m.created_at',
      [req.params.messageId]
    );
    // Mark as read for current user
    await pool.execute(
      'UPDATE message_recipients SET is_read = TRUE WHERE message_id = ? AND user_id = ?',
      [req.params.messageId, req.session.userId]
    );
    return res.json({ status: 'ok', message: messages[0], replies });
  } catch (err) {
    console.error('Get message error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

// POST /api/clubs/:clubId/messages/:messageId/reply
router.post('/:messageId/reply', requireAuth, validateCsrf, requireClubAccess, async (req, res) => {
  const { body } = req.body || {};
  if (!body || typeof body !== 'string' || body.trim().length === 0) {
    return res.status(400).json({ status: 'error', message: 'Nachrichtentext ist erforderlich.' });
  }
  try {
    // Verify parent message exists
    const [parent] = await pool.execute('SELECT id, target_type, target_id FROM messages WHERE id = ?', [req.params.messageId]);
    if (parent.length === 0) {
      return res.status(404).json({ status: 'error', message: 'Nachricht nicht gefunden.' });
    }
    const [result] = await pool.execute(
      'INSERT INTO messages (sender_id, body, target_type, target_id, parent_id) VALUES (?, ?, ?, ?, ?)',
      [req.session.userId, body.trim(), parent[0].target_type, parent[0].target_id, req.params.messageId]
    );

    await processMentions(body, req.session.userId, result.insertId, req.params.clubId);

    return res.status(201).json({ status: 'ok', messageId: result.insertId });
  } catch (err) {
    console.error('Reply error:', err.message);
    return res.status(500).json({ status: 'error', message: 'Interner Serverfehler.' });
  }
});

module.exports = router;
