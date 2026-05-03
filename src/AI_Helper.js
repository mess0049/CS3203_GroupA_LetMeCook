import { _getIngredients } from './pantryTracker.js';

const API_KEY = "AIzaSyDLFa_wxRJtaP832OQUK4nE5HXrl0j0M0M"; // Gemini 2.5 Flash API Key
const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

function sanitizeHTML(str) {
    return str.replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;")
              .replace(/'/g, "&#x27;")
              .replace(/\//g, "&#x2F;");
}

async function sendMessage() {
    const inputField = document.getElementById("user-input");
    const chatHistory = document.getElementById("chat-history");
    const rawUserMessage = inputField.value.trim();

    if (!rawUserMessage) return;

    const safeUserMessage = sanitizeHTML(rawUserMessage);
    chatHistory.innerHTML += `<div style="margin-bottom: 10px; text-align: right;">
        <span style="background: #e0f7fa; padding: 5px 10px; border-radius: 10px; display: inline-block;">${safeUserMessage}</span>
    </div>`;
    
    inputField.value = ""; 
    chatHistory.scrollTop = chatHistory.scrollHeight; 

    // 식재료가 없을 때의 기본값 영문화
    const pantryItems = _getIngredients();
    const ingredientsList = pantryItems.length > 0 
        ? pantryItems.map(item => item.name).join(", ") 
        : "No ingredients available";

    const targetLang = document.getElementById("lang-select").value;

    const systemInstruction = `You are a helpful assistant for the LetMeCook app. 
Context: The user currently has the following ingredients in their pantry: [${ingredientsList}]. 
Instruction: When recommending recipes or giving nutritional advice, prioritize utilizing the ingredients they already have. Provide short and accurate responses.
CRITICAL REQUIREMENT: You MUST translate and output your final response entirely in ${targetLang}.`;
    
    const requestBody = {
        contents: [{
            parts: [{ text: systemInstruction + "\n\nUser Question: " + rawUserMessage }] 
        }]
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); 

    try {
        const response = await fetch(API_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
            // API 서버 오류 메시지 영문화
            throw new Error(`Server error occurred (Status code: ${response.status})`);
        }

        const data = await response.json();
        
        const rawBotReply = data.candidates[0].content.parts[0].text;
        const safeBotReply = sanitizeHTML(rawBotReply);

        chatHistory.innerHTML += `<div style="margin-bottom: 10px; text-align: left;">
            <span style="background: #f1f1f1; padding: 5px 10px; border-radius: 10px; display: inline-block;">${safeBotReply}</span>
        </div>`;
        
    } catch (error) {
        // 장애 안내(Outage) 메시지 영문화
        let errorMessage = "";
        if (error.name === 'AbortError') {
            errorMessage = "API server response is delayed (Timeout). Please try again later.";
        } else {
            errorMessage = `The chatbot server is currently unavailable. Reason: ${error.message}. We will restore it shortly.`;
        }

        chatHistory.innerHTML += `<div style="color: red; margin-bottom: 10px; text-align: left;">
            <span style="background: #ffebee; padding: 5px 10px; border-radius: 10px; display: inline-block;">🚨 System Alert: ${errorMessage}</span>
        </div>`;
    }
    
    chatHistory.scrollTop = chatHistory.scrollHeight;
}

document.getElementById("send-btn").addEventListener("click", sendMessage);
document.getElementById("user-input").addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        sendMessage();
    }
});