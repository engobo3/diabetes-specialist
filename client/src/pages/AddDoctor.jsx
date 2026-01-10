import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { Card, CardContent } from '../components/ui/Card';
import { UserPlus, Save } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const AddDoctor = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const [uploading, setUploading] = useState(false);

    const [formData, setFormData] = useState({
        name: '',
        specialty: '',
        bio: '',
        education: '',
        email: '',
        phone: '',
        address: '',
        languages: '',
        image: 'https://randomuser.me/api/portraits/lego/1.jpg' // Default placeholder
    });

    const addDoctorMutation = useMutation({
        mutationFn: async (newDoctor) => {
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/doctors`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(newDoctor)
            });
            if (!response.ok) throw new Error('Failed to add doctor');
            return response.json();
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['doctors'] }); // Invalidate cache if we had one
            navigate('/find-doctor');
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

        // Format arrays
        const doctorData = {
            ...formData,
            education: formData.education.split(',').map(s => s.trim()).filter(Boolean),
            languages: formData.languages.split(',').map(s => s.trim()).filter(Boolean),
            contact: {
                email: formData.email,
                phone: formData.phone,
                address: formData.address
            }
        };

        // Remove flattened contact fields
        delete doctorData.email;
        delete doctorData.phone;
        delete doctorData.address;

        addDoctorMutation.mutate(doctorData);
    };

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-gray-900">
            <Header />
            <div className="container mx-auto px-4 py-12">
                <div className="max-w-2xl mx-auto">
                    <h1 className="text-3xl font-serif font-bold mb-8 flex items-center gap-2">
                        <UserPlus className="text-primary" /> Ajouter un Spécialiste
                    </h1>

                    <Card>
                        <CardContent className="p-8">
                            <form onSubmit={handleSubmit} className="space-y-6">
                                <Input label="Nom Complet (ex. Dr. Jean Dupont)" name="name" value={formData.name} onChange={handleChange} required />
                                <Input label="Spécialité" name="specialty" value={formData.specialty} onChange={handleChange} required placeholder="ex. Cardiologue" />

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Biographie</label>
                                    <textarea
                                        name="bio"
                                        value={formData.bio}
                                        onChange={handleChange}
                                        rows="4"
                                        className="w-full p-2 border border-gray-300 rounded-md focus:ring-primary focus:border-primary"
                                        placeholder="Parcours professionnel du médecin..."
                                    ></textarea>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input label="Email" name="email" type="email" value={formData.email} onChange={handleChange} required />
                                    <Input label="Téléphone" name="phone" value={formData.phone} onChange={handleChange} required />
                                </div>
                                <Input label="Adresse du Cabinet" name="address" value={formData.address} onChange={handleChange} required />

                                <Input label="Formation (séparée par des virgules)" name="education" value={formData.education} onChange={handleChange} placeholder="MD Kinshasa, Résidence Mama Yemo" />
                                <Input label="Langues (séparées par des virgules)" name="languages" value={formData.languages} onChange={handleChange} placeholder="Français, Lingala, Swahili" />

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Photo du Médecin</label>
                                    <div className="flex items-center gap-4">
                                        <div className="relative w-24 h-24 bg-gray-100 rounded-full overflow-hidden border border-gray-200">
                                            {formData.image ? (
                                                <img src={formData.image} alt="Preview" className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="flex items-center justify-center h-full text-gray-400">
                                                    <UserPlus size={32} />
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
                                    <Button type="submit" className="w-full py-3 text-lg" disabled={addDoctorMutation.isPending || uploading}>
                                        {addDoctorMutation.isPending ? 'Enregistrement...' : 'Ajouter Médecin'} <Save size={20} className="ml-2" />
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

export default AddDoctor;
