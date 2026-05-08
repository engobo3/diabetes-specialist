const admin = require('firebase-admin');

const verifyToken = async (req, res, next) => {
    const bearerHeader = req.headers['authorization'];

    if (!bearerHeader || typeof bearerHeader !== 'string') {
        return res.status(403).json({ message: 'Forbidden: No Token Provided' });
    }

    // Expect format: "Bearer <token>"
    const parts = bearerHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer' || !parts[1]) {
        return res.status(403).json({ message: 'Forbidden: Malformed Authorization Header' });
    }

    const token = parts[1];

    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        req.user = decodedToken;

        // Enrich req.user with role, patientId, doctorId from Firestore
        try {
            const { db } = require('../config/firebaseConfig');
            if (db) {
                const userDoc = await db.collection('users').doc(decodedToken.uid).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    req.user.role = userData.role || null;
                    req.user.patientId = userData.patientId || null;
                    req.user.doctorId = userData.doctorId || null;
                }
            }
        } catch (enrichError) {
            // Non-fatal: proceed with base token data if Firestore lookup fails
            console.warn('Could not enrich user token with role data:', enrichError.message);
        }

        next();
    } catch (error) {
        console.error('Token verification failed:', error.message);
        res.status(403).json({ message: 'Forbidden: Invalid Token' });
    }
};

module.exports = verifyToken;
