const { db } = require('../config/firebase');
const { validateDoctor } = require('../utils/validation');
const { getAppointments } = require('../services/database');
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
        try {
            await seedDoctorsIfNeeded(); // Ensure data exists
            const snapshot = await db.collection('doctors').get();
            const doctors = [];
            snapshot.forEach(doc => {
                doctors.push({ id: doc.id, ...doc.data() });
            });
            res.json(doctors);
        } catch (dbError) {
            console.warn("DB access failed, falling back to local file:", dbError.message);
            const data = fs.readFileSync(dataPath, 'utf8');
            const doctors = JSON.parse(data);
            res.json(doctors);
        }
    } catch (error) {
        console.error("Error getting doctors:", error);
        res.status(500).json({ message: 'Error retrieving doctors' });
    }
};

const getDoctorById = async (req, res) => {
    try {
        const id = req.params.id;
        try {
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
        } catch (dbError) {
            console.warn("DB access failed, falling back to local file:", dbError.message);
            const data = fs.readFileSync(dataPath, 'utf8');
            const doctors = JSON.parse(data);
            const doctor = doctors.find(d => d.id.toString() === id || d.id === parseInt(id));
            if (doctor) {
                res.json(doctor);
            } else {
                res.status(404).json({ message: 'Doctor not found' });
            }
        }
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

        const { isValid, error } = validateDoctor(newDoctor);
        if (!isValid) {
            return res.status(400).json({ message: error });
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

        // Note: For updates, ideally we merge and validate.
        if (Object.keys(updates).length > 0) {
            // We can't easily validate partial updates against the full schema without fetching first.
            // But let's check if the fields provided are at least superficially valid if they are schema fields.
            // Or, we can choose to only validate on creation for simplicity, or fetch-merge-validate.
            // Let's do fetch-merge-validate for robustness.

            let existingDoc = null;
            const docRef = db.collection('doctors').doc(id);
            const docShot = await docRef.get();

            if (docShot.exists) {
                existingDoc = docShot.data();
            } else {
                // Check legacy
                const snapshot = await db.collection('doctors').where('id', '==', parseInt(id)).limit(1).get();
                if (!snapshot.empty) {
                    existingDoc = snapshot.docs[0].data();
                }
            }

            if (existingDoc) {
                const merged = { ...existingDoc, ...updates };
                const { isValid, error } = validateDoctor(merged);
                if (!isValid) {
                    return res.status(400).json({ message: error });
                }
            }
        }

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

const getAvailableSlots = async (req, res) => {
    try {
        const doctorId = req.params.id;
        const { date } = req.query;

        if (!date) {
            return res.status(400).json({ message: 'Date query parameter is required (YYYY-MM-DD)' });
        }

        // Fetch doctor to get availability + slotDuration
        let doctorData = null;
        const docRef = db.collection('doctors').doc(doctorId);
        const docShot = await docRef.get();

        if (docShot.exists) {
            doctorData = docShot.data();
        } else {
            // Legacy fallback
            const snapshot = await db.collection('doctors').where('id', '==', parseInt(doctorId)).limit(1).get();
            if (!snapshot.empty) {
                doctorData = snapshot.docs[0].data();
            }
        }

        if (!doctorData) {
            return res.status(404).json({ message: 'Doctor not found' });
        }

        const availability = doctorData.availability || {};
        const slotDuration = doctorData.slotDuration || 30;

        // Determine day-of-week from date
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
        const dateObj = new Date(date + 'T00:00:00');
        const dayOfWeek = dayNames[dateObj.getDay()];

        const dayRanges = availability[dayOfWeek];
        if (!dayRanges || dayRanges.length === 0) {
            return res.json({ slots: [], slotDuration, date, message: 'Médecin non disponible ce jour' });
        }

        // Generate all possible slots from time ranges
        const allSlots = [];
        for (const range of dayRanges) {
            const [startH, startM] = range.start.split(':').map(Number);
            const [endH, endM] = range.end.split(':').map(Number);
            let currentMinutes = startH * 60 + startM;
            const endMinutes = endH * 60 + endM;

            while (currentMinutes + slotDuration <= endMinutes) {
                const h = String(Math.floor(currentMinutes / 60)).padStart(2, '0');
                const m = String(currentMinutes % 60).padStart(2, '0');
                allSlots.push(`${h}:${m}`);
                currentMinutes += slotDuration;
            }
        }

        // Fetch existing appointments for this doctor on this date
        const appointments = await getAppointments(doctorId);
        const activeStatuses = ['pending', 'confirmed', 'Scheduled'];
        const bookedTimes = appointments
            .filter(a => a.date === date && activeStatuses.includes(a.status))
            .map(a => a.time);

        // Filter out booked slots
        const availableSlots = allSlots.filter(slot => !bookedTimes.includes(slot));

        res.json({ slots: availableSlots, slotDuration, date });
    } catch (error) {
        console.error('Error getting available slots:', error);
        res.status(500).json({ message: 'Error retrieving available slots' });
    }
};

module.exports = {
    getDoctors,
    getDoctorById,
    addDoctor,
    updateDoctor,
    deleteDoctor,
    lookupDoctorByEmail,
    getAvailableSlots
};
