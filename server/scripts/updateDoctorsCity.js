const fs = require('fs');
const path = require('path');

const doctorsPath = path.join(__dirname, '../data/doctors.json');

try {
    const rawData = fs.readFileSync(doctorsPath);
    let doctors = JSON.parse(rawData);

    // Update all doctors to be in Kinshasa
    doctors = doctors.map(doc => ({
        ...doc,
        city: 'Kinshasa'
    }));

    fs.writeFileSync(doctorsPath, JSON.stringify(doctors, null, 4));
    console.log(`Updated ${doctors.length} doctors with city: Kinshasa`);

    // Only run Firestore update if we were in a cloud function context, 
    // but here we just update the local JSON for the migration script to pick up later 
    // or for local dev. 
    // Ideally we should also update Firestore directly if possible, but the user uses 
    // 'migrateProd.js' style scripts. 
    // Let's create a script that updates Firestore too.

} catch (err) {
    console.error("Error updating doctors:", err);
}
