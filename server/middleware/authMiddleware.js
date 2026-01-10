const admin = require('firebase-admin');

const verifyToken = async (req, res, next) => {
    // Check for Authorization header
    const bearerHeader = req.headers['authorization'];

    if (typeof bearerHeader !== 'undefined') {
        const bearer = bearerHeader.split(' ');
        const bearerToken = bearer[1];

        try {
            const decodedToken = await admin.auth().verifyIdToken(bearerToken);
            req.user = decodedToken;
            next();
        } catch (error) {
            console.error('Error verifying token:', error);
            res.status(403).json({ message: 'Forbidden: Invalid Token' });
        }
    } else {
        // Just continue for now to avoid breaking existing local dev flow if frontend doesn't send token yet
        // In production, this should return 403
        // res.status(403).json({ message: 'Forbidden: No Token Provided' });
        console.warn('WARNING: No token provided. Proceeding unauthenticated (Development Mode).');
        next();
    }
};

module.exports = verifyToken;
