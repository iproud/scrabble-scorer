# Scrabble Scorer PWA - Home Server Deployment Guide

## Server Configuration: 192.168.86.10:3037

This guide will help you deploy the Scrabble Scorer PWA on your home server.

## Prerequisites

1. **Node.js** (version 16 or higher)
2. **npm** (comes with Node.js)
3. **Git** (for cloning/updating)

## Quick Deployment Steps

### 1. Copy Files to Your Server

Transfer the entire `scrabble-scorer` folder to your home server at `192.168.86.10`.

```bash
# If using scp from your local machine:
scp -r scrabble-scorer/ user@192.168.86.10:/path/to/your/apps/

# Or if you're already on the server, you can clone from your repository
```

### 2. Install Dependencies

```bash
cd /path/to/scrabble-scorer/server
npm install
```

### 3. Configure Port (Already Set)

The app is configured to run on port 3037. You can verify this in `server/server.js`:

```javascript
const PORT = process.env.PORT || 3037;
```

To run on port 3037, you'll set the PORT environment variable.

### 4. Start the Application

#### Option A: Direct Start (for testing)
```bash
cd /path/to/scrabble-scorer/server
PORT=3037 npm start
```

#### Option B: Using PM2 (Recommended for Production)

First install PM2 globally:
```bash
npm install -g pm2
```

Create a PM2 ecosystem file:
```bash
cd /path/to/scrabble-scorer
```

Then start with PM2:
```bash
PORT=3037 pm2 start server/server.js --name "scrabble-scorer"
```

#### Option C: Using systemd (Linux Service)

Create a systemd service file:
```bash
sudo nano /etc/systemd/system/scrabble-scorer.service
```

Add the following content (adjust paths as needed):
```ini
[Unit]
Description=Scrabble Scorer PWA
After=network.target

[Service]
Type=simple
User=your-username
WorkingDirectory=/path/to/scrabble-scorer/server
Environment=NODE_ENV=production
Environment=PORT=3037
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start the service:
```bash
sudo systemctl enable scrabble-scorer
sudo systemctl start scrabble-scorer
sudo systemctl status scrabble-scorer
```

### 5. Access Your Application

Once running, access your Scrabble Scorer PWA at:
- **Local Network**: http://192.168.86.10:3037
- **From Server**: http://localhost:3037

## Firewall Configuration

Make sure port 3037 is open on your server:

### Ubuntu/Debian (ufw):
```bash
sudo ufw allow 3037
```

### CentOS/RHEL (firewalld):
```bash
sudo firewall-cmd --permanent --add-port=3037/tcp
sudo firewall-cmd --reload
```

### iptables:
```bash
sudo iptables -A INPUT -p tcp --dport 3037 -j ACCEPT
```

## SSL/HTTPS Setup (Optional but Recommended)

For PWA features to work fully, HTTPS is recommended. You can use:

### Option 1: Reverse Proxy with Nginx

Install Nginx and create a configuration:
```nginx
server {
    listen 80;
    server_name 192.168.86.10;
    
    location / {
        proxy_pass http://localhost:3037;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### Option 2: Self-Signed Certificate

Generate a self-signed certificate:
```bash
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes
```

## Database Location

The SQLite database will be created automatically at:
```
/path/to/scrabble-scorer/server/database/scrabble.db
```

## Backup Strategy

### Database Backup
```bash
# Create backup
cp /path/to/scrabble-scorer/server/database/scrabble.db /path/to/backups/scrabble-$(date +%Y%m%d).db

# Automated daily backup (add to crontab)
0 2 * * * cp /path/to/scrabble-scorer/server/database/scrabble.db /path/to/backups/scrabble-$(date +\%Y\%m\%d).db
```

## Monitoring and Logs

### PM2 Monitoring
```bash
pm2 status
pm2 logs scrabble-scorer
pm2 monit
```

### systemd Logs
```bash
sudo journalctl -u scrabble-scorer -f
```

## Updating the Application

1. Stop the service:
```bash
# PM2
pm2 stop scrabble-scorer

# systemd
sudo systemctl stop scrabble-scorer
```

2. Update files (copy new version or git pull)

3. Install any new dependencies:
```bash
cd /path/to/scrabble-scorer/server
npm install
```

4. Start the service:
```bash
# PM2
pm2 start scrabble-scorer

# systemd
sudo systemctl start scrabble-scorer
```

## Troubleshooting

### Check if port is in use:
```bash
sudo netstat -tlnp | grep 3037
# or
sudo ss -tlnp | grep 3037
```

### Check application logs:
```bash
# PM2
pm2 logs scrabble-scorer

# systemd
sudo journalctl -u scrabble-scorer -n 50

# Direct run
cd /path/to/scrabble-scorer/server
PORT=3037 npm start
```

### Test API endpoints:
```bash
curl http://192.168.86.10:3037/api/health
```

## Performance Optimization

### For Production Use:
1. Set NODE_ENV=production
2. Use PM2 cluster mode for multiple CPU cores:
```bash
PORT=3037 pm2 start server/server.js --name "scrabble-scorer" -i max
```

## Security Considerations

1. **Firewall**: Only allow necessary ports
2. **Updates**: Keep Node.js and dependencies updated
3. **Access**: Consider restricting access to your local network
4. **Backups**: Regular database backups
5. **Monitoring**: Set up log monitoring and alerts

## Network Access

Once deployed, users on your local network can access the app by visiting:
**http://192.168.86.10:3037**

The PWA can be installed on their devices for a native app experience!
