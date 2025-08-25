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
    origin: process.env.NODE_ENV === 'production' ? false : '*',
    credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Socket.IO server configuration
const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production' ? false : '*',
        methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling'], // Allow fallback to polling if websocket fails
    allowEIO3: true // Backward compatibility
});

// User management
const userRegistry = new Map(); // socketId -> uniqueId
const idRegistry = new Map();   // uniqueId -> socketId
const connectionTimes = new Map(); // uniqueId -> timestamp

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        timestamp: new Date().toISOString(),
        activeConnections: io.engine.clientsCount,
        registeredUsers: userRegistry.size,
        uptime: process.uptime()
    });
});

app.get('/api/stats', (req, res) => {
    const users = Array.from(userRegistry.entries()).map(([socketId, uniqueId]) => ({
        uniqueId,
        socketId,
        connectedAt: connectionTimes.get(uniqueId)
    }));
    
    res.json({
        totalConnections: io.engine.clientsCount,
        registeredUsers: userRegistry.size,
        users: users,
        serverStartTime: process.env.SERVER_START_TIME || 'Unknown'
    });
});

// Set server start time
process.env.SERVER_START_TIME = new Date().toISOString();

// Socket.IO event handlers
io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id} from ${socket.handshake.address}`);
    
    // Handle user registration
    socket.on('details', (data) => {
        try {
            const { uniqueId } = data;
            
            if (!uniqueId || typeof uniqueId !== 'string') {
                console.error(`Invalid uniqueId received from ${socket.id}`);
                socket.emit('error', { message: 'Invalid user ID format' });
                return;
            }
            
            // Check if uniqueId is already registered (duplicate connection)
            if (idRegistry.has(uniqueId)) {
                const existingSocketId = idRegistry.get(uniqueId);
                console.log(`Duplicate registration attempt for ${uniqueId}. Cleaning up old connection ${existingSocketId}`);
                
                // Clean up old connection
                userRegistry.delete(existingSocketId);
                // Notify the old socket if it still exists
                const existingSocket = io.sockets.sockets.get(existingSocketId);
                if (existingSocket) {
                    existingSocket.emit('error', { message: 'Connection replaced by new session' });
                }
            }
            
            // Store user mappings using actual socket.id
            userRegistry.set(socket.id, uniqueId);
            idRegistry.set(uniqueId, socket.id);
            connectionTimes.set(uniqueId, new Date().toISOString());
            
            console.log(`User registered: ${uniqueId} -> ${socket.id}`);
            socket.emit('registered', { uniqueId, socketId: socket.id });
            logUserRegistry();
            
        } catch (error) {
            console.error(`Error handling user registration from ${socket.id}:`, error);
            socket.emit('error', { message: 'Registration failed' });
        }
    });
    
    // Handle WebRTC signaling - sending offer/candidate/answer
    socket.on('send-signal', (data) => {
        try {
            const { from, to, signalData } = data;
            
            if (!from || !to || !signalData) {
                console.error(`Invalid signal data from ${socket.id}:`, data);
                socket.emit('error', { message: 'Invalid signal data format' });
                return;
            }
            
            // Verify sender identity
            const senderUniqueId = userRegistry.get(socket.id);
            if (senderUniqueId !== from) {
                console.error(`Identity mismatch: socket ${socket.id} claims to be ${from} but is registered as ${senderUniqueId}`);
                socket.emit('error', { message: 'Identity verification failed' });
                return;
            }
            
            const targetSocketId = idRegistry.get(to);
            
            if (targetSocketId) {
                console.log(`Forwarding ${signalData.type || 'signal'} from ${from} to ${to}`);
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
            }
            
        } catch (error) {
            console.error(`Error handling send-signal from ${socket.id}:`, error);
            socket.emit('error', { message: 'Signal processing failed' });
        }
    });
    
    // Handle WebRTC signaling - accepting call
    socket.on('accept-signal', (data) => {
        try {
            const { to, signalData } = data;
            
            if (!to || !signalData) {
                console.error(`Invalid accept signal data from ${socket.id}:`, data);
                socket.emit('error', { message: 'Invalid accept signal data format' });
                return;
            }
            
            const targetSocketId = idRegistry.get(to);
            
            if (targetSocketId) {
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
            
        } catch (error) {
            console.error(`Error handling accept-signal from ${socket.id}:`, error);
            socket.emit('error', { message: 'Accept signal processing failed' });
        }
    });
    
    // Handle call rejection
    socket.on('reject-signal', (data) => {
        try {
            const { to } = data;
            const targetSocketId = idRegistry.get(to);
            
            if (targetSocketId) {
                console.log(`Forwarding call rejection to ${to}`);
                socket.to(targetSocketId).emit('callRejected', {
                    from: userRegistry.get(socket.id),
                    timestamp: new Date().toISOString()
                });
            }
            
        } catch (error) {
            console.error(`Error handling reject-signal from ${socket.id}:`, error);
        }
    });
    
    // Handle room-based messaging (for future features)
    socket.on('joinRoom', (roomId) => {
        try {
            if (!roomId || typeof roomId !== 'string') {
                socket.emit('error', { message: 'Invalid room ID' });
                return;
            }
            
            socket.join(roomId);
            console.log(`User ${userRegistry.get(socket.id) || socket.id} joined room ${roomId}`);
            socket.emit('roomJoined', { 
                roomId: roomId,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error(`Error handling joinRoom from ${socket.id}:`, error);
            socket.emit('error', { message: 'Failed to join room' });
        }
    });
    
    socket.on('leaveRoom', (roomId) => {
        try {
            socket.leave(roomId);
            console.log(`User ${userRegistry.get(socket.id) || socket.id} left room ${roomId}`);
            socket.emit('roomLeft', { roomId: roomId });
        } catch (error) {
            console.error(`Error handling leaveRoom from ${socket.id}:`, error);
        }
    });
    
    socket.on('roomMessage', (data) => {
        try {
            const { roomId, message } = data;
            
            if (!roomId || !message) {
                socket.emit('error', { message: 'Invalid room message data' });
                return;
            }
            
            socket.to(roomId).emit('roomMessage', {
                from: userRegistry.get(socket.id) || socket.id,
                message: message,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error(`Error handling roomMessage from ${socket.id}:`, error);
        }
    });
    
    // Handle ping for connection health
    socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date().toISOString() });
    });
    
    // Handle user presence check
    socket.on('checkUser', (targetId) => {
        try {
            const isOnline = idRegistry.has(targetId);
            socket.emit('userStatus', { 
                targetId, 
                online: isOnline,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error(`Error checking user status:`, error);
            socket.emit('error', { message: 'Failed to check user status' });
        }
    });
    
    // Handle disconnection
    socket.on('disconnect', (reason) => {
        console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
        
        try {
            // Clean up user registries
            const uniqueId = userRegistry.get(socket.id);
            if (uniqueId) {
                userRegistry.delete(socket.id);
                idRegistry.delete(uniqueId);
                connectionTimes.delete(uniqueId);
                console.log(`User ${uniqueId} removed from registry`);
                
                // Notify other clients if needed (for future features)
                socket.broadcast.emit('userDisconnected', { 
                    userId: uniqueId,
                    timestamp: new Date().toISOString()
                });
            }
            
            logUserRegistry();
            
        } catch (error) {
            console.error(`Error handling disconnect for ${socket.id}:`, error);
        }
    });
    
    // Handle connection errors
    socket.on('connect_error', (error) => {
        console.error(`Connection error for ${socket.id}:`, error);
    });
    
    // Handle general errors
    socket.on('error', (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
    });
    
    // Send welcome message
    socket.emit('welcome', { 
        message: 'Connected to SovereignShare signaling server',
        socketId: socket.id,
        timestamp: new Date().toISOString()
    });
});

/**
 * Log current user registry state
 */
function logUserRegistry() {
    console.log('\n=== Current User Registry ===');
    console.log('Active connections:', io.engine.clientsCount);
    console.log('Registered users:', userRegistry.size);
    console.log('Server uptime:', Math.floor(process.uptime()), 'seconds');
    
    if (userRegistry.size > 0) {
        console.log('Registered users:');
        for (const [socketId, uniqueId] of userRegistry) {
            const connectedAt = connectionTimes.get(uniqueId);
            console.log(`  ${uniqueId} -> ${socketId} (connected: ${connectedAt})`);
        }
    }
    console.log('=============================\n');
}

/**
 * Cleanup stale connections periodically
 */
function cleanupStaleConnections() {
    console.log('Running connection cleanup...');
    
    const connectedSocketIds = new Set(Array.from(io.sockets.sockets.keys()));
    const registeredSocketIds = new Set(userRegistry.keys());
    
    // Find socket IDs in registry but not actually connected
    const staleSocketIds = Array.from(registeredSocketIds).filter(id => !connectedSocketIds.has(id));
    
    if (staleSocketIds.length > 0) {
        console.log(`Cleaning up ${staleSocketIds.length} stale connections`);
        
        staleSocketIds.forEach(socketId => {
            const uniqueId = userRegistry.get(socketId);
            if (uniqueId) {
                userRegistry.delete(socketId);
                idRegistry.delete(uniqueId);
                connectionTimes.delete(uniqueId);
                console.log(`Cleaned up stale connection: ${uniqueId} -> ${socketId}`);
            }
        });
        
        logUserRegistry();
    }
}

// Run cleanup every 5 minutes
setInterval(cleanupStaleConnections, 5 * 60 * 1000);

/**
 * Graceful shutdown handler
 */
function gracefulShutdown(signal) {
    console.log(`\nReceived ${signal}. Starting graceful shutdown...`);
    
    // Stop accepting new connections
    server.close(() => {
        console.log('HTTP server closed');
        
        // Close all socket connections
        io.close(() => {
            console.log('Socket.IO server closed');
            console.log('Graceful shutdown completed');
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
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start server
const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || 'localhost';

server.listen(PORT, HOST, () => {
    console.log(`🚀 SovereignShare server running on http://${HOST}:${PORT}`);
    console.log(`📱 Frontend available at: http://${HOST}:${PORT}`);
    console.log(`🔌 WebSocket endpoint: ws://${HOST}:${PORT}`);
    console.log(`📊 Health check: http://${HOST}:${PORT}/api/health`);
    console.log(`📈 Stats endpoint: http://${HOST}:${PORT}/api/stats`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log('\nPress Ctrl+C to stop the server\n');
    
    logUserRegistry();
});

// Export for testing purposes
module.exports = { app, server, io, userRegistry, idRegistry };
