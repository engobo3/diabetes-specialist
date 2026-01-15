const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { db } = require('../config/firebaseConfig'); // Adjust path as needed

// Helper to read JSON
const readJson = (filename) => {
    const filePath = path.join(__dirname, `../data/${filename}`);
    if (fs.existsSync(filePath)) {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    }
    return [];
};

const seedCollection = async (collectionName, filename) => {
    console.log(`Seeding ${collectionName} from ${filename}...`);
    const data = readJson(filename);
    const batch = db.batch();
    let count = 0;

    for (const item of data) {
        // Use 'id' from JSON as the document ID in Firestore for consistency
        const docRef = db.collection(collectionName).doc(String(item.id));
        batch.set(docRef, item, { merge: true });
        count++;
    }

    if (count > 0) {
        await batch.commit();
        console.log(`Synced ${count} items to ${collectionName}.`);
    }
};

const cleanup = async () => {
    try {
        console.log("Starting Doctor Cleanup...");

        // 1. Delete Dr. Sarah Connor (ID 1)
        console.log("Deleting Dr. Sarah Connor (ID 1)...");
        await db.collection('doctors').doc('1').delete();
        console.log("Deleted Dr. Sarah Connor.");

        // 2. Sync remaining doctors (Updates Dr. Kensese's email)
        await seedCollection('doctors', 'doctors.json');

        console.log("Cleanup Complete.");
        process.exit(0);
    } catch (error) {
        console.error("Cleanup Failed:", error);
        process.exit(1);
    }
};

cleanup();
