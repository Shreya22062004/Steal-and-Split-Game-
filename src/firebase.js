import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyBeYrMTqZjO3JaWirKo6o6MU8lCXJvRAM0",
  authDomain: "steal-and-split-game.firebaseapp.com",
  projectId: "steal-and-split-game",
  storageBucket: "steal-and-split-game.firebasestorage.app",
  messagingSenderId: "303238794565",
  appId: "1:303238794565:web:d38a75e35f037eef3d022c",
  measurementId: "G-5EGQZRCE0Z",
  databaseURL: "https://steal-and-split-game-default-rtdb.asia-southeast1.firebasedatabase.app"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

export { db };