import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    Send, X, Bot, RotateCcw, Calendar, Activity, Heart, Clock,
    AlertTriangle, FileText, ClipboardList, Pill, Settings
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getTranslations } from '../translations';
import { DEFAULT_VITAL_TYPES } from '../utils/vitalHelpers';

// ─── Action Result Card ─────────────────────────────────────────────
const ACTION_CONFIG = {
    book_appointment: { icon: Calendar, label: 'Rendez-vous reserve', color: 'green' },
    get_available_slots: { icon: Clock, label: 'Creneaux disponibles', color: 'blue' },
    log_vital: { icon: Activity, label: 'Mesure enregistree', color: 'green' },
    get_health_summary: { icon: Heart, label: 'Resume sante', color: 'blue' },
    check_medications: { icon: Pill, label: 'Medicaments', color: 'blue' },
    log_medication_taken: { icon: Pill, label: 'Prise enregistree', color: 'green' },
    trigger_emergency_alert: { icon: AlertTriangle, label: 'Alerte envoyee', color: 'red' },
    generate_patient_summary: { icon: ClipboardList, label: 'Resume patient', color: 'blue' },
    draft_soap_note: { icon: ClipboardList, label: 'Note SOAP', color: 'blue' },
    draft_prescription: { icon: FileText, label: 'Ordonnance creee', color: 'green' },
    find_empty_slots: { icon: Clock, label: 'Creneaux libres', color: 'blue' },
};

const ActionResultCard = ({ action }) => {
    const config = ACTION_CONFIG[action.tool] || { icon: Bot, label: action.tool, color: 'gray' };
    const Icon = config.icon;
    const success = action.result?.success !== false;

    const colorClasses = {
        green: success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800',
        blue: success ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-red-50 border-red-200 text-red-800',
        red: 'bg-red-50 border-red-200 text-red-800',
        gray: success ? 'bg-gray-50 border-gray-200 text-gray-800' : 'bg-red-50 border-red-200 text-red-800',
    };

    // Build a detail string from the result
    let detail = '';
    const r = action.result || {};
    if (action.tool === 'book_appointment' && success) {
        detail = `${r.date} a ${r.time}${r.doctorName ? ` — Dr. ${r.doctorName}` : ''}`;
    } else if (action.tool === 'get_available_slots' && success) {
        const slots = r.slots || [];
        detail = slots.length > 0
            ? `${slots.length} creneau${slots.length > 1 ? 'x' : ''}: ${slots.slice(0, 5).join(', ')}${slots.length > 5 ? '...' : ''}`
            : 'Aucun creneau disponible';
    } else if (action.tool === 'log_vital' && success) {
        detail = `${r.category}: ${r.value}`;
    } else if (action.tool === 'draft_prescription' && success) {
        detail = `${r.medication} ${r.dosage} — ${r.frequency}`;
    } else if (action.tool === 'trigger_emergency_alert') {
        detail = success ? r.message : r.error;
    } else if (!success) {
        detail = r.error || 'Erreur';
    }

    return (
        <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 mt-1.5 text-xs ${colorClasses[config.color]}`}>
            <Icon size={14} className="mt-0.5 shrink-0" />
            <div className="min-w-0">
                <span className="font-semibold">{config.label}</span>
                {detail && <p className="mt-0.5 opacity-80 truncate">{detail}</p>}
            </div>
        </div>
    );
};

// ─── Quick Action Chips ─────────────────────────────────────────────
const PATIENT_CHIPS = [
    { label: 'Resume sante', message: 'Donne-moi un resume de ma sante' },
    { label: 'Enregistrer glycemie', message: 'Je veux enregistrer ma glycemie' },
    { label: 'Mes medicaments', message: 'Quels sont mes medicaments actuels ?' },
    { label: 'Rendez-vous', message: 'Je voudrais prendre un rendez-vous' },
];

const DOCTOR_CHIPS = [
    { label: 'Resume patient', message: 'Donne-moi un resume de ce patient' },
    { label: 'Creneaux libres', message: 'Quels sont mes creneaux libres demain ?' },
    { label: 'Note SOAP', message: 'Redige une note SOAP pour ce patient' },
];

// ─── Main Component ─────────────────────────────────────────────────
const AiAssistant = ({ patient, vitals, prescriptions, specialtyVitalTypes = DEFAULT_VITAL_TYPES }) => {
    const { lang } = useLanguage();
    const t = getTranslations('aiAssistant', lang);

    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([
        { role: 'assistant', text: t.greeting }
    ]);
    const [input, setInput] = useState('');
    const [loading, setLoading] = useState(false);
    const messagesEndRef = useRef(null);
    const { currentUser, activeRole, patientId, doctorProfile } = useAuth();

    const isDoctor = activeRole === 'doctor' || activeRole === 'admin';
    const chips = isDoctor ? DOCTOR_CHIPS : PATIENT_CHIPS;
    const showChips = messages.length <= 1 && !loading;

    // Reset greeting when language changes
    useEffect(() => {
        setMessages([{ role: 'assistant', text: t.greeting }]);
    }, [lang]);

    // Build patient context from props - driven by specialty config
    const patientContext = useMemo(() => {
        if (!patient) return null;

        const readings = vitals?.readings || [];

        const recentVitals = {};
        for (const vt of specialtyVitalTypes) {
            const filtered = readings
                .filter(v => (v.category || v.type) === vt.key || (!v.category && !v.type && vt.key === 'Glucose'))
                .sort((a, b) => new Date(b.date) - new Date(a.date))
                .slice(0, 5);

            if (vt.chartType === 'dual') {
                recentVitals[vt.key] = filtered.map(v => ({
                    date: v.date,
                    [vt.chartDataKey[0]]: v[vt.chartDataKey[0]],
                    [vt.chartDataKey[1]]: v[vt.chartDataKey[1]]
                }));
            } else {
                recentVitals[vt.key] = filtered.map(v => ({
                    date: v.date,
                    value: v[vt.chartDataKey] ?? v.value
                }));
            }
        }

        const medications = (prescriptions || []).map(p => ({
            name: p.medication,
            dosage: p.dosage
        }));

        return {
            patientId: patient.id || patientId,
            name: patient.name,
            age: patient.age,
            type: patient.type || patient.diabetesType,
            conditions: patient.conditions || [],
            allergies: patient.allergies || [],
            recentVitals,
            medications,
        };
    }, [patient, vitals, prescriptions, specialtyVitalTypes, patientId]);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const sendMessage = async (messageText) => {
        if (!messageText.trim()) return;

        const userMessage = messageText;
        setInput('');
        const newMessages = [...messages, { role: 'user', text: userMessage }];
        setMessages(newMessages);
        setLoading(true);

        try {
            const history = newMessages
                .slice(1)
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
                    role: activeRole || 'patient',
                    patientId: patientContext?.patientId || patientId || '',
                    doctorId: doctorProfile?.id || '',
                })
            });

            const data = await response.json();

            if (data.reply) {
                setMessages(prev => [...prev, {
                    role: 'assistant',
                    text: data.reply,
                    actions: data.actions || []
                }]);
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

    const handleSend = async (e) => {
        e.preventDefault();
        await sendMessage(input);
    };

    const handleChipClick = (chipMessage) => {
        sendMessage(chipMessage);
    };

    const clearChat = () => {
        setMessages([{ role: 'assistant', text: t.greeting }]);
    };

    return (
        <div className="fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-[60] flex flex-col items-end">
            {/* Chat Window */}
            {isOpen && (
                <div className="fixed inset-0 sm:relative sm:inset-auto bg-white sm:rounded-2xl shadow-2xl sm:border sm:border-gray-200 sm:w-96 sm:h-[520px] flex flex-col sm:mb-4 overflow-hidden transition-all duration-200 ease-in-out">
                    {/* Header */}
                    <div className="bg-gradient-to-r from-primary to-blue-600 p-4 flex justify-between items-center text-white">
                        <div className="flex items-center gap-2">
                            <div className="bg-white/20 p-2 rounded-full">
                                <Bot size={20} className="text-white" />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">GlucoBot Agent</h3>
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
                                <div className="max-w-[85%] sm:max-w-[80%]">
                                    <div
                                        className={`rounded-2xl px-4 py-3 text-sm shadow-sm break-words whitespace-pre-wrap ${msg.role === 'user'
                                                ? 'bg-primary text-white rounded-br-none'
                                                : 'bg-white text-gray-800 border border-gray-100 rounded-bl-none'
                                            }`}
                                    >
                                        {msg.text}
                                    </div>
                                    {/* Action result cards */}
                                    {msg.actions?.length > 0 && (
                                        <div className="mt-1">
                                            {msg.actions.map((action, i) => (
                                                <ActionResultCard key={i} action={action} />
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}

                        {/* Quick action chips — only on initial state */}
                        {showChips && (
                            <div className="flex flex-wrap gap-2 pt-2">
                                {chips.map((chip, i) => (
                                    <button
                                        key={i}
                                        onClick={() => handleChipClick(chip.message)}
                                        className="text-xs bg-white border border-primary/30 text-primary px-3 py-1.5 rounded-full hover:bg-primary/5 transition-colors shadow-sm"
                                    >
                                        {chip.label}
                                    </button>
                                ))}
                            </div>
                        )}

                        {/* Loading indicator */}
                        {loading && (
                            <div className="flex justify-start">
                                <div className="bg-white rounded-2xl rounded-bl-none px-4 py-3 border border-gray-100 shadow-sm flex items-center gap-2">
                                    <Settings size={14} className="text-primary animate-spin" />
                                    <span className="text-xs text-gray-500">{t.working || 'GlucoBot travaille...'}</span>
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
                className={`${isOpen ? 'scale-0' : 'scale-100'} transition-transform duration-200 bg-gradient-to-r from-primary to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white p-3.5 sm:p-4 rounded-full shadow-lg hover:shadow-xl flex items-center gap-2 group`}
            >
                <Bot size={24} className="sm:w-7 sm:h-7 group-hover:rotate-12 transition-transform" />
                <span className="font-semibold pr-2 hidden group-hover:block transition-all duration-300">GlucoBot</span>
            </button>
        </div>
    );
};

export default AiAssistant;
