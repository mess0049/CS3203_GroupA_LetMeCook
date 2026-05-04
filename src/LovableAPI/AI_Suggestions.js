const SUPABASE_URL = "https://tiqkdnpjiytfquzbbybr.supabase.co";
const ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpcWtkbnBqaXl0ZnF1emJieWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDA2NTUsImV4cCI6MjA5MDQ3NjY1NX0.EErkriXnyvVdbio7sgdprOFYkvs9iq4-pRPH30wUACU";
const CHAT_URL = `${SUPABASE_URL}/functions/v1/ai-food-suggestions`;

// ELEMENTS 
const form = document.getElementById("suggestion-form");
const submitBtn = document.getElementById("submit-btn");
const btnContent = document.getElementById("btn-content");
const resultsCard = document.getElementById("results-card");
const suggestionsEl = document.getElementById("suggestions");
const toastEl = document.getElementById("toast");
const returnBtn = document.getElementById("return-btn");


function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 3500);
}

function setLoading(loading) {
  submitBtn.disabled = loading;
  if (returnBtn) returnBtn.disabled = loading;

  btnContent.innerHTML = loading
    ? '<span class="spinner"></span> Generating suggestions...'
    : "✨ Get AI Suggestions";
}

if (returnBtn) {
  returnBtn.addEventListener("click", () => {
    window.location.replace("../dashboard.html");
  });
}

// SAFE MARKDOWN RENDER
function renderMarkdown(text) {
  let html = text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  html = html
    .replace(/^### (.*$)/gm, "<h3>$1</h3>")
    .replace(/^## (.*$)/gm, "<h2>$1</h2>")
    .replace(/^# (.*$)/gm, "<h1>$1</h1>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`([^`]+)`/g, "<code>$1</code>");

  html = html.replace(/(?:^|\n)([-*] .+(?:\n[-*] .+)*)/g, (match, list) => {
    const items = list
      .split("\n")
      .map((l) => `<li>${l.replace(/^[-*]\s+/, "")}</li>`)
      .join("");
    return `\n<ul>${items}</ul>`;
  });

  return html.replace(/\n/g, "<br />");
}

// CWE-20 IMPROPER INPUT VALIDATION
const SAFE_TEXT = /^[\p{L}\p{N}\s,.\-'/&()]*$/u;

function normalizeText(text) {
  return text.trim().toLowerCase().replace(/\s+/g, " ");
}

function validateInputs({ calorieGoal, currentCalories, allergies, dietaryNeeds }) {
  if (!calorieGoal) return "Calorie goal is required";

  const goal = Number(calorieGoal);
  if (!Number.isFinite(goal) || !Number.isInteger(goal)) {
    return "Calorie goal must be a whole number";
  }

  const current = currentCalories === "" ? 0 : Number(currentCalories);
  if (!Number.isFinite(current) || !Number.isInteger(current)) {
    return "Calories eaten must be a whole number";
  }

  if (goal < 1000 || goal > 5000) {
    return "Calorie goal must be between 1000 and 5000";
  }

  if (current < 0 || current > goal) {
    return "Calories eaten must be between 0 and your goal";
  }

  const normAllergies = normalizeText(allergies || "");
  const normDiet = normalizeText(dietaryNeeds || "");

  if (normAllergies.length > 100) return "Allergies input too long";
  if (normDiet.length > 100) return "Dietary needs input too long";

  if (normAllergies && !SAFE_TEXT.test(normAllergies)) {
    return "Allergies contains invalid characters";
  }

  if (normDiet && !SAFE_TEXT.test(normDiet)) {
    return "Dietary needs contains invalid characters";
  }

  const allowedDiets = ["vegan", "vegetarian", "keto", "none"];

  let finalDiet = "none";
  if (normDiet) {
    const match = allowedDiets.find((d) => normDiet.includes(d));
    if (!match) return "Unsupported dietary preference";
    finalDiet = match;
  }

  return {
    calorieGoal: goal,
    currentCalories: current,
    allergies: normAllergies,
    dietaryNeeds: finalDiet,
  };
}
if (form) {
  form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const calorieGoal = document.getElementById("calorieGoal").value.trim();
  const currentCalories = document.getElementById("currentCalories").value.trim();
  const allergies = document.getElementById("allergies").value.trim();
  const dietaryNeeds = document.getElementById("dietaryNeeds").value.trim();

  const validationResult = validateInputs({
    calorieGoal,
    currentCalories,
    allergies,
    dietaryNeeds,
  });

  if (typeof validationResult === "string") {
    showToast(validationResult);
    return;
  }

  setLoading(true);
  suggestionsEl.innerHTML = "";
  resultsCard.style.display = "none";

  try {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ANON_KEY}`,
        apikey: ANON_KEY,
      },
      body: JSON.stringify(validationResult),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      showToast(err.error || "Something went wrong");
      return;
    }

    if (!resp.body) throw new Error("No response body");

    resultsCard.style.display = "block";

    const reader = resp.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let idx;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;

        const json = line.slice(6).trim();
        if (json === "[DONE]") break;

        try {
          const parsed = JSON.parse(json);
          const content = parsed.choices?.[0]?.delta?.content;

          if (content) {
            fullText += content;
            suggestionsEl.innerHTML = renderMarkdown(fullText);
          }
        } catch {
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }
  } catch (err) {
    console.error(err);
    showToast("Failed to get suggestions. Please try again.");
  } finally {
    setLoading(false);
  }
});
}
export { validateInputs, normalizeText };