# Scrabble Keeper PWA

A polished, full-featured companion Progressive Web App for tracking in-person Scrabble games. It features real-time scoring, dictionary validation, robust game state management (undo, pause, resume), and a premium mobile-first user experience.

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

# Start with PM2 using the ecosystem file for persistent deployment
pm2 start ecosystem.config.js --env production

# Save PM2 configuration for auto-restart on reboot
pm2 save
pm2 startup
```

## 📱 Access Your App

Once running, access Scrabble Keeper at:
- **http://192.168.86.10:3037** (or your server's IP)

The app is fully installable on iOS and Android devices, offering a native app-like experience (fullscreen, offline capabilities).

## ✨ Key Features

### 🎮 Gameplay & Scoring
- **Interactive Board**: Full 15x15 board with accurately placed premium squares (TWS, DWS, TLS, DLS).
- **Real-Time Tile Preview**: See tiles appear on the board **as you type** them in the input field.
- **Smart Scoring**:
  - Automatically calculates word scores including all cross-words.
  - **Bingo Detection**: Automatically awards +50 points and triggers a visual celebration when all 7 tiles are used.
  - **Premium Square Tracking**: Intelligently tracks used premium squares so bonuses are only applied once.
- **Blank Tile Support**:
  - Toggle tiles as "Blank" by clicking them in the word entry area.
  - Visualized with distinct styling (Green text in preview, Gray text on board) and 0 points.
  - Correctly persists blank status through turns and reloads.

### 🛠 Game Management
- **Pause & Resume**: Park a live game and seamlessly resume it later, even after a server restart.
- **Undo Functionality**: Correct mistakes by undoing the last turn. This fully restores:
  - The previous board state.
  - Player scores.
  - **Tile inventory counts** (returns tiles to the virtual bag).
  - Premium square availability.
- **Abandon Games**: Clean up unfinished games from your history.
- **Detailed History**: View a complete log of all past games and turns.

### 📚 Tools & Validation
- **Dictionary Validation**: Optional integration with LibreOffice dictionaries (e.g., `en_AU`).
  - Validates main words and all secondary cross-words.
  - Warns players of invalid words (can be overridden).
- **Tile Bag Tracking**: View exactly which letters remain in the bag and their counts.
- **Player Management**: Smart autocomplete prevents duplicate player profiles (e.g., "Dad" vs "dad").

## 🏗️ Architecture

### Frontend (Client)
- **Tech**: Vanilla JavaScript, Tailwind CSS (No heavy framework overhead).
- **State Management**: Robust `GameState` class managing rules, scores, and board history.
- **PWA**: manifest.json and Service Worker for offline support and installation.
- **UI**: Mobile-first design with modal sheets, touch targets, and responsive layouts.

### Backend (Server)
- **Tech**: Node.js, Express.
- **Database**: `better-sqlite3` (SQLite) for zero-configuration, file-based persistence.
- **API**: RESTful endpoints for games, turns, players, and dictionary management.

## 📁 Project Structure

```
scrabble-scorer/
├── client/                 # Frontend PWA
│   ├── css/               # Tailwind & custom styles
│   ├── js/                # Core Application Logic
│   │   ├── app.js         # Main controller
│   │   ├── game-state.js  # Game rules & state
│   │   ├── real-time-tile-placement.js # Live board preview
│   │   └── ...
│   └── index.html         # Main entry point
├── server/                # Backend API
│   ├── database/          # SQLite schema & DB file
│   ├── routes/            # API Endpoints
│   ├── services/          # Business logic
│   └── server.js          # Express entry point
└── README.md              # Project documentation
```

## 🔧 Troubleshooting

### Native Dependencies Error (better-sqlite3)
If you encounter errors related to `libnode.so` or ABI mismatches:
```bash
./fix-dependencies.sh
./start-server.sh
```

### Port Conflicts
If port 3037 is in use:
```bash
sudo netstat -tlnp | grep 3037
sudo kill -9 <PID>
```

### Verification Tips
- **Undo**: Verify that after undoing, the "Tile Bag" count for your returned letters goes *up*.
- **Blanks**: A blank tile should show the letter you typed but score 0. On the board, it should appear Gray (permanent) or Green text (preview).

## 📄 License
MIT License - Open for modification and use.
