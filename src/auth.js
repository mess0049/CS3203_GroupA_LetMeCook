import { auth, db } from "./firebase.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";

import {
  doc,
  setDoc
} from "firebase/firestore";

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
      callback(user.uid, user.email);
    } else {
      callback(null);
    }
  });
}