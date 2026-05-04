import { validateInputs, normalizeText } from "../LovableAPI/AI_Suggestions";

describe("validateInputs", () => {

  test("valid input returns formatted object", () => {
    const result = validateInputs({
      calorieGoal: "2000",
      currentCalories: "500",
      allergies: "peanuts",
      dietaryNeeds: "vegan",
    });

    expect(result).toEqual({
      calorieGoal: 2000,
      currentCalories: 500,
      allergies: "peanuts",
      dietaryNeeds: "vegan",
    });
  });

  test("returns error when calorieGoal missing", () => {
    const result = validateInputs({
      calorieGoal: "",
      currentCalories: "200",
      allergies: "",
      dietaryNeeds: "",
    });

    expect(result).toBe("Calorie goal is required");
  });

  test("rejects non-integer calorie goal", () => {
    const result = validateInputs({
      calorieGoal: "abc",
      currentCalories: "200",
      allergies: "",
      dietaryNeeds: "",
    });

    expect(result).toBe("Calorie goal must be a whole number");
  });

  test("rejects calorie goal out of range", () => {
    const result = validateInputs({
      calorieGoal: "6000",
      currentCalories: "200",
      allergies: "",
      dietaryNeeds: "",
    });

    expect(result).toBe("Calorie goal must be between 1000 and 5000");
  });

  test("rejects invalid allergy characters", () => {
    const result = validateInputs({
      calorieGoal: "2000",
      currentCalories: "200",
      allergies: "peanuts!!!@#",
      dietaryNeeds: "",
    });

    expect(result).toBe("Allergies contains invalid characters");
  });

  test("rejects unsupported diet", () => {
    const result = validateInputs({
      calorieGoal: "2000",
      currentCalories: "200",
      allergies: "",
      dietaryNeeds: "paleo",
    });

    expect(result).toBe("Unsupported dietary preference");
  });

  test("defaults diet to none when empty", () => {
    const result = validateInputs({
      calorieGoal: "2000",
      currentCalories: "200",
      allergies: "",
      dietaryNeeds: "",
    });

    expect(result.dietaryNeeds).toBe("none");
  });

});

describe("normalizeText", () => {
  test("trims and lowercases text", () => {
    const result = normalizeText("  HeLLo   World ");
    expect(result).toBe("hello world");
  });
});