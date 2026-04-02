import{addIngredient, _setIngredients, _getIngredients} from "../Pantry_Tracker.js";

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

describe("addIngredient", () => {

  beforeEach(() => {
    document.body.innerHTML = 
      `
      <input id="addName"/>
      <input id="addQuantity"/>
      <table><tbody id="pantryBody"></tbody></table>
      `;

    global.alert = jest.fn();
    _setIngredients([]);
    });

    afterEach(() => {
    jest.clearAllMocks();
    });


  test("add new ingredient - success", async () => {
    document.getElementById("addName").value = "Bread";
    document.getElementById("addQuantity").value = "4";

    await addIngredient();

    const pantry = _getIngredients();
    expect(pantry.find((i) => i.name === "Bread").quantity).toBe(4);
    expect(pantry.length).toBe(1);
  });

  test("alerts when name don't exist", async () => {
    const initialLength = _getIngredients().length;
    document.getElementById("addName").value = "   ";
    document.getElementById("addQuantity").value = "6";
    await addIngredient();
    expect(global.alert).toHaveBeenCalledWith("Please enter an ingredient name.");
    expect(_getIngredients().length).toBe(initialLength);
  });

  test("when non-English characters input and successfully store", async () => {
    document.getElementById("addName").value = "안녕";
    document.getElementById("addQuantity").value = "2";
    await addIngredient();
    const pantry = _getIngredients();
    expect(pantry.find((i) => i.name === "안녕").quantity).toBe(2);
  });

  test("updates quantity when ingredient which already exists is added again", async () => {
    _setIngredients([{ name: "Egg", quantity: 5 }]);
    document.getElementById("addName").value = "Egg";
    document.getElementById("addQuantity").value = "9";
    await addIngredient();
    const pantry = _getIngredients();
    expect(pantry.find((i) => i.name === "Egg").quantity).toBe(14);
    expect(pantry.length).toBe(1);
  });

  test("alerts when quantity is 0", async () => {
    const initialLength = _getIngredients().length;
    document.getElementById("addName").value = "Bread";
    document.getElementById("addQuantity").value = "0";
    await addIngredient();
    expect(global.alert).toHaveBeenCalledWith("Quantity must be a positive number.");
    expect(_getIngredients().length).toBe(initialLength);
  });
});
