const express = require('express');
const router = express.Router();
const { db } = require('../config/firebase');
const verifyToken = require('../middleware/authMiddleware');

// GET /api/users/me - Get current user's profile and role
router.get('/me', verifyToken, async (req, res) => {
    try {
        const uid = req.user.uid;
        const userDoc = await db.collection('users').doc(uid).get();

        if (!userDoc.exists) {
            return res.status(404).json({ message: 'User profile not found' });
        }

        res.json({ id: userDoc.id, ...userDoc.data() });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ message: 'Error fetching user profile' });
    }
});

module.exports = router;
