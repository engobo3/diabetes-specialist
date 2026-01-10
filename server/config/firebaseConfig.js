const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

let db;

try {
    const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');

    let serviceAccount;

    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        // Production: Use environment variable
        try {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
            console.log('Loaded Firebase credentials from environment variable');
        } catch (e) {
            console.error('Failed to parse FIREBASE_SERVICE_ACCOUNT env var', e);
        }
    } else if (fs.existsSync(serviceAccountPath)) {
        // Development: Use local file
        serviceAccount = require(serviceAccountPath);
        console.log('Loaded Firebase credentials from local file');
    }

    if (serviceAccount) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });

        db = admin.firestore();
        console.log('Firebase initialized successfully');
    } else {
        console.warn('WARNING: serviceAccountKey.json not found in server/config/. Firebase not initialized.');
    }
} catch (error) {
    console.error('Error initializing Firebase:', error);
}

module.exports = { db };
