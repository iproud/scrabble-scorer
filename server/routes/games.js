const express = require('express');
const { getDatabase } = require('../database/init');

const router = express.Router();

function canonicalizePlayerName(name) {
    return name
        .trim()
        .replace(/\s+/g, ' ')
        .split(' ')
        .filter(Boolean)
        .map(part => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
        .join(' ');
}

// GET /api/games - Get all games (completed and interrupted games for history)
router.get('/', (req, res) => {
    try {
        const db = getDatabase();
        
        const games = db.prepare(`
            SELECT 
                g.id,
                g.created_at,
                g.status,
                g.winner_id,
                w.name as winner_name,
                (SELECT COUNT(*) FROM turns WHERE game_id = g.id) as total_turns,
                (SELECT MAX(score) FROM turns WHERE game_id = g.id) as highest_score,
                (SELECT GROUP_CONCAT(p2.name) 
                 FROM game_players gp2 
                 JOIN players p2 ON gp2.player_id = p2.id 
                 WHERE gp2.game_id = g.id
                 ORDER BY gp2.turn_order) as player_names
            FROM games g
            LEFT JOIN players w ON g.winner_id = w.id
            ORDER BY g.created_at DESC
        `).all();
        
        db.close();
        res.json(games);
    } catch (error) {
        console.error('Error fetching games:', error);
        res.status(500).json({ error: 'Failed to fetch games' });
    }
});

// GET /api/games/:id - Get specific game details
router.get('/:id', (req, res) => {
    try {
        const db = getDatabase();
        const gameId = parseInt(req.params.id);
        
        // Get game info
        const game = db.prepare(`
            SELECT g.*, w.name as winner_name
            FROM games g
            LEFT JOIN players w ON g.winner_id = w.id
            WHERE g.id = ?
        `).get(gameId);
        
        if (!game) {
            db.close();
            return res.status(404).json({ error: 'Game not found' });
        }
        
        // Get players
        const players = db.prepare(`
            SELECT p.id, p.name, gp.score, gp.turn_order
            FROM game_players gp
            JOIN players p ON gp.player_id = p.id
            WHERE gp.game_id = ?
            ORDER BY gp.turn_order
        `).all(gameId);
        
        // Get turns
        const turns = db.prepare(`
            SELECT t.*, p.name as player_name
            FROM turns t
            JOIN players p ON t.player_id = p.id
            WHERE t.game_id = ?
            ORDER BY t.round_number, t.id
        `).all(gameId);
        
        // Parse JSON fields
        game.board_state = JSON.parse(game.board_state || '[]');
        turns.forEach(turn => {
            turn.secondary_words = JSON.parse(turn.secondary_words || '[]');
            turn.blank_tiles = JSON.parse(turn.blank_tiles || '[]');
            turn.board_state_after = JSON.parse(turn.board_state_after || '[]');
        });
        
        db.close();
        res.json({
            ...game,
            players,
            turns
        });
    } catch (error) {
        console.error('Error fetching game:', error);
        res.status(500).json({ error: 'Failed to fetch game' });
    }
});

// POST /api/games - Create new game
router.post('/', (req, res) => {
    try {
        const { playerNames } = req.body;
        
        if (!playerNames || !Array.isArray(playerNames) || playerNames.length < 2 || playerNames.length > 4) {
            return res.status(400).json({ error: 'Must provide 2-4 player names' });
        }
        
        const db = getDatabase();

        const normalizedNames = playerNames.map(name => canonicalizePlayerName(name));
        const seenNames = new Set();
        for (const normalized of normalizedNames) {
            const key = normalized.toLowerCase();
            if (seenNames.has(key)) {
                db.close();
                return res.status(400).json({ error: 'Player names must be unique (case-insensitive).' });
            }
            seenNames.add(key);
        }
        
        db.transaction(() => {
            // Create or get players
            const playerIds = [];
            const insertPlayer = db.prepare('INSERT INTO players (name) VALUES (?)');
            const getPlayerByLower = db.prepare('SELECT id, name FROM players WHERE LOWER(name) = LOWER(?)');
            
            normalizedNames.forEach(name => {
                let player = getPlayerByLower.get(name);
                
                if (!player) {
                    try {
                        insertPlayer.run(name);
                    } catch (error) {
                        if (error.code !== 'SQLITE_CONSTRAINT_UNIQUE') {
                            throw error;
                        }
                    }
                    player = getPlayerByLower.get(name);
                }
                
                playerIds.push(player.id);
            });
            
            // Create game
            const insertGame = db.prepare('INSERT INTO games (status) VALUES (?)');
            const gameResult = insertGame.run('active');
            const gameId = gameResult.lastInsertRowid;
            
            // Add players to game
            const insertGamePlayer = db.prepare('INSERT INTO game_players (game_id, player_id, turn_order) VALUES (?, ?, ?)');
            playerIds.forEach((playerId, index) => {
                insertGamePlayer.run(gameId, playerId, index);
            });
            
            // Get complete game data
            const game = db.prepare(`
                SELECT g.*, 
                       GROUP_CONCAT(p.name) as player_names
                FROM games g
                JOIN game_players gp ON g.id = gp.game_id
                JOIN players p ON gp.player_id = p.id
                WHERE g.id = ?
                GROUP BY g.id
            `).get(gameId);
            
            const players = db.prepare(`
                SELECT p.id, p.name, gp.score, gp.turn_order
                FROM game_players gp
                JOIN players p ON gp.player_id = p.id
                WHERE gp.game_id = ?
                ORDER BY gp.turn_order
            `).all(gameId);
            
            res.status(201).json({
                ...game,
                players,
                turns: []
            });
        })();
        
        db.close();
    } catch (error) {
        console.error('Error creating game:', error);
        res.status(500).json({ error: 'Failed to create game' });
    }
});

// POST /api/games/:id/turns - Submit a turn
router.post('/:id/turns', (req, res) => {
    try {
        const gameId = parseInt(req.params.id);
        const { 
            playerId, 
            word, 
            score, 
            secondaryWords = [], 
            boardState, 
            startRow, 
            startCol, 
            direction, 
            blankTiles = [] 
        } = req.body;
        
        if (!playerId || !word || score === undefined || !boardState || 
            startRow === undefined || startCol === undefined || !direction) {
            return res.status(400).json({ error: 'Missing required turn data' });
        }
        
        const db = getDatabase();

        db.transaction(() => {
            // Get the total number of players in the game
            const numPlayersResult = db.prepare('SELECT COUNT(*) as count FROM game_players WHERE game_id = ?').get(gameId);
            const numPlayers = numPlayersResult ? numPlayersResult.count : 0;

            if (numPlayers === 0) {
                throw new Error('No players found for this game.');
            }

            // Get the total number of turns already submitted for this game
            const totalTurnsResult = db.prepare('SELECT COUNT(*) as count FROM turns WHERE game_id = ?').get(gameId);
            const totalTurnsSubmitted = totalTurnsResult ? totalTurnsResult.count : 0;

            // Calculate the current round number
            // A round completes when all players have taken their turn.
            // For example, if 2 players:
            // 0 turns -> round 1
            // 1 turn -> round 1
            // 2 turns -> round 2
            // 3 turns -> round 2
            const roundNumber = Math.floor(totalTurnsSubmitted / numPlayers) + 1;

            // Insert turn
            const insertTurn = db.prepare(`
                INSERT INTO turns (
                    game_id, player_id, round_number, word, score, 
                    secondary_words, board_state_after, start_row, start_col, 
                    direction, blank_tiles
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `);

            insertTurn.run(
                gameId, playerId, roundNumber, word, score,
                JSON.stringify(secondaryWords), JSON.stringify(boardState),
                startRow, startCol, direction, JSON.stringify(blankTiles)
            );
            
            // Update player score
            const updateScore = db.prepare('UPDATE game_players SET score = score + ? WHERE game_id = ? AND player_id = ?');
            updateScore.run(score, gameId, playerId);
            
            // Update game board state
            const updateGame = db.prepare('UPDATE games SET board_state = ? WHERE id = ?');
            updateGame.run(JSON.stringify(boardState), gameId);
            
            res.json({ success: true, roundNumber });
        })();
        
        db.close();
    } catch (error) {
        console.error('Error submitting turn:', error);
        res.status(500).json({ error: 'Failed to submit turn' });
    }
});

// PUT /api/games/:id/status - Update game status (finish game)
router.put('/:id/status', (req, res) => {
    try {
        const gameId = parseInt(req.params.id);
        const { status, winnerId } = req.body;
        
        if (!status || !['active', 'finished', 'interrupted'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }
        
        const db = getDatabase();
        
        const updateGame = db.prepare('UPDATE games SET status = ?, winner_id = ? WHERE id = ?');
        updateGame.run(status, winnerId || null, gameId);
        
        db.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating game status:', error);
        res.status(500).json({ error: 'Failed to update game status' });
    }
});

// DELETE /api/games/:id - Delete a game
router.delete('/:id', (req, res) => {
    try {
        const gameId = parseInt(req.params.id);
        const db = getDatabase();
        
        db.transaction(() => {
            // Delete turns first (foreign key constraint)
            db.prepare('DELETE FROM turns WHERE game_id = ?').run(gameId);
            
            // Delete game_players
            db.prepare('DELETE FROM game_players WHERE game_id = ?').run(gameId);
            
            // Delete the game
            const result = db.prepare('DELETE FROM games WHERE id = ?').run(gameId);
            
            if (result.changes === 0) {
                throw new Error('Game not found');
            }
        })();
        
        db.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error deleting game:', error);
        if (error.message === 'Game not found') {
            res.status(404).json({ error: 'Game not found' });
        } else {
            res.status(500).json({ error: 'Failed to delete game' });
        }
    }
});

// PUT /api/games/:id/reinstate - Reinstate a game for continued play
router.put('/:id/reinstate', (req, res) => {
    try {
        const gameId = parseInt(req.params.id);
        const db = getDatabase();
        
        // Update game status to active
        const updateGame = db.prepare('UPDATE games SET status = ?, winner_id = NULL WHERE id = ?');
        const result = updateGame.run('active', gameId);
        
        if (result.changes === 0) {
            db.close();
            return res.status(404).json({ error: 'Game not found' });
        }
        
        db.close();
        res.json({ success: true });
    } catch (error) {
        console.error('Error reinstating game:', error);
        res.status(500).json({ error: 'Failed to reinstate game' });
    }
});

module.exports = router;
