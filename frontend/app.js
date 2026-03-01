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
const resumeUploadInput = document.getElementById("resumeUpload");
const jdUploadInput = document.getElementById("jdUpload");
const uploadResumeBtn = document.getElementById("uploadResumeBtn");
const uploadJdBtn = document.getElementById("uploadJdBtn");
const resetJdBtn = document.getElementById("resetJdBtn");
const jdStatusBadge = document.getElementById("jdStatus");
const resumeStatusBadge = document.getElementById("resumeStatus");

// State
const INITIAL_GREETING = "Hello! I'm your interviewer for this meeting. Let's begin!";
let currentConversationId = "";
let currentConversationMessages = [];
const API_BASE = "http://127.0.0.1:8000";

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
    refreshContextStatus(currentConversationId);
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
    refreshContextStatus(currentConversationId);
};

newChatBtn.onclick = createNewChat;

clearHistoryBtn.onclick = () => {
    localStorage.removeItem("audiobot_sessions");
    localStorage.removeItem("audiobot_context_meta");
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

function setStatusBadge(el, text, type) {
    el.textContent = text;
    el.classList.remove("ok", "warning", "error");
    el.classList.add(type);
}

function saveContextMeta(conversationId, patch) {
    const allMeta = JSON.parse(localStorage.getItem("audiobot_context_meta") || "{}");
    allMeta[conversationId] = {
        ...(allMeta[conversationId] || {}),
        ...patch
    };
    localStorage.setItem("audiobot_context_meta", JSON.stringify(allMeta));
}

async function refreshContextStatus(conversationId) {
    if (!conversationId) return;

    try {
        const res = await fetch(`${API_BASE}/context/status?conversation_id=${encodeURIComponent(conversationId)}`);
        if (!res.ok) throw new Error("Unable to fetch context status");
        const data = await res.json();

        if (!data.default_jd_loaded) {
            setStatusBadge(jdStatusBadge, "JD unavailable", "error");
        } else if (data.jd_override_present) {
            setStatusBadge(jdStatusBadge, "Using custom JD", "ok");
        } else {
            setStatusBadge(jdStatusBadge, "Default JD loaded", "ok");
        }

        if (data.resume_present) {
            setStatusBadge(resumeStatusBadge, "Uploaded", "ok");
        } else {
            setStatusBadge(resumeStatusBadge, "Not uploaded", "warning");
        }

        saveContextMeta(conversationId, {
            resume_present: data.resume_present,
            jd_override_present: data.jd_override_present
        });
    } catch (err) {
        console.error(err);
        setStatusBadge(jdStatusBadge, "Status error", "error");
        setStatusBadge(resumeStatusBadge, "Status error", "error");
    }
}

async function uploadPdf(endpoint, file, conversationId) {
    if (!file) {
        alert("Please select a PDF file first.");
        return null;
    }

    const formData = new FormData();
    formData.append("conversation_id", conversationId);
    formData.append("file", file);

    const res = await fetch(`${API_BASE}${endpoint}`, {
        method: "POST",
        body: formData
    });

    const payload = await res.json();
    if (!res.ok) {
        throw new Error(payload.detail || "Upload failed");
    }
    return payload;
}

async function uploadResume(file, conversationId) {
    const payload = await uploadPdf("/context/resume/upload", file, conversationId);
    addMessage("AI", `Resume uploaded successfully (${payload.chars_extracted} characters extracted).`);
}

async function uploadJdOverride(file, conversationId) {
    const payload = await uploadPdf("/context/jd/upload", file, conversationId);
    addMessage("AI", `JD override uploaded successfully (${payload.chars_extracted} characters extracted).`);
}

uploadResumeBtn.onclick = async () => {
    try {
        await uploadResume(resumeUploadInput.files[0], currentConversationId);
        resumeUploadInput.value = "";
        await refreshContextStatus(currentConversationId);
    } catch (err) {
        alert(err.message);
    }
};

uploadJdBtn.onclick = async () => {
    try {
        await uploadJdOverride(jdUploadInput.files[0], currentConversationId);
        jdUploadInput.value = "";
        await refreshContextStatus(currentConversationId);
    } catch (err) {
        alert(err.message);
    }
};

resetJdBtn.onclick = async () => {
    try {
        const res = await fetch(`${API_BASE}/context/jd/override?conversation_id=${encodeURIComponent(currentConversationId)}`, {
            method: "DELETE"
        });
        const payload = await res.json();
        if (!res.ok) throw new Error(payload.detail || "Failed to reset JD override");
        addMessage("AI", "JD override reset. Default JD will be used.");
        await refreshContextStatus(currentConversationId);
    } catch (err) {
        alert(err.message);
    }
};

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
