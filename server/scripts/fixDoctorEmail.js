const { db } = require('../config/firebaseConfig');

const fixDoctor = async () => {
    console.log("Fixing Doctor ID 99...");
    try {
        await db.collection('doctors').doc('99').set({
            email: 'kensesebertol@yahoo.fr',
            name: 'Dr. Joseph Kensese',
            id: 99,
            role: 'admin',
            specialty: 'Chief of Medicine',
            bio: 'Specialist in Diabetes Management and Endocrinology.',
            image: "https://randomuser.me/api/portraits/men/1.jpg"
        }, { merge: true });

        console.log("✅ Successfully updated Doctor 99 email to 'kensesebertol@yahoo.fr'");
        process.exit(0);
    } catch (error) {
        console.error("Error updating doctor:", error);
        process.exit(1);
    }
};

fixDoctor();
