import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";

// Config uses environment variables (Vite bakes these in at build time)
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let app;
export let auth;
export let storage;
let analytics;

try {
  app = initializeApp(firebaseConfig);
} catch (e) {
  console.warn("Firebase App could not be initialized:", e);
}

if (app) {
  try {
    auth = getAuth(app);
  } catch (e) {
    console.warn("Firebase Auth could not be initialized:", e);
  }

  try {
    storage = getStorage(app);
  } catch (e) {
    console.warn("Firebase Storage could not be initialized:", e);
  }

  try {
    analytics = getAnalytics(app);
  } catch (e) {
    console.warn("Firebase Analytics could not be initialized:", e);
  }
}
