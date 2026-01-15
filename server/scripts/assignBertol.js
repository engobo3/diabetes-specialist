const admin = require('firebase-admin');
const { db } = require('../config/firebaseConfig');

const assignBertol = async () => {
    console.log("Searching for Bertol Kensese Engobo...");
    try {
        const snapshot = await db.collection('patients').get();
        let bertolDoc = null;

        snapshot.forEach(doc => {
            const data = doc.data();
            const name = (data.name || '').toLowerCase();
            const email = (data.email || '').toLowerCase();
            // Match any part of the name
            if (name.includes('bertol')) {
                bertolDoc = doc;
            }
        });

        if (bertolDoc) {
            console.log(`Found Patient! ID: ${bertolDoc.id}`);
            console.log(`Current Data: Name=${bertolDoc.data().name}, DoctorID=${bertolDoc.data().doctorId}`);

            await db.collection('patients').doc(bertolDoc.id).update({
                doctorId: 99,
                doctorName: "Dr. Joseph Kensese"
            });
            console.log("SUCCESS: Assigned to Dr. Joseph Kensese (ID 99).");
        } else {
            console.log("ERROR: Could not find 'Bertol Kensese Engobo' in the database.");
        }
        process.exit(0);
    } catch (error) {
        console.error("Error:", error);
        process.exit(1);
    }
};

assignBertol();
