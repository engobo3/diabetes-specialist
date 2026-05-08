import { useState, useEffect } from 'react';
import { User, Mail, Phone, MapPin, GraduationCap, Globe, Clock, Save, Loader2, Plus, Trash2, Shield, Camera } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import Input from './ui/Input';
import Button from './ui/Button';
import Badge from './ui/Badge';
import toast from 'react-hot-toast';
import { useAuth } from '../context/AuthContext';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const DAYS = [
    { key: 'monday', label: 'Lundi' },
    { key: 'tuesday', label: 'Mardi' },
    { key: 'wednesday', label: 'Mercredi' },
    { key: 'thursday', label: 'Jeudi' },
    { key: 'friday', label: 'Vendredi' },
    { key: 'saturday', label: 'Samedi' },
    { key: 'sunday', label: 'Dimanche' }
];

const DoctorProfileEdit = () => {
    const { currentUser, doctorProfile } = useAuth();
    const [formData, setFormData] = useState({
        bio: '',
        email: '',
        phone: '',
        address: '',
        education: '',
        languages: '',
        image: '',
    });
    const [availability, setAvailability] = useState({});
    const [slotDuration, setSlotDuration] = useState(30);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        if (doctorProfile) {
            setFormData({
                bio: doctorProfile.bio || '',
                email: doctorProfile.contact?.email || '',
                phone: doctorProfile.contact?.phone || '',
                address: doctorProfile.contact?.address || '',
                education: doctorProfile.education ? doctorProfile.education.join(', ') : '',
                languages: doctorProfile.languages ? doctorProfile.languages.join(', ') : '',
                image: doctorProfile.image || '',
            });
            setAvailability(doctorProfile.availability || {});
            setSlotDuration(doctorProfile.slotDuration || 30);
            setDirty(false);
        }
    }, [doctorProfile]);

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
        setDirty(true);
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
            setDirty(true);
        } catch (error) {
            console.error('Error uploading image:', error);
            toast.error("Erreur lors du telechargement de l'image");
        } finally {
            setUploading(false);
        }
    };

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
        setDirty(true);
    };

    const addRange = (dayKey) => {
        setAvailability(prev => ({
            ...prev,
            [dayKey]: [...(prev[dayKey] || []), { start: '14:00', end: '17:00' }]
        }));
        setDirty(true);
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
        setDirty(true);
    };

    const updateRange = (dayKey, index, field, value) => {
        setAvailability(prev => {
            const ranges = [...prev[dayKey]];
            ranges[index] = { ...ranges[index], [field]: value };
            return { ...prev, [dayKey]: ranges };
        });
        setDirty(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!dirty && !uploading) return;

        setSaving(true);
        try {
            const token = await currentUser.getIdToken();
            const payload = {
                name: doctorProfile.name,
                specialty: doctorProfile.specialty,
                city: doctorProfile.city,
                bio: formData.bio.trim() || undefined,
                image: formData.image || undefined,
                contact: {
                    email: formData.email.trim() || undefined,
                    phone: formData.phone.trim() || undefined,
                    address: formData.address.trim() || undefined,
                },
                education: formData.education ? formData.education.split(',').map(s => s.trim()).filter(Boolean) : undefined,
                languages: formData.languages ? formData.languages.split(',').map(s => s.trim()).filter(Boolean) : undefined,
                availability,
                slotDuration,
            };

            const res = await fetch(
                `${import.meta.env.VITE_API_URL || ''}/api/doctors/${doctorProfile.id}`,
                {
                    method: 'PUT',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${token}`,
                    },
                    body: JSON.stringify(payload),
                }
            );

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message || 'Erreur serveur');
            }

            toast.success('Profil mis a jour avec succes !');
            setDirty(false);
        } catch (err) {
            console.error('Error updating doctor profile:', err);
            toast.error(err.message || 'Erreur lors de la mise a jour.');
        } finally {
            setSaving(false);
        }
    };

    if (!doctorProfile) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 size={24} className="animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            {/* Read-only identity */}
            <Card className="border-gray-100 bg-gray-50/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Shield size={18} className="text-gray-400" />
                        Identite professionnelle
                        <span className="text-xs font-normal text-gray-400 ml-2">(geree par l'administrateur)</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                        <span className="text-sm text-gray-500">Nom</span>
                        <span className="text-sm font-medium text-gray-700">{doctorProfile.name}</span>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                        <span className="text-sm text-gray-500">Specialite</span>
                        <Badge variant="info">{doctorProfile.specialty}</Badge>
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-gray-500">Ville</span>
                        <span className="text-sm font-medium text-gray-700">{doctorProfile.city || 'Non definie'}</span>
                    </div>
                </CardContent>
            </Card>

            {/* Editable profile */}
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User size={20} className="text-primary" />
                        Mon Profil
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        {/* Photo */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                                <Camera size={14} /> Photo
                            </label>
                            <div className="flex items-center gap-4">
                                <div className="relative w-20 h-20 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                                    {formData.image ? (
                                        <img src={formData.image} alt="Photo" className="w-full h-full object-cover" />
                                    ) : (
                                        <div className="flex items-center justify-center h-full text-gray-400">
                                            <User size={28} />
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
                                            hover:file:bg-primary/20"
                                    />
                                    {uploading && <p className="text-xs text-blue-500 mt-1">Telechargement en cours...</p>}
                                </div>
                            </div>
                        </div>

                        {/* Bio */}
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-700">Biographie</label>
                            <textarea
                                name="bio"
                                value={formData.bio}
                                onChange={handleChange}
                                rows="3"
                                placeholder="Decrivez votre parcours et votre approche..."
                                className="w-full p-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-primary focus:border-transparent"
                            />
                        </div>

                        {/* Contact */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                                    <Mail size={14} /> Email
                                </label>
                                <Input name="email" type="email" value={formData.email} onChange={handleChange} placeholder="votre@email.com" />
                            </div>
                            <div className="space-y-1.5">
                                <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                                    <Phone size={14} /> Telephone
                                </label>
                                <Input name="phone" type="tel" value={formData.phone} onChange={handleChange} placeholder="+243..." />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                                <MapPin size={14} /> Adresse du cabinet
                            </label>
                            <Input name="address" value={formData.address} onChange={handleChange} placeholder="Adresse complete..." />
                        </div>

                        {/* Education & Languages */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                                <GraduationCap size={14} /> Formation
                            </label>
                            <Input name="education" value={formData.education} onChange={handleChange} placeholder="Separee par des virgules..." />
                        </div>

                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700">
                                <Globe size={14} /> Langues
                            </label>
                            <Input name="languages" value={formData.languages} onChange={handleChange} placeholder="Francais, Anglais..." />
                        </div>

                        {/* Availability */}
                        <div className="border-t pt-5 mt-5">
                            <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                                <Clock size={16} className="text-primary" /> Disponibilites
                            </h3>

                            <div className="mb-4">
                                <label className="block text-xs font-medium text-gray-600 mb-1">Duree du creneau</label>
                                <select
                                    value={slotDuration}
                                    onChange={e => { setSlotDuration(Number(e.target.value)); setDirty(true); }}
                                    className="h-9 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
                                >
                                    <option value={15}>15 minutes</option>
                                    <option value={20}>20 minutes</option>
                                    <option value={30}>30 minutes</option>
                                    <option value={45}>45 minutes</option>
                                    <option value={60}>60 minutes</option>
                                </select>
                            </div>

                            <div className="space-y-2">
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
                                                    <span className="text-gray-500 text-xs">a</span>
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

                        <div className="pt-4">
                            <Button type="submit" disabled={saving || (!dirty && !uploading)} className="w-full sm:w-auto gap-2">
                                {saving ? (
                                    <><Loader2 size={16} className="animate-spin" /> Enregistrement...</>
                                ) : (
                                    <><Save size={16} /> Enregistrer les modifications</>
                                )}
                            </Button>
                        </div>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default DoctorProfileEdit;
