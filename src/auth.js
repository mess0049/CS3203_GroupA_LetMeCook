import { auth, db } from "./firebase.js";

// --- FIX: Use full HTTPS URLs for the browser ---
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";

import {
  doc,
  setDoc
} from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// SIGN UP
export async function signup(email, password) {
  const userCred = await createUserWithEmailAndPassword(auth, email, password);

  // Save user in database
  await setDoc(doc(db, "users", userCred.user.uid), {
    email: email,
    createdAt: new Date()
  });
}

// LOGIN
export function login(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

// LOGOUT
export function logout() {
  return signOut(auth);
}

// TRACK USER
export function observeAuth(callback) {
  onAuthStateChanged(auth, user => {
    if (user) {
      // Passes UID and email to the callback (like LetMeCook.js)
      callback(user.uid, user.email);
    } else {
      callback(null);
    }
  });
}