import {
  addPreference,
  removePreference,
  listPreferences,
  validatePreference,
  getUserPreferences,
  _resetRateLimit,
  _getRateLimitStore,
  PREFERENCE_SCHEMA,
} from "../Preference_Tracker.js";

// ── Mocks ────────────────────────────────────────────────────────────────────

jest.mock("../firebase.js", () => ({ db: {} }));

const mockItems = [];

jest.mock("firebase/firestore", () => ({
  doc: jest.fn(),
  getDoc: jest.fn(() =>
    Promise.resolve({
      exists: () => mockItems.length > 0,
      data: () => ({ items: [...mockItems] }),
    })
  ),
  setDoc: jest.fn((_ref, data) => {
    mockItems.length = 0;
    mockItems.push(...(data.items || []));
    return Promise.resolve();
  }),
}));

const UID = "test-user-123";

beforeEach(() => {
  mockItems.length = 0;
  _resetRateLimit(UID);
  jest.clearAllMocks();
});

// ── validatePreference ────────────────────────────────────────────────────────

describe("validatePreference — type checking", () => {
  test("accepts a valid cuisine", () => {
    const result = validatePreference("cuisine", "Italian");
    expect(result.valid).toBe(true);
    expect(result.normalisedValue).toBe("italian");
  });

  test("accepts a valid diet", () => {
    expect(validatePreference("diet", "vegan").valid).toBe(true);
  });

  test("accepts a valid allergy", () => {
    expect(validatePreference("allergy", "Peanut").valid).toBe(true);
  });

  test("accepts a valid maxCookTime in range", () => {
    const r = validatePreference("maxCookTime", 30);
    expect(r.valid).toBe(true);
    expect(r.normalisedValue).toBe(30);
  });

  test("rejects an unknown preference key", () => {
    const r = validatePreference("favoriteColor", "blue");
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/Unknown preference key/);
  });

  test("rejects an invalid cuisine value", () => {
    const r = validatePreference("cuisine", "martian");
    expect(r.valid).toBe(false);
    expect(r.reason).toMatch(/Invalid value/);
  });

  test("rejects maxCookTime below minimum", () => {
    expect(validatePreference("maxCookTime", 1).valid).toBe(false);
  });

  test("rejects maxCookTime above maximum", () => {
    expect(validatePreference("maxCookTime", 999).valid).toBe(false);
  });

  test("rejects non-integer maxCookTime", () => {
    expect(validatePreference("maxCookTime", 30.5).valid).toBe(false);
  });
});

// ── addPreference ─────────────────────────────────────────────────────────────

describe("addPreference", () => {
  test("adds a valid preference", async () => {
    const items = await addPreference(UID, "cuisine", "Mexican");
    expect(items.length).toBe(1);
    expect(items[0]).toEqual({ key: "cuisine", value: "mexican" });
  });

  test("rejects an invalid preference key", async () => {
    await expect(addPreference(UID, "mood", "happy")).rejects.toThrow(/Unknown preference key/);
  });

  test("rejects an invalid enum value", async () => {
    await expect(addPreference(UID, "diet", "liquidOnly")).rejects.toThrow(/Invalid value/);
  });

  test("rejects a duplicate preference", async () => {
    await addPreference(UID, "cuisine", "italian");
    await expect(addPreference(UID, "cuisine", "Italian")).rejects.toThrow(/already exists/);
  });

  test("replaces existing maxCookTime instead of stacking", async () => {
    await addPreference(UID, "maxCookTime", 30);
    await addPreference(UID, "maxCookTime", 60);
    const items = mockItems.filter((p) => p.key === "maxCookTime");
    expect(items.length).toBe(1);
    expect(items[0].value).toBe(60);
  });
});

// ── Cap enforcement (CWE-770) ─────────────────────────────────────────────────

describe("preference cap — CWE-770", () => {
  test("enforces cap of 20 preferences", async () => {
    const cuisines = PREFERENCE_SCHEMA.cuisine.values.slice(0, 20);
    for (const c of cuisines) {
      _resetRateLimit(UID); // bypass rate limit for setup
      await addPreference(UID, "cuisine", c);
    }
    _resetRateLimit(UID);
    await expect(addPreference(UID, "diet", "vegan")).rejects.toThrow(/Preference cap reached/);
  });
});

// ── removePreference ──────────────────────────────────────────────────────────

describe("removePreference", () => {
  test("removes preference by index", async () => {
    await addPreference(UID, "cuisine", "thai");
    _resetRateLimit(UID);
    const after = await removePreference(UID, 0);
    expect(after.length).toBe(0);
  });

  test("throws on out-of-range index", async () => {
    await expect(removePreference(UID, 99)).rejects.toThrow(/Invalid preference index/);
  });
});

// ── Rate limiting (CWE-770) ───────────────────────────────────────────────────

describe("rate limiting — CWE-770", () => {
  test("allows up to 10 interactions per minute", async () => {
    // Use listPreferences (each call = 1 interaction)
    for (let i = 0; i < 10; i++) {
      await expect(listPreferences(UID)).resolves.toBeDefined();
    }
  });

  test("throws TOO_MANY_INTERACTIONS after 10 calls in window", async () => {
    for (let i = 0; i < 10; i++) {
      await listPreferences(UID);
    }
    await expect(listPreferences(UID)).rejects.toMatchObject({ message: "TOO_MANY_INTERACTIONS", code: 429 });
  });

  test("rate limit resets after window expires", async () => {
    // Exhaust the limit
    for (let i = 0; i < 10; i++) await listPreferences(UID);

    // Manually reset to simulate window expiry
    _resetRateLimit(UID);

    await expect(listPreferences(UID)).resolves.toBeDefined();
  });
});

// ── getUserPreferences ────────────────────────────────────────────────────────

describe("getUserPreferences", () => {
  test("returns structured prefs object usable by Spoonacular", async () => {
    await addPreference(UID, "cuisine", "italian");
    _resetRateLimit(UID);
    await addPreference(UID, "diet", "vegan");
    _resetRateLimit(UID);
    await addPreference(UID, "allergy", "peanut");
    _resetRateLimit(UID);
    await addPreference(UID, "maxCookTime", 45);

    const prefs = await getUserPreferences(UID);
    expect(prefs.cuisines).toContain("italian");
    expect(prefs.diets).toContain("vegan");
    expect(prefs.allergies).toContain("peanut");
    expect(prefs.maxCookTime).toBe(45);
  });

  test("returns empty arrays for a user with no preferences", async () => {
    const prefs = await getUserPreferences(UID);
    expect(prefs.cuisines).toEqual([]);
    expect(prefs.diets).toEqual([]);
    expect(prefs.allergies).toEqual([]);
    expect(prefs.maxCookTime).toBeNull();
  });
});
