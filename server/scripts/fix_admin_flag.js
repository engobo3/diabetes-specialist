#!/usr/bin/env node
const admin = require('firebase-admin');
if (!admin.apps.length) {
    const serviceAccount = require('../config/serviceAccountKey.json');
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

async function fix() {
    // Set isAdmin: true on doctor record "99"
    const docRef = db.collection('doctors').doc('99');
    const doc = await docRef.get();

    if (!doc.exists) {
        console.log('Doctor 99 not found!');
        return;
    }

    console.log('Before:', { isAdmin: doc.data().isAdmin });
    await docRef.update({ isAdmin: true });

    const updated = await docRef.get();
    console.log('After:', { isAdmin: updated.data().isAdmin });
    console.log('Done - isAdmin flag set on doctor 99');
}

fix().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
