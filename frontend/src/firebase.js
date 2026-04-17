// src/firebase.js
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyDsy5qh5JAh4xmnUKsk_3rjzItvcU9xEUU",
  authDomain: "fleet-mvp.firebaseapp.com",
  projectId: "fleet-mvp",
  storageBucket: "fleet-mvp.firebasestorage.app", // ✅ Correct bucket
  messagingSenderId: "336846640598",
  appId: "1:336846640598:web:922b1be351b8109e658077"
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app); // ✅ Now uses the correct bucket
