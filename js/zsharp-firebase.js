import { initializeApp } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.17.0/firebase-firestore.js";

const zsharpFirebaseConfig = {
  apiKey: "AIzaSyCo1eNtt2WGNInUnDLR48RR-a-zmaF8zas",
  authDomain: "zsharp.firebaseapp.com",
  projectId: "zsharp",
  storageBucket: "zsharp.firebasestorage.app",
  messagingSenderId: "41399710539",
  appId: "1:41399710539:web:34bc4cd028dfadb7e86ece",
  measurementId: "G-HV6DND2H1N"
};

export const zsharpApp = initializeApp(zsharpFirebaseConfig, "zsharp-store");
export const zsharpDb = getFirestore(zsharpApp);
