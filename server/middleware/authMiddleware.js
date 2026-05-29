const admin = require('firebase-admin');
const userService = require('../services/userService');

/**
 * Verify the Firebase ID token in the Authorization header and enrich
 * req.user with role + profile foreign keys.
 *
 * Phase 2 change: the enrichment lookup now goes through userService, which
 * tries Postgres first and falls back to Firestore. The req.user shape is
 * unchanged for downstream middleware/controllers — `role`, `patientId`,
 * `doctorId` continue to be the read keys. We additionally set
 * `req.user.userId` (the Postgres uuid, may be null during the cutover window)
 * and `req.user._userSource` ('postgres' | 'firestore') for observability.
 */
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

        // Enrich req.user with role, patientId, doctorId via userService
        // (Postgres-first, Firestore-fallback). Non-fatal on failure.
        try {
            const userRecord = await userService.lookupUserByFirebaseUid(decodedToken.uid);
            if (userRecord) {
                req.user.role = userRecord.role;
                req.user.patientId = userRecord.patientId;
                req.user.doctorId = userRecord.doctorId;
                req.user.userId = userRecord.id;                  // Postgres uuid, may be null during cutover
                req.user.preferredLanguage = userRecord.preferredLanguage;
                req.user.regionId = userRecord.regionId;
                req.user._userSource = userRecord.source;          // 'postgres' | 'firestore' — observability
            }
        } catch (enrichError) {
            // Non-fatal: proceed with base token data if enrichment fails
            console.warn('Could not enrich user token with role data:', enrichError.message);
        }

        next();
    } catch (error) {
        console.error('Token verification failed:', error.message);
        res.status(403).json({ message: 'Forbidden: Invalid Token' });
    }
};

module.exports = verifyToken;
