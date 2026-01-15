import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Button from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Input from '../components/ui/Input';
import Skeleton from '../components/ui/Skeleton';
import { MessageSquare, Plus, Trash2, Edit, ChevronRight, Calendar, User, Activity, LogOut, Banknote, CreditCard } from 'lucide-react'; // Assuming lucide-react is installed
import { useAuth } from '../context/AuthContext';

const Dashboard = () => {
    const queryClient = useQueryClient();
    const { userRole, doctorProfile } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');

    // Fetch Patients
    const { data: patients = [], isLoading: loadingPatients } = useQuery({
        queryKey: ['patients', doctorProfile?.id],
        queryFn: () => {
            if (!doctorProfile?.id) return [];
            return fetch(`${import.meta.env.VITE_API_URL || ''}/api/patients?doctorId=${doctorProfile.id}`)
                .then(res => {
                    if (!res.ok) throw new Error('Network response was not ok');
                    return res.json();
                });
        },
        enabled: !!doctorProfile?.id,
    });

    // Fetch Appointments
    const { data: appointments = [], isLoading: loadingApts } = useQuery({
        queryKey: ['appointments', doctorProfile?.id],
        queryFn: () => {
            if (!doctorProfile?.id) return [];
            return fetch(`${import.meta.env.VITE_API_URL}/api/appointments?doctorId=${doctorProfile.id}`)
                .then(res => {
                    if (!res.ok) throw new Error('Network response was not ok');
                    return res.json();
                });
        },
        enabled: !!doctorProfile?.id,
    });

    const loading = loadingPatients || loadingApts;

    // Delete Mutation
    const deletePatientMutation = useMutation({
        mutationFn: (id) => fetch(`${import.meta.env.VITE_API_URL}/api/patients/${id}`, { method: 'DELETE' }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['patients'] });
        },
    });

    // Update Status Mutation
    const updateStatusMutation = useMutation({
        mutationFn: ({ id, status }) => fetch(`${import.meta.env.VITE_API_URL}/api/appointments/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status })
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
        },
    });

    const handleDelete = (id) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer ce patient ?")) {
            deletePatientMutation.mutate(id);
        }
    };

    const handleAppointmentStatus = (id, status) => {
        updateStatusMutation.mutate({ id, status });
    };

    const pendingAppointments = appointments.filter(a => a.status === 'pending');
    const confirmedAppointments = appointments.filter(a => a.status === 'confirmed');

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-gray-900">
            <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="container flex items-center justify-between h-16">
                    <div className="text-xl font-bold text-primary flex items-center gap-2">
                        <Activity className="text-primary" size={24} /> GlucoSoin <span className="text-xs font-normal text-gray-500 hidden sm:inline-block">/ Tableau de Bord</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-gray-700 hidden sm:block">
                            {doctorProfile ? doctorProfile.name : "Dr. Spécialiste"}
                        </span>
                        <div className="w-9 h-9 bg-primary/10 text-primary rounded-full flex items-center justify-center text-sm font-bold border border-primary/20 overflow-hidden">
                            {doctorProfile?.photo ? (
                                <img src={doctorProfile.photo} alt={doctorProfile.name} className="w-full h-full object-cover" />
                            ) : (
                                "DR"
                            )}
                        </div>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={useAuth().logout}
                            className="text-gray-500 hover:text-red-500 ml-2"
                            title="Déconnexion"
                        >
                            <LogOut size={18} />
                        </Button>
                    </div>
                </div>
            </nav>

            <main className="container py-8 space-y-8">
                {/* Revenue Section */}
                {doctorProfile && (
                    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 flex items-center justify-between">
                        <div>
                            <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Revenu Total</h2>
                            <div className="text-3xl font-bold text-gray-900 mt-1">
                                {(doctorProfile.totalRevenue || 0).toLocaleString('fr-CD', { style: 'currency', currency: 'CDF' })}
                            </div>
                            <p className="text-xs text-gray-400 mt-1">Part Médecin (90%)</p>
                        </div>
                        <div className="bg-green-50 p-4 rounded-full">
                            <Banknote size={32} className="text-green-600" />
                        </div>
                    </div>
                )}

                {/* Appointment Requests Section */}
                <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Calendar size={20} className="text-gray-500" />
                        Demandes de Rendez-vous
                        {pendingAppointments.length > 0 && <Badge variant="warning" className="ml-2">{pendingAppointments.length}</Badge>}
                    </h2>
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full" />)}
                        </div>
                    ) : pendingAppointments.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {pendingAppointments.map(apt => (
                                <Card key={apt.id} className="border-l-4 border-l-orange-400">
                                    <CardContent className="p-5">
                                        <div className="flex justify-between items-start mb-3">
                                            <h3 className="font-semibold text-gray-900">{apt.patientName}</h3>
                                            <Badge variant="warning">En attente</Badge>
                                        </div>
                                        <div className="space-y-1 mb-4">
                                            <p className="text-sm text-gray-600 flex items-center gap-2">
                                                <Calendar size={14} /> {apt.date} à {apt.time}
                                            </p>
                                            <p className="text-sm text-gray-500 italic">"{apt.reason}"</p>
                                        </div>
                                        <div className="flex gap-2">
                                            <Button
                                                variant="secondary"
                                                className="flex-1 bg-green-50 text-green-700 border-green-200 hover:bg-green-100 hover:border-green-300"
                                                onClick={() => handleAppointmentStatus(apt.id, 'confirmed')}
                                            >
                                                Accepter
                                            </Button>
                                            <Button
                                                variant="secondary"
                                                className="flex-1 bg-red-50 text-red-700 border-red-200 hover:bg-red-100 hover:border-red-300"
                                                onClick={() => handleAppointmentStatus(apt.id, 'rejected')}
                                            >
                                                Refuser
                                            </Button>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white p-8 rounded-xl border border-dashed border-gray-300 text-center text-gray-500">
                            <p>Aucune demande de rendez-vous en attente.</p>
                        </div>
                    )}
                </div>

                {/* Upcoming Consultations Section */}
                <div>
                    <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                        <Calendar size={20} className="text-gray-500" />
                        Prochaines Consultations
                        {confirmedAppointments.length > 0 && <Badge variant="secondary" className="ml-2 bg-blue-100 text-blue-800 hover:bg-blue-200">{confirmedAppointments.length}</Badge>}
                    </h2>
                    {loading ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {[1, 2, 3].map(i => <Skeleton key={i} className="h-40 w-full" />)}
                        </div>
                    ) : confirmedAppointments.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {confirmedAppointments.map(apt => (
                                <Card key={apt.id} className="border-l-4 border-l-blue-500">
                                    <CardContent className="p-5">
                                        <div className="flex justify-between items-start mb-3">
                                            <h3 className="font-semibold text-gray-900">{apt.patientName}</h3>
                                            <Badge variant="secondary" className="bg-blue-100 text-blue-800 hover:bg-blue-200">Confirmé</Badge>
                                        </div>
                                        <div className="space-y-1 mb-4">
                                            <p className="text-sm text-gray-600 flex items-center gap-2">
                                                <Calendar size={14} /> {apt.date} à {apt.time}
                                            </p>
                                            <p className="text-sm text-gray-500 italic">"{apt.reason}"</p>
                                        </div>
                                        <Button
                                            variant="outline"
                                            className="w-full text-gray-600 border-gray-200 hover:bg-gray-50"
                                            onClick={() => handleAppointmentStatus(apt.id, 'completed')}
                                        >
                                            Marquer comme terminé
                                        </Button>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    ) : (
                        <div className="bg-white p-8 rounded-xl border border-dashed border-gray-300 text-center text-gray-500">
                            <p>Aucune consultation à venir.</p>
                        </div>
                    )}
                </div>

                {/* Patient List Section */}
                <div>
                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                            <User size={28} className="text-gray-700" /> Aperçu des Patients
                        </h1>
                        <div className="flex gap-3 w-full md:w-auto">
                            <Link to="/terminal" className="w-full md:w-auto">
                                <Button variant="secondary" className="w-full gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200">
                                    <CreditCard size={18} /> Terminal Paiement
                                </Button>
                            </Link>
                            <Link to="/messaging" className="w-full md:w-auto">
                                <Button variant="secondary" className="w-full gap-2">
                                    <MessageSquare size={18} /> Messagerie
                                </Button>
                            </Link>
                            <Link to="/add-patient" className="w-full md:w-auto">
                                <Button className="w-full gap-2">
                                    <Plus size={18} /> Ajouter un Patient
                                </Button>
                            </Link>
                            {userRole === 'admin' && (
                                <Link to="/add-doctor" className="w-full md:w-auto">
                                    <Button variant="outline" className="w-full gap-2">
                                        <Plus size={18} /> Ajouter Médecin
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </div>

                    <div className="mb-6">
                        <Input
                            type="text"
                            placeholder="Rechercher un patient par nom..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="max-w-md shadow-sm"
                        />
                    </div>

                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 w-full" />)}
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-4">
                            {patients.filter(patient =>
                                patient.name.toLowerCase().includes(searchTerm.toLowerCase())
                            ).map(patient => (
                                <Card key={patient.id} className="hover:shadow-md transition-shadow duration-200 group">
                                    <CardContent className="p-0 sm:p-0"> {/* Override defaults for custom layout if needed, but CardContent standard is good usually. Let's use standard padding */}
                                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-3 mb-1">
                                                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-primary transition-colors">{patient.name}</h3>
                                                    <Badge variant={
                                                        patient.status === 'Critical' ? 'danger' :
                                                            patient.status === 'Attention Needed' ? 'warning' : 'success'
                                                    }>
                                                        {patient.status === 'Critical' ? 'Critique' : patient.status === 'Attention Needed' ? 'Attention' : 'Stable'}
                                                    </Badge>
                                                </div>
                                                <p className="text-sm text-gray-500 flex items-center gap-4">
                                                    <span>ID: <span className="font-mono text-gray-700">#{patient.id}</span></span>
                                                    <span>Âge: {patient.age}</span>
                                                    <span className="bg-gray-100 text-gray-600 px-2 py-0.5 rounded text-xs">{patient.type}</span>
                                                </p>
                                            </div>

                                            <div className="flex flex-wrap items-center gap-6 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-4 md:pt-0 border-gray-100 mt-2 md:mt-0">
                                                <div className="text-left md:text-right hidden sm:block">
                                                    <div className="text-xs text-gray-400 uppercase font-bold tracking-wider mb-0.5">Dernière Visite</div>
                                                    <div className="text-sm font-medium text-gray-700">{patient.lastVisit}</div>
                                                </div>

                                                <div className="flex gap-2">
                                                    <Link to={`/patients/${patient.id}`}>
                                                        <Button variant="secondary" size="sm" className="gap-1 text-primary border-primary/20 bg-primary/5 hover:bg-primary/10">
                                                            Détails <ChevronRight size={14} />
                                                        </Button>
                                                    </Link>
                                                    <Link to={`/edit-patient/${patient.id}`}>
                                                        <Button variant="ghost" size="icon" title="Modifier">
                                                            <Edit size={16} className="text-gray-500" />
                                                        </Button>
                                                    </Link>
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleDelete(patient.id)}
                                                        className="hover:text-red-600 hover:bg-red-50"
                                                        title="Supprimer"
                                                    >
                                                        <Trash2 size={16} />
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
};

export default Dashboard;
