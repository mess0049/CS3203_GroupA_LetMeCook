import { _getIngredients } from '../SpoonacularAPI/Pantry_Tracker.js';

// Sanitize input to prevent XSS
function sanitizeInput(str) {
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;").replace(/'/g, "&#x27;").replace(/\//g, "&#x2F;");
}

// Build prompt for AI
function createPromptRequest(userMsg, pantryItems, targetLang) {
    const items = pantryItems.length > 0 ? pantryItems.map(i => i.name).join(", ") : "None";
    
    const systemPrompt = 
`You are a professional culinary assistant for the 'LetMeCook' app. 
Strictly follow these rules:
1. Language: Answer strictly in ${targetLang}.
2. Context: The user's current pantry contains: [${items}].
3. Accuracy: Recommend recipes prioritizing the provided pantry items. If extra ingredients are needed, clearly list them.
4. Tone: Be concise, objective, and provide step-by-step instructions. Do not provide dangerous or inedible recipes.
5. Limitation: If the user asks non-cooking related questions, politely decline and redirect to culinary topics.`;
    
    return {
        contents: [{ parts: [{ text: `${systemPrompt}\n\nUser: ${userMsg}` }] }]
    };
}

// Fetch response from Gemini API with retry logic
async function fetchAIResponse(userMsg, pantry, lang, maxRetries = 3) {
    // Load API key
    const responseKey = await fetch('./api_keys.json');
    if (!responseKey.ok) {
        throw new Error("API Key file missing in deployment.");
    }
    
    const keyData = await responseKey.json();
    const API_KEY = keyData.GEMINI_API_KEY;
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;
    const body = createPromptRequest(userMsg, pantry, lang);

    let delay = 1000; // Initial delay of 1 second

    // Retry loop for server errors and timeouts
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                // Retry on 5xx errors (e.g., 503) if attempts remain
                if (response.status >= 500 && attempt < maxRetries) {
                    console.warn(`[Retry] HTTP ${response.status}. Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2; // Exponential backoff
                    continue;
                }
                throw new Error(`HTTP Error: ${response.status}`);
            }
            
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            // Retry on timeout if attempts remain
            if (error.name === 'AbortError' && attempt < maxRetries) {
                console.warn(`[Retry] Timeout. Retrying in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
                delay *= 2; // Exponential backoff
                continue;
            }
            throw error;
        }
    }
}

// Main chat function
async function handleUserChatSubmission() {
    const inputField = document.getElementById("user-input");
    const chatHistory = document.getElementById("chat-history");
    const userMsg = inputField.value.trim();

    if (!userMsg) return;

    // Show user message
    updateChatUI(chatHistory, sanitizeInput(userMsg), 'right');
    inputField.value = "";

    try {
        // Get pantry data safely
        let pantry = [];
        try { pantry = _getIngredients(); } catch (e) {}
        
        const lang = document.getElementById("lang-select").value;
        const response = await fetchAIResponse(userMsg, pantry, lang);
        
        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        const data = await response.json();
        const botReply = data.candidates[0].content.parts[0].text;
        
        // Show AI response
        updateChatUI(chatHistory, sanitizeInput(botReply), 'left');
    } catch (err) {
        displayErrorMessage(chatHistory, err);
    }
}

// Update UI with chat bubbles
function updateChatUI(container, text, alignment) {
    const bgColor = alignment === 'right' ? '#e0f7fa' : '#f1f1f1';
    container.innerHTML += `<div style="margin-bottom: 10px; text-align: ${alignment};">
        <span style="background: ${bgColor}; padding: 5px 10px; border-radius: 10px; display: inline-block;">${text}</span>
    </div>`;
    container.scrollTop = container.scrollHeight;
}

// Show error in UI
function displayErrorMessage(container, error) {
    const msg = error.name === 'AbortError' ? "Timeout" : `${error.message}`;
    container.innerHTML += `<div style="color: red; margin-bottom: 10px;">🚨 Error: ${msg}</div>`;
}

// Event listeners for send button and enter key
document.getElementById("send-btn").addEventListener("click", handleUserChatSubmission);
document.getElementById("user-input").addEventListener("keypress", (e) => {
    if (e.key === "Enter") handleUserChatSubmission();
});