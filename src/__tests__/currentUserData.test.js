// Tests for userdata.js — the periodic auto-save and sync layer.
//
// userdata.js registers event listeners and calls observeAuth at import time.
// We capture the observeAuth callback so we can simulate login/logout manually,
// and use fake timers to control setInterval without waiting real time.

let capturedAuthCallback = null;

jest.mock("../auth.js", () => ({
  observeAuth: jest.fn((cb) => {
    capturedAuthCallback = cb;
  }),
}));

// Fake timers let us advance setInterval without real delays.
beforeAll(() => { jest.useFakeTimers(); });
afterAll(() => { jest.useRealTimers(); });

// Re-import a fresh copy of the module before every test so side-effects
// (addEventListener, observeAuth) are re-registered in a clean state.
let register, unregister;

beforeEach(async () => {
  jest.resetModules();
  capturedAuthCallback = null;
  document.body.innerHTML = "";

  const mod = await import("../user data/userdata.js");
  register = mod.register;
  unregister = mod.unregister;
});

afterEach(() => {
  jest.clearAllTimers();
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------

describe("currentUserData — register / unregister", () => {

  // Normal: a registered save function runs on the periodic interval.
  test("testValidSave: registered function is called once per interval tick", async () => {
    const saveFn = jest.fn().mockResolvedValue();
    register("calories", saveFn);

    capturedAuthCallback("uid-abc"); // simulate login → starts interval
    jest.advanceTimersByTime(60_001);
    await Promise.resolve();

    expect(saveFn).toHaveBeenCalledTimes(1);
  });

  // Normal: multiple sources are all saved each tick.
  test("testMultipleSources: all registered functions are called on each tick", async () => {
    const saveMeals   = jest.fn().mockResolvedValue();
    const savePantry  = jest.fn().mockResolvedValue();
    const saveCalories = jest.fn().mockResolvedValue();
    register("meals",    saveMeals);
    register("pantry",   savePantry);
    register("calories", saveCalories);

    capturedAuthCallback("uid-abc");
    jest.advanceTimersByTime(60_001);
    await Promise.resolve();

    expect(saveMeals).toHaveBeenCalledTimes(1);
    expect(savePantry).toHaveBeenCalledTimes(1);
    expect(saveCalories).toHaveBeenCalledTimes(1);
  });

  // Normal: unregistered functions are not called.
  test("testUnregister: removed function is not called after unregister", async () => {
    const saveFn = jest.fn().mockResolvedValue();
    register("temp", saveFn);
    unregister("temp");

    capturedAuthCallback("uid-abc");
    jest.advanceTimersByTime(60_001);
    await Promise.resolve();

    expect(saveFn).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------

describe("currentUserData — auth lifecycle", () => {

  // No user logged in: interval must not fire.
  test("testNoUserLoggedIn: interval does not fire before login", async () => {
    const saveFn = jest.fn().mockResolvedValue();
    register("noauth", saveFn);

    // Never call capturedAuthCallback — user stays logged out.
    jest.advanceTimersByTime(120_001);
    await Promise.resolve();

    expect(saveFn).not.toHaveBeenCalled();
  });

  // Session expired / logout: interval must stop after logout.
  test("testSessionExpired: interval stops after logout and no further saves occur", async () => {
    const saveFn = jest.fn().mockResolvedValue();
    register("lifecycle", saveFn);

    capturedAuthCallback("uid-abc"); // login
    jest.advanceTimersByTime(60_001);
    await Promise.resolve();
    expect(saveFn).toHaveBeenCalledTimes(1);

    capturedAuthCallback(null); // logout — interval should stop

    jest.advanceTimersByTime(60_001);
    await Promise.resolve();

    // Still only 1 call — no saves after logout.
    expect(saveFn).toHaveBeenCalledTimes(1);
  });

  // Data integrity: two interval ticks produce exactly two saves.
  test("testDataIntegrity: saves fire once per tick over multiple intervals", async () => {
    const saveFn = jest.fn().mockResolvedValue();
    register("integrity", saveFn);

    capturedAuthCallback("uid-abc");
    jest.advanceTimersByTime(120_001); // two full ticks
    await Promise.resolve();

    expect(saveFn).toHaveBeenCalledTimes(2);
  });
});

// ---------------------------------------------------------------------------

describe("currentUserData — browser events", () => {

  // Coming back online should immediately sync data.
  test("testOnlineSync: 'online' event triggers an immediate save", async () => {
    const saveFn = jest.fn().mockResolvedValue();
    register("online-test", saveFn);

    window.dispatchEvent(new Event("online"));
    await Promise.resolve();

    expect(saveFn).toHaveBeenCalledTimes(1);
  });

  // Page close / navigate away should attempt a final save.
  test("testBeforeUnload: 'beforeunload' event triggers an immediate save", async () => {
    const saveFn = jest.fn().mockResolvedValue();
    register("unload-test", saveFn);

    window.dispatchEvent(new Event("beforeunload"));
    await Promise.resolve();

    expect(saveFn).toHaveBeenCalledTimes(1);
  });

  // Server disconnected: save function rejects but module does not throw.
  test("testServerDisconnected: failed save is handled without crashing", async () => {
    const failingFn = jest.fn().mockRejectedValue(new Error("network error"));
    register("network-test", failingFn);

    // Should resolve (not reject) even when save fails.
    await expect(
      window.dispatchEvent(new Event("online")) || Promise.resolve()
    ).resolves.not.toThrow();

    await Promise.resolve();
    expect(failingFn).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------

describe("currentUserData — status indicator", () => {

  // Indicator is injected into the DOM.
  test("testStatusCreated: indicator element is added to the DOM", () => {
    document.dispatchEvent(new Event("DOMContentLoaded"));
    expect(document.getElementById("autosave-status")).not.toBeNull();
  });

  // Indicator is not duplicated on repeated events.
  test("testNoDuplication: indicator is not created twice", () => {
    document.dispatchEvent(new Event("DOMContentLoaded"));
    document.dispatchEvent(new Event("DOMContentLoaded"));
    const elements = document.querySelectorAll("#autosave-status");
    expect(elements.length).toBe(1);
  });

  // Going offline shows the right label.
  test("testOfflineStatus: indicator shows 'Offline' when connection is lost", () => {
    document.dispatchEvent(new Event("DOMContentLoaded"));
    window.dispatchEvent(new Event("offline"));
    const el = document.getElementById("autosave-status");
    expect(el.textContent).toBe("Offline");
  });
});
