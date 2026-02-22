const API = "http://127.0.0.1:8000";

async function check(endpoint, elementId) {
    try {
        const res = await fetch(`${API}${endpoint}`);
        if (res.ok) {
            document.getElementById(elementId).innerText = "Healthy ✅";
        } else {
            document.getElementById(elementId).innerText = "Error ❌";
        }
    } catch (err) {
        document.getElementById(elementId).innerText = "Down ❌";
    }
}

async function runChecks() {
    check("/health", "backendStatus");
    check("/health/redis", "redisStatus");
    check("/health/llm", "llmStatus");
}

runChecks();
setInterval(runChecks, 10000); // Refresh every 10 seconds