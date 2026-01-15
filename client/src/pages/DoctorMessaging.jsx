import React, { useState, useEffect } from 'react';
import ChatInterface from '../components/ChatInterface';
import { useAuth } from '../context/AuthContext';
import { Mail } from 'lucide-react';

const DoctorMessaging = () => {
    const { currentUser, doctorProfile } = useAuth();
    const [patients, setPatients] = useState([]);
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!doctorProfile?.id) return;

        fetch(`${import.meta.env.VITE_API_URL || ''}/api/patients?doctorId=${doctorProfile.id}`)
            .then(res => res.json())
            .then(data => {
                setPatients(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to fetch patients", err);
                setLoading(false);
            });
    }, []);

    return (
        <div className="min-h-screen bg-white">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 h-16 flex items-center px-6">
                <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                    <Mail className="w-5 h-5" /> Messagerie
                </h1>
            </div>

            <div className="flex h-[calc(100vh-64px)]">
                {/* Sidebar: Patient List */}
                <div className="w-1/3 border-r border-gray-200 bg-gray-50 overflow-y-auto">
                    <div className="p-4">
                        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Patients</h2>
                        {loading ? (
                            <div className="text-center text-gray-400">Chargement...</div>
                        ) : (
                            <div className="space-y-2">
                                {patients.map(patient => (
                                    <button
                                        key={patient.id}
                                        onClick={() => setSelectedPatient(patient)}
                                        className={`w-full text-left p-3 rounded-lg transition-colors flex items-center justify-between ${selectedPatient?.id === patient.id
                                            ? 'bg-blue-100 text-blue-900'
                                            : 'hover:bg-gray-100 text-gray-700'
                                            }`}
                                    >
                                        <span className="font-medium">{patient.name}</span>
                                        {/* Could add unread badge here later */}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Main: Chat Area */}
                <div className="w-2/3 p-6 bg-slate-50 flex flex-col items-center justify-center">
                    {selectedPatient ? (
                        <div className="w-full max-w-2xl">
                            <ChatInterface
                                currentUser={currentUser}
                                customSenderId={doctorProfile?.id}
                                customSenderName={doctorProfile?.name}
                                contactId={selectedPatient.id} // Passing patient ID as contact
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
