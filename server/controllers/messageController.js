const { getMessages, createMessage } = require('../services/database');

const getConversation = async (req, res) => {
    try {
        const { contactId } = req.query;
        // If specialist requests, they usually need a contactId (patientId)
        // If patient requests, they see their own messages with specialist

        const messages = await getMessages(contactId);
        res.json(messages);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching messages' });
    }
};

const sendMessage = async (req, res) => {
    try {
        const { senderId, receiverId, text, senderName } = req.body;

        if (!senderId || !receiverId || !text) {
            return res.status(400).json({ message: 'Missing fields' });
        }

        const newMessage = await createMessage({
            senderId,
            receiverId,
            text,
            senderName,
            timestamp: new Date().toISOString(),
            read: false
        });

        res.status(201).json(newMessage);
    } catch (error) {
        res.status(500).json({ message: 'Error sending message' });
    }
};

module.exports = {
    getConversation,
    sendMessage
};
