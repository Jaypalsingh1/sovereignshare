const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);

app.use(cors({
    origin: process.env.NODE_ENV === 'production' ? false : '*',
    credentials: true
}));

app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

const io = new Server(server, {
    cors: {
        origin: process.env.NODE_ENV === 'production' ? false : '*',
        methods: ['GET', 'POST']
    },
    transports: ['websocket', 'polling'],
    allowEIO3: true
});

const userRegistry = new Map();
const idRegistry = new Map();
const connectionTimes = new Map();

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

process.env.SERVER_START_TIME = new Date().toISOString();

io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);
    
    socket.on('details', (data) => {
        try {
            const { uniqueId } = data;
            
            if (!uniqueId || typeof uniqueId !== 'string') {
                socket.emit('error', { message: 'Invalid user ID format' });
                return;
            }
            
            if (idRegistry.has(uniqueId)) {
                const existingSocketId = idRegistry.get(uniqueId);
                userRegistry.delete(existingSocketId);
                const existingSocket = io.sockets.sockets.get(existingSocketId);
                if (existingSocket) {
                    existingSocket.emit('error', { message: 'Connection replaced by new session' });
                }
            }
            
            userRegistry.set(socket.id, uniqueId);
            idRegistry.set(uniqueId, socket.id);
            connectionTimes.set(uniqueId, new Date().toISOString());
            
            socket.emit('registered', { uniqueId, socketId: socket.id });
            
        } catch (error) {
            console.error(`Error handling user registration:`, error);
            socket.emit('error', { message: 'Registration failed' });
        }
    });
    
    socket.on('send-signal', (data) => {
        try {
            const { from, to, signalData } = data;
            
            if (!from || !to || !signalData) {
                socket.emit('error', { message: 'Invalid signal data format' });
                return;
            }
            
            const senderUniqueId = userRegistry.get(socket.id);
            if (senderUniqueId !== from) {
                socket.emit('error', { message: 'Identity verification failed' });
                return;
            }
            
            const targetSocketId = idRegistry.get(to);
            
            if (targetSocketId) {
                socket.to(targetSocketId).emit('signaling', {
                    from: from,
                    signalData: signalData,
                    to: to,
                    timestamp: new Date().toISOString()
                });
            } else {
                socket.emit('error', { 
                    message: 'Target user not found or offline',
                    targetId: to 
                });
            }
            
        } catch (error) {
            console.error(`Error handling send-signal:`, error);
            socket.emit('error', { message: 'Signal processing failed' });
        }
    });
    
    socket.on('accept-signal', (data) => {
        try {
            const { to, signalData } = data;
            
            if (!to || !signalData) {
                socket.emit('error', { message: 'Invalid accept signal data format' });
                return;
            }
            
            const targetSocketId = idRegistry.get(to);
            
            if (targetSocketId) {
                socket.to(targetSocketId).emit('callAccepted', {
                    signalData: signalData,
                    to: to,
                    timestamp: new Date().toISOString()
                });
            } else {
                socket.emit('error', { 
                    message: 'Target user not found for accept signal',
                    targetId: to 
                });
            }
            
        } catch (error) {
            console.error(`Error handling accept-signal:`, error);
            socket.emit('error', { message: 'Accept signal processing failed' });
        }
    });
    
    socket.on('reject-signal', (data) => {
        try {
            const { to } = data;
            const targetSocketId = idRegistry.get(to);
            
            if (targetSocketId) {
                socket.to(targetSocketId).emit('callRejected', {
                    from: userRegistry.get(socket.id),
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error(`Error handling reject-signal:`, error);
        }
    });
    
    socket.on('joinRoom', (roomId) => {
        try {
            if (!roomId || typeof roomId !== 'string') {
                socket.emit('error', { message: 'Invalid room ID' });
                return;
            }
            
            socket.join(roomId);
            socket.emit('roomJoined', { 
                roomId: roomId,
                timestamp: new Date().toISOString()
            });
            
        } catch (error) {
            console.error(`Error handling joinRoom:`, error);
            socket.emit('error', { message: 'Failed to join room' });
        }
    });
    
    socket.on('leaveRoom', (roomId) => {
        try {
            socket.leave(roomId);
            socket.emit('roomLeft', { roomId: roomId });
        } catch (error) {
            console.error(`Error handling leaveRoom:`, error);
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
            console.error(`Error handling roomMessage:`, error);
        }
    });
    
    socket.on('ping', () => {
        socket.emit('pong', { timestamp: new Date().toISOString() });
    });
    
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
    
    socket.on('disconnect', (reason) => {
        console.log(`Client disconnected: ${socket.id}`);
        
        try {
            const uniqueId = userRegistry.get(socket.id);
            if (uniqueId) {
                userRegistry.delete(socket.id);
                idRegistry.delete(uniqueId);
                connectionTimes.delete(uniqueId);
                
                socket.broadcast.emit('userDisconnected', { 
                    userId: uniqueId,
                    timestamp: new Date().toISOString()
                });
            }
        } catch (error) {
            console.error(`Error handling disconnect:`, error);
        }
    });
    
    socket.on('connect_error', (error) => {
        console.error(`Connection error for ${socket.id}:`, error);
    });
    
    socket.on('error', (error) => {
        console.error(`Socket error for ${socket.id}:`, error);
    });
    
    socket.emit('welcome', { 
        message: 'Connected to SovereignShare signaling server',
        socketId: socket.id,
        timestamp: new Date().toISOString()
    });
});

function cleanupStaleConnections() {
    const connectedSocketIds = new Set(Array.from(io.sockets.sockets.keys()));
    const registeredSocketIds = new Set(userRegistry.keys());
    
    const staleSocketIds = Array.from(registeredSocketIds).filter(id => !connectedSocketIds.has(id));
    
    if (staleSocketIds.length > 0) {
        staleSocketIds.forEach(socketId => {
            const uniqueId = userRegistry.get(socketId);
            if (uniqueId) {
                userRegistry.delete(socketId);
                idRegistry.delete(uniqueId);
                connectionTimes.delete(uniqueId);
            }
        });
    }
}

setInterval(cleanupStaleConnections, 5 * 60 * 1000);

function gracefulShutdown(signal) {
    console.log(`Received ${signal}. Starting graceful shutdown...`);
    
    server.close(() => {
        console.log('HTTP server closed');
        
        io.close(() => {
            console.log('Socket.IO server closed');
            process.exit(0);
        });
    });
    
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

process.on('uncaughtException', (error) => {
    console.error('Uncaught Exception:', error);
    gracefulShutdown('uncaughtException');
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

const PORT = process.env.PORT || 8000;
const HOST = process.env.HOST || 'localhost';

server.listen(PORT, HOST, () => {
    console.log(`SovereignShare server running on http://${HOST}:${PORT}`);
    console.log(`Frontend available at: http://${HOST}:${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

module.exports = { app, server, io, userRegistry, idRegistry };
