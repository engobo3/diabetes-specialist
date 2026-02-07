const { getPatients } = require('./services/database');

async function debugPatients() {
    try {
        console.log("Fetching all patients...");
        const patients = await getPatients();
        console.log(`Found ${patients.length} patients.`);

        const bertol = patients.find(p => p.name.toLowerCase().includes('bertol'));
        if (bertol) {
            console.log("Found Bertol:", JSON.stringify(bertol, null, 2));
        } else {
            console.log("Patient 'Bertol' NOT found.");
        }

        console.log("Patients for Doctor 99:", patients.filter(p => String(p.doctorId) === '99').map(p => p.name));
    } catch (e) {
        console.error(e);
    }
}

debugPatients();
