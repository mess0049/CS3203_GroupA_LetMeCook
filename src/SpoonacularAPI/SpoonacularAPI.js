// Centralized API key for service authentication
const SPOONACULAR_API_KEY = "8b2aa49a6a01471cb5679c65a28cc848";

// ── Search recipes by keyword (used by Meal Tracker) ────────────────────────

/**
 * Search Spoonacular for recipes matching a free-text query.
 * Accepts an optional `prefs` object built from the user's Preference Tracker
 * data to automatically filter results.
 *
 * @param {string} query - Search term (e.g. "chicken pasta")
 * @param {Object} prefs - User preferences
 * @param {string[]} [prefs.cuisines]       - e.g. ["italian","mexican"]
 * @param {string[]} [prefs.diets]          - e.g. ["vegetarian"]
 * @param {string[]} [prefs.allergies]      - mapped to Spoonacular intolerances
 * @param {number}   [prefs.maxCookTime]    - max ready-in minutes
 * @returns {Promise<Array>} Simplified recipe objects
 */
export async function searchRecipes(query, prefs = {}) {
  const params = new URLSearchParams({
    query,
    number: "8",
    addRecipeInformation: "true",
    apiKey: SPOONACULAR_API_KEY,
  });

  if (prefs.cuisines?.length)   params.set("cuisine",       prefs.cuisines.join(","));
  if (prefs.diets?.length)      params.set("diet",          prefs.diets.join(","));
  if (prefs.allergies?.length)  params.set("intolerances",  prefs.allergies.join(","));
  if (prefs.maxCookTime)        params.set("maxReadyTime",  String(prefs.maxCookTime));

  const url = `https://api.spoonacular.com/recipes/complexSearch?${params}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error("EXTERNAL_RECIPE_SERVICE_FAILURE");

    const data = await response.json();

    return (data.results || []).map((recipe) => ({
      id:               recipe.id,
      title:            recipe.title,
      image:            recipe.image,
      readyInMinutes:   recipe.readyInMinutes,
      servings:         recipe.servings,
      cuisines:         recipe.cuisines || [],
      diets:            recipe.diets    || [],
    }));
  } catch {
    throw new Error("EXTERNAL_RECIPE_SERVICE_FAILURE");
  }
}

// ── Search recipes by pantry ingredients (used by Pantry Tracker) ────────────

/**
 * Service module to bridge pantry data with external recipe discovery.
 */
export async function getRecipesByIngredients(ingredients) {
  const ingredientList = ingredients.map((item) => item.name).join(",");

  const url =
    `https://api.spoonacular.com/recipes/findByIngredients` +
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
    return data.map((recipe) => ({
      name:             recipe.title,
      usedIngredients:  recipe.usedIngredients.map((i) => i.name),
      missedIngredients:recipe.missedIngredients.map((i) => i.name),
      image:            recipe.image,
    }));
  } catch {
    // Enforce generic error interface for the calling function
    throw new Error("EXTERNAL_RECIPE_SERVICE_FAILURE");
  }
}

export async function getRecipeNutrition(recipeId) {
  const url = `https://api.spoonacular.com/recipes/${recipeId}/nutritionWidget.json` +
              `?apiKey=${SPOONACULAR_API_KEY}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("EXTERNAL_RECIPE_SERVICE_FAILURE");
  const data = await response.json();
  // Returns calories as a string like "412", so we parse it
  return Math.round(parseFloat(data.calories));
}