# Scrabble Keeper PWA

A polished companion Progressive Web App for tracking in-person Scrabble games with pause/resume, player history, dictionary validation, persistent storage, offline support, and installable native app experience.

## 🚀 Quick Start (Home Server: 192.168.86.10:3037)

### Method 1: Simple Start (Recommended for Testing)
```bash
# Make startup script executable (if not already)
chmod +x start-server.sh

# Start the server
./start-server.sh
```

### Method 2: PM2 Production Deployment
```bash
# Install PM2 globally
npm install -g pm2

# Update the path in ecosystem.config.js to your actual path
# Then start with PM2
pm2 start ecosystem.config.js --env production

# Save PM2 configuration for auto-restart on reboot
pm2 save
pm2 startup
```

## 📱 Access Your App

Once running, access Scrabble Keeper at:
- **http://192.168.86.10:3037**

The app can be installed on any device for a native app experience!

## ✨ Features

- **🎯 Interactive Scrabble Board**: Full 15x15 board with bonus squares and live scoring preview
- **🔢 Automatic Scoring**: Calculates word scores, cross words, and optional bingo bonuses
- **⏱ Pause & Resume**: Park a live game and restart it later from the history screen
- **🗑 Abandon Games**: Delete unfinished games you no longer plan to continue
- **↩️ Undo Functionality**: Full turn undo capability to correct mistakes during gameplay
- **👤 Smart Player Entry**: Autocomplete suggestions with canonical casing to avoid duplicate profiles
- **📚 Dictionary Validation**: Optional word validation backed by LibreOffice dictionaries
- **🛠 Dictionary Admin**: Install, refresh, activate, or remove Roman alphabet dictionaries from LibreOffice/dictionaries
- **🎯 Tile Inventory Management**: Real-time tile bag tracking with countdown display and detailed inventory modal
- **📖 Comprehensive Help System**: In-app help modal with detailed gameplay instructions and quick tips
- **📱 Mobile-Optimized Interface**: Responsive design with mobile sheets and touch-friendly controls
- **🎮 Advanced Finish Game Flow**: 3-step modal system for ending games with proper tile distribution
- **💾 Persistent Storage**: All games saved to SQLite with history and statistics
- **📱 PWA + Offline Support**: Installable on mobile/desktop with caching and background sync
- **🎨 Modern UI**: Slim persistent top bar, modal-based interactions, Tailwind CSS styling

## 🏗️ Architecture

### Frontend (PWA)
- **Vanilla JavaScript**: No framework dependencies
- **Modular Design**: Separated API, game state, and app logic
- **Sophisticated Game State Management**: Complete turn history, board state tracking, and automatic game interruption handling
- **Modal-Based UI System**: Multi-modal interface for game flow, help, statistics, and finish game sequences
- **Mobile-First Responsive Design**: Mobile sheets for touch devices, adaptive layouts, and touch-friendly controls
- **Service Worker**: Offline caching and background sync
- **Topbar Navigation System**: Persistent navigation with dropdown menus and game action controls

### Backend (API)
- **Node.js + Express**: RESTful API server
- **SQLite Database**: Lightweight, file-based storage with better-sqlite3
- **Advanced Dictionary Management**: LibreOffice dictionary integration with active locale management
- **CORS Enabled**: Cross-origin resource sharing
- **Static File Serving**: Serves PWA files
- **Game State Persistence**: Automatic interruption detection and game recovery

## 📁 Project Structure

```
scrabble-scorer/
├── client/                 # Frontend PWA
│   ├── index.html         # Main game interface (new game + live scoring)
│   ├── history.html       # Game history with resume/abandon controls
│   ├── admin.html         # Dictionary management dashboard
│   ├── css/styles.css     # Styles and animations
│   ├── js/
│   │   ├── api.js         # API communication & offline queueing
│   │   ├── game-state.js  # Core game logic/state helpers
│   │   ├── app.js         # Main controller & pause/resume handling
│   │   ├── history.js     # History screen controller
│   │   ├── admin.js       # Dictionary admin controller
│   │   ├── player-autocomplete.js # Client-side autocomplete
│   │   └── topbar.js      # Topbar navigation and modal management
│   ├── manifest.json      # PWA configuration
│   └── service-worker.js  # Offline functionality
├── server/                # Backend API
│   ├── server.js          # Express server
│   ├── package.json       # Dependencies
│   ├── database/          # Database files
│   │   ├── init.js        # Database initialization
│   │   ├── schema.sql     # Database schema
│   │   └── scrabble.db    # SQLite database file
│   ├── routes/            # API endpoints
│   │   ├── games.js       # Game management endpoints
│   │   ├── players.js     # Player autocomplete endpoints
│   │   ├── dictionaries.js # Dictionary management endpoints
│   │   └── validation.js  # Word validation endpoints
│   ├── services/          # Business logic services
│   │   ├── dictionaryLoader.js # Dictionary loading and caching
│   │   └── dictionaryManager.js # Dictionary installation and management
│   └── dictionary/        # Dictionary files
│       ├── config.json    # Dictionary configuration
│       ├── en_AU.aff      # Australian English affix file
│       └── en_AU.dic      # Australian English dictionary
├── start-server.sh        # Quick start script
├── ecosystem.config.js    # PM2 configuration
├── fix-dependencies.sh    # Native dependency修复 script
├── DEPLOYMENT.md          # Detailed deployment guide
├── package.json           # Root package.json
├── package-lock.json      # Dependency lock file
├── .gitignore            # Git ignore rules
└── README.md             # This file
```

## 🔧 Development

### Prerequisites
- Node.js (version 16+)
- npm

### Local Development
```bash
cd server
npm install
npm start
```

### Mobile Testing
The app is designed mobile-first with responsive layouts. Test on various screen sizes:

1. **Desktop Testing**: Use browser dev tools to simulate mobile devices
2. **Real Device Testing**: 
   - Access `http://192.168.86.10:3037` on mobile devices on the same network
   - Test the mobile sheet interface for game controls
   - Verify touch interactions on the board and scoring controls
3. **PWA Installation**: Test installability on both mobile and desktop

### Testing Key Features

#### Undo Functionality
1. Start a game and play several turns
2. Use the undo button in the topbar to revert the last turn
3. Verify board state, scores, and turn history are properly restored
4. Test undo after game interruption and resume

#### Finish Game Flow
1. Play a game with several turns
2. Click the finish game button in the topbar menu
3. Test the 3-step modal flow:
   - Step 1: Select who ended the game
   - Step 2: Assign remaining tiles to other players
   - Step 3: Review final scores and winner announcement
4. Verify score calculations include tile deductions and bonuses

#### Game Interruption Handling
1. Start a game and play several turns
2. Close the browser tab or navigate away
3. Reopen the app and verify the game appears in history as "interrupted"
4. Test resuming the interrupted game
5. Verify game state is completely restored

#### Dictionary Management
1. Access the Admin panel from the topbar menu
2. Test installing new dictionaries from the LibreOffice catalog
3. Test activating different dictionaries
4. Test word validation with different dictionaries enabled/disabled

### API Endpoints

#### Game Management
- `GET /api/health` - Health check
- `POST /api/games` - Create new game
- `GET /api/games` - List all games (completed and interrupted)
- `GET /api/games/:id` - Get specific game details with turns and players
- `POST /api/games/:id/turns` - Submit a turn with word, score, and board state
- `PUT /api/games/:id/status` - Update game status (active/finished/interrupted)
- `PUT /api/games/:id/reinstate` - Resume an interrupted game
- `DELETE /api/games/:id` - Remove a game and its history
- `DELETE /api/games/:id/turns/last` - Undo the last turn for a game

#### Player Management
- `GET /api/players` - Player search/autocomplete with canonical name handling

#### Dictionary Management
- `GET /api/dictionaries` - Get installed dictionary status and active locale
- `GET /api/dictionaries/catalog` - LibreOffice Roman alphabet dictionary catalog
- `POST /api/dictionaries` - Install a dictionary by locale (downloads from LibreOffice)
- `PUT /api/dictionaries/:locale` - Refresh or activate a dictionary
  - Body: `{"action": "activate"}` to activate, or no body to refresh
- `DELETE /api/dictionaries/:locale` - Remove an installed dictionary

#### Word Validation
- `POST /api/validation/validate` - Validate words against active dictionary
  - Body: `{"word": "SCRABBLE", "crossWords": ["CAT", "DOG"]}`
  - Returns: `{"allValid": true, "invalidWords": []}`

## 🛠️ Troubleshooting

### Native Dependencies Error (better-sqlite3)
If you get an error like "libnode.so.109: cannot open shared object file", run:
```bash
# Fix native dependencies
./fix-dependencies.sh

# Then try starting again
./start-server.sh
```

### Port Already in Use
```bash
# Check what's using port 3037
sudo netstat -tlnp | grep 3037

# Kill process if needed
sudo kill -9 <PID>
```

### Check Logs
```bash
# PM2 logs
pm2 logs scrabble-scorer

# Direct run logs
cd server && PORT=3037 npm start
```

### Database Issues
The SQLite database is created automatically. If you need to reset:
```bash
rm server/database/scrabble.db
# Restart the server to recreate
```

## 📄 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Feel free to submit issues, feature requests, or pull requests!

---

**Enjoy your Scrabble games! 🎲**
