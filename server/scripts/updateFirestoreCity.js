const { db } = require('../config/firebaseConfig');

const updateFirestoreCities = async () => {
    console.log("Updating doctors in Firestore to 'Kinshasa'...");
    try {
        const snapshot = await db.collection('doctors').get();
        if (snapshot.empty) {
            console.log("No doctors found.");
            return;
        }

        const batch = db.batch();
        snapshot.docs.forEach(doc => {
            const ref = db.collection('doctors').doc(doc.id);
            batch.update(ref, { city: 'Kinshasa' });
        });

        await batch.commit();
        console.log(`Successfully updated ${snapshot.size} doctors.`);
        process.exit(0);
    } catch (error) {
        console.error("Error updating Firestore:", error);
        process.exit(1);
    }
};

updateFirestoreCities();
