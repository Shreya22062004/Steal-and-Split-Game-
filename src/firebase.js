import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";

// ⚠️ Yaha apna REAL config daalna (Firebase console se)
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
  databaseURL: "https://YOUR_PROJECT.firebaseio.com",
};

// 🛑 Safety wrapper (white screen avoid karega)
let app;
try {
  app = initializeApp(firebaseConfig);
} catch (err) {
  console.error("Firebase init error:", err);
}

export const auth = getAuth(app);
export const db = getDatabase(app);