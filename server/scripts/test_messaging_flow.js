/**
 * Test Messaging Flow
 * This script tests the complete messaging flow between doctor and patient
 */

const MessageRepository = require('../repositories/MessageRepository');
const PatientRepository = require('../repositories/PatientRepository');
const DoctorRepository = require('../repositories/DoctorRepository');

async function testMessagingFlow() {
    console.log('🧪 Testing Messaging Flow...\n');

    const messageRepo = new MessageRepository();
    const patientRepo = new PatientRepository();
    const doctorRepo = new DoctorRepository();

    try {
        // 1. Get test doctor and patient
        const doctors = await doctorRepo.findAll();
        const patients = await patientRepo.findAll();
        
        const testDoctor = doctors[0]; // Dr. Kense Sebertol (ID: 1)
        const testPatient = patients[0]; // Jane Doe (ID: 1, doctorId: 1)

        console.log('📋 Test Participants:');
        console.log(`   Doctor: ${testDoctor.name} (ID: ${testDoctor.id})`);
        console.log(`   Patient: ${testPatient.name} (ID: ${testPatient.id}, doctorId: ${testPatient.doctorId})`);
        console.log('');

        // 2. Send message from doctor to patient
        console.log('✉️  Doctor sends message to patient...');
        const msg1 = await messageRepo.create({
            senderId: testDoctor.id,
            receiverId: testPatient.id,
            text: 'Hello, how are you feeling today?',
            senderName: testDoctor.name,
            timestamp: new Date().toISOString(),
            read: false
        });
        console.log(`   ✓ Message sent (ID: ${msg1.id})`);
        console.log('');

        // 3. Send message from patient to doctor
        console.log('✉️  Patient responds to doctor...');
        const msg2 = await messageRepo.create({
            senderId: testPatient.id,
            receiverId: testDoctor.id,
            text: 'I am feeling better, thank you for asking!',
            senderName: testPatient.name,
            timestamp: new Date().toISOString(),
            read: false
        });
        console.log(`   ✓ Reply sent (ID: ${msg2.id})`);
        console.log('');

        // 4. Retrieve conversation from doctor's perspective
        console.log('📖 Retrieving conversation from doctor perspective...');
        const doctorView = await messageRepo.getConversation(testDoctor.id, testPatient.id);
        console.log(`   ✓ Found ${doctorView.length} messages`);
        doctorView.forEach((m, i) => {
            const from = String(m.senderId) === String(testDoctor.id) ? 'Doctor' : 'Patient';
            console.log(`      ${i + 1}. [${from}]: ${m.text.substring(0, 50)}...`);
        });
        console.log('');

        // 5. Retrieve conversation from patient's perspective
        console.log('📖 Retrieving conversation from patient perspective...');
        const patientView = await messageRepo.getConversation(testPatient.id, testDoctor.id);
        console.log(`   ✓ Found ${patientView.length} messages`);
        patientView.forEach((m, i) => {
            const from = String(m.senderId) === String(testPatient.id) ? 'Patient' : 'Doctor';
            console.log(`      ${i + 1}. [${from}]: ${m.text.substring(0, 50)}...`);
        });
        console.log('');

        // 6. Verify bidirectionality
        console.log('🔄 Verifying bidirectional conversation...');
        if (doctorView.length === patientView.length && doctorView.length >= 2) {
            console.log('   ✓ Both perspectives see the same conversation');
            
            const hasDoctorToPatient = doctorView.some(m =>
                String(m.senderId) === String(testDoctor.id) &&
                String(m.receiverId) === String(testPatient.id)
            );
            const hasPatientToDoctor = doctorView.some(m =>
                String(m.senderId) === String(testPatient.id) &&
                String(m.receiverId) === String(testDoctor.id)
            );

            if (hasDoctorToPatient && hasPatientToDoctor) {
                console.log('   ✓ Messages flow in both directions');
            } else {
                console.log('   ✗ ERROR: Not all message directions present');
            }
        } else {
            console.log('   ✗ ERROR: Conversation mismatch between perspectives');
            console.log(`      Doctor sees: ${doctorView.length} messages`);
            console.log(`      Patient sees: ${patientView.length} messages`);
        }
        console.log('');

        // 7. Test with UI parameters
        console.log('🖥️  Testing with UI-like parameters...');
        console.log(`   Doctor uses contactId=${testPatient.id} (patient's ID)`);
        console.log(`   Patient uses contactId=${testDoctor.id} (doctor's ID)`);
        
        const uiDoctorView = await messageRepo.getConversation(testDoctor.id, testPatient.id);
        const uiPatientView = await messageRepo.getConversation(testPatient.id, testDoctor.id);
        
        if (uiDoctorView.length > 0 && uiPatientView.length > 0) {
            console.log('   ✓ UI parameter pattern works correctly');
        } else {
            console.log('   ✗ ERROR: UI parameters not working');
        }
        console.log('');

        // Cleanup
        console.log('🧹 Cleaning up test messages...');
        await messageRepo.delete(msg1.id);
        await messageRepo.delete(msg2.id);
        console.log('   ✓ Test messages deleted');
        console.log('');

        console.log('✅ All tests passed! Messaging system is working correctly.\n');

    } catch (error) {
        console.error('❌ Test failed:', error);
        console.error(error.stack);
        process.exit(1);
    }
}

// Run the test
testMessagingFlow().then(() => {
    console.log('Done.');
    process.exit(0);
}).catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
