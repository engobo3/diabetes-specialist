#!/usr/bin/env node
const admin = require('firebase-admin');
if (!admin.apps.length) {
    const serviceAccount = require('../config/serviceAccountKey.json');
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function diagnose() {
    const EMAIL = 'kensesebertol@yahoo.fr';

    console.log('=== DOCTOR RECORDS ===');
    const allDoctors = await db.collection('doctors').where('contact.email', '==', EMAIL).get();
    allDoctors.forEach(doc => {
        console.log(`\nDoc ID: "${doc.id}"`);
        const data = doc.data();
        console.log(`  data.id: ${data.id} (type: ${typeof data.id})`);
        console.log(`  data.name: ${data.name}`);
        console.log(`  data.uid: ${data.uid}`);
        console.log(`  data.contact.email: ${data.contact?.email}`);
    });

    console.log('\n=== PATIENTS WITH doctorId ===');
    const patients = await db.collection('patients').get();
    const doctorIds = new Set();
    patients.forEach(doc => {
        const data = doc.data();
        doctorIds.add(`${data.doctorId} (type: ${typeof data.doctorId})`);
        console.log(`  Patient "${data.name}" -> doctorId: ${data.doctorId} (type: ${typeof data.doctorId})`);
    });
    console.log('\nUnique doctorIds in patients:', [...doctorIds]);

    console.log('\n=== WHAT LOOKUP RETURNS ===');
    const snapshot = await db.collection('doctors').where('contact.email', '==', EMAIL).limit(1).get();
    if (!snapshot.empty) {
        const doc = snapshot.docs[0];
        const result = { id: doc.id, ...doc.data() };
        console.log(`Lookup returns id: "${result.id}" (type: ${typeof result.id})`);
    }
}

diagnose().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
