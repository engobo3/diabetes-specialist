import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import Button from '../components/ui/Button';
import { Card, CardContent } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import BetaBadge from '../components/ui/BetaBadge';
import Input from '../components/ui/Input';
import Skeleton from '../components/ui/Skeleton';
import { MessageSquare, Plus, Trash2, Edit, ChevronRight, Calendar, User, Activity, LogOut, Banknote, CreditCard, Stethoscope, BarChart3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import RoleSwitcher from '../components/RoleSwitcher';

const Dashboard = () => {
    const queryClient = useQueryClient();
    const { userRole, userRoles, activeRole, doctorProfile, currentUser, logout } = useAuth();
    const [searchTerm, setSearchTerm] = useState('');
    const [doctorSearchTerm, setDoctorSearchTerm] = useState('');

    const isAdmin = activeRole === 'admin';

    // ========== DOCTOR VIEW QUERIES ==========

    // Fetch Patients (doctor's patients)
    const { data: patients = [], isLoading: loadingPatients } = useQuery({
        queryKey: ['patients', doctorProfile?.id],
        queryFn: async () => {
            if (!doctorProfile?.id || !currentUser) return [];
            const token = await currentUser.getIdToken();
            return fetch(`${import.meta.env.VITE_API_URL || ''}/api/patients?doctorId=${doctorProfile.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
                .then(async res => {
                    if (!res.ok) {
                        const errText = await res.text();
                        console.error("Fetch Patients Error:", res.status, res.statusText, errText);
                        throw new Error(`Network response was not ok: ${res.status} ${res.statusText}`);
                    }
                    return res.json();
                });
        },
        enabled: !!doctorProfile?.id && !!currentUser && !isAdmin,
    });

    // Fetch Appointments
    const { data: appointments = [], isLoading: loadingApts } = useQuery({
        queryKey: ['appointments', doctorProfile?.id],
        queryFn: async () => {
            if (!doctorProfile?.id || !currentUser) return [];
            const token = await currentUser.getIdToken();
            return fetch(`${import.meta.env.VITE_API_URL || ''}/api/appointments?doctorId=${doctorProfile.id}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            })
                .then(async res => {
                    if (!res.ok) {
                        const errText = await res.text();
                        console.error("Fetch Appointments Error:", res.status, res.statusText, errText);
                        throw new Error(`Network response was not ok: ${res.status} ${res.statusText}`);
                    }
                    return res.json();
                });
        },
        enabled: !!doctorProfile?.id && !!currentUser,
    });

    // ========== ADMIN VIEW QUERIES ==========

    // Fetch ALL doctors (admin)
    const { data: allDoctors = [], isLoading: loadingDoctors } = useQuery({
        queryKey: ['admin-doctors'],
        queryFn: async () => {
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/doctors`);
            if (!res.ok) throw new Error('Failed to fetch doctors');
            return res.json();
        },
        enabled: isAdmin,
    });

    // Fetch ALL patients (admin - no doctorId filter)
    const { data: allPatients = [], isLoading: loadingAllPatients } = useQuery({
        queryKey: ['admin-patients'],
        queryFn: async () => {
            if (!currentUser) return [];
            const token = await currentUser.getIdToken();
            const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/patients`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch all patients');
            return res.json();
        },
        enabled: isAdmin && !!currentUser,
    });

    const loading = loadingPatients || loadingApts;

    // ========== MUTATIONS ==========

    // Delete Patient Mutation
    const deletePatientMutation = useMutation({
        mutationFn: async (id) => {
            const token = await currentUser.getIdToken();
            return fetch(`${import.meta.env.VITE_API_URL || ''}/api/patients/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['patients'] });
        },
    });

    // Delete Doctor Mutation (admin)
    const deleteDoctorMutation = useMutation({
        mutationFn: async (id) => {
            const token = await currentUser.getIdToken();
            return fetch(`${import.meta.env.VITE_API_URL || ''}/api/doctors/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin-doctors'] });
        },
    });

    // Update Appointment Status Mutation
    const updateStatusMutation = useMutation({
        mutationFn: async ({ id, status }) => {
            const token = await currentUser.getIdToken();
            return fetch(`${import.meta.env.VITE_API_URL || ''}/api/appointments/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ status })
            });
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['appointments'] });
        },
    });

    // ========== HANDLERS ==========

    const handleDelete = (id) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer ce patient ?")) {
            deletePatientMutation.mutate(id);
        }
    };

    const handleDeleteDoctor = (id) => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer ce médecin ?")) {
            deleteDoctorMutation.mutate(id);
        }
    };

    const handleAppointmentStatus = (id, status) => {
        updateStatusMutation.mutate({ id, status });
    };

    // ========== COMPUTED DATA ==========

    const pendingAppointments = appointments.filter(a => a.status === 'pending');
    const confirmedAppointments = appointments.filter(a => a.status === 'confirmed');

    // Admin stats
    const adminStats = isAdmin ? {
        totalDoctors: allDoctors.length,
        totalPatients: allPatients.length,
        totalRevenue: allDoctors.reduce((sum, d) => sum + (d.totalRevenue || 0), 0),
        pendingAppointments: pendingAppointments.length,
    } : null;

    // Recent patients for admin (sorted by lastVisit, top 10)
    const recentPatients = isAdmin
        ? [...allPatients]
            .sort((a, b) => new Date(b.lastVisit || 0) - new Date(a.lastVisit || 0))
            .slice(0, 10)
        : [];

    // Filtered doctors for admin search
    const filteredDoctors = allDoctors.filter(doc =>
        (doc.name || '').toLowerCase().includes(doctorSearchTerm.toLowerCase()) ||
        (doc.specialty || '').toLowerCase().includes(doctorSearchTerm.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-gray-900">
            {/* ========== SHARED NAV BAR ========== */}
            <nav className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="container flex items-center justify-between h-16">
                    <div className="text-xl font-bold text-primary flex items-center gap-2">
                        <Activity className="text-primary" size={24} /> GlucoSoin <BetaBadge />
                        <span className="text-xs font-normal text-gray-500 hidden sm:inline-block">
                            / {isAdmin ? 'Administration' : 'Tableau de Bord'}
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        {userRoles && userRoles.length > 1 && <RoleSwitcher />}
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
                            onClick={logout}
                            className="text-gray-500 hover:text-red-500 ml-2"
                            title="Déconnexion"
                        >
                            <LogOut size={18} />
                        </Button>
                    </div>
                </div>
            </nav>

            <main className="container py-4 sm:py-8 px-3 sm:px-4 space-y-6 sm:space-y-8">
                {isAdmin ? (
                    /* ============ ADMIN VIEW ============ */
                    <>
                        {/* Section A: Platform Stats Cards */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-500 font-medium">Total Médecins</p>
                                            <p className="text-3xl font-bold text-gray-900 mt-2">
                                                {loadingDoctors ? '...' : adminStats.totalDoctors}
                                            </p>
                                        </div>
                                        <div className="bg-purple-50 p-3 rounded-full">
                                            <Stethoscope size={24} className="text-purple-600" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-500 font-medium">Total Patients</p>
                                            <p className="text-3xl font-bold text-gray-900 mt-2">
                                                {loadingAllPatients ? '...' : adminStats.totalPatients}
                                            </p>
                                        </div>
                                        <div className="bg-blue-50 p-3 rounded-full">
                                            <User size={24} className="text-blue-600" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-500 font-medium">Revenu Plateforme</p>
                                            <p className="text-xl sm:text-3xl font-bold text-gray-900 mt-2 truncate">
                                                {loadingDoctors ? '...' :
                                                    adminStats.totalRevenue.toLocaleString('fr-CD', {
                                                        style: 'currency', currency: 'CDF'
                                                    })
                                                }
                                            </p>
                                        </div>
                                        <div className="bg-green-50 p-3 rounded-full">
                                            <Banknote size={24} className="text-green-600" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>

                            <Card>
                                <CardContent className="pt-6">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-orange-600 font-medium">RDV en attente</p>
                                            <p className="text-3xl font-bold text-orange-600 mt-2">
                                                {loadingApts ? '...' : adminStats.pendingAppointments}
                                            </p>
                                        </div>
                                        <div className="bg-orange-50 p-3 rounded-full">
                                            <Calendar size={24} className="text-orange-600" />
                                        </div>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>

                        {/* Section B: Doctor Management */}
                        <div>
                            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                    <Stethoscope size={20} className="text-gray-500" />
                                    Gestion des Médecins
                                    <Badge variant="info">{allDoctors.length}</Badge>
                                </h2>
                                <Link to="/add-doctor">
                                    <Button className="gap-2">
                                        <Plus size={18} /> Ajouter Médecin
                                    </Button>
                                </Link>
                            </div>

                            <div className="mb-4">
                                <Input
                                    type="text"
                                    placeholder="Rechercher un médecin par nom ou spécialité..."
                                    value={doctorSearchTerm}
                                    onChange={(e) => setDoctorSearchTerm(e.target.value)}
                                    className="max-w-md shadow-sm"
                                />
                            </div>

                            {loadingDoctors ? (
                                <div className="space-y-4">
                                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-24 w-full" />)}
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 gap-4">
                                    {filteredDoctors.map(doctor => (
                                        <Card key={doctor.id} className="hover:shadow-md transition-shadow">
                                            <CardContent className="p-0">
                                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-5">
                                                    <div className="flex items-center gap-4 flex-1">
                                                        <div className="w-12 h-12 rounded-full overflow-hidden bg-gray-100 border border-gray-200 flex-shrink-0 flex items-center justify-center">
                                                            {doctor.image ? (
                                                                <img src={doctor.image} alt={doctor.name} className="w-full h-full object-cover" />
                                                            ) : (
                                                                <User size={20} className="text-gray-400" />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <h3 className="font-semibold text-gray-900">{doctor.name}</h3>
                                                            <p className="text-sm text-gray-500">{doctor.specialty}</p>
                                                            <p className="text-xs text-gray-400">{doctor.contact?.email}</p>
                                                        </div>
                                                    </div>
                                                    <div className="flex items-center gap-6">
                                                        <div className="text-right hidden sm:block">
                                                            <div className="text-xs text-gray-400 uppercase font-bold tracking-wider">Patients</div>
                                                            <div className="text-sm font-medium text-gray-700">
                                                                {allPatients.filter(p => String(p.doctorId) === String(doctor.id)).length}
                                                            </div>
                                                        </div>
                                                        {doctor.city && (
                                                            <div className="text-right hidden sm:block">
                                                                <div className="text-xs text-gray-400 uppercase font-bold tracking-wider">Ville</div>
                                                                <div className="text-sm font-medium text-gray-700">{doctor.city}</div>
                                                            </div>
                                                        )}
                                                        <div className="flex gap-2">
                                                            <Link to={`/edit-doctor/${doctor.id}`}>
                                                                <Button variant="ghost" size="icon" title="Modifier">
                                                                    <Edit size={16} className="text-gray-500" />
                                                                </Button>
                                                            </Link>
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleDeleteDoctor(doctor.id)}
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

                        {/* Section C: Recent Patients */}
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
                                <User size={20} className="text-gray-500" />
                                Patients Récents
                                <Badge variant="default">{allPatients.length} total</Badge>
                            </h2>

                            {loadingAllPatients ? (
                                <div className="space-y-4">
                                    {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                                </div>
                            ) : recentPatients.length > 0 ? (
                                <div className="grid grid-cols-1 gap-3">
                                    {recentPatients.map(patient => {
                                        const assignedDoctor = allDoctors.find(d => String(d.id) === String(patient.doctorId));
                                        return (
                                            <Card key={patient.id} className="hover:shadow-md transition-shadow">
                                                <CardContent className="p-4">
                                                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                                                        <div className="flex items-center gap-3">
                                                            <h3 className="font-semibold text-gray-900">{patient.name}</h3>
                                                            <Badge variant={
                                                                patient.status === 'Critical' ? 'danger' :
                                                                    patient.status === 'Attention Needed' ? 'warning' : 'success'
                                                            }>
                                                                {patient.status === 'Critical' ? 'Critique' :
                                                                    patient.status === 'Attention Needed' ? 'Attention' : 'Stable'}
                                                            </Badge>
                                                            <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded">{patient.type}</span>
                                                        </div>
                                                        <div className="flex items-center gap-4">
                                                            <span className="text-xs text-gray-500 hidden sm:block">
                                                                {assignedDoctor?.name || 'Non assigné'}
                                                            </span>
                                                            <span className="text-xs text-gray-400 hidden sm:block">
                                                                {patient.lastVisit}
                                                            </span>
                                                            <Link to={`/patients/${patient.id}`}>
                                                                <Button variant="secondary" size="sm" className="gap-1">
                                                                    Voir <ChevronRight size={14} />
                                                                </Button>
                                                            </Link>
                                                        </div>
                                                    </div>
                                                </CardContent>
                                            </Card>
                                        );
                                    })}
                                </div>
                            ) : (
                                <div className="bg-white p-8 rounded-xl border border-dashed border-gray-300 text-center text-gray-500">
                                    <p>Aucun patient enregistré.</p>
                                </div>
                            )}
                        </div>

                        {/* Section D: Quick Actions */}
                        <div>
                            <h2 className="text-lg font-bold text-gray-900 mb-4">Actions Rapides</h2>
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <Link to="/add-doctor">
                                    <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                                        <CardContent className="p-5 text-center">
                                            <Plus size={24} className="mx-auto text-primary mb-2 group-hover:scale-110 transition-transform" />
                                            <p className="text-sm font-medium text-gray-700">Ajouter Médecin</p>
                                        </CardContent>
                                    </Card>
                                </Link>
                                <Link to="/add-patient">
                                    <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                                        <CardContent className="p-5 text-center">
                                            <Plus size={24} className="mx-auto text-blue-600 mb-2 group-hover:scale-110 transition-transform" />
                                            <p className="text-sm font-medium text-gray-700">Ajouter Patient</p>
                                        </CardContent>
                                    </Card>
                                </Link>
                                <Link to="/terminal">
                                    <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                                        <CardContent className="p-5 text-center">
                                            <CreditCard size={24} className="mx-auto text-indigo-600 mb-2 group-hover:scale-110 transition-transform" />
                                            <p className="text-sm font-medium text-gray-700">Terminal Paiement</p>
                                        </CardContent>
                                    </Card>
                                </Link>
                                <Link to="/messaging">
                                    <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                                        <CardContent className="p-5 text-center">
                                            <MessageSquare size={24} className="mx-auto text-green-600 mb-2 group-hover:scale-110 transition-transform" />
                                            <p className="text-sm font-medium text-gray-700">Messagerie</p>
                                        </CardContent>
                                    </Card>
                                </Link>
                                <Link to="/analytics">
                                    <Card className="hover:shadow-md transition-shadow cursor-pointer group">
                                        <CardContent className="p-5 text-center">
                                            <BarChart3 size={24} className="mx-auto text-purple-600 mb-2 group-hover:scale-110 transition-transform" />
                                            <p className="text-sm font-medium text-gray-700">Analytiques</p>
                                        </CardContent>
                                    </Card>
                                </Link>
                            </div>
                        </div>
                    </>
                ) : (
                    /* ============ DOCTOR VIEW (existing) ============ */
                    <>
                        {/* Revenue Section */}
                        {doctorProfile && (
                            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 flex items-center justify-between">
                                <div className="min-w-0 flex-1">
                                    <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Revenu Total</h2>
                                    <div className="text-xl sm:text-3xl font-bold text-gray-900 mt-1 truncate">
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
                                <div className="flex flex-wrap gap-2 sm:gap-3 w-full md:w-auto">
                                    <Link to="/terminal" className="w-full sm:w-auto">
                                        <Button variant="secondary" className="w-full gap-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border-indigo-200">
                                            <CreditCard size={18} /> <span className="hidden sm:inline">Terminal</span> Paiement
                                        </Button>
                                    </Link>
                                    <Link to="/messaging" className="w-full sm:w-auto">
                                        <Button variant="secondary" className="w-full gap-2">
                                            <MessageSquare size={18} /> Messagerie
                                        </Button>
                                    </Link>
                                    <Link to="/add-patient" className="w-full sm:w-auto">
                                        <Button className="w-full gap-2">
                                            <Plus size={18} /> Ajouter un Patient
                                        </Button>
                                    </Link>
                                    {userRoles?.includes('admin') && (
                                        <Link to="/add-doctor" className="w-full sm:w-auto">
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
                                            <CardContent className="p-0 sm:p-0">
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
                                                        <p className="text-sm text-gray-500 flex flex-wrap items-center gap-2 sm:gap-4">
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
                    </>
                )}
            </main>
        </div>
    );
};

export default Dashboard;
