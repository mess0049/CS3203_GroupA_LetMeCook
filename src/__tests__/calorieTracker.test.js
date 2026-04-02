jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  arrayUnion: jest.fn(),
}), { virtual: true });

jest.mock("firebase/app", () => ({
  initializeApp: jest.fn(),
}), { virtual: true });

jest.mock("firebase/auth", () => ({
  getAuth: jest.fn(),
  onAuthStateChanged: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
}), { virtual: true });

import { calorieTracker } from "../LetMeCook.js";
import { saveTracker } from "../LetMeCook.js"; // If exported, or mock the internal call

// 1. Mocking the team's shared Firebase/Auth files
jest.mock("../firebase.js", () => ({ db: {} }));
jest.mock("../auth.js", () => ({
  observeAuth: jest.fn(),
}));

// 2. Mocking Firestore functions (matches your teammate's example)
jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
}));

describe("calorieTracker.addEntry", () => {
  
  beforeEach(() => {
    // Setup a fresh DOM for the UI summary
    document.body.innerHTML = '<div id="summary"></div>';
    
    // Reset the tracker state before each test
    calorieTracker.entries = [];
    calorieTracker.totalCalories = 0;
    
    // Mock global alert if needed
    global.alert = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("adds a new food entry and updates the total calories", async () => {
    await calorieTracker.addEntry("Pizza Slice", 300);

    expect(calorieTracker.entries.length).toBe(1);
    expect(calorieTracker.entries[0]).toEqual({ name: "Pizza Slice", calories: 300 });
    expect(calorieTracker.totalCalories).toBe(300);
  });

  test("accumulates total calories correctly with multiple entries", async () => {
    await calorieTracker.addEntry("Apple", 95);
    await calorieTracker.addEntry("Protein Shake", 120);

    expect(calorieTracker.totalCalories).toBe(215);
    expect(calorieTracker.entries.length).toBe(2);
  });

  test("updates the UI summary after adding an entry", async () => {
    await calorieTracker.addEntry("Banana", 105);
    
    const summaryDiv = document.getElementById("summary");
    // Check if the UI actually rendered the new data
    expect(summaryDiv.innerHTML).toContain("Banana");
    expect(summaryDiv.innerHTML).toContain("105 calories");
    expect(summaryDiv.innerHTML).toContain("Total: 105 calories");
  });

  test("is case-sensitive to the name provided", async () => {
    // Testing that it stores exactly what the API or user gives it
    await calorieTracker.addEntry("CHICKEN", 200);
    expect(calorieTracker.entries[0].name).toBe("CHICKEN");
  });

  test("Boundary Case: adding a 0-calorie item (Water)", async () => {
    await calorieTracker.addEntry("Water", 0);
    
    expect(calorieTracker.entries.length).toBe(1);
    expect(calorieTracker.totalCalories).toBe(0); // Math should still work
  });

  test("Fail Case: handles non-numeric calorie values gracefully", async () => {
    // If "abc" is passed, totalCalories should not become NaN
    await calorieTracker.addEntry("Glitch Food", "abc");
    
    expect(calorieTracker.totalCalories).not.toBe(NaN);
  });

  test("Edge Case: handles food names with special characters", async () => {
    const weirdName = "General Tso's Chicken";
    await calorieTracker.addEntry(weirdName, 400);
    
    expect(calorieTracker.entries[0].name).toBe("General Tso's Chicken");
  });
});