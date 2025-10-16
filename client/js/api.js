// API communication module
class ScrabbleAPI {
    constructor(baseURL = '/api') {
        this.baseURL = baseURL;
        this.isOnline = navigator.onLine;
        
        // Listen for online/offline events
        window.addEventListener('online', () => {
            this.isOnline = true;
            console.log('API: Back online');
            this.syncPendingActions();
        });
        
        window.addEventListener('offline', () => {
            this.isOnline = false;
            console.log('API: Gone offline');
        });
    }

    // Generic fetch wrapper with error handling
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            },
            ...options
        };

        try {
            const response = await fetch(url, config);
            
            if (!response.ok) {
                let errorData = {};
                try {
                    errorData = await response.json();
                } catch (e) {
                    // If JSON parsing fails, try to get text
                    const errorText = await response.text();
                    errorData = { error: errorText, status: response.status, statusText: response.statusText };
                }
                
                const errorMessage = errorData.error || `HTTP ${response.status}: ${response.statusText}`;
                console.error(`API Error (${endpoint}):`, errorMessage);
                console.error(`API Error Details (${endpoint}):`, {
                    status: response.status,
                    statusText: response.statusText,
                    url: url,
                    config: config,
                    errorData: errorData
                });
                throw new Error(errorMessage);
            }
            
            return await response.json();
        } catch (error) {
            console.error(`API Error (${endpoint}):`, error);
            
            // If offline, try to handle gracefully
            if (!this.isOnline || error.name === 'TypeError') {
                return this.handleOfflineRequest(endpoint, options);
            }
            
            throw error;
        }
    }

    // Handle requests when offline
    async handleOfflineRequest(endpoint, options) {
        // For GET requests, try to return cached data
        if (!options.method || options.method === 'GET') {
            const cachedData = this.getCachedData(endpoint);
            if (cachedData) {
                return cachedData;
            }
        }
        
        // For POST/PUT requests, queue them for later
        if (options.method === 'POST' || options.method === 'PUT') {
            this.queueOfflineAction(endpoint, options);
            return { success: true, queued: true, message: 'Action queued for when online' };
        }
        
        throw new Error('No internet connection and no cached data available');
    }

    // Cache data for offline use
    cacheData(endpoint, data) {
        try {
            const cacheKey = `scrabble_cache_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
            localStorage.setItem(cacheKey, JSON.stringify({
                data,
                timestamp: Date.now()
            }));
        } catch (error) {
            console.warn('Failed to cache data:', error);
        }
    }

    // Get cached data
    getCachedData(endpoint) {
        try {
            const cacheKey = `scrabble_cache_${endpoint.replace(/[^a-zA-Z0-9]/g, '_')}`;
            const cached = localStorage.getItem(cacheKey);
            
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                // Return cached data if it's less than 1 hour old
                if (Date.now() - timestamp < 3600000) {
                    return data;
                }
            }
        } catch (error) {
            console.warn('Failed to get cached data:', error);
        }
        return null;
    }

    // Queue actions for when back online
    queueOfflineAction(endpoint, options) {
        try {
            const queue = JSON.parse(localStorage.getItem('scrabble_offline_queue') || '[]');
            queue.push({
                id: Date.now(),
                endpoint,
                options,
                timestamp: Date.now()
            });
            localStorage.setItem('scrabble_offline_queue', JSON.stringify(queue));
        } catch (error) {
            console.warn('Failed to queue offline action:', error);
        }
    }

    // Sync pending actions when back online
    async syncPendingActions() {
        try {
            const queue = JSON.parse(localStorage.getItem('scrabble_offline_queue') || '[]');
            
            for (const action of queue) {
                try {
                    await this.request(action.endpoint, action.options);
                    console.log('Synced offline action:', action.endpoint);
                } catch (error) {
                    console.error('Failed to sync offline action:', error);
                    // Keep failed actions in queue for retry
                    continue;
                }
            }
            
            // Clear successfully synced actions
            localStorage.removeItem('scrabble_offline_queue');
        } catch (error) {
            console.error('Failed to sync pending actions:', error);
        }
    }

    // Game API methods
    async createGame(playerNames) {
        const data = await this.request('/games', {
            method: 'POST',
            body: JSON.stringify({ playerNames })
        });
        
        // Cache the created game
        this.cacheData(`/games/${data.id}`, data);
        return data;
    }

    async getGame(gameId) {
        const data = await this.request(`/games/${gameId}`);
        this.cacheData(`/games/${gameId}`, data);
        return data;
    }

    async getGames() {
        const data = await this.request('/games');
        this.cacheData('/games', data);
        return data;
    }

    async searchPlayers(query, limit = 15) {
        const params = new URLSearchParams();
        if (query) params.set('query', query);
        if (limit) params.set('limit', limit.toString());

        return await this.request(`/players?${params.toString()}`);
    }

    async submitTurn(gameId, turnData) {
        const data = await this.request(`/games/${gameId}/turns`, {
            method: 'POST',
            body: JSON.stringify(turnData)
        });
        
        // Invalidate game cache since it's been updated
        const cacheKey = `scrabble_cache__games_${gameId}`;
        localStorage.removeItem(cacheKey);
        
        return data;
    }

    async updateGameStatus(gameId, status, winnerId = null) {
        const payload = { status };
        if (winnerId) {
            payload.winnerId = winnerId;
        }

        const data = await this.request(`/games/${gameId}/status`, {
            method: 'PUT',
            body: JSON.stringify(payload)
        });

        localStorage.removeItem(`scrabble_cache__games_${gameId}`);
        localStorage.removeItem('scrabble_cache__games');

        return data;
    }

    async finishGame(gameId, winnerId) {
        return await this.updateGameStatus(gameId, 'finished', winnerId);
    }

    async deleteGame(gameId) {
        const data = await this.request(`/games/${gameId}`, {
            method: 'DELETE'
        });
        
        // Invalidate caches
        localStorage.removeItem(`scrabble_cache__games_${gameId}`);
        localStorage.removeItem('scrabble_cache__games');
        
        return data;
    }

    async reinstateGame(gameId) {
        const data = await this.request(`/games/${gameId}/reinstate`, {
            method: 'PUT'
        });
        
        // Invalidate caches
        localStorage.removeItem(`scrabble_cache__games_${gameId}`);
        localStorage.removeItem('scrabble_cache__games');
        
        return data;
    }

    async deleteLastTurn(gameId) {
        const data = await this.request(`/games/${gameId}/turns/last`, {
            method: 'DELETE'
        });

        // Invalidate game cache since it's been updated
        localStorage.removeItem(`scrabble_cache__games_${gameId}`);
        
        return data;
    }

    // Get comprehensive game statistics
    async getGameStatistics(gameId) {
        return this.request(`/games/${gameId}/statistics`);
    }

    // Dictionary management
    async getDictionaries() {
        return await this.request('/dictionaries');
    }

    async getDictionaryCatalog() {
        return await this.request('/dictionaries/catalog');
    }

    async installDictionary(locale) {
        return await this.request('/dictionaries', {
            method: 'POST',
            body: JSON.stringify({ locale })
        });
    }

    async refreshDictionary(locale) {
        return await this.request(`/dictionaries/${encodeURIComponent(locale)}`, {
            method: 'PUT',
            body: JSON.stringify({ action: 'refresh' })
        });
    }

    async activateDictionary(locale) {
        return await this.request(`/dictionaries/${encodeURIComponent(locale)}`, {
            method: 'PUT',
            body: JSON.stringify({ action: 'activate' })
        });
    }

    async deleteDictionary(locale) {
        return await this.request(`/dictionaries/${encodeURIComponent(locale)}`, {
            method: 'DELETE'
        });
    }

    // Validation API methods
    async validateWord(word) {
        return await this.request('/validation/word', {
            method: 'POST',
            body: JSON.stringify({ word })
        });
    }

    async validateWords(words) {
        return await this.request('/validation/words', {
            method: 'POST',
            body: JSON.stringify({ words })
        });
    }

    async validateTurn(mainWord, crossWords = []) {
        return await this.request('/validation/turn', {
            method: 'POST',
            body: JSON.stringify({ mainWord, crossWords })
        });
    }

    async getValidationStatus() {
        return await this.request('/validation/status');
    }

    // Health check
    async healthCheck() {
        return await this.request('/health');
    }
}

// Create global API instance
window.scrabbleAPI = new ScrabbleAPI();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ScrabbleAPI;
}
