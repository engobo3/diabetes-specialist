import ChatInterface from '../components/ChatInterface';
import AiAssistant from '../components/AiAssistant';
import PatientSelector from '../components/PatientSelector';
import HealthInsightsPanel from '../components/HealthInsightsPanel';
import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, LabelList } from 'recharts';
import { Droplets, Activity, Scale, Heart, Calendar, FileText, MessageSquare, LogOut, Clock, CheckCircle, XCircle, Sparkles, Banknote, Plus, Users, Brain, ClipboardList, Footprints, Trash2, Settings, Pill, Menu, User, ChevronLeft, ChevronRight } from 'lucide-react';
import { resolveIcon, findVitalType, getDefaultVitalType, buildPayload, getVitalLabelFr, getFieldLabelFr, DEFAULT_VITAL_TYPES } from '../utils/vitalHelpers';
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
import NotificationPreferences from '../components/NotificationPreferences';
import MedicationScheduleManager from '../components/MedicationScheduleManager';
import Sidebar from '../components/Sidebar';
import PatientProfile from '../components/PatientProfile';
import toast from 'react-hot-toast';

const PatientPortal = () => {
    const { patientId, logout, currentUser, userRole, managedPatients } = useAuth();
    const [patient, setPatient] = useState(null);
    const [vitals, setVitals] = useState(null);
    const [loading, setLoading] = useState(true);
    const [specialtyVitalTypes, setSpecialtyVitalTypes] = useState(DEFAULT_VITAL_TYPES);
    const [selectedVitalType, setSelectedVitalType] = useState('Glucose');
    const [activeTab, setActiveTab] = useState('overview'); // 'overview', 'appointments', 'messages', 'prescriptions'
    const [prescriptions, setPrescriptions] = useState([]);
    const [forecast, setForecast] = useState(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [isAddVitalOpen, setIsAddVitalOpen] = useState(false);
    const [addVitalDate, setAddVitalDate] = useState(null);
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [medicalRecords, setMedicalRecords] = useState([]);
    const [documents, setDocuments] = useState([]);
    const [dossierAppointments, setDossierAppointments] = useState([]);

    const refreshData = async () => {
        if (!currentUser || !patientId) return;
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
        } catch (err) {
            console.error('Error refreshing data', err);
        }
    };

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

    // Fetch specialty config once patient is loaded
    useEffect(() => {
        if (!patient?.doctorSpecialty || !currentUser) return;
        const fetchSpecialtyConfig = async () => {
            try {
                const token = await currentUser.getIdToken();
                const res = await fetch(
                    `${import.meta.env.VITE_API_URL}/api/specialties/resolve/${encodeURIComponent(patient.doctorSpecialty)}`,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );
                if (res.ok) {
                    const data = await res.json();
                    if (data.vitalTypes?.length) {
                        setSpecialtyVitalTypes(data.vitalTypes);
                        setSelectedVitalType(data.vitalTypes[0].key);
                    }
                }
            } catch (err) {
                console.error('Error fetching specialty config:', err);
            }
        };
        fetchSpecialtyConfig();
    }, [patient?.doctorSpecialty, currentUser]);

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
    const selectedVtConfig = findVitalType(specialtyVitalTypes, selectedVitalType);
    const filteredVitals = vitals?.readings
        ?.filter(v => {
            const vitalType = v.category || v.type;
            return vitalType === selectedVitalType || (!vitalType && selectedVitalType === 'Glucose');
        })
        ?.map(v => {
            const mapped = { ...v };
            // Normalize: ensure the chartDataKey field exists from value fallback
            if (selectedVtConfig?.chartType === 'single') {
                const key = selectedVtConfig.chartDataKey;
                if (mapped[key] == null && mapped.value != null) {
                    mapped[key] = typeof mapped.value === 'number' ? mapped.value : parseFloat(mapped.value);
                }
            }
            return mapped;
        })
        ?.sort((a, b) => new Date(a.date) - new Date(b.date)) || [];

    const chartData = forecast ? [...filteredVitals, ...forecast.predictions] : [...filteredVitals];

    const handleForecast = async () => {
        if (filteredVitals.length < 3) {
            toast.error("Pas assez de données pour l'analyse (minimum 3).");
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
            toast.error("Erreur lors de l'analyse IA.");
        } finally {
            setAnalyzing(false);
        }
    };

    const handleDeleteVital = async (vitalId) => {
        if (!window.confirm('Supprimer cette mesure ? Cette action est irréversible.')) return;
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch(`${import.meta.env.VITE_API_URL}/api/patients/${patientId}/vitals/${vitalId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Delete failed');
            setVitals(prev => ({
                ...prev,
                readings: prev.readings.filter(r => r.id !== vitalId)
            }));
        } catch (error) {
            console.error('Error deleting vital:', error);
            toast.error('Erreur lors de la suppression.');
        }
    };

    const getVitalConfig = (type) => {
        const vt = findVitalType(specialtyVitalTypes, type);
        if (vt) return { color: vt.color, unit: vt.unit, icon: resolveIcon(vt.iconName) };
        return { color: '#6B7280', unit: '', icon: Activity };
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

    const navGroups = [
        {
            label: 'Sante',
            items: [
                { id: 'overview', label: "Vue d'ensemble", icon: Activity },
                { id: 'ai-insights', label: "Analyse IA", icon: Brain },
                { id: 'medical-records', label: "Dossier Medical", icon: ClipboardList },
                { id: 'medications', label: "Medicaments", icon: Pill },
                { id: 'foot-risk', label: "Risque Podologique", icon: Footprints },
            ],
        },
        {
            label: 'Services',
            items: [
                { id: 'appointments', label: "Rendez-vous", icon: Calendar },
                { id: 'prescriptions', label: "Ordonnances", icon: FileText },
                { id: 'payments', label: "Paiements", icon: Banknote },
                { id: 'messages', label: "Messagerie", icon: MessageSquare },
                { id: 'caregivers', label: "Aidants", icon: Users },
            ],
        },
        {
            label: 'Compte',
            items: [
                { id: 'profile', label: "Mon Profil", icon: User },
                { id: 'settings', label: "Parametres", icon: Settings },
            ],
        },
    ];

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-gray-900">
            <nav className="bg-white border-b border-gray-200 sticky top-0 z-30 print:hidden">
                <div className="container flex items-center justify-between h-16 gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-primary rounded-lg hover:bg-gray-100"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <Menu size={24} />
                        </button>
                        <div className="text-xl font-bold text-primary flex items-center gap-2">
                            <Activity className="text-primary" size={24} /> GlucoCare <BetaBadge /> <span className="text-xs font-normal text-gray-500 hidden sm:inline-block">/ Espace Patient</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <RoleSwitcher />
                        <Button variant="ghost" size="sm" onClick={logout} className="text-gray-500 hover:text-red-500 gap-2">
                            <LogOut size={16} /> <span className="hidden sm:inline">Deconnexion</span>
                        </Button>
                    </div>
                </div>
            </nav>

            <Sidebar
                navGroups={navGroups}
                activeTab={activeTab}
                onTabChange={setActiveTab}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            <main className="lg:ml-64 min-h-[calc(100vh-4rem)]">
                <div className="container py-4 sm:py-8 px-3 sm:px-4 space-y-6 sm:space-y-8">
                <Card className="bg-gradient-to-r from-primary/5 to-white border-primary/10 print:hidden">
                    <CardContent className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-gray-900">Bonjour, {patient.name}</h1>
                            <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2">
                                <p className="text-gray-500 text-sm flex items-center gap-2">
                                    <Clock size={14} /> Derniere visite: {patient.lastVisit}
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
                                        {patient.doctorName || "Medecin traitant"}
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

                {activeTab === 'overview' && (
                    <div className="space-y-5">
                        {/* ── Quick Stats Row ────────────────────────────── */}
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            {specialtyVitalTypes.slice(0, 4).map(vt => {
                                const vtConfig = getVitalConfig(vt.key);
                                const VtIcon = vtConfig.icon;
                                const latest = vitals?.readings
                                    ?.filter(v => (v.category || v.type) === vt.key)
                                    ?.sort((a, b) => new Date(b.date) - new Date(a.date))?.[0];

                                const displayVal = latest
                                    ? (vt.chartType === 'dual'
                                        ? `${latest[vt.chartDataKey[0]]}/${latest[vt.chartDataKey[1]]}`
                                        : (latest[vt.chartDataKey] ?? latest.value ?? '—'))
                                    : '—';

                                const isActive = selectedVitalType === vt.key;

                                return (
                                    <button
                                        key={vt.key}
                                        onClick={() => { setSelectedVitalType(vt.key); setForecast(null); }}
                                        className={`relative text-left p-3 sm:p-4 rounded-xl border transition-all ${isActive
                                            ? 'bg-white border-primary/30 shadow-md ring-1 ring-primary/20'
                                            : 'bg-white border-gray-100 hover:border-gray-200 hover:shadow-sm'
                                        }`}
                                    >
                                        <div className="flex items-center gap-2 mb-1.5">
                                            <div className={`p-1.5 rounded-lg ${isActive ? 'bg-primary/10' : 'bg-gray-50'}`}>
                                                <VtIcon size={14} style={{ color: vtConfig.color }} />
                                            </div>
                                            <span className="text-[11px] sm:text-xs font-medium text-gray-500 truncate">{getVitalLabelFr(vt.key)}</span>
                                        </div>
                                        <div className="text-lg sm:text-xl font-bold text-gray-900">{displayVal}</div>
                                        <div className="text-[10px] sm:text-xs text-gray-400 mt-0.5">
                                            {latest?.date || 'Aucune donnee'}
                                            {vt.unit && <span className="ml-1">{vt.unit}</span>}
                                        </div>
                                        {isActive && <div className="absolute top-0 left-0 w-full h-0.5 bg-primary rounded-t-xl" />}
                                    </button>
                                );
                            })}
                        </div>

                        {/* ── Main Content: Chart + Calendar side by side ── */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
                            {/* Chart — 2/3 width on desktop */}
                            <Card className="lg:col-span-2">
                                <CardHeader className="flex flex-row items-center justify-between pb-2">
                                    <CardTitle className="flex items-center gap-2 text-base">
                                        <Icon className="w-5 h-5" style={{ color: config.color }} />
                                        Tendance {getVitalLabelFr(selectedVitalType)}
                                    </CardTitle>
                                    <div className="flex items-center gap-1.5">
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={() => setIsAddVitalOpen(true)}
                                            className="text-primary border-primary/20 hover:bg-primary/5 gap-1 h-8 text-xs"
                                        >
                                            <Plus size={14} /> <span className="hidden sm:inline">Ajouter</span>
                                        </Button>
                                        <Button
                                            variant="outline"
                                            size="sm"
                                            onClick={handleForecast}
                                            disabled={analyzing}
                                            className="text-indigo-600 border-indigo-200 hover:bg-indigo-50 h-8 text-xs"
                                        >
                                            <Sparkles size={14} className={analyzing ? "animate-spin" : ""} />
                                            <span className="ml-1">{analyzing ? "..." : "IA"}</span>
                                        </Button>
                                    </div>
                                </CardHeader>
                                <CardContent className="space-y-4">
                                    {forecast && (
                                        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-3 rounded-lg border border-indigo-100 flex items-start gap-2.5">
                                            <div className="bg-white p-1.5 rounded-full shadow-sm text-indigo-600 shrink-0">
                                                <Sparkles size={14} />
                                            </div>
                                            <div className="min-w-0">
                                                <h4 className="font-bold text-gray-900 text-xs">Analyse IA : {forecast.trend}</h4>
                                                <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{forecast.insight}</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="h-56 sm:h-72 lg:h-80 w-full">
                                        {chartData.length > 0 ? (
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={chartData} margin={{ top: 20, right: 10, left: 0, bottom: 10 }}>
                                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E7EB" />
                                                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9CA3AF' }} tickLine={false} axisLine={false} dy={10} />
                                                    <YAxis tick={{ fontSize: 11, fill: '#6B7280', fontWeight: 500 }} tickLine={false} axisLine={false} dx={-10} domain={['auto', 'auto']} />
                                                    <Tooltip
                                                        contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)', padding: '10px', fontSize: '12px' }}
                                                        cursor={{ stroke: config.color, strokeWidth: 1, strokeDasharray: '4 4' }}
                                                        formatter={(value, name) => [`${value} ${config.unit}`, name === 'systolic' ? 'Systolique' : name === 'diastolic' ? 'Diastolique' : getVitalLabelFr(selectedVitalType)]}
                                                    />
                                                    {(() => {
                                                        const vtConfig = findVitalType(specialtyVitalTypes, selectedVitalType);
                                                        if (vtConfig?.chartType === 'dual') {
                                                            const keys = vtConfig.chartDataKey;
                                                            return (
                                                                <>
                                                                    <Legend verticalAlign="top" height={30} formatter={(value) => value === 'systolic' ? 'Systolique' : 'Diastolique'} />
                                                                    <Line type="monotone" dataKey={keys[0]} stroke={config.color} strokeWidth={2.5} dot={{ r: 4, fill: config.color, strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} name={keys[0]}>
                                                                        <LabelList dataKey={keys[0]} position="top" offset={8} style={{ fontSize: 10, fontWeight: 600, fill: config.color }} />
                                                                    </Line>
                                                                    <Line type="monotone" dataKey={keys[1]} stroke="#818CF8" strokeWidth={2.5} dot={{ r: 4, fill: '#818CF8', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} name={keys[1]}>
                                                                        <LabelList dataKey={keys[1]} position="bottom" offset={8} style={{ fontSize: 10, fontWeight: 600, fill: '#818CF8' }} />
                                                                    </Line>
                                                                </>
                                                            );
                                                        }
                                                        const dataKey = vtConfig?.chartDataKey || 'value';
                                                        return (
                                                            <Line
                                                                type="monotone"
                                                                dataKey={dataKey}
                                                                stroke={config.color}
                                                                strokeWidth={2.5}
                                                                dot={(props) => {
                                                                    const { cx, cy, payload } = props;
                                                                    if (payload.type === 'predicted') {
                                                                        return <circle cx={cx} cy={cy} r={4} fill="white" stroke={config.color} strokeWidth={2} strokeDasharray="2 2" />;
                                                                    }
                                                                    return <circle cx={cx} cy={cy} r={4} fill={config.color} stroke="white" strokeWidth={2} />;
                                                                }}
                                                                activeDot={{ r: 6 }}
                                                                strokeDasharray={chartData.some(d => d.type === 'predicted') ? "3 3" : ""}
                                                            >
                                                                <LabelList dataKey={dataKey} position="top" offset={8} style={{ fontSize: 11, fontWeight: 700, fill: config.color }} />
                                                            </Line>
                                                        );
                                                    })()}
                                                </LineChart>
                                            </ResponsiveContainer>
                                        ) : (
                                            <div className="h-full flex flex-col items-center justify-center text-gray-400">
                                                <Activity size={40} className="mb-3 opacity-20" />
                                                <p className="text-sm">Aucune donnee disponible.</p>
                                                <Button
                                                    variant="outline"
                                                    size="sm"
                                                    className="mt-3 gap-1.5"
                                                    onClick={() => setIsAddVitalOpen(true)}
                                                >
                                                    <Plus size={14} /> Ajouter votre premiere mesure
                                                </Button>
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>

                            {/* Calendar — 1/3 width on desktop */}
                            <div className="space-y-5">
                                <VitalCalendar
                                    readings={filteredVitals}
                                    accentColor={config.color}
                                    onDateClick={(dateStr) => {
                                        setAddVitalDate(dateStr);
                                        setIsAddVitalOpen(true);
                                    }}
                                />

                                {/* Latest value highlight */}
                                {filteredVitals.length > 0 && (() => {
                                    const latest = filteredVitals[filteredVitals.length - 1];
                                    const val = selectedVtConfig?.chartType === 'dual'
                                        ? `${latest[selectedVtConfig.chartDataKey[0]]}/${latest[selectedVtConfig.chartDataKey[1]]}`
                                        : (latest[selectedVtConfig?.chartDataKey] ?? latest.value);
                                    return (
                                        <Card className="border-l-4" style={{ borderLeftColor: config.color }}>
                                            <CardContent className="p-4">
                                                <div className="text-xs font-medium text-gray-500 mb-1">Derniere mesure</div>
                                                <div className="text-2xl font-bold text-gray-900">{val} <span className="text-sm font-normal text-gray-400">{config.unit}</span></div>
                                                <div className="text-xs text-gray-400 mt-1">{latest.date}{latest.subtype ? ` · ${latest.subtype}` : ''}</div>
                                            </CardContent>
                                        </Card>
                                    );
                                })()}
                            </div>
                        </div>

                        {/* ── Recent Readings Table ──────────────────────── */}
                        {filteredVitals.length > 0 && (
                            <Card>
                                <CardHeader className="pb-2">
                                    <CardTitle className="text-sm font-semibold text-gray-700 flex items-center justify-between">
                                        <span>Historique des mesures</span>
                                        <Badge variant="info" className="text-[10px]">{filteredVitals.length} mesure{filteredVitals.length > 1 ? 's' : ''}</Badge>
                                    </CardTitle>
                                </CardHeader>
                                <CardContent className="p-0">
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-left">
                                            <thead>
                                                <tr className="bg-gray-50/80 border-b border-gray-200">
                                                    <th className="px-4 py-2.5 font-semibold text-gray-500 text-[11px] uppercase tracking-wide">Date</th>
                                                    <th className="px-4 py-2.5 font-semibold text-gray-500 text-[11px] uppercase tracking-wide">Detail</th>
                                                    <th className="px-4 py-2.5 font-semibold text-gray-500 text-[11px] uppercase tracking-wide">Valeur</th>
                                                    <th className="px-4 py-2.5 w-10"></th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {filteredVitals.slice().reverse().slice(0, 10).map((reading) => (
                                                    <tr key={reading.id} className="border-b border-gray-50 last:border-0 hover:bg-slate-50/50 transition-colors">
                                                        <td className="px-4 py-2.5 text-gray-700 text-xs sm:text-sm font-medium">{reading.date}</td>
                                                        <td className="px-4 py-2.5 text-gray-500 text-xs sm:text-sm">
                                                            {selectedVtConfig?.extras?.subtypes ? (reading.subtype || reading.type || 'Standard') : '—'}
                                                        </td>
                                                        <td className="px-4 py-2.5 text-xs sm:text-sm">
                                                            <span className="font-semibold text-gray-900">
                                                                {selectedVtConfig?.chartType === 'dual'
                                                                    ? `${reading[selectedVtConfig.chartDataKey[0]]}/${reading[selectedVtConfig.chartDataKey[1]]}`
                                                                    : (reading[selectedVtConfig?.chartDataKey] || reading.value)}
                                                            </span>
                                                            <span className="text-gray-400 ml-1 text-[10px]">{config.unit}</span>
                                                        </td>
                                                        <td className="px-4 py-2.5">
                                                            <button
                                                                onClick={() => handleDeleteVital(reading.id)}
                                                                className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50"
                                                                title="Supprimer"
                                                            >
                                                                <Trash2 size={13} />
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </CardContent>
                            </Card>
                        )}
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
                        specialtyVitalTypes={specialtyVitalTypes}
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
                                onSuccess={refreshData} />
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
                                    contactName={patient.doctorName || "Médecin traitant"}
                                />
                            </div>
                        </Card>
                    </div>
                )}

                {activeTab === 'caregivers' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <CaregiverInviteForm
                            patientId={patientId}
                            onSuccess={refreshData}
                        />
                        <CaregiverList
                            patientId={patientId}
                            onUpdate={refreshData}
                        />
                    </div>
                )}

                {activeTab === 'medications' && (
                    <MedicationScheduleManager
                        patientId={patientId}
                        currentUser={currentUser}
                        isDoctor={false}
                    />
                )}

                {activeTab === 'settings' && (
                    <NotificationPreferences
                        patientId={patientId}
                        currentUser={currentUser}
                    />
                )}

                {activeTab === 'profile' && (
                    <PatientProfile
                        patient={patient}
                        currentUser={currentUser}
                        patientId={patientId}
                        onUpdate={refreshData}
                    />
                )}
                </div>
            </main>

            {/* AI Assistant */}
            <AiAssistant patient={patient} vitals={vitals} prescriptions={prescriptions} specialtyVitalTypes={specialtyVitalTypes} />

            {isAddVitalOpen && (
                <AddVitalForm
                    patientId={patientId}
                    currentUser={currentUser}
                    initialType={selectedVitalType}
                    initialDate={addVitalDate}
                    vitalTypes={specialtyVitalTypes}
                    onSuccess={() => {
                        setIsAddVitalOpen(false);
                        setAddVitalDate(null);
                        refreshData();
                    }}
                    onCancel={() => { setIsAddVitalOpen(false); setAddVitalDate(null); }}
                />
            )}
        </div>
    );
};

const AppointmentRequestForm = ({ patientId, patientName, doctorId, currentUser }) => {
    const [formData, setFormData] = useState({ date: '', time: '', reason: '' });
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [slots, setSlots] = useState(null); // null = not fetched, [] = no slots
    const [slotsLoading, setSlotsLoading] = useState(false);
    const [slotsMessage, setSlotsMessage] = useState('');

    // Fetch available slots when date changes
    useEffect(() => {
        if (!formData.date || !doctorId) {
            setSlots(null);
            setSlotsMessage('');
            return;
        }

        const fetchSlots = async () => {
            setSlotsLoading(true);
            setSlotsMessage('');
            setFormData(prev => ({ ...prev, time: '' }));
            try {
                const token = await currentUser.getIdToken();
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/doctors/${doctorId}/slots?date=${formData.date}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                const data = await res.json();
                setSlots(data.slots || []);
                if (data.message) setSlotsMessage(data.message);
            } catch (err) {
                console.error('Error fetching slots:', err);
                setSlots([]);
                setSlotsMessage('Erreur lors du chargement des créneaux');
            } finally {
                setSlotsLoading(false);
            }
        };
        fetchSlots();
    }, [formData.date, doctorId]);

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
                setSlots(null);
            } else if (response.status === 409) {
                setMessage('conflict');
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
                    <div className="space-y-1.5">
                        <label className="text-sm font-medium text-gray-700">Date souhaitée</label>
                        <Input
                            type="date"
                            required
                            min={new Date().toISOString().split('T')[0]}
                            value={formData.date}
                            onChange={e => setFormData({ ...formData, date: e.target.value, time: '' })}
                        />
                    </div>

                    {/* Slot picker */}
                    {formData.date && (
                        <div className="space-y-1.5">
                            <label className="text-sm font-medium text-gray-700">Créneau horaire</label>
                            {slotsLoading ? (
                                <div className="flex items-center gap-2 text-sm text-gray-500 py-2">
                                    <Clock size={14} className="animate-spin" /> Chargement des créneaux...
                                </div>
                            ) : slots && slots.length > 0 ? (
                                <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                                    {slots.map(slot => (
                                        <button
                                            key={slot}
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, time: slot }))}
                                            className={`py-2 px-1 text-sm rounded-md border transition-colors ${formData.time === slot
                                                ? 'bg-primary text-white border-primary'
                                                : 'bg-white text-gray-700 border-gray-300 hover:border-primary hover:text-primary'
                                                }`}
                                        >
                                            {slot}
                                        </button>
                                    ))}
                                </div>
                            ) : slots !== null ? (
                                <div className="text-sm text-amber-600 bg-amber-50 p-3 rounded-md border border-amber-100">
                                    {slotsMessage || 'Aucun créneau disponible pour cette date.'}
                                </div>
                            ) : null}
                        </div>
                    )}

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

                    <Button type="submit" className="w-full" disabled={loading || !formData.time}>
                        {loading ? 'Envoi...' : 'Envoyer la demande'}
                    </Button>

                    {message === 'success' && (
                        <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-md border border-green-100">
                            <CheckCircle size={16} /> Demande envoyée avec succès!
                        </div>
                    )}
                    {message === 'conflict' && (
                        <div className="flex items-center gap-2 text-sm text-amber-600 bg-amber-50 p-3 rounded-md border border-amber-100">
                            <XCircle size={16} /> Ce créneau vient d'être réservé. Veuillez en choisir un autre.
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
                                        <div className="text-xs text-gray-400 mt-1">{apt.doctorName || "Médecin traitant"}</div>
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

// ─── Vital Calendar ─────────────────────────────────────────────────
const MONTH_NAMES_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'];
const DAY_HEADERS = ['Lu', 'Ma', 'Me', 'Je', 'Ve', 'Sa', 'Di'];

const VitalCalendar = ({ readings = [], accentColor = '#3b82f6', onDateClick }) => {
    const [viewDate, setViewDate] = useState(new Date());

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();

    // Build set of dates that have readings (YYYY-MM-DD)
    const readingDates = new Set();
    readings.forEach(r => { if (r.date) readingDates.add(r.date); });

    // First day of month (0=Sun) → shift to Monday-start
    const firstDay = new Date(year, month, 1);
    const startDow = (firstDay.getDay() + 6) % 7; // 0=Mon
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const todayStr = new Date().toISOString().split('T')[0];

    const prevMonth = () => setViewDate(new Date(year, month - 1, 1));
    const nextMonth = () => setViewDate(new Date(year, month + 1, 1));

    // Build grid cells: leading blanks + day numbers
    const cells = [];
    for (let i = 0; i < startDow; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
        <Card>
            <CardContent className="p-4">
                {/* Month nav */}
                <div className="flex items-center justify-between mb-3">
                    <button onClick={prevMonth} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
                        <ChevronLeft size={18} />
                    </button>
                    <h4 className="text-sm font-semibold text-gray-800">
                        {MONTH_NAMES_FR[month]} {year}
                    </h4>
                    <button onClick={nextMonth} className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors">
                        <ChevronRight size={18} />
                    </button>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 gap-1 mb-1">
                    {DAY_HEADERS.map(d => (
                        <div key={d} className="text-center text-[10px] font-semibold text-gray-400 uppercase py-1">{d}</div>
                    ))}
                </div>

                {/* Day cells */}
                <div className="grid grid-cols-7 gap-1">
                    {cells.map((day, i) => {
                        if (day === null) return <div key={`blank-${i}`} />;

                        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const hasReading = readingDates.has(dateStr);
                        const isToday = dateStr === todayStr;
                        const isFuture = dateStr > todayStr;

                        return (
                            <button
                                key={dateStr}
                                onClick={() => !isFuture && onDateClick?.(dateStr)}
                                disabled={isFuture}
                                className={`relative flex flex-col items-center justify-center h-9 sm:h-10 rounded-lg text-xs sm:text-sm transition-all
                                    ${isFuture ? 'text-gray-300 cursor-not-allowed' : 'hover:bg-gray-100 cursor-pointer'}
                                    ${isToday ? 'ring-2 ring-primary/40 font-bold text-primary' : 'text-gray-700'}
                                    ${hasReading ? 'font-semibold' : ''}
                                `}
                            >
                                {day}
                                {hasReading && (
                                    <span
                                        className="absolute bottom-1 w-1.5 h-1.5 rounded-full"
                                        style={{ backgroundColor: accentColor }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </div>

                {/* Legend */}
                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100">
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: accentColor }} />
                        Mesure existante
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] text-gray-500">
                        <Plus size={10} />
                        Cliquez pour ajouter
                    </div>
                </div>
            </CardContent>
        </Card>
    );
};

const AddVitalForm = ({ patientId, currentUser, onSuccess, onCancel, initialType = 'Glucose', initialDate, vitalTypes = DEFAULT_VITAL_TYPES }) => {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [type, setType] = useState(initialType);
    const [formData, setFormData] = useState({
        date: initialDate || new Date().toISOString().split('T')[0],
        time: new Date().toTimeString().slice(0, 5),
        value: '',
        systolic: '',
        diastolic: '',
        subtype: 'Fasting'
    });

    const currentVtConfig = findVitalType(vitalTypes, type);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const token = await currentUser.getIdToken();
            const payload = buildPayload(currentVtConfig, formData);

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
                                {vitalTypes.map(vt => (
                                    <option key={vt.key} value={vt.key}>{getVitalLabelFr(vt.key)}</option>
                                ))}
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

                        {/* Subtype selector (e.g., Glucose fasting/post-prandial) */}
                        {currentVtConfig?.extras?.subtypes && (
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Contexte</label>
                                <select
                                    value={formData.subtype}
                                    onChange={e => setFormData({ ...formData, subtype: e.target.value })}
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary p-2 border"
                                >
                                    {currentVtConfig.extras.subtypes.map(st => (
                                        <option key={st} value={st}>{st === 'Fasting' ? 'À Jeun' : st === 'Post-Prandial' ? 'Après repas (2h)' : st}</option>
                                    ))}
                                </select>
                            </div>
                        )}

                        {/* Dynamic form fields from config */}
                        {currentVtConfig?.chartType === 'dual' ? (
                            <div className="grid grid-cols-2 gap-4">
                                {currentVtConfig.formFields.map(field => (
                                    <div key={field}>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{getFieldLabelFr(field)}</label>
                                        <Input
                                            type="number"
                                            required
                                            min="30"
                                            max="300"
                                            value={formData[field] || ''}
                                            onChange={e => setFormData({ ...formData, [field]: e.target.value })}
                                            placeholder={field === 'systolic' ? '120' : '80'}
                                        />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            currentVtConfig?.formFields?.map(field => (
                                <div key={field}>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">{getFieldLabelFr(field)}</label>
                                    <Input
                                        type="number"
                                        step={field === 'weight' || field === 'temperature' ? '0.1' : '1'}
                                        required
                                        min="0"
                                        value={formData[field] ?? formData.value ?? ''}
                                        onChange={e => setFormData({ ...formData, [field]: e.target.value, value: e.target.value })}
                                        placeholder={`Ex: ${field === 'glucose' ? '110' : field === 'weight' ? '75.5' : ''}`}
                                    />
                                </div>
                            ))
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
