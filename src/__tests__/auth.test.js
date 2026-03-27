import { login, logout, signup } from "../auth.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase.js";

jest.mock("../firebase.js", () => ({ auth: {}, db: {} }));

jest.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  setDoc: jest.fn(),
}));

describe("auth module", () => {
  afterEach(jest.clearAllMocks);

  test("login calls signInWithEmailAndPassword", () => {
    signInWithEmailAndPassword.mockResolvedValue({ user: { uid: "x" } });
    return login("me@test.com", "pwd").then(() => {
      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(auth, "me@test.com", "pwd");
    });
  });

  test("logout calls signOut", () => {
    signOut.mockResolvedValue();
    return logout().then(() => {
      expect(signOut).toHaveBeenCalledWith(auth);
    });
  });

  test("signup writes new user doc", async () => {
    createUserWithEmailAndPassword.mockResolvedValue({ user: { uid: "abc" }});
    await signup("joe@test.com", "123456");
    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(auth, "joe@test.com", "123456");
    expect(doc).toHaveBeenCalledWith(db, "users", "abc");
    expect(setDoc).toHaveBeenCalled();
  });
});