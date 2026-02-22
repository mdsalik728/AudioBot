const conversationList = document.getElementById("conversationList");
const conversationDetail = document.getElementById("conversationDetail");

const API_BASE = "http://127.0.0.1:8000";

async function loadConversations() {
    const res = await fetch(`${API_BASE}/admin/conversations`);
    const data = await res.json();

    conversationList.innerHTML = "";

    data.conversations.forEach(id => {
        const li = document.createElement("li");
        li.textContent = id;
        li.onclick = () => loadConversation(id);
        conversationList.appendChild(li);
    });
}

async function loadConversation(id) {
    const res = await fetch(`${API_BASE}/admin/conversations/${id}`);

    if (!res.ok) {
        conversationDetail.textContent = "Conversation not found";
        return;
    }

    const data = await res.json();
    conversationDetail.textContent = data.messages.join("\n");
}

// Initial load
loadConversations();