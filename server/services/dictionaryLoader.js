const fs = require('fs');
const nspell = require('nspell');
const dictionaryManager = require('./dictionaryManager');

let currentDictionary = {
    locale: null,
    spell: null,
    loaded: false
};

async function loadDictionaryForLocale(locale) {
    try {
        // Prefer the bundled dictionary-en-au package for AU locale
        if (locale === 'en_AU' || locale === 'en_au') {
            try {
                // Dynamically import to avoid issues if not installed yet
                const en_AU = await import('dictionary-en-au');
                // dictionary-en-au v3 exports { aff, dic } as named exports or default object properties
                const aff = en_AU.aff || (en_AU.default && en_AU.default.aff);
                const dic = en_AU.dic || (en_AU.default && en_AU.default.dic);

                if (!aff || !dic) {
                    throw new Error('Package exports missing aff/dic');
                }

                const spell = nspell(aff, dic);

                currentDictionary = { locale: 'en_AU', spell, loaded: true };
                console.log(`📚 Bundled dictionary-en-au loaded successfully`);
                return currentDictionary;
            } catch (pkgError) {
                console.warn('Failed to load bundled dictionary-en-au package, falling back to file system:', pkgError.message);
            }
        }

        const { affPath, dicPath } = dictionaryManager.getDictionaryPaths(locale);

        if (!fs.existsSync(affPath) || !fs.existsSync(dicPath)) {
            console.warn(`Dictionary files for locale ${locale} not found.`);
            currentDictionary = { locale: null, spell: null, loaded: false };
            return currentDictionary;
        }

        const aff = fs.readFileSync(affPath, 'utf8');
        const dic = fs.readFileSync(dicPath, 'utf8');
        const spell = nspell(aff, dic);

        currentDictionary = { locale, spell, loaded: true };
        console.log(`📚 Dictionary for locale ${locale} loaded successfully`);
        return currentDictionary;
    } catch (error) {
        console.error(`❌ Failed to load dictionary for locale ${locale}:`, error.message);
        currentDictionary = { locale: null, spell: null, loaded: false };
        return currentDictionary;
    }
}

async function loadActiveDictionary() {
    const activeLocale = dictionaryManager.getActiveLocale();
    return loadDictionaryForLocale(activeLocale);
}

function getSpellChecker() {
    // Return current state synchronously
    // If loading is in progress, this might return loaded: false
    // detailed loading state could be added if needed
    return currentDictionary;
}

async function reloadDictionary(locale) {
    if (locale) {
        return loadDictionaryForLocale(locale);
    }
    return loadActiveDictionary();
}

module.exports = {
    loadActiveDictionary,
    getSpellChecker,
    reloadDictionary
};
