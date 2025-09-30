-- Players table
CREATE TABLE IF NOT EXISTS players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT UNIQUE NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Games table
CREATE TABLE IF NOT EXISTS games (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    status TEXT DEFAULT 'active' CHECK (status IN ('active', 'finished', 'interrupted')),
    winner_id INTEGER,
    board_state TEXT DEFAULT '[]',
    FOREIGN KEY (winner_id) REFERENCES players(id)
);

-- Game players junction table
CREATE TABLE IF NOT EXISTS game_players (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    score INTEGER DEFAULT 0,
    turn_order INTEGER NOT NULL,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id),
    UNIQUE(game_id, player_id),
    UNIQUE(game_id, turn_order)
);

-- Turns table
CREATE TABLE IF NOT EXISTS turns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_id INTEGER NOT NULL,
    player_id INTEGER NOT NULL,
    round_number INTEGER NOT NULL,
    word TEXT NOT NULL,
    score INTEGER NOT NULL,
    secondary_words TEXT DEFAULT '[]',
    board_state_after TEXT NOT NULL,
    start_row INTEGER NOT NULL,
    start_col INTEGER NOT NULL,
    direction TEXT NOT NULL CHECK (direction IN ('across', 'down')),
    blank_tiles TEXT DEFAULT '[]',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (game_id) REFERENCES games(id) ON DELETE CASCADE,
    FOREIGN KEY (player_id) REFERENCES players(id)
);

-- Indexes for better performance
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);
CREATE INDEX IF NOT EXISTS idx_games_created_at ON games(created_at);
CREATE INDEX IF NOT EXISTS idx_game_players_game_id ON game_players(game_id);
CREATE INDEX IF NOT EXISTS idx_turns_game_id ON turns(game_id);
CREATE INDEX IF NOT EXISTS idx_turns_player_id ON turns(player_id);
CREATE INDEX IF NOT EXISTS idx_turns_round_number ON turns(game_id, round_number);
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_name_lower ON players(LOWER(name));
