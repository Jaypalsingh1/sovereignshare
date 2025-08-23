# Deployment Guide 🚀

This guide covers deploying SovereignShare to various platforms.

## Local Development

### Prerequisites
- Node.js 16.0.0+
- npm 8.0.0+

### Quick Start
```bash
# Clone the repository
git clone https://github.com/Jaypalsingh1/sovereignshare.git
cd sovereignshare

# Install dependencies
cd backend
npm install

# Start the server
npm start
```

### Development Mode
```bash
cd backend
npm run dev  # Uses nodemon for auto-restart
```

## Production Deployment

### Environment Variables
Create a `.env` file in the backend directory:

```env
PORT=8000
NODE_ENV=production
NODE_OPTIONS="--max-old-space-size=2048"
```

### Build and Deploy
```bash
# Install production dependencies
cd backend
npm install --production

# Start production server
npm start
```

## Platform-Specific Deployment

### Heroku

1. **Create Heroku app**
   ```bash
   heroku create your-app-name
   ```

2. **Set environment variables**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set PORT=8000
   ```

3. **Deploy**
   ```bash
   git push heroku main
   ```

### DigitalOcean App Platform

1. **Connect your GitHub repository**
2. **Set environment variables**
   - `NODE_ENV`: `production`
   - `PORT`: `8000`
3. **Deploy automatically on push**

### AWS EC2

1. **Launch EC2 instance**
2. **Install Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

3. **Clone and deploy**
   ```bash
   git clone https://github.com/Jaypalsingh1/sovereignshare.git
cd sovereignshare/backend
   npm install --production
   npm start
   ```

4. **Use PM2 for process management**
   ```bash
   npm install -g pm2
   pm2 start server.js --name "sovereignshare"
   pm2 startup
   pm2 save
   ```

### Docker Deployment

1. **Create Dockerfile**
   ```dockerfile
   FROM node:18-alpine
   WORKDIR /app
   COPY package*.json ./
   RUN npm ci --only=production
   COPY . .
   EXPOSE 8000
   CMD ["npm", "start"]
   ```

2. **Build and run**
   ```bash
   docker build -t sovereignshare .
docker run -p 8000:8000 sovereignshare
   ```

## SSL/HTTPS Setup

### Using Let's Encrypt

1. **Install Certbot**
   ```bash
   sudo apt-get install certbot
   ```

2. **Generate certificate**
   ```bash
   sudo certbot certonly --standalone -d yourdomain.com
   ```

3. **Update server configuration**
   ```javascript
   const https = require('https');
   const fs = require('fs');
   
   const options = {
     key: fs.readFileSync('/etc/letsencrypt/live/yourdomain.com/privkey.pem'),
     cert: fs.readFileSync('/etc/letsencrypt/live/yourdomain.com/fullchain.pem')
   };
   
   https.createServer(options, app).listen(443);
   ```

## Performance Optimization

### Production Settings

1. **Enable compression**
   ```bash
   npm install compression
   ```

2. **Add to server.js**
   ```javascript
   const compression = require('compression');
   app.use(compression());
   ```

3. **Set security headers**
   ```javascript
   app.use(helmet());
   ```

### Monitoring

1. **Install monitoring tools**
   ```bash
   npm install -g pm2
   npm install -g clinic
   ```

2. **Monitor performance**
   ```bash
   clinic doctor -- node server.js
   ```

## Troubleshooting

### Common Issues

1. **Port already in use**
   ```bash
   lsof -i :8000
   kill -9 <PID>
   ```

2. **Memory issues**
   ```bash
   node --max-old-space-size=2048 server.js
   ```

3. **Permission denied**
   ```bash
   sudo chown -R $USER:$USER /path/to/app
   ```

### Logs

1. **View application logs**
   ```bash
   pm2 logs sovereignshare
   ```

2. **View system logs**
   ```bash
   journalctl -u securefileshare -f
   ```

## Security Checklist

- [ ] Environment variables set
- [ ] HTTPS enabled
- [ ] Security headers configured
- [ ] Rate limiting implemented
- [ ] Input validation enabled
- [ ] Error handling configured
- [ ] Logging configured
- [ ] Monitoring enabled

## Support

For deployment issues:
- Check the [README.md](README.md)
- Open an issue on GitHub
- Review the logs for error messages
