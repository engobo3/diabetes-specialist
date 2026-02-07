#!/usr/bin/env node

/**
 * Setup Admin as Doctor
 * This script ensures the admin user (kensesebertol@yahoo.fr) exists as a doctor in Firestore
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
    const serviceAccount = require('../config/serviceAccountKey.json');
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();
const auth = admin.auth();

const ADMIN_EMAIL = 'kensesebertol@yahoo.fr';

async function setupAdminDoctor() {
    console.log('🔧 Setting up admin as doctor...\n');

    try {
        // Step 1: Get or create Firebase Auth user
        console.log(`1️⃣ Checking Firebase Auth for ${ADMIN_EMAIL}...`);
        let authUser;
        try {
            authUser = await auth.getUserByEmail(ADMIN_EMAIL);
            console.log(`   ✅ Found existing user: ${authUser.uid}`);
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                console.log(`   ⚠️  User not found, creating new Firebase Auth user...`);
                authUser = await auth.createUser({
                    email: ADMIN_EMAIL,
                    password: 'Admin@123456', // Change this immediately after first login!
                    displayName: 'Dr. Kense Sebertol',
                    emailVerified: true
                });
                console.log(`   ✅ Created user: ${authUser.uid}`);
                console.log(`   📝 Default password: Admin@123456 (CHANGE THIS!)`);
            } else {
                throw error;
            }
        }

        // Step 2: Check if doctor record exists in Firestore
        console.log('\n2️⃣ Checking Firestore doctors collection...');
        const doctorsSnapshot = await db.collection('doctors')
            .where('contact.email', '==', ADMIN_EMAIL)
            .limit(1)
            .get();

        let doctorRef;
        let doctorData;

        if (!doctorsSnapshot.empty) {
            // Doctor exists, update UID
            doctorRef = doctorsSnapshot.docs[0].ref;
            doctorData = doctorsSnapshot.docs[0].data();
            console.log(`   ✅ Found existing doctor: ${doctorRef.id}`);

            // Update UID if missing
            if (!doctorData.uid || doctorData.uid !== authUser.uid) {
                await doctorRef.update({ uid: authUser.uid });
                console.log(`   ✅ Updated UID to: ${authUser.uid}`);
            }
        } else {
            // Create new doctor record
            console.log('   ⚠️  No doctor record found, creating new one...');
            doctorData = {
                name: 'Dr. Kense Sebertol',
                specialty: 'Diabetes Specialist',
                bio: 'Senior diabetes specialist with extensive experience in patient care and medical management. Dedicated to providing comprehensive diabetes management and education.',
                education: [
                    'MD, Specialized in Endocrinology',
                    'Board Certified in Diabetes Management'
                ],
                contact: {
                    email: ADMIN_EMAIL,
                    phone: '+243 81 234 5678',
                    address: 'Medical Center, Kinshasa'
                },
                languages: ['French', 'English', 'Lingala'],
                image: 'https://randomuser.me/api/portraits/men/50.jpg',
                city: 'Kinshasa',
                role: 'doctor',
                uid: authUser.uid,
                isAdmin: true,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };

            doctorRef = await db.collection('doctors').add(doctorData);
            console.log(`   ✅ Created doctor record: ${doctorRef.id}`);
        }

        // Step 3: Create/update users collection entry for admin role
        console.log('\n3️⃣ Setting up admin role...');
        const userRef = db.collection('users').doc(authUser.uid);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            await userRef.set({
                email: ADMIN_EMAIL,
                role: 'admin',
                displayName: 'Dr. Kense Sebertol',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
            console.log('   ✅ Created admin role in users collection');
        } else {
            const userData = userDoc.data();
            if (userData.role !== 'admin') {
                await userRef.update({ role: 'admin' });
                console.log('   ✅ Updated role to admin');
            } else {
                console.log('   ✅ Admin role already set');
            }
        }

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('✅ SETUP COMPLETE!');
        console.log('='.repeat(60));
        console.log(`\n📧 Admin Email: ${ADMIN_EMAIL}`);
        console.log(`🆔 Firebase UID: ${authUser.uid}`);
        console.log(`👨‍⚕️  Doctor ID: ${doctorRef.id}`);
        console.log(`🔐 Role: Admin + Doctor`);
        console.log('\n🎯 You can now:');
        console.log('   1. Login with your admin email');
        console.log('   2. Switch between admin and doctor roles');
        console.log('   3. Access both admin and doctor features');
        console.log('\n⚠️  Security Note:');
        console.log('   If a default password was created, change it immediately!');
        console.log('   Login → Profile → Change Password\n');

    } catch (error) {
        console.error('\n❌ Error setting up admin doctor:', error);
        process.exit(1);
    }
}

// Run the setup
setupAdminDoctor()
    .then(() => process.exit(0))
    .catch(error => {
        console.error('Fatal error:', error);
        process.exit(1);
    });
