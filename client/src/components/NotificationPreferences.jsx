import { useState, useEffect } from 'react';
import { Bell, Sun, Moon, Pill, AlertTriangle, Save, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import Button from './ui/Button';
import toast from 'react-hot-toast';

const Toggle = ({ checked, onChange, disabled }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary/50 ${
            checked ? 'bg-primary' : 'bg-gray-200'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
        <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                checked ? 'translate-x-5' : 'translate-x-0'
            }`}
        />
    </button>
);

const NotificationPreferences = ({ patientId, currentUser }) => {
    const [prefs, setPrefs] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchPrefs = async () => {
            if (!currentUser || !patientId) return;
            try {
                const token = await currentUser.getIdToken();
                const res = await fetch(
                    `${import.meta.env.VITE_API_URL}/api/notification-preferences/${patientId}`,
                    { headers: { 'Authorization': `Bearer ${token}` } }
                );
                if (res.ok) {
                    setPrefs(await res.json());
                }
            } catch (err) {
                console.error('Failed to load preferences:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchPrefs();
    }, [currentUser, patientId]);

    const savePrefs = async () => {
        if (!currentUser || !patientId || !prefs) return;
        setSaving(true);
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch(
                `${import.meta.env.VITE_API_URL}/api/notification-preferences/${patientId}`,
                {
                    method: 'PUT',
                    headers: {
                        'Authorization': `Bearer ${token}`,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify(prefs)
                }
            );
            if (res.ok) {
                const updated = await res.json();
                setPrefs(updated);
                toast.success('Preferences enregistrees');
            } else {
                toast.error('Erreur lors de la sauvegarde');
            }
        } catch (err) {
            console.error('Failed to save preferences:', err);
            toast.error('Erreur lors de la sauvegarde');
        } finally {
            setSaving(false);
        }
    };

    const updateField = (field, value) => {
        setPrefs(prev => ({ ...prev, [field]: value }));
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

    if (!prefs) {
        return (
            <Card>
                <CardContent className="py-8 text-center text-gray-500">
                    Impossible de charger les preferences.
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Bell size={20} /> Preferences de Notifications
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Morning Vital Reminder */}
                    <div className="flex items-center justify-between p-4 bg-amber-50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <Sun className="text-amber-500" size={24} />
                            <div>
                                <p className="font-medium text-gray-900">Rappel du matin</p>
                                <p className="text-sm text-gray-500">
                                    Rappel quotidien pour saisir vos mesures du matin
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <input
                                type="time"
                                value={prefs.morningReminderTime || '07:00'}
                                onChange={e => updateField('morningReminderTime', e.target.value)}
                                disabled={!prefs.vitalReminderEnabled}
                                className="px-2 py-1 border rounded text-sm disabled:opacity-50"
                            />
                            <Toggle
                                checked={prefs.vitalReminderEnabled}
                                onChange={v => updateField('vitalReminderEnabled', v)}
                            />
                        </div>
                    </div>

                    {/* Evening Vital Reminder */}
                    <div className="flex items-center justify-between p-4 bg-indigo-50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <Moon className="text-indigo-500" size={24} />
                            <div>
                                <p className="font-medium text-gray-900">Rappel du soir</p>
                                <p className="text-sm text-gray-500">
                                    Rappel pour saisir vos mesures du soir
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <input
                                type="time"
                                value={prefs.eveningReminderTime || '19:00'}
                                onChange={e => updateField('eveningReminderTime', e.target.value)}
                                disabled={!prefs.eveningReminderEnabled}
                                className="px-2 py-1 border rounded text-sm disabled:opacity-50"
                            />
                            <Toggle
                                checked={prefs.eveningReminderEnabled}
                                onChange={v => updateField('eveningReminderEnabled', v)}
                            />
                        </div>
                    </div>

                    {/* Medication Reminder */}
                    <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <Pill className="text-orange-500" size={24} />
                            <div>
                                <p className="font-medium text-gray-900">Rappel medicaments</p>
                                <p className="text-sm text-gray-500">
                                    Rappel pour prendre vos medicaments selon votre ordonnance
                                </p>
                            </div>
                        </div>
                        <Toggle
                            checked={prefs.medicationReminderEnabled}
                            onChange={v => updateField('medicationReminderEnabled', v)}
                        />
                    </div>

                    {/* Escalation Alert */}
                    <div className="flex items-center justify-between p-4 bg-red-50 rounded-lg">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className="text-red-500" size={24} />
                            <div>
                                <p className="font-medium text-gray-900">Alerte au medecin</p>
                                <p className="text-sm text-gray-500">
                                    Prevenir votre medecin si vous ne saisissez pas de mesures pendant plusieurs jours
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <select
                                value={prefs.escalationDays || 3}
                                onChange={e => updateField('escalationDays', parseInt(e.target.value))}
                                disabled={!prefs.escalationEnabled}
                                className="px-2 py-1 border rounded text-sm disabled:opacity-50"
                            >
                                {[1, 2, 3, 5, 7, 14].map(d => (
                                    <option key={d} value={d}>{d} jour{d > 1 ? 's' : ''}</option>
                                ))}
                            </select>
                            <Toggle
                                checked={prefs.escalationEnabled}
                                onChange={v => updateField('escalationEnabled', v)}
                            />
                        </div>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end pt-2">
                        <Button onClick={savePrefs} disabled={saving} className="gap-2">
                            {saving ? <Loader2 className="animate-spin" size={16} /> : <Save size={16} />}
                            Enregistrer
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default NotificationPreferences;
