// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCRYjLXgI2ZjBVNkthxM1rJmeBqj-GbLLM",
  authDomain: "letmecooksofteng.firebaseapp.com",
  projectId: "letmecooksofteng",
  storageBucket: "letmecooksofteng.firebasestorage.app",
  messagingSenderId: "930994202427",
  appId: "1:930994202427:web:e9f366ae1dde7ee08ef91e",
  measurementId: "G-ZJZDDEZ5D9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Export services
export const auth = getAuth(app);
export const db = getFirestore(app);