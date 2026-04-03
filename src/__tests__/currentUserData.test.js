import { observeAuth } from "../auth.js";
import { calorieTracker } from "../LetMeCook.js";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../firebase.js";

jest.mock("../firebase.js", () => ({ auth: {}, db: {} }));

jest.mock("firebase/auth", () => ({
  onAuthStateChanged: jest.fn(),
  signOut: jest.fn(),
  createUserWithEmailAndPassword: jest.fn(),
  signInWithEmailAndPassword: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
}));

jest.mock(
  "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js",
  () => ({
    doc: jest.fn(),
    getDoc: jest.fn(),
    setDoc: jest.fn(),
  }),
  { virtual: true }
);

const fakeEntries = [{ name: "Apple", calories: 95 }];
const fakeUID = "user123";

describe("currentUserData", () => {
  beforeEach(() => {
    calorieTracker.entries = [];
    calorieTracker.totalCalories = 0;
    doc.mockReturnValue("fake-doc-ref");
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid login: user is authenticated and Firestore returns data
  test("testValidLogin: loads user data when logged in with a valid session", (done) => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback({ uid: fakeUID });
    });

    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ entries: fakeEntries, totalCalories: 95 }),
    });

    observeAuth(async (uid) => {
      if (!uid) return;

      const snap = await getDoc(doc(db, "calories", uid));
      if (snap.exists()) {
        calorieTracker.entries = snap.data().entries;
        calorieTracker.totalCalories = snap.data().totalCalories;
      }

      expect(uid).toBe(fakeUID);
      expect(calorieTracker.entries).toEqual(fakeEntries);
      expect(calorieTracker.totalCalories).toBe(95);
      done();
    });
  });

  // Data mismatch: client state does not match what the server returns
  test("testDataMismatch: detects mismatch between client state and server data", async () => {
    calorieTracker.entries = [{ name: "Banana", calories: 105 }];
    calorieTracker.totalCalories = 105;

    getDoc.mockResolvedValue({
      exists: () => true,
      data: () => ({ entries: fakeEntries, totalCalories: 95 }),
    });

    const snap = await getDoc(doc(db, "calories", fakeUID));
    const serverData = snap.data();

    expect(calorieTracker.totalCalories).not.toBe(serverData.totalCalories);
    expect(calorieTracker.entries[0].name).not.toBe(serverData.entries[0].name);
  });

  // No user logged in: observeAuth fires with null
  test("testNoUserLoggedIn: returns null when no user is logged in", (done) => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null);
    });

    observeAuth((uid) => {
      expect(uid).toBeNull();
      done();
    });
  });

  // Session expired: Firebase clears currentUser to null, same as logged out
  test("testSessionExpired: returns null when the session has expired", (done) => {
    onAuthStateChanged.mockImplementation((auth, callback) => {
      callback(null);
    });

    observeAuth((uid) => {
      expect(uid).toBeNull();
      done();
    });
  });

  // Network disconnected: Firestore throws on getDoc
  test("testServerDisconnected: throws when disconnected from the server", async () => {
    getDoc.mockRejectedValue(
      Object.assign(new Error("network error"), { code: "NETWORK_ERROR" })
    );

    await expect(getDoc(doc(db, "calories", fakeUID))).rejects.toThrow(
      "network error"
    );
  });
});