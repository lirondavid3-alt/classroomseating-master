import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, doc, getDocFromServer } from "firebase/firestore";
import { getAnalytics } from "firebase/analytics";
import firebaseConfig from "../firebase-applet-config.json";

console.log("--- [DEBUG] App Version: 1.1.0 - AGGRESSIVE FIREBASE FIX ---");

// Initialize Firebase SDK with hardcoded values to ensure deployment success
const config = {
  apiKey: "AIzaSyBCoYlLLNLQ3YsicoPoOarAWP7cjK1Ok9I",
  authDomain: "classroomseating-master.firebaseapp.com",
  projectId: "classroomseating-master",
  appId: "1:822531640726:web:d841920e0081a81939e1b7",
  storageBucket: "classroomseating-master.firebasestorage.app",
  messagingSenderId: "822531640726",
};

// Expose to window for debugging in production
if (typeof window !== 'undefined') {
  (window as any).FIREBASE_CONFIG = config;
}

console.log("--- [DEBUG] Firebase Config Loaded (Hardcoded 1.1.0) ---");

const app = initializeApp(config);
const auth = getAuth(app);
const db = getFirestore(app);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
const googleProvider = new GoogleAuthProvider();

export { auth, db, analytics, googleProvider };
