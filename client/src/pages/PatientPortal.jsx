import ChatInterface from '../components/ChatInterface';
import AiAssistant from '../components/AiAssistant';
import PatientSelector from '../components/PatientSelector';
import HealthInsightsPanel from '../components/HealthInsightsPanel';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { Droplets, Activity, Scale, Heart, Calendar, FileText, MessageSquare, LogOut, Clock, CheckCircle, XCircle, Sparkles, Banknote, Plus, Users, Brain, ClipboardList, Footprints } from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import BetaBadge from '../components/ui/BetaBadge';
import Input from '../components/ui/Input';
import Skeleton from '../components/ui/Skeleton';
import PaymentForm from '../components/PaymentForm';
import CaregiverInviteForm from '../components/CaregiverInviteForm';
import CaregiverList from '../components/CaregiverList';
import RoleSwitcher from '../components/RoleSwitcher';
import MedicalDossier from '../components/MedicalDossier';
import FootRiskSummaryCard from '../components/FootRiskSummaryCard';

const PatientPortal = () => {
    const { patientId, logout, currentUser, userRole, managedPatients } = useAuth();
    const [patient, setPatient] = useState(null);
    const [vitals, setVitals] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedVitalType, setSelectedVitalType] = useState('Glucose');
    const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'appointments', 'messages', 'prescriptions'
    const [prescriptions, setPrescriptions] = useState([]);
    const [forecast, setForecast] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [isAddVitalOpen, setIsAddVitalOpen] = useState(false);
    const [medicalRecords, setMedicalRecords] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [dossierAppointments, setDossierAppointments] = useState([]);

    useEffect(() => {
        if (!currentUser) return;

        if (!patientId) {
            setLoading(false); // Stop loading if no patient ID associated
            return;
        }

        const fetchData = async () => {
            try {
                const token = await currentUser.getIdToken();
                const headers = { 'Authorization': `Bearer ${token}` };

                const [patientRes, vitalsRes, prescriptionsRes, medicalRecordsRes, documentsRes, appointmentsRes] = await Promise.all([
                    fetch(`${import.meta.env.VITE_API_URL}/api/patients/${patientId}`, { headers }).then(res => res.json()),
                    fetch(`${import.meta.env.VITE_API_URL}/api/patients/${patientId}/vitals`, { headers }).then(res => res.json()),
                    fetch(`${import.meta.env.VITE_API_URL}/api/prescriptions/${patientId}`, { headers }).then(res => res.json()),
                    fetch(`${import.meta.env.VITE_API_URL}/api/medical-records/patient/${patientId}`, { headers }).then(res => res.ok ? res.json() : []),
                    fetch(`${import.meta.env.VITE_API_URL}/api/patients/${patientId}/documents`, { headers }).then(res => res.ok ? res.json() : []),
                    fetch(`${import.meta.env.VITE_API_URL}/api/appointments`, { headers }).then(res => res.ok ? res.json() : [])
                ]);

                setPatient(patientRes);
                setVitals(vitalsRes);
                setPrescriptions(prescriptionsRes);
                setMedicalRecords(Array.isArray(medicalRecordsRes) ? medicalRecordsRes : []);
                setDocuments(Array.isArray(documentsRes) ? documentsRes : []);
                const patientApps = (Array.isArray(appointmentsRes) ? appointmentsRes : []).filter(a => String(a.patientId) === String(patientId));
                setDossierAppointments(patientApps);
                setLoading(false);
            } catch (err) {
                console.error("Error fetching data", err);
                setLoading(false);
            }
        };

        fetchData();
    }, [patientId, currentUser]);

    if (loading) return (
        <div className="min-h-screen bg-slate-50 container py-8 space-y-6">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-12 w-full max-w-md" />
            <div className="grid gap-6">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-40 w-full" />
            </div>
        </div>
    );

    if (!patient) return (
        <div className="min-h-screen flex flex-col items-center justify-center p-8 text-center">
            <div className="bg-red-50 text-red-600 p-6 rounded-lg max-w-md">
                <h3 className="font-bold text-lg mb-2">Profil Introuvable</h3>
                <p>Impossible de charger les données du patient. Veuillez contacter votre médecin.</p>
                <Button variant="outline" className="mt-4" onClick={logout}>Déconnexion</Button>
            </div>
        </div>
    );

    // Filter vitals for chart - use category first, fall back to type field
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

            const token = await currentUser.getIdToken();
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/ai/forecast`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
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
            case 'Glucose': return { color: '#0F766E', unit: 'mg/dL', icon: Droplets };
            case 'Blood Pressure': return { color: '#EF4444', unit: 'mmHg', icon: Activity };
            case 'Weight': return { color: '#10B981', unit: 'kg', icon: Scale };
            case 'Heart Rate': return { color: '#F59E0B', unit: 'bpm', icon: Heart };
            default: return { color: '#6B7280', unit: '', icon: Activity };
        }
    };

    const config = getVitalConfig(selectedVitalType);
    const Icon = config.icon;

    const recordTypeLabels = {
        diagnosis: 'Diagnostic',
        lab_result: 'Resultat Labo',
        procedure: 'Procedure',
        clinical_note: 'Note Clinique',
        referral: 'Orientation'
    };

    const navItems = [
        { id: 'overview', label: "Vue d'ensemble", icon: Activity },
        { id: 'ai-insights', label: "Analyse IA", icon: Brain },
        { id: 'appointments', label: "Rendez-vous", icon: Calendar },
        { id: 'prescriptions', label: "Ordonnances", icon: FileText },
        { id: 'medical-records', label: "Dossier Medical", icon: ClipboardList },
        { id: 'payments', label: "Paiements", icon: Banknote },
        { id: 'messages', label: "Messagerie", icon: MessageSquare },
        { id: 'foot-risk', label: "Risque Podologique", icon: Footprints },
        { id: 'caregivers', label: "Aidants", icon: Users },
    ];

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-gray-900">
            <nav className="bg-white border-b border-gray-200 sticky top-0 z-10 print:hidden">
                <div className="container flex items-center justify-between h-16 gap-4">
                    <div className="text-xl font-bold text-primary flex items-center gap-2">
                        <Activity className="text-primary" size={24} /> GlucoCare <BetaBadge /> <span className="text-xs font-normal text-gray-500 hidden sm:inline-block">/ Espace Patient</span>
                    </div>
                    <RoleSwitcher />
                    <Button variant="ghost" size="sm" onClick={logout} className="text-gray-500 hover:text-red-500 gap-2">
                        <LogOut size={16} /> <span className="hidden sm:inline">Déconnexion</span>
                    </Button>
                </div>
            </nav>

            <main className="container py-4 sm:py-8 px-3 sm:px-4 space-y-6 sm:space-y-8">
                <Card className="bg-gradient-to-r from-primary/5 to-white border-primary/10 print:hidden">
                    <CardContent className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-gray-900">Bonjour, {patient.name}</h1>
                            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2">
                                <p className="text-gray-500 text-sm flex items-center gap-2">
                                    <Clock size={14} /> Dernière visite: {patient.lastVisit}
                                </p>

                                {/* Doctor Info - Miniature */}
                                <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full shadow-sm border border-gray-100">
                                    <div className="w-6 h-6 rounded-full overflow-hidden border border-gray-200">
                                        {patient.doctorPhoto ? (
                                            <img src={patient.doctorPhoto} alt="Doctor" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full bg-blue-100 text-blue-600 flex items-center justify-center text-[10px] font-bold">DR</div>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-600 font-medium">
                                        {patient.doctorName || "Dr. Specialiste"}
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            <Button
                                variant="outline"
                                size="sm"
                                className="hidden sm:flex"
                                onClick={() => setIsAddVitalOpen(true)}
                            >
                                <Plus size={16} className="mr-2" /> Ajouter Mesure
                            </Button>
                            <Button
                                onClick={() => setActiveTab('appointments')}
                                className="shadow-md"
                                size="sm"
                            >
                                <Calendar size={16} className="mr-2" /> Rendez-vous
                            </Button>
                        </div>
                    </CardContent>
                </Card>

                {/* Main Navigation Tabs */}
                <div className="flex border-b border-gray-200 overflow-x-auto pb-1 gap-1 sm:gap-4 print:hidden">
                    {navItems.map(item => (
                        <button
                            key={item.id}
                            onClick={() => setActiveTab(item.id)}
                            className={`flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap min-h-[44px] ${activeTab === item.id
                                ? 'border-primary text-primary'
                                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                                }`}
                        >
                            <item.icon size={16} className="sm:w-[18px] sm:h-[18px]" />
                            <span className="hidden sm:inline">{item.label}</span>
                            <span className="sm:hidden">{item.label.split(' ')[0]}</span>
                        </button>
                    ))}
                </div>

                {activeTab === 'overview' && (
                    <div className="space-y-6">
                        {/* Vitals Tabs */}
                        <div className="flex flex-wrap gap-2">
                            {['Glucose', 'Blood Pressure', 'Weight', 'Heart Rate'].map(type => (
                                <button
                                    key={type}
                                    onClick={() => {
                                        setSelectedVitalType(type);
                                        setForecast(null);
                                    }}
                                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors border ${selectedVitalType === type
                                        ? 'bg-primary text-white border-primary shadow-sm'
                                        : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                        }`}
                                >
                                    {type === 'Blood Pressure' ? 'Tension' : type === 'Heart Rate' ? 'Rythme' : type === 'Weight' ? 'Poids' : type}
                                </button>
                            ))}
                        </div>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <CardTitle className="flex items-center gap-2">
                                    <Icon className="w-5 h-5" style={{ color: config.color }} />
                                    Votre Tendance ({selectedVitalType})
                                </CardTitle>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => setIsAddVitalOpen(true)}
                                        className="text-primary border-primary/20 hover:bg-primary/5 gap-1"
                                    >
                                        <Plus size={16} /> <span className="hidden sm:inline">Ajouter</span>
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={handleForecast}
                                        disabled={analyzing}
                                        className="text-indigo-600 border-indigo-200 hover:bg-indigo-50"
                                    >
                                        <Sparkles size={14} className={`mr-2 ${analyzing ? "animate-spin" : ""}`} />
                                        {analyzing ? "Analyse..." : "IA"}
                                    </Button>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                {forecast && (
                                    <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-lg border border-indigo-100 flex items-start gap-3">
                                        <div className="bg-white p-2 rounded-full shadow-sm text-indigo-600">
                                            <Sparkles size={18} />
                                        </div>
                                        <div>
                                            <h4 className="font-bold text-gray-900 text-sm">Analyse IA : {forecast.trend}</h4>
                                            <p className="text-sm text-gray-600 mt-1">{forecast.insight}</p>
                                        </div>
                                    </div>
                                )}

                                <div className="h-64 sm:h-96 w-full">
                                    {chartData.length > 0 ? (
                                        <ResponsiveContainer width="100%" height="100%">
                                            <LineChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 10 }}>
                                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#9CA3AF' }} tickLine={false} axisLine={false} dy={10} />
                                                <YAxis tick={{ fontSize: 12, fill: '#6B7280', fontWeight: 500 }} tickLine={false} axisLine={false} dx={-10} domain={['auto', 'auto']} />
                                                <Tooltip
                                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '12px' }}
                                                    cursor={{ stroke: config.color, strokeWidth: 1, strokeDasharray: '4 4' }}
                                                    formatter={(value, name) => [`${value} ${config.unit}`, name === 'systolic' ? 'Systolique' : name === 'diastolic' ? 'Diastolique' : selectedVitalType]}
                                                />
                                                {selectedVitalType === 'Blood Pressure' ? (
                                                    <>
                                                        <Legend verticalAlign="top" height={36} formatter={(value) => value === 'systolic' ? 'Systolique' : 'Diastolique'} />
                                                        <Line type="monotone" dataKey="systolic" stroke={config.color} strokeWidth={3} dot={{ r: 5, fill: config.color, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} name="systolic">
                                                            <LabelList dataKey="systolic" position="top" offset={10} style={{ fontSize: 11, fontWeight: 600, fill: config.color }} />
                                                        </Line>
                                                        <Line type="monotone" dataKey="diastolic" stroke="#818CF8" strokeWidth={3} dot={{ r: 5, fill: '#818CF8', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 7 }} name="diastolic">
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
                                        <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                            <Activity size={48} className="mb-4 opacity-20" />
                                            <p>Aucune donnée disponible pour cette période.</p>
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )}

                {activeTab === 'ai-insights' && (
                    <HealthInsightsPanel
                        patientData={patient}
                        vitals={vitals}
                        prescriptions={prescriptions}
                        currentUser={currentUser}
                    />
                )}

                {activeTab === 'appointments' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:gap-8">
                        <AppointmentList patientId={patientId} currentUser={currentUser} />
                        <AppointmentRequestForm patientId={patientId} patientName={patient.name} doctorId={patient.doctorId} currentUser={currentUser} />
                    </div>
                )}

                {activeTab === 'prescriptions' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <FileText size={20} className="text-primary" /> Mes Ordonnances
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            {prescriptions.length === 0 ? (
                                <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-100 rounded-lg">
                                    <FileText size={48} className="mx-auto mb-3 opacity-20" />
                                    Aucune ordonnance en cours.
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    {prescriptions.map(p => (
                                        <div key={p.id} className="border border-l-4 border-l-primary border-gray-100 bg-gray-50/50 p-4 rounded-r-lg hover:bg-white hover:shadow-sm transition-all">
                                            <div className="flex justify-between items-start mb-2">
                                                <div>
                                                    <h4 className="font-bold text-gray-900 text-lg">{p.medication}</h4>
                                                    <Badge variant="info" className="mt-1">{p.dosage}</Badge>
                                                </div>
                                                <span className="text-xs text-gray-400 font-medium bg-white px-2 py-1 rounded border border-gray-100">{p.date}</span>
                                            </div>
                                            <p className="text-gray-600 mb-3">{p.instructions}</p>
                                            <div className="flex items-center gap-2 text-xs font-semibold text-primary border-t border-gray-100 pt-3">
                                                <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center text-[10px]">DR</div>
                                                Prescrit par {p.doctorName}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}

                {activeTab === 'medical-records' && (
                    <MedicalDossier
                        patient={patient}
                        vitals={vitals?.readings || []}
                        prescriptions={prescriptions}
                        medicalRecords={medicalRecords}
                        documents={documents}
                        appointments={dossierAppointments}
                    />
                )}

                {activeTab === 'foot-risk' && (
                    <FootRiskSummaryCard patientId={patientId} />
                )}

                {activeTab === 'payments' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <PaymentForm
                                doctorId={patient.doctorId}
                                onSuccess={() => {
                                    // Trigger refresh of payment history logic if we had it lifted up
                                    // For now, we rely on the component mount or we can force reload
                                    window.location.reload();
                                }} />
                        </div>
                        <div className="space-y-6">
                            <PaymentHistoryList patientId={patientId} currentUser={currentUser} />
                        </div>
                    </div>
                )}


                {activeTab === 'messages' && (
                    <div className="max-w-3xl mx-auto h-[calc(100vh-200px)] sm:h-[600px]">
                        <Card className="h-full flex flex-col">
                            <CardHeader>
                                <CardTitle>Messagerie Sécurisée</CardTitle>
                            </CardHeader>
                            <div className="flex-1 overflow-hidden p-0">
                                <ChatInterface
                                    currentUser={{ ...currentUser, publicId: patientId }}
                                    contactId={patient.doctorId || "SPECIALIST"} // Use actual doctor ID if available
                                    contactName={patient.doctorName || "Dr. Specialist"}
                                />
                            </div>
                        </Card>
                    </div>
                )}

                {activeTab === 'caregivers' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <CaregiverInviteForm
                            patientId={patientId}
                            onSuccess={() => {
                                // Refresh caregiver list
                                window.location.reload();
                            }}
                        />
                        <CaregiverList
                            patientId={patientId}
                            onUpdate={() => {
                                // Refresh data
                                window.location.reload();
                            }}
                        />
                    </div>
                )}
            </main>

            {/* AI Assistant */}
            <AiAssistant patient={patient} vitals={vitals} prescriptions={prescriptions} />

            {isAddVitalOpen && (
                <AddVitalForm
                    patientId={patientId}
                    currentUser={currentUser}
                    initialType={selectedVitalType}
                    onSuccess={() => {
                        setIsAddVitalOpen(false);
                        window.location.reload(); // Simple reload to fetch new data
                    }}
                    onCancel={() => setIsAddVitalOpen(false)}
                />
            )}
        </div>
    );
};

const AppointmentRequestForm = ({ patientId, patientName, doctorId, currentUser }) => {
    const [formData, setFormData] = useState({ date: '', time: '', reason: '' });
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setLoading(true);

        try {
            const token = await currentUser.getIdToken();
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/appointments`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({ ...formData, patientId, patientName, doctorId })
            });

            if (response.ok) {
                setMessage('success');
                setFormData({ date: '', time: '', reason: '' });
            } else {
                setMessage('error');
            }
        } catch (error) {
            console.error("Error requesting appointment", error);
            setMessage('error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Calendar size={20} className="text-primary" /> Nouvelle Demande
                </CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Date souhaitée</label>
                            <Input type="date" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                        </div>
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Heure</label>
                            <Input type="time" required value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} />
                        </div>
                    </div>
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Motif de consultation</label>
                        <div className="relative">
                            <select
                                className="flex h-10 w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent appearance-none"
                                value={formData.reason}
                                onChange={e => setFormData({ ...formData, reason: e.target.value })}
                            >
                                <option value="">Sélectionner un motif...</option>
                                <option value="Suivi régulier">Suivi régulier</option>
                                <option value="Renouvellement ordonnance">Renouvellement ordonnance</option>
                                <option value="Nouveau symptôme">Nouveau symptôme</option>
                                <option value="Autre">Autre</option>
                            </select>
                            <div className="absolute inset-y-0 right-0 flex items-center px-2 pointer-events-none text-gray-500">
                                <svg className="h-4 w-4 fill-current" viewBox="0 0 20 20"><path d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" /></svg>
                            </div>
                        </div>
                    </div>

                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? 'Envoi...' : 'Envoyer la demande'}
                    </Button>

                    {message === 'success' && (
                        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-md border border-green-100">
                            <CheckCircle size={16} /> Demande envoyée avec succès!
                        </div>
                    )}
                    {message === 'error' && (
                        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-md border border-red-100">
                            <XCircle size={16} /> Erreur lors de l'envoi. Veuillez réessayer.
                        </div>
                    )}
                </form>
            </CardContent>
        </Card>
    );
};

const AppointmentList = ({ patientId, currentUser }) => {
    const [appointments, setAppointments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAppointments = async () => {
            try {
                const token = await currentUser.getIdToken();
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/appointments`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                setAppointments(data.filter(a => String(a.patientId) === String(patientId)));
                setLoading(false);
            } catch (err) {
                console.error("Error fetching appointments", err);
                setLoading(false);
            }
        };
        fetchAppointments();
    }, [patientId, currentUser]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Clock size={20} className="text-primary" /> Historique & À venir
                </CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                        <Skeleton className="h-16 w-full" />
                    </div>
                ) : appointments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        Aucun rendez-vous enregistré.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {appointments.map(apt => (
                            <div key={apt.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-primary/30 transition-colors">
                                <div className="flex items-center gap-3 sm:gap-4">
                                    <div className="bg-white p-2 rounded-md border border-gray-100 text-center min-w-[50px] sm:min-w-[60px]">
                                        <div className="text-xs text-gray-500 font-bold uppercase">{new Date(apt.date).toLocaleString('default', { month: 'short' })}</div>
                                        <div className="text-lg sm:text-xl font-bold text-gray-900">{new Date(apt.date).getDate()}</div>
                                    </div>
                                    <div>
                                        <div className="font-semibold text-gray-900 flex flex-wrap items-center gap-1 sm:gap-2">
                                            {apt.time}
                                            <span className="text-gray-400 font-normal text-sm">•</span>
                                            <span className="text-gray-600 font-normal text-sm">{apt.reason}</span>
                                        </div>
                                        <div className="text-xs text-gray-400 mt-1">Dr. Specialist</div>
                                    </div>
                                </div>
                                <Badge variant={
                                    apt.status === 'confirmed' ? 'success' :
                                        apt.status === 'rejected' ? 'danger' : 'warning'
                                }>
                                    {apt.status === 'confirmed' ? 'Validé' : apt.status === 'rejected' ? 'Refusé' : 'En attente'}
                                </Badge>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};



const PaymentHistoryList = ({ patientId, currentUser }) => {
    const [payments, setPayments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPayments = async () => {
            try {
                const token = await currentUser.getIdToken();
                const apiUrl = import.meta.env.VITE_API_URL || '';
                const res = await fetch(`${apiUrl}/api/payments/patient/${patientId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const json = await res.json();
                setPayments(json.data?.transactions || []);
                setLoading(false);
            } catch (err) {
                console.error("Error fetching payments", err);
                setLoading(false);
            }
        };
        fetchPayments();
    }, [patientId, currentUser]);

    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Clock size={20} className="text-primary" /> Historique des Paiements
                </CardTitle>
            </CardHeader>
            <CardContent>
                {loading ? (
                    <div className="space-y-3">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                    </div>
                ) : payments.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                        Aucun paiement enregistré.
                    </div>
                ) : (
                    <div className="space-y-3">
                        {payments.map(pay => (
                            <div key={pay.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-100">
                                <div>
                                    <div className="font-bold text-gray-900">{pay.amount} {pay.currency}</div>
                                    <div className="text-xs text-gray-500">{new Date(pay.createdAt).toLocaleDateString()} • {pay.paymentMethod || 'cash'}</div>
                                    {pay.description && <div className="text-xs text-gray-400">{pay.description}</div>}
                                </div>
                                <Badge variant={pay.status === 'completed' ? 'success' : 'warning'}>
                                    {pay.status === 'completed' ? 'Validé' : pay.status === 'pending' ? 'En attente' : pay.status}
                                </Badge>
                            </div>
                        ))}
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

// ... (existing code)

const AddVitalForm = ({ patientId, currentUser, onSuccess, onCancel, initialType = 'Glucose' }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [type, setType] = useState(initialType);
    const [formData, setFormData] = useState({
        date: new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        value: '',
        systolic: '',
        diastolic: '',
        subtype: 'Fasting'
    });

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const token = await currentUser.getIdToken();

            // Construct payload based on type
            let payload = {
                type: type,
                category: type, // Required for filtering vitals by type in both patient and doctor views
                date: formData.date // Backend likely expects YYYY-MM-DD
            };

            if (type === 'Blood Pressure') {
                payload.systolic = parseInt(formData.systolic);
                payload.diastolic = parseInt(formData.diastolic);
                payload.value = `${formData.systolic}/${formData.diastolic}`;
            } else {
                payload.value = parseFloat(formData.value);
            }

            if (type === 'Glucose') {
                payload.subtype = formData.subtype;
                payload.glucose = parseFloat(formData.value); // Store as 'glucose' field for chart dataKey
            }

            const response = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/patients/${patientId}/vitals`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error("Failed to add vital");

            onSuccess();
        } catch (err) {
            console.error(err);
            setError("Erreur lors de l'enregistrement.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <Card className="w-full max-w-md bg-white">
                <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                    <CardTitle>Nouvelle Mesure</CardTitle>
                    <button onClick={onCancel} className="text-gray-400 hover:text-gray-600">
                        <XCircle size={24} />
                    </button>
                </CardHeader>
                <CardContent className="pt-6">
                    {error && <div className="text-red-500 text-sm mb-4 bg-red-50 p-3 rounded">{error}</div>}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Type de mesure</label>
                            <select
                                value={type}
                                onChange={(e) => setType(e.target.value)}
                                className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary p-2 border"
                            >
                                <option value="Glucose">Glucose</option>
                                <option value="Blood Pressure">Tension Artérielle</option>
                                <option value="Weight">Poids</option>
                                <option value="Heart Rate">Rythme Cardiaque</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                                <Input type="date" required value={formData.date} onChange={e => setFormData({ ...formData, date: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Heure</label>
                                <Input type="time" required value={formData.time} onChange={e => setFormData({ ...formData, time: e.target.value })} />
                            </div>
                        </div>

                        {type === 'Glucose' && (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Contexte</label>
                                    <select
                                        value={formData.subtype}
                                        onChange={e => setFormData({ ...formData, subtype: e.target.value })}
                                        className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary p-2 border"
                                    >
                                        <option value="Fasting">À Jeun</option>
                                        <option value="Post-Prandial">Après repas (2h)</option>
                                        <option value="Random">Aléatoire</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Valeur (mg/dL)</label>
                                    <Input type="number" required min="20" max="600" value={formData.value} onChange={e => setFormData({ ...formData, value: e.target.value })} placeholder="Ex: 110" />
                                </div>
                            </>
                        )}

                        {type === 'Blood Pressure' && (
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Systolique</label>
                                    <Input type="number" required min="50" max="250" value={formData.systolic} onChange={e => setFormData({ ...formData, systolic: e.target.value })} placeholder="120" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Diastolique</label>
                                    <Input type="number" required min="30" max="150" value={formData.diastolic} onChange={e => setFormData({ ...formData, diastolic: e.target.value })} placeholder="80" />
                                </div>
                            </div>
                        )}

                        {type === 'Weight' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Poids (kg)</label>
                                <Input type="number" step="0.1" required min="0" value={formData.value} onChange={e => setFormData({ ...formData, value: e.target.value })} />
                            </div>
                        )}

                        {type === 'Heart Rate' && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Rythme (bpm)</label>
                                <Input type="number" required min="30" max="250" value={formData.value} onChange={e => setFormData({ ...formData, value: e.target.value })} />
                            </div>
                        )}

                        <div className="flex gap-3 pt-4">
                            <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Annuler</Button>
                            <Button type="submit" className="flex-1" disabled={loading}>
                                {loading ? 'Enregistrement...' : 'Enregistrer'}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default PatientPortal;
