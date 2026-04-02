import { db } from "./firebase.js";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { observeAuth } from "./auth.js";

let currentUserUID = null;

// --- FIRESTORE INTEGRATION ---
async function saveTracker() {
  if (!currentUserUID) return;
  const ref = doc(db, "calories", currentUserUID);
  await setDoc(ref, { entries: calorieTracker.entries, totalCalories: calorieTracker.totalCalories });
}

// Load tracker from Firestore when user logs in
observeAuth(async (uid) => {
  if (!uid) return;
  currentUserUID = uid;

  const ref = doc(db, "calories", uid);
  const snap = await getDoc(ref);

  if (snap.exists()) {
    calorieTracker.entries = snap.data().entries || [];
    calorieTracker.totalCalories = snap.data().totalCalories || 0;
  } else {
    calorieTracker.entries = [];
    calorieTracker.totalCalories = 0;
    await setDoc(ref, { entries: [], totalCalories: 0 });
  }

  updateSummary();
});

// Basic calorie tracker object
export const calorieTracker = {
  totalCalories: 0,
  entries: [],

  async addEntry(name, calories) {
    this.entries.push({ name, calories });
    this.totalCalories += calories;
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
    } else {
      alert(`No entry found for "${name}"`);
    }
  }
};

// UI FUNCTIONS
function addSelectedFood() {
  const select = document.getElementById("foodSelect");
  const name = select.value;
  const calories = parseInt(select.selectedOptions[0].dataset.cal);

  calorieTracker.addEntry(name, calories);
}

function removeFood() {
  const name = document.getElementById("removeName").value.trim();
  if (!name) return alert("Enter a food name to remove");

  calorieTracker.removeEntry(name);
  document.getElementById("removeName").value = "";
}

function updateSummary() {
  const summaryDiv = document.getElementById("summary");

  if (calorieTracker.entries.length === 0) {
    summaryDiv.innerHTML = "No entries yet.";
    return;
  }

  let html = "<ul>";
  calorieTracker.entries.forEach(e => {
    html += `<li>${e.name}: ${e.calories} calories</li>`;
  });
  html += "</ul>";
  html += `<strong>Total: ${calorieTracker.totalCalories} calories</strong>`;

  summaryDiv.innerHTML = html;
}

window.addSelectedFood = addSelectedFood;
window.removeFood = removeFood;