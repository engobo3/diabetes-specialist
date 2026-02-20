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
        next();
    } catch (error) {
        console.error('Token verification failed');
        res.status(403).json({ message: 'Forbidden: Invalid Token' });
    }
};

module.exports = verifyToken;
