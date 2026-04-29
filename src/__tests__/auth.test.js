// Test file for auth.js module - verifies authentication functions work correctly
//
// Mocks used:
// - firebase.js: Provides mock auth and db objects
// - firebase/auth: Mocks Firebase authentication functions
// - firebase/firestore: Mocks Firestore database functions

import { login, logout, signup } from "../UserAuthentication/auth.js";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase.js";

// Mock the firebase.js module to provide empty auth and db objects for testing
jest.mock("../firebase.js", () => ({ auth: {}, db: {} }));

// Mock Firebase authentication functions - these are what auth.js actually calls
jest.mock("firebase/auth", () => ({
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
  signOut: jest.fn(),
  onAuthStateChanged: jest.fn(),
}));

// Mock Firestore functions - used to create user documents in the database
jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  setDoc: jest.fn(),
}));

// Test suite for the auth module
describe("auth module", () => {
  // Clean up mocks after each test to prevent state leakage between tests
  afterEach(jest.clearAllMocks);

  // Test 1: Verify login() calls Firebase's signInWithEmailAndPassword with correct parameters
  test("login calls signInWithEmailAndPassword", () => {
    // Setup: Configure the mock to return a successful login result
    signInWithEmailAndPassword.mockResolvedValue({ user: { uid: "x" } });
    
    // Execute: Call the login function with test credentials
    return login("me@test.com", "pwd").then(() => {
      // Verify: Check that Firebase's signInWithEmailAndPassword was called with correct args
      expect(signInWithEmailAndPassword).toHaveBeenCalledWith(auth, "me@test.com", "pwd");
    });
  });

  // Test 2: Verify logout() calls Firebase's signOut function
  test("logout calls signOut", () => {
    // Setup: Configure the mock to resolve successfully
    signOut.mockResolvedValue();
    
    // Execute: Call the logout function
    return logout().then(() => {
      // Verify: Check that Firebase's signOut was called with the auth object
      expect(signOut).toHaveBeenCalledWith(auth);
    });
  });

  // Test 3: Verify signup() creates a new user and writes them to Firestore
  test("signup writes new user doc", async () => {
    // Setup: Mock createUserWithEmailAndPassword to return a user with UID "abc"
    createUserWithEmailAndPassword.mockResolvedValue({ user: { uid: "abc" }});
    
    // Execute: Call signup with test email and password
    await signup("joe@test.com", "123456");
    
    // Verify: Check that Firebase created the user with correct credentials
    expect(createUserWithEmailAndPassword).toHaveBeenCalledWith(auth, "joe@test.com", "123456");
    
    // Verify: Check that Firestore doc() was called to reference the users collection
    expect(doc).toHaveBeenCalledWith(db, "users", "abc");
    
    // Verify: Check that setDoc() was called to save the user document
    expect(setDoc).toHaveBeenCalled();
  });
});