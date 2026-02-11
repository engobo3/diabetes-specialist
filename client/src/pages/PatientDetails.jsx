import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend, LabelList } from 'recharts';
import { Activity, Heart, Scale, Droplets, ArrowLeft, Sparkles, Edit2, Save, Calendar, Phone, FileText, Upload, Trash2, ClipboardList, UserPlus, X, Stethoscope } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import MedicalDossier from '../components/MedicalDossier';
import FootRiskPanel from '../components/FootRiskPanel';

const PatientDetails = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const { currentUser } = useAuth();
    const [patient, setPatient] = useState(null);
    const [vitals, setVitals] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedVitalType, setSelectedVitalType] = useState('Glucose'); // 'Glucose', 'Blood Pressure', 'Weight', 'Heart Rate'
    const [forecast, setForecast] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);

    const [prescriptions, setPrescriptions] = useState([]);
    const [appointments, setAppointments] = useState([]);

    // Phone Editing State
    const [isEditingPhone, setIsEditingPhone] = useState(false);
    const [phone, setPhone] = useState('');

    // Note Editing State
    const [editingNoteId, setEditingNoteId] = useState(null);
    const [noteText, setNoteText] = useState('');

    const [documents, setDocuments] = useState([]);
    const [uploading, setUploading] = useState(false);
    const [medicalRecords, setMedicalRecords] = useState([]);

    // Care Team Management
    const [showAddDoctor, setShowAddDoctor] = useState(false);
    const [allDoctors, setAllDoctors] = useState([]);
    const [selectedDoctorId, setSelectedDoctorId] = useState('');

    const fetchData = async () => {
        if (!currentUser) return;
        try {
            const token = await currentUser.getIdToken();
            const headers = { 'Authorization': `Bearer ${token}` };

            const [patientData, vitalsData, prescriptionsData, appointmentsData, documentsData, medicalRecordsData] = await Promise.all([
                fetch(`${import.meta.env.VITE_API_URL}/api/patients/${id}`, { headers }).then(res => res.json()),
                fetch(`${import.meta.env.VITE_API_URL}/api/patients/${id}/vitals`, { headers }).then(res => res.json()),
                fetch(`${import.meta.env.VITE_API_URL}/api/prescriptions/${id}`, { headers }).then(res => res.json()),
                fetch(`${import.meta.env.VITE_API_URL}/api/appointments`, { headers }).then(res => res.json()),
                fetch(`${import.meta.env.VITE_API_URL}/api/patients/${id}/documents`, { headers }).then(res => res.json()),
                fetch(`${import.meta.env.VITE_API_URL}/api/medical-records/patient/${id}`, { headers }).then(res => res.ok ? res.json() : [])
            ]);

            setPatient(patientData);
            setPhone(patientData.phone || '');
            setVitals(vitalsData);
            setPrescriptions(prescriptionsData);
            const patientApps = appointmentsData.filter(a => String(a.patientId) === String(id));
            setAppointments(patientApps);
            setDocuments(Array.isArray(documentsData) ? documentsData : []);
            setMedicalRecords(Array.isArray(medicalRecordsData) ? medicalRecordsData : []);
            setLoading(false);
        } catch (err) {
            console.error("Error fetching data", err);
            setLoading(false);
        }
    };

    useEffect(() => {
        if (currentUser) {
            fetchData();
        }
    }, [id, currentUser]);

    const handleAddVital = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        const baseVital = {
            date: formData.get('date'),
            type: selectedVitalType,
        };

        let specificData = {};
        if (selectedVitalType === 'Glucose') {
            const val = parseInt(formData.get('value'));
            specificData = {
                category: 'Glucose',
                subtype: formData.get('subtype'),
                value: val,
                glucose: val
            };
        } else if (selectedVitalType === 'Blood Pressure') {
            const sys = parseInt(formData.get('systolic'));
            const dia = parseInt(formData.get('diastolic'));
            specificData = {
                category: 'Blood Pressure',
                systolic: sys,
                diastolic: dia,
                value: `${sys}/${dia}`
            };
        } else if (selectedVitalType === 'Weight') {
            specificData = {
                category: 'Weight',
                value: parseFloat(formData.get('value'))
            };
        } else if (selectedVitalType === 'Heart Rate') {
            specificData = {
                category: 'Heart Rate',
                value: parseInt(formData.get('value'))
            };
        }

        const newVital = { ...baseVital, ...specificData };

        try {
            const token = await currentUser.getIdToken();
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/patients/${id}/vitals`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(newVital),
            });

            if (response.ok) {
                fetchData();
                e.target.reset();
            } else {
                alert('Erreur lors de l\'ajout de la lecture');
            }
        } catch (error) {
            console.error('Error adding vital:', error);
            alert('Erreur lors de l\'ajout de la lecture');
        }
    };

    const handleAddPrescription = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);

        const newPrescription = {
            patientId: id,
            medication: formData.get('medication'),
            dosage: formData.get('dosage'),
            instructions: formData.get('instructions'),
            date: formData.get('date') || new Date().toISOString().split('T')[0]
        };

        try {
            const token = await currentUser.getIdToken();
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/prescriptions`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(newPrescription),
            });

            if (response.ok) {
                fetchData();
                e.target.reset();
            } else {
                alert('Erreur lors de l\'ajout de l\'ordonnance');
            }
        } catch (error) {
            console.error('Error adding prescription:', error);
            alert('Erreur lors de l\'ajout de l\'ordonnance');
        }
    };

    const handleAddMedicalRecord = async (e) => {
        e.preventDefault();
        const formData = new FormData(e.target);
        const newRecord = {
            patientId: id,
            type: formData.get('recordType'),
            title: formData.get('title'),
            content: formData.get('content'),
            date: formData.get('date') || new Date().toISOString().split('T')[0],
            doctorName: 'Dr. Specialist'
        };
        try {
            const token = await currentUser.getIdToken();
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/medical-records`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(newRecord),
            });
            if (response.ok) {
                fetchData();
                e.target.reset();
            } else {
                alert('Erreur lors de l\'ajout du dossier medical');
            }
        } catch (error) {
            console.error('Error adding medical record:', error);
            alert('Erreur lors de l\'ajout du dossier medical');
        }
    };

    const handleUploadDocument = async (e) => {
        e.preventDefault();
        setUploading(true);
        const formData = new FormData(e.target);
        const file = formData.get('file');
        const type = formData.get('type');

        if (!file) {
            alert("Veuillez sélectionner un fichier.");
            setUploading(false);
            return;
        }

        try {
            // 1. Upload to Firebase Storage
            const storageRef = ref(storage, `patients/${id}/documents/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);

            // 2. Save Metadata to API
            const newDoc = {
                name: file.name,
                type: type,
                url: downloadURL,
                date: new Date().toISOString().split('T')[0],
                size: (file.size / 1024 / 1024).toFixed(2) + ' MB'
            };

            const token = await currentUser.getIdToken();
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/patients/${id}/documents`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(newDoc),
            });

            if (response.ok) {
                fetchData();
                e.target.reset();
                alert("Document ajouté avec succès !");
            } else {
                alert("Erreur lors de l'enregistrement du document.");
            }
        } catch (error) {
            console.error("Upload error:", error);
            alert("Erreur lors de l'upload.");
        } finally {
            setUploading(false);
        }
    };

    const handleAddDoctor = async () => {
        if (!selectedDoctorId) return;
        try {
            const token = await currentUser.getIdToken();
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/patients/${id}/doctors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ doctorId: selectedDoctorId }),
            });
            if (response.ok) {
                const updated = await response.json();
                setPatient(updated);
                setSelectedDoctorId('');
                setShowAddDoctor(false);
            } else {
                alert('Erreur lors de l\'ajout du médecin');
            }
        } catch (error) {
            console.error('Error adding doctor:', error);
        }
    };

    const handleRemoveDoctor = async (doctorId) => {
        if (!confirm('Retirer ce médecin de l\'équipe soignante ?')) return;
        try {
            const token = await currentUser.getIdToken();
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/patients/${id}/doctors/${doctorId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (response.ok) {
                const updated = await response.json();
                setPatient(updated);
            } else {
                const err = await response.json();
                alert(err.message || 'Erreur');
            }
        } catch (error) {
            console.error('Error removing doctor:', error);
        }
    };

    const fetchDoctors = async () => {
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/doctors`, {
                headers: { 'Authorization': `Bearer ${token}` },
            });
            if (res.ok) setAllDoctors(await res.json());
        } catch (e) {
            console.error('Error fetching doctors:', e);
        }
    };

    const handleUpdatePhone = async () => {
        try {
            const token = await currentUser.getIdToken();
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/patients/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ phone }),
            });

            if (response.ok) {
                setPatient(prev => ({ ...prev, phone }));
                setIsEditingPhone(false);
            } else {
                alert('Erreur lors de la mise à jour du téléphone');
            }
        } catch (error) {
            console.error('Error updating phone:', error);
            alert('Erreur lors de la mise à jour');
        }
    };

    const handleSaveNote = async (appointmentId) => {
        try {
            const token = await currentUser.getIdToken();
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/appointments/${appointmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ notes: noteText }),
            });

            if (response.ok) {
                setAppointments(prev => prev.map(app =>
                    app.id === appointmentId ? { ...app, notes: noteText } : app
                ));
                setEditingNoteId(null);
            } else {
                alert('Erreur lors de l\'enregistrement de la note');
            }
        } catch (error) {
            console.error('Error saving note:', error);
            alert('Erreur lors de l\'enregistrement');
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Chargement des détails du patient...</div>;
    if (!patient) return <div className="p-8 text-center text-red-500">Patient non trouvé</div>;

    // Filter vitals for chart and list - use category first, fall back to type field
    const filteredVitals = vitals?.readings
        ?.filter(v => {
            const vitalType = v.category || v.type;
            return vitalType === selectedVitalType || (!vitalType && selectedVitalType === 'Glucose');
        })
        ?.map(v => ({
            ...v,
            // Normalize glucose field so chart dataKey always finds a value
            glucose: v.glucose ?? (selectedVitalType === 'Glucose' ? (typeof v.value === 'number' ? v.value : parseFloat(v.value)) : undefined),
        }))
        ?.sort((a, b) => new Date(a.date) - new Date(b.date)) || [];

    const chartData = forecast ? [...filteredVitals, ...forecast.predictions] : [...filteredVitals];

    const handleForecast = async () => {
        if (filteredVitals.length < 3) {
            alert("Pas assez de données pour l'analyse (minimum 3).");
            return;
        }

        setAnalyzing(true);
        try {
            const history = filteredVitals.map(v => ({
                date: v.date,
                value: selectedVitalType === 'Blood Pressure' ? `${v.systolic}/${v.diastolic}` : (v.value || v.glucose)
            })).slice(-10); // Check last 10 readings

            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/ai/forecast`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ history, type: selectedVitalType })
            });

            if (!response.ok) throw new Error("Forecast failed");

            const data = await response.json();
            setForecast(data);

        } catch (error) {
            console.error(error);
            alert("Erreur lors de l'analyse IA.");
        } finally {
            setAnalyzing(false);
        }
    };

    const getVitalConfig = (type) => {
        switch (type) {
            case 'Glucose': return { color: '#3B82F6', unit: 'mg/dL', icon: Droplets };
            case 'Blood Pressure': return { color: '#EF4444', unit: 'mmHg', icon: Activity };
            case 'Weight': return { color: '#10B981', unit: 'kg', icon: Scale };
            case 'Heart Rate': return { color: '#F59E0B', unit: 'bpm', icon: Heart };
            default: return { color: '#6B7280', unit: '', icon: Activity };
        }
    };

    const config = getVitalConfig(selectedVitalType);
    const Icon = config.icon || Activity;

    return (
        <div className="min-h-screen bg-slate-50">
            <nav className="bg-white border-b border-gray-200 print:hidden">
                <div className="container flex items-center h-16 gap-4">
                    <button onClick={() => navigate('/dashboard')} className="flex items-center text-gray-500 hover:text-primary transition-colors">
                        <ArrowLeft className="w-5 h-5 mr-1" />
                        Retour
                    </button>
                    <div className="text-xl font-bold text-primary">GlucoCare <span className="text-xs font-normal text-gray-500">/ Détails du Patient</span></div>
                </div>
            </nav>

            <main className="container py-4 sm:py-8 px-3 sm:px-4">
                {/* Header */}
                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 mb-6 print:hidden">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2 tracking-tight">{patient.name}</h1>
                            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-gray-500 text-sm">
                                <span>Âge: {patient.age}</span>
                                <span className="hidden sm:inline">•</span>
                                <span>Type: {patient.type}</span>
                                <span className="hidden sm:inline">•</span>
                                <div className="flex items-center gap-2">
                                    <Phone size={16} />
                                    {isEditingPhone ? (
                                        <div className="flex items-center gap-2">
                                            <input
                                                type="text"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                className="border rounded px-2 py-1 text-sm w-32"
                                            />
                                            <button onClick={handleUpdatePhone} className="text-green-600 hover:text-green-700">
                                                <Save size={16} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="flex items-center gap-2 group">
                                            <span>{patient.phone || 'Aucun numéro'}</span>
                                            <button onClick={() => setIsEditingPhone(true)} className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-blue-600 transition-opacity">
                                                <Edit2 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                        <div className="text-right">
                            <span className={`text-lg font-bold ${patient.status === 'Critical' ? 'text-red-600' : 'text-green-600'}`}>
                                {patient.status === 'Critical' ? 'Critique' : 'Stable'}
                            </span>
                        </div>
                    </div>

                    {/* Care Team */}
                    <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                                <Stethoscope size={14} /> Equipe Soignante
                            </span>
                            <button
                                onClick={() => { setShowAddDoctor(!showAddDoctor); if (!showAddDoctor) fetchDoctors(); }}
                                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
                            >
                                <UserPlus size={14} /> Ajouter
                            </button>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            {(patient.doctors && patient.doctors.length > 0) ? patient.doctors.map(doc => (
                                <div key={doc.id} className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-full px-3 py-1.5 text-sm group">
                                    <span className="font-medium text-blue-900">Dr. {doc.name}</span>
                                    {doc.specialty && <span className="text-blue-600 text-xs">({doc.specialty})</span>}
                                    {patient.doctors.length > 1 && (
                                        <button
                                            onClick={() => handleRemoveDoctor(doc.id)}
                                            className="opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-600 transition-opacity ml-1"
                                            title="Retirer"
                                        >
                                            <X size={14} />
                                        </button>
                                    )}
                                </div>
                            )) : (
                                <span className="text-sm text-gray-500">
                                    Dr. {patient.doctorName || 'N/A'} {patient.doctorSpecialty && `(${patient.doctorSpecialty})`}
                                </span>
                            )}
                        </div>
                        {showAddDoctor && (
                            <div className="mt-3 flex items-center gap-2">
                                <select
                                    value={selectedDoctorId}
                                    onChange={(e) => setSelectedDoctorId(e.target.value)}
                                    className="flex-1 rounded-md border-gray-300 shadow-sm text-sm p-2 border"
                                >
                                    <option value="">Choisir un médecin...</option>
                                    {allDoctors
                                        .filter(d => !(patient.doctors || []).some(pd => String(pd.id) === String(d.id)))
                                        .map(d => (
                                            <option key={d.id} value={d.id}>Dr. {d.name} - {d.specialty}</option>
                                        ))}
                                </select>
                                <button
                                    onClick={handleAddDoctor}
                                    disabled={!selectedDoctorId}
                                    className="px-3 py-2 bg-blue-600 text-white rounded-md text-sm hover:bg-blue-700 disabled:opacity-50"
                                >
                                    Ajouter
                                </button>
                                <button
                                    onClick={() => setShowAddDoctor(false)}
                                    className="px-2 py-2 text-gray-500 hover:text-gray-700"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                </div>

                {/* Tabs */}
                <div className="flex space-x-1 bg-white p-1 rounded-lg border border-gray-200 mb-6 w-full sm:w-fit overflow-x-auto print:hidden">
                    {['Glucose', 'Blood Pressure', 'Weight', 'Heart Rate'].map(type => (
                        <button
                            key={type}
                            onClick={() => {
                                setSelectedVitalType(type);
                                setForecast(null);
                            }}
                            className={`px-2.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap min-h-[44px] ${selectedVitalType === type
                                ? 'bg-blue-50 text-blue-700 shadow-sm'
                                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                                }`}
                        >
                            {type === 'Blood Pressure' ? 'Tension' : type === 'Heart Rate' ? 'Rythme' : type === 'Weight' ? 'Poids' : type}
                        </button>
                    ))}
                    <button
                        onClick={() => setSelectedVitalType('Prescriptions')}
                        className={`px-2.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap min-h-[44px] ${selectedVitalType === 'Prescriptions'
                            ? 'bg-blue-50 text-blue-700 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        Ordonnances
                    </button>
                    <button
                        onClick={() => setSelectedVitalType('Appointments')}
                        className={`px-2.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap min-h-[44px] ${selectedVitalType === 'Appointments'
                            ? 'bg-blue-50 text-blue-700 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        Rendez-vous
                    </button>
                    <button
                        onClick={() => setSelectedVitalType('Documents')}
                        className={`px-2.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap min-h-[44px] ${selectedVitalType === 'Documents'
                            ? 'bg-blue-50 text-blue-700 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        Documents
                    </button>
                    <button
                        onClick={() => setSelectedVitalType('MedicalRecords')}
                        className={`px-2.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap min-h-[44px] ${selectedVitalType === 'MedicalRecords'
                            ? 'bg-blue-50 text-blue-700 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        Dossier Medical
                    </button>
                    <button
                        onClick={() => setSelectedVitalType('FootRisk')}
                        className={`px-2.5 sm:px-4 py-2 rounded-md text-xs sm:text-sm font-medium transition-colors whitespace-nowrap min-h-[44px] ${selectedVitalType === 'FootRisk'
                            ? 'bg-blue-50 text-blue-700 shadow-sm'
                            : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
                            }`}
                    >
                        Risque Podologique
                    </button>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 print:grid-cols-1">
                    <div className="lg:col-span-2 space-y-6 print:col-span-1">
                        {selectedVitalType === 'Prescriptions' ? (
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-6">Historique des Ordonnances</h3>
                                {prescriptions.length > 0 ? (
                                    <div className="space-y-4">
                                        {prescriptions.map(p => (
                                            <div key={p.id} className="border border-gray-200 p-4 rounded-lg bg-gray-50">
                                                <div className="flex justify-between">
                                                    <h4 className="font-bold text-gray-900">{p.medication} ({p.dosage})</h4>
                                                    <span className="text-sm text-gray-500">{p.date}</span>
                                                </div>
                                                <p className="text-gray-600 mt-2 text-sm">{p.instructions}</p>
                                                <div className="mt-2 text-xs text-blue-600 font-medium">Prescrit par {p.doctorName}</div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-center py-8">Aucune ordonnance.</p>
                                )}
                            </div>
                        ) : selectedVitalType === 'Appointments' ? (
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                                    <Calendar className="text-blue-600" />
                                    Historique des Rendez-vous
                                </h3>
                                {appointments.length > 0 ? (
                                    <div className="space-y-6">
                                        {[...appointments].sort((a, b) => new Date(b.date) - new Date(a.date)).map(app => (
                                            <div key={app.id} className="border border-gray-200 p-4 rounded-lg bg-gray-50">
                                                <div className="flex justify-between items-start mb-3">
                                                    <div>
                                                        <div className="font-bold text-gray-900 flex items-center gap-2">
                                                            {new Date(app.date).toLocaleDateString('fr-FR')} à {app.time}
                                                            <span className={`text-xs px-2 py-0.5 rounded-full ${app.status === 'confirmed' ? 'bg-green-100 text-green-700' :
                                                                app.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                                                    'bg-gray-100 text-gray-600'
                                                                }`}>
                                                                {app.status}
                                                            </span>
                                                        </div>
                                                        <p className="text-sm text-gray-600 mt-1">{app.reason}</p>
                                                    </div>
                                                </div>

                                                <div className="mt-4 pt-4 border-t border-gray-200">
                                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">
                                                        Notes du Médecin
                                                    </label>
                                                    {editingNoteId === app.id ? (
                                                        <div className="space-y-2">
                                                            <textarea
                                                                className="w-full p-2 border rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                                                rows="3"
                                                                value={noteText}
                                                                onChange={(e) => setNoteText(e.target.value)}
                                                                placeholder="Ajouter un compte-rendu ou des observations..."
                                                            ></textarea>
                                                            <div className="flex justify-end gap-2">
                                                                <button
                                                                    onClick={() => setEditingNoteId(null)}
                                                                    className="text-sm text-gray-500 hover:text-gray-700 px-3 py-1"
                                                                >
                                                                    Annuler
                                                                </button>
                                                                <button
                                                                    onClick={() => handleSaveNote(app.id)}
                                                                    className="text-sm bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 flex items-center gap-1"
                                                                >
                                                                    <Save size={14} /> Enregistrer
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="group relative">
                                                            <div className={`p-3 rounded-md text-sm ${app.notes ? 'bg-white border border-gray-200 text-gray-700' : 'bg-gray-100 text-gray-400 italic'}`}>
                                                                {app.notes || "Aucune note enregistrée."}
                                                            </div>
                                                            <button
                                                                onClick={() => {
                                                                    setEditingNoteId(app.id);
                                                                    setNoteText(app.notes || '');
                                                                }}
                                                                className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-white shadow-sm border border-gray-200 p-1.5 rounded-full text-gray-500 hover:text-blue-600 transition-all"
                                                                title="Modifier la note"
                                                            >
                                                                <Edit2 size={14} />
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-center py-8">Aucun rendez-vous enregistré.</p>
                                )}
                            </div>

                        ) : selectedVitalType === 'Documents' ? (
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
                                    <FileText className="text-blue-600" />
                                    Documents (Fichiers)
                                </h3>
                                {documents.length > 0 ? (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        {[...documents].sort((a, b) => new Date(b.date) - new Date(a.date)).map((doc, idx) => (
                                            <a key={idx} href={doc.url} target="_blank" rel="noopener noreferrer" className="block group">
                                                <div className="border border-gray-200 p-4 rounded-lg bg-gray-50 hover:bg-blue-50 hover:border-blue-200 transition-all">
                                                    <div className="flex items-start gap-3">
                                                        <div className="bg-white p-2 rounded shadow-sm text-red-500">
                                                            <FileText size={24} />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <h4 className="font-bold text-gray-900 truncate group-hover:text-blue-700">{doc.name}</h4>
                                                            <p className="text-xs text-gray-500 flex items-center gap-2 mt-1">
                                                                <span className="bg-gray-200 px-1.5 py-0.5 rounded text-gray-700 font-medium">{doc.type}</span>
                                                                <span>{doc.date}</span>
                                                                <span>• {doc.size}</span>
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-center py-8">Aucun document archivé.</p>
                                )}
                            </div>

                        ) : selectedVitalType === 'MedicalRecords' ? (
                            <MedicalDossier
                                patient={patient}
                                vitals={vitals?.readings || []}
                                prescriptions={prescriptions}
                                medicalRecords={medicalRecords}
                                documents={documents}
                                appointments={appointments}
                            />
                        ) : selectedVitalType === 'FootRisk' ? (
                            <FootRiskPanel patientId={id} patient={patient} />
                        ) : (
                            <>
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                                    <h3 className="text-lg font-semibold text-gray-900 mb-6 flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <Icon className="w-5 h-5" style={{ color: config.color }} />
                                            Tendance - {selectedVitalType === 'Blood Pressure' ? 'Tension Artérielle' : selectedVitalType}
                                        </div>
                                        <button
                                            onClick={handleForecast}
                                            disabled={analyzing}
                                            className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-indigo-100 transition-colors border border-indigo-200"
                                        >
                                            <Sparkles size={14} className={analyzing ? "animate-spin" : ""} />
                                            {analyzing ? "Analyse..." : "Analyser avec IA"}
                                        </button>
                                    </h3>

                                    {forecast && (
                                        <div className="mb-6 bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-lg border border-indigo-100 flex items-start gap-3">
                                            <div className="bg-white p-2 rounded-full shadow-sm">
                                                <Sparkles size={18} className="text-indigo-600" />
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-900 text-sm">Analyse IA : {forecast.trend}</h4>
                                                <p className="text-sm text-gray-600 mt-1">{forecast.insight}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="h-52 sm:h-80 w-full">
                                        {chartData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={chartData} margin={{ top: 20, right: 30, left: 10, bottom: 10 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#9CA3AF' }} tickLine={false} axisLine={false} />
                                                    <YAxis tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 500 }} tickLine={false} axisLine={false} domain={['auto', 'auto']} />
                                                    <Tooltip
                                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                                        formatter={(value, name) => [`${value} ${config.unit}`, name === 'systolic' ? 'Systolique' : name === 'diastolic' ? 'Diastolique' : selectedVitalType]}
                                                    />
                                                    {selectedVitalType === 'Blood Pressure' ? (
                                                        <>
                                                            <Legend verticalAlign="top" height={36} />
                                                            <Line type="monotone" dataKey="systolic" stroke={config.color} strokeWidth={3} dot={{ r: 5, fill: config.color, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} name="Systolique">
                                                                <LabelList dataKey="systolic" position="top" offset={10} style={{ fontSize: 11, fontWeight: 600, fill: config.color }} />
                                                            </Line>
                                                            <Line type="monotone" dataKey="diastolic" stroke="#818CF8" strokeWidth={3} dot={{ r: 5, fill: '#818CF8', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} name="Diastolique">
                                                                <LabelList dataKey="diastolic" position="bottom" offset={10} style={{ fontSize: 11, fontWeight: 600, fill: '#818CF8' }} />
                                                            </Line>
                                                        </>
                                                    ) : (
                                                        <Line
                                                            type="monotone"
                                                            dataKey={selectedVitalType === 'Glucose' ? 'glucose' : 'value'}
                                                            stroke={config.color}
                                                            strokeWidth={3}
                                                            dot={(props) => {
                                                                const { cx, cy, payload } = props;
                                                                if (payload.type === 'predicted') {
                                                                    return <circle cx={cx} cy={cy} r={5} fill="white" stroke={config.color} strokeWidth={2} strokeDasharray="2 2" />;
                                                                }
                                                                return <circle cx={cx} cy={cy} r={5} fill={config.color} stroke="white" strokeWidth={2} />;
                                                            }}
                                                            activeDot={{ r: 7 }}
                                                            strokeDasharray={chartData.some(d => d.type === 'predicted') ? "3 3" : ""}
                                                        >
                                                            <LabelList dataKey={selectedVitalType === 'Glucose' ? 'glucose' : 'value'} position="top" offset={10} style={{ fontSize: 12, fontWeight: 700, fill: config.color }} />
                                                        </Line>
                                                    )}
                                                </LineChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="h-full flex items-center justify-center text-gray-400 text-sm">
                                                Pas assez de données pour afficher le graphique
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* List */}
                                <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-x-auto">
                                    <table className="w-full text-left border-collapse min-w-[320px]">
                                        <thead>
                                            <tr className="bg-gray-50 border-b border-gray-200">
                                                <th className="p-2 sm:p-4 font-semibold text-gray-600 text-xs sm:text-sm">Date</th>
                                                <th className="p-2 sm:p-4 font-semibold text-gray-600 text-xs sm:text-sm">Détail</th>
                                                <th className="p-2 sm:p-4 font-semibold text-gray-600 text-xs sm:text-sm">Valeur ({config.unit})</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {filteredVitals.slice().reverse().map((reading, index) => (
                                                <tr key={index} className="border-b border-gray-100 last:border-0 hover:bg-slate-50">
                                                    <td className="p-2 sm:p-4 text-gray-700 text-xs sm:text-sm">{reading.date}</td>
                                                    <td className="p-2 sm:p-4 text-gray-500 text-xs sm:text-sm">
                                                        {selectedVitalType === 'Glucose' ? (reading.subtype || reading.type || 'Standard') : '-'}
                                                    </td>
                                                    <td className="p-2 sm:p-4 font-medium text-gray-900 text-xs sm:text-sm">
                                                        {selectedVitalType === 'Blood Pressure'
                                                            ? `${reading.systolic}/${reading.diastolic}`
                                                            : (reading.value || reading.glucose)}
                                                    </td>
                                                </tr>
                                            ))}
                                            {filteredVitals.length === 0 && (
                                                <tr>
                                                    <td colSpan="3" className="p-8 text-center text-gray-500 text-sm">Aucune donnée trouvée.</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Add Form */}
                    <div className="print:hidden">
                        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-6">
                            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center bg-blue-50 text-blue-600">
                                    <span className="text-xl font-light">+</span>
                                </div>
                                {selectedVitalType === 'Prescriptions' ? 'Nouvelle Ordonnance' : selectedVitalType === 'MedicalRecords' ? 'Nouveau Dossier' : 'Ajouter une mesure'}
                            </h2>

                            {selectedVitalType === 'Prescriptions' ? (
                                <form onSubmit={handleAddPrescription} className="space-y-4">
                                    {/* Prescription Form Fields (Same as before) */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Médicament</label>
                                        <input type="text" name="medication" required className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" placeholder="Ex: Metformine" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Dosage</label>
                                        <input type="text" name="dosage" required className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" placeholder="Ex: 500mg" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Instructions</label>
                                        <textarea name="instructions" required rows="3" className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" placeholder="1 comprimé matin et soir..."></textarea>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Date</label>
                                        <input type="date" name="date" required className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" defaultValue={new Date().toISOString().split('T')[0]} />
                                    </div>
                                    <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                                        Créer Ordonnance
                                    </button>
                                </form>
                            ) : selectedVitalType === 'MedicalRecords' ? (
                                <form onSubmit={handleAddMedicalRecord} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Type</label>
                                        <select name="recordType" required className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border">
                                            <option value="diagnosis">Diagnostic</option>
                                            <option value="lab_result">Resultat Labo</option>
                                            <option value="procedure">Procedure</option>
                                            <option value="clinical_note">Note Clinique</option>
                                            <option value="referral">Orientation</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Titre</label>
                                        <input type="text" name="title" required className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" placeholder="Ex: Diabete Type 2" />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Contenu / Details</label>
                                        <textarea name="content" required rows="4" className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" placeholder="Details du diagnostic, resultats, observations..."></textarea>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Date</label>
                                        <input type="date" name="date" required className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" defaultValue={new Date().toISOString().split('T')[0]} />
                                    </div>
                                    <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                                        Ajouter au Dossier
                                    </button>
                                </form>
                            ) : selectedVitalType === 'Documents' ? (
                                <form onSubmit={handleUploadDocument} className="space-y-4">
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Type de Document</label>
                                        <select name="type" required className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border">
                                            <option value="Lab Result">Résultat Labo</option>
                                            <option value="X-Ray">Radio / Imagerie</option>
                                            <option value="Prescription Scan">Scann Ordonnance</option>
                                            <option value="ID Card">Carte d'Identité</option>
                                            <option value="Other">Autre</option>
                                        </select>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Fichier</label>
                                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:bg-gray-50 transition-colors">
                                            <input type="file" name="file" required className="hidden" id="file-upload" />
                                            <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-2">
                                                <Upload className="text-gray-400" size={24} />
                                                <span className="text-sm text-blue-600 font-medium">Cliquez pour choisir un fichier</span>
                                                <span className="text-xs text-gray-500">PDF, JPG, PNG (Max 5MB)</span>
                                            </label>
                                        </div>
                                    </div>
                                    <button disabled={uploading} type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors disabled:opacity-50">
                                        {uploading ? 'Téléchargement...' : 'Uploader le Document'}
                                    </button>
                                </form>
                            ) : (
                                <form onSubmit={handleAddVital} className="space-y-4">
                                    {/* Vitals Form Fields (Same as before) */}
                                    <div>
                                        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Date</label>
                                        <input type="date" name="date" required className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" defaultValue={new Date().toISOString().split('T')[0]} />
                                    </div>

                                    {selectedVitalType === 'Glucose' && (
                                        <>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Moment</label>
                                                <select name="subtype" className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border">
                                                    <option value="Fasting">À Jeun</option>
                                                    <option value="Post-Prandial">Post-Prandial</option>
                                                    <option value="Random">Aléatoire</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Glucose (mg/dL)</label>
                                                <input type="number" name="value" required min="0" max="1000" className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" placeholder="120" />
                                            </div>
                                        </>
                                    )}

                                    {selectedVitalType === 'Blood Pressure' && (
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Systolique</label>
                                                <input type="number" name="systolic" required min="50" max="300" className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" placeholder="120" />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Diastolique</label>
                                                <input type="number" name="diastolic" required min="30" max="200" className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" placeholder="80" />
                                            </div>
                                        </div>
                                    )}

                                    {selectedVitalType === 'Weight' && (
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Poids (kg)</label>
                                            <input type="number" step="0.1" name="value" required min="0" className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" placeholder="75.5" />
                                        </div>
                                    )}

                                    {selectedVitalType === 'Heart Rate' && (
                                        <div>
                                            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">BPM</label>
                                            <input type="number" name="value" required min="0" max="300" className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm p-2 border" placeholder="72" />
                                        </div>
                                    )}

                                    <button type="submit" className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors">
                                        Enregistrer {selectedVitalType === 'Blood Pressure' ? 'la tension' : selectedVitalType === 'Heart Rate' ? 'le rythme' : selectedVitalType === 'Weight' ? 'le poids' : 'la mesure'}
                                    </button>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            </main >
        </div >
    );
};

export default PatientDetails;
