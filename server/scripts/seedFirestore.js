const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');
const { db } = require('../config/firebaseConfig'); // Assumes this exports existing initialized db

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
        batch.set(docRef, item, { merge: true }); // Merge to update existing without overwriting everything
        count++;
    }

    if (count > 0) {
        await batch.commit();
        console.log(`Successfully synced ${count} documents to ${collectionName}.`);
    } else {
        console.log(`No data found for ${collectionName}.`);
    }
};

const seedDatabase = async () => {
    try {
        await seedCollection('doctors', 'doctors.json');
        await seedCollection('patients', 'patients.json');
        await seedCollection('appointments', 'appointments.json');
        await seedCollection('vitals', 'vitals.json');
        await seedCollection('prescriptions', 'prescriptions.json');
        await seedCollection('messages', 'messages.json');

        console.log('Database seeding completed successfully!');
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
};

seedDatabase();
