const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { db } = require('../config/firebaseConfig');

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

const fixBertol = async () => {
    console.log('Fixing Bertol Kensese assignment...');
    try {
        // Find Bertol by checking common email patterns or name
        // Since we don't know the exact email, we search by multiple fields
        // Or mostly, just list all patients and look for the name.
        const snapshot = await db.collection('patients').get();
        let bertolDoc = null;

        snapshot.forEach(doc => {
            const data = doc.data();
            const name = (data.name || '').toLowerCase();
            const email = (data.email || '').toLowerCase();

            if (name.includes('bertol') || email.includes('bertol') || name.includes('kensese')) {
                bertolDoc = doc;
            }
        });

        if (bertolDoc) {
            console.log(`Found Bertol! (ID: ${bertolDoc.id}, Name: ${bertolDoc.data().name})`);
            await db.collection('patients').doc(bertolDoc.id).update({
                doctorId: 99,
                doctorName: 'Dr. Joseph Kensese'
                // doctorName acts as a cache, good to update it too just in case
            });
            console.log('Successfully reassigned Bertol to Dr. Joseph Kensese (ID 99).');
        } else {
            console.log('Could not find a patient named Bertol in Firestore.');
        }

    } catch (e) {
        console.error('Error fixing Bertol:', e);
    }
};

const runMigration = async () => {
    try {
        // 1. Update Reference Data (Doctors, etc.)
        await seedCollection('doctors', 'doctors.json'); // Ensures Dr. Kensese (99) exists with correct name
        // await seedCollection('patients', 'patients.json'); // Optional: Careful not to overwrite real users if IDs clash

        // 2. Fix specific user issues
        await fixBertol();

        console.log('Migration Completed.');
        process.exit(0);
    } catch (error) {
        console.error('Migration Failed:', error);
        process.exit(1);
    }
};

runMigration();
