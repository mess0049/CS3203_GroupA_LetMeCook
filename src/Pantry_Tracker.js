//dummy database need to change to database
const useringredient = [
    { name: "Egg", quantity: 5},
    { name: "Milk", quantity: 1},
    { name: "Tomato", quantity: 3},
    { name: "Bread", quantity: 2}
];

const ingredients_in_refrigeator = [
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

    useringredient.forEach(function(pantry)
        {
        const row = '<tr>' + 
                '<td>' + pantry.name + '</td>' + 
                '<td>' + pantry.quantity + '</td>' + 
              '</tr>';
        pantryBody.innerHTML += row;
        }
    );
}


function recipe_check() {
//fill this
}

//when press recommend button
function recommend() {
    const recipeListElement = document.getElementById("Choosed_Recipes");
    recipeListElement.innerHTML = ""; //reset

    //ingredient name
    const user_ingredient_names = [];
    for (let i = 0; i < useringredient.length; i++) {
        user_ingredient_names.push(useringredient[i].name);
    }

    
    //find recipe(check to exist all ingredient of recipe)
    const final_recipes = recipe_check();


    //show in window
    if (final_recipes.length > 0) {
        for (let i = 0; i < availableRecipes.length; i++) {
            let recipe = availableRecipes[i];
            let li = document.createElement("li");
            li.textContent = recipe.name + " (Ingredients: " + recipe.ingredients.join(", ") + ")";
            recipeListElement.appendChild(li);
        }
    } else {
        recipeListElement.innerHTML = "<li>No recipes found. Try adding more ingredients!</li>";
    }
}


displayPantry();