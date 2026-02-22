// DOM Elements
const chatMessages = document.getElementById("chat-messages");
const historyList = document.getElementById("history-list");
const textInput = document.getElementById("textInput");
const sendTextBtn = document.getElementById("sendText");
const voiceBtn = document.getElementById("voiceControl");
const voiceStatus = voiceBtn.querySelector(".voice-status");
const conversationIdDisplay = document.getElementById("conversationIdDisplay");
const newChatBtn = document.getElementById("newChatBtn");
const clearHistoryBtn = document.getElementById("clearHistory");
const scrollToBottomBtn = document.getElementById("scrollToBottom");

// State
const INITIAL_GREETING = "Hello! I'm your interviewer for this meeting. Let's begin!";
let currentConversationId = "";
let currentConversationMessages = [];

let recorder;
let chunks = [];
let isRecording = false;

// WebSocket Setup
const ws = new WebSocket("ws://127.0.0.1:8000/ws");
ws.binaryType = "arraybuffer";

ws.onopen = () => console.log("✅ WebSocket connected");
ws.onerror = (err) => console.error("❌ WebSocket error", err);
ws.onclose = () => console.log("⚠️ WebSocket closed");

ws.onmessage = (event) => {
    if (event.data instanceof ArrayBuffer) {
        const blob = new Blob([event.data], { type: "audio/wav" });
        const audio = new Audio(URL.createObjectURL(blob));
        audio.play();
    } else {
        try {
            const data = JSON.parse(event.data);
            if (data.sender && data.text) {
                addMessage(data.sender, data.text);
            }
        } catch (e) {
            addMessage("AI", event.data);
        }
    }
};

// UI Functions
function scrollToBottom(force = false) {
    const isAtBottom = chatMessages.scrollHeight - chatMessages.scrollTop <= chatMessages.clientHeight + 150;
    if (force || isAtBottom) {
        chatMessages.scrollTo({
            top: chatMessages.scrollHeight,
            behavior: "smooth"
        });
    }
}

function addMessage(sender, text, skipSave = false) {
    const isUser = sender === "You";
    const msgDiv = document.createElement("div");
    msgDiv.className = `message ${isUser ? 'user' : 'ai'}`;

    msgDiv.innerHTML = `
        <div class="bubble">${text}</div>
    `;

    chatMessages.appendChild(msgDiv);

    // Auto-scroll logic: Force scroll if AI is responding
    setTimeout(() => scrollToBottom(!isUser), 50);

    if (!skipSave) {
        saveMessageToStorage(sender, text);
    }
}

// Scroll Button Visibility
chatMessages.onscroll = () => {
    const isAtBottom = chatMessages.scrollHeight - chatMessages.scrollTop <= chatMessages.clientHeight + 150;
    if (isAtBottom) {
        scrollToBottomBtn.classList.remove("visible");
    } else {
        scrollToBottomBtn.classList.add("visible");
    }
};

scrollToBottomBtn.onclick = () => scrollToBottom(true);

// --- Multi-Conversation Logic ---

function createNewChat() {
    currentConversationId = "session-" + Math.floor(Math.random() * 10000);
    conversationIdDisplay.textContent = currentConversationId;
    currentConversationMessages = [];

    // Clear display
    chatMessages.innerHTML = "";

    // Initial greeting
    addMessage("AI", INITIAL_GREETING);

    renderSidebar();
}

function saveMessageToStorage(sender, text) {
    const history = JSON.parse(localStorage.getItem("audiobot_sessions") || "{}");

    if (!history[currentConversationId]) {
        history[currentConversationId] = {
            id: currentConversationId,
            timestamp: Date.now(),
            messages: []
        };
    }

    history[currentConversationId].messages.push({ sender, text, time: new Date().toLocaleTimeString() });
    localStorage.setItem("audiobot_sessions", JSON.stringify(history));
    renderSidebar();
}

function renderSidebar() {
    const history = JSON.parse(localStorage.getItem("audiobot_sessions") || "{}");
    const sessionIds = Object.keys(history).sort((a, b) => history[b].timestamp - history[a].timestamp);

    if (sessionIds.length === 0) {
        historyList.innerHTML = '<div class="empty-state">No history yet.</div>';
        return;
    }

    historyList.innerHTML = sessionIds.map(id => {
        const session = history[id];
        const lastMsg = session.messages.length > 0 ? session.messages[session.messages.length - 1].text : "New Chat";
        const activeClass = id === currentConversationId ? 'active' : '';

        return `
            <div class="history-item ${activeClass}" onclick="loadConversation('${id}')">
                <div class="history-item-id">${id}</div>
                <div class="history-item-preview">${lastMsg}</div>
            </div>
        `;
    }).join("");
}

window.loadConversation = (id) => {
    const history = JSON.parse(localStorage.getItem("audiobot_sessions") || "{}");
    const session = history[id];

    if (!session) return;

    currentConversationId = id;
    conversationIdDisplay.textContent = id;
    chatMessages.innerHTML = "";

    session.messages.forEach(msg => {
        addMessage(msg.sender, msg.text, true);
    });

    renderSidebar();
};

newChatBtn.onclick = createNewChat;

clearHistoryBtn.onclick = () => {
    localStorage.removeItem("audiobot_sessions");
    createNewChat();
};

// Controls
function sendMessage() {
    const text = textInput.value.trim();
    if (!text) return;

    addMessage("You", text);

    ws.send(JSON.stringify({
        type: "text",
        conversation_id: currentConversationId,
        message: text
    }));

    textInput.value = "";
}

sendTextBtn.onclick = sendMessage;

textInput.onkeydown = (e) => {
    if (e.key === "Enter") sendMessage();
};

// Voice Recording
async function toggleRecording() {
    if (!isRecording) {
        // Start
        chunks = [];
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            recorder = new MediaRecorder(stream);
            recorder.ondataavailable = e => chunks.push(e.data);
            recorder.onstop = sendAudio;

            recorder.start();
            isRecording = true;
            voiceBtn.classList.add("recording");
            voiceStatus.textContent = "Recording... Click to Stop";
        } catch (err) {
            console.error("Mic access denied", err);
            alert("Please allow microphone access");
        }
    } else {
        // Stop
        recorder.stop();
        isRecording = false;
        voiceBtn.classList.remove("recording");
        voiceStatus.textContent = "Processing...";
        setTimeout(() => {
            if (!isRecording) voiceStatus.textContent = "Press to Record";
        }, 2000);
    }
}

async function sendAudio() {
    if (chunks.length === 0) return;
    const blob = new Blob(chunks, { type: "audio/wav" });
    const buffer = await blob.arrayBuffer();

    ws.send(JSON.stringify({
        type: "audio",
        conversation_id: currentConversationId
    }));

    ws.send(buffer);
}

voiceBtn.onclick = toggleRecording;

// Initial Setup
const existingHistory = JSON.parse(localStorage.getItem("audiobot_sessions") || "{}");
const sessionIds = Object.keys(existingHistory);

if (sessionIds.length > 0) {
    // Load most recent
    const latestId = sessionIds.sort((a, b) => existingHistory[b].timestamp - existingHistory[a].timestamp)[0];
    loadConversation(latestId);
} else {
    createNewChat();
}
