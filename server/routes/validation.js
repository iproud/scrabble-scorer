const express = require('express');
const fs = require('fs');
const path = require('path');
const { getSpellChecker, reloadDictionary } = require('../services/dictionaryLoader');
const dictionaryManager = require('../services/dictionaryManager');

const router = express.Router();

// Dictionary setup
let dictionaryLoaded = false;

function loadActiveDictionary() {
    const { loaded } = getSpellChecker();
    dictionaryLoaded = loaded;
    if (!loaded) {
        console.warn('📚 No active dictionary loaded. Word validation disabled until a dictionary is installed.');
    }
}

loadActiveDictionary();

// Helper function to check if a word is valid
function isValidWord(word) {
    const { spell, loaded } = getSpellChecker();
    if (!loaded || !spell) {
        // If dictionary not loaded, return true (validation disabled)
        return true;
    }
    
    const cleanWord = word.toUpperCase().trim();
    
    // Check basic word requirements
    if (!cleanWord || cleanWord.length === 0) {
        return false;
    }
    
    // Check if word contains only letters
    if (!/^[A-Z]+$/.test(cleanWord)) {
        return false;
    }
    
    // Use nspell to check the word
    return spell.correct(cleanWord);
}

// POST /api/validation/word - Validate a single word
router.post('/word', async (req, res) => {
    try {
        const { word } = req.body;
        
        if (!word || typeof word !== 'string') {
            return res.status(400).json({ error: 'Word is required' });
        }
        
        const upperWord = word.toUpperCase().trim();
        const isValid = isValidWord(upperWord);
        
        res.json({ 
            word: upperWord, 
            valid: isValid,
            dictionaryEnabled: dictionaryLoaded
        });
    } catch (error) {
        console.error('Error validating word:', error);
        res.status(500).json({ error: 'Failed to validate word' });
    }
});

// POST /api/validation/words - Validate multiple words
router.post('/words', async (req, res) => {
    try {
        const { words } = req.body;
        
        if (!words || !Array.isArray(words)) {
            return res.status(400).json({ error: 'Words array is required' });
        }
        
        const results = words.map(word => {
            const upperWord = word.toUpperCase().trim();
            return {
                word: upperWord,
                valid: isValidWord(upperWord)
            };
        });
        
        const invalidWords = results
            .filter(result => !result.valid)
            .map(result => result.word);
        
        const allValid = invalidWords.length === 0;
        
        res.json({ 
            results,
            allValid,
            invalidWords,
            dictionaryEnabled: dictionaryLoaded
        });
    } catch (error) {
        console.error('Error validating words:', error);
        res.status(500).json({ error: 'Failed to validate words' });
    }
});

// POST /api/validation/turn - Validate a complete turn
router.post('/turn', async (req, res) => {
    try {
        const { mainWord, crossWords = [] } = req.body;
        
        if (!mainWord || typeof mainWord !== 'string') {
            return res.status(400).json({ error: 'Main word is required' });
        }
        
        const allWords = [mainWord, ...crossWords];
        const results = allWords.map(word => {
            const upperWord = word.toUpperCase().trim();
            return {
                word: upperWord,
                valid: isValidWord(upperWord)
            };
        });
        
        const mainWordResult = results[0];
        const crossWordResults = results.slice(1);
        
        const invalidWords = results
            .filter(result => !result.valid)
            .map(result => result.word);
        
        const allValid = invalidWords.length === 0;
        
        let message = '';
        if (!dictionaryLoaded) {
            message = 'Dictionary validation disabled - all words accepted';
        } else if (allValid) {
            message = 'All words are valid';
        } else {
            message = `Invalid words found: ${invalidWords.join(', ')}`;
        }
        
        res.json({
            mainWord: mainWordResult,
            crossWords: crossWordResults,
            allValid,
            invalidWords,
            dictionaryEnabled: dictionaryLoaded,
            message
        });
    } catch (error) {
        console.error('Error validating turn:', error);
        res.status(500).json({ error: 'Failed to validate turn' });
    }
});

// GET /api/validation/status - Get dictionary status
router.get('/status', (req, res) => {
    let wordCount = 0;
    const activeLocale = dictionaryManager.getActiveLocale();
    
    if (dictionaryLoaded) {
        try {
            const { dicPath } = dictionaryManager.getDictionaryPaths(activeLocale);
            if (fs.existsSync(dicPath)) {
                const dicContent = fs.readFileSync(dicPath, 'utf8');
                const lines = dicContent.split('\n');
                wordCount = parseInt(lines[0], 10) || 0;
            }
        } catch (error) {
            console.warn('Could not determine word count:', error.message);
        }
    }
    
    const meta = dictionaryManager.getLocaleMetadata(activeLocale);
    
    res.json({
        loaded: dictionaryLoaded,
        wordCount,
        language: meta ? meta.language : activeLocale,
        status: dictionaryLoaded ? 'active' : 'disabled',
        source: 'LibreOffice dictionaries',
        locale: activeLocale
    });
});

// GET /api/validation/reload - Reload dictionary (for development)
router.get('/reload', (req, res) => {
    const locale = req.query.locale || dictionaryManager.getActiveLocale();
    const { loaded } = reloadDictionary(locale);
    dictionaryLoaded = loaded;
    res.json({
        success: loaded,
        loaded: dictionaryLoaded,
        locale,
        message: loaded ? `Dictionary ${locale} reloaded successfully` : `Failed to reload dictionary ${locale}`
    });
});

module.exports = router;
