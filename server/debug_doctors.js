const { db } = require('./config/firebaseConfig');
const fs = require('fs');
const path = require('path');

const doctorsPath = path.join(__dirname, 'data/doctors.json');

async function debugDoctors() {
    try {
        console.log("Checking doctors locally...");
        if (fs.existsSync(doctorsPath)) {
            const doctors = JSON.parse(fs.readFileSync(doctorsPath, 'utf8'));
            const kensese = doctors.filter(d => d.contact?.email?.includes('kensese'));
            console.log("Local Kensese:", JSON.stringify(kensese, null, 2));
        }

        console.log("Checking doctors in Firestore...");
        if (db) {
            const snapshot = await db.collection('doctors').where('email', '==', 'kensesebertol@yahoo.fr').get();
            if (snapshot.empty) {
                console.log("No Kensese found in Firestore via query.");
            } else {
                snapshot.forEach(doc => {
                    console.log("Firestore Kensese found:", doc.id, doc.data());
                });
            }

            // Also list all to be sure
            const allDocs = await db.collection('doctors').get();
            const allKensese = allDocs.docs.filter(d => d.data().name.includes('Kensese') || (d.data().email && d.data().email.includes('kensese')));
            console.log("All Firestore Kensese matches:", allKensese.map(d => ({ id: d.id, ...d.data() })));
        }

    } catch (e) {
        console.error(e);
    }
}

debugDoctors();
