const { createPatient } = require('./services/database');

async function testValidation() {
    console.log("Testing Invalid Patient Creation...");
    try {
        await createPatient({
            // Missing name, which is required
            age: 25,
            email: "invalid@test.com"
        });
        console.error("FAIL: Schema validation should have thrown an error but didn't.");
    } catch (e) {
        console.log("SUCCESS: Schema validation correctly rejected invalid data.");
        console.log("Error message:", e.message);
    }

    console.log("\nTesting Valid Patient Creation...");
    try {
        const result = await createPatient({
            name: "Valid Test Patient",
            age: 30,
            email: "valid@test.com"
        });
        console.log("SUCCESS: Created patient with ID:", result.id);
    } catch (e) {
        console.error("FAIL: Schema validation rejected valid data:", e);
    }
}

testValidation();
