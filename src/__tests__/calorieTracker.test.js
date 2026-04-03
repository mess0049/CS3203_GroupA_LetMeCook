
jest.mock("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js", () => ({
  doc: jest.fn(),
  // Returns a mock snapshot with .exists() and .data() to prevent TypeErrors
  getDoc: jest.fn(() => Promise.resolve({
    exists: () => false, 
    data: () => ({ entries: [], totalCalories: 0 })
  })),
  setDoc: jest.fn(() => Promise.resolve()),
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

// --- 2. LOCAL FILE MOCKS ---

jest.mock("../firebase.js", () => ({ db: {} }));
jest.mock("../auth.js", () => ({
  observeAuth: jest.fn((callback) => callback("test-uid")), 
}));

// --- 3. IMPORT THE CODE UNDER TEST ---

import { calorieTracker } from "../LetMeCook.js";

// --- 4. TEST SUITE ---

describe("calorieTracker.addEntry", () => {
  
  beforeEach(() => {
    // Setup a fresh DOM for the UI summary so updateSummary() can find the div
    document.body.innerHTML = '<div id="summary"></div>';
    
    // Reset the tracker state before each test
    calorieTracker.entries = [];
    calorieTracker.totalCalories = 0;
    
    // Mock global alert to prevent tests from hanging on error messages
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
    // Verifies the code is actually writing to the HTML
    expect(summaryDiv.innerHTML).toContain("Banana");
    expect(summaryDiv.innerHTML).toContain("105 calories");
    expect(summaryDiv.innerHTML).toContain("Total: 105 calories");
  });

  test("is case-sensitive to the name provided", async () => {
    await calorieTracker.addEntry("CHICKEN", 200);
    expect(calorieTracker.entries[0].name).toBe("CHICKEN");
  });

  test("Boundary Case: adding a 0-calorie item (Water)", async () => {
    await calorieTracker.addEntry("Water", 0);
    
    expect(calorieTracker.entries.length).toBe(1);
    expect(calorieTracker.totalCalories).toBe(0);
  });

  test("Edge Case: handles food names with special characters", async () => {
    const weirdName = "General Tso's Chicken";
    await calorieTracker.addEntry(weirdName, 400);
    
    expect(calorieTracker.entries[0].name).toBe("General Tso's Chicken");
  });
});