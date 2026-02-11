/**
 * Migration Script: Backfill doctorIds from doctorId
 *
 * For each patient that has doctorId but no doctorIds array,
 * creates doctorIds: [doctorId] to support multi-doctor relationship.
 *
 * Usage: node server/scripts/migrate_doctor_ids.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
const serviceAccountPath = path.join(__dirname, '..', 'config', 'serviceAccountKey.json');
try {
    const serviceAccount = require(serviceAccountPath);
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount)
        });
    }
} catch (e) {
    console.error('Could not load service account key:', e.message);
    console.log('Trying default credentials...');
    if (!admin.apps.length) {
        admin.initializeApp();
    }
}

const db = admin.firestore();

async function migrate() {
    console.log('Starting doctorIds migration...');

    const snapshot = await db.collection('patients').get();
    console.log(`Found ${snapshot.size} patients total.`);

    let migrated = 0;
    let skipped = 0;
    let noDoctorId = 0;

    const batch = db.batch();

    for (const doc of snapshot.docs) {
        const data = doc.data();

        // Skip if already has doctorIds
        if (data.doctorIds && Array.isArray(data.doctorIds) && data.doctorIds.length > 0) {
            skipped++;
            continue;
        }

        // Skip if no doctorId to migrate
        if (!data.doctorId) {
            noDoctorId++;
            continue;
        }

        // Backfill doctorIds from doctorId
        batch.update(doc.ref, {
            doctorIds: [String(data.doctorId)]
        });
        migrated++;
        console.log(`  [MIGRATE] Patient ${doc.id} (${data.name}): doctorId=${data.doctorId} -> doctorIds=[${data.doctorId}]`);
    }

    if (migrated > 0) {
        await batch.commit();
    }

    console.log('\n--- Migration Complete ---');
    console.log(`  Migrated: ${migrated}`);
    console.log(`  Skipped (already has doctorIds): ${skipped}`);
    console.log(`  Skipped (no doctorId): ${noDoctorId}`);
    console.log(`  Total: ${snapshot.size}`);
}

migrate()
    .then(() => process.exit(0))
    .catch(err => {
        console.error('Migration failed:', err);
        process.exit(1);
    });
