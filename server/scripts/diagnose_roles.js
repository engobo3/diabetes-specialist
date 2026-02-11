#!/usr/bin/env node
const admin = require('firebase-admin');
if (!admin.apps.length) {
    const serviceAccount = require('../config/serviceAccountKey.json');
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
}
const db = admin.firestore();

const EMAIL = 'kensesebertol@yahoo.fr';
const UID = 'XuTPjdM0vYMYCAmxrJOSbsmv4LB2';

async function diagnose() {
    console.log('=== 1. PATIENT LOOKUP BY EMAIL ===');
    const patientsByEmail = await db.collection('patients').where('email', '==', EMAIL).get();
    if (patientsByEmail.empty) {
        console.log('  No patient found with email:', EMAIL);
    } else {
        patientsByEmail.forEach(doc => {
            const d = doc.data();
            console.log(`  Found patient: "${d.name}" (doc ID: ${doc.id}, data.id: ${d.id})`);
            console.log(`    email: ${d.email}, phone: ${d.phone}, doctorId: ${d.doctorId}`);
        });
    }

    console.log('\n=== 2. PATIENT "Bertol Kensese Engobo" ===');
    const allPatients = await db.collection('patients').get();
    allPatients.forEach(doc => {
        const d = doc.data();
        if (d.name && d.name.includes('Bertol')) {
            console.log(`  Doc ID: ${doc.id}`);
            console.log(`  name: ${d.name}`);
            console.log(`  email: ${d.email}`);
            console.log(`  phone: ${d.phone}`);
            console.log(`  uid: ${d.uid}`);
            console.log(`  doctorId: ${d.doctorId}`);
        }
    });

    console.log('\n=== 3. DOCTOR LOOKUP BY EMAIL ===');
    const doctorSnap = await db.collection('doctors').where('contact.email', '==', EMAIL).limit(1).get();
    if (doctorSnap.empty) {
        console.log('  No doctor found with contact.email:', EMAIL);
    } else {
        const doc = doctorSnap.docs[0];
        const d = doc.data();
        console.log(`  Found doctor: "${d.name}" (doc ID: ${doc.id}, data.id: ${d.id})`);
        console.log(`  isAdmin: ${d.isAdmin}`);
        console.log(`  uid: ${d.uid}`);
        console.log(`  contact.email: ${d.contact?.email}`);
    }

    console.log('\n=== 4. USERS COLLECTION (admin check) ===');
    const userDoc = await db.collection('users').doc(UID).get();
    if (!userDoc.exists) {
        console.log('  No user document for UID:', UID);
    } else {
        const d = userDoc.data();
        console.log(`  User doc exists for UID: ${UID}`);
        console.log(`  role: ${d.role}`);
        console.log(`  email: ${d.email}`);
        console.log(`  displayName: ${d.displayName}`);
    }

    console.log('\n=== 5. EXPECTED ROLES ===');
    const roles = [];
    if (!patientsByEmail.empty) roles.push('patient');
    if (!doctorSnap.empty) {
        roles.push('doctor');
        if (doctorSnap.docs[0].data().isAdmin) roles.push('admin');
    }
    if (!roles.includes('admin') && userDoc.exists && userDoc.data().role === 'admin') {
        roles.push('admin');
    }
    console.log('  Expected roles:', roles);
}

diagnose().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
