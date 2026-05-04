import { db } from "./firebase.js";

// Import from the specific Firestore bundle
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  arrayUnion
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { observeAuth } from "./UserAuthentication/auth.js";
import { register } from "./user data/userdata.js";

let currentUserUID = null;
const apiKey = "957797d0d0934d3d885f8d54b8f06294"; // Your Spoonacular Key

// /** 
//  * FIRESTORE INTEGRATION 
//  * Handles data persistence to the cloud.
//  */
// --- FIRESTORE INTEGRATION ---
async function saveTracker() {
  if (!currentUserUID) return;
  const ref = doc(db, "calories", currentUserUID);
  await setDoc(ref, {
    entries: calorieTracker.entries,
    totalCalories: calorieTracker.totalCalories
  });
}
// Register the save function to be called by external observers if needed
register("calories", saveTracker);

// Auth Listener: Triggers every time the user's login status changes
observeAuth(async (uid) => {
  if (!uid) {
    currentUserUID = null;
    return;
  }
  currentUserUID = uid;

  // Fetch existing user data from Firestore on login
  const ref = doc(db, "calories", uid);
  const snap = await getDoc(ref);

  
  if (snap && typeof snap.exists === 'function' && snap.exists()) {
    // Populate the local tracker with cloud data
    calorieTracker.entries = snap.data().entries || [];
    calorieTracker.totalCalories = snap.data().totalCalories || 0;
  } else {
    // Reset for new users with no data
    calorieTracker.entries = [];
    calorieTracker.totalCalories = 0;
  }

  updateSummary();// Refresh the UI with loaded data
});

// --- CORE LOGIC ---
/**
 * CORE LOGIC
 * Manages the local calorie data and syncs changes.
 */
export const calorieTracker = {
  totalCalories: 0,
  entries: [],

  // Validates input, adds to local list, and triggers a cloud save
  async addEntry(name, calories) {
    const calValue = Number(calories) || 0;
    this.entries.push({ name, calories: calValue });
    this.totalCalories += calValue;
    
    await saveTracker(); 
    updateSummary();
  },

  // Locates a food item by name and removes it, updating totals
  async removeEntry(name) {
    const index = this.entries.findIndex(e => e.name === name);
    if (index !== -1) {
      this.totalCalories -= this.entries[index].calories;
      this.entries.splice(index, 1);
      await saveTracker();
      updateSummary();
    }
  }
};

/**
 * API FUNCTIONS
 * Interfaces with the Spoonacular Food API.
 */

// Phase 1: Search for an ingredient list based on user text input
async function searchFood() {
  const input = document.getElementById("foodSearchInput");
  if (!input) return;
  
  const query = input.value.trim();
  if (!query) return alert("Please enter a food name");

  document.getElementById("searchResults").style.display = "block";

  const url = `https://api.spoonacular.com/food/ingredients/search?query=${query}&apiKey=${apiKey}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    displaySearchResults(data.results);
  } catch (error) {
    console.error("Search failed:", error);
  }
}

// Renders the search results as list items with "Add" buttons
function displaySearchResults(results) {
  const resultsDiv = document.getElementById("resultsList");
  if (!resultsDiv) return;
  resultsDiv.innerHTML = ""; 

  results.forEach(food => {
    const li = document.createElement("li");
    // Note: onclick calls a function we must expose to the 'window' object
    li.innerHTML = `
      <span>${food.name}</span> 
      <button onclick="fetchNutritionAndAdd('${food.name}', ${food.id})">Add</button>
    `;
    resultsDiv.appendChild(li);
  });
}

// Phase 2: Get specific calorie count for a selected item ID
async function fetchNutritionAndAdd(name, id) {
  const url = `https://api.spoonacular.com/food/ingredients/${id}/information?amount=1&apiKey=${apiKey}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    // Find the 'Calories' nutrient in the nested data array
    const calories = Math.round(data.nutrition.nutrients.find(n => n.name === "Calories").amount);
    
    await calorieTracker.addEntry(name, calories);
  } catch (error) {
    console.error("Nutrition fetch failed:", error);
  }
}

/**
 * UI FUNCTIONS
 * Updates the Document Object Model (DOM) to reflect current data.
 */

function updateSummary() {
  const summaryDiv = document.getElementById("summary");
  if (!summaryDiv) return; 

  if (calorieTracker.entries.length === 0) {
    summaryDiv.innerHTML = "No entries yet.";
    return;
  }

  // Build the list HTML dynamically from the entries array
  let html = "<ul>";
  calorieTracker.entries.forEach(e => {
    html += `<li>${e.name}: ${e.calories} calories</li>`;
  });
  html += "</ul><p><strong>Total: " + calorieTracker.totalCalories + " calories</strong></p>";
  summaryDiv.innerHTML = html;
}

// Manual removal based on input field text
function removeFood() {
  const name = document.getElementById("removeName").value.trim();
  if (!name) return;
  calorieTracker.removeEntry(name);
}

/**
 * EXPOSE TO WINDOW
 * Because this file is a 'module', functions aren't globally accessible by default.
 * We attach them to 'window' so HTML 'onclick' attributes can find them.
 */
window.searchFood = searchFood;
window.fetchNutritionAndAdd = fetchNutritionAndAdd;
window.removeFood = removeFood;