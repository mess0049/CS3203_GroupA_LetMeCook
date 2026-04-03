import { removeIngredient, _setIngredients, _getIngredients } from "../Pantry_Tracker.js";

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
}), { virtual: true });

jest.mock("firebase/app", () => ({
  initializeApp: jest.fn(),
}), { virtual: true });

jest.mock("https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js", () => ({
  getAuth: jest.fn(),
  onAuthStateChanged: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
}), { virtual: true });

describe("removeIngredient", () => {

  beforeEach(() => {
    document.body.innerHTML = '<table><tbody id="pantryBody"></tbody></table>';

    global.alert = jest.fn();

    _setIngredients([
      { name: "Egg",    quantity: 5 },
      { name: "Milk",   quantity: 1 },
      { name: "Tomato", quantity: 3 },
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test("removes an existing ingredient from the pantry", async () => {
    await removeIngredient("Milk");
    const pantry = _getIngredients();
    expect(pantry.find((i) => i.name === "Milk")).toBeUndefined();
    expect(pantry.length).toBe(2);
  });

  test("does not remove other ingredients when one is removed", async () => {
    await removeIngredient("Milk");
    const pantry = _getIngredients();
    expect(pantry.find((i) => i.name === "Egg")).toBeDefined();
    expect(pantry.find((i) => i.name === "Tomato")).toBeDefined();
  });

  test("removes the last ingredient, leaving the pantry empty", async () => {
    _setIngredients([{ name: "Egg", quantity: 5 }]);
    await removeIngredient("Egg");
    expect(_getIngredients().length).toBe(0);
  });

  test("alerts when the ingredient is not found in the pantry", async () => {
    await removeIngredient("Banana");
    expect(global.alert).toHaveBeenCalledWith('"Banana" was not found in your pantry.');
  });

  test("does not modify the pantry when ingredient is not found", async () => {
    await removeIngredient("Banana");
    expect(_getIngredients().length).toBe(3);
  });

  test("alerts when trying to remove from an empty pantry", async () => {
    _setIngredients([]);
    await removeIngredient("Egg");
    expect(global.alert).toHaveBeenCalled();
  });

  test("is case-insensitive: 'EGG' (all caps) matches stored ingredient 'Egg'", async () => {
    await removeIngredient("EGG");
    expect(_getIngredients().find((i) => i.name === "Egg")).toBeUndefined();
    expect(_getIngredients().length).toBe(2);
  });

  test("is case-insensitive: 'egg' (all lowercase) matches stored ingredient 'Egg'", async () => {
    await removeIngredient("egg");
    expect(_getIngredients().find((i) => i.name === "Egg")).toBeUndefined();
  });

});