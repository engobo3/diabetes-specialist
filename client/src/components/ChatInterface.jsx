import React, { useState, useEffect, useRef } from 'react';
import { auth } from '../firebase'; // Direct import for robust auth

const ChatInterface = ({ currentUser, contactId, contactName, isSpecialist = false, customSenderId, customSenderName }) => {
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const [loading, setLoading] = useState(true);
    const [isSending, setIsSending] = useState(false);
    const [error, setError] = useState(null);
    const messagesEndRef = useRef(null);
    const version = "v2.0"; // Messaging system v2.0 - Fixed bidirectional conversations

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    const fetchMessages = async () => {
        // Robust Auth Check: Use global auth object if prop fails
        const safeUser = auth.currentUser || currentUser;

        if (!safeUser) return;

        try {
            setError(null);
            const token = await safeUser.getIdToken();

            // Use props for IDs if available (important for Doctor ID 99 vs Auth ID)
            const myId = customSenderId || (currentUser?.publicId) || safeUser.uid;

            // Always pass contactId to get the conversation between these two participants
            const targetId = contactId;

            if (!targetId) {
                setError('Invalid conversation - no contact ID provided');
                setLoading(false);
                return;
            }

            // Pass senderId when using custom ID (doctor app ID vs Firebase UID)
            const senderParam = myId !== safeUser.uid ? `&senderId=${myId}` : '';
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/messages?contactId=${targetId}${senderParam}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || "Failed to fetch");
            }
            const data = await res.json();
            setMessages(data);
            setLoading(false);
        } catch (err) {
            console.error("Error fetching messages", err);
            setError(err.message || "Failed to load messages");
            setLoading(false);
        }
    };

    useEffect(() => {
        const interval = setInterval(fetchMessages, 5000);
        fetchMessages(); // Initial fetch
        return () => clearInterval(interval);
    }, [contactId, currentUser, isSpecialist, customSenderId]);

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!newMessage.trim()) return;

        const safeUser = auth.currentUser || currentUser;
        if (!safeUser) {
            setError("Session expiée. Rechargez la page.");
            return;
        }

        if (!contactId) {
            setError("Invalid conversation - no contact ID provided");
            return;
        }

        setIsSending(true);
        setError(null);

        try {
            const token = await safeUser.getIdToken();

            const myId = customSenderId || (currentUser?.publicId) || safeUser.uid;
            const senderId = myId;
            const receiverId = contactId;
            const senderName = customSenderName || (isSpecialist ? (currentUser?.displayName || 'Dr. Specialist') : (safeUser.displayName || safeUser.email));

            // Validate before sending
            if (!senderId || !receiverId) {
                throw new Error("Invalid sender or receiver ID");
            }

            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    senderId,
                    receiverId,
                    text: newMessage,
                    senderName
                })
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.message || errorData.error || `${res.status} ${res.statusText}`);
            }

            setNewMessage('');
            // Refresh messages immediately after sending
            setTimeout(fetchMessages, 300);
        } catch (err) {
            console.error("Error sending message", err);
            setError(`Erreur: ${err.message}`);
        } finally {
            setIsSending(false);
        }
    };

    return (
        <div className="flex flex-col h-[500px] bg-white rounded-lg shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200 bg-gray-50 rounded-t-lg flex justify-between items-center">
                <h3 className="font-semibold text-gray-800">Conversation avec {contactName}</h3>
                <span className="text-xs text-gray-300">{version}</span>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loading ? (
                    <div className="text-center text-gray-500">Chargement...</div>
                ) : messages.length === 0 ? (
                    <div className="text-center text-gray-400 mt-10">Aucun message. Commencez la discussion!</div>
                ) : (
                    messages.map((msg) => {
                        const safeUser = auth.currentUser || currentUser;
                        const myId = customSenderId || (currentUser?.publicId) || safeUser?.uid;
                        const isMe = String(msg.senderId) == String(myId);

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

            <div className="bg-white rounded-b-lg">
                {error && (
                    <div className="px-4 py-2 text-xs text-red-600 bg-red-50 border-t border-red-100">
                        {error}
                    </div>
                )}
                <form onSubmit={handleSend} className="p-4 border-t border-gray-200">
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newMessage}
                            onChange={(e) => setNewMessage(e.target.value)}
                            placeholder="Écrivez votre message..."
                            disabled={isSending}
                            className="flex-1 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                        />
                        <button
                            type="submit"
                            disabled={!newMessage.trim() || isSending}
                            className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                        >
                            {isSending ? 'Envoi...' : 'Envoyer'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ChatInterface;
