# SovereignShare: P2P File Exchange & Chat 🔐📁

A modern, sovereign peer-to-peer file exchange and chat application built with vanilla JavaScript, WebRTC, and Node.js. Share files and messages directly between devices without uploading to any server - your data stays private and sovereign.

## ✨ Features

- **🔒 End-to-End Encryption**: All file transfers use WebRTC DataChannels for direct P2P communication
- **📁 Drag & Drop File Upload**: Intuitive file selection with drag-and-drop support
- **📊 Real-time Progress**: Live progress tracking for file transfers
- **💬 Real-time Chat**: Built-in chat functionality during file transfers
- **🌙 Dark/Light Theme**: Toggle between light and dark themes
- **📱 Responsive Design**: Works seamlessly on desktop and mobile devices
- **🔗 Easy Sharing**: Generate shareable links for quick connections
- **⚡ Fast Transfers**: Optimized chunk-based file transfer system

## 🏗️ Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Frontend      │    │   Backend       │    │   Peer Device   │
│   (Browser)     │◄──►│   (Node.js)     │◄──►│   (Browser)     │
│                 │    │                 │    │                 │
│ • HTML/CSS/JS   │    │ • Express       │    │ • WebRTC        │
│ • WebRTC        │    │ • Socket.IO     │    │ • File Exchange │
│ • File Handling │    │ • Signaling     │    │ • Chat          │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🚀 Quick Start

### Prerequisites

- Node.js 16.0.0 or higher
- npm 8.0.0 or higher
- Modern web browser with WebRTC support

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Jaypalsingh1/sovereignshare.git
cd sovereignshare
   ```

2. **Install backend dependencies**
   ```bash
   cd backend
   npm install
   ```

3. **Start the server**
   ```bash
   npm start
   ```

4. **Open your browser**
   Navigate to `http://localhost:8000`

### Development Mode

For development with auto-restart:

```bash
cd backend
npm run dev
```

## 📖 Usage Guide

### 1. **Get Your ID**
- When you open the application, you'll see a unique 10-character ID
- This is your identifier that others will use to connect to you

### 2. **Connect to a Peer**
- Enter the peer's ID in the "Peer's ID" field
- Click "Connect" to initiate the connection
- Wait for the peer to accept your connection request

### 3. **Accept Incoming Connections**
- When someone tries to connect, you'll see an incoming call notification
- Click "Accept" to establish the connection
- Click "Reject" to decline

### 4. **Share Files**
- Drag and drop files onto the upload zone or click "Browse Files"
- Select the file you want to send
- Click "Send File" to start the transfer
- Monitor progress in real-time

### 5. **Chat During Transfer**
- Once connected, the chat panel will appear
- Send messages to your peer in real-time
- Perfect for coordinating file transfers

### 6. **Share Your ID**
- Click the share button next to your ID
- Copy the generated link
- Send it to others for easy connection

## 🔧 Configuration

### Environment Variables

Create a `.env` file in the backend directory:

```env
PORT=8000
NODE_ENV=production
```

### Custom STUN/TURN Servers

Modify the WebRTC configuration in `frontend/app.js`:

```javascript
const configuration = {
    iceServers: [
        { urls: 'stun:your-stun-server.com:3478' },
        { 
            urls: 'turn:your-turn-server.com:3478',
            username: 'username',
            credential: 'password'
        }
    ]
};
```

## 🛠️ Development

### Project Structure

```
sovereignshare/
├── frontend/                 # Frontend application
│   ├── index.html           # Main HTML file
│   ├── styles.css           # CSS styles and themes
│   └── app.js              # Main JavaScript application
├── backend/                  # Backend server
│   ├── server.js            # Express + Socket.IO server
│   ├── package.json         # Backend dependencies
│   └── package-lock.json    # Locked dependency versions
├── README.md                # This file
└── .gitignore              # Git ignore rules
```

### Key Technologies

- **Frontend**: Vanilla JavaScript, HTML5, CSS3, WebRTC API
- **Backend**: Node.js, Express.js, Socket.IO
- **File Transfer**: WebRTC DataChannels with chunked transfer
- **Real-time Communication**: Socket.IO for signaling
- **Security**: End-to-end encryption via WebRTC

### Browser Support

- Chrome 56+
- Firefox 52+
- Safari 11+
- Edge 79+

## 🔒 Security Features

- **No Server Storage**: Files never touch the server - only signaling data passes through
- **P2P Encryption**: WebRTC provides built-in encryption for all data
- **Direct Transfer**: Files transfer directly between peers
- **No Logging**: Server doesn't log or store file information

## 🚨 Troubleshooting

### Common Issues

1. **Connection Fails**
   - Check if both devices are online
   - Ensure firewall allows WebRTC traffic
   - Try refreshing the page

2. **File Transfer Stuck**
   - Check network stability
   - Try smaller files first
   - Restart the connection

3. **Chat Not Working**
   - Ensure WebRTC connection is established
   - Check browser console for errors
   - Try reconnecting

### Debug Mode

Enable debug logging in the browser console:

```javascript
localStorage.setItem('debug', 'true');
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 🙏 Acknowledgments

- WebRTC community for the amazing peer-to-peer technology
- Socket.IO team for real-time communication capabilities
- Font Awesome for the beautiful icons
- All contributors and users of this project
---

**Made with ❤️ for sovereign, private file exchange and chat**
