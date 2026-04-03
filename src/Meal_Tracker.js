import { db } from "../firebase.js";
import { observeAuth } from "../auth.js";
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";

let meals = [];

export function _setMeals(newMeals) {
  meals = newMeals;
}

export function _getMeals() {
  return meals;
}

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
  const selected = new Date(cookDate);
  selected.setHours(0, 0, 0, 0);

  if (selected < today) {
    alert("Cook date cannot be in the past.");
    return;
  }

  const meal = { name, cookDate };
  meals.push(meal);
}
