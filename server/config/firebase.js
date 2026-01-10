const admin = require('firebase-admin');

// Initialize Firebase Admin
// In Cloud Functions, this works automatically with default credentials.
// For local development, you might need to set GOOGLE_APPLICATION_CREDENTIALS
if (!admin.apps.length) {
    admin.initializeApp();
}

const db = admin.firestore();

module.exports = { admin, db };
