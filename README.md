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
- **👤 Smart Player Entry**: Autocomplete suggestions with canonical casing to avoid duplicate profiles
- **📚 Dictionary Validation**: Optional word validation backed by LibreOffice dictionaries
- **🛠 Dictionary Admin**: Install, refresh, activate, or remove Roman alphabet dictionaries from LibreOffice/dictionaries
- **💾 Persistent Storage**: All games saved to SQLite with history and statistics
- **📱 PWA + Offline Support**: Installable on mobile/desktop with caching and background sync
- **🎨 Modern UI**: Slim persistent top bar, responsive layouts, Tailwind CSS styling

## 🏗️ Architecture

### Frontend (PWA)
- **Vanilla JavaScript**: No framework dependencies
- **Modular Design**: Separated API, game state, and app logic
- **Service Worker**: Offline caching and background sync
- **Responsive**: Works on all screen sizes

### Backend (API)
- **Node.js + Express**: RESTful API server
- **SQLite Database**: Lightweight, file-based storage
- **CORS Enabled**: Cross-origin resource sharing
- **Static File Serving**: Serves PWA files

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
│   │   └── player-autocomplete.js # Client-side autocomplete
│   ├── manifest.json      # PWA configuration
│   └── service-worker.js  # Offline functionality
├── server/                # Backend API
│   ├── server.js          # Express server
│   ├── package.json       # Dependencies
│   ├── database/          # Database files
│   └── routes/            # API endpoints
├── start-server.sh        # Quick start script
├── ecosystem.config.js    # PM2 configuration
├── DEPLOYMENT.md          # Detailed deployment guide
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

### API Endpoints
- `GET /api/health` - Health check
- `POST /api/games` - Create new game
- `GET /api/games` - List completed games
- `GET /api/games/:id` - Get game details
- `POST /api/games/:id/turns` - Submit turn
- `PUT /api/games/:id/status` - Update game status (active/finished/interrupted)
- `PUT /api/games/:id/reinstate` - Resume an interrupted game
- `DELETE /api/games/:id` - Remove a game and its history
- `GET /api/players` - Player search/autocomplete
- `GET /api/dictionaries` - Installed dictionary status
- `GET /api/dictionaries/catalog` - LibreOffice Roman alphabet catalog
- `POST /api/dictionaries` - Install a dictionary by locale
- `PUT /api/dictionaries/:locale` - Refresh or activate a dictionary
- `DELETE /api/dictionaries/:locale` - Remove an installed dictionary

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

## 📋 TODO / Future Enhancements

- [ ] Word validation with dictionary API
- [ ] Real-time multiplayer with WebSockets
- [ ] Game history export/import
- [ ] Player statistics and achievements
- [ ] Custom board layouts
- [ ] Tournament mode
- [ ] Mobile app versions (React Native)

## 📄 License

This project is open source and available under the MIT License.

## 🤝 Contributing

Feel free to submit issues, feature requests, or pull requests!

---

**Enjoy your Scrabble games! 🎲**
