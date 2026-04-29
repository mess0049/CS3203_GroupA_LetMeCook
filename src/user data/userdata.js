import { observeAuth } from "../UserAuthentication/auth.js";

const INTERVAL_MS = 60_000; // periodic save every 60 seconds

const saveFns = new Map();
let intervalId = null;

// Register a save function under a unique key.
// saveFn must return a Promise and handle its own null-UID guard.
export function register(key, saveFn) {
  saveFns.set(key, saveFn);
}

export function unregister(key) {
  saveFns.delete(key);
}

async function saveAll() {
  if (saveFns.size === 0) return;
  setStatus("saving");
  const results = await Promise.allSettled([...saveFns.values()].map(fn => fn()));
  const anyFailed = results.some(r => r.status === "rejected");
  setStatus(anyFailed ? "error" : "saved");
}

function start() {
  if (intervalId) return;
  intervalId = setInterval(saveAll, INTERVAL_MS);
}

function stop() {
  clearInterval(intervalId);
  intervalId = null;
}

// --- Status indicator ---

function createStatusIndicator() {
  if (document.getElementById("autosave-status")) return;
  const el = document.createElement("div");
  el.id = "autosave-status";
  Object.assign(el.style, {
    position: "fixed",
    bottom: "14px",
    right: "18px",
    fontSize: "12px",
    padding: "4px 12px",
    borderRadius: "6px",
    background: "#2ecc71",
    color: "#fff",
    opacity: "0",
    transition: "opacity 0.4s ease",
    zIndex: "9999",
    pointerEvents: "none",
    fontFamily: "sans-serif"
  });
  document.body.appendChild(el);
}

let fadeTimer = null;

function setStatus(state) {
  const el = document.getElementById("autosave-status");
  if (!el) return;
  clearTimeout(fadeTimer);

  const config = {
    saving: { text: "Saving...",              bg: "#f39c12", fade: false },
    saved:  { text: "Saved",                  bg: "#2ecc71", fade: true  },
    error:  { text: "Save failed — retrying", bg: "#e74c3c", fade: false },
    offline:{ text: "Offline",                bg: "#95a5a6", fade: false }
  };

  const { text, bg, fade } = config[state] ?? config.saved;
  el.textContent = text;
  el.style.background = bg;
  el.style.opacity = "1";

  if (fade) {
    fadeTimer = setTimeout(() => { el.style.opacity = "0"; }, 2500);
  }
}

// --- Lifecycle ---

if (typeof window !== "undefined") {
  // Module scripts are deferred, so DOMContentLoaded may have already fired.
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", createStatusIndicator);
  } else {
    createStatusIndicator();
  }

  // Best-effort save before tab closes; Firebase SDK queues writes locally.
  window.addEventListener("beforeunload", () => { saveAll(); });

  window.addEventListener("offline", () => setStatus("offline"));

  window.addEventListener("online", () => {
    // Sync any locally-changed data now that we're back online.
    saveAll();
  });

  observeAuth((uid) => {
    if (uid) {
      start();
    } else {
      stop();
    }
  });
}
