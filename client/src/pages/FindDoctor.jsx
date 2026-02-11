import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import { Card, CardContent } from '../components/ui/Card';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import Badge from '../components/ui/Badge';
import { Search, MapPin, Filter, Star, Phone } from 'lucide-react';
import { Link, useSearchParams } from 'react-router-dom';

const FindDoctor = () => {
    const [searchParams] = useSearchParams();
    const [doctors, setDoctors] = useState([]);
    const [searchQuery, setSearchQuery] = useState(searchParams.get('search') || '');
    const [selectedSpecialty, setSelectedSpecialty] = useState(searchParams.get('specialty') || '');
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        setSelectedSpecialty(searchParams.get('specialty') || '');
        setSearchQuery(searchParams.get('search') || '');
    }, [searchParams]);

    useEffect(() => {
        // Fetch all doctors
        fetch(`${import.meta.env.VITE_API_URL}/api/doctors`)
            .then(res => res.json())
            .then(data => {
                setDoctors(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load doctors", err);
                setLoading(false);
            });
    }, []);

    // Extract unique specialties for filter
    const specialties = [...new Set(doctors.map(d => d.specialty))].sort();

    const filteredDoctors = doctors.filter(doctor => {
        const matchesSearch = doctor.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            doctor.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
            doctor.languages.some(l => l.toLowerCase().includes(searchQuery.toLowerCase()));

        const matchesSpecialty = selectedSpecialty ? doctor.specialty === selectedSpecialty : true;

        return matchesSearch && matchesSpecialty;
    });

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-gray-900">
            <Header />

            <div className="bg-primary py-8 sm:py-12 text-white">
                <div className="container mx-auto px-4 text-center">
                    <h1 className="text-2xl sm:text-4xl font-serif font-bold mb-4">Trouver un Médecin</h1>
                    <p className="text-lg text-teal-100 max-w-2xl mx-auto mb-8">
                        Recherchez parmi nos spécialistes de classe mondiale pour trouver les soins adaptés à vos besoins.
                    </p>

                    {/* Search Bar */}
                    <div className="max-w-3xl mx-auto bg-white p-2 rounded-lg shadow-lg flex flex-col md:flex-row gap-2">
                        <div className="flex-1 relative">
                            <Search className="absolute left-3 top-3 text-gray-400" size={20} />
                            <input
                                type="text"
                                placeholder="Nom, Spécialité, ou Langue..."
                                className="w-full pl-10 pr-4 py-3 rounded-md text-gray-900 focus:outline-none"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                        <div className="h-px md:h-auto md:w-px bg-gray-200"></div>
                        <div className="md:w-1/3">
                            <select
                                className="w-full p-3 rounded-md text-gray-900 focus:outline-none bg-transparent"
                                value={selectedSpecialty}
                                onChange={(e) => setSelectedSpecialty(e.target.value)}
                            >
                                <option value="">Toutes Spécialités</option>
                                {specialties.map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                        <Button className="md:w-auto h-full py-3 px-8 text-lg font-semibold">Rechercher</Button>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-12 flex flex-col lg:flex-row gap-8">
                {/* Sidebar Filters (Desktop) */}
                <div className="hidden lg:block w-64 space-y-6">
                    <Card>
                        <CardContent className="p-4">
                            <div className="flex items-center gap-2 font-bold text-gray-900 mb-4">
                                <Filter size={18} /> Filtres
                            </div>

                            <div className="space-y-4">
                                <div>
                                    <h4 className="font-semibold text-sm mb-2 text-gray-700">Spécialité</h4>
                                    <div className="space-y-1">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="specialty"
                                                checked={selectedSpecialty === ''}
                                                onChange={() => setSelectedSpecialty('')}
                                                className="text-primary focus:ring-primary"
                                            />
                                            <span className="text-sm">Toutes Spécialités</span>
                                        </label>
                                        {specialties.map(s => (
                                            <label key={s} className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="radio"
                                                    name="specialty"
                                                    checked={selectedSpecialty === s}
                                                    onChange={() => setSelectedSpecialty(s)}
                                                    className="text-primary focus:ring-primary"
                                                />
                                                <span className="text-sm">{s}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Results List */}
                <div className="flex-1">
                    <div className="mb-4 text-gray-600 font-medium">{filteredDoctors.length} médecins trouvés</div>

                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => <div key={i} className="h-48 bg-gray-200 rounded-lg animate-pulse"></div>)}
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {filteredDoctors.map(doctor => (
                                <Card key={doctor.id} className="overflow-hidden hover:shadow-md transition-shadow">
                                    <div className="flex flex-col md:flex-row">
                                        <div className="md:w-48 h-48 md:h-auto relative">
                                            <img src={doctor.image} alt={doctor.name} className="w-full h-full object-cover" />
                                        </div>
                                        <div className="flex-1 p-6 flex flex-col justify-between">
                                            <div>
                                                <div className="flex justify-between items-start">
                                                    <div>
                                                        <h3 className="text-xl font-bold text-gray-900">{doctor.name}</h3>
                                                        <p className="text-primary font-medium">{doctor.specialty}</p>
                                                    </div>
                                                    <div className="flex text-yellow-500">
                                                        {[1, 2, 3, 4, 5].map(i => <Star key={i} size={16} fill="currentColor" />)}
                                                    </div>
                                                </div>

                                                <p className="text-gray-600 mt-2 line-clamp-2">{doctor.bio}</p>

                                                <div className="mt-4 flex flex-wrap gap-2">
                                                    {doctor.languages.map(lang => (
                                                        <Badge key={lang} variant="secondary" className="text-xs">{lang}</Badge>
                                                    ))}
                                                </div>

                                                <div className="mt-4 flex items-center gap-4 text-sm text-gray-500">
                                                    <div className="flex items-center gap-1">
                                                        <MapPin size={14} /> {doctor.contact.address.split(',')[0]}
                                                    </div>
                                                    <div className="flex items-center gap-1">
                                                        <Phone size={14} /> {doctor.contact.phone}
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-6 flex gap-4">
                                                <Link to={`/doctor/${doctor.id}`}>
                                                    <Button variant="outline" size="sm">Voir Profil</Button>
                                                </Link>
                                                <Link to="/portal">
                                                    <Button size="sm">Prendre RDV</Button>
                                                </Link>
                                            </div>
                                        </div>
                                    </div>
                                </Card>
                            ))}

                            {filteredDoctors.length === 0 && (
                                <div className="text-center py-12 bg-white rounded-lg border border-dashed border-gray-300">
                                    {selectedSpecialty ? (
                                        <>
                                            <p className="text-gray-900 font-bold text-xl mb-2">Lancement prochainement</p>
                                            <p className="text-gray-500">Nous travaillons activement pour ajouter des spécialistes en <span className="font-semibold text-primary">{selectedSpecialty}</span> à notre réseau.</p>
                                        </>
                                    ) : (
                                        <p className="text-gray-500 text-lg">Aucun médecin trouvé correspondant à vos critères.</p>
                                    )}
                                    <Button variant="link" onClick={() => { setSearchQuery(''); setSelectedSpecialty(''); }} className="mt-4">
                                        Effacer les Filtres
                                    </Button>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default FindDoctor;
