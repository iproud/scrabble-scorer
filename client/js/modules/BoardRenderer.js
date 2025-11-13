// Board Rendering Module
class BoardRenderer {
    constructor(boardContainer, gameState) {
        this.boardContainer = boardContainer;
        this.gameState = gameState;
    }

    // Main board rendering method
    renderBoard() {
        this.boardContainer.innerHTML = '';
        
        this.gameState.boardLayout.forEach((row, r_idx) => {
            row.forEach((bonus, c_idx) => {
                const cell = document.createElement('div');
                cell.dataset.row = r_idx;
                cell.dataset.col = c_idx;
                cell.classList.add('board-cell');
                
                const placedTile = this.gameState.boardState[r_idx][c_idx];

                if (placedTile) {
                    cell.classList.add('tile-placed');
                    const score = placedTile.isBlank ? 0 : (this.gameState.letterScores[placedTile.letter] || 0);
                    cell.innerHTML = `<span>${placedTile.letter}</span><span class="tile-score">${score}</span>`;
                } else {
                    if (bonus) cell.classList.add(bonus);
                    if (r_idx === 7 && c_idx === 7) cell.classList.add('center-star');
                    cell.innerHTML = '';
                }
                this.boardContainer.appendChild(cell);
            });
        });
    }

    // Update specific cell
    updateCell(row, col, tile) {
        const cell = this.getCellElement(row, col);
        if (!cell) return;

        if (tile) {
            cell.classList.add('tile-placed');
            const score = tile.isBlank ? 0 : (this.gameState.letterScores[tile.letter] || 0);
            cell.innerHTML = `<span>${tile.letter}</span><span class="tile-score">${score}</span>`;
        } else {
            cell.classList.remove('tile-placed');
            cell.innerHTML = '';
        }
    }

    // Get cell element by coordinates
    getCellElement(row, col) {
        return this.boardContainer.querySelector(`[data-row="${row}"][data-col="${col}"]`);
    }

    // Clear cell selection
    clearSelection() {
        document.querySelectorAll('.board-cell.selected').forEach(cell => {
            cell.classList.remove('selected');
        });
    }

    // Select cell
    selectCell(row, col) {
        this.clearSelection();
        const cell = this.getCellElement(row, col);
        if (cell) {
            cell.classList.add('selected');
        }
    }

    // Get selected cell
    getSelectedCell() {
        const selectedCell = this.boardContainer.querySelector('.board-cell.selected');
        if (!selectedCell) return null;
        
        return {
            row: parseInt(selectedCell.dataset.row, 10),
            col: parseInt(selectedCell.dataset.col, 10)
        };
    }

    // Add hover effects for debugging
    addHoverEffects() {
        const cells = this.boardContainer.querySelectorAll('.board-cell');
        cells.forEach(cell => {
            cell.addEventListener('mouseenter', (e) => {
                const row = parseInt(e.target.dataset.row, 10);
                const col = parseInt(e.target.dataset.col, 10);
                const bonus = this.gameState.boardLayout[row][col];
                
                if (bonus && !e.target.classList.contains('tile-placed')) {
                    e.target.title = `${bonus} - ${row}, ${col}`;
                }
            });
        });
    }

    // Remove hover effects
    removeHoverEffects() {
        const cells = this.boardContainer.querySelectorAll('.board-cell');
        cells.forEach(cell => {
            cell.removeEventListener('mouseenter', this.handleCellHover);
            cell.removeAttribute('title');
        });
    }

    // Handle cell hover
    handleCellHover = (event) => {
        const cell = event.target.closest('.board-cell');
        if (!cell) return;

        const row = parseInt(cell.dataset.row, 10);
        const col = parseInt(cell.dataset.col, 10);
        const bonus = this.gameState.boardLayout[row][col];
        const placedTile = this.gameState.boardState[row][col];

        if (placedTile) {
            // Show tile info for placed tiles
            cell.title = `Tile: ${placedTile.letter}${placedTile.isBlank ? ' (blank)' : ''} - Position: ${row},${col}`;
        } else if (bonus) {
            // Show bonus info for empty cells
            cell.title = `${bonus} - ${row},${col}`;
        }
    }

    // Enable board interactions
    enableInteractions() {
        this.boardContainer.style.pointerEvents = 'auto';
        this.addHoverEffects();
    }

    // Disable board interactions
    disableInteractions() {
        this.boardContainer.style.pointerEvents = 'none';
        this.removeHoverEffects();
    }

    // Highlight cells for validation
    highlightCells(cells, className = 'highlight') {
        // Clear existing highlights
        this.clearHighlights(className);
        
        cells.forEach(({row, col}) => {
            const cell = this.getCellElement(row, col);
            if (cell) {
                cell.classList.add(className);
            }
        });
    }

    // Clear cell highlights
    clearHighlights(className = 'highlight') {
        const highlighted = this.boardContainer.querySelectorAll(`.${className}`);
        highlighted.forEach(cell => cell.classList.remove(className));
    }

    // Highlight word placement area
    highlightWordPlacement(word, startRow, startCol, direction) {
        const cells = [];
        
        for (let i = 0; i < word.length; i++) {
            const row = direction === 'across' ? startRow : startRow + i;
            const col = direction === 'across' ? startCol + i : startCol;
            
            if (this.gameState.isValidBoardPosition(row, col)) {
                cells.push({row, col});
            }
        }
        
        this.highlightCells(cells, 'word-placement');
    }

    // Clear word placement highlight
    clearWordPlacementHighlight() {
        this.clearHighlights('word-placement');
    }

    // Show board coordinates for debugging
    showCoordinates() {
        const cells = this.boardContainer.querySelectorAll('.board-cell');
        cells.forEach(cell => {
            const row = cell.dataset.row;
            const col = cell.dataset.col;
            
            if (!cell.classList.contains('tile-placed')) {
                cell.innerHTML = `<small class="coord">${row},${col}</small>`;
            }
        });
    }

    // Hide board coordinates
    hideCoordinates() {
        const cells = this.boardContainer.querySelectorAll('.board-cell');
        cells.forEach(cell => {
            if (!cell.classList.contains('tile-placed')) {
                cell.innerHTML = '';
            }
        });
    }

    // Get board state for debugging
    getBoardState() {
        return this.gameState.boardState.map(row => [...row]);
    }

    // Validate board integrity
    validateBoardIntegrity() {
        const issues = [];
        
        for (let row = 0; row < 15; row++) {
            for (let col = 0; col < 15; col++) {
                const cell = this.getCellElement(row, col);
                const boardTile = this.gameState.boardState[row][col];
                
                if (!cell) {
                    issues.push(`Missing cell element at ${row},${col}`);
                    continue;
                }
                
                const hasTileClass = cell.classList.contains('tile-placed');
                const hasTile = boardTile !== null;
                
                if (hasTileClass !== hasTile) {
                    issues.push(`Tile display mismatch at ${row},${col}: class=${hasTileClass}, actual=${hasTile}`);
                }
                
                if (hasTile && !cell.querySelector('span')) {
                    issues.push(`Invalid tile display at ${row},${col}: missing letter span`);
                }
            }
        }
        
        return {
            valid: issues.length === 0,
            issues
        };
    }

    // Create board snapshot for debugging
    createSnapshot() {
        const snapshot = {
            timestamp: Date.now(),
            boardState: this.getBoardState(),
            html: this.boardContainer.innerHTML,
            validationResult: this.validateBoardIntegrity()
        };
        
        console.log('Board snapshot created:', snapshot);
        return snapshot;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BoardRenderer;
}
