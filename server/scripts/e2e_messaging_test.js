const { db } = require('../config/firebaseConfig');
const { saveMessage, getConversation } = require('../services/database');

/**
 * End-to-End Messaging Test Script
 * Tests the complete messaging flow between a doctor and patient
 */

const runE2ETests = async () => {
    console.log('\n🧪 Starting End-to-End Messaging Tests...\n');
    
    const tests = [];
    let passCount = 0;
    let failCount = 0;

    // Helper function to run tests
    const runTest = async (name, testFn) => {
        try {
            console.log(`▶️  Running: ${name}`);
            await testFn();
            console.log(`✅ PASSED: ${name}\n`);
            passCount++;
        } catch (error) {
            console.log(`❌ FAILED: ${name}`);
            console.log(`   Error: ${error.message}\n`);
            failCount++;
        }
    };

    // Test 1: Create a message from doctor to patient
    await runTest('Doctor sends message to patient', async () => {
        const doctorId = 99; // Dr. Kensese
        const patientId = 'test-patient-001';
        
        const message = await saveMessage({
            senderId: doctorId,
            receiverId: patientId,
            text: 'Hello! How are you feeling today?',
            senderName: 'Dr. Joseph Kensese',
            timestamp: new Date().toISOString(),
            read: false
        });

        if (!message || !message.id) {
            throw new Error('Message was not created');
        }
        
        console.log(`   Message ID: ${message.id}`);
        console.log(`   From: ${message.senderName} (${doctorId})`);
        console.log(`   To: ${patientId}`);
    });

    // Test 2: Patient replies to doctor
    await runTest('Patient replies to doctor', async () => {
        const doctorId = 99;
        const patientId = 'test-patient-001';
        
        const message = await saveMessage({
            senderId: patientId,
            receiverId: doctorId,
            text: "I'm doing well, but I've had a slight fever today",
            senderName: 'John Doe',
            timestamp: new Date().toISOString(),
            read: false
        });

        if (!message || !message.id) {
            throw new Error('Reply message was not created');
        }
        
        console.log(`   Message ID: ${message.id}`);
        console.log(`   From: ${message.senderName} (${patientId})`);
        console.log(`   To: Doctor (${doctorId})`);
    });

    // Test 3: Doctor sends another message
    await runTest('Doctor sends follow-up message', async () => {
        const doctorId = 99;
        const patientId = 'test-patient-001';
        
        const message = await saveMessage({
            senderId: doctorId,
            receiverId: patientId,
            text: 'Please monitor your temperature and take paracetamol as needed.',
            senderName: 'Dr. Joseph Kensese',
            timestamp: new Date().toISOString(),
            read: false
        });

        if (!message || !message.id) {
            throw new Error('Follow-up message was not created');
        }
        
        console.log(`   Message ID: ${message.id}`);
    });

    // Test 4: Retrieve conversation between doctor and patient
    await runTest('Fetch conversation between doctor and patient', async () => {
        const doctorId = 99;
        const patientId = 'test-patient-001';
        
        const conversation = await getConversation(doctorId, patientId);

        if (!Array.isArray(conversation)) {
            throw new Error('Conversation is not an array');
        }

        if (conversation.length < 3) {
            throw new Error(`Expected at least 3 messages, got ${conversation.length}`);
        }

        console.log(`   Total messages: ${conversation.length}`);
        conversation.forEach((msg, idx) => {
            console.log(`   [${idx + 1}] ${msg.senderName}: "${msg.text.substring(0, 50)}..."`);
        });
    });

    // Test 5: Verify message ordering
    await runTest('Verify messages are ordered by timestamp', async () => {
        const doctorId = 99;
        const patientId = 'test-patient-001';
        
        const conversation = await getConversation(doctorId, patientId);

        for (let i = 0; i < conversation.length - 1; i++) {
            const current = new Date(conversation[i].timestamp);
            const next = new Date(conversation[i + 1].timestamp);
            
            if (current.getTime() > next.getTime()) {
                throw new Error(`Messages not in chronological order at index ${i}`);
            }
        }
        
        console.log(`   ✓ All ${conversation.length} messages are in correct order`);
    });

    // Test 6: Verify bidirectional filtering works
    await runTest('Bidirectional filtering works correctly', async () => {
        const doctorId = 99;
        const patientId = 'test-patient-001';
        
        // Get conversation from doctor's perspective
        const doctorConversation = await getConversation(doctorId, patientId);
        
        // Get conversation from patient's perspective
        const patientConversation = await getConversation(patientId, doctorId);

        if (doctorConversation.length !== patientConversation.length) {
            throw new Error(
                `Bidirectional filtering failed: Doctor sees ${doctorConversation.length}, Patient sees ${patientConversation.length}`
            );
        }
        
        console.log(`   ✓ Both participants see ${doctorConversation.length} messages`);
        console.log(`   ✓ Bidirectional filtering works correctly`);
    });

    // Test 7: Create conversation with a different patient
    await runTest('Create separate conversation with another patient', async () => {
        const doctorId = 99;
        const patient2Id = 'test-patient-002';
        
        const message = await saveMessage({
            senderId: doctorId,
            receiverId: patient2Id,
            text: 'Hello patient 2, how are you?',
            senderName: 'Dr. Joseph Kensese',
            timestamp: new Date().toISOString(),
            read: false
        });

        if (!message || !message.id) {
            throw new Error('Message to patient 2 was not created');
        }
        
        console.log(`   Message created for Patient 2`);
    });

    // Test 8: Verify message isolation between conversations
    await runTest('Messages are isolated between different conversations', async () => {
        const doctorId = 99;
        const patient1Id = 'test-patient-001';
        const patient2Id = 'test-patient-002';
        
        const conversation1 = await getConversation(doctorId, patient1Id);
        const conversation2 = await getConversation(doctorId, patient2Id);

        // Check that messages don't leak between conversations
        const patient2InConv1 = conversation1.some(m => 
            String(m.receiverId) === patient2Id || String(m.senderId) === patient2Id
        );
        
        if (patient2InConv1) {
            throw new Error('Message isolation failed: Patient 2 messages found in Patient 1 conversation');
        }
        
        console.log(`   ✓ Patient 1 conversation: ${conversation1.length} messages`);
        console.log(`   ✓ Patient 2 conversation: ${conversation2.length} messages`);
        console.log(`   ✓ Messages are properly isolated`);
    });

    // Test 9: Handle edge case with numeric and string IDs
    await runTest('Handle mixed numeric and string IDs', async () => {
        const doctorId = 99; // Numeric
        const patientId = 'uid-with-special-chars-123'; // String
        
        const message = await saveMessage({
            senderId: doctorId,
            receiverId: patientId,
            text: 'Testing mixed ID types',
            senderName: 'Dr. Joseph Kensese',
            timestamp: new Date().toISOString(),
            read: false
        });

        const conversation = await getConversation(doctorId, patientId);

        if (conversation.length === 0) {
            throw new Error('Failed to retrieve messages with mixed ID types');
        }
        
        console.log(`   ✓ Successfully handled numeric ID (${doctorId}) and string ID (${patientId})`);
    });

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 Test Summary');
    console.log('='.repeat(60));
    console.log(`✅ Passed: ${passCount}`);
    console.log(`❌ Failed: ${failCount}`);
    console.log(`📈 Total:  ${passCount + failCount}`);
    console.log('='.repeat(60) + '\n');

    if (failCount === 0) {
        console.log('🎉 All end-to-end tests PASSED! The messaging system is working correctly.\n');
        return true;
    } else {
        console.log('⚠️  Some tests failed. Please review the errors above.\n');
        return false;
    }
};

// Run the tests
runE2ETests()
    .then(success => {
        process.exit(success ? 0 : 1);
    })
    .catch(error => {
        console.error('Unexpected error:', error);
        process.exit(1);
    });
