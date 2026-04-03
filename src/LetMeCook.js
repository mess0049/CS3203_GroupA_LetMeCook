import { db } from "./firebase.js";
import { doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { observeAuth } from "./auth.js";

let currentUserUID = null;
const apiKey = "957797d0d0934d3d885f8d54b8f06294"; // Your Spoonacular Key

// --- FIRESTORE INTEGRATION ---
async function saveTracker() {
  if (!currentUserUID) return;
  const ref = doc(db, "calories", currentUserUID);
  await setDoc(ref, { 
    entries: calorieTracker.entries, 
    totalCalories: calorieTracker.totalCalories 
  });
}

observeAuth(async (uid) => {
  if (!uid) {
    currentUserUID = null;
    return;
  }
  currentUserUID = uid;

  const ref = doc(db, "calories", uid);
  const snap = await getDoc(ref);

  if (snap && typeof snap.exists === 'function' && snap.exists()) {
    calorieTracker.entries = snap.data().entries || [];
    calorieTracker.totalCalories = snap.data().totalCalories || 0;
  } else {
    calorieTracker.entries = [];
    calorieTracker.totalCalories = 0;
  }

  updateSummary();
});

// --- CORE LOGIC ---
export const calorieTracker = {
  totalCalories: 0,
  entries: [],

  async addEntry(name, calories) {
    const calValue = Number(calories) || 0;
    this.entries.push({ name, calories: calValue });
    this.totalCalories += calValue;
    await saveTracker();
    updateSummary();
  },

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

// --- API FUNCTIONS ---
async function searchFood() {
  const input = document.getElementById("foodSearchInput"); // Matches your HTML
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

function displaySearchResults(results) {
  const resultsDiv = document.getElementById("resultsList");
  if (!resultsDiv) return;
  resultsDiv.innerHTML = ""; 

  results.forEach(food => {
    const li = document.createElement("li");
    li.innerHTML = `
      <span>${food.name}</span> 
      <button onclick="fetchNutritionAndAdd('${food.name}', ${food.id})">Add</button>
    `;
    resultsDiv.appendChild(li);
  });
}

async function fetchNutritionAndAdd(name, id) {
  const url = `https://api.spoonacular.com/food/ingredients/${id}/information?amount=1&apiKey=${apiKey}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    const calories = Math.round(data.nutrition.nutrients.find(n => n.name === "Calories").amount);
    await calorieTracker.addEntry(name, calories);
  } catch (error) {
    console.error("Nutrition fetch failed:", error);
  }
}

// --- UI FUNCTIONS ---
function updateSummary() {
  const summaryDiv = document.getElementById("summary");
  if (!summaryDiv) return; // The Null Guard

  if (calorieTracker.entries.length === 0) {
    summaryDiv.innerHTML = "No entries yet.";
    return;
  }

  let html = "<ul>";
  calorieTracker.entries.forEach(e => {
    html += `<li>${e.name}: ${e.calories} calories</li>`;
  });
  html += "</ul><p><strong>Total: " + calorieTracker.totalCalories + " calories</strong></p>";
  summaryDiv.innerHTML = html;
}

function removeFood() {
  const name = document.getElementById("removeName").value.trim();
  if (!name) return;
  calorieTracker.removeEntry(name);
}

// --- EXPOSE TO WINDOW ---
window.searchFood = searchFood;
window.fetchNutritionAndAdd = fetchNutritionAndAdd;
window.removeFood = removeFood;