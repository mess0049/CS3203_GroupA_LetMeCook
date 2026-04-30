import { auth, db } from "../firebase.js";
import {
  RecaptchaVerifier,
  PhoneAuthProvider,
  PhoneMultiFactorGenerator,
  multiFactor,
  getMultiFactorResolver
} from "firebase/auth";
import { doc, getDoc, updateDoc } from "firebase/firestore";

// Module-level state held between the "send" and "confirm" steps.
let recaptchaVerifier = null;
let verificationId = null;
let mfaResolver = null;

// ─── SETUP ───────────────────────────────────────────────────────────────────

// Call once on page load before any SMS functions.
// containerId: the id of an empty <div> in the HTML (e.g. "recaptcha-container").
// Firebase renders an invisible reCAPTCHA into it to prevent SMS abuse.
export function initRecaptcha(containerId) {
  if (recaptchaVerifier) recaptchaVerifier.clear();
  recaptchaVerifier = new RecaptchaVerifier(auth, containerId, {
    size: "invisible"
  });
}

// ─── ENROLLMENT (one-time setup per user) ────────────────────────────────────

// Step 1: Call after the user is signed in (e.g. from an account settings page).
// phoneNumber must be in E.164 format: "+12025551234"
// Firebase will send an SMS to that number.
export async function enrollPhone(phoneNumber) {
  const user = auth.currentUser;
  if (!user) throw new Error("No user is signed in");
  if (!recaptchaVerifier) throw new Error("Call initRecaptcha() before enrollPhone()");

  const session = await multiFactor(user).getSession();
  const provider = new PhoneAuthProvider(auth);

  verificationId = await provider.verifyPhoneNumber(
    { phoneNumber, session },
    recaptchaVerifier
  );

  // Store number in Firestore so it can be shown in account settings.
  await updateDoc(doc(db, "users", user.uid), { phoneNumber });
}

// Step 2: Call with the code the user received by SMS to complete enrollment.
export async function confirmEnrollment(code) {
  if (!verificationId) throw new Error("No enrollment pending — call enrollPhone() first");

  const credential = PhoneAuthProvider.credential(verificationId, code);
  const assertion = PhoneMultiFactorGenerator.assertion(credential);
  await multiFactor(auth.currentUser).enroll(assertion, "SMS phone");

  verificationId = null;
}

// ─── LOGIN (called every time the user signs in) ──────────────────────────────

// Step 1: Pass the error thrown by signInWithEmailAndPassword when the user
// has SMS MFA enrolled. Firebase sends an SMS to their registered number.
// Throws if the error is not an MFA challenge (so it can be re-thrown by caller).
export async function startSMSLogin(error) {
  if (error.code !== "auth/multi-factor-auth-required") throw error;
  if (!recaptchaVerifier) throw new Error("Call initRecaptcha() before startSMSLogin()");

  mfaResolver = getMultiFactorResolver(auth, error);

  const provider = new PhoneAuthProvider(auth);
  verificationId = await provider.verifyPhoneNumber(
    {
      multiFactorHint: mfaResolver.hints[0],
      session: mfaResolver.session
    },
    recaptchaVerifier
  );
}

// Step 2: Call with the code the user received by SMS to complete login.
export async function confirmSMSLogin(code) {
  if (!verificationId || !mfaResolver) {
    throw new Error("No SMS login pending — call startSMSLogin() first");
  }

  const credential = PhoneAuthProvider.credential(verificationId, code);
  const assertion = PhoneMultiFactorGenerator.assertion(credential);
  await mfaResolver.resolveSignIn(assertion);

  verificationId = null;
  mfaResolver = null;
}

// ─── UTILITY ─────────────────────────────────────────────────────────────────

// Returns the phone number stored in Firestore for a given UID.
// Useful for displaying a masked number ("SMS sent to ***-1234") in the UI.
export async function getStoredPhone(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) throw new Error("User not found");
  const phone = snap.data().phoneNumber;
  if (!phone) throw new Error("No phone number on file — enroll a phone first");
  return phone;
}

// Returns true if the currently signed-in user has a phone enrolled as MFA.
export function isPhoneEnrolled() {
  const user = auth.currentUser;
  if (!user) return false;
  return multiFactor(user).enrolledFactors.some(f => f.factorId === "phone");
}
