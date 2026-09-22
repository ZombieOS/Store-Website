import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDG0hSabeqYdGgSISOgvSnkOwATXDLiV9g",
  authDomain: "zombieos.firebaseapp.com",
  projectId: "zombieos",
  storageBucket: "zombieos.firebasestorage.app",
  messagingSenderId: "577624378484",
  appId: "1:577624378484:web:3e88e693724bde8e89d521"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
