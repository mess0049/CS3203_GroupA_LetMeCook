const SPOONACULAR_API_KEY = "8b2aa49a6a01471cb5679c65a28cc848";

//dummy database need to change to database
/*let useringredient = [
    { name: "Egg", quantity: 5},
    { name: "Milk", quantity: 1},
    { name: "Tomato", quantity: 3},
    { name: "Bread", quantity: 2}
];
*/

import { db } from "./firebase.js";
import { doc, getDoc, setDoc, updateDoc, arrayUnion } from "firebase/firestore";

let useringredient = []; // still local copy
let currentUserUID = null;

import { observeAuth } from "./auth.js";

observeAuth(async (uid) => {
  if (!uid) {
    window.location.href = "login.html";
    return;
  }

  currentUserUID = uid;

  // Load pantry from Firestore
  const pantryRef = doc(db, "pantries", uid);
  const pantrySnap = await getDoc(pantryRef);

  if (pantrySnap.exists()) {
    useringredient = pantrySnap.data().items || [];
  } else {
    useringredient = [];
    await setDoc(pantryRef, { items: [] }); // create empty pantry for new users
  }

  displayPantry();
});
 
//show refrigerator_ingredients when load page
function displayPantry() {
    const pantryBody = document.getElementById("pantryBody");
    pantryBody.innerHTML = ""; //Reset

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

    // If the ingredient already exists, merge quantity instead of duplicating
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
        alert(`"${name}" was not found in your pantry.`)
        return;
    }

    useringredient.splice(index , 1);
    displayPantry();
    await savePantry();
}

async function promptEdit(name, currentQuantity) {
    const input = prompt(
        `Edit quantity for "${name}" (current: ${currentQuantity}).\nEnter 0 to remove it entirely:`,
        currentQuantity
    );

    if (input === null) return; // User hits Cancel

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
    }

}


async function recipe_check() { // Still need to change to database and implement recipe API
    const ingredientList = useringredient.map(item => item.name).join(",");

    const url = `https://api.spoonacular.com/recipes/findByIngredients` +
                `?ingredients=${encodeURIComponent(ingredientList)}` +
                `&number=5` +
                `&ranking=2` +
                `&apiKey=${SPOONACULAR_API_KEY}`;
    
    const response = await fetch(url);

    if (!response.ok) {
        throw new Error(`API responded with status ${response.status}`);
    }

    const data = await response.json();

    return data.map(function(recipe) {
        return {
            name: recipe.title,
            usedIngredients: recipe.usedIngredients.map(i => i.name),
            missedIngredients: recipe.missedIngredients.map(i => i.name),
            image: recipe.image
        };
    });
}

//when press recommend button
async function recommend() {
    const recipeListElement = document.getElementById("Choosed_Recipes");

    if (useringredient.length === 0) {
        recipeListElement.innerHTML = "<li>Your pantry is empty. Add some ingredients first!</li>";
        return;
    }

    recipeListElement.innerHTML = "<li>Loading recipes...</li>";

    try {
        const final_recipes = await recipe_check();
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

export { removeIngredient };

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