const SPOONACULAR_API_KEY = "8b2aa49a6a01471cb5679c65a28cc848";

export async function getRecipesByIngredients(ingredients) {
    const ingredientList = ingredients.map(item => item.name).join(",");

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