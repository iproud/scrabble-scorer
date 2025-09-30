const express = require('express');
const dictionaryManager = require('../services/dictionaryManager');
const { reloadDictionary, loadActiveDictionary } = require('../services/dictionaryLoader');

const router = express.Router();

function buildDictionaryStatus(locale) {
    const installedDictionaries = dictionaryManager.listInstalledDictionaries();
    const activeLocale = dictionaryManager.getActiveLocale();

    const installedMap = new Map(
        installedDictionaries.map(dict => [dict.locale, dict])
    );

    return installedDictionaries.map(dict => ({
        locale: dict.locale,
        language: dict.language,
        installedAt: dict.installedAt,
        size: dict.size,
        active: dict.locale === activeLocale
    })).sort((a, b) => a.language.localeCompare(b.language));
}

router.get('/', (req, res) => {
    try {
        const activeLocale = dictionaryManager.getActiveLocale();
        const installed = buildDictionaryStatus(activeLocale);
        const { loaded } = reloadDictionary(activeLocale);
        const meta = dictionaryManager.getLocaleMetadata(activeLocale);
        const activeLanguage = meta && meta.language ? meta.language : activeLocale;

        res.json({
            activeLocale,
            activeLanguage,
            installed,
            validationEnabled: loaded
        });
    } catch (error) {
        console.error('Error fetching dictionaries:', error);
        res.status(500).json({ error: 'Failed to fetch dictionaries' });
    }
});

router.get('/catalog', (req, res) => {
    try {
        const catalog = dictionaryManager.getAvailableDictionaries();
        res.json(catalog);
    } catch (error) {
        console.error('Error fetching dictionary catalog:', error);
        res.status(500).json({ error: 'Failed to fetch dictionary catalog' });
    }
});

router.post('/', async (req, res) => {
    try {
        const { locale } = req.body;

        if (!locale) {
            return res.status(400).json({ error: 'Locale is required.' });
        }

        await dictionaryManager.installDictionary(locale);
        const { loaded } = reloadDictionary(locale);

        res.status(201).json({
            success: true,
            locale,
            validationEnabled: loaded,
            message: `Dictionary ${locale} installed successfully.`
        });
    } catch (error) {
        console.error('Error installing dictionary:', error);
        res.status(500).json({ error: error.message || 'Failed to install dictionary' });
    }
});

router.put('/:locale', async (req, res) => {
    try {
        const { locale } = req.params;
        const { action } = req.body || {};

        if (!locale) {
            return res.status(400).json({ error: 'Locale is required.' });
        }

        if (action === 'activate') {
            dictionaryManager.setActiveLocale(locale);
            const { loaded } = reloadDictionary(locale);
            return res.json({
                success: true,
                locale,
                validationEnabled: loaded,
                message: `Dictionary ${locale} activated successfully.`
            });
        }

        await dictionaryManager.refreshDictionary(locale);
        const { loaded } = reloadDictionary(locale);

        res.json({
            success: true,
            locale,
            validationEnabled: loaded,
            message: `Dictionary ${locale} refreshed successfully.`
        });
    } catch (error) {
        console.error('Error updating dictionary:', error);
        res.status(500).json({ error: error.message || 'Failed to update dictionary' });
    }
});

router.delete('/:locale', (req, res) => {
    try {
        const { locale } = req.params;

        if (!locale) {
            return res.status(400).json({ error: 'Locale is required.' });
        }

        dictionaryManager.deleteDictionary(locale);
        const { loaded } = loadActiveDictionary();

        res.json({
            success: true,
            locale,
            validationEnabled: loaded,
            message: `Dictionary ${locale} removed successfully.`
        });
    } catch (error) {
        console.error('Error deleting dictionary:', error);
        res.status(500).json({ error: error.message || 'Failed to delete dictionary' });
    }
});

module.exports = router;
