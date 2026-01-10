const { db } = require('../config/firebase');
const fs = require('fs');
const path = require('path');

const dataPath = path.join(__dirname, '../data/doctors.json');

// Helper to seed data if empty
const seedDoctorsIfNeeded = async () => {
    const snapshot = await db.collection('doctors').get();
    if (snapshot.empty) {
        console.log('Seeding doctors to Firestore...');
        const data = fs.readFileSync(dataPath, 'utf8');
        const doctors = JSON.parse(data);

        const batch = db.batch();
        doctors.forEach(doc => {
            const docRef = db.collection('doctors').doc(doc.id.toString());
            batch.set(docRef, doc);
        });
        await batch.commit();
        console.log('Seeding complete.');
        return doctors;
    }
    return null; // Already data
};

const getDoctors = async (req, res) => {
    try {
        await seedDoctorsIfNeeded(); // Ensure data exists

        const snapshot = await db.collection('doctors').get();
        const doctors = [];
        snapshot.forEach(doc => {
            doctors.push({ id: doc.id, ...doc.data() });
        });
        res.json(doctors);
    } catch (error) {
        console.error("Error getting doctors:", error);
        res.status(500).json({ message: 'Error retrieving doctors' });
    }
};

const getDoctorById = async (req, res) => {
    try {
        const id = req.params.id;
        // Try to get by document ID (string) or query by integer ID field if legacy
        let doc = await db.collection('doctors').doc(id).get();

        if (!doc.exists) {
            // Fallback: Query by 'id' field (integer) for legacy mock data
            const snapshot = await db.collection('doctors').where('id', '==', parseInt(id)).limit(1).get();
            if (!snapshot.empty) {
                doc = snapshot.docs[0];
            } else {
                return res.status(404).json({ message: 'Doctor not found' });
            }
        }

        res.json({ id: doc.id, ...doc.data() });
    } catch (error) {
        console.error("Error getting doctor:", error);
        res.status(500).json({ message: 'Error retrieving doctor' });
    }
};

const lookupDoctorByEmail = async (req, res) => {
    try {
        const email = req.query.email;
        if (!email) {
            return res.status(400).json({ message: 'Email required' });
        }

        const snapshot = await db.collection('doctors').where('contact.email', '==', email).limit(1).get();

        if (snapshot.empty) {
            return res.status(404).json({ message: 'Doctor not found' });
        }

        const doc = snapshot.docs[0];
        res.json({ id: doc.id, ...doc.data() });
    } catch (error) {
        console.error("Error looking up doctor:", error);
        res.status(500).json({ message: 'Error looking up doctor' });
    }
};

const addDoctor = async (req, res) => {
    try {
        const newDoctor = req.body;
        // Basic validation
        if (!newDoctor.name || !newDoctor.specialty) {
            return res.status(400).json({ message: 'Name and Specialty are required' });
        }

        // Add to Firestore
        const docRef = await db.collection('doctors').add(newDoctor);

        // Return the new object with its ID
        res.status(201).json({ id: docRef.id, ...newDoctor });
    } catch (error) {
        console.error("Error adding doctor:", error);
        res.status(500).json({ message: 'Error adding doctor' });
    }
};

const updateDoctor = async (req, res) => {
    try {
        const id = req.params.id;
        const updates = req.body;

        const docRef = db.collection('doctors').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            // Check legacy ID
            const snapshot = await db.collection('doctors').where('id', '==', parseInt(id)).limit(1).get();
            if (!snapshot.empty) {
                await snapshot.docs[0].ref.update(updates);
                return res.json({ id: parseInt(id), ...updates });
            }
            return res.status(404).json({ message: 'Doctor not found' });
        }

        await docRef.update(updates);
        res.json({ id, ...updates });
    } catch (error) {
        console.error("Error updating doctor:", error);
        res.status(500).json({ message: 'Error updating doctor' });
    }
};

const deleteDoctor = async (req, res) => {
    try {
        const id = req.params.id;
        const docRef = db.collection('doctors').doc(id);
        const doc = await docRef.get();

        if (!doc.exists) {
            // Check legacy ID
            const snapshot = await db.collection('doctors').where('id', '==', parseInt(id)).limit(1).get();
            if (!snapshot.empty) {
                await snapshot.docs[0].ref.delete();
                return res.json({ message: 'Doctor deleted' });
            }
            return res.status(404).json({ message: 'Doctor not found' });
        }

        await docRef.delete();
        res.json({ message: 'Doctor deleted' });
    } catch (error) {
        console.error("Error deleting doctor:", error);
        res.status(500).json({ message: 'Error deleting doctor' });
    }
};

module.exports = {
    getDoctors,
    getDoctorById,
    addDoctor,
    updateDoctor,
    deleteDoctor,
    lookupDoctorByEmail
};
