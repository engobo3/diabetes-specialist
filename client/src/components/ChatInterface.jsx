import React, { useState, useEffect, useRef } from 'react';

const ChatInterface = ({ currentUser, contactId, contactName, isSpecialist = false }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const fetchMessages = async () => {
        try {
            const token = await currentUser.getIdToken();
            const url = isSpecialist
                ? `${import.meta.env.VITE_API_URL}/api/messages?contactId=${contactId}`
                : `${import.meta.env.VITE_API_URL}/api/messages?contactId=${currentUser.uid}`;

            // Note: For patients, we might want to just fetch all their messages.
            // But logic above:
            // If specialist: fetches conversation with specific patient (contactId).
            // If patient: fetches their own conversation (with specialist). 
            // Ideally backend filters by user context. 
            // Let's simplified: Pass contactId as the "other person"

            // Revised logic:
            // We want to fetch messages where sender OR receiver is the current user AND the other party.
            // For simplicity in this JSON MV, getMessages(contactId) filters by ANY match of contactId.
            // So for Patient, passing their OWN ID is enough to get their thread.
            // For Specialist, passing PATIENT ID is enough to get that thread.

            // So effectively, we always pass the Patient ID as the 'contactId' filter for this simple backend.
            const targetId = isSpecialist ? contactId : currentUser.uid;

            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/messages?contactId=${targetId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            setMessages(data);
            setLoading(false);
        } catch (err) {
            console.error("Error fetching messages", err);
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages();
        const interval = setInterval(fetchMessages, 5000); // Polling every 5s
        return () => clearInterval(interval);
    }, [contactId, currentUser, isSpecialist]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        try {
            const token = await currentUser.getIdToken();
            const senderId = currentUser.uid;
            // If patient, receiver is 'SPECIALIST' (generic) or a specific ID. Let's use 'SPECIALIST'.
            // If specialist, receiver is contactId (the patient).
            const receiverId = isSpecialist ? contactId : 'SPECIALIST';

            await fetch(`${import.meta.env.VITE_API_URL}/api/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    senderId,
                    receiverId,
                    text: newMessage,
                    senderName: isSpecialist ? 'Dr. Specialist' : currentUser.email // conducting simplified name
                })
            });

            setNewMessage('');
            fetchMessages();
        } catch (err) {
            console.error("Error sending message", err);
        }
    };

    return (
        <div className="flex flex-col h-[500px] bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg">
                <h3 className="font-semibold text-gray-800">Conversation avec {contactName}</h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading ? (
                    <div className="text-center text-gray-500">Chargement...</div>
                ) : messages.length === 0 ? (
                    <div className="text-center text-gray-400 mt-10">Aucun message. Commencez la discussion!</div>
                ) : (
                    messages.map((msg) => {
                        const isMe = msg.senderId === currentUser.uid;
                        return (
                            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                                <div className={`max-w-[70%] rounded-lg p-3 ${isMe ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'
                                    }`}>
                                    <p className="text-sm">{msg.text}</p>
                                    <span className={`text-xs block mt-1 ${isMe ? 'text-blue-100' : 'text-gray-400'}`}>
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </div>
                        );
                    })
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="p-4 border-t border-gray-200 bg-white rounded-b-lg">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder="Écrivez votre message..."
                        className="flex-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        type="submit"
                        disabled={!newMessage.trim()}
                        className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Envoyer
                    </button>
                </div>
            </form>
        </div>
    );
};

export default ChatInterface;
