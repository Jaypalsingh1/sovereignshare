/**
 * SovereignShare Enhanced Backend Server
 * Handles WebRTC signaling and user management with better network support
 */

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const os = require('os');

// Initialize Express app
const app = express();
const server = http.createServer(app);

// Enhanced CORS configuration
app.use(cors({
    origin: function(origin, callback) {
        // Allow requests with no origin (mobile apps, etc.)
        if (!origin) return callback(null, true);
        
        // Allow localhost and any IP address for development
        const allowedOrigins = [
            /^http:\/\/localhost(:\d+)?$/,
            /^http:\/\/127\.0\.0\.1(:\d+)?$/,
            /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
            /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
            /^http:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+(:\d+)?$/
        ];
        
        const isAllowed = allowedOrigins.some(regex => regex.test(origin));
        callback(null, isAllowed);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../frontend')));

// Enhanced Socket.IO server configuration
const io = new Server(server, {
    cors: {
        origin: function(origin, callback) {
            // Same CORS logic as Express
            if (!origin) return callback(null, true);
            
            const allowedOrigins = [
                /^http:\/\/localhost(:\d+)?$/,
                /^http:\/\/127\.0\.0\.1(:\d+)?$/,
                /^http:\/\/192\.168\.\d+\.\d+(:\d+)?$/,
                /^http:\/\/10\.\d+\.\d+\.\d+(:\d+)?$/,
                /^http:\/\/172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+(:\d+)?$/
            ];
            
            const isAllowed = allowedOrigins.some(regex => regex.test(origin));
            callback(null, isAllowed);
        },
        methods: ['GET', 'POST'],
        credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 10000,
    allowEIO3: true
});

// User management with enhanced tracking
const userRegistry = new Map(); // socketId -> user info
const idRegistry = new Map();   // uniqueId -> socket info
const connectionLog = new Map(); // Track connection attempts

// Get local network IP addresses
function getLocalIPAddresses() {
    const interfaces = os.networkInterfaces();
    const addresses = [];
    
    for (const name of Object.keys(interfaces)) {
        for (const interface of interfaces[name]) {
            // Skip over non-IPv4 and internal addresses
            if (interface.family === 'IPv4' && !interface.internal) {
                addresses.push(interface.address);
            }
        }
    }
    
    return addresses;
}

// Enhanced routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/api/health', (req, res) => {
    const networkInfo = getLocalIPAddresses();
    
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        activeConnections: io.engine.clientsCount,
        registeredUsers: userRegistry.size,
        networkAddresses: networkInfo,
        serverInfo: {
            nodeVersion: process.version,
            platform: process.platform,
            uptime: process.uptime()
        }
    });
});

app.get('/api/network-info', (req, res) => {
    const networkInfo = getLocalIPAddresses();
    res.json({
        localAddresses: networkInfo,
        publicAddress: req.ip,
        userAgent: req.get('User-Agent'),
        origin: req.get('Origin')
    });
});

// Enhanced Socket.IO event handlers
io.on('connection', (socket) => {
    const clientIP = socket.handshake.address;
    const userAgent = socket.handshake.headers['user-agent'];
    
    console.log(`New client connected: ${socket.id} from ${clientIP}`);
    console.log(`User-Agent: ${userAgent}`);
    
    // Enhanced user registration
    socket.on('details', (data) => {
        const { uniqueId } = data;
        const timestamp = new Date().toISOString();
        
        // Store enhanced user information
        const userInfo = {
            uniqueId: uniqueId,
            socketId: socket.id,
            connectedAt: timestamp,
            clientIP: clientIP,
            userAgent: userAgent,
            lastActivity: timestamp
        };
        
        userRegistry.set(socket.id, userInfo);
        idRegistry.set(uniqueId, {
            socketId: socket.id,
            ...userInfo
        });
        
        console.log(`User registered: ${uniqueId} -> ${socket.id}`);
        
        // Send confirmation back to client
        socket.emit('registration-confirmed', {
            uniqueId: uniqueId,
            serverTime: timestamp,
            connectedClients: io.engine.clientsCount
        });
        
        logUserRegistry();
    });
    
    // Enhanced WebRTC signaling with validation
    socket.on('send-signal', (data) => {
        const { from, to, signalData } = data;
        
        // Validate data
        if (!from || !to || !signalData) {
            socket.emit('error', { message: 'Invalid signal data' });
            return;
        }
        
        const targetInfo = idRegistry.get(to);
        
        if (targetInfo && targetInfo.socketId) {
            const targetSocketId = targetInfo.socketId;
            
            // Update last activity
            if (userRegistry.has(socket.id)) {
                userRegistry.get(socket.id).lastActivity = new Date().toISOString();
            }
            
            console.log(`Forwarding ${signalData.type || 'signal'} from ${from} to ${to}`);
            
            // Log connection attempts
            const connectionKey = `${from}->${to}`;
            connectionLog.set(connectionKey, {
                timestamp: new Date().toISOString(),
                signalType: signalData.type,
                status: 'forwarded'
            });
            
            socket.to(targetSocketId).emit('signaling', {
                from: from,
                signalData: signalData,
                to: to,
                timestamp: new Date().toISOString()
            });
        } else {
            console.log(`Target user ${to} not found or offline`);
            socket.emit('error', { 
                message: 'Target user not found or offline',
                targetId: to 
            });
            
            // Log failed attempt
            const connectionKey = `${from}->${to}`;
            connectionLog.set(connectionKey, {
                timestamp: new Date().toISOString(),
                signalType: signalData.type,
                status: 'failed - user not found'
            });
        }
    });
    
    // Enhanced accept signal handling
    socket.on('accept-signal', (data) => {
        const { to, signalData } = data;
        
        if (!to || !signalData) {
            socket.emit('error', { message: 'Invalid accept signal data' });
            return;
        }
        
        const targetInfo = idRegistry.get(to);
        
        if (targetInfo && targetInfo.socketId) {
            const targetSocketId = targetInfo.socketId;
            
            console.log(`Forwarding accept signal to ${to}`);
            
            socket.to(targetSocketId).emit('callAccepted', {
                signalData: signalData,
                to: to,
                timestamp: new Date().toISOString()
            });
        } else {
            console.log(`Target user ${to} not found for accept signal`);
            socket.emit('error', { 
                message: 'Target user not found for accept signal',
                targetId: to 
            });
        }
    });
    
    // Enhanced room functionality
    socket.on('joinRoom', (roomId) => {
        if (!roomId || typeof roomId !== 'string') {
            socket.emit('error', { message: 'Invalid room ID' });
            return;
        }
        
        socket.join(roomId);
        console.log(`User ${socket.id} joined room ${roomId}`);
        
        socket.emit('roomJoined', { 
            roomId: roomId,
            timestamp: new Date().toISOString()
        });
        
        // Notify others in the room
        socket.to(roomId).emit('userJoinedRoom', {
            socketId: socket.id,
            roomId: roomId,
            timestamp: new Date().toISOString()
        });
    });
    
    socket.on('leaveRoom', (roomId) => {
        if (!roomId || typeof roomId !== 'string') {
            socket.emit('error', { message: 'Invalid room ID' });
            return;
        }
        
        socket.leave(roomId);
        console.log(`User ${socket.id} left room ${roomId}`);
        
        // Notify others in the room
        socket.to(roomId).emit('userLeftRoom', {
            socketId: socket.id,
            roomId: roomId,
            timestamp: new Date().toISOString()
        });
    });
    
    socket.on('roomMessage', (data) => {
        const { roomId, message } = data;
        
        if (!roomId || !message) {
            socket.emit('error', { message: 'Invalid room message data' });
            return;
        }
        
        socket.to(roomId).emit('roomMessage', {
            from: socket.id,
            message: message,
            roomId: roomId,
            timestamp: new Date().toISOString()
        });
    });
    
    // Ping/pong for connection health
    socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date().toISOString() });
    });
    
    // Enhanced disconnection handling
    socket.on('disconnect', (reason) => {
        console.log(`Client disconnected: ${socket.id}, Reason: ${reason}`);
        
        // Clean up user registries
        const userInfo = userRegistry.get(socket.id);
        if (userInfo) {
            const { uniqueId } = userInfo;
            userRegistry.delete(socket.id);
            idRegistry.delete(uniqueId);
            
            console.log(`User ${uniqueId} removed from registry`);
            
            // Notify potentially connected peers
            const disconnectedAt = new Date().toISOString();
            socket.broadcast.emit('userDisconnected', {
                uniqueId: uniqueId,
                socketId: socket.id,
                disconnectedAt: disconnectedAt,
                reason: reason
            });
        }
        
        logUserRegistry();
    });
    
    // Enhanced error handling
    socket.on('error', (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
        
        // Log the error with context
        const userInfo = userRegistry.get(socket.id);
        const errorLog = {
            socketId: socket.id,
            uniqueId: userInfo ? userInfo.uniqueId : 'unknown',
            error: error.message || error,
            timestamp: new Date().toISOString(),
            clientIP: clientIP
        };
        
        console.error('Detailed error:', errorLog);
    });
    
    // Connection quality monitoring
    socket.on('connection-quality', (data) => {
        console.log(`Connection quality from ${socket.id}:`, data);
        
        // Could implement quality-based server selection here
        socket.emit('connection-quality-ack', {
            received: true,
            timestamp: new Date().toISOString()
        });
    });
});

/**
 * Enhanced user registry logging
 */
function logUserRegistry() {
    console.log('\n=== Current User Registry ===');
    console.log(`Active connections: ${io.engine.clientsCount}`);
    console.log(`Registered users: ${userRegistry.size}`);
    console.log(`ID mappings: ${idRegistry.size}`);
    
    if (userRegistry.size > 0) {
        console.log('\nActive users:');
        for (const [socketId, userInfo] of userRegistry) {
            console.log(`  ${userInfo.uniqueId} -> ${socketId} (${userInfo.clientIP})`);
        }
    }
    
    console.log('=============================\n');
}

/**
 * Periodic cleanup of stale connections and logs
 */
function performMaintenance() {
    const now = new Date();
    const staleThreshold = 30 * 60 * 1000; // 30 minutes
    
    // Clean up old connection logs
    for (const [key, logEntry] of connectionLog) {
        const logTime = new Date(logEntry.timestamp);
        if (now - logTime > staleThreshold) {
            connectionLog.delete(key);
        }
    }
    
    console.log('Maintenance completed');
}

// Run maintenance every 10 minutes
setInterval(performMaintenance, 10 * 60 * 1000);

/**
 * Graceful shutdown handler
 */
function gracefulShutdown() {
    console.log('\nReceived shutdown signal. Closing server...');
    
    // Notify all connected clients
    io.emit('serverShutdown', {
        message: 'Server is shutting down',
        timestamp: new Date().toISOString()
    });
    
    setTimeout(() => {
        server.close(() => {
            console.log('HTTP server closed');
            io.close(() => {
                console.log('Socket.IO server closed');
                process.exit(0);
            });
        });
    }, 1000); // Give clients 1 second to receive the message
    
    // Force close after 10 seconds
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
}

// Handle shutdown signals
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);
process.on('SIGQUIT', gracefulShutdown);

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown();
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
    gracefulShutdown();
});

// Start server
const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || '0.0.0.0'; // Listen on all interfaces

server.listen(PORT, HOST, () => {
    const networkAddresses = getLocalIPAddresses();
    
    console.log(`🚀 SovereignShare server running on port ${PORT}`);
    console.log(`🌐 Listening on host: ${HOST}`);
    console.log(`📱 Frontend available at:`);
    console.log(`   - http://localhost:${PORT}`);
    
    networkAddresses.forEach(addr => {
        console.log(`   - http://${addr}:${PORT}`);
    });
    
    console.log(`🔌 WebSocket endpoint: ws://${HOST}:${PORT}`);
    console.log(`📊 Health check: http://localhost:${PORT}/api/health`);
    console.log(`🌐 Network info: http://localhost:${PORT}/api/network-info`);
    console.log('\n📋 To connect from different networks:');
    console.log('1. Make sure both devices can reach this server');
    console.log('2. Use one of the network addresses shown above');
    console.log('3. Check firewall settings if connection fails');
    console.log('\nPress Ctrl+C to stop the server\n');
});

// Export for testing purposes
module.exports = { app, server, io };
