/**
 * MEAL TRACKER LOGIC
 * This module handles searching for recipes, managing the meal plan list,
 * and syncing data with Firebase Firestore.
 */

import { db } from "../firebase.js";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { observeAuth } from "../UserAuthentication/auth.js";
import { register } from "../user data/userdata.js";
import { searchRecipes } from "../SpoonacularAPI/SpoonacularAPI.js";
import { getUserPreferences } from "./Preference_Tracker.js";
import { calorieTracker } from "../Calorie_Tracker.js";
import { getRecipeNutrition } from "../SpoonacularAPI/SpoonacularAPI.js";

// Local state for meals and user session
let meals = [];
let currentUserUID = null;

/**
 * INITIALIZATION & AUTHENTICATION
 * Runs only if not in a test environment. Listens for user login status.
 */
if (typeof process === "undefined" || process.env.NODE_ENV !== "test") {
  observeAuth(async (uid) => {
    if (!uid) {
      window.location.href = "login.html"; // Force login if session expires
      return;
    }

    currentUserUID = uid;

    // Fetch the user's saved meals from Firestore
    const mealRef = doc(db, "meals", uid);
    const mealSnap = await getDoc(mealRef);

    if (mealSnap.exists()) {
      meals = mealSnap.data().items || [];
    } else {
      meals = [];
      await setDoc(mealRef, { items: [] }); // Initialize empty doc for new users
    }

    renderMeals(); // Refresh UI with loaded data
  });
}

/**
 * FIRESTORE SYNC
 * Saves the local 'meals' array to the database.
 */
async function saveMealToFirestore() {
  if (!currentUserUID) return;
  const mealRef = doc(db, "meals", currentUserUID);
  await setDoc(mealRef, { items: meals });
}

// Register the sync function so other modules can trigger a save if needed
register("meals", saveMealToFirestore);

/**
 * RECIPE SEARCH (Spoonacular)
 * Fetches user preferences (allergies, diets) and applies them to the API search.
 */
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
      // Non-fatal: if preferences fail to load, search without filters
    }
  }

  return searchRecipes(query.trim(), prefs);
}

/**
 * MANUAL MEAL SAVING
 * Validates inputs for the manual form and adds the meal to the list.
 */
export async function saveMeal() {
  const nameInput = document.getElementById("mealName");
  const dateInput = document.getElementById("cookDate");
  const calInput  = document.getElementById("mealCalories");

  const name     = nameInput.value.trim();
  const cookDate = dateInput.value;
  const calories = calInput ? parseInt(calInput.value) : NaN;

  // Validation Logic
  if (!name) { alert("Please enter a meal name."); return; }
  if (name.length > 256) { alert("Meal name must be 256 characters or fewer."); return; }
  if (!cookDate) { alert("Please enter a cook date."); return; }

  // Date Logic: Prevent planning for yesterday
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, month, day] = cookDate.split("-").map(Number);
  const selected = new Date(year, month - 1, day);
  selected.setHours(0, 0, 0, 0);

  if (selected < today) { alert("Cook date cannot be in the past."); return; }

  // Save to list and Cloud
  meals.push({ name, cookDate });
  await saveMealToFirestore();
  renderMeals();
  
  // Clear inputs
  nameInput.value = "";
  dateInput.value = "";

  // If calories provided, also log it to the Calorie Tracker module
  if (!isNaN(calories) && calories > 0) {
    try {
      await calorieTracker.addEntry(name, calories);
    } catch (_) { /* non-fatal */ }
    calInput.value = "";
  }
}

// Helper to save recipe results to the list
async function saveRecipeAsMeal(recipeName, cookDate) {
  if (!recipeName || !cookDate) return;
  meals.push({ name: recipeName, cookDate });
  await saveMealToFirestore();
  renderMeals();
}

/**
 * UI RENDERING
 * Rebuilds the "Planned Meals" list in the HTML whenever the data changes.
 */
function renderMeals() {
  const list = document.getElementById("mealList");
  if (!list) return;
  list.innerHTML = "";

  if (meals.length === 0) {
    list.innerHTML = "<li>No meals planned yet.</li>";
    return;
  }

  // Sort meals by date so they appear in chronological order
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

/**
 * PREFERENCE FILTERING
 * Compares a single recipe object against the user's saved preferences.
 */
function matchesAllPreferences(recipe, prefs) {
  // Check Cuisines
  if (prefs.cuisines?.length) {
    const matches = prefs.cuisines.some(c =>
      recipe.cuisines.some(rc => rc.toLowerCase() === c.toLowerCase())
    );
    if (!matches) return false;
  }

  // Check Diets (Vegetarian, Vegan, etc.)
  if (prefs.diets?.length) {
    const matchesAll = prefs.diets.every(d =>
      recipe.diets.some(rd => rd.toLowerCase() === d.toLowerCase())
    );
    if (!matchesAll) return false;
  }

  // Check Prep Time
  if (prefs.maxCookTime && recipe.readyInMinutes > prefs.maxCookTime) {
    return false;
  }

  return true;
}

/**
 * SEARCH HANDLER
 * Orchestrates the search, filter, and display of recipe results.
 */
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

    // Split results into "Matches Preferences" and "Others"
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

/**
 * CARD BUILDER
 * Generates the HTML structure for a single recipe result card.
 */
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

/**
 * ADD TO MEAL PLAN
 * Triggered when "Add to Meal Plan" is clicked on a recipe card.
 */
export async function addRecipeToMeals(encodedTitle, recipeId, btn) {
  const title = decodeURIComponent(encodedTitle);
  const card = btn.closest(".recipe-card");
  const dateInput = card?.querySelector(".plan-date");
  const cookDate = dateInput?.value;

  if (!cookDate) { alert("Please select a cook date first."); return; }

  // Date check
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const [year, month, day] = cookDate.split("-").map(Number);
  const selected = new Date(year, month - 1, day);
  selected.setHours(0, 0, 0, 0);

  const isPast = selected < today;

  // If it's a future meal, add it to the Meal Plan list
  if (!isPast) {
    await saveRecipeAsMeal(title, cookDate);
  }

  // Always fetch calories and log to the calorie tracker
  try {
    const calories = await getRecipeNutrition(recipeId);
    await calorieTracker.addEntry(title, calories);
  } catch (_) {
    // Non-fatal: meal is saved even if nutrition data is missing
  }

  alert(isPast
    ? `"${title}" is a past meal — added to your calorie tracker.`
    : `"${title}" added to your meal plan!`
  );
}

/**
 * TESTING EXPORTS
 * Hidden methods to allow unit tests to inspect/modify internal state.
 */
export function _setMeals(newMeals) { meals = newMeals; }
export function _getMeals() { return meals; }