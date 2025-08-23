/**
 * SovereignShare - P2P File Exchange & Chat Application
 * Built with vanilla JavaScript, WebRTC, and Socket.IO
 * Enhanced for cross-network connectivity while preserving all original features
 */

class SovereignShare {
    constructor() {
        this.socket = null;
        this.peerConnection = null;
        this.dataChannel = null;
        this.userId = null;
        this.partnerId = null;
        this.isConnected = false;
        this.isInitiator = false;
        this.currentFile = null;
        this.fileChunks = [];
        this.fileInfo = null;
        this.chunkSize = 16 * 1024; // 16KB chunks
        this.connectionTimeout = null;
        this.iceGatheringTimeout = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.generateUserId();
        this.setupTheme();
        this.initializeSocket();
    }

    /**
     * Initialize DOM element references
     */
    initializeElements() {
        // Connection elements
        this.myIdInput = document.getElementById('myId');
        this.peerIdInput = document.getElementById('peerId');
        this.connectBtn = document.getElementById('connectBtn');
        this.copyIdBtn = document.getElementById('copyIdBtn');
        this.shareLinkBtn = document.getElementById('shareLinkBtn');
        this.statusIndicator = document.getElementById('statusIndicator');
        this.statusText = document.getElementById('statusText');
        this.disconnectBtn = document.getElementById('disconnectBtn');
        this.incomingCall = document.getElementById('incomingCall');
        this.callerId = document.getElementById('callerId');
        this.acceptCallBtn = document.getElementById('acceptCallBtn');
        this.rejectCallBtn = document.getElementById('rejectCallBtn');

        // File transfer elements
        this.fileUploadArea = document.getElementById('fileUploadArea');
        this.uploadZone = document.getElementById('uploadZone');
        this.fileInput = document.getElementById('fileInput');
        this.browseBtn = document.getElementById('browseBtn');
        this.fileProgress = document.getElementById('fileProgress');
        this.fileName = document.getElementById('fileName');
        this.progressPercent = document.getElementById('progressPercent');
        this.progressFill = document.getElementById('progressFill');
        this.sendFileBtn = document.getElementById('sendFileBtn');
        this.downloadFileBtn = document.getElementById('downloadFileBtn');

        // Chat elements
        this.chatPanel = document.getElementById('chatPanel');
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendMessageBtn = document.getElementById('sendMessageBtn');

        // Modal elements
        this.shareModal = document.getElementById('shareModal');
        this.shareLinkInput = document.getElementById('shareLinkInput');
        this.copyLinkBtn = document.getElementById('copyLinkBtn');
        this.closeShareModal = document.getElementById('closeShareModal');

        // Theme toggle
        this.themeToggle = document.getElementById('themeToggle');
        this.notifications = document.getElementById('notifications');
    }

    /**
     * Set up event listeners for user interactions
     */
    setupEventListeners() {
        // Connection events
        this.connectBtn.addEventListener('click', () => this.initiateConnection());
        this.copyIdBtn.addEventListener('click', () => this.copyToClipboard(this.userId));
        this.shareLinkBtn.addEventListener('click', () => this.showShareModal());
        this.disconnectBtn.addEventListener('click', () => this.terminateConnection());
        this.acceptCallBtn.addEventListener('click', () => this.acceptIncomingCall());
        this.rejectCallBtn.addEventListener('click', () => this.rejectIncomingCall());

        // File transfer events
        this.browseBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelection(e));
        this.sendFileBtn.addEventListener('click', () => this.sendFile());
        this.downloadFileBtn.addEventListener('click', () => this.downloadFile());

        // Drag and drop events
        this.uploadZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadZone.addEventListener('drop', (e) => this.handleFileDrop(e));
        this.uploadZone.addEventListener('dragleave', () => this.uploadZone.classList.remove('dragover'));
        this.uploadZone.addEventListener('click', () => this.fileInput.click());

        // Chat events
        this.sendMessageBtn.addEventListener('click', () => this.sendChatMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChatMessage();
        });

        // Modal events
        this.closeShareModal.addEventListener('click', () => this.hideShareModal());
        this.copyLinkBtn.addEventListener('click', () => this.copyToClipboard(this.shareLinkInput.value));
        this.shareModal.addEventListener('click', (e) => {
            if (e.target === this.shareModal) this.hideShareModal();
        });

        // Theme toggle
        this.themeToggle.addEventListener('click', () => this.toggleTheme());

        // URL parameters for incoming connections
        this.checkUrlParameters();
    }

    /**
     * Initialize Socket.IO connection with dynamic server detection
     */
    initializeSocket() {
        // Try to detect the server URL dynamically
        const serverUrl = this.getServerUrl();
        console.log('Connecting to server:', serverUrl);
        
        this.socket = io(serverUrl, {
            transports: ['websocket', 'polling'], // Fallback transport options
            timeout: 10000,
            reconnection: true,
            reconnectionAttempts: 5,
            reconnectionDelay: 1000,
            forceNew: true
        });
        
        this.socket.on('connect', () => {
            console.log('Connected to signaling server');
            this.updateStatus('Connected to server', 'info');
            
            // Register user after socket connection is established
            this.registerUser();
        });

        this.socket.on('disconnect', (reason) => {
            console.log('Disconnected from signaling server:', reason);
            this.updateStatus('Disconnected from server', 'error');
        });

        this.socket.on('connect_error', (error) => {
            console.error('Connection error:', error);
            this.updateStatus('Failed to connect to server', 'error');
            this.showNotification('Failed to connect to server. Check your connection.', 'error');
        });

        this.socket.on('registration-confirmed', (data) => {
            console.log('Registration confirmed:', data);
            this.updateStatus('Ready to connect', 'info');
        });

        this.socket.on('signaling', (data) => {
            this.handleIncomingCall(data);
        });

        this.socket.on('callAccepted', (data) => {
            this.handleCallAccepted(data);
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            this.showNotification('Server error: ' + error.message, 'error');
        });

        this.socket.on('userDisconnected', (data) => {
            if (data.uniqueId === this.partnerId) {
                this.showNotification('Partner disconnected', 'info');
                this.handleDisconnection();
            }
        });
    }

    /**
     * Get server URL based on current environment
     */
    getServerUrl() {
        // If running in production or on different networks
        if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
            return window.location.origin;
        }
        
        // For local development, try to detect the actual IP
        return 'http://localhost:8000';
    }

    /**
     * Generate unique user ID
     */
    generateUserId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 10; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        this.userId = result;
        if (this.myIdInput) {
            this.myIdInput.value = this.userId;
        }
        console.log('Generated user ID:', this.userId);
    }

    /**
     * Register user with server after connection is established
     */
    registerUser() {
        if (this.userId && this.socket && this.socket.connected) {
            this.socket.emit('details', {
                uniqueId: this.userId
            });
            console.log(`Registering user: ${this.userId}`);
        } else {
            console.warn('Cannot register user - missing userId or socket connection');
        }
    }

    /**
     * Check URL parameters for incoming connections
     */
    checkUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const peerCode = urlParams.get('code');
        if (peerCode && this.peerIdInput) {
            this.peerIdInput.value = peerCode;
            this.updateStatus('Peer ID loaded from URL', 'info');
        }
    }

    /**
     * Set up theme system
     */
    setupTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }

    /**
     * Toggle between light and dark themes
     */
    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon(newTheme);
        this.showNotification(`Switched to ${newTheme} theme`, 'info');
    }

    /**
     * Update theme toggle icon
     */
    updateThemeIcon(theme) {
        if (this.themeToggle) {
            const icon = this.themeToggle.querySelector('i');
            if (icon) {
                if (theme === 'dark') {
                    icon.className = 'fas fa-sun';
                } else {
                    icon.className = 'fas fa-moon';
                }
            }
        }
    }

    /**
     * Initiate WebRTC connection
     */
    async initiateConnection() {
        const peerId = this.peerIdInput.value.trim();
        
        if (!peerId || peerId.length !== 10) {
            this.showNotification('Please enter a valid 10-character peer ID', 'error');
            return;
        }

        if (peerId === this.userId) {
            this.showNotification('Cannot connect to yourself', 'error');
            return;
        }

        // Check socket connection
        if (!this.socket || !this.socket.connected) {
            this.showNotification('Not connected to server. Please wait...', 'error');
            return;
        }

        this.partnerId = peerId;
        this.isInitiator = true;
        this.updateStatus('Initiating connection...', 'connecting');
        this.connectBtn.disabled = true;

        try {
            await this.createPeerConnection();
            this.createDataChannel();
            
            // Wait a moment for ICE candidates to be gathered
            setTimeout(async () => {
                await this.createOffer();
            }, 1000);
            
        } catch (error) {
            console.error('Connection failed:', error);
            this.showNotification('Connection failed: ' + error.message, 'error');
            this.handleConnectionFailure();
        }
    }

    /**
     * Create WebRTC peer connection with enhanced TURN servers
     */
    async createPeerConnection() {
        const configuration = {
            iceServers: [
                // Google STUN servers
                {
                    urls: [
                        "stun:stun.l.google.com:19302",
                        "stun:stun1.l.google.com:19302",
                        "stun:stun2.l.google.com:19302",
                        "stun:stun3.l.google.com:19302",
                        "stun:stun4.l.google.com:19302"
                    ]
                },
                // Open Relay Project - Free and reliable TURN servers
                {
                    urls: [
                        "turn:openrelay.metered.ca:80",
                        "turn:openrelay.metered.ca:443"
                    ],
                    username: "openrelayproject",
                    credential: "openrelayproject"
                },
                {
                    urls: [
                        "turn:openrelay.metered.ca:443?transport=tcp"
                    ],
                    username: "openrelayproject",
                    credential: "openrelayproject"
                },
                // Numb TURN server (backup)
                {
                    urls: [
                        "turn:numb.viagenie.ca:3478"
                    ],
                    username: "webrtc@live.com",
                    credential: "muazkh"
                }
            ],
            iceCandidatePoolSize: 10, // Pre-gather ICE candidates
            iceTransportPolicy: 'all', // Use both STUN and TURN
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require'
        };
          
        this.peerConnection = new RTCPeerConnection(configuration);
        
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sending ICE candidate:', event.candidate);
                this.socket.emit('send-signal', {
                    from: this.userId,
                    to: this.partnerId,
                    signalData: {
                        type: 'ice-candidate',
                        candidate: event.candidate
                    }
                });
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.peerConnection.connectionState);
            
            switch (this.peerConnection.connectionState) {
                case 'connected':
                    this.clearConnectionTimeout();
                    break;
                case 'disconnected':
                    this.updateStatus('Connection lost', 'error');
                    break;
                case 'failed':
                    this.handleConnectionFailure();
                    break;
                case 'closed':
                    this.handleDisconnection();
                    break;
            }
        };

        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', this.peerConnection.iceConnectionState);
            
            switch (this.peerConnection.iceConnectionState) {
                case 'connected':
                case 'completed':
                    this.clearConnectionTimeout();
                    break;
                case 'failed':
                    this.handleConnectionFailure();
                    break;
                case 'disconnected':
                    if (this.isConnected) {
                        this.attemptReconnection();
                    }
                    break;
            }
        };

        // Set connection timeout
        this.setConnectionTimeout();
    }

    /**
     * Create data channel for file transfer and chat
     */
    createDataChannel() {
        this.dataChannel = this.peerConnection.createDataChannel('fileTransfer', {
            ordered: true
        });
        
        this.setupDataChannel();
    }

    /**
     * Set up data channel event handlers
     */
    setupDataChannel() {
        this.dataChannel.onopen = () => {
            console.log('Data channel opened');
            this.isConnected = true;
            this.updateStatus(`Connected to ${this.partnerId}`, 'connected');
            this.showChatPanel();
            this.showNotification('Connection established successfully!', 'success');
            this.clearConnectionTimeout();
        };

        this.dataChannel.onclose = () => {
            console.log('Data channel closed');
            this.handleDisconnection();
        };

        this.dataChannel.onerror = (error) => {
            console.error('Data channel error:', error);
            this.showNotification('Connection error occurred', 'error');
        };

        this.dataChannel.onmessage = (event) => {
            this.handleDataChannelMessage(event.data);
        };
    }

    /**
     * Create and send offer
     */
    async createOffer() {
        try {
            console.log('Creating offer...');
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            this.socket.emit('send-signal', {
                from: this.userId,
                to: this.partnerId,
                signalData: {
                    type: 'offer',
                    sdp: offer.sdp
                }
            });
            
            console.log('Offer sent');
        } catch (error) {
            console.error('Error creating offer:', error);
            throw error;
        }
    }

    /**
     * Handle incoming call
     */
    handleIncomingCall(data) {
        console.log('Incoming signal:', data);
        
        const { signalData } = data;
        
        // Handle different types of signals
        if (signalData.type === 'offer') {
            this.partnerId = data.from;
            this.signalingData = signalData;
            if (this.callerId) {
                this.callerId.textContent = data.from;
            }
            if (this.incomingCall) {
                this.incomingCall.style.display = 'block';
            }
            this.updateStatus('Incoming connection request', 'connecting');
        } else if (signalData.type === 'ice-candidate') {
            this.handleIceCandidate(signalData.candidate);
        }
    }

    /**
     * Accept incoming call
     */
    async acceptIncomingCall() {
        try {
            console.log('Accepting incoming call...');
            await this.createPeerConnection();
            this.setupPeerConnectionHandlers();
            
            const offer = {
                type: 'offer',
                sdp: this.signalingData.sdp
            };
            
            await this.peerConnection.setRemoteDescription(offer);
            
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            this.socket.emit('accept-signal', {
                to: this.partnerId,
                signalData: {
                    type: 'answer',
                    sdp: answer.sdp
                }
            });
            
            if (this.incomingCall) {
                this.incomingCall.style.display = 'none';
            }
            this.isInitiator = false;
        } catch (error) {
            console.error('Error accepting call:', error);
            this.showNotification('Failed to accept connection', 'error');
            this.handleConnectionFailure();
        }
    }

    /**
     * Reject incoming call
     */
    rejectIncomingCall() {
        if (this.incomingCall) {
            this.incomingCall.style.display = 'none';
        }
        this.resetConnectionState();
        this.updateStatus('Call rejected', 'info');
    }

    /**
     * Handle call accepted
     */
    handleCallAccepted(data) {
        console.log('Call accepted:', data);
        if (this.peerConnection && data.signalData.type === 'answer') {
            const answer = {
                type: 'answer',
                sdp: data.signalData.sdp
            };
            
            this.peerConnection.setRemoteDescription(answer)
                .then(() => {
                    console.log('Remote description set successfully');
                })
                .catch(error => {
                    console.error('Error setting remote description:', error);
                    this.handleConnectionFailure();
                });
        } else if (data.signalData.type === 'ice-candidate') {
            this.handleIceCandidate(data.signalData.candidate);
        }
    }

    /**
     * Handle ICE candidate
     */
    handleIceCandidate(candidate) {
        if (this.peerConnection && candidate) {
            this.peerConnection.addIceCandidate(candidate).catch(error => {
                console.error('Error adding ICE candidate:', error);
            });
        }
    }

    /**
     * Set up peer connection handlers for non-initiator
     */
    setupPeerConnectionHandlers() {
        this.peerConnection.ondatachannel = (event) => {
            this.dataChannel = event.channel;
            this.setupDataChannel();
        };
    }

    /**
     * Handle data channel messages
     */
    handleDataChannelMessage(data) {
        try {
            const parsedData = JSON.parse(data);
            
            if (parsedData.type === 'chat') {
                this.handleChatMessage(parsedData);
            } else if (parsedData.type === 'fileInfo') {
                this.handleFileInfo(parsedData);
            } else if (parsedData.type === 'fileChunk') {
                this.handleFileChunk(parsedData);
            } else if (parsedData.type === 'fileComplete') {
                this.handleFileComplete(parsedData);
            }
        } catch (error) {
            console.error('Error parsing message:', error);
        }
    }

    /**
     * Handle chat messages
     */
    handleChatMessage(data) {
        this.addChatMessage(data.text, 'other');
    }

    /**
     * Handle file information
     */
    handleFileInfo(data) {
        this.fileInfo = data;
        if (this.fileName) {
            this.fileName.textContent = data.fileName;
        }
        if (this.fileProgress) {
            this.fileProgress.style.display = 'block';
        }
        if (this.downloadFileBtn) {
            this.downloadFileBtn.style.display = 'block';
        }
        this.updateStatus('Receiving file...', 'info');
        this.fileChunks = []; // Reset chunks array
    }

    /**
     * Handle file chunks
     */
    handleFileChunk(data) {
        this.fileChunks.push(new Uint8Array(data.chunk));
        const progress = (this.fileChunks.length / data.totalChunks) * 100;
        this.updateFileProgress(progress);
    }

    /**
     * Handle file completion
     */
    handleFileComplete(data) {
        const blob = new Blob(this.fileChunks, { type: data.fileType });
        this.currentFile = {
            name: data.fileName,
            type: data.fileType,
            size: data.fileSize,
            blob: blob
        };
        
        this.fileChunks = [];
        this.updateFileProgress(100);
        this.showNotification('File received successfully!', 'success');
        this.updateStatus(`Connected to ${this.partnerId}`, 'connected');
    }

    /**
     * Handle file selection
     */
    handleFileSelection(event) {
        const files = event.target.files;
        if (files.length > 0) {
            this.currentFile = files[0];
            if (this.fileName) {
                this.fileName.textContent = this.currentFile.name;
            }
            if (this.fileProgress) {
                this.fileProgress.style.display = 'block';
            }
            if (this.sendFileBtn) {
                this.sendFileBtn.style.display = 'block';
            }
            if (this.downloadFileBtn) {
                this.downloadFileBtn.style.display = 'none';
            }
            this.updateFileProgress(0);
        }
    }

    /**
     * Handle file drop
     */
    handleFileDrop(event) {
        event.preventDefault();
        this.uploadZone.classList.remove('dragover');
        
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            this.fileInput.files = files;
            this.handleFileSelection({ target: { files: files } });
        }
    }

    /**
     * Handle drag over
     */
    handleDragOver(event) {
        event.preventDefault();
        this.uploadZone.classList.add('dragover');
    }

    /**
     * Send file via WebRTC
     */
    async sendFile() {
        if (!this.currentFile || !this.isConnected) {
            this.showNotification('No file selected or not connected', 'error');
            return;
        }

        try {
            const file = this.currentFile;
            const totalChunks = Math.ceil(file.size / this.chunkSize);
            
            // Send file info
            const fileInfo = {
                type: 'fileInfo',
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                totalChunks: totalChunks
            };
            
            this.dataChannel.send(JSON.stringify(fileInfo));
            this.updateStatus('Sending file...', 'info');
            
            // Send file in chunks
            for (let i = 0; i < totalChunks; i++) {
                const start = i * this.chunkSize;
                const end = Math.min(start + this.chunkSize, file.size);
                const chunk = file.slice(start, end);
                
                const arrayBuffer = await chunk.arrayBuffer();
                const chunkData = {
                    type: 'fileChunk',
                    chunk: Array.from(new Uint8Array(arrayBuffer)),
                    chunkIndex: i,
                    totalChunks: totalChunks
                };
                
                this.dataChannel.send(JSON.stringify(chunkData));
                this.updateFileProgress((i + 1) / totalChunks * 100);
                
                // Small delay to prevent overwhelming the connection
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            
            // Send completion signal
            const completionData = {
                type: 'fileComplete',
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type
            };
            
            this.dataChannel.send(JSON.stringify(completionData));
            this.showNotification('File sent successfully!', 'success');
            this.updateStatus(`Connected to ${this.partnerId}`, 'connected');
            
        } catch (error) {
            console.error('Error sending file:', error);
            this.showNotification('Failed to send file', 'error');
        }
    }

    /**
     * Download received file
     */
    downloadFile() {
        if (!this.currentFile) {
            this.showNotification('No file to download', 'error');
            return;
        }

        const url = URL.createObjectURL(this.currentFile.blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = this.currentFile.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showNotification('File download started', 'success');
    }

    /**
     * Send chat message
     */
    sendChatMessage() {
        const message = this.messageInput.value.trim();
        if (!message || !this.isConnected) return;

        this.addChatMessage(message, 'me');
        
        if (this.dataChannel && this.dataChannel.readyState === 'open') {
            const messageData = {
                type: 'chat',
                text: message,
                timestamp: new Date().toISOString()
            };
            this.dataChannel.send(JSON.stringify(messageData));
        }
        
        this.messageInput.value = '';
    }

    /**
     * Add chat message to UI
     */
    addChatMessage(text, sender) {
        if (!this.chatMessages) return;
        
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const timestamp = new Date().toLocaleTimeString();
        messageDiv.innerHTML = `
            <div class="message-content">
                <span class="message-text">${this.escapeHtml(text)}</span>
                <span class="message-time">${timestamp}</span>
            </div>
        `;
        
        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    /**
     * Escape HTML to prevent XSS
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Show chat panel
     */
    showChatPanel() {
        if (this.chatPanel) {
            this.chatPanel.style.display = 'block';
        }
    }

    /**
     * Hide chat panel
     */
    hideChatPanel() {
        if (this.chatPanel) {
            this.chatPanel.style.display = 'none';
        }
    }

    /**
     * Update file progress
     */
    updateFileProgress(percent) {
        if (this.progressPercent) {
            this.progressPercent.textContent = Math.round(percent) + '%';
        }
        if (this.progressFill) {
            this.progressFill.style.width = percent + '%';
        }
    }

    /**
     * Update connection status
     */
    updateStatus(text, type = 'info') {
        if (this.statusText) {
            this.statusText.textContent = text;
        }
        if (this.statusIndicator) {
            this.statusIndicator.className = `status-indicator ${type}`;
        }
        
        if (type === 'connected') {
            if (this.disconnectBtn) this.disconnectBtn.style.display = 'block';
            if (this.connectBtn) this.connectBtn.style.display = 'none';
        } else {
            if (this.disconnectBtn) this.disconnectBtn.style.display = 'none';
            if (this.connectBtn) this.connectBtn.style.display = 'block';
        }
    }

    /**
     * Set connection timeout to handle stuck connections
     */
    setConnectionTimeout() {
        this.connectionTimeout = setTimeout(() => {
            if (this.peerConnection && 
                this.peerConnection.connectionState !== 'connected' &&
                this.peerConnection.connectionState !== 'closed') {
                console.log('Connection timeout - attempting reconnection');
                this.handleConnectionFailure();
            }
        }, 30000); // 30 seconds timeout
    }

    /**
     * Clear connection timeout
     */
    clearConnectionTimeout() {
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
    }

    /**
     * Handle connection failure
     */
    handleConnectionFailure() {
        console.log('Connection failed - cleaning up');
        this.clearConnectionTimeout();
        
        this.showNotification('Connection failed. Please try again.', 'error');
        this.updateStatus('Connection failed', 'error');
        
        // Clean up the failed connection
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }
        
        this.resetConnectionState();
    }

    /**
     * Attempt reconnection
     */
    attemptReconnection() {
        if (!this.isConnected && this.partnerId) {
            console.log('Attempting to reconnect...');
            this.updateStatus('Reconnecting...', 'connecting');
            
            // Wait a bit before reconnecting
            setTimeout(() => {
                if (!this.isConnected) {
                    this.initiateConnection();
                }
            }, 2000);
        }
    }

    /**
     * Terminate connection
     */
    terminateConnection() {
        if (this.dataChannel) {
            this.dataChannel.close();
        }
        if (this.peerConnection) {
            this.peerConnection.close();
        }
        this.handleDisconnection();
    }

    /**
     * Handle disconnection
     */
    handleDisconnection() {
        this.isConnected = false;
        this.isInitiator = false;
        this.partnerId = null;
        this.currentFile = null;
        this.fileChunks = [];
        this.fileInfo = null;
        
        this.resetConnectionState();
        this.hideChatPanel();
        this.hideFileProgress();
        this.updateStatus('Not connected');
        
        this.showNotification('Connection terminated', 'info');
    }

    /**
     * Reset connection state
     */
    resetConnectionState() {
        if (this.connectBtn) {
            this.connectBtn.disabled = false;
        }
        this.peerConnection = null;
        this.dataChannel = null;
        this.clearConnectionTimeout();
    }

    /**
     * Hide file progress
     */
    hideFileProgress() {
        if (this.fileProgress) {
            this.fileProgress.style.display = 'none';
        }
        if (this.sendFileBtn) {
            this.sendFileBtn.style.display = 'none';
        }
        if (this.downloadFileBtn) {
            this.downloadFileBtn.style.display = 'none';
        }
    }

    /**
     * Show share modal
     */
    showShareModal() {
        const shareUrl = `${window.location.origin}?code=${this.userId}`;
        if (this.shareLinkInput) {
            this.shareLinkInput.value = shareUrl;
        }
        if (this.shareModal) {
            this.shareModal.classList.add('show');
        }
    }

    /**
     * Hide share modal
     */
    hideShareModal() {
        if (this.shareModal) {
            this.shareModal.classList.remove('show');
        }
    }

    /**
     * Copy text to clipboard
     */
    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showNotification('Copied to clipboard!', 'success');
        } catch (error) {
            console.error('Failed to copy:', error);
            
            // Fallback method for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            try {
                document.execCommand('copy');
                this.showNotification('Copied to clipboard!', 'success');
            } catch (fallbackError) {
                console.error('Fallback copy failed:', fallbackError);
                this.showNotification('Failed to copy to clipboard', 'error');
            }
            document.body.removeChild(textArea);
        }
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        if (!this.notifications) return;
        
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icon = document.createElement('i');
        icon.className = this.getNotificationIcon(type);
        
        const text = document.createElement('span');
        text.textContent = message;
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'notification-close';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = () => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        };
        
        notification.appendChild(icon);
        notification.appendChild(text);
        notification.appendChild(closeBtn);
        
        this.notifications.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.classList.add('show');
        }, 100);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.remove('show');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 5000);
    }

    /**
     * Get notification icon based on type
     */
    getNotificationIcon(type) {
        switch (type) {
            case 'success': return 'fas fa-check-circle';
            case 'error': return 'fas fa-exclamation-circle';
            case 'warning': return 'fas fa-exclamation-triangle';
            case 'connecting': return 'fas fa-spinner fa-spin';
            default: return 'fas fa-info-circle';
        }
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, initializing SovereignShare...');
    try {
        new SovereignShare();
        console.log('SovereignShare initialized successfully');
    } catch (error) {
        console.error('Failed to initialize SovereignShare:', error);
    }
});
