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
        this.connectionTimeout = null;
        
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
        // Use same-origin when deployed, localhost when running locally
        const socketUrl = window.location.hostname === 'localhost' ? 'http://localhost:8000' : undefined;
        
        this.socket = io(socketUrl, { 
            transports: ["websocket"], 
            withCredentials: false 
        });
        
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

        this.socket.on('signaling', (data) => {
            this.handlesignaling(data);
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

        // Set connection timeout
        this.connectionTimeout = setTimeout(() => {
            this.showNotification('Connection timeout. Please try again.', 'error');
            this.resetConnectionState();
        }, 30000);

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
     * Create WebRTC peer connection with improved ICE configuration
     */
    async createPeerConnection() {
        const configuration = {
            iceServers: [
                // Google STUN servers
                //{
                    //urls: [
                        //"stun:stun.l.google.com:19302",
                        //"stun:stun1.l.google.com:19302",
                        //"stun:stun2.l.google.com:19302",
                        //"stun:stun3.l.google.com:19302",
                        //"stun:stun4.l.google.com:19302"
                    //]
                //},
                // Additional STUN servers for better coverage
                //{
                    //urls: "stun:stun.relay.metered.ca:80"
                //},
                // Multiple TURN servers with different transports
                //{
                    //urls: "turn:a.relay.metered.ca:80",
                    //username: "a2b85e2ac8fa2ccc2e57e4df",
                    //credential: "Mjvt8BVb5ufzCOxf"
                //},
                //{
                    //urls: "turn:a.relay.metered.ca:80?transport=tcp",
                    //username: "a2b85e2ac8fa2ccc2e57e4df",
                    //credential: "Mjvt8BVb5ufzCOxf"
                //},
                //{
                    //urls: "turn:a.relay.metered.ca:443",
                    //username: "a2b85e2ac8fa2ccc2e57e4df",
                    //credential: "Mjvt8BVb5ufzCOxf"
                //},
                {
                    urls: "turn:numb.viagenie.ca",
                    username: "webrtc@live.com",
                    credential: "muazkh"
                }
            ],
            iceCandidatePoolSize: 10,
            iceTransportPolicy: "all",
            bundlePolicy: "max-bundle",
            rtcpMuxPolicy: "require"
        };
    
        this.peerConnection = new RTCPeerConnection(configuration);
        
        console.log('WebRTC configuration:', configuration);
    
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log("📤 Sending ICE candidate:", {
                    type: event.candidate.type,
                    protocol: event.candidate.protocol,
                    address: event.candidate.address,
                    port: event.candidate.port
                });
                
                this.socket.emit("send-signal", {
                    from: this.userId,
                    to: this.partnerId,
                    signalData: {
                        type: "ice-candidate",
                        candidate: event.candidate
                    }
                });
            } else {
                console.log("✅ ICE candidate gathering completed");
            }
        };

        this.peerConnection.onicecandidateerror = (event) => {
            console.error('❌ ICE candidate error:', {
                errorCode: event.errorCode,
                errorText: event.errorText,
                url: event.url,
                port: event.port
            });
        };

        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log(`🔗 Connection state: ${state}`);
            
            switch (state) {
                case 'connecting':
                    this.updateStatus('Establishing connection...', 'connecting');
                    break;
                case 'connected':
                    console.log('🎉 WebRTC connection established!');
                    this.clearConnectionTimeout();
                    break;
                case 'disconnected':
                    console.log('🔌 WebRTC connection disconnected');
                    this.handleDisconnection();
                    break;
                case 'failed':
                    console.log('💥 WebRTC connection failed');
                    this.handleConnectionFailure();
                    break;
                case 'closed':
                    console.log('🚪 WebRTC connection closed');
                    break;
            }
        };

        this.peerConnection.oniceconnectionstatechange = () => {
            const state = this.peerConnection.iceConnectionState;
            console.log(`🧊 ICE connection state: ${state}`);
            
            switch (state) {
                case 'checking':
                    this.updateStatus('Checking connectivity...', 'connecting');
                    break;
                case 'connected':
                    console.log('🎯 ICE connection established successfully');
                    break;
                case 'completed':
                    console.log('✅ ICE connection completed');
                    break;
                case 'failed':
                    console.log('❌ ICE connection failed - connection cannot be established');
                    this.handleConnectionFailure();
                    break;
                case 'disconnected':
                    console.log('📡 ICE connection temporarily disconnected');
                    break;
                case 'closed':
                    console.log('🔒 ICE connection closed');
                    break;
            }
        };

        this.peerConnection.onicegatheringstatechange = () => {
            const state = this.peerConnection.iceGatheringState;
            console.log(`📡 ICE gathering state: ${state}`);
            
            if (state === 'complete') {
                console.log('🏁 ICE gathering completed');
            }
        };

        // Additional debugging
        this.peerConnection.onsignalingstatechange = () => {
            console.log(`📻 Signaling state: ${this.peerConnection.signalingState}`);
        };
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
     * Handle connection failure with retry option
     */
    handleConnectionFailure() {
        this.clearConnectionTimeout();
        this.showNotification('Connection failed. Would you like to retry?', 'error');
        this.updateStatus('Connection failed - Click to retry', 'error');
        
        // Enable retry
        this.connectBtn.textContent = 'Retry Connection';
        this.connectBtn.disabled = false;
        
        setTimeout(() => {
            this.resetConnectionState();
        }, 3000);
    }

    /**
     * Create data channel for file transfer and chat
     */
    createDataChannel() {
        this.dataChannel = this.peerConnection.createDataChannel('chat', {
            ordered: true,
            maxRetransmits: 3
        });
        
        this.setupDataChannel();
    }

    /**
     * Set up data channel event handlers
     */
    setupDataChannel() {
        this.dataChannel.onopen = () => {
            console.log('📺 Data channel opened successfully');
            this.isConnected = true;
            this.clearConnectionTimeout();
            this.updateStatus(`Connected to ${this.partnerId}`, 'connected');
            this.showChatPanel();
            this.showNotification('Connection established successfully!', 'success');
        };

        this.dataChannel.onclose = () => {
            console.log('📺 Data channel closed');
            this.handleDisconnection();
        };

        this.dataChannel.onerror = (error) => {
            console.error('📺 Data channel error:', error);
            this.showNotification('Data channel error occurred', 'error');
        };

        this.dataChannel.onmessage = (event) => {
            console.log('📩 Data channel message received:', event.data.length, 'bytes');
            this.handleDataChannelMessage(event.data);
        };
    }

    /**
     * Create and send offer
     */
    async createOffer() {
        try {
            console.log('📞 Creating offer...');
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: false,
                offerToReceiveVideo: false
            });
            
            console.log('📝 Setting local description...');
            await this.peerConnection.setLocalDescription(offer);
            
            console.log('📤 Sending offer to peer');
            this.socket.emit('send-signal', {
                from: this.userId,
                to: this.partnerId,
                signalData: {
                    type: 'offer',
                    sdp: offer.sdp
                }
            });
        } catch (error) {
            console.error('❌ Error creating offer:', error);
            throw error;
        }
    }

    /**
     * Handle incoming signals (offers, answers, ICE candidates)
     */
    async handleIncomingSignal(data) {
        console.log('📥 Incoming signal:', data.signalData.type);
        
        const { signalData } = data;
        
        if (signalData.type === 'offer') {
            this.partnerId = data.from;
            this.callerId.textContent = data.from;
            this.incomingCall.style.display = 'block';
            this.updateStatus('Incoming connection request', 'connecting');
            
            // Store the offer to process when call is accepted
            this.pendingOffer = signalData;
            
        } else if (signalData.type === 'ice-candidate') {
            console.log('🧊 Received ICE candidate:', signalData.candidate.type);
            
            try {
                const candidate = new RTCIceCandidate(signalData.candidate);
                
                if (this.peerConnection && this.peerConnection.remoteDescription) {
                    await this.peerConnection.addIceCandidate(candidate);
                    console.log('✅ ICE candidate added successfully');
                } else {
                    console.log('⏳ Storing ICE candidate - no remote description yet');
                    this.pendingIceCandidates.push(candidate);
                }
            } catch (error) {
                console.error('❌ Error handling ICE candidate:', error);
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
            
            // Set connection timeout
            this.connectionTimeout = setTimeout(() => {
                this.showNotification('Connection timeout. Please try again.', 'error');
                this.resetConnectionState();
            }, 30000);
            
            await this.createPeerConnection();
            this.setupPeerConnectionHandlers();
            
            // Set remote description with the stored offer
            console.log('📝 Setting remote description with offer');
            const offer = new RTCSessionDescription({
                type: 'offer',
                sdp: this.pendingOffer.sdp
            });
            
            await this.peerConnection.setRemoteDescription(offer);
            console.log('✅ Remote description set successfully');
            
            // Process any pending ICE candidates
            console.log(`🧊 Processing ${this.pendingIceCandidates.length} pending ICE candidates`);
            for (const candidate of this.pendingIceCandidates) {
                try {
                    await this.peerConnection.addIceCandidate(candidate);
                    console.log('✅ Added pending ICE candidate');
                } catch (error) {
                    console.error('❌ Error adding pending ICE candidate:', error);
                }
            }
            this.pendingIceCandidates = [];
            
            // Create and send answer
            console.log('📞 Creating answer');
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            console.log('📝 Local description set');
            
            this.socket.emit('signaling', {
                to: this.partnerId,
                signalData: {
                    type: 'answer',
                    sdp: answer.sdp
                }
            });
            
            this.isInitiator = false;
            console.log('📤 Answer sent to peer');
            
        } catch (error) {
            console.error('❌ Error accepting call:', error);
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
    async handlesignaling(data) {
        console.log('📥 Call accepted:', data.signalData.type);
        
        try {
            if (data.signalData.type === 'answer') {
                console.log('📝 Setting remote description with answer');
                const answer = new RTCSessionDescription({
                    type: 'answer',
                    sdp: data.signalData.sdp
                });
                
                await this.peerConnection.setRemoteDescription(answer);
                console.log('✅ Remote description set successfully');
                
                // Process any pending ICE candidates
                console.log(`🧊 Processing ${this.pendingIceCandidates.length} pending ICE candidates`);
                for (const candidate of this.pendingIceCandidates) {
                    try {
                        await this.peerConnection.addIceCandidate(candidate);
                        console.log('✅ Added pending ICE candidate');
                    } catch (error) {
                        console.error('❌ Error adding pending ICE candidate:', error);
                    }
                }
                this.pendingIceCandidates = [];
                
            } else if (data.signalData.type === 'ice-candidate') {
                console.log('🧊 Received ICE candidate in call accepted');
                
                try {
                    const candidate = new RTCIceCandidate(data.signalData.candidate);
                    
                    if (this.peerConnection && this.peerConnection.remoteDescription) {
                        await this.peerConnection.addIceCandidate(candidate);
                        console.log('✅ ICE candidate added successfully');
                    } else {
                        console.log('⏳ Storing ICE candidate - no remote description yet');
                        this.pendingIceCandidates.push(candidate);
                    }
                } catch (error) {
                    console.error('❌ Error handling ICE candidate:', error);
                }
            }
        } catch (error) {
            console.error('❌ Error handling call accepted:', error);
            this.showNotification('Failed to establish connection', 'error');
            this.handleDisconnection();
        }
    }

    /**
     * Set up peer connection handlers for non-initiator
     */
    setupPeerConnectionHandlers() {
        this.peerConnection.ondatachannel = (event) => {
            console.log('📺 Received data channel');
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
            console.error('❌ Error parsing message:', error);
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
        this.fileChunks = []; // Reset chunks for new file
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
        
        // Remove dragover after a short delay if no drop occurs
        clearTimeout(this.dragOverTimeout);
        this.dragOverTimeout = setTimeout(() => {
            this.uploadZone.classList.remove('dragover');
        }, 100);
    }

    /**
     * Send file via WebRTC
     */
    async sendFile() {
        if (!this.currentFile || !this.isConnected) {
            this.showNotification('No file selected or not connected', 'error');
            return;
        }

        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            this.showNotification('Data channel not ready. Please wait...', 'error');
            return;
        }

        try {
            const file = this.currentFile;
            const totalChunks = Math.ceil(file.size / this.chunkSize);
            
            console.log(`📦 Sending file: ${file.name} (${file.size} bytes, ${totalChunks} chunks)`);
            
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
                await new Promise(resolve => setTimeout(resolve, 5));
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
            console.log('✅ File sent successfully');
            
        } catch (error) {
            console.error('❌ Error sending file:', error);
            this.showNotification('Failed to send file: ' + error.message, 'error');
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

        try {
            const url = URL.createObjectURL(this.currentFile.blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = this.currentFile.name;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showNotification(`Downloaded: ${this.currentFile.name}`, 'success');
        } catch (error) {
            console.error('❌ Error downloading file:', error);
            this.showNotification('Failed to download file', 'error');
        }
    }

    /**
     * Send chat message
     */
    sendChatMessage() {
        const message = this.messageInput.value.trim();
        if (!message || !this.isConnected) return;

        if (!this.dataChannel || this.dataChannel.readyState !== 'open') {
            this.showNotification('Connection not ready. Please wait...', 'error');
            return;
        }

        try {
            this.addChatMessage(message, 'me');
            
            const messageData = {
                type: 'chat',
                text: message,
                timestamp: new Date().toISOString()
            };
            
            this.dataChannel.send(JSON.stringify(messageData));
            this.messageInput.value = '';
            
        } catch (error) {
            console.error('❌ Error sending chat message:', error);
            this.showNotification('Failed to send message', 'error');
        }
    }

    /**
     * Add chat message to UI
     */
    addChatMessage(text, sender) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${sender}`;
        
        const messageContent = document.createElement('span');
        messageContent.textContent = this.escapeHtml(text);
        
        const timestamp = document.createElement('small');
        timestamp.className = 'timestamp';
        timestamp.textContent = new Date().toLocaleTimeString();
        
        messageDiv.appendChild(messageContent);
        messageDiv.appendChild(timestamp);
        
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
        this.messageInput.focus();
    }

    /**
     * Update file progress
     */
    updateFileProgress(percent) {
        const roundedPercent = Math.round(percent);
        this.progressPercent.textContent = roundedPercent + '%';
        this.progressFill.style.width = percent + '%';
        
        if (percent >= 100) {
            this.progressFill.style.backgroundColor = '#22c55e';
        }
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
            this.connectBtn.textContent = 'Connect';
        } else {
            this.disconnectBtn.style.display = 'none';
            this.connectBtn.style.display = 'block';
            if (type === 'error' && text.includes('retry')) {
                this.connectBtn.textContent = 'Retry Connection';
            }
        }
    }

    /**
     * Terminate connection
     */
    terminateConnection() {
        console.log('🔌 Terminating connection...');
        
        this.clearConnectionTimeout();
        
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
        console.log('📡 Handling disconnection...');
        
        this.isConnected = false;
        this.isInitiator = false;
        this.partnerId = null;
        this.currentFile = null;
        this.fileChunks = [];
        this.fileInfo = null;
        this.pendingIceCandidates = [];
        this.pendingOffer = null;
        
        this.clearConnectionTimeout();
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
        this.connectBtn.textContent = 'Connect';
        this.peerConnection = null;
        this.dataChannel = null;
        this.clearConnectionTimeout();
    }

    /**
     * Hide chat panel
     */
    hideChatPanel() {
        this.chatPanel.style.display = 'none';
        // Clear chat messages for privacy
        this.chatMessages.innerHTML = '';
    }

    /**
     * Hide file progress
     */
    hideFileProgress() {
        this.fileProgress.style.display = 'none';
        this.sendFileBtn.style.display = 'none';
        this.downloadFileBtn.style.display = 'none';
        this.fileName.textContent = '';
        this.updateFileProgress(0);
        this.progressFill.style.backgroundColor = '#3b82f6';
    }

    /**
     * Show share modal
     */
    showShareModal() {
        const shareUrl = `${window.location.origin}${window.location.pathname}?code=${this.userId}`;
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
            console.error('❌ Failed to copy:', error);
            // Fallback for older browsers
            try {
                const textArea = document.createElement('textarea');
                textArea.value = text;
                document.body.appendChild(textArea);
                textArea.select();
                document.execCommand('copy');
                document.body.removeChild(textArea);
                this.showNotification('Copied to clipboard!', 'success');
            } catch (fallbackError) {
                this.showNotification('Failed to copy to clipboard', 'error');
            }
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
        
        const closeBtn = document.createElement('button');
        closeBtn.className = 'notification-close';
        closeBtn.innerHTML = '×';
        closeBtn.onclick = () => notification.remove();
        
        notification.appendChild(icon);
        notification.appendChild(text);
        notification.appendChild(closeBtn);
        
        this.notifications.appendChild(notification);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (notification.parentNode) {
                notification.classList.add('fade-out');
                setTimeout(() => {
                    if (notification.parentNode) {
                        notification.parentNode.removeChild(notification);
                    }
                }, 300);
            }
        }, 5000);
        
        // Limit max notifications
        const notifications = this.notifications.children;
        if (notifications.length > 5) {
            notifications[0].remove();
        }
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
    console.log('🚀 Initializing SovereignShare...');
    try {
        new SovereignShare();
        console.log('✅ SovereignShare initialized successfully');
    } catch (error) {
        console.error('❌ Failed to initialize SovereignShare:', error);
    }
});
