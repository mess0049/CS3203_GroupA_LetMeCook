import { db } from "./firebase.js";
import { doc, getDoc, setDoc } from "firebase/firestore";

// ── Constants ────────────────────────────────────────────────────────────────

/** Maximum number of preferences a single user may store. (CWE-770) */
const MAX_PREFERENCES = 20;

/** Rate-limit window in milliseconds. */
const RATE_WINDOW_MS = 60_000;

/** Maximum interactions allowed per window. (CWE-770) */
const MAX_INTERACTIONS = 10;

// ── Allowed preference schema ────────────────────────────────────────────────

/**
 * Defines every valid preference key and its accepted values.
 * Type checking rejects unknown keys and out-of-range values. (CWE-770)
 */
export const PREFERENCE_SCHEMA = {
  cuisine: {
    type: "enum",
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
    type: "integer",
    min: 5,
    max: 480, // 8 hours in minutes
  },
};

// ── In-memory rate-limiter (per-UID) ─────────────────────────────────────────

const rateLimitStore = new Map(); // uid → { count, windowStart }

/**
 * Returns true and increments the counter if the user is within limits.
 * Returns false if they have exceeded MAX_INTERACTIONS in the current window.
 * (CWE-770)
 */
function checkRateLimit(uid) {
  const now = Date.now();
  const entry = rateLimitStore.get(uid) || { count: 0, windowStart: now };

  if (now - entry.windowStart >= RATE_WINDOW_MS) {
    // New window
    rateLimitStore.set(uid, { count: 1, windowStart: now });
    return true;
  }

  if (entry.count >= MAX_INTERACTIONS) {
    return false;
  }

  entry.count += 1;
  rateLimitStore.set(uid, entry);
  return true;
}

// ── Type-checking helper ──────────────────────────────────────────────────────

/**
 * Validates a single { key, value } preference against PREFERENCE_SCHEMA.
 * Returns { valid: true } or { valid: false, reason: string }. (CWE-770)
 */
export function validatePreference(key, value) {
  const schema = PREFERENCE_SCHEMA[key];
  if (!schema) {
    return {
      valid: false,
      reason: `Unknown preference key "${key}". Allowed keys: ${Object.keys(PREFERENCE_SCHEMA).join(", ")}.`,
    };
  }

  if (schema.type === "enum") {
    const normalised = String(value).toLowerCase().trim();
    if (!schema.values.includes(normalised)) {
      return {
        valid: false,
        reason: `Invalid value "${value}" for "${key}". Allowed: ${schema.values.join(", ")}.`,
      };
    }
    return { valid: true, normalisedValue: normalised };
  }

  if (schema.type === "integer") {
    const num = Number(value);
    if (!Number.isInteger(num) || num < schema.min || num > schema.max) {
      return {
        valid: false,
        reason: `"${key}" must be an integer between ${schema.min} and ${schema.max}.`,
      };
    }
    return { valid: true, normalisedValue: num };
  }

  return { valid: false, reason: "Unknown schema type." };
}

// ── Firestore helpers ─────────────────────────────────────────────────────────

function prefRef(uid) {
  return doc(db, "preferences", uid);
}

/** Load raw preferences array from Firestore. */
async function loadPreferences(uid) {
  const snap = await getDoc(prefRef(uid));
  return snap.exists() ? snap.data().items || [] : [];
}

/** Persist preferences array to Firestore. */
async function persistPreferences(uid, items) {
  await setDoc(prefRef(uid), { items });
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Fetch the user's preferences as a flat object usable by SpoonacularAPI:
 *   { cuisines: [...], diets: [...], allergies: [...], maxCookTime: N }
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

/**
 * Return all stored preferences for display in the UI.
 */
export async function listPreferences(uid) {
  if (!checkRateLimit(uid)) {
    const err = new Error("TOO_MANY_INTERACTIONS");
    err.code = 429;
    throw err;
  }
  return loadPreferences(uid);
}

/**
 * Add a new preference { key, value }.
 * Enforces: rate limit, cap of MAX_PREFERENCES, type checking.
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

  if (items.length >= MAX_PREFERENCES) {
    throw new Error(`Preference cap reached (${MAX_PREFERENCES}). Remove one before adding another.`);
  }

  // Prevent exact duplicates
  const exists = items.some(
    (p) => p.key === key && String(p.value) === String(validation.normalisedValue)
  );
  if (exists) {
    throw new Error(`Preference "${key}: ${validation.normalisedValue}" already exists.`);
  }

  // For maxCookTime, replace existing entry rather than stacking
  if (key === "maxCookTime") {
    const idx = items.findIndex((p) => p.key === "maxCookTime");
    if (idx !== -1) items.splice(idx, 1);
  }

  items.push({ key, value: validation.normalisedValue });
  await persistPreferences(uid, items);
  return items;
}

/**
 * Remove a preference by index.
 */
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

// ── Test helpers ──────────────────────────────────────────────────────────────

export function _resetRateLimit(uid) {
  rateLimitStore.delete(uid);
}

export function _getRateLimitStore() {
  return rateLimitStore;
}
