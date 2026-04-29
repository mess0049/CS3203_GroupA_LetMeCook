// Centralized API key for service authentication
const SPOONACULAR_API_KEY = "8b2aa49a6a01471cb5679c65a28cc848";

// Service module to bridge pantry data with external recipe discovery
export async function getRecipesByIngredients(ingredients) {
    const ingredientList = ingredients.map(item => item.name).join(",");

    const url = `https://api.spoonacular.com/recipes/findByIngredients` +
                `?ingredients=${encodeURIComponent(ingredientList)}` +
                `&number=5` +
                `&ranking=2` +
                `&apiKey=${SPOONACULAR_API_KEY}`;

    try {
        const response = await fetch(url);

        if (!response.ok) {
            // Mask technical HTTP status to prevent info exposure
            throw new Error("EXTERNAL_RECIPE_SERVICE_FAILURE");
        }

        const data = await response.json();

        // Filter to only UI-relevant fields
        return data.map(function(recipe) {
            return {
                name: recipe.title,
                usedIngredients: recipe.usedIngredients.map(i => i.name),
                missedIngredients: recipe.missedIngredients.map(i => i.name),
                image: recipe.image
            };
        });
    } catch (error) {
        // Enforce generic error interface for the calling function
        throw new Error("EXTERNAL_RECIPE_SERVICE_FAILURE");
    }
}