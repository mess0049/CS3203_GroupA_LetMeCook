// Load pantry data from internal module
import { _getIngredients } from './SpoonacularAPI/Pantry_Tracker.js';


//[Security] XSS prevention (CWE-79)

function sanitizeInput(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/\//g, "&#x2F;");
}


//[Architecture] Build AI prompt with pantry context

function createPromptRequest(userMsg, pantryItems, targetLang) {
    const items = pantryItems.length > 0 ? pantryItems.map(i => i.name).join(", ") : "None";
    const instruction = `LetMeCook Assistant. Pantry: [${items}]. Target Language: ${targetLang}. Advice in ${targetLang} only.`;
    
    return {
        contents: [{ parts: [{ text: `${instruction}\n\nUser: ${userMsg}` }] }]
    };
}


//[Reliability] Fetch Gemini API with 10s timeout
async function fetchAIResponse(userMsg, pantry, lang) {
    // Load key from JSON file
    const responseKey = await fetch('./api_keys.json');
    const keyData = await responseKey.json();
    const API_KEY = keyData.GEMINI_API_KEY;
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const body = createPromptRequest(userMsg, pantry, lang);

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
            signal: controller.signal
        });
        clearTimeout(timeoutId);
        return response;
    } catch (error) {
        throw error;
    }
}


//[Architecture] Main chat handler (< 30 lines)
async function handleUserChatSubmission() {
    const inputField = document.getElementById("user-input");
    const chatHistory = document.getElementById("chat-history");
    const userMsg = inputField.value.trim();

    if (!userMsg) return;

    // Display user message
    updateChatUI(chatHistory, sanitizeInput(userMsg), 'right');
    inputField.value = "";

    try {
        const pantry = _getIngredients();
        const lang = document.getElementById("lang-select").value;
        
        const response = await fetchAIResponse(userMsg, pantry, lang);
        
        // [수정] res.status를 response.status로 변경해야 합니다.
        if (!response.ok) throw new Error(response.status);

        const data = await response.json();
        const botReply = data.candidates[0].content.parts[0].text;
        
        updateChatUI(chatHistory, sanitizeInput(botReply), 'left');
        } catch (err) {
        displayErrorMessage(chatHistory, err);
    }
}


//UI: Render chat bubble
function updateChatUI(container, text, alignment) {
    const bgColor = alignment === 'right' ? '#e0f7fa' : '#f1f1f1';
    container.innerHTML += `<div style="margin-bottom: 10px; text-align: ${alignment};">
        <span style="background: ${bgColor}; padding: 5px 10px; border-radius: 10px; display: inline-block;">${text}</span>
    </div>`;
    container.scrollTop = container.scrollHeight;
}


//UI: Show system error message
function displayErrorMessage(container, error) {
    const msg = error.name === 'AbortError' ? "Timeout" : `Error: ${error.message}`;
    container.innerHTML += `<div style="color: red; margin-bottom: 10px;">🚨 ${msg}</div>`;
}

// Event Listeners
document.getElementById("send-btn").addEventListener("click", handleUserChatSubmission);
document.getElementById("user-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleUserChatSubmission();
});