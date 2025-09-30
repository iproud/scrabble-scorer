const express = require('express');
const { getDatabase } = require('../database/init');

const router = express.Router();

router.get('/', (req, res) => {
    try {
        const query = (req.query.query || '').trim();
        const limit = Math.min(parseInt(req.query.limit, 10) || 20, 50);

        const db = getDatabase();
        let players;

        if (query) {
            const pattern = `${query.toLowerCase()}%`;
            players = db.prepare(`
                SELECT id, name
                FROM players
                WHERE LOWER(name) LIKE ?
                ORDER BY name COLLATE NOCASE
                LIMIT ?
            `).all(pattern, limit);
        } else {
            players = db.prepare(`
                SELECT id, name
                FROM players
                ORDER BY name COLLATE NOCASE
                LIMIT ?
            `).all(limit);
        }

        db.close();
        res.json(players);
    } catch (error) {
        console.error('Error searching players:', error);
        res.status(500).json({ error: 'Failed to fetch players' });
    }
});

module.exports = router;
