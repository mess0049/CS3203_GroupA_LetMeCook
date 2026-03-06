//dummy database need to change to database
const myIngredients = [
    { name: "Egg", quantity: 5},
    { name: "Milk", quantity: 1},
    { name: "Tomato", quantity: 3},
    { name: "Bread", quantity: 2}
];

const recipeDatabase = [
    { name: "Fried Egg", ingredients: ["Egg"] },
    { name: "Tomato Omelette", ingredients: ["Egg", "Tomato"] },
    { name: "French Toast", ingredients: ["Egg", "Milk", "Bread"] },
    { name: "Milkshake", ingredients: ["Milk", "Ice Cream"] }
];
//dummy database need to change to database

//show refrigeator_ingredients when load page
function displayPantry() {
    const pantryBody = document.getElementById("pantryBody");
    pantryBody.innerHTML = ""; //Reset

    myIngredients.forEach(item => {
        const row = `<tr>
            <td>${item.name}</td>
            <td>${item.quantity}</td>
        </tr>`;
        pantryBody.innerHTML += row;
    });
}

//when press recommend button
function recommend() {
    const recipeListElement = document.getElementById("Choosed_Recipes");
    recipeListElement.innerHTML = ""; //reset

    //ingredient name
    const myInvenNames = myIngredients.map(item => item.name);

    //find recipe(check to exist all ingredient of recipe)
    const availableRecipes = recipeDatabase.filter(recipe => {
        return recipe.ingredients.every(needed => myInvenNames.includes(needed));
    });

    //show in window
    if (availableRecipes.length > 0) {
        availableRecipes.forEach(recipe => {
            const li = document.createElement("li");
            li.textContent = `${recipe.name} (Ingredients: ${recipe.ingredients.join(", ")})`;
            recipeListElement.appendChild(li);
        });
    } else {
        recipeListElement.innerHTML = "<li>No recipes found. Try adding more ingredients!</li>";
    }
}


displayPantry();