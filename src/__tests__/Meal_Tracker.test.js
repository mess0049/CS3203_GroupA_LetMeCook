import { saveMeal, _setMeals, _getMeals } from "../Meal_Tracker.js";

jest.mock("../firebase.js", () => ({ db: {} }));

jest.mock("../auth.js", () => ({
  observeAuth: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
  arrayUnion: jest.fn(),
}));

// Helper: returns today's date as YYYY-MM-DD
function todayString() {
  return new Date().toISOString().split("T")[0];
}

// Helper: returns a future date as YYYY-MM-DD
function futureDateString(daysAhead = 5) {
  const d = new Date();
  d.setDate(d.getDate() + daysAhead);
  return d.toISOString().split("T")[0];
}

// Helper: returns a past date as YYYY-MM-DD
function pastDateString(daysBehind = 5) {
  const d = new Date();
  d.setDate(d.getDate() - daysBehind);
  return d.toISOString().split("T")[0];
}

describe("saveMeal", () => {

  beforeEach(() => {
    document.body.innerHTML =
      `
      <input id="mealName"/>
      <input id="cookDate"/>
      `;

    global.alert = jest.fn();
    _setMeals([]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });


  test("saves a valid meal successfully", async () => {
    document.getElementById("mealName").value = "Pasta";
    document.getElementById("cookDate").value = futureDateString();

    await saveMeal();

    const saved = _getMeals();
    expect(saved.length).toBe(1);
    expect(saved[0].name).toBe("Pasta");
  });

  test("saves a meal scheduled for today successfully", async () => {
    document.getElementById("mealName").value = "Omelette";
    document.getElementById("cookDate").value = todayString();

    await saveMeal();

    const saved = _getMeals();
    expect(saved.length).toBe(1);
    expect(saved[0].name).toBe("Omelette");
  });

  test("alerts when meal name is whitespace only", async () => {
    const initialLength = _getMeals().length;
    document.getElementById("mealName").value = "   ";
    document.getElementById("cookDate").value = futureDateString();

    await saveMeal();

    expect(global.alert).toHaveBeenCalledWith("Please enter a meal name.");
    expect(_getMeals().length).toBe(initialLength);
  });

  test("alerts when meal name is empty", async () => {
    const initialLength = _getMeals().length;
    document.getElementById("mealName").value = "";
    document.getElementById("cookDate").value = futureDateString();

    await saveMeal();

    expect(global.alert).toHaveBeenCalledWith("Please enter a meal name.");
    expect(_getMeals().length).toBe(initialLength);
  });

  test("alerts when meal name exceeds 256 characters", async () => {
    const initialLength = _getMeals().length;
    document.getElementById("mealName").value = "A".repeat(257);
    document.getElementById("cookDate").value = futureDateString();

    await saveMeal();

    expect(global.alert).toHaveBeenCalledWith("Meal name must be 256 characters or fewer.");
    expect(_getMeals().length).toBe(initialLength);
  });

  test("saves successfully when meal name is exactly 256 characters", async () => {
    document.getElementById("mealName").value = "A".repeat(256);
    document.getElementById("cookDate").value = futureDateString();

    await saveMeal();

    expect(_getMeals().length).toBe(1);
  });

  test("alerts when cook date is in the past", async () => {
    const initialLength = _getMeals().length;
    document.getElementById("mealName").value = "Tacos";
    document.getElementById("cookDate").value = pastDateString();

    await saveMeal();

    expect(global.alert).toHaveBeenCalledWith("Cook date cannot be in the past.");
    expect(_getMeals().length).toBe(initialLength);
  });

  test("alerts when cook date is missing", async () => {
    const initialLength = _getMeals().length;
    document.getElementById("mealName").value = "Tacos";
    document.getElementById("cookDate").value = "";

    await saveMeal();

    expect(global.alert).toHaveBeenCalledWith("Please enter a cook date.");
    expect(_getMeals().length).toBe(initialLength);
  });

  test("does not alert on a valid future meal", async () => {
    document.getElementById("mealName").value = "Steak";
    document.getElementById("cookDate").value = futureDateString(10);

    await saveMeal();

    expect(global.alert).not.toHaveBeenCalled();
  });
});
