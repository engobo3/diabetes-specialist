import React, { useState, useRef, useEffect, useMemo } from 'react';
import { MessageSquare, Send, X, Bot, User, Loader, RotateCcw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getTranslations } from '../translations';
import Button from './ui/Button';

const AiAssistant = ({ patient, vitals, prescriptions }) => {
    const { lang } = useLanguage();
    const t = getTranslations('aiAssistant', lang);

    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'assistant', text: t.greeting }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const { currentUser } = useAuth();

    // Reset greeting when language changes
    useEffect(() => {
        setMessages([{ role: 'assistant', text: t.greeting }]);
    }, [lang]);

    // Build patient context from props
    const patientContext = useMemo(() => {
        if (!patient) return null;

        const readings = vitals?.readings || [];

        // Last 5 glucose readings (use category || type fallback)
        const recentGlucose = readings
            .filter(v => (v.category || v.type) === 'Glucose' || (!v.category && !v.type))
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5)
            .map(v => ({ date: v.date, value: v.glucose ?? v.value }));

        // Last 3 BP readings
        const recentBP = readings
            .filter(v => (v.category || v.type) === 'Blood Pressure')
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 3)
            .map(v => ({ date: v.date, systolic: v.systolic, diastolic: v.diastolic }));

        // Latest weight
        const weightReadings = readings
            .filter(v => (v.category || v.type) === 'Weight')
            .sort((a, b) => new Date(b.date) - new Date(a.date));
        const latestWeight = weightReadings.length > 0 ? weightReadings[0].value : null;

        // Active medications
        const medications = (prescriptions || []).map(p => ({
            name: p.medication,
            dosage: p.dosage
        }));

        return {
            name: patient.name,
            age: patient.age,
            type: patient.type || patient.diabetesType,
            conditions: patient.conditions || [],
            allergies: patient.allergies || [],
            recentGlucose,
            recentBP,
            medications,
            latestWeight,
        };
    }, [patient, vitals, prescriptions]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSend = async (e) => {
        e.preventDefault();
        if (!input.trim()) return;

        const userMessage = input;
        setInput('');
        const newMessages = [...messages, { role: 'user', text: userMessage }];
        setMessages(newMessages);
        setLoading(true);

        try {
            // Build history (cap at last 10, exclude the greeting)
            const history = newMessages
                .slice(1) // skip initial greeting
                .slice(-10)
                .map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', text: m.text }));

            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/ai/chat`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${await currentUser?.getIdToken()}`
                },
                body: JSON.stringify({
                    message: userMessage,
                    history,
                    patientContext,
                    lang,
                })
            });

            const data = await response.json();

            if (data.reply) {
                setMessages(prev => [...prev, { role: 'assistant', text: data.reply }]);
            } else {
                throw new Error("No reply received");
            }
        } catch (error) {
            console.error("Chat error:", error);
            setMessages(prev => [...prev, { role: 'assistant', text: t.errorMessage }]);
        } finally {
            setLoading(false);
        }
    };

    const clearChat = () => {
        setMessages([{ role: 'assistant', text: t.greeting }]);
    };

    return (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-50 flex flex-col items-end">
            {/* Chat Window */}
            {isOpen && (
                <div className="bg-white rounded-2xl shadow-2xl border border-gray-200 w-[calc(100vw-2rem)] sm:w-96 h-[calc(100vh-120px)] sm:h-[500px] flex flex-col mb-4 overflow-hidden transition-all duration-200 ease-in-out">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-primary to-blue-600 p-4 flex justify-between items-center text-white">
                        <div className="flex items-center gap-2">
                            <div className="bg-white/20 p-2 rounded-full">
                                <Bot size={20} className="text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">GlucoBot</h3>
                                <div className="flex items-center gap-1">
                                    <span className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                                    <span className="text-xs opacity-90">{t.online}</span>
                                </div>
                            </div>
                        </div>
                        <div className="flex items-center gap-1">
                            <button
                                onClick={clearChat}
                                className="text-white/80 hover:text-white hover:bg-white/10 p-1.5 rounded-full transition-colors"
                                title={t.clearChat}
                            >
                                <RotateCcw size={16} />
                            </button>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="text-white/80 hover:text-white hover:bg-white/10 p-1 rounded-full transition-colors"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Messages Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
                        {messages.map((msg, index) => (
                            <div
                                key={index}
                                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                            >
                                <div
                                    className={`max-w-[85%] sm:max-w-[80%] rounded-2xl px-4 py-3 text-sm shadow-sm break-words ${msg.role === 'user'
                                            ? 'bg-primary text-white rounded-br-none'
                                            : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                                        }`}
                                >
                                    {msg.text}
                                </div>
                            </div>
                        ))}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-white rounded-2xl rounded-bl-none px-4 py-3 border border-gray-100 shadow-sm flex items-center gap-1">
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                                    <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                                </div>
                            </div>
                        )}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <form onSubmit={handleSend} className="p-3 sm:p-4 bg-white border-t border-gray-100">
                        <div className="relative">
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder={t.placeholder}
                                className="w-full pr-12 pl-4 py-3 bg-gray-100 border-none rounded-full focus:ring-2 focus:ring-primary/20 text-sm focus:bg-white transition-colors"
                            />
                            <button
                                type="submit"
                                disabled={!input.trim() || loading}
                                className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-primary text-white rounded-full hover:bg-blue-700 disabled:opacity-50 disabled:hover:bg-primary transition-colors shadow-sm"
                            >
                                <Send size={16} />
                            </button>
                        </div>
                        <div className="text-center mt-2">
                            <span className="text-[10px] text-gray-400">
                                {t.disclaimer}
                            </span>
                        </div>
                    </form>
                </div>
            )}

            {/* Toggle Button */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`${isOpen ? 'scale-0' : 'scale-100'} transition-transform duration-200 bg-gradient-to-r from-primary to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white p-4 rounded-full shadow-lg hover:shadow-xl flex items-center gap-2 group`}
            >
                <Bot size={28} className="group-hover:rotate-12 transition-transform" />
                <span className="font-semibold pr-2 hidden group-hover:block transition-all duration-300">GlucoBot</span>
            </button>
        </div>
    );
};

export default AiAssistant;
