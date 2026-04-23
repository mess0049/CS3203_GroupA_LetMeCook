import { db } from "./firebase.js";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { observeAuth } from "./auth.js";
import { register } from "./user data/userdata.js";

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
  });
}

async function saveMealToFirestore() {
  if (!currentUserUID) return;
  const mealRef = doc(db, "meals", currentUserUID);
  await setDoc(mealRef, { items: meals });
}

register("meals", saveMealToFirestore);

export async function saveMeal() {
  const nameInput = document.getElementById("mealName");
  const dateInput = document.getElementById("cookDate");

  const name = nameInput.value.trim();
  const cookDate = dateInput.value;

  if (!name) {
    alert("Please enter a meal name.");
    return;
  }

  if (name.length > 256) {
    alert("Meal name must be 256 characters or fewer.");
    return;
  }

  if (!cookDate) {
    alert("Please enter a cook date.");
    return;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
 const [year, month, day] = cookDate.split("-").map(Number);
const selected = new Date(year, month - 1, day);
selected.setHours(0, 0, 0, 0);

  if (selected < today) {
    alert("Cook date cannot be in the past.");
    return;
  }

  const meal = { name, cookDate };
  meals.push(meal);
  await saveMealToFirestore();
}

export function _setMeals(newMeals) {
  meals = newMeals;
}

export function _getMeals() {
  return meals;
}
