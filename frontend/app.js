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
        this.chunkSize = 16 * 1024;
        this.pendingIceCandidates = [];
        this.connectionTimeout = null;
        
        this.initializeElements();
        this.setupEventListeners();
        this.initializeSocket();
        this.generateUserId();
        this.setupTheme();
    }

    initializeElements() {
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

        this.chatPanel = document.getElementById('chatPanel');
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendMessageBtn = document.getElementById('sendMessageBtn');

        this.shareModal = document.getElementById('shareModal');
        this.shareLinkInput = document.getElementById('shareLinkInput');
        this.copyLinkBtn = document.getElementById('copyLinkBtn');
        this.closeShareModal = document.getElementById('closeShareModal');

        this.themeToggle = document.getElementById('themeToggle');
        this.notifications = document.getElementById('notifications');
    }

    setupEventListeners() {
        this.connectBtn.addEventListener('click', () => this.initiateConnection());
        this.copyIdBtn.addEventListener('click', () => this.copyToClipboard(this.userId));
        this.shareLinkBtn.addEventListener('click', () => this.showShareModal());
        this.disconnectBtn.addEventListener('click', () => this.terminateConnection());
        this.acceptCallBtn.addEventListener('click', () => this.acceptIncomingCall());
        this.rejectCallBtn.addEventListener('click', () => this.rejectIncomingCall());

        this.browseBtn.addEventListener('click', () => this.fileInput.click());
        this.fileInput.addEventListener('change', (e) => this.handleFileSelection(e));
        this.sendFileBtn.addEventListener('click', () => this.sendFile());
        this.downloadFileBtn.addEventListener('click', () => this.downloadFile());

        this.uploadZone.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadZone.addEventListener('drop', (e) => this.handleFileDrop(e));
        this.uploadZone.addEventListener('click', () => this.fileInput.click());

        this.sendMessageBtn.addEventListener('click', () => this.sendChatMessage());
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.sendChatMessage();
        });

        this.closeShareModal.addEventListener('click', () => this.hideShareModal());
        this.copyLinkBtn.addEventListener('click', () => this.copyToClipboard(this.shareLinkInput.value));
        this.shareModal.addEventListener('click', (e) => {
            if (e.target === this.shareModal) this.hideShareModal();
        });

        this.themeToggle.addEventListener('click', () => this.toggleTheme());
        this.checkUrlParameters();
    }

    initializeSocket() {
        const socketUrl = window.location.hostname === 'localhost' ? 'http://localhost:8000' : undefined;
        
        this.socket = io(socketUrl, { 
            transports: ["websocket"], 
            withCredentials: false 
        });
        
        this.socket.on('connect', () => {
            this.updateStatus('Connected to server', 'info');
            this.registerUser();
        });

        this.socket.on('disconnect', () => {
            this.updateStatus('Disconnected from server', 'error');
        });

        this.socket.on('signaling', (data) => {
            const { signalData } = data;

            if (signalData.type === 'offer') {
                this.handleIncomingSignal(data); 
            } else if (signalData.type === 'answer') {
                this.handlesignaling(data); 
            } else if (signalData.type === 'ice-candidate') {
                this.handleIncomingSignal(data);
            }
        });

        this.socket.on('error', (error) => {
            console.error('Socket error:', error);
            this.showNotification('Connection error: ' + error.message, 'error');
        });
    }

    generateUserId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let result = '';
        for (let i = 0; i < 10; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        this.userId = result;
        this.myIdInput.value = this.userId;
    }

    registerUser() {
        if (this.userId && this.socket && this.socket.connected) {
            this.socket.emit('details', {
                uniqueId: this.userId
            });
        }
    }

    checkUrlParameters() {
        const urlParams = new URLSearchParams(window.location.search);
        const peerCode = urlParams.get('code');
        if (peerCode) {
            this.peerIdInput.value = peerCode;
            this.updateStatus('Peer ID loaded from URL', 'info');
        }
    }

    setupTheme() {
        const savedTheme = localStorage.getItem('theme') || 'light';
        document.documentElement.setAttribute('data-theme', savedTheme);
        this.updateThemeIcon(savedTheme);
    }

    toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        this.updateThemeIcon(newTheme);
    }

    updateThemeIcon(theme) {
        const icon = this.themeToggle.querySelector('i');
        if (theme === 'dark') {
            icon.className = 'fas fa-sun';
        } else {
            icon.className = 'fas fa-moon';
        }
    }

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

    async createPeerConnection() {
        const configuration = {
            iceServers: [
                {
                    urls: [
                        "stun:stun.l.google.com:19302",
                        "stun:stun1.l.google.com:19302",
                        "stun:stun2.l.google.com:19302",
                        "stun:stun3.l.google.com:19302",
                        "stun:stun4.l.google.com:19302"
                    ]
                },
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
    
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                this.socket.emit("send-signal", {
                    from: this.userId,
                    to: this.partnerId,
                    signalData: {
                        type: "ice-candidate",
                        candidate: event.candidate
                    }
                });
            }
        };

        this.peerConnection.onicecandidateerror = (event) => {
            console.error('ICE candidate error:', event);
        };

        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            
            switch (state) {
                case 'connecting':
                    this.updateStatus('Establishing connection...', 'connecting');
                    break;
                case 'connected':
                    this.clearConnectionTimeout();
                    break;
                case 'disconnected':
                    this.handleDisconnection();
                    break;
                case 'failed':
                    this.handleConnectionFailure();
                    break;
            }
        };

        this.peerConnection.oniceconnectionstatechange = () => {
            const state = this.peerConnection.iceConnectionState;
            
            switch (state) {
                case 'checking':
                    this.updateStatus('Checking connectivity...', 'connecting');
                    break;
                case 'failed':
                    this.handleConnectionFailure();
                    break;
            }
        };
    }

    clearConnectionTimeout() {
        if (this.connectionTimeout) {
            clearTimeout(this.connectionTimeout);
            this.connectionTimeout = null;
        }
    }

    handleConnectionFailure() {
        this.clearConnectionTimeout();
        this.showNotification('Connection failed. Would you like to retry?', 'error');
        this.updateStatus('Connection failed - Click to retry', 'error');
        
        this.connectBtn.textContent = 'Retry Connection';
        this.connectBtn.disabled = false;
        
        setTimeout(() => {
            this.resetConnectionState();
        }, 3000);
    }

    createDataChannel() {
        this.dataChannel = this.peerConnection.createDataChannel('chat', {
            ordered: true,
            maxRetransmits: 3
        });
        
        this.setupDataChannel();
    }

    setupDataChannel() {
        this.dataChannel.onopen = () => {
            this.isConnected = true;
            this.clearConnectionTimeout();
            this.updateStatus(`Connected to ${this.partnerId}`, 'connected');
            this.showChatPanel();
            this.showNotification('Connection established successfully!', 'success');
        };

        this.dataChannel.onclose = () => {
            this.handleDisconnection();
        };

        this.dataChannel.onerror = (error) => {
            console.error('Data channel error:', error);
            this.showNotification('Data channel error occurred', 'error');
        };

        this.dataChannel.onmessage = (event) => {
            this.handleDataChannelMessage(event.data);
        };
    }

    async createOffer() {
        try {
            const offer = await this.peerConnection.createOffer({
                offerToReceiveAudio: false,
                offerToReceiveVideo: false
            });
            
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

    async handleIncomingSignal(data) {
        const { signalData } = data;
        
        if (signalData.type === 'offer') {
            this.partnerId = data.from;
            this.callerId.textContent = data.from;
            this.incomingCall.style.display = 'block';
            this.updateStatus('Incoming connection request', 'connecting');
            
            this.pendingOffer = signalData;
            
        } else if (signalData.type === 'ice-candidate') {
            try {
                const candidate = new RTCIceCandidate(signalData.candidate);
                
                if (this.peerConnection && this.peerConnection.remoteDescription) {
                    await this.peerConnection.addIceCandidate(candidate);
                } else {
                    this.pendingIceCandidates.push(candidate);
                }
            } catch (error) {
                console.error('Error handling ICE candidate:', error);
            }
        }
    }

    async acceptIncomingCall() {
        try {
            this.incomingCall.style.display = 'none';
            this.updateStatus('Accepting connection...', 'connecting');
            
            this.connectionTimeout = setTimeout(() => {
                this.showNotification('Connection timeout. Please try again.', 'error');
                this.resetConnectionState();
            }, 30000);
            
            await this.createPeerConnection();
            this.setupPeerConnectionHandlers();
            
            const offer = new RTCSessionDescription({
                type: 'offer',
                sdp: this.pendingOffer.sdp
            });
            
            await this.peerConnection.setRemoteDescription(offer);
            
            for (const candidate of this.pendingIceCandidates) {
                try {
                    await this.peerConnection.addIceCandidate(candidate);
                } catch (error) {
                    console.error('Error adding pending ICE candidate:', error);
                }
            }
            this.pendingIceCandidates = [];
            
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            this.socket.emit('signaling', {
                to: this.partnerId,
                signalData: {
                    type: 'answer',
                    sdp: answer.sdp
                }
            });
            
            this.isInitiator = false;
            
        } catch (error) {
            console.error('Error accepting call:', error);
            this.showNotification('Failed to accept connection: ' + error.message, 'error');
            this.resetConnectionState();
            this.updateStatus('Connection failed', 'error');
        }
    }

    rejectIncomingCall() {
        this.incomingCall.style.display = 'none';
        this.resetConnectionState();
        this.updateStatus('Call rejected', 'info');
        this.pendingOffer = null;
        this.pendingIceCandidates = [];
    }

    async handlesignaling(data) {
        try {
            if (data.signalData.type === 'answer') {
                const answer = new RTCSessionDescription({
                    type: 'answer',
                    sdp: data.signalData.sdp
                });
                
                await this.peerConnection.setRemoteDescription(answer);
                
                for (const candidate of this.pendingIceCandidates) {
                    try {
                        await this.peerConnection.addIceCandidate(candidate);
                    } catch (error) {
                        console.error('Error adding pending ICE candidate:', error);
                    }
                }
                this.pendingIceCandidates = [];
                
            } else if (data.signalData.type === 'ice-candidate') {
                try {
                    const candidate = new RTCIceCandidate(data.signalData.candidate);
                    
                    if (this.peerConnection && this.peerConnection.remoteDescription) {
                        await this.peerConnection.addIceCandidate(candidate);
                    } else {
                        this.pendingIceCandidates.push(candidate);
                    }
                } catch (error) {
                    console.error('Error handling ICE candidate:', error);
                }
            }
        } catch (error) {
            console.error('Error handling call accepted:', error);
            this.showNotification('Failed to establish connection', 'error');
            this.handleDisconnection();
        }
    }

    setupPeerConnectionHandlers() {
        this.peerConnection.ondatachannel = (event) => {
            this.dataChannel = event.channel;
            this.setupDataChannel();
        };
    }

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

    handleChatMessage(data) {
        this.addChatMessage(data.text, 'other');
    }

    handleFileInfo(data) {
        this.fileInfo = data;
        this.fileName.textContent = data.fileName;
        this.fileProgress.style.display = 'block';
        this.downloadFileBtn.style.display = 'block';
        this.updateStatus('Receiving file...', 'info');
        this.fileChunks = [];
    }

    handleFileChunk(data) {
        this.fileChunks.push(new Uint8Array(data.chunk));
        const progress = (this.fileChunks.length / data.totalChunks) * 100;
        this.updateFileProgress(progress);
    }

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

    handleFileDrop(event) {
        event.preventDefault();
        this.uploadZone.classList.remove('dragover');
        
        const files = event.dataTransfer.files;
        if (files.length > 0) {
            this.fileInput.files = files;
            this.handleFileSelection({ target: { files: files } });
        }
    }

    handleDragOver(event) {
        event.preventDefault();
        this.uploadZone.classList.add('dragover');
        
        clearTimeout(this.dragOverTimeout);
        this.dragOverTimeout = setTimeout(() => {
            this.uploadZone.classList.remove('dragover');
        }, 100);
    }

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
            
            const fileInfo = {
                type: 'fileInfo',
                fileName: file.name,
                fileSize: file.size,
                fileType: file.type,
                totalChunks: totalChunks
            };
            
            this.dataChannel.send(JSON.stringify(fileInfo));
            this.updateStatus('Sending file...', 'info');
            
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
                
                await new Promise(resolve => setTimeout(resolve, 5));
            }
            
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
            this.showNotification('Failed to send file: ' + error.message, 'error');
        }
    }

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
            console.error('Error downloading file:', error);
            this.showNotification('Failed to download file', 'error');
        }
    }

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
            console.error('Error sending chat message:', error);
            this.showNotification('Failed to send message', 'error');
        }
    }

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

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showChatPanel() {
        this.chatPanel.style.display = 'block';
        this.messageInput.focus();
    }

    updateFileProgress(percent) {
        const roundedPercent = Math.round(percent);
        this.progressPercent.textContent = roundedPercent + '%';
        this.progressFill.style.width = percent + '%';
        
        if (percent >= 100) {
            this.progressFill.style.backgroundColor = '#22c55e';
        }
    }

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

    terminateConnection() {
        this.clearConnectionTimeout();
        
        if (this.dataChannel) {
            this.dataChannel.close();
        }
        if (this.peerConnection) {
            this.peerConnection.close();
        }
        
        this.handleDisconnection();
    }

    handleDisconnection() {
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

    resetConnectionState() {
        this.connectBtn.disabled = false;
        this.connectBtn.textContent = 'Connect';
        this.peerConnection = null;
        this.dataChannel = null;
        this.clearConnectionTimeout();
    }

    hideChatPanel() {
        this.chatPanel.style.display = 'none';
        this.chatMessages.innerHTML = '';
    }

    hideFileProgress() {
        this.fileProgress.style.display = 'none';
        this.sendFileBtn.style.display = 'none';
        this.downloadFileBtn.style.display = 'none';
        this.fileName.textContent = '';
        this.updateFileProgress(0);
        this.progressFill.style.backgroundColor = '#3b82f6';
    }

    showShareModal() {
        const shareUrl = `${window.location.origin}${window.location.pathname}?code=${this.userId}`;
        this.shareLinkInput.value = shareUrl;
        this.shareModal.classList.add('show');
    }

    hideShareModal() {
        this.shareModal.classList.remove('show');
    }

    async copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            this.showNotification('Copied to clipboard!', 'success');
        } catch (error) {
            console.error('Failed to copy:', error);
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
        
        const notifications = this.notifications.children;
        if (notifications.length > 5) {
            notifications[0].remove();
        }
    }

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

document.addEventListener('DOMContentLoaded', () => {
    new SovereignShare();
});
