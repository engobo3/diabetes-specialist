import { useState, useEffect } from 'react';
import { User, Mail, Phone, Calendar, Shield, Save, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import Input from './ui/Input';
import Button from './ui/Button';
import Badge from './ui/Badge';
import toast from 'react-hot-toast';

const PatientProfile = ({ patient, currentUser, patientId, onUpdate }) => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        age: '',
    });
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        if (patient) {
            setFormData({
                name: patient.name || '',
                email: patient.email || '',
                phone: patient.phone || '',
                age: patient.age != null ? String(patient.age) : '',
            });
            setDirty(false);
        }
    }, [patient]);

    const handleChange = (e) => {
        setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }));
        setDirty(true);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!dirty) return;

        setSaving(true);
        try {
            const token = await currentUser.getIdToken();
            const payload = {
                name: formData.name.trim(),
                email: formData.email.trim() || undefined,
                phone: formData.phone.trim() || undefined,
                age: formData.age ? Number(formData.age) : undefined,
            };

            const res = await fetch(
                `${import.meta.env.VITE_API_URL || ''}/api/patients/${patientId}`,
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
            if (onUpdate) onUpdate();
        } catch (err) {
            console.error('Error updating profile:', err);
            toast.error(err.message || 'Erreur lors de la mise a jour.');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <User size={20} className="text-primary" />
                        Mon Profil
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-5">
                        <div className="space-y-1.5">
                            <label className="block text-sm font-medium text-gray-700">Nom complet</label>
                            <Input name="name" value={formData.name} onChange={handleChange} required />
                        </div>

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
                                <Calendar size={14} /> Age
                            </label>
                            <Input name="age" type="number" min="0" max="150" value={formData.age} onChange={handleChange} className="max-w-[120px]" />
                        </div>

                        <div className="pt-4">
                            <Button type="submit" disabled={saving || !dirty} className="w-full sm:w-auto gap-2">
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

            <Card className="border-gray-100 bg-gray-50/50">
                <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-base">
                        <Shield size={18} className="text-gray-400" />
                        Informations medicales
                        <span className="text-xs font-normal text-gray-400 ml-2">(gerees par votre medecin)</span>
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                        <span className="text-sm text-gray-500">Type de diabete</span>
                        <Badge variant="info">{patient?.type || 'Non defini'}</Badge>
                    </div>
                    <div className="flex items-center justify-between py-2 border-b border-gray-100">
                        <span className="text-sm text-gray-500">Statut</span>
                        <Badge variant={patient?.status === 'Critical' ? 'danger' : patient?.status === 'Stable' ? 'success' : 'warning'}>
                            {patient?.status || 'Non defini'}
                        </Badge>
                    </div>
                    <div className="flex items-center justify-between py-2">
                        <span className="text-sm text-gray-500">Medecin traitant</span>
                        <span className="text-sm font-medium text-gray-700">{patient?.doctorName || 'Non assigne'}</span>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default PatientProfile;
