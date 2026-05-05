/**
 * PREFERENCE TRACKER (The Gatekeeper)
 * This module handles user dietary restrictions and cuisines.
 * It includes security features like Rate Limiting and Type Validation.
 */

import { db } from "../firebase.js";
import { doc, getDoc, setDoc } from "firebase/firestore";

// ── SECURITY CONSTANTS ────────────────────────────────────────────────────────

/** Prevents "Resource Exhaustion" (CWE-770) by limiting total items per user. */
const MAX_PREFERENCES = 20;

/** Time window for the rate limiter (1 minute). */
const RATE_WINDOW_MS = 60_000;

/** Limits how many database calls a user can trigger per minute. */
const MAX_INTERACTIONS = 10;

// ── ALLOWED PREFERENCE SCHEMA ────────────────────────────────────────────────

/**
 * SOURCE OF TRUTH: All valid keys and values for preferences.
 * This prevents users from injecting "junk data" or unsupported values.
 */
export const PREFERENCE_SCHEMA = {
  cuisine: {
    type: "enum", // Fixed list of options
    values: [
      "african","american","british","cajun","caribbean","chinese","eastern european",
      "european","french","german","greek","indian","irish","italian","japanese",
      "jewish","korean","latin american","mediterranean","mexican","middle eastern",
      "nordic","southern","spanish","thai","vietnamese",
    ],
  },
  diet: {
    type: "enum",
    values: [
      "gluten free","ketogenic","lacto-vegetarian","low fodmap","ovo-vegetarian",
      "paleo","pescetarian","primal","vegan","vegetarian","whole30",
    ],
  },
  allergy: {
    type: "enum",
    values: [
      "dairy","egg","gluten","grain","peanut","seafood",
      "sesame","shellfish","soy","sulfite","tree nut","wheat",
    ],
  },
  maxCookTime: {
    type: "integer", // Numeric value
    min: 5,
    max: 480, // 8 hours cap
  },
};

// ── IN-MEMORY RATE-LIMITER ───────────────────────────────────────────────────

/** 
 * Keeps track of how many actions a user (UID) has performed recently.
 * uid → { count, windowStart }
 */
const rateLimitStore = new Map(); 

/**
 * Checks if a user is clicking buttons too fast.
 * @returns {boolean} - true if allowed, false if blocked.
 */
function checkRateLimit(uid) {
  const now = Date.now();
  const entry = rateLimitStore.get(uid) || { count: 0, windowStart: now };

  // Reset window if 60 seconds have passed
  if (now - entry.windowStart >= RATE_WINDOW_MS) {
    rateLimitStore.set(uid, { count: 1, windowStart: now });
    return true;
  }

  // Block if they exceed the max interaction count
  if (entry.count >= MAX_INTERACTIONS) {
    return false;
  }

  // Increment interaction count
  entry.count += 1;
  rateLimitStore.set(uid, entry);
  return true;
}

// ── TYPE-CHECKING HELPER ──────────────────────────────────────────────────────

/**
 * Sanitizes and validates inputs before they ever touch the database.
 */
export function validatePreference(key, value) {
  const schema = PREFERENCE_SCHEMA[key];
  if (!schema) {
    return { valid: false, reason: `Unknown preference key "${key}".` };
  }

  // Handle dropdown/list style values
  if (schema.type === "enum") {
    const normalised = String(value).toLowerCase().trim();
    if (!schema.values.includes(normalised)) {
      return { valid: false, reason: `Invalid value "${value}" for "${key}".` };
    }
    return { valid: true, normalisedValue: normalised };
  }

  // Handle numeric values (cook time)
  if (schema.type === "integer") {
    const num = Number(value);
    if (!Number.isInteger(num) || num < schema.min || num > schema.max) {
      return { valid: false, reason: `"${key}" must be between ${schema.min} and ${schema.max}.` };
    }
    return { valid: true, normalisedValue: num };
  }

  return { valid: false, reason: "Unknown schema type." };
}

// ── FIRESTORE HELPERS ─────────────────────────────────────────────────────────

function prefRef(uid) {
  return doc(db, "preferences", uid);
}

/** Fetches the raw array of preferences from Firestore. */
async function loadPreferences(uid) {
  const snap = await getDoc(prefRef(uid));
  return snap.exists() ? snap.data().items || [] : [];
}

/** Overwrites the user's preference document with a new array. */
async function persistPreferences(uid, items) {
  await setDoc(prefRef(uid), { items });
}

// ── PUBLIC API ────────────────────────────────────────────────────────────────

/**
 * FORMATTER: Converts Firestore array into an object for the Spoonacular API.
 * Turns [{key:'diet', value:'vegan'}] into { diets: ['vegan'], ... }
 */
export async function getUserPreferences(uid) {
  const items = await loadPreferences(uid);
  const result = { cuisines: [], diets: [], allergies: [], maxCookTime: null };

  items.forEach(({ key, value }) => {
    if (key === "cuisine")     result.cuisines.push(value);
    if (key === "diet")        result.diets.push(value);
    if (key === "allergy")     result.allergies.push(value);
    if (key === "maxCookTime") result.maxCookTime = value;
  });
  return result;
}

/** Returns the raw list for display in the UI. Includes Rate Limiting. */
export async function listPreferences(uid) {
  if (!checkRateLimit(uid)) {
    const err = new Error("TOO_MANY_INTERACTIONS");
    err.code = 429; // HTTP 429: Too Many Requests
    throw err;
  }
  return loadPreferences(uid);
}

/**
 * ADDS A PREFERENCE
 * 1. Checks Rate Limit
 * 2. Validates data type/value
 * 3. Checks if user reached the 20-item cap
 * 4. Checks for duplicates
 */
export async function addPreference(uid, key, value) {
  if (!checkRateLimit(uid)) {
    const err = new Error("TOO_MANY_INTERACTIONS");
    err.code = 429;
    throw err;
  }

  const validation = validatePreference(key, value);
  if (!validation.valid) {
    throw new Error(validation.reason);
  }

  const items = await loadPreferences(uid);

  // Enforce Resource Cap
  if (items.length >= MAX_PREFERENCES) {
    throw new Error(`Preference cap reached (${MAX_PREFERENCES}).`);
  }

  // Prevent Duplicates
  const exists = items.some(
    (p) => p.key === key && String(p.value) === String(validation.normalisedValue)
  );
  if (exists) {
    throw new Error(`Preference "${key}: ${validation.normalisedValue}" already exists.`);
  }

  // Specific Logic: maxCookTime should only ever have ONE entry
  if (key === "maxCookTime") {
    const idx = items.findIndex((p) => p.key === "maxCookTime");
    if (idx !== -1) items.splice(idx, 1);
  }

  items.push({ key, value: validation.normalisedValue });
  await persistPreferences(uid, items);
  return items;
}

/** Removes a specific preference using its array index. */
export async function removePreference(uid, index) {
  if (!checkRateLimit(uid)) {
    const err = new Error("TOO_MANY_INTERACTIONS");
    err.code = 429;
    throw err;
  }

  const items = await loadPreferences(uid);
  if (index < 0 || index >= items.length) {
    throw new Error("Invalid preference index.");
  }
  items.splice(index, 1);
  await persistPreferences(uid, items);
  return items;
}

// ── TEST HELPERS (Only used for unit testing) ──────────────────────────────────

export function _resetRateLimit(uid) {
  rateLimitStore.delete(uid);
}

export function _getRateLimitStore() {
  return rateLimitStore;
}