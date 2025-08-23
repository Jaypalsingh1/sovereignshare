/**
 * SovereignShare Backend Server
 * Handles WebRTC signaling and user management
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Middleware
app.use(cors({
    origin: '*',
    credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Socket.IO server configuration
const io = new Server(server, {
    cors: {
        origin: '*',
        methods: ['GET', 'POST']
    }
});

// User management
const userRegistry = new Map(); // socketId -> uniqueId
const idRegistry = new Map();   // uniqueId -> socketId

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        activeConnections: io.engine.clientsCount
    });
});

// Socket.IO event handlers
io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);
    
    // Handle user registration
    socket.on('details', (data) => {
        const { uniqueId } = data;
        
        // Store user mappings using actual socket.id
        userRegistry.set(socket.id, uniqueId);
        idRegistry.set(uniqueId, socket.id);
        
        console.log(`User registered: ${uniqueId} -> ${socket.id}`);
        logUserRegistry();
    });
    
    // Handle WebRTC signaling - sending offer/candidate
    socket.on('send-signal', (data) => {
        const { from, to, signalData } = data;
        const targetSocketId = idRegistry.get(to);
        
        if (targetSocketId) {
            console.log(`Forwarding signal from ${from} to ${to}`);
            socket.to(targetSocketId).emit('signaling', {
                from: from,
                signalData: signalData,
                to: to
            });
        } else {
            console.log(`Target user ${to} not found`);
            socket.emit('error', { message: 'Target user not found' });
        }
    });
    
    // Handle WebRTC signaling - accepting call
    socket.on('accept-signal', (data) => {
        const { to, signalData } = data;
        const targetSocketId = idRegistry.get(to);
        
        if (targetSocketId) {
            console.log(`Forwarding accept signal to ${to}`);
            socket.to(targetSocketId).emit('callAccepted', {
                signalData: signalData,
                to: to
            });
        } else {
            console.log(`Target user ${to} not found for accept signal`);
            socket.emit('error', { message: 'Target user not found' });
        }
    });
    
    // Handle room-based messaging (for future features)
    socket.on('joinRoom', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);
        socket.emit('roomJoined', { roomId: roomId });
    });
    
    socket.on('roomMessage', (data) => {
        const { roomId, message } = data;
        socket.to(roomId).emit('roomMessage', {
            from: socket.id,
            message: message,
            timestamp: new Date().toISOString()
        });
    });
    
    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`Client disconnected: ${socket.id}`);
        
        // Clean up user registries
        const uniqueId = userRegistry.get(socket.id);
        if (uniqueId) {
            userRegistry.delete(socket.id);
            idRegistry.delete(uniqueId);
            console.log(`User ${uniqueId} removed from registry`);
        }
        
        logUserRegistry();
    });
    
    // Handle errors
    socket.on('error', (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
    });
});

/**
 * Log current user registry state
 */
function logUserRegistry() {
    console.log('\n=== Current User Registry ===');
    console.log('Active connections:', io.engine.clientsCount);
    console.log('Registered users:', userRegistry.size);
    
    for (const [socketId, uniqueId] of userRegistry) {
        console.log(`  ${uniqueId} -> ${socketId}`);
    }
    console.log('=============================\n');
}

/**
 * Graceful shutdown handler
 */
function gracefulShutdown() {
    console.log('\nReceived shutdown signal. Closing server...');
    
    server.close(() => {
        console.log('HTTP server closed');
        io.close(() => {
            console.log('Socket.IO server closed');
            process.exit(0);
        });
    });
    
    // Force close after 10 seconds
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
}

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

// Start server
const PORT = process.env.PORT || 8000;
server.listen(PORT, () => {
    console.log(`🚀 SovereignShare server running on port ${PORT}`);
    console.log(`📱 Frontend available at: http://localhost:${PORT}`);
    console.log(`🔌 WebSocket endpoint: ws://localhost:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log('\nPress Ctrl+C to stop the server\n');
});

// Export for testing purposes
module.exports = { app, server, io };
