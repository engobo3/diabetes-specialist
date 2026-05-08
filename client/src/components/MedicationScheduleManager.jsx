import { useState, useEffect } from 'react';
import { Pill, Plus, Trash2, Clock, Loader2, Calendar } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import Button from './ui/Button';
import Input from './ui/Input';
import Badge from './ui/Badge';
import toast from 'react-hot-toast';

const FREQUENCY_LABELS = {
    daily: 'Quotidien',
    twice_daily: '2x par jour',
    three_times: '3x par jour',
    weekly: 'Hebdomadaire',
    custom: 'Personnalise',
};

const MedicationScheduleManager = ({ patientId, currentUser, isDoctor = false }) => {
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        medication: '',
        dosage: '',
        frequency: 'daily',
        times: ['08:00'],
        startDate: new Date().toISOString().split('T')[0],
        endDate: '',
        notes: '',
    });

    const fetchSchedules = async () => {
        if (!currentUser || !patientId) return;
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch(
                `${import.meta.env.VITE_API_URL}/api/medication-schedules/patient/${patientId}`,
                { headers: { 'Authorization': `Bearer ${token}` } }
            );
            if (res.ok) {
                const data = await res.json();
                setSchedules(data.filter(s => s.active !== false));
            }
        } catch (err) {
            console.error('Failed to load medication schedules:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchSchedules();
    }, [currentUser, patientId]);

    const handleAddTime = () => {
        setFormData(prev => ({ ...prev, times: [...prev.times, '12:00'] }));
    };

    const handleRemoveTime = (index) => {
        setFormData(prev => ({
            ...prev,
            times: prev.times.filter((_, i) => i !== index)
        }));
    };

    const handleTimeChange = (index, value) => {
        setFormData(prev => {
            const times = [...prev.times];
            times[index] = value;
            return { ...prev, times };
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentUser || !patientId) return;
        setSaving(true);

        try {
            const token = await currentUser.getIdToken();
            const payload = {
                ...formData,
                patientId: String(patientId),
                endDate: formData.endDate || undefined,
                notes: formData.notes || undefined,
            };

            const res = await fetch(
                `${import.meta.env.VITE_API_URL}/api/medication-schedules`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(payload)
                }
            );

            if (res.ok) {
                toast.success('Rappel medicament ajoute');
                setShowForm(false);
                setFormData({
                    medication: '',
                    dosage: '',
                    frequency: 'daily',
                    times: ['08:00'],
                    startDate: new Date().toISOString().split('T')[0],
                    endDate: '',
                    notes: '',
                });
                fetchSchedules();
            } else {
                const err = await res.json();
                toast.error(err.message || 'Erreur lors de l\'ajout');
            }
        } catch (err) {
            console.error('Failed to create medication schedule:', err);
            toast.error('Erreur lors de l\'ajout');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (scheduleId) => {
        if (!window.confirm('Desactiver ce rappel medicament ?')) return;
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch(
                `${import.meta.env.VITE_API_URL}/api/medication-schedules/${scheduleId}`,
                {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${token}` }
                }
            );
            if (res.ok) {
                toast.success('Rappel desactive');
                setSchedules(prev => prev.filter(s => s.id !== scheduleId));
            }
        } catch (err) {
            console.error('Failed to delete schedule:', err);
            toast.error('Erreur lors de la suppression');
        }
    };

    if (loading) {
        return (
            <Card>
                <CardContent className="flex items-center justify-center py-12">
                    <Loader2 className="animate-spin text-gray-400" size={32} />
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                        <Pill size={20} className="text-orange-500" />
                        {isDoctor ? 'Rappels Medicaments du Patient' : 'Mes Medicaments'}
                    </CardTitle>
                    {isDoctor && (
                        <Button
                            size="sm"
                            onClick={() => setShowForm(!showForm)}
                            className="gap-1"
                        >
                            <Plus size={16} /> Ajouter
                        </Button>
                    )}
                </CardHeader>
                <CardContent>
                    {schedules.length === 0 && !showForm ? (
                        <div className="text-center py-12 text-gray-500 border-2 border-dashed border-gray-100 rounded-lg">
                            <Pill size={48} className="mx-auto mb-3 opacity-20" />
                            <p>Aucun rappel medicament configure.</p>
                            {isDoctor && (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="mt-4"
                                    onClick={() => setShowForm(true)}
                                >
                                    <Plus size={16} className="mr-1" /> Ajouter un rappel
                                </Button>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {schedules.map(schedule => (
                                <div
                                    key={schedule.id}
                                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-orange-50/50 rounded-lg border border-orange-100 hover:border-orange-200 transition-colors"
                                >
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-1">
                                            <h4 className="font-bold text-gray-900">{schedule.medication}</h4>
                                            <Badge variant="info">{schedule.dosage}</Badge>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-600">
                                            <span className="flex items-center gap-1">
                                                <Clock size={14} className="text-orange-400" />
                                                {schedule.times?.join(', ')}
                                            </span>
                                            <span className="text-gray-400">|</span>
                                            <span>{FREQUENCY_LABELS[schedule.frequency] || schedule.frequency}</span>
                                            {schedule.endDate && (
                                                <>
                                                    <span className="text-gray-400">|</span>
                                                    <span className="flex items-center gap-1">
                                                        <Calendar size={14} className="text-gray-400" />
                                                        Jusqu'au {schedule.endDate}
                                                    </span>
                                                </>
                                            )}
                                        </div>
                                        {schedule.notes && (
                                            <p className="text-xs text-gray-500 mt-1">{schedule.notes}</p>
                                        )}
                                    </div>
                                    {isDoctor && (
                                        <button
                                            onClick={() => handleDelete(schedule.id)}
                                            className="text-gray-400 hover:text-red-500 transition-colors p-2 rounded hover:bg-red-50"
                                            title="Desactiver ce rappel"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add Form (Doctor only) */}
                    {showForm && isDoctor && (
                        <form onSubmit={handleSubmit} className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200 space-y-4">
                            <h4 className="font-semibold text-gray-900">Nouveau rappel medicament</h4>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Medicament</label>
                                    <Input
                                        required
                                        value={formData.medication}
                                        onChange={e => setFormData({ ...formData, medication: e.target.value })}
                                        placeholder="Ex: Metformine"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Dosage</label>
                                    <Input
                                        required
                                        value={formData.dosage}
                                        onChange={e => setFormData({ ...formData, dosage: e.target.value })}
                                        placeholder="Ex: 500mg"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Frequence</label>
                                <select
                                    value={formData.frequency}
                                    onChange={e => setFormData({ ...formData, frequency: e.target.value })}
                                    className="w-full rounded-md border-gray-300 shadow-sm focus:border-primary focus:ring-primary p-2 border"
                                >
                                    {Object.entries(FREQUENCY_LABELS).map(([key, label]) => (
                                        <option key={key} value={key}>{label}</option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                    Heures de prise
                                </label>
                                <div className="space-y-2">
                                    {formData.times.map((time, index) => (
                                        <div key={index} className="flex items-center gap-2">
                                            <Input
                                                type="time"
                                                value={time}
                                                onChange={e => handleTimeChange(index, e.target.value)}
                                                className="w-32"
                                            />
                                            {formData.times.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleRemoveTime(index)}
                                                    className="text-gray-400 hover:text-red-500 p-1"
                                                >
                                                    <Trash2 size={14} />
                                                </button>
                                            )}
                                        </div>
                                    ))}
                                    <button
                                        type="button"
                                        onClick={handleAddTime}
                                        className="text-sm text-primary hover:text-primary/80 flex items-center gap-1"
                                    >
                                        <Plus size={14} /> Ajouter une heure
                                    </button>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date de debut</label>
                                    <Input
                                        type="date"
                                        required
                                        value={formData.startDate}
                                        onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Date de fin (optionnel)</label>
                                    <Input
                                        type="date"
                                        value={formData.endDate}
                                        onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optionnel)</label>
                                <Input
                                    value={formData.notes}
                                    onChange={e => setFormData({ ...formData, notes: e.target.value })}
                                    placeholder="Ex: Prendre avec le repas"
                                />
                            </div>

                            <div className="flex gap-3 pt-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    onClick={() => setShowForm(false)}
                                    className="flex-1"
                                >
                                    Annuler
                                </Button>
                                <Button type="submit" disabled={saving} className="flex-1 gap-2">
                                    {saving ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
                                    Ajouter
                                </Button>
                            </div>
                        </form>
                    )}
                </CardContent>
            </Card>
        </div>
    );
};

export default MedicationScheduleManager;
