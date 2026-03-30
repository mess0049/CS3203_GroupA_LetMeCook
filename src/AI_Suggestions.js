
function validateAndBuildInput(calorieGoal, currentCalories, allergies, dietaryNeeds) {
  if (!calorieGoal || calorieGoal <= 0) {
    throw new Error("Invalid calorie goal");
  }

  if (currentCalories < 0) {
    throw new Error("Invalid current calories");
  }

  return {
    calorieGoal: Number(calorieGoal),
    currentCalories: Number(currentCalories) || 0,
    allergies: allergies || "",
    dietaryNeeds: dietaryNeeds || ""
  };
}

export { validateAndBuildInput };
