
const SUPABASE_URL = "https://tiqkdnpjiytfquzbbybr.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRpcWtkbnBqaXl0ZnF1emJieWJyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ5MDA2NTUsImV4cCI6MjA5MDQ3NjY1NX0.EErkriXnyvVdbio7sgdprOFYkvs9iq4-pRPH30wUACU";
const CHAT_URL = `${SUPABASE_URL}/functions/v1/ai-food-suggestions`;

const form = document.getElementById("suggestion-form");
const submitBtn = document.getElementById("submit-btn");
const btnContent = document.getElementById("btn-content");
const resultsCard = document.getElementById("results-card");
const suggestionsEl = document.getElementById("suggestions");
const toastEl = document.getElementById("toast");

function showToast(message) {
  toastEl.textContent = message;
  toastEl.classList.add("show");
  setTimeout(() => toastEl.classList.remove("show"), 3500);
}

function setLoading(loading) {
  submitBtn.disabled = loading;
  btnContent.innerHTML = loading
    ? '<span class="spinner"></span> Generating suggestions...'
    : "✨ Get AI Suggestions";
}

// Very small markdown -> HTML converter for the streamed response
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

  // Lists
  html = html.replace(/(?:^|\n)([-*] .+(?:\n[-*] .+)*)/g, (match, list) => {
    const items = list.split("\n").map((l) => `<li>${l.replace(/^[-*]\s+/, "")}</li>`).join("");
    return `\n<ul>${items}</ul>`;
  });

  return html.replace(/\n/g, "<br />");
}

// ---------- CWE-20: Client-side input validation ----------
// Mirror of server-side rules. Server still re-validates (defense in depth).
const SAFE_TEXT = /^[\p{L}\p{N}\s,.\-'/&()]*$/u;

function validateInputs({ calorieGoal, currentCalories, allergies, dietaryNeeds }) {
  if (calorieGoal === "" || calorieGoal === null || calorieGoal === undefined) {
    return "Please enter your calorie goal";
  }
  const cg = Number(calorieGoal);
  if (!Number.isFinite(cg) || !Number.isInteger(cg)) {
    return "Calorie goal must be a whole number";
  }
  if (cg < 500 || cg > 10000) {
    return "Calorie goal must be between 500 and 10000";
  }

  if (currentCalories !== "" && currentCalories !== null && currentCalories !== undefined) {
    const cc = Number(currentCalories);
    if (!Number.isFinite(cc) || !Number.isInteger(cc)) {
      return "Calories eaten must be a whole number";
    }
    if (cc < 0 || cc > 20000) {
      return "Calories eaten must be between 0 and 20000";
    }
  }

  if (typeof allergies !== "string" || allergies.length > 500) {
    return "Allergies must be 500 characters or fewer";
  }
  if (allergies && !SAFE_TEXT.test(allergies)) {
    return "Allergies contains invalid characters";
  }
  if (typeof dietaryNeeds !== "string" || dietaryNeeds.length > 500) {
    return "Dietary needs must be 500 characters or fewer";
  }
  if (dietaryNeeds && !SAFE_TEXT.test(dietaryNeeds)) {
    return "Dietary needs contains invalid characters";
  }

  return null;
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const calorieGoal = document.getElementById("calorieGoal").value.trim();
  const currentCalories = document.getElementById("currentCalories").value.trim();
  const allergies = document.getElementById("allergies").value.trim();
  const dietaryNeeds = document.getElementById("dietaryNeeds").value.trim();

  const validationError = validateInputs({ calorieGoal, currentCalories, allergies, dietaryNeeds });
  if (validationError) {
    showToast(validationError);
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
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        calorieGoal: Number(calorieGoal),
        currentCalories: currentCalories === "" ? 0 : Number(currentCalories),
        allergies,
        dietaryNeeds,
      }),
    });

    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      const detail = Array.isArray(err.details) ? `: ${err.details.join(", ")}` : "";
      showToast((err.error || "Something went wrong") + detail);
      setLoading(false);
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

      let newlineIndex;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") break;
        try {
          const parsed = JSON.parse(jsonStr);
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
