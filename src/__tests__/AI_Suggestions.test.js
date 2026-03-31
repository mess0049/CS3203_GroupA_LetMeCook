import { buildRequestBody } from "../AI_Suggestions.js";

describe("AI Suggestions Feature", () => {

  afterEach(() => {
    jest.clearAllMocks();
  });

  
  test("should build correct request with valid input", () => {
    const result = buildRequestBody(2000, 800, "peanuts", "high protein");

    expect(result).toEqual({
      calorieGoal: 2000,
      currentCalories: 800,
      allergies: "peanuts",
      dietaryNeeds: "high protein"
    });
  });
 
  test("should fail when calorie goal is missing", () => {
    expect(() => buildRequestBody(null, 500, "", ""))
      .toThrow("Invalid calorie goal");
  });

  test("should fail when calorie goal is zero", () => {
    expect(() => buildRequestBody(0, 500, "", ""))
      .toThrow("Invalid calorie goal");
  });

  test("should fail when current calories is negative", () => {
    expect(() => buildRequestBody(2000, -50, "", ""))
      .toThrow("Invalid current calories");
  });

  test("should handle empty allergies and dietary needs", () => {
    const result = buildRequestBody(2000, 500, "", "");

    expect(result.allergies).toBe("");
    expect(result.dietaryNeeds).toBe("");
  });

  test("should default currentCalories to 0 if empty", () => {
    const result = buildRequestBody(2000, "", "", "");

    expect(result.currentCalories).toBe(0);
  });

  test("should handle very large calorie goal", () => {
    const result = buildRequestBody(10000, 0, "", "");

    expect(result.calorieGoal).toBe(10000);
  });

});