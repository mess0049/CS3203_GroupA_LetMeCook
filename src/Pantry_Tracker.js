//dummy database need to change to database
const useringredient = [
    { name: "Egg", quantity: 5},
    { name: "Milk", quantity: 1},
    { name: "Tomato", quantity: 3},
    { name: "Bread", quantity: 2}
];

const ingredients_in_refrigerator = [
    { name: "Fried Egg", ingredients: ["Egg"] },
    { name: "Tomato Omelette", ingredients: ["Egg", "Tomato"] },
    { name: "French Toast", ingredients: ["Egg", "Milk", "Bread"] },
    { name: "Milkshake", ingredients: ["Milk", "Ice Cream"] }
];
//dummy database need to change to database
 
//show refrigerator_ingredients when load page
function displayPantry() {
    const pantryBody = document.getElementById("pantryBody");
    pantryBody.innerHTML = ""; //Reset
    let i=0;

    useringredient.forEach(function(pantry)
        {
        i++;
        const row = 
        '<tr>' + '<td>' + i +'. '+ pantry.name + ' ' + pantry.quantity + '</td>' + '</tr>';
        pantryBody.innerHTML += row;
        }
    );
}


function recipe_check() { // Still need to change to database and implement recipe API
    // Get names of what the user has in the pantry
    const user_ingredient_names = useringredient.map(item => item.name);

    // Filter recipes where every required ingredient is in the pantry
    const available = ingredients_in_refrigerator.filter(function(recipe) {
        return recipe.ingredients.every(function(needed) {
            return user_ingredient_names.includes(needed);
        });
    });
    return available;
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
        for (let i = 0; i < final_recipes.length; i++) {
            let recipe = final_recipes[i];
            let li = document.createElement("li");
            li.textContent = recipe.name + " (Ingredients: " + recipe.ingredients.join(", ") + ")";
            recipeListElement.appendChild(li);
        }
    } else {
        recipeListElement.innerHTML = "<li>No recipes found. Try adding more ingredients!</li>";
    }
}


displayPantry();