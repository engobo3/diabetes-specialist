import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, ChevronRight, Calendar } from 'lucide-react';
import Button from './ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';

const PatientSelector = () => {
    const { managedPatients, selectPatient, patientId } = useAuth();

    if (!managedPatients || managedPatients.length === 0) {
        return null;
    }

    if (managedPatients.length === 1) {
        return null; // Auto-selected already
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
            {/* Header */}
            <div className="bg-white border-b border-gray-200">
                <div className="container py-6">
                    <div className="flex items-center gap-3">
                        <Users className="text-blue-600" size={32} />
                        <h1 className="text-3xl font-bold text-gray-900">Sélectionnez un patient</h1>
                    </div>
                    <p className="text-gray-600 mt-2">Vous gériez {managedPatients.length} patient(s)</p>
                </div>
            </div>

            {/* Patients Grid */}
            <div className="container py-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {managedPatients.map(patient => (
                        <Card
                            key={patient.id}
                            className={`cursor-pointer transition-all hover:shadow-lg ${
                                patientId === patient.id
                                    ? 'border-blue-500 bg-blue-50'
                                    : 'hover:border-blue-300'
                            }`}
                            onClick={() => selectPatient(patient.id)}
                        >
                            <CardHeader>
                                <CardTitle className="text-xl">{patient.name}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Âge</span>
                                        <span className="font-medium text-gray-900">{patient.age} ans</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Type</span>
                                        <span className="font-medium text-gray-900">{patient.type}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-sm">
                                        <span className="text-gray-600">Statut</span>
                                        <span className={`font-medium px-2 py-1 rounded text-xs ${
                                            patient.status === 'Critical' ? 'bg-red-100 text-red-700' :
                                            patient.status === 'Attention Needed' ? 'bg-orange-100 text-orange-700' :
                                            'bg-green-100 text-green-700'
                                        }`}>
                                            {patient.status}
                                        </span>
                                    </div>
                                    {patient.lastVisit && (
                                        <div className="flex items-center gap-2 text-sm text-gray-600 pt-2 border-t">
                                            <Calendar size={14} />
                                            <span>Dernière visite: {patient.lastVisit}</span>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    ))}
                </div>

                {patientId && (
                    <div className="mt-8 text-center">
                        <Button
                            className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white px-8 py-3 rounded-lg font-medium hover:from-blue-600 hover:to-indigo-700 transition-all inline-flex items-center gap-2"
                        >
                            Accéder au dossier patient
                            <ChevronRight size={20} />
                        </Button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default PatientSelector;
