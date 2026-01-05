// Server-side Game Logic Service
// Ported from client/js/game-state.js to ensure authoritative server state

const LETTER_SCORES = {
    'A': 1, 'B': 3, 'C': 3, 'D': 2, 'E': 1, 'F': 4, 'G': 2, 'H': 4, 'I': 1, 'J': 8,
    'K': 5, 'L': 1, 'M': 3, 'N': 1, 'O': 1, 'P': 3, 'Q': 10, 'R': 1, 'S': 1, 'T': 1,
    'U': 1, 'V': 4, 'W': 4, 'X': 8, 'Y': 4, 'Z': 10
};

const BOARD_LAYOUT = [
    ['TWS', '', '', 'DLS', '', '', '', 'TWS', '', '', '', 'DLS', '', '', 'TWS'],
    ['', 'DWS', '', '', '', 'TLS', '', '', '', 'TLS', '', '', '', 'DWS', ''],
    ['', '', 'DWS', '', '', '', 'DLS', '', 'DLS', '', '', '', 'DWS', '', ''],
    ['DLS', '', '', 'DWS', '', '', '', 'DLS', '', '', '', 'DWS', '', '', 'DLS'],
    ['', '', '', '', 'DWS', '', '', '', '', '', 'DWS', '', '', '', ''],
    ['', 'TLS', '', '', '', 'TLS', '', '', '', 'TLS', '', '', '', 'TLS', ''],
    ['', '', 'DLS', '', '', '', 'DLS', '', 'DLS', '', '', '', 'DLS', '', ''],
    ['TWS', '', '', 'DLS', '', '', '', 'DWS', '', '', '', 'DLS', '', '', 'TWS'],
    ['', '', 'DLS', '', '', '', 'DLS', '', 'DLS', '', '', '', 'DLS', '', ''],
    ['', 'TLS', '', '', '', 'TLS', '', '', '', 'TLS', '', '', '', 'TLS', ''],
    ['', '', '', '', 'DWS', '', '', '', '', '', 'DWS', '', '', '', ''],
    ['DLS', '', '', 'DWS', '', '', '', 'DLS', '', '', '', 'DWS', '', '', 'DLS'],
    ['', '', 'DWS', '', '', '', 'DLS', '', 'DLS', '', '', '', 'DWS', '', ''],
    ['', 'DWS', '', '', '', 'TLS', '', '', '', 'TLS', '', '', '', 'DWS', ''],
    ['TWS', '', '', 'DLS', '', '', '', 'TWS', '', '', '', 'DLS', '', '', 'TWS']
];

function isValidBoardPosition(row, col) {
    return Number.isInteger(row) && Number.isInteger(col) &&
        row >= 0 && row < 15 && col >= 0 && col < 15;
}

function createSafeBoardCopy(boardState) {
    if (!boardState || !Array.isArray(boardState) || boardState.length !== 15) {
        return Array(15).fill(null).map(() => Array(15).fill(null));
    }
    return boardState.map(row => Array.isArray(row) ? [...row] : Array(15).fill(null));
}

function identifyNewPlacements(word, startRow, startCol, direction, blankIndices, boardState) {
    const placements = [];
    // Normalize blankIndices to Set
    const blankSet = new Set(Array.isArray(blankIndices) ? blankIndices : []);

    for (let i = 0; i < word.length; i++) {
        const letter = word[i];
        const row = direction === 'across' ? startRow : startRow + i;
        const col = direction === 'across' ? startCol + i : startCol;

        if (!isValidBoardPosition(row, col)) {
            continue;
        }

        const existingTile = boardState[row][col];
        const isBlank = blankSet.has(i);

        if (existingTile) {
            placements.push({
                row,
                col,
                letter: existingTile.letter,
                isBlank: existingTile.isBlank,
                wordIndex: i,
                isNew: false,
                actualLetter: existingTile.letter
            });
        } else {
            placements.push({
                row,
                col,
                letter,
                isBlank: isBlank, // Is this tile *being played* as a blank?
                wordIndex: i,
                isNew: true,
                actualLetter: letter
            });
        }
    }
    return placements;
}

function findPrimaryWord(newPlacements, direction, boardState) {
    if (newPlacements.length === 0) return null;

    // Create temp board with ONLY new placements added to existing state
    // We don't want to modify the actual boardState passed in
    const tempBoard = createSafeBoardCopy(boardState);
    for (const p of newPlacements) {
        if (p.isNew) {
            tempBoard[p.row][p.col] = { letter: p.letter, isBlank: p.isBlank };
        }
    }

    // Determine fixed coordinate
    const fixedCoord = direction === 'across' ? newPlacements[0].row : newPlacements[0].col;

    // Find min and max coords of *placed* tiles
    let minCoord = 14, maxCoord = 0;
    for (const p of newPlacements) {
        const c = direction === 'across' ? p.col : p.row;
        if (c < minCoord) minCoord = c;
        if (c > maxCoord) maxCoord = c;
    }

    // Scan backwards
    let startCoord = minCoord;
    while (startCoord > 0) {
        const r = direction === 'across' ? fixedCoord : startCoord - 1;
        const c = direction === 'across' ? startCoord - 1 : fixedCoord;
        if (tempBoard[r][c]) {
            startCoord--;
        } else {
            break;
        }
    }

    // Scan forwards
    let endCoord = maxCoord;
    while (endCoord < 14) {
        const r = direction === 'across' ? fixedCoord : endCoord + 1;
        const c = direction === 'across' ? endCoord + 1 : fixedCoord;
        if (tempBoard[r][c]) {
            endCoord++;
        } else {
            break;
        }
    }

    // Collect tiles
    const tiles = [];
    for (let c = startCoord; c <= endCoord; c++) {
        const r = direction === 'across' ? fixedCoord : c;
        const col = direction === 'across' ? c : fixedCoord;
        const tile = tempBoard[r][col];
        if (tile) {
            // Check if this tile is one of the new ones
            const isNew = newPlacements.some(p => p.row === r && p.col === col && p.isNew);
            tiles.push({
                row: r,
                col: col,
                letter: tile.letter,
                isBlank: tile.isBlank,
                isNew
            });
        }
    }

    const word = tiles.map(t => t.letter).join('');
    return {
        word,
        direction,
        startRow: direction === 'across' ? fixedCoord : startCoord,
        startCol: direction === 'across' ? startCoord : fixedCoord,
        tiles,
        isPrimary: true
    };
}

function findSecondaryWord(placement, primaryDirection, boardState) {
    const direction = primaryDirection === 'across' ? 'down' : 'across';
    const fixedCoord = direction === 'across' ? placement.row : placement.col;
    const variableCoord = direction === 'across' ? placement.col : placement.row;

    // Create temp board with just this placement (and existing)
    // Actually we need ALL new placements to be on board to strictly mimic client?
    // But usually secondary words are perpendicular to primary, crossing ONE new tile.
    // If we have parallel play, multiple new tiles might be adjacent.
    // Let's assume passed boardState is CLEAN (without this turn), so we temporarily place this tile.

    const tempBoard = createSafeBoardCopy(boardState);
    tempBoard[placement.row][placement.col] = { letter: placement.letter, isBlank: placement.isBlank };

    // Scan backwards
    let startCoord = variableCoord;
    while (startCoord > 0) {
        const r = direction === 'across' ? fixedCoord : startCoord - 1;
        const c = direction === 'across' ? startCoord - 1 : fixedCoord;
        if (tempBoard[r][c]) {
            startCoord--;
        } else {
            break;
        }
    }

    // Scan forwards
    let endCoord = variableCoord;
    while (endCoord < 14) {
        const r = direction === 'across' ? fixedCoord : endCoord + 1;
        const c = direction === 'across' ? endCoord + 1 : fixedCoord;
        if (tempBoard[r][c]) {
            endCoord++;
        } else {
            break;
        }
    }

    // If word length is 1, it's not a word (just the single tile)
    if (startCoord === endCoord) return null;

    const tiles = [];
    for (let c = startCoord; c <= endCoord; c++) {
        const r = direction === 'across' ? fixedCoord : c;
        const col = direction === 'across' ? c : fixedCoord;
        const tile = tempBoard[r][col];
        tiles.push({
            row: r,
            col: col,
            letter: tile.letter,
            isBlank: tile.isBlank,
            isNew: (r === placement.row && col === placement.col) // Only this one is new in this context?
            // Wait, if parallel play, other new tiles might be in this word.
            // But for simplicity/robustness, we can check coordinates against known new placements if deeper logic is needed.
            // For scoring, we just need to know if it's new (to trigger multipliers).
            // We'll mark the tile at placement.row/col as new. Existing ones are old.
        });
    }

    return {
        word: tiles.map(t => t.letter).join(''),
        direction,
        startRow: direction === 'across' ? fixedCoord : startCoord,
        startCol: direction === 'across' ? startCoord : fixedCoord,
        tiles,
        isPrimary: false
    };
}

function calculateWordScore(wordData, newPlacements) {
    let score = 0;
    let wordMultiplier = 1;

    for (const tile of wordData.tiles) {
        // Find if this tile corresponds to a new placement to apply premium squares
        const newPlacement = newPlacements.find(p => p.row === tile.row && p.col === tile.col && p.isNew);

        let letterScore = tile.isBlank ? 0 : (LETTER_SCORES[tile.letter] || 0);

        if (newPlacement) {
            // It's a new tile, check for premium squares
            const premium = BOARD_LAYOUT[tile.row][tile.col];
            if (premium === 'DLS') letterScore *= 2;
            if (premium === 'TLS') letterScore *= 3;
            if (premium === 'DWS') wordMultiplier *= 2;
            if (premium === 'TWS') wordMultiplier *= 3;
        }

        score += letterScore;
    }

    return score * wordMultiplier;
}

function calculateTurn(word, startRow, startCol, direction, blankIndices, boardState) {
    const newPlacements = identifyNewPlacements(word, startRow, startCol, direction, blankIndices, boardState);

    if (newPlacements.length === 0) {
        return { error: 'No new tiles placed' };
    }

    // Primary Word
    const primaryWord = findPrimaryWord(newPlacements, direction, boardState);
    if (!primaryWord) {
        return { error: 'No primary word formed' };
    }

    let totalScore = 0;
    const scoredWords = [];

    // Score Primary
    const pScore = calculateWordScore(primaryWord, newPlacements);
    totalScore += pScore;
    scoredWords.push({ ...primaryWord, score: pScore });

    // Secondary Words
    for (const p of newPlacements) {
        if (p.isNew) {
            const sWord = findSecondaryWord(p, direction, boardState);
            if (sWord) {
                const sScore = calculateWordScore(sWord, newPlacements);
                totalScore += sScore;
                scoredWords.push({ ...sWord, score: sScore });
            }
        }
    }

    // Bingo
    const placedCount = newPlacements.filter(p => p.isNew).length;
    if (placedCount === 7) {
        totalScore += 50;
    }

    // Generate New Board State
    const newBoardState = createSafeBoardCopy(boardState);
    for (const p of newPlacements) {
        if (p.isNew) {
            newBoardState[p.row][p.col] = { letter: p.letter, isBlank: p.isBlank };
        }
    }

    return {
        score: totalScore,
        boardState: newBoardState,
        scoredWords,
        placedCount
    };
}

module.exports = {
    calculateTurn,
    isValidBoardPosition
};
