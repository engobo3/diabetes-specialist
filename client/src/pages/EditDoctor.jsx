import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import Header from '../components/Header';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { UserCog, Save, ArrowLeft, Clock, Plus, Trash2 } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const EditDoctor = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [uploading, setUploading] = useState(false);

    // Fetch existing data
    const { data: doctor, isLoading } = useQuery({
        queryKey: ['doctor', id],
        queryFn: () => fetch(`${import.meta.env.VITE_API_URL}/api/doctors/${id}`).then(res => res.json())
    });

    const [formData, setFormData] = useState({
        name: '',
        specialty: '',
        bio: '',
        education: '',
        email: '',
        phone: '',
        address: '',
        languages: '',
        image: ''
    });

    const DAYS = [
        { key: 'monday', label: 'Lundi' },
        { key: 'tuesday', label: 'Mardi' },
        { key: 'wednesday', label: 'Mercredi' },
        { key: 'thursday', label: 'Jeudi' },
        { key: 'friday', label: 'Vendredi' },
        { key: 'saturday', label: 'Samedi' },
        { key: 'sunday', label: 'Dimanche' }
    ];

    const [availability, setAvailability] = useState({});
    const [slotDuration, setSlotDuration] = useState(30);

    useEffect(() => {
        if (doctor) {
            setFormData({
                name: doctor.name || '',
                specialty: doctor.specialty || '',
                bio: doctor.bio || '',
                education: doctor.education ? doctor.education.join(', ') : '',
                email: doctor.contact?.email || '',
                phone: doctor.contact?.phone || '',
                address: doctor.contact?.address || '',
                languages: doctor.languages ? doctor.languages.join(', ') : '',
                image: doctor.image || ''
            });
            setAvailability(doctor.availability || {});
            setSlotDuration(doctor.slotDuration || 30);
        }
    }, [doctor]);

    const toggleDay = (dayKey) => {
        setAvailability(prev => {
            const copy = { ...prev };
            if (copy[dayKey]) {
                delete copy[dayKey];
            } else {
                copy[dayKey] = [{ start: '08:00', end: '12:00' }];
            }
            return copy;
        });
    };

    const addRange = (dayKey) => {
        setAvailability(prev => ({
            ...prev,
            [dayKey]: [...(prev[dayKey] || []), { start: '14:00', end: '17:00' }]
        }));
    };

    const removeRange = (dayKey, index) => {
        setAvailability(prev => {
            const ranges = [...prev[dayKey]];
            ranges.splice(index, 1);
            if (ranges.length === 0) {
                const copy = { ...prev };
                delete copy[dayKey];
                return copy;
            }
            return { ...prev, [dayKey]: ranges };
        });
    };

    const updateRange = (dayKey, index, field, value) => {
        setAvailability(prev => {
            const ranges = [...prev[dayKey]];
            ranges[index] = { ...ranges[index], [field]: value };
            return { ...prev, [dayKey]: ranges };
        });
    };

    const updateDoctorMutation = useMutation({
        mutationFn: async (updatedDoctor) => {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/doctors/${id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedDoctor)
            });
            if (!response.ok) throw new Error('Failed to update doctor');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['doctors'] });
            queryClient.invalidateQueries({ queryKey: ['doctor', id] });
            navigate(`/doctor/${id}`);
        }
    });

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleImageUpload = async (e) => {
        const file = e.target.files[0];
        if (!file) return;

        setUploading(true);
        try {
            const storageRef = ref(storage, `doctors/${Date.now()}_${file.name}`);
            const snapshot = await uploadBytes(storageRef, file);
            const downloadURL = await getDownloadURL(snapshot.ref);
            setFormData(prev => ({ ...prev, image: downloadURL }));
        } catch (error) {
            console.error("Error uploading image:", error);
            alert("Erreur lors du téléchargement de l'image");
        } finally {
            setUploading(false);
        }
    };

    const handleSubmit = (e) => {
        e.preventDefault();

        const doctorData = {
            ...formData,
            education: formData.education.split(',').map(s => s.trim()).filter(Boolean),
            languages: formData.languages.split(',').map(s => s.trim()).filter(Boolean),
            contact: {
                email: formData.email,
                phone: formData.phone,
                address: formData.address
            },
            availability,
            slotDuration
        };

        delete doctorData.email;
        delete doctorData.phone;
        delete doctorData.address;

        updateDoctorMutation.mutate(doctorData);
    };

    if (isLoading) return <div className="p-8 text-center">Loading...</div>;

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-gray-900">
            <Header />
            <div className="container mx-auto px-4 py-12">
                <div className="max-w-2xl mx-auto">
                    <Button variant="ghost" className="mb-4" onClick={() => navigate(-1)}>
                        <ArrowLeft size={16} className="mr-2" /> Retour
                    </Button>
                    <h1 className="text-3xl font-serif font-bold mb-8 flex items-center gap-2">
                        <UserCog className="text-primary" /> Modifier le Spécialiste
                    </h1>

                    <Card>
                        <CardContent className="p-8">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <Input label="Nom Complet" name="name" value={formData.name} onChange={handleChange} required />
                                <Input label="Spécialité" name="specialty" value={formData.specialty} onChange={handleChange} required />

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Biographie</label>
                                    <textarea
                                        name="bio"
                                        value={formData.bio}
                                        onChange={handleChange}
                                        rows="4"
                                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                                    ></textarea>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input label="Email" name="email" value={formData.email} onChange={handleChange} required />
                                    <Input label="Téléphone" name="phone" value={formData.phone} onChange={handleChange} required />
                                </div>
                                <Input label="Adresse du Cabinet" name="address" value={formData.address} onChange={handleChange} required />

                                <Input label="Formation (séparée par des virgules)" name="education" value={formData.education} onChange={handleChange} />
                                <Input label="Langues (séparées par des virgules)" name="languages" value={formData.languages} onChange={handleChange} />

                                {/* Availability Editor */}
                                <div className="border-t pt-6 mt-6">
                                    <h3 className="text-lg font-semibold flex items-center gap-2 mb-4">
                                        <Clock size={20} className="text-primary" /> Disponibilités
                                    </h3>

                                    <div className="mb-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">Durée du créneau</label>
                                        <select
                                            value={slotDuration}
                                            onChange={e => setSlotDuration(Number(e.target.value))}
                                            className="flex h-10 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                        >
                                            <option value={15}>15 minutes</option>
                                            <option value={20}>20 minutes</option>
                                            <option value={30}>30 minutes</option>
                                            <option value={45}>45 minutes</option>
                                            <option value={60}>60 minutes</option>
                                        </select>
                                    </div>

                                    <div className="space-y-3">
                                        {DAYS.map(({ key, label }) => {
                                            const isActive = !!availability[key];
                                            const ranges = availability[key] || [];
                                            return (
                                                <div key={key} className={`p-3 rounded-lg border ${isActive ? 'border-primary/30 bg-primary/5' : 'border-gray-200 bg-gray-50'}`}>
                                                    <div className="flex items-center justify-between">
                                                        <label className="flex items-center gap-2 cursor-pointer">
                                                            <input
                                                                type="checkbox"
                                                                checked={isActive}
                                                                onChange={() => toggleDay(key)}
                                                                className="rounded border-gray-300 text-primary focus:ring-primary"
                                                            />
                                                            <span className={`font-medium text-sm ${isActive ? 'text-gray-900' : 'text-gray-500'}`}>{label}</span>
                                                        </label>
                                                        {isActive && (
                                                            <button type="button" onClick={() => addRange(key)} className="text-xs text-primary hover:text-primary/80 flex items-center gap-1">
                                                                <Plus size={14} /> Ajouter plage
                                                            </button>
                                                        )}
                                                    </div>
                                                    {isActive && ranges.map((range, i) => (
                                                        <div key={i} className="flex items-center gap-2 mt-2 ml-6">
                                                            <input
                                                                type="time"
                                                                value={range.start}
                                                                onChange={e => updateRange(key, i, 'start', e.target.value)}
                                                                className="h-8 rounded border border-gray-300 px-2 text-sm focus:ring-primary focus:border-primary"
                                                            />
                                                            <span className="text-gray-500 text-sm">à</span>
                                                            <input
                                                                type="time"
                                                                value={range.end}
                                                                onChange={e => updateRange(key, i, 'end', e.target.value)}
                                                                className="h-8 rounded border border-gray-300 px-2 text-sm focus:ring-primary focus:border-primary"
                                                            />
                                                            {ranges.length > 1 && (
                                                                <button type="button" onClick={() => removeRange(key, i)} className="text-red-400 hover:text-red-600">
                                                                    <Trash2 size={14} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Photo du Médecin</label>
                                    <div className="flex items-center gap-4">
                                        <div className="relative w-24 h-24 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                                            {formData.image ? (
                                                <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-gray-400">
                                                    <UserCog size={32} />
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex-1">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleImageUpload}
                                                disabled={uploading}
                                                className="block w-full text-sm text-gray-500
                                                    file:mr-4 file:py-2 file:px-4
                                                    file:rounded-full file:border-0
                                                    file:text-sm file:font-semibold
                                                    file:bg-primary/10 file:text-primary
                                                    hover:file:bg-primary/20
                                                "
                                            />
                                            {uploading && <p className="text-xs text-blue-500 mt-1">Téléchargement en cours...</p>}
                                        </div>
                                    </div>
                                </div>

                                <div className="pt-4">
                                    <Button type="submit" className="w-full py-3 text-lg" disabled={updateDoctorMutation.isPending || uploading}>
                                        {updateDoctorMutation.isPending ? 'Enregistrement...' : 'Enregistrer'} <Save size={20} className="ml-2" />
                                    </Button>
                                </div>
                            </form>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default EditDoctor;
