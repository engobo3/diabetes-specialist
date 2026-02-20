import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { getAnalytics } from "firebase/analytics";
import { getMessaging, getToken, onMessage } from "firebase/messaging";

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
let messaging;

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

  try {
    messaging = getMessaging(app);
  } catch (e) {
    console.warn("Firebase Messaging could not be initialized:", e);
  }
}

/**
 * Request notification permission and get FCM token.
 * @returns {string|null} FCM token or null if denied/unavailable
 */
export const requestNotificationPermission = async () => {
    try {
        if (!messaging) return null;
        if (!('Notification' in window)) return null;

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return null;

        const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
        if (!vapidKey) {
            console.warn('VITE_FIREBASE_VAPID_KEY not set — push notifications disabled');
            return null;
        }

        const token = await getToken(messaging, { vapidKey });
        return token;
    } catch (error) {
        console.error('Error getting notification permission/token:', error);
        return null;
    }
};

/**
 * Listen for foreground push messages.
 * @param {Function} callback - Called with { notification: { title, body }, data }
 */
export const onForegroundMessage = (callback) => {
    if (!messaging) return () => {};
    return onMessage(messaging, (payload) => {
        callback(payload);
    });
};
