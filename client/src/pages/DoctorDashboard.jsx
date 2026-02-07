import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Users, AlertCircle, CheckCircle, Clock, TrendingDown, MessageSquare, Edit, Eye, Calendar, Phone, Mail, ArrowRight } from 'lucide-react';
import Button from '../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';

const DoctorDashboard = () => {
    const navigate = useNavigate();
    const { currentUser, doctorProfile } = useAuth();
    const [patients, setPatients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filterStatus, setFilterStatus] = useState('all');
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('lastVisit');

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
            'Critical': 'bg-red-50 border-red-200 text-red-900',
            'Attention Needed': 'bg-yellow-50 border-yellow-200 text-yellow-900',
            'Stable': 'bg-green-50 border-green-200 text-green-900'
        };
        return colors[status] || 'bg-gray-50 border-gray-200 text-gray-900';
    };

    const getStatusIcon = (status) => {
        const icons = {
            'Critical': <AlertCircle className="w-4 h-4 text-red-600" />,
            'Attention Needed': <Clock className="w-4 h-4 text-yellow-600" />,
            'Stable': <CheckCircle className="w-4 h-4 text-green-600" />
        };
        return icons[status] || <Clock className="w-4 h-4" />;
    };

    const handleViewPatient = (patientId) => {
        navigate(`/patient/${patientId}`);
    };

    const handleMessagePatient = (patientId) => {
        // Navigate to messaging with pre-selected patient
        navigate('/messagerie', { state: { patientId } });
    };

    const handleEditPatient = (patientId) => {
        navigate(`/edit-patient/${patientId}`);
    };

    const handleAddAppointment = (patientId) => {
        navigate(`/appointments?patientId=${patientId}`);
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="container py-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h1 className="text-3xl font-bold text-gray-900">Tableau de Bord</h1>
                            <p className="text-gray-600 mt-1">Gestion de vos patients du diabète</p>
                        </div>
                        <div className="flex items-center gap-2 text-gray-600">
                            <Users size={20} />
                            <span className="font-medium">{stats.total} patients</span>
                        </div>
                    </div>
                </div>
            </header>

            <main className="container py-8">
                {/* Statistics Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 font-medium">Total Patients</p>
                                    <p className="text-3xl font-bold text-gray-900 mt-2">{stats.total}</p>
                                </div>
                                <Users className="w-12 h-12 text-blue-100 rounded-full p-3 bg-blue-50" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-red-600 font-medium">Cas Critiques</p>
                                    <p className="text-3xl font-bold text-red-600 mt-2">{stats.critical}</p>
                                </div>
                                <AlertCircle className="w-12 h-12 text-red-100 rounded-full p-3 bg-red-50" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-yellow-600 font-medium">Attention Requise</p>
                                    <p className="text-3xl font-bold text-yellow-600 mt-2">{stats.attention}</p>
                                </div>
                                <Clock className="w-12 h-12 text-yellow-100 rounded-full p-3 bg-yellow-50" />
                            </div>
                        </CardContent>
                    </Card>

                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-green-600 font-medium">Stables</p>
                                    <p className="text-3xl font-bold text-green-600 mt-2">{stats.stable}</p>
                                </div>
                                <CheckCircle className="w-12 h-12 text-green-100 rounded-full p-3 bg-green-50" />
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Controls */}
                <Card className="mb-6">
                    <CardContent className="pt-6">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            {/* Search Box */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Rechercher</label>
                                <input
                                    type="text"
                                    placeholder="Nom, email ou téléphone..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            {/* Status Filter */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Filtrer par Statut</label>
                                <select
                                    value={filterStatus}
                                    onChange={(e) => setFilterStatus(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="all">Tous les statuts</option>
                                    <option value="Critical">Critiques</option>
                                    <option value="Attention Needed">Attention Requise</option>
                                    <option value="Stable">Stables</option>
                                </select>
                            </div>

                            {/* Sort By */}
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">Trier par</label>
                                <select
                                    value={sortBy}
                                    onChange={(e) => setSortBy(e.target.value)}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="lastVisit">Dernière Visite</option>
                                    <option value="name">Nom</option>
                                    <option value="status">Statut</option>
                                </select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Loading State */}
                {loading && (
                    <div className="flex justify-center items-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <Card className="border-red-200 bg-red-50">
                        <CardContent className="pt-6 flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div>
                                <p className="text-red-900 font-medium">{error}</p>
                                <p className="text-red-700 text-sm mt-1">Veuillez rafraîchir la page ou réessayer</p>
                            </div>
                        </CardContent>
                    </Card>
                )}

                {/* Empty State */}
                {!loading && !error && filteredPatients.length === 0 && (
                    <Card className="border-gray-200 bg-gray-50">
                        <CardContent className="pt-12 pb-12 text-center">
                            <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                            <p className="text-gray-600 text-lg font-medium mb-2">Aucun patient trouvé</p>
                            <p className="text-gray-500 mb-6">
                                {searchTerm ? 'Aucun patient ne correspond à votre recherche.' : 'Vous n\'avez pas encore de patients.'}
                            </p>
                            {searchTerm && (
                                <Button
                                    onClick={() => {
                                        setSearchTerm('');
                                        setFilterStatus('all');
                                    }}
                                    variant="outline"
                                >
                                    Réinitialiser les filtres
                                </Button>
                            )}
                        </CardContent>
                    </Card>
                )}

                {/* Patients List */}
                {!loading && !error && filteredPatients.length > 0 && (
                    <div className="space-y-4">
                        {filteredPatients.map((patient) => (
                            <Card key={patient.id} className="hover:shadow-md transition-shadow">
                                <CardContent className="pt-6">
                                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                                        {/* Patient Info */}
                                        <div className="flex-1">
                                            <div className="flex items-start gap-4">
                                                {/* Avatar */}
                                                <div className="flex-shrink-0">
                                                    <div className="w-12 h-12 bg-gradient-to-br from-blue-400 to-blue-600 rounded-full flex items-center justify-center text-white font-bold text-lg">
                                                        {patient.name?.charAt(0) || 'P'}
                                                    </div>
                                                </div>

                                                {/* Details */}
                                                <div className="flex-1 min-w-0">
                                                    <h3 className="text-lg font-semibold text-gray-900">{patient.name}</h3>
                                                    <div className="flex flex-wrap items-center gap-3 mt-2 text-sm">
                                                        {patient.type && (
                                                            <span className="px-2.5 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs font-medium">
                                                                {patient.type}
                                                            </span>
                                                        )}
                                                        {patient.age && (
                                                            <span className="text-gray-600">{patient.age} ans</span>
                                                        )}
                                                        {patient.email && (
                                                            <div className="flex items-center gap-1 text-gray-600">
                                                                <Mail size={14} />
                                                                <a href={`mailto:${patient.email}`} className="hover:text-blue-600 truncate">
                                                                    {patient.email}
                                                                </a>
                                                            </div>
                                                        )}
                                                        {patient.phone && (
                                                            <div className="flex items-center gap-1 text-gray-600">
                                                                <Phone size={14} />
                                                                <a href={`tel:${patient.phone}`}>{patient.phone}</a>
                                                            </div>
                                                        )}
                                                    </div>

                                                    {/* Status and Last Visit */}
                                                    <div className="flex flex-wrap items-center gap-3 mt-3">
                                                        <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${getStatusColor(patient.status)}`}>
                                                            {getStatusIcon(patient.status)}
                                                            <span className="text-sm font-medium">{patient.status}</span>
                                                        </div>
                                                        {patient.lastVisit && (
                                                            <span className="text-xs text-gray-600">
                                                                Visite: {new Date(patient.lastVisit).toLocaleDateString('fr-FR')}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Actions */}
                                        <div className="flex flex-wrap gap-2 justify-end">
                                            <button
                                                onClick={() => handleViewPatient(patient.id)}
                                                className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                                title="Voir le détail"
                                            >
                                                <Eye size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleMessagePatient(patient.id)}
                                                className="p-2 text-gray-600 hover:bg-blue-100 rounded-lg transition-colors hover:text-blue-600"
                                                title="Envoyer un message"
                                            >
                                                <MessageSquare size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleAddAppointment(patient.id)}
                                                className="p-2 text-gray-600 hover:bg-green-100 rounded-lg transition-colors hover:text-green-600"
                                                title="Planifier un rendez-vous"
                                            >
                                                <Calendar size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleEditPatient(patient.id)}
                                                className="p-2 text-gray-600 hover:bg-yellow-100 rounded-lg transition-colors hover:text-yellow-600"
                                                title="Éditer"
                                            >
                                                <Edit size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleViewPatient(patient.id)}
                                                className="p-2 text-gray-600 hover:bg-indigo-100 rounded-lg transition-colors hover:text-indigo-600"
                                            >
                                                <ArrowRight size={18} />
                                            </button>
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        ))}

                        {/* Results Count */}
                        <div className="text-sm text-gray-600 text-center pt-4">
                            Affichage de {filteredPatients.length} patient{filteredPatients.length > 1 ? 's' : ''} sur {patients.length}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default DoctorDashboard;
