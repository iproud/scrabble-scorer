// Tile Validator - Enhanced tile placement validation with premium square tracking
class TileValidator {
    constructor(premiumSquareTracker) {
        this.premiumSquareTracker = premiumSquareTracker;
    }

    // Validate new tile placements against board state and premium squares
    validateNewPlacements(placements, boardState, boardLayout) {
        const validation = {
            valid: true,
            errors: [],
            warnings: [],
            tileConflicts: [],
            premiumSquareConflicts: [],
            validPlacements: [],
            invalidPlacements: []
        };

        for (const placement of placements) {
            if (!placement.isNew) {
                // Skip existing tiles
                continue;
            }

            const positionValidation = this.validateBoardPosition(placement, boardState);
            if (!positionValidation.valid) {
                validation.valid = false;
                validation.errors.push(positionValidation.error);
                validation.invalidPlacements.push(placement);
                continue;
            }

            const premiumValidation = this.validatePremiumSquareUsage(
                placement, 
                boardLayout, 
                validation.validPlacements
            );
            
            if (!premiumValidation.valid) {
                if (premiumValidation.isConflict) {
                    validation.premiumSquareConflicts.push(premiumValidation);
                } else {
                    validation.warnings.push(premiumValidation.message);
                }
            }

            validation.validPlacements.push(placement);
        }

        return validation;
    }

    // Validate individual board position
    validateBoardPosition(placement, boardState) {
        const { row, col } = placement;
        
        // Check bounds
        if (row < 0 || row >= 15 || col < 0 || col >= 15) {
            return {
                valid: false,
                error: `Placement (${row}, ${col}) is outside board boundaries`,
                placement
            };
        }

        // Check for existing tile
        if (boardState[row] && boardState[row][col]) {
            return {
                valid: false,
                error: `Position (${row}, ${col}) already contains tile "${boardState[row][col].letter}"`,
                placement
            };
        }

        return { valid: true };
    }

    // Validate premium square usage
    validatePremiumSquareUsage(placement, boardLayout, existingPlacements) {
        const { row, col } = placement;
        const bonus = boardLayout[row] && boardLayout[row][col];
        
        if (!bonus || !['DLS', 'TLS', 'DWS', 'TWS'].includes(bonus)) {
            return { valid: true };
        }

        const canUseBonus = this.premiumSquareTracker.canUsePremiumSquare(
            boardLayout,
            row,
            col,
            true
        );

        if (!canUseBonus.canUse) {
            // Check if this is a conflict with another new placement in the same turn
            const hasConflict = existingPlacements.some(existing => 
                existing.row === row && existing.col === col && existing.isNew
            );

            if (hasConflict) {
                return {
                    valid: false,
                    isConflict: true,
                    error: `Multiple new tiles cannot use the same premium square at (${row}, ${col})`,
                    placement,
                    bonus
                };
            } else {
                return {
                    valid: false,
                    message: `Premium square (${row}, ${col}) was already used in a previous turn`,
                    placement,
                    bonus
                };
            }
        }

        return { valid: true };
    }

    // Comprehensive validation for word placement
    validateWordPlacement(word, startRow, startCol, direction, boardState, boardLayout, blankIndices) {
        const validation = {
            valid: true,
            errors: [],
            warnings: [],
            placements: [],
            premiumSquaresUsed: [],
            scoreBreakdown: null
        };

        // Validate basic parameters
        if (!word || !word.length) {
            validation.valid = false;
            validation.errors.push("Word cannot be empty");
            return validation;
        }

        if (!['across', 'down'].includes(direction)) {
            validation.valid = false;
            validation.errors.push("Direction must be 'across' or 'down'");
            return validation;
        }

        if (startRow < 0 || startRow >= 15 || startCol < 0 || startCol >= 15) {
            validation.valid = false;
            validation.errors.push("Start position must be within board boundaries");
            return validation;
        }

        // Generate placement objects
        const placements = this.generatePlacements(
            word, 
            startRow, 
            startCol, 
            direction, 
            blankIndices,
            boardState
        );

        // Validate each placement
        const placementValidation = this.validateNewPlacements(
            placements, 
            boardState, 
            boardLayout
        );

        if (!placementValidation.valid) {
            validation.valid = false;
            validation.errors.push(...placementValidation.errors);
        }

        validation.placements = placementValidation.validPlacements;
        validation.warnings.push(...placementValidation.warnings);

        // Check if at least one new tile is placed
        const newTiles = placementValidation.validPlacements.filter(p => p.isNew);
        if (newTiles.length === 0) {
            validation.valid = false;
            validation.errors.push("At least one new tile must be placed");
        }

        return validation;
    }

    // Generate placement objects for a word
    generatePlacements(word, startRow, startCol, direction, blankIndices, boardState) {
        const placements = [];
        
        for (let i = 0; i < word.length; i++) {
            const letter = word[i];
            const row = direction === 'across' ? startRow : startRow + i;
            const col = direction === 'across' ? startCol + i : startCol;
            const isBlank = blankIndices.has(i);

            // Check if there's already a tile at this position
            const existingTile = boardState[row] && boardState[row][col];
            
            if (existingTile) {
                // This is an existing tile that's part of the word being extended
                placements.push({
                    row,
                    col,
                    letter: existingTile.letter,
                    isBlank: existingTile.isBlank,
                    wordIndex: i,
                    isNew: false, // This is an existing tile, not a new placement
                    actualLetter: existingTile.letter
                });
            } else {
                // No existing tile - this is a new tile placement
                if (isBlank && letter && letter !== 'BLANK') {
                    // This is a blank tile being used as the letter
                    placements.push({
                        row,
                        col,
                        letter,
                        isBlank: true,
                        wordIndex: i,
                        isNew: true, // New blank tile placement
                        actualLetter: letter,
                        displayLetter: letter // For UI purposes
                    });
                } else {
                    // New regular tile placement
                    placements.push({
                        row,
                        col,
                        letter,
                        isBlank: false,
                        wordIndex: i,
                        isNew: true // New tile placement
                    });
                }
            }
        }

        return placements;
    }

    // Check for tile conflicts with existing board state
    checkTileConflicts(placements, boardState) {
        const conflicts = [];
        
        for (const placement of placements) {
            if (!placement.isNew) continue;
            
            const { row, col } = placement;
            if (boardState[row] && boardState[row][col]) {
                conflicts.push({
                    placement,
                    existingTile: boardState[row][col],
                    error: `Position (${row}, ${col}) already occupied`
                });
            }
        }

        return conflicts;
    }

    // Get detailed breakdown of premium squares for a placement
    getPremiumSquareBreakdown(placements, boardLayout) {
        const breakdown = {
            premiumSquares: [],
            totalBonusValue: 0,
            letterBonuses: [],
            wordBonuses: []
        };

        for (const placement of placements) {
            if (!placement.isNew) continue;

            const { row, col } = placement;
            const bonus = boardLayout[row] && boardLayout[row][col];

            if (bonus && ['DLS', 'TLS', 'DWS', 'TWS'].includes(bonus)) {
                const bonusInfo = {
                    position: { row, col },
                    bonus,
                    tile: placement.letter,
                    canUse: this.premiumSquareTracker.canUsePremiumSquare(
                        boardLayout, 
                        row, 
                        col, 
                        true
                    ).canUse
                };

                breakdown.premiumSquares.push(bonusInfo);

                if (bonusInfo.canUse) {
                    if (['DLS', 'TLS'].includes(bonus)) {
                        breakdown.letterBonuses.push(bonusInfo);
                    } else {
                        breakdown.wordBonuses.push(bonusInfo);
                    }
                }
            }
        }

        return breakdown;
    }

    // Validate that premium squares are properly tracked across turns
    validatePremiumSquareIntegrity(boardState, turnHistory) {
        const integrity = {
            valid: true,
            issues: [],
            usedSquares: this.premiumSquareTracker.getUsedPremiumSquares(),
            debugInfo: this.premiumSquareTracker.getDebugInfo()
        };

        // Check if any premium squares on the board are not in the tracker
        for (let row = 0; row < 15; row++) {
            for (let col = 0; col < 15; col++) {
                const tile = boardState[row][col];
                if (tile) {
                    const bonus = this.premiumSquareTracker.getBonusType(
                        this.premiumSquareTracker.boardLayout, 
                        row, 
                        col
                    );
                    
                    if (bonus && ['DLS', 'TLS', 'DWS', 'TWS'].includes(bonus)) {
                        const isTracked = this.premiumSquareTracker.isPremiumSquareUsed(row, col);
                        if (!isTracked) {
                            integrity.issues.push({
                                type: 'untracked_premium',
                                position: { row, col },
                                tile: tile.letter,
                                bonus,
                                message: `Premium square at (${row}, ${col}) with tile "${tile.letter}" is not tracked`
                            });
                        }
                    }
                }
            }
        }

        integrity.valid = integrity.issues.length === 0;
        return integrity;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = TileValidator;
}

window.TileValidator = TileValidator;
