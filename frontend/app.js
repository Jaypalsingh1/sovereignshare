/**
 * SovereignShare - P2P File Exchange & Chat Application
 * Built with vanilla JavaScript, WebRTC, and Socket.IO
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
        this.pendingIceCandidates = []; // Store ICE candidates until remote description is set
        
        this.initializeElements();
        this.setupEventListeners();
        this.initializeSocket();
        this.generateUserId();
        this.setupTheme();
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
     * Initialize Socket.IO connection
     */
    initializeSocket() {
        this.socket = io('http://localhost:8000');
        
        this.socket.on('connect', () => {
            console.log('Connected to signaling server');
            this.updateStatus('Connected to server', 'info');
            
            // Register user after socket connection is established
            this.registerUser();
        });

        this.socket.on('disconnect', () => {
            console.log('Disconnected from signaling server');
            this.updateStatus('Disconnected from server', 'error');
        });

        this.socket.on('signaling', (data) => {
            this.handleIncomingSignal(data);
        });

        this.socket.on('callAccepted', (data) => {
            this.handleCallAccepted(data);
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            this.showNotification('Connection error: ' + error.message, 'error');
        });
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
        this.myIdInput.value = this.userId;
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
        }
    }

    /**
     * Check URL parameters for incoming connections
     */
    checkUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const peerCode = urlParams.get('code');
        if (peerCode) {
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
    }

    /**
     * Update theme toggle icon
     */
    updateThemeIcon(theme) {
        const icon = this.themeToggle.querySelector('i');
        if (theme === 'dark') {
            icon.className = 'fas fa-sun';
        } else {
            icon.className = 'fas fa-moon';
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

        this.partnerId = peerId;
        this.isInitiator = true;
        this.updateStatus('Initiating connection...', 'connecting');
        this.connectBtn.disabled = true;

        try {
            await this.createPeerConnection();
            this.createDataChannel();
            await this.createOffer();
        } catch (error) {
            console.error('Connection failed:', error);
            this.showNotification('Connection failed: ' + error.message, 'error');
            this.resetConnectionState();
        }
    }

    /**
     * Create WebRTC peer connection
     */
    async createPeerConnection() {
        const configuration = {
            iceServers: [
                // ✅ STUN servers for NAT traversal
                //{
                    //urls: [
                        //"stun:stun.l.google.com:19302",
                        //"stun:stun1.l.google.com:19302"
                    //]
                //},
                // ✅ Free STUN servers as backup
                //{
                    //urls: [
                        //"stun:stun.relay.metered.ca:80"
                    //]
                //},
                // ✅ Free TURN server (use your credentials or try these)
                {
                    urls: [
                        "turn:openrelay.metered.ca:80"
                    ],
                    username: "openrelayproject",
                    credential: "openrelayproject"
                }
            ],
            iceCandidatePoolSize: 10,
            iceTransportPolicy: "all",
            bundlePolicy: "max-bundle",
            rtcpMuxPolicy: "require"
        };
    
        this.peerConnection = new RTCPeerConnection(configuration);
    
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("Sending ICE candidate:", event.candidate.type, event.candidate.candidate);
                this.socket.emit("send-signal", {
                    from: this.userId,
                    to: this.partnerId,
                    signalData: {
                        type: "ice-candidate",
                        candidate: event.candidate
                    }
                });
            } else {
                console.log("ICE candidate gathering completed");
            }
        };

        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.peerConnection.connectionState);
            if (this.peerConnection.connectionState === 'connected') {
                console.log('WebRTC connection established!');
            } else if (this.peerConnection.connectionState === 'failed') {
                console.log('WebRTC connection failed');
                this.handleConnectionFailure();
            } else if (this.peerConnection.connectionState === 'disconnected') {
                console.log('WebRTC connection disconnected');
                this.handleDisconnection();
            }
        };

        this.peerConnection.oniceconnectionstatechange = () => {
            console.log('ICE connection state:', this.peerConnection.iceConnectionState);
            if (this.peerConnection.iceConnectionState === 'failed') {
                console.log('ICE connection failed - attempting restart');
                this.handleConnectionFailure();
            }
        };

        this.peerConnection.onicegatheringstatechange = () => {
            console.log('ICE gathering state:', this.peerConnection.iceGatheringState);
        };
    }

    /**
     * Handle connection failure
     */
    handleConnectionFailure() {
        this.showNotification('Connection failed. Please try again.', 'error');
        this.updateStatus('Connection failed', 'error');
        setTimeout(() => {
            this.handleDisconnection();
        }, 2000);
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
        } catch (error) {
            console.error('Error creating offer:', error);
            throw error;
        }
    }

    /**
     * Handle incoming signals (offers, answers, ICE candidates)
     */
    async handleIncomingSignal(data) {
        console.log('Incoming signal:', data);
        
        const { signalData } = data;
        
        if (signalData.type === 'offer') {
            this.partnerId = data.from;
            this.callerId.textContent = data.from;
            this.incomingCall.style.display = 'block';
            this.updateStatus('Incoming connection request', 'connecting');
            
            // Store the offer to process when call is accepted
            this.pendingOffer = signalData;
            
        } else if (signalData.type === 'ice-candidate') {
            console.log('Received ICE candidate');
            if (this.peerConnection && this.peerConnection.remoteDescription) {
                await this.handleIceCandidate(signalData.candidate);
            } else {
                console.log('Storing ICE candidate - no remote description yet');
                this.pendingIceCandidates.push(signalData.candidate);
            }
        }
    }

    /**
     * Accept incoming call
     */
    async acceptIncomingCall() {
        try {
            this.incomingCall.style.display = 'none';
            this.updateStatus('Accepting connection...', 'connecting');
            
            await this.createPeerConnection();
            this.setupPeerConnectionHandlers();
            
            // Set remote description with the stored offer
            console.log('Setting remote description with offer');
            const offer = new RTCSessionDescription({
                type: 'offer',
                sdp: this.pendingOffer.sdp
            });
            
            await this.peerConnection.setRemoteDescription(offer);
            console.log('Remote description set successfully');
            
            // Process any pending ICE candidates
            console.log(`Processing ${this.pendingIceCandidates.length} pending ICE candidates`);
            for (const candidate of this.pendingIceCandidates) {
                try {
                    await this.peerConnection.addIceCandidate(candidate);
                    console.log('Added pending ICE candidate');
                } catch (error) {
                    console.error('Error adding pending ICE candidate:', error);
                }
            }
            this.pendingIceCandidates = [];
            
            // Create and send answer
            console.log('Creating answer');
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            console.log('Local description set');
            
            this.socket.emit('accept-signal', {
                to: this.partnerId,
                signalData: {
                    type: 'answer',
                    sdp: answer.sdp
                }
            });
            
            this.isInitiator = false;
            console.log('Call accepted and answer sent');
            
        } catch (error) {
            console.error('Error accepting call:', error);
            this.showNotification('Failed to accept connection: ' + error.message, 'error');
            this.resetConnectionState();
            this.updateStatus('Connection failed', 'error');
        }
    }

    /**
     * Reject incoming call
     */
    rejectIncomingCall() {
        this.incomingCall.style.display = 'none';
        this.resetConnectionState();
        this.updateStatus('Call rejected', 'info');
        this.pendingOffer = null;
        this.pendingIceCandidates = [];
    }

    /**
     * Handle call accepted (initiator receives answer)
     */
    async handleCallAccepted(data) {
        console.log('Call accepted:', data);
        
        try {
            if (data.signalData.type === 'answer') {
                console.log('Setting remote description with answer');
                const answer = new RTCSessionDescription({
                    type: 'answer',
                    sdp: data.signalData.sdp
                });
                
                await this.peerConnection.setRemoteDescription(answer);
                console.log('Remote description set successfully');
                
                // Process any pending ICE candidates
                console.log(`Processing ${this.pendingIceCandidates.length} pending ICE candidates`);
                for (const candidate of this.pendingIceCandidates) {
                    await this.peerConnection.addIceCandidate(candidate);
                }
                this.pendingIceCandidates = [];
                
            } else if (data.signalData.type === 'ice-candidate') {
                console.log('Received ICE candidate in call accepted');
                if (this.peerConnection && this.peerConnection.remoteDescription) {
                    await this.handleIceCandidate(data.signalData.candidate);
                } else {
                    console.log('Storing ICE candidate - no remote description yet');
                    this.pendingIceCandidates.push(data.signalData.candidate);
                }
            }
        } catch (error) {
            console.error('Error handling call accepted:', error);
            this.showNotification('Failed to establish connection', 'error');
            this.handleDisconnection();
        }
    }

    /**
     * Handle ICE candidate
     */
    async handleIceCandidate(candidate) {
        if (this.peerConnection) {
            try {
                if (this.peerConnection.remoteDescription) {
                    await this.peerConnection.addIceCandidate(candidate);
                    console.log('ICE candidate added successfully');
                } else {
                    console.log('Storing ICE candidate for later');
                    this.pendingIceCandidates.push(candidate);
                }
            } catch (error) {
                console.error('Error adding ICE candidate:', error);
            }
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
        this.fileName.textContent = data.fileName;
        this.fileProgress.style.display = 'block';
        this.downloadFileBtn.style.display = 'block';
        this.updateStatus('Receiving file...', 'info');
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
        this.updateStatus('File received', 'success');
    }

    /**
     * Handle file selection
     */
    handleFileSelection(event) {
        const files = event.target.files;
        if (files.length > 0) {
            this.currentFile = files[0];
            this.fileName.textContent = this.currentFile.name;
            this.fileProgress.style.display = 'block';
            this.sendFileBtn.style.display = 'block';
            this.downloadFileBtn.style.display = 'none';
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
    }

    /**
     * Send chat message
     */
    sendChatMessage() {
        const message = this.messageInput.value.trim();
        if (!message || !this.isConnected) return;

        this.addChatMessage(message, 'me');
        
        if (this.dataChannel) {
            const messageData = {
                type: 'chat',
                text: message
            };
            this.dataChannel.send(JSON.stringify(messageData));
        }
        
        this.messageInput.value = '';
    }

    /**
     * Add chat message to UI
     */
    addChatMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        messageDiv.innerHTML = `<span>${this.escapeHtml(text)}</span>`;
        
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
        this.chatPanel.style.display = 'block';
    }

    /**
     * Update file progress
     */
    updateFileProgress(percent) {
        this.progressPercent.textContent = Math.round(percent) + '%';
        this.progressFill.style.width = percent + '%';
    }

    /**
     * Update connection status
     */
    updateStatus(text, type = 'info') {
        this.statusText.textContent = text;
        this.statusIndicator.className = `status-indicator ${type}`;
        
        if (type === 'connected') {
            this.disconnectBtn.style.display = 'block';
            this.connectBtn.style.display = 'none';
        } else {
            this.disconnectBtn.style.display = 'none';
            this.connectBtn.style.display = 'block';
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
        this.pendingIceCandidates = [];
        this.pendingOffer = null;
        
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
        this.connectBtn.disabled = false;
        this.peerConnection = null;
        this.dataChannel = null;
    }

    /**
     * Hide chat panel
     */
    hideChatPanel() {
        this.chatPanel.style.display = 'none';
    }

    /**
     * Hide file progress
     */
    hideFileProgress() {
        this.fileProgress.style.display = 'none';
        this.sendFileBtn.style.display = 'none';
        this.downloadFileBtn.style.display = 'none';
    }

    /**
     * Show share modal
     */
    showShareModal() {
        const shareUrl = `${window.location.origin}?code=${this.userId}`;
        this.shareLinkInput.value = shareUrl;
        this.shareModal.classList.add('show');
    }

    /**
     * Hide share modal
     */
    hideShareModal() {
        this.shareModal.classList.remove('show');
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
            this.showNotification('Failed to copy to clipboard', 'error');
        }
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        
        const icon = document.createElement('i');
        icon.className = this.getNotificationIcon(type);
        
        const text = document.createElement('span');
        text.textContent = message;
        
        notification.appendChild(icon);
        notification.appendChild(text);
        
        this.notifications.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
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
            default: return 'fas fa-info-circle';
        }
    }
}

// Initialize application when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new SovereignShare();
});
