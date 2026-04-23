import { db } from "../firebase.js";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { observeAuth } from "../auth.js";
import { getRecipesByIngredients } from "./SpoonacularAPI.js";
import { register } from "../user data/userdata.js";

let useringredient = [];
let currentUserUID = null;

observeAuth(async (uid) => {
  if (!uid) {
    window.location.href = "login.html";
    return;
  }

  currentUserUID = uid;

  const pantryRef = doc(db, "pantries", uid);
  const pantrySnap = await getDoc(pantryRef);

  if (pantrySnap.exists()) {
    useringredient = pantrySnap.data().items || [];
  } else {
    useringredient = [];
    await setDoc(pantryRef, { items: [] });
  }

  displayPantry();
});

function displayPantry() {
    const pantryBody = document.getElementById("pantryBody");
    pantryBody.innerHTML = "";

    if (useringredient.length === 0) {
        pantryBody.innerHTML = "<tr><td>Your pantry is empty. Add some ingredients!</td></tr>";
        return;
    }

    useringredient.forEach(function(item, index){
        const row = `
            <tr>
                <td>${index + 1}. ${item.name} — Qty: ${item.quantity}</td>
                <td>
                    <button onclick="promptEdit('${item.name}', ${item.quantity})">Edit</button>
                    <button onclick="removeIngredient('${item.name}')">Remove</button>
                </td>
            </tr>`;
        pantryBody.innerHTML += row;
    });
}

async function savePantry() {
  if (!currentUserUID) return;
  const pantryRef = doc(db, "pantries", currentUserUID);
  await setDoc(pantryRef, { items: useringredient });
}

register("pantry", savePantry);

async function addIngredient() {
    const nameInput = document.getElementById("addName");
    const quantityInput = document.getElementById("addQuantity");

    const name = nameInput.value.trim();
    const quantity = parseInt(quantityInput.value);

    if (!name) {
        alert("Please enter an ingredient name.");
        return;
    }
    if (isNaN(quantity) || quantity <= 0) {
        alert("Quantity must be a positive number.");
        return;
    }

    const existing = useringredient.find(
        item => item.name.toLowerCase() === name.toLowerCase()
    );

    if (existing) {
        existing.quantity += quantity;
        alert(`"${existing.name}" already in pantry. Updated quantity to ${existing.quantity}.`);
    } else {
        useringredient.push({ name: name, quantity: quantity });
    }

    nameInput.value = "";
    quantityInput.value = "";
    displayPantry();
    await savePantry();
}

async function removeIngredient(name) {
    const index = useringredient.findIndex(
        item => item.name.toLowerCase() === name.toLowerCase()
    );
    if (index === -1) {
        alert(`"${name}" was not found in your pantry.`);
        return;
    }

    useringredient.splice(index, 1);
    displayPantry();
    await savePantry();
}

async function promptEdit(name, currentQuantity) {
    const input = prompt(
        `Edit quantity for "${name}" (current: ${currentQuantity}).\nEnter 0 to remove it entirely:`,
        currentQuantity
    );

    if (input === null) return;

    const newQuantity = parseInt(input);

    if (isNaN(newQuantity) || newQuantity < 0) {
        alert("Please enter a valid quantity (0 or more).");
        return;
    }

    if (newQuantity === 0) {
        const confirmed = confirm(`Remove "${name}" from your pantry entirely?`);
        if (confirmed) removeIngredient(name);
        return;
    }

    const item = useringredient.find(
        i => i.name.toLowerCase() === name.toLowerCase()
    );

    if (item) {
        item.quantity = newQuantity;
        displayPantry();
        await savePantry();
    }
}

async function recommend() {
    const recipeListElement = document.getElementById("Choosed_Recipes");

    if (useringredient.length === 0) {
        recipeListElement.innerHTML = "<li>Your pantry is empty. Add some ingredients first!</li>";
        return;
    }

    recipeListElement.innerHTML = "<li>Loading recipes...</li>";

    try {
        const final_recipes = await getRecipesByIngredients(useringredient);
        recipeListElement.innerHTML = "";

        if (final_recipes.length === 0) {
            recipeListElement.innerHTML = "<li>No recipes found with your current ingredients.</li>";
            return;
        }

        final_recipes.forEach(function(recipe) {
            const li = document.createElement("li");

            let text = recipe.name;
            text += " - Uses: " + recipe.usedIngredients.join(", ");

            if (recipe.missedIngredients.length > 0) {
                text += " | Still need: " + recipe.missedIngredients.join(", ");
            } else {
                text += " ✓ (you have everything!)";
            }

            li.textContent = text;
            recipeListElement.appendChild(li);
        });
    } catch (error) {
        recipeListElement.innerHTML = "<li>Could not fetch recipes. Please try again later.</li>";
        console.error("Spoonacular API error:", error);
    }
}

window.addIngredient = addIngredient;
window.removeIngredient = removeIngredient;
window.promptEdit = promptEdit;
window.recommend = recommend;

export { removeIngredient, addIngredient };

export function _setIngredients(items) {
  useringredient.length = 0;
  useringredient.push(...items);
}

export function _getIngredients() {
  return [...useringredient];
}

if (document.getElementById("pantryBody")) {
  displayPantry();
}