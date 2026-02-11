import React, { useState, useEffect } from 'react';
import ChatInterface from '../components/ChatInterface';
import { useAuth } from '../context/AuthContext';
import { Mail, ArrowLeft } from 'lucide-react';
import BetaBadge from '../components/ui/BetaBadge';

const DoctorMessaging = () => {
    const { currentUser, doctorProfile } = useAuth();
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [showSidebar, setShowSidebar] = useState(true);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPatients = async () => {
            if (!doctorProfile?.id || !currentUser) return;
            try {
                const token = await currentUser.getIdToken();
                const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/patients?doctorId=${doctorProfile.id}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.ok) {
                    const data = await response.json();
                    setPatients(data);
                }
            } catch (err) {
                console.error("Failed to fetch patients", err);
            } finally {
                setLoading(false);
            }
        };
        fetchPatients();
    }, [doctorProfile, currentUser]);

    return (
        <div className="min-h-screen bg-white">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 h-16 flex items-center px-3 sm:px-6">
                <h1 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Mail className="w-5 h-5" /> Messagerie <BetaBadge />
                </h1>
            </div>

            <div className="flex h-[calc(100vh-64px)]">
                {/* Sidebar: Patient List */}
                <div className={`${showSidebar ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-1/3 border-r border-gray-200 bg-gray-50 overflow-y-auto`}>
                    <div className="p-3 sm:p-4">
                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Patients</h2>
                        {loading ? (
                            <div className="text-center text-gray-400">Chargement...</div>
                        ) : (
                            <div className="space-y-2">
                                {patients.map(patient => (
                                    <button
                                        key={patient.id}
                                        onClick={() => { setSelectedPatient(patient); setShowSidebar(false); }}
                                        className={`w-full text-left p-3 min-h-[44px] rounded-lg transition-colors flex items-center justify-between ${selectedPatient?.id === patient.id
                                            ? 'bg-blue-100 text-blue-900'
                                            : 'hover:bg-gray-100 text-gray-700'
                                            }`}
                                    >
                                        <span className="font-medium">{patient.name}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Main: Chat Area */}
                <div className={`${!showSidebar ? 'flex' : 'hidden'} md:flex flex-col w-full md:w-2/3 p-3 sm:p-6 bg-slate-50 items-center justify-center`}>
                    {selectedPatient ? (
                        <div className="w-full max-w-2xl">
                            <button
                                onClick={() => setShowSidebar(true)}
                                className="md:hidden flex items-center gap-1 text-gray-500 hover:text-primary mb-3 min-h-[44px]"
                            >
                                <ArrowLeft className="w-5 h-5" />
                                <span className="text-sm">Retour aux patients</span>
                            </button>
                            <ChatInterface
                                currentUser={currentUser}
                                customSenderId={doctorProfile?.id}
                                customSenderName={doctorProfile?.name}
                                contactId={selectedPatient.id}
                                contactName={selectedPatient.name}
                                isSpecialist={true}
                            />
                        </div>
                    ) : (
                        <div className="text-center text-gray-400">
                            <Mail className="w-16 h-16 mx-auto mb-4 opacity-20" />
                            <p>Sélectionnez un patient pour démarrer une conversation.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default DoctorMessaging;
