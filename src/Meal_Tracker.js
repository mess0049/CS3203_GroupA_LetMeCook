import { db } from "./firebase.js";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { observeAuth } from "./UserAuthentication/auth.js";
import { register } from "./user data/userdata.js";
import { searchRecipes } from "./SpoonacularAPI/SpoonacularAPI.js";
import { getUserPreferences } from "./Preference_Tracker.js";
import { calorieTracker } from "./Calorie_Tracker.js";
import { getRecipeNutrition } from "./SpoonacularAPI/SpoonacularAPI.js";

let meals = [];
let currentUserUID = null;

if (typeof process === "undefined" || process.env.NODE_ENV !== "test") {
  observeAuth(async (uid) => {
    if (!uid) {
      window.location.href = "login.html";
      return;
    }

    currentUserUID = uid;

    const mealRef = doc(db, "meals", uid);
    const mealSnap = await getDoc(mealRef);

    if (mealSnap.exists()) {
      meals = mealSnap.data().items || [];
    } else {
      meals = [];
      await setDoc(mealRef, { items: [] });
    }

    renderMeals();
  });
}

async function saveMealToFirestore() {
  if (!currentUserUID) return;
  const mealRef = doc(db, "meals", currentUserUID);
  await setDoc(mealRef, { items: meals });
}

register("meals", saveMealToFirestore);

// ── Recipe search (Spoonacular) ───────────────────────────────────────────────

async function searchMealRecipes(query) {
  if (!query || !query.trim()) {
    alert("Please enter a search term.");
    return [];
  }

  let prefs = {};
  if (currentUserUID) {
    try {
      prefs = await getUserPreferences(currentUserUID);
    } catch (_) {
      // Non-fatal — search without preferences
    }
  }

  return searchRecipes(query.trim(), prefs);
}

// ── Manual meal saving ────────────────────────────────────────────────────────

export async function saveMeal() {
  const nameInput = document.getElementById("mealName");
  const dateInput = document.getElementById("cookDate");
  const calInput  = document.getElementById("mealCalories");

  const name     = nameInput.value.trim();
  const cookDate = dateInput.value;
  const calories = calInput ? parseInt(calInput.value) : NaN;

  if (!name) { alert("Please enter a meal name."); return; }
  if (name.length > 256) { alert("Meal name must be 256 characters or fewer."); return; }
  if (!cookDate) { alert("Please enter a cook date."); return; }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, month, day] = cookDate.split("-").map(Number);
  const selected = new Date(year, month - 1, day);
  selected.setHours(0, 0, 0, 0);

  if (selected < today) { alert("Cook date cannot be in the past."); return; }

  meals.push({ name, cookDate });
  await saveMealToFirestore();
  renderMeals();
  nameInput.value = "";
  dateInput.value = "";

  if (!isNaN(calories) && calories > 0) {
    try {
      await calorieTracker.addEntry(name, calories);
    } catch (_) { /* non-fatal */ }
    calInput.value = "";
  }
}

async function saveRecipeAsMeal(recipeName, cookDate) {
  if (!recipeName || !cookDate) return;
  meals.push({ name: recipeName, cookDate });
  await saveMealToFirestore();
  renderMeals();
}

// ── Render ────────────────────────────────────────────────────────────────────

function renderMeals() {
  const list = document.getElementById("mealList");
  if (!list) return;
  list.innerHTML = "";

  if (meals.length === 0) {
    list.innerHTML = "<li>No meals planned yet.</li>";
    return;
  }

  const sorted = [...meals].sort((a, b) => a.cookDate.localeCompare(b.cookDate));
  sorted.forEach((m) => {
    const li = document.createElement("li");
    li.textContent = `${m.cookDate} — ${m.name}`;
    const btn = document.createElement("button");
    btn.textContent = "Remove";
    btn.onclick = async () => {
      meals.splice(meals.indexOf(m), 1);
      await saveMealToFirestore();
      renderMeals();
    };
    li.appendChild(btn);
    list.appendChild(li);
  });
}

// ── Exported functions (bound to window in HTML) ──────────────────────────────

// export async function handleMealSearch() {
//   const query = document.getElementById("recipeSearch")?.value;
//   const resultsDiv = document.getElementById("searchResults");
//   if (!resultsDiv) return;

//   resultsDiv.innerHTML = "<p>Searching…</p>";
//   try {
//     const recipes = await searchMealRecipes(query);
//     if (!recipes.length) {
//       resultsDiv.innerHTML = "<p>No recipes found. Try a different search.</p>";
//       return;
//     }
//     resultsDiv.innerHTML = "";
//     recipes.forEach((r) => {
//       const card = document.createElement("div");
//       card.className = "recipe-card";
//       card.innerHTML = `
//         <img src="${r.image}" alt="${r.title}" width="80" />
//         <strong>${r.title}</strong>
//         <span>${r.readyInMinutes} min · ${r.servings} servings</span>
//         <label>Cook date: <input type="date" class="plan-date" /></label>
//         <button onclick="window.addRecipeToMeals('${encodeURIComponent(r.title)}', ${r.id}, this)">
//           Add to Meal Plan
//         </button>
//       `;
//       resultsDiv.appendChild(card);
//     });
//   } catch (err) {
//     resultsDiv.innerHTML = "<p>Could not fetch recipes. Please try again later.</p>";
//   }
// }

function matchesAllPreferences(recipe, prefs) {
  if (prefs.cuisines?.length) {
    const matches = prefs.cuisines.some(c =>
      recipe.cuisines.some(rc => rc.toLowerCase() === c.toLowerCase())
    );
    if (!matches) return false;
  }

  if (prefs.diets?.length) {
    const matchesAll = prefs.diets.every(d =>
      recipe.diets.some(rd => rd.toLowerCase() === d.toLowerCase())
    );
    if (!matchesAll) return false;
  }

  if (prefs.maxCookTime && recipe.readyInMinutes > prefs.maxCookTime) {
    return false;
  }

  return true;
}

export async function handleMealSearch() {
  const query = document.getElementById("recipeSearch")?.value;
  const resultsDiv = document.getElementById("searchResults");
  if (!resultsDiv) return;

  resultsDiv.innerHTML = "<p>Searching…</p>";
  try {
    let prefs = {};
    if (currentUserUID) {
      try { prefs = await getUserPreferences(currentUserUID); } catch (_) {}
    }

    const hasPrefs = prefs.cuisines?.length || prefs.diets?.length ||
                     prefs.allergies?.length || prefs.maxCookTime;

    const allResults = await searchRecipes(query.trim(), {});

    if (!allResults.length) {
      resultsDiv.innerHTML = "<p>No recipes found. Try a different search.</p>";
      return;
    }

    resultsDiv.innerHTML = "";

    if (hasPrefs) {
      const preferred = allResults.filter(r => matchesAllPreferences(r, prefs));
      const others    = allResults.filter(r => !matchesAllPreferences(r, prefs));

      if (preferred.length) {
        const prefHeader = document.createElement("p");
        prefHeader.style.cssText = "width:100%; margin:0 0 0.5rem; font-weight:bold; color:#27ae60;";
        prefHeader.textContent = "✓ Matches your preferences";
        resultsDiv.appendChild(prefHeader);
        preferred.forEach(r => resultsDiv.appendChild(buildCard(r)));
      }

      if (others.length) {
        const divider = document.createElement("p");
        divider.style.cssText = "width:100%; margin:0.75rem 0 0.5rem; font-weight:bold; color:#888; border-top: 1px solid #ddd; padding-top:0.75rem;";
        divider.textContent = "Other results";
        resultsDiv.appendChild(divider);
        others.forEach(r => resultsDiv.appendChild(buildCard(r)));
      }
    } else {
      allResults.forEach(r => resultsDiv.appendChild(buildCard(r)));
    }

  } catch (err) {
    resultsDiv.innerHTML = "<p>Could not fetch recipes. Please try again later.</p>";
  }
}

function buildCard(r) {
  const card = document.createElement("div");
  card.className = "recipe-card";
  card.innerHTML = `
    <img src="${r.image}" alt="${r.title}" width="80" />
    <strong>${r.title}</strong>
    <span>${r.readyInMinutes} min · ${r.servings} servings</span>
    <label>Cook date: <input type="date" class="plan-date" /></label>
    <button onclick="window.addRecipeToMeals('${encodeURIComponent(r.title)}', ${r.id}, this)">
      Add to Meal Plan
    </button>
  `;
  return card;
}

export async function addRecipeToMeals(encodedTitle, recipeId, btn) {
  const title = decodeURIComponent(encodedTitle);
  const card = btn.closest(".recipe-card");
  const dateInput = card?.querySelector(".plan-date");
  const cookDate = dateInput?.value;
  if (!cookDate) { alert("Please select a cook date first."); return; }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, month, day] = cookDate.split("-").map(Number);
  const selected = new Date(year, month - 1, day);
  selected.setHours(0, 0, 0, 0);

  const isPast = selected < today;

  if (!isPast) {
    await saveRecipeAsMeal(title, cookDate);
  }

  // Fetch calories and log to calorie tracker
  try {
    const calories = await getRecipeNutrition(recipeId);
    await calorieTracker.addEntry(title, calories);
  } catch (_) {
    // Non-fatal — meal is still saved even if nutrition fetch fails
  }

  alert(isPast
    ? `"${title}" is a past meal — added to your calorie tracker.`
    : `"${title}" added to your meal plan!`
  );
}

// ── Test helpers ──────────────────────────────────────────────────────────────

export function _setMeals(newMeals) { meals = newMeals; }
export function _getMeals() { return meals; }
