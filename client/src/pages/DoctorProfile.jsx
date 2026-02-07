import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Mail, Phone, Award, BookOpen, Globe, Edit, Trash2 } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '../context/AuthContext';
import Button from '../components/ui/Button';

const DoctorProfile = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { userRole, currentUser, doctorProfile } = useAuth();
    const [doctor, setDoctor] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // Debug logging
    useEffect(() => {
        console.log('DoctorProfile - userRole:', userRole, 'currentUser:', currentUser?.email, 'doctorProfile:', doctorProfile);
    }, [userRole, currentUser, doctorProfile]);

    useEffect(() => {
        const fetchDoctor = async () => {
            try {
                const response = await fetch(`${import.meta.env.VITE_API_URL}/api/doctors/${id}`);
                if (!response.ok) {
                    throw new Error('Doctor not found');
                }
                const data = await response.json();
                setDoctor(data);
                setLoading(false);
            } catch (err) {
                console.error("Error fetching doctor", err);
                setError(err.message);
                setLoading(false);
            }
        };

        fetchDoctor();
    }, [id]);

    const deleteDoctorMutation = useMutation({
        mutationFn: async () => {
            const token = await currentUser.getIdToken();
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/doctors/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('Failed to delete doctor');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['doctors'] });
            navigate('/find-doctor');
        }
    });

    const handleDelete = () => {
        if (window.confirm("Êtes-vous sûr de vouloir supprimer ce médecin ? Cette action est irrèversible.")) {
            deleteDoctorMutation.mutate();
        }
    };

    if (loading) return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
    );

    if (error || !doctor) return (
        <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
            <div className="text-red-500 text-xl font-bold mb-4">Médecin introuvable</div>
            <Link to="/find-doctor" className="text-primary hover:underline flex items-center gap-2">
                <ArrowLeft size={20} /> Retour à la recherche
            </Link>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header/Nav */}
            <nav className="bg-white border-b border-gray-200">
                <div className="container flex items-center justify-between h-16">
                    <Link to="/" className="text-xl font-bold text-primary">GlucoSoin</Link>
                    <Link to="/find-doctor" className="text-gray-600 hover:text-gray-900 flex items-center gap-2">
                        <ArrowLeft size={18} /> Retour à la recherche
                    </Link>
                </div>
            </nav>

            <main className="container py-8">
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    {/* Cover Image Placeholder */}
                    <div className="h-32 bg-gradient-to-r from-blue-500 to-indigo-600"></div>

                    <div className="px-8 pb-8">
                        <div className="relative flex justify-between items-end -mt-12 mb-6">
                            <img
                                src={doctor.image}
                                alt={doctor.name}
                                className="w-32 h-32 rounded-full border-4 border-white shadow-md object-cover bg-gray-200"
                            />
                            <div className="flex gap-3">
                                {userRole === 'admin' && (
                                    <>
                                        <Link to={`/edit-doctor/${id}`}>
                                            <Button variant="outline" className="flex items-center gap-2 bg-white text-gray-700 border-gray-300 hover:bg-gray-50">
                                                <Edit size={16} /> Modifier
                                            </Button>
                                        </Link>
                                        <Button
                                            variant="outline"
                                            className="flex items-center gap-2 bg-white text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                                            onClick={handleDelete}
                                        >
                                            <Trash2 size={16} /> Supprimer
                                        </Button>
                                    </>
                                )}
                                {(userRole === 'doctor' || userRole === 'admin' || doctorProfile?.id) && currentUser && (
                                    <Link to="/doctor-dashboard">
                                        <Button className="flex items-center gap-2 bg-gradient-to-r from-blue-500 to-indigo-600 text-white hover:from-blue-600 hover:to-indigo-700 shadow-sm">
                                            <Award size={16} /> Mon tableau de bord
                                        </Button>
                                    </Link>
                                )}
                                <a
                                    href={`mailto:${doctor.contact.email}`}
                                >
                                    <Button className="shadow-sm">
                                        <Mail size={16} className="mr-2" /> Contacter
                                    </Button>
                                </a>
                            </div>
                        </div>

                        <div className="mb-8">
                            <h1 className="text-3xl font-bold text-gray-900">{doctor.name}</h1>
                            <p className="text-lg text-primary font-medium">{doctor.specialty}</p>
                            <div className="flex flex-wrap gap-4 mt-4 text-gray-600">
                                <span className="flex items-center gap-1"><MapPin size={18} /> {doctor.contact.address}</span>
                                <span className="flex items-center gap-1"><Globe size={18} /> {doctor.languages.join(', ')}</span>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            <div className="md:col-span-2 space-y-8">
                                <section>
                                    <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                                        <BookOpen className="text-primary" size={24} /> À propos
                                    </h2>
                                    <p className="text-gray-600 leading-relaxed">{doctor.bio || "Aucune biographie disponible."}</p>
                                </section>

                                <section>
                                    <h2 className="text-xl font-bold text-gray-900 mb-3 flex items-center gap-2">
                                        <Award className="text-primary" size={24} /> Formation & Diplômes
                                    </h2>
                                    <ul className="space-y-2">
                                        {doctor.education && doctor.education.length > 0 ? doctor.education.map((edu, index) => (
                                            <li key={index} className="flex items-start gap-2 text-gray-700">
                                                <div className="mt-1.5 w-1.5 h-1.5 rounded-full bg-gray-400"></div>
                                                {edu}
                                            </li>
                                        )) : <li className="text-gray-500 italic">Aucun détail sur la formation.</li>}
                                    </ul>
                                </section>
                            </div>

                            <div className="bg-gray-50 rounded-lg p-6 h-fit border border-gray-100">
                                <h3 className="font-bold text-gray-900 mb-4">Coordonnées</h3>
                                <div className="space-y-4">
                                    <div className="flex items-start gap-3">
                                        <Mail className="text-gray-400 mt-1" size={20} />
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wide">Email</p>
                                            <a href={`mailto:${doctor.contact.email}`} className="text-primary hover:underline font-medium">{doctor.contact.email}</a>
                                        </div>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <Phone className="text-gray-400 mt-1" size={20} />
                                        <div>
                                            <p className="text-xs text-gray-500 uppercase tracking-wide">Téléphone</p>
                                            <p className="font-medium text-gray-900">{doctor.contact.phone}</p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
};

export default DoctorProfile;
