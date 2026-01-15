const { db } = require('../config/firebaseConfig');
const { createMessage, getMessages } = require('../services/database');

const testMessaging = async () => {
    console.log("--- Testing Messaging ---");
    try {
        // 1. Send Message
        const msg = {
            senderId: 99, // Dr. Kensese
            receiverId: 'pUkZ7yGsBvxKegGuAEET', // Bertol (from previous check)
            text: "Hello Bertol, this is a test message from the backend script.",
            senderName: "Dr. Joseph Kensese",
            timestamp: new Date().toISOString()
        };

        console.log("Sending message...", msg);
        // Note: verify if createMessage expects timestamp or adds it
        // The Service usually adds timestamp if missing, let's see.
        // But for Firestore, serverTimestamp is better.
        // Assuming createMessage handles it or just saves raw.

        const res = await db.collection('messages').add({
            ...msg,
            timestamp: new Date()
        });
        console.log(`Message Sent! ID: ${res.id}`);

        // 2. Retrieve Messages for Bertol
        console.log("\nRetrieving messages for Bertol (pUkZ7yGsBvxKegGuAEET)...");
        // We need to simulate the query used by the API
        // The API calls getMessages(contactId)
        // But wait, the API calls getMessages with 'contactId' which is the CURRENT USER ID usually?
        // No, look at controller.

        // Let's just query raw firestore to see if it's there
        const snapshot = await db.collection('messages')
            .where('senderId', '==', 99)
            .where('receiverId', '==', 'pUkZ7yGsBvxKegGuAEET')
            .get();

        if (snapshot.empty) {
            console.log("❌ No messages found matching the query.");
        } else {
            console.log(`✅ Found ${snapshot.size} messages.`);
            snapshot.forEach(doc => console.log(` - [${doc.id}] ${doc.data().text}`));
        }

    } catch (e) {
        console.error("Test Failed:", e);
    }
    process.exit(0);
};

testMessaging();
