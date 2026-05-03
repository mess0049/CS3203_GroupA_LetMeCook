import { _getIngredients } from './pantryTracker.js';

const API_KEY = "AIzaSyBE34GVg8-1NvgTgcGKFOEPbeGjZ8DU1bQ"; 
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
/**
 * [Reading Complexity]
 * Use patently clear names and escape logic (CWE-79).
 * Focus on 'why' rather than 'what' for security comments.
 */
function sanitizeInput(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/\//g, "&#x2F;");
}

/**
 * [Structural/Data Complexity]
 * Separated subtask: Constructs the structured request payload.
 * Uses a 'config' pattern to keep data structure simple and predictable.
 */
function createPromptRequest(userMsg, pantryItems, targetLang) {
    const ingredients = pantryItems.length > 0 ? pantryItems.map(i => i.name).join(", ") : "None";
    const instruction = `You are a LetMeCook assistant. User Pantry: [${ingredients}]. Target Language: ${targetLang}. 
                         Provide helpful advice in ${targetLang} only.`;
    
    return {
        contents: [{ parts: [{ text: `${instruction}\n\nUser: ${userMsg}` }] }]
    };
}

/**
 * [Decision Complexity]
 * Isolates the fetch logic and handles timeout/errors as discrete decision points.
 * Uses early returns to avoid deep nesting.
 */
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
        throw error; // Let the caller handle the specific UI error message
    }
}

/**
 * [Structural Complexity] 
 * Main handler kept under 30 lines by delegating subtasks to helpers.
 */
async function handleUserChatSubmission() {
    const inputField = document.getElementById("user-input");
    const chatHistory = document.getElementById("chat-history");
    const userMsg = inputField.value.trim();

    if (!userMsg) return; // Guard clause for reading complexity

    updateChatUI(chatHistory, sanitizeInput(userMsg), 'right');
    inputField.value = "";

    try {
        const pantry = _getIngredients();
        const lang = document.getElementById("lang-select").value;
        const body = createPromptRequest(userMsg, pantry, lang);
        
        const response = await fetchAIResponse(body);
        if (!response.ok) throw new Error(response.status);

        const data = await response.json();
        const botReply = data.candidates[0].content.parts[0].text;
        updateChatUI(chatHistory, sanitizeInput(botReply), 'left');
    } catch (err) {
        displayErrorMessage(chatHistory, err);
    }
}

// Helper to keep UI updates consistent
function updateChatUI(container, text, alignment) {
    const bgColor = alignment === 'right' ? '#e0f7fa' : '#f1f1f1';
    container.innerHTML += `<div style="margin-bottom: 10px; text-align: ${alignment};">
        <span style="background: ${bgColor}; padding: 5px 10px; border-radius: 10px; display: inline-block;">${text}</span>
    </div>`;
    container.scrollTop = container.scrollHeight;
}

// Separate error handling for decision complexity reduction
function displayErrorMessage(container, error) {
    const msg = error.name === 'AbortError' 
        ? "Timeout: Server is busy." 
        : `System Alert: Unavailable (${error.message}).`;
    container.innerHTML += `<div style="color: red; margin-bottom: 10px;">🚨 ${msg}</div>`;
}

document.getElementById("send-btn").addEventListener("click", handleUserChatSubmission);