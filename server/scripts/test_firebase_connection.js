const { db } = require('../config/firebaseConfig');

async function testConnection() {
    try {
        if (!db) {
            console.error('Firebase DB instance is undefined. Initialization likely failed.');
            process.exit(1);
        }

        console.log('Attempting to list collections to verify connection...');
        const collections = await db.listCollections();
        console.log('Connected successfully! Collections found:');
        collections.forEach(collection => {
            console.log('-', collection.id);
        });
        process.exit(0);
    } catch (error) {
        console.error('Failed to connect to Firestore:', error);
        process.exit(1);
    }
}

testConnection();
