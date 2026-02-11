#!/usr/bin/env node
const admin = require('firebase-admin');
if (!admin.apps.length) {
    const serviceAccount = require('../config/serviceAccountKey.json');
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function check() {
    const BERTOL_UID = 'tkC31zZSsJWnziSQwGpiLgtdUay2';

    // Check users collection for Bertol's UID
    console.log('=== Users doc for Bertol UID ===');
    const userDoc = await db.collection('users').doc(BERTOL_UID).get();
    if (userDoc.exists) {
        console.log('  EXISTS:', userDoc.data());
    } else {
        console.log('  Does not exist');
    }

    // Check if any doctor has email pumpinglemma1@gmail.com
    console.log('\n=== Doctor lookup for pumpinglemma1@gmail.com ===');
    const doctorSnap = await db.collection('doctors').where('contact.email', '==', 'pumpinglemma1@gmail.com').get();
    if (doctorSnap.empty) {
        console.log('  No doctor found');
    } else {
        doctorSnap.forEach(d => console.log('  Found:', d.id, d.data().name, 'isAdmin:', d.data().isAdmin));
    }

    // Check caregiver lookup
    console.log('\n=== Caregiver lookup for pumpinglemma1@gmail.com ===');
    const patients = await db.collection('patients').get();
    patients.forEach(doc => {
        const d = doc.data();
        if (d.caregivers && Array.isArray(d.caregivers)) {
            d.caregivers.forEach(c => {
                if (c.email === 'pumpinglemma1@gmail.com') {
                    console.log('  Found as caregiver for patient:', d.name);
                }
            });
        }
    });

    // List ALL documents in users collection
    console.log('\n=== All users documents ===');
    const allUsers = await db.collection('users').get();
    allUsers.forEach(doc => {
        console.log(`  UID: ${doc.id}, data:`, doc.data());
    });
}

check().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
