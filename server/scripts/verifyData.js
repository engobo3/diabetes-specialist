const { db } = require('../config/firebaseConfig');

const verifyData = async () => {
    console.log("--- Verifying Data ---");

    try {
        // 1. Check Doctor
        console.log("\nSearching for Doctor (kensesebertol@yahoo.fr)...");
        const docSnapshot = await db.collection('doctors').where('email', '==', 'kensesebertol@yahoo.fr').get();
        if (docSnapshot.empty) {
            console.log("❌ Doctor NOT FOUND by email 'kensesebertol@yahoo.fr'");
            // Try ID 99 directly
            console.log("Checking ID 99 directly...");
            const docIdSnapshot = await db.collection('doctors').doc('99').get();
            if (docIdSnapshot.exists) {
                console.log(`⚠️ Doctor found by ID 99, but Email is: '${docIdSnapshot.data().email}'`);
            } else {
                console.log("❌ Doctor ID 99 NOT FOUND");
            }
        } else {
            docSnapshot.forEach(doc => {
                console.log(`✅ Doctor Found: ID='${doc.id}' (Firestore ID), data.id=${doc.data().id}`);
            });
        }

        // 2. Check Patient
        console.log("\nSearching for Patient (Bertol)...");
        const patSnapshot = await db.collection('patients').get();
        let found = false;
        patSnapshot.forEach(doc => {
            const data = doc.data();
            if ((data.name || '').toLowerCase().includes('bertol')) {
                console.log(`✅ Patient Found: Name='${data.name}'`);
                console.log(`   - Firestore ID: ${doc.id}`);
                console.log(`   - Assigned doctorId: ${data.doctorId} (Type: ${typeof data.doctorId})`);
                found = true;
            }
        });

        if (!found) console.log("❌ Patient 'Bertol' NOT FOUND");

    } catch (error) {
        console.error("Error verifying data:", error);
    }
    process.exit(0);
};

verifyData();
