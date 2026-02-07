import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, CreditCard, User, CheckCircle, Printer } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import PaymentForm from '../components/PaymentForm';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import BetaBadge from '../components/ui/BetaBadge';

const PaymentTerminal = () => {
    const { doctorProfile } = useAuth();
    const [selectedPatient, setSelectedPatient] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [paymentSuccess, setPaymentSuccess] = useState(false);

    // Fetch patients for search
    const { data: patients = [] } = useQuery({
        queryKey: ['patients', doctorProfile?.id],
        queryFn: () => {
            if (!doctorProfile?.id) return [];
            return fetch(`${import.meta.env.VITE_API_URL || ''}/api/patients?doctorId=${doctorProfile.id}`)
                .then(res => res.json());
        },
        enabled: !!doctorProfile?.id
    });

    const filteredPatients = patients.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (p.phone && p.phone.includes(searchTerm))
    );

    const handleSuccess = () => {
        setPaymentSuccess(true);
    };

    const resetTerminal = () => {
        setPaymentSuccess(false);
        setSelectedPatient(null);
        setSearchTerm('');
    };

    return (
        <div className="p-6 max-w-4xl mx-auto space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        Terminal de Paiement (POS) <BetaBadge />
                    </h1>
                    <p className="text-gray-500">Encaissement pour consultations et services</p>
                </div>
                <div className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm font-medium">
                    Mode: Virtuel
                </div>
            </div>

            {paymentSuccess ? (
                <Card className="bg-green-50 border-green-200 text-center py-12">
                    <CardContent className="space-y-4">
                        <div className="flex justify-center">
                            <CheckCircle className="w-16 h-16 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-green-800">Paiement Réussi !</h2>
                        <p className="text-green-700">Le paiement a été enregistré avec succès.</p>

                        <div className="flex justify-center gap-4 mt-8">
                            <button
                                onClick={() => window.print()}
                                className="flex items-center gap-2 px-4 py-2 bg-white text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
                            >
                                <Printer size={20} />
                                Imprimer Reçu
                            </button>
                            <button
                                onClick={resetTerminal}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 shadow-sm"
                            >
                                Nouveau Paiement
                            </button>
                        </div>
                    </CardContent>
                </Card>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left: Patient Selection */}
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <User size={20} />
                                1. Sélectionner le Patient
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="relative">
                                <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                                <input
                                    type="text"
                                    placeholder="Rechercher par nom ou téléphone..."
                                    className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                />
                            </div>

                            <div className="border rounded-lg divide-y max-h-[400px] overflow-y-auto">
                                {filteredPatients.length === 0 ? (
                                    <div className="p-4 text-center text-gray-500 text-sm">
                                        Aucun patient trouvé.
                                    </div>
                                ) : (
                                    filteredPatients.map(patient => (
                                        <div
                                            key={patient.id}
                                            onClick={() => setSelectedPatient(patient)}
                                            className={`p-3 cursor-pointer transition-colors flex items-center justify-between ${selectedPatient?.id === patient.id
                                                ? 'bg-blue-50 border-l-4 border-blue-600'
                                                : 'hover:bg-gray-50'
                                                }`}
                                        >
                                            <div>
                                                <div className="font-medium text-gray-900">{patient.name}</div>
                                                <div className="text-xs text-gray-500">ID: {patient.id}</div>
                                            </div>
                                            {selectedPatient?.id === patient.id && (
                                                <CheckCircle size={16} className="text-blue-600" />
                                            )}
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>

                    {/* Right: Payment Form */}
                    <div className={!selectedPatient ? 'opacity-50 pointer-events-none' : ''}>
                        <Card className="h-full">
                            <CardHeader>
                                <CardTitle className="flex items-center gap-2">
                                    <CreditCard size={20} />
                                    2. Effectuer le Paiement
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {selectedPatient ? (
                                    <div className="space-y-4">
                                        <div className="bg-gray-100 p-3 rounded-lg text-sm mb-4">
                                            Client: <span className="font-bold">{selectedPatient.name}</span>
                                        </div>
                                        <PaymentForm
                                            patientId={selectedPatient.id}
                                            doctorId={doctorProfile?.id}
                                            onSuccess={handleSuccess}
                                        />
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-gray-400 py-12">
                                        <User size={48} className="mb-2 opacity-20" />
                                        <p>Veuillez sélectionner un patient à gauche</p>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
};

export default PaymentTerminal;
