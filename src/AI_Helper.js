import { _getIngredients } from './SpoonacularAPI/Pantry_Tracker.js';

const API_KEY = "AIzaSyBE34GVg8-1NvgTgcGKFOEPbeGjZ8DU1bQ"; 
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

// Monitoring system for Reliability requirements
const apiMonitor = {
    totalCalls: 0,
    successCount: 0,
    errorCount: 0,
    lastResponseTime: 0,

    logCall(startTime, isSuccess) {
        this.totalCalls++;
        isSuccess ? this.successCount++ : this.errorCount++;
        this.lastResponseTime = performance.now() - startTime;
        console.log(`[Monitor] Total: ${this.totalCalls}, Success: ${this.successCount}, Error: ${this.errorCount}, Latency: ${this.lastResponseTime.toFixed(2)}ms`);
    }
};

// Sanitize input for Security (CWE-79)
function sanitizeInput(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/\//g, "&#x2F;");
}

// Build structured request (Data Complexity)
function createPromptRequest(userMsg, pantryItems, targetLang) {
    const ingredients = pantryItems.length > 0 ? pantryItems.map(i => i.name).join(", ") : "None";
    const instruction = `You are a LetMeCook assistant. User Pantry: [${ingredients}]. Target Language: ${targetLang}. Provide advice in ${targetLang} only.`;
    
    return {
        contents: [{ parts: [{ text: `${instruction}\n\nUser: ${userMsg}` }] }]
    };
}

// Handle API call with 10s timeout (Reliability)
async function fetchAIResponse(requestBody) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        throw error;
    }
}

// Main chat handler (Structural Complexity < 30 lines)
async function handleUserChatSubmission() {
    const inputField = document.getElementById("user-input");
    const chatHistory = document.getElementById("chat-history");
    const userMsg = inputField.value.trim();
    if (!userMsg) return;

    updateChatUI(chatHistory, sanitizeInput(userMsg), 'right');
    inputField.value = "";
    const startTime = performance.now(); // start timer

    try {
        const pantry = _getIngredients();
        const lang = document.getElementById("lang-select").value;
        const body = createPromptRequest(userMsg, pantry, lang);
        
        const response = await fetchAIResponse(body);
        if (!response.ok) throw new Error(response.status);

        const data = await response.json();
        const botReply = data.candidates[0].content.parts[0].text;
        
        updateChatUI(chatHistory, sanitizeInput(botReply), 'left');
        apiMonitor.logCall(startTime, true); // log success
    } catch (err) {
        apiMonitor.logCall(startTime, false); // log failure
        displayErrorMessage(chatHistory, err);
    }
}

// UI Helpers
function updateChatUI(container, text, alignment) {
    const bgColor = alignment === 'right' ? '#e0f7fa' : '#f1f1f1';
    container.innerHTML += `<div style="margin-bottom: 10px; text-align: ${alignment};">
        <span style="background: ${bgColor}; padding: 5px 10px; border-radius: 10px; display: inline-block;">${text}</span>
    </div>`;
    container.scrollTop = container.scrollHeight;
}

function displayErrorMessage(container, error) {
    const msg = error.name === 'AbortError' ? "Timeout: Server busy." : `Error: ${error.message}`;
    container.innerHTML += `<div style="color: red; margin-bottom: 10px;">🚨 System Alert: ${msg}</div>`;
}

// Event Listeners
document.getElementById("send-btn").addEventListener("click", handleUserChatSubmission);
document.getElementById("user-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleUserChatSubmission();
});