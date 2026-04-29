import { auth, db } from "../firebase.js";

// --- FIX: Use npm firebase for testing compatibility ---
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "firebase/auth";

import {
  doc,
  setDoc,
  updateDoc,
  getDoc
} from "firebase/firestore";


// Note: EmailJS is loaded via CDN in login.html's importmap so import here not needed
// The global 'emailjs' object will be available

// EmailJS credentials (loaded from CDN)
const SERVICE_ID = 'let_me_cook';
const TEMPLATE_ID = 'mfa_letmecook';


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

// *** MULTI-FACTOR AUTHENTICATION FOR CWE ***

// GENERATE VERIFICATION CODE

// generates a random 6 digit code
function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// SEND MFA CODE (store in Firestore for now)
export async function sendMFACode(uid) {
  const code = generateCode();
  const expiry = new Date(Date.now() + 10 * 60 * 1000); // code will expire in 10 minutes
  
  // adds the code to the database and doesn't let login auth until correct code given
  await updateDoc(doc(db, "users", uid), {
    mfaCode: code,
    mfaExpiry: expiry,
    mfaPending: true
  });

  // Get user's email
  const userDoc = await getDoc(doc(db, "users", uid));
  const userEmail = userDoc.data().email;

  // Send email with 6-digit code
  try {
    const result = await window.emailjs.send(SERVICE_ID, TEMPLATE_ID, {
      email: userEmail,
      code: code
    });
    console.log("Email sent successfully:", result);
  } catch (emailErr) {
    console.error("EmailJS error:", emailErr);
    // Continue anyway for testing - code is stored in DB
    alert(`Email failed to send, but code is: ${code}`);
  }

  // For now, you can log the code or show it in an alert
  console.log(`MFA Code for ${uid}: ${code}`);
  return code;
}

// VERIFY MFA CODE
export async function verifyMFACode(uid, inputCode) {
  const userDoc = await getDoc(doc(db, "users", uid));
  const data = userDoc.data();
  
  if (!data.mfaPending || !data.mfaCode) {
    throw new Error("No MFA pending");
  }
  
  if (new Date() > data.mfaExpiry.toDate()) {
    throw new Error("Code expired");
  }
  
  if (data.mfaCode !== inputCode) {
    throw new Error("Invalid code");
  }
  
  // Clear MFA state after successful verification
  await updateDoc(doc(db, "users", uid), {
    mfaCode: null,
    mfaExpiry: null,
    mfaPending: false
  });
  
  return true;
}