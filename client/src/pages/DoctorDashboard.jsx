import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
    Users, AlertCircle, CheckCircle, Clock, MessageSquare, Edit, Eye,
    Calendar, Phone, Mail, ArrowRight, Menu, LayoutDashboard, User,
    Settings, LogOut, Activity, Search, SlidersHorizontal, Stethoscope
} from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import BetaBadge from '../components/ui/BetaBadge';
import RoleSwitcher from '../components/RoleSwitcher';
import NotificationBell from '../components/NotificationBell';
import Sidebar from '../components/Sidebar';
import DoctorProfileEdit from '../components/DoctorProfileEdit';
import DoctorCalendar from './DoctorCalendar';

const DoctorDashboard = () => {
    const navigate = useNavigate();
    const { currentUser, doctorProfile, logout } = useAuth();
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('lastVisit');
    const [activeTab, setActiveTab] = useState('patients');
    const [sidebarOpen, setSidebarOpen] = useState(false);

    const navGroups = [
        {
            label: 'Principal',
            items: [
                { id: 'patients', label: 'Tableau de Bord', icon: LayoutDashboard },
                { id: 'calendar', label: 'Calendrier', icon: Calendar },
                { id: 'messaging', label: 'Messagerie', icon: MessageSquare },
            ]
        },
        {
            label: 'Compte',
            items: [
                { id: 'profile', label: 'Mon Profil', icon: User },
                { id: 'settings', label: 'Parametres', icon: Settings },
            ]
        }
    ];

    // Handle sidebar tab changes — messaging navigates to its own page
    const handleTabChange = (tabId) => {
        if (tabId === 'messaging') {
            navigate('/messaging');
            return;
        }
        setActiveTab(tabId);
    };

    // Fetch patients for this doctor
    useEffect(() => {
        const fetchPatients = async () => {
            if (!doctorProfile?.id || !currentUser) {
                setError('Doctor profile not loaded');
                setLoading(false);
                return;
            }

            try {
                const token = await currentUser.getIdToken();
                const response = await fetch(
                    `${import.meta.env.VITE_API_URL || ''}/api/patients?doctorId=${doctorProfile.id}`,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );

                if (!response.ok) throw new Error('Failed to fetch patients');
                const data = await response.json();
                setPatients(Array.isArray(data) ? data : []);
                setError(null);
            } catch (err) {
                console.error('Error fetching patients:', err);
                setError('Unable to load your patients');
            } finally {
                setLoading(false);
            }
        };

        fetchPatients();
    }, [doctorProfile, currentUser]);

    // Filter and sort patients
    const filteredPatients = patients
        .filter(p => {
            const matchesStatus = filterStatus === 'all' || p.status === filterStatus;
            const matchesSearch =
                p.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                p.phone?.includes(searchTerm);
            return matchesStatus && matchesSearch;
        })
        .sort((a, b) => {
            if (sortBy === 'name') return a.name.localeCompare(b.name);
            if (sortBy === 'lastVisit') {
                const dateA = new Date(a.lastVisit || 0);
                const dateB = new Date(b.lastVisit || 0);
                return dateB - dateA;
            }
            if (sortBy === 'status') {
                const statusOrder = { 'Critical': 0, 'Attention Needed': 1, 'Stable': 2 };
                return (statusOrder[a.status] || 3) - (statusOrder[b.status] || 3);
            }
            return 0;
        });

    // Calculate statistics
    const stats = {
        total: patients.length,
        critical: patients.filter(p => p.status === 'Critical').length,
        attention: patients.filter(p => p.status === 'Attention Needed').length,
        stable: patients.filter(p => p.status === 'Stable').length,
    };

    const getStatusColor = (status) => {
        const colors = {
            'Critical': 'bg-red-50 border-red-200 text-red-800',
            'Attention Needed': 'bg-amber-50 border-amber-200 text-amber-800',
            'Stable': 'bg-emerald-50 border-emerald-200 text-emerald-800'
        };
        return colors[status] || 'bg-gray-50 border-gray-200 text-gray-800';
    };

    const getStatusIcon = (status) => {
        const icons = {
            'Critical': <AlertCircle className="w-3.5 h-3.5 text-red-600" />,
            'Attention Needed': <Clock className="w-3.5 h-3.5 text-amber-600" />,
            'Stable': <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
        };
        return icons[status] || <Clock className="w-3.5 h-3.5" />;
    };

    const handleViewPatient = (patientId) => {
        navigate(`/patients/${patientId}`);
    };

    const handleMessagePatient = (patientId) => {
        navigate('/messaging', { state: { patientId } });
    };

    const handleEditPatient = (patientId) => {
        navigate(`/edit-patient/${patientId}`);
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-gray-900">
            {/* ─── Branded Header ─── */}
            <nav className="bg-white border-b border-gray-200 sticky top-0 z-30">
                <div className="container flex items-center justify-between h-16 gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            className="lg:hidden p-2 -ml-2 text-gray-500 hover:text-primary rounded-lg hover:bg-gray-100"
                            onClick={() => setSidebarOpen(true)}
                        >
                            <Menu size={24} />
                        </button>
                        <div className="text-xl font-bold text-primary flex items-center gap-2">
                            <Activity className="text-primary" size={24} /> GlucoCare <BetaBadge />
                            <span className="text-xs font-normal text-gray-500 hidden sm:inline-block">/ Espace Medecin</span>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <NotificationBell />
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
                onTabChange={handleTabChange}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            <main className="lg:ml-64 min-h-[calc(100vh-4rem)]">
                <div className="container py-4 sm:py-8 px-3 sm:px-4 space-y-6 sm:space-y-8">

                {/* ═══ PATIENTS TAB ═══ */}
                {activeTab === 'patients' && (<>
                    {/* Welcome Card */}
                    <Card className="bg-gradient-to-r from-primary/5 to-white border-primary/10">
                        <CardContent className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            <div className="flex items-center gap-4">
                                <div className="hidden sm:flex w-14 h-14 rounded-full bg-gradient-to-br from-primary to-blue-600 items-center justify-center text-white shadow-md flex-shrink-0">
                                    {doctorProfile?.image ? (
                                        <img src={doctorProfile.image} alt="" className="w-full h-full rounded-full object-cover" />
                                    ) : (
                                        <Stethoscope size={24} />
                                    )}
                                </div>
                                <div>
                                    <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                                        Bonjour, Dr. {doctorProfile?.name?.split(' ').pop() || 'Medecin'}
                                    </h1>
                                    <div className="flex flex-wrap items-center gap-3 mt-1.5">
                                        <span className="text-gray-500 text-sm flex items-center gap-1.5">
                                            <Stethoscope size={14} /> {doctorProfile?.specialty || 'Specialiste'}
                                        </span>
                                        <div className="hidden sm:flex items-center gap-1.5 bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100">
                                            <Users size={14} className="text-primary" />
                                            <span className="text-xs font-medium text-gray-600">{stats.total} patient{stats.total !== 1 ? 's' : ''}</span>
                                        </div>
                                        {stats.critical > 0 && (
                                            <div className="flex items-center gap-1.5 bg-red-50 px-3 py-1 rounded-full border border-red-100">
                                                <AlertCircle size={14} className="text-red-500" />
                                                <span className="text-xs font-medium text-red-700">{stats.critical} critique{stats.critical > 1 ? 's' : ''}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="hidden sm:flex"
                                    onClick={() => setActiveTab('calendar')}
                                >
                                    <Calendar size={16} className="mr-2" /> Calendrier
                                </Button>
                                <Button
                                    size="sm"
                                    className="shadow-md"
                                    onClick={() => navigate('/messaging')}
                                >
                                    <MessageSquare size={16} className="mr-2" /> Messagerie
                                </Button>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Statistics Cards */}
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                        {[
                            { label: 'Total Patients', value: stats.total, color: 'blue', icon: Users },
                            { label: 'Cas Critiques', value: stats.critical, color: 'red', icon: AlertCircle },
                            { label: 'Attention Requise', value: stats.attention, color: 'amber', icon: Clock },
                            { label: 'Stables', value: stats.stable, color: 'emerald', icon: CheckCircle },
                        ].map(({ label, value, color, icon: Icon }) => (
                            <Card key={label} className="group hover:shadow-md transition-shadow">
                                <CardContent className="pt-5 pb-4">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className={`text-xs sm:text-sm font-medium text-${color}-600`}>{label}</p>
                                            <p className={`text-2xl sm:text-3xl font-bold text-${color}-700 mt-1`}>{value}</p>
                                        </div>
                                        <div className={`w-10 h-10 sm:w-11 sm:h-11 rounded-xl bg-${color}-50 flex items-center justify-center group-hover:scale-110 transition-transform`}>
                                            <Icon className={`w-5 h-5 sm:w-6 sm:h-6 text-${color}-400`} />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}
                    </div>

                    {/* Search & Filters — Compact inline bar */}
                    <div className="flex flex-col sm:flex-row gap-3">
                        <div className="relative flex-1">
                            <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Rechercher un patient..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
                            />
                        </div>
                        <div className="flex gap-2">
                            <div className="relative">
                                <SlidersHorizontal size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="pl-9 pr-8 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary appearance-none cursor-pointer"
                                >
                                    <option value="all">Tous</option>
                                    <option value="Critical">Critiques</option>
                                    <option value="Attention Needed">Attention</option>
                                    <option value="Stable">Stables</option>
                                </select>
                            </div>
                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value)}
                                className="px-3 py-2.5 bg-white border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary appearance-none cursor-pointer"
                            >
                                <option value="lastVisit">Derniere Visite</option>
                                <option value="name">Nom</option>
                                <option value="status">Statut</option>
                            </select>
                        </div>
                    </div>

                    {/* Loading State */}
                    {loading && (
                        <div className="flex flex-col items-center justify-center py-16 gap-3">
                            <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
                            <p className="text-sm text-gray-400">Chargement des patients...</p>
                        </div>
                    )}

                    {/* Error State */}
                    {error && (
                        <Card className="border-red-200 bg-red-50/50">
                            <CardContent className="py-6 flex items-start gap-3">
                                <div className="w-9 h-9 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                                    <AlertCircle className="w-5 h-5 text-red-600" />
                                </div>
                                <div>
                                    <p className="text-red-900 font-medium">{error}</p>
                                    <p className="text-red-600 text-sm mt-1">Veuillez rafraichir la page ou reessayer.</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Empty State */}
                    {!loading && !error && filteredPatients.length === 0 && (
                        <Card className="border-dashed border-2 border-gray-200 bg-gray-50/50">
                            <CardContent className="py-16 text-center">
                                <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
                                    <Users className="w-8 h-8 text-gray-300" />
                                </div>
                                <p className="text-gray-700 text-lg font-medium mb-1">Aucun patient trouve</p>
                                <p className="text-gray-400 text-sm mb-6 max-w-sm mx-auto">
                                    {searchTerm ? 'Aucun patient ne correspond a votre recherche.' : "Vous n'avez pas encore de patients."}
                                </p>
                                {searchTerm && (
                                    <Button
                                        onClick={() => { setSearchTerm(''); setFilterStatus('all'); }}
                                        variant="outline"
                                        size="sm"
                                    >
                                        Reinitialiser les filtres
                                    </Button>
                                )}
                            </CardContent>
                        </Card>
                    )}

                    {/* Patients List */}
                    {!loading && !error && filteredPatients.length > 0 && (
                        <div className="space-y-3">
                            {filteredPatients.map((patient) => (
                                <Card
                                    key={patient.id}
                                    className="group hover:shadow-md hover:border-primary/20 transition-all cursor-pointer"
                                    onClick={() => handleViewPatient(patient.id)}
                                >
                                    <CardContent className="py-4 sm:py-5">
                                        <div className="flex items-center gap-3 sm:gap-4">
                                            {/* Avatar */}
                                            <div className="flex-shrink-0">
                                                <div className="w-11 h-11 sm:w-12 sm:h-12 bg-gradient-to-br from-primary/80 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-base shadow-sm">
                                                    {patient.name?.charAt(0) || 'P'}
                                                </div>
                                            </div>

                                            {/* Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">{patient.name}</h3>
                                                    {patient.type && (
                                                        <span className="px-2 py-0.5 bg-primary/10 text-primary rounded-full text-[11px] font-medium whitespace-nowrap">
                                                            {patient.type}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs text-gray-500">
                                                    {patient.age && <span>{patient.age} ans</span>}
                                                    {patient.phone && (
                                                        <span className="flex items-center gap-1">
                                                            <Phone size={11} /> {patient.phone}
                                                        </span>
                                                    )}
                                                    {patient.lastVisit && (
                                                        <span className="flex items-center gap-1">
                                                            <Clock size={11} /> {new Date(patient.lastVisit).toLocaleDateString('fr-FR')}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Status Badge */}
                                            <div className="flex-shrink-0 hidden sm:block">
                                                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${getStatusColor(patient.status)}`}>
                                                    {getStatusIcon(patient.status)}
                                                    <span className="hidden md:inline">{patient.status}</span>
                                                </div>
                                            </div>

                                            {/* Actions */}
                                            <div className="flex items-center gap-1 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={() => handleMessagePatient(patient.id)}
                                                    className="p-2 text-gray-400 hover:bg-blue-50 hover:text-blue-600 rounded-lg transition-colors"
                                                    title="Message"
                                                >
                                                    <MessageSquare size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleEditPatient(patient.id)}
                                                    className="p-2 text-gray-400 hover:bg-amber-50 hover:text-amber-600 rounded-lg transition-colors"
                                                    title="Editer"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleViewPatient(patient.id)}
                                                    className="p-2 text-gray-400 hover:bg-primary/10 hover:text-primary rounded-lg transition-colors"
                                                    title="Voir"
                                                >
                                                    <ArrowRight size={16} />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Mobile status badge — below the row */}
                                        <div className="sm:hidden mt-2 ml-14">
                                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-medium ${getStatusColor(patient.status)}`}>
                                                {getStatusIcon(patient.status)}
                                                {patient.status}
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}

                            {/* Results Count */}
                            <p className="text-xs text-gray-400 text-center pt-2 pb-4">
                                {filteredPatients.length} sur {patients.length} patient{patients.length > 1 ? 's' : ''}
                            </p>
                        </div>
                    )}
                </>)}

                {/* ═══ CALENDAR TAB ═══ */}
                {activeTab === 'calendar' && (
                    <DoctorCalendar embedded />
                )}

                {/* ═══ PROFILE TAB ═══ */}
                {activeTab === 'profile' && (
                    <DoctorProfileEdit />
                )}

                {/* ═══ SETTINGS TAB ═══ */}
                {activeTab === 'settings' && (
                    <Card>
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2">
                                <Settings size={20} className="text-primary" />
                                Parametres
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-gray-500 text-sm">Les parametres de notification et de compte seront disponibles prochainement.</p>
                        </CardContent>
                    </Card>
                )}

                </div>
            </main>
        </div>
    );
};

export default DoctorDashboard;
