const { db } = require('../config/firebaseConfig');

const checkRecentMessages = async () => {
    console.log("Checking last 5 messages...");
    try {
        const snapshot = await db.collection('messages')
            .orderBy('timestamp', 'desc')
            .limit(5)
            .get();

        if (snapshot.empty) {
            console.log("No messages found.");
        } else {
            snapshot.forEach(doc => {
                const data = doc.data();
                console.log(`[${doc.id}] ${data.timestamp} - From: ${data.senderId} To: ${data.receiverId} | "${data.text}"`);
            });
        }
        process.exit(0);
    } catch (e) {
        console.error("Error:", e);
        process.exit(1);
    }
};

checkRecentMessages();
