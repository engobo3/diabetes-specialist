import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getTranslations } from '../translations';
import toast from 'react-hot-toast';
import { Card, CardContent } from '../components/ui/Card';
import {
    Calendar, ChevronLeft, ChevronRight, Check, X, Clock,
    ArrowLeft, Edit2, Save, Users, AlertCircle, CheckCircle,
    Plus, Trash2, Eye
} from 'lucide-react';

// ─── Helpers ────────────────────────────────────────────────
const DAY_KEYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const getDaysInMonth = (y, m) => new Date(y, m + 1, 0).getDate();

const getFirstDayOffset = (y, m) => {
    const d = new Date(y, m, 1).getDay();
    return d === 0 ? 6 : d - 1;
};

const pad = (n) => String(n).padStart(2, '0');
const fmtDate = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

const MONTHS_FR = [
    'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
    'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre'
];

const STATUS_COLORS = {
    confirmed: { dot: 'bg-green-500', badge: 'bg-green-100 text-green-700', bg: 'bg-green-100 border-green-300 text-green-800' },
    pending:   { dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-700', bg: 'bg-yellow-100 border-yellow-300 text-yellow-800' },
    rejected:  { dot: 'bg-red-500', badge: 'bg-red-100 text-red-700', bg: 'bg-red-100 border-red-300 text-red-800' },
    completed: { dot: 'bg-gray-400', badge: 'bg-gray-100 text-gray-600', bg: 'bg-gray-100 border-gray-300 text-gray-600' },
};

const EVENT_COLORS = {
    break:      { bg: 'bg-orange-100', border: 'border-orange-300', text: 'text-orange-700' },
    lunch:      { bg: 'bg-amber-100',  border: 'border-amber-300',  text: 'text-amber-700' },
    meeting:    { bg: 'bg-purple-100', border: 'border-purple-300', text: 'text-purple-700' },
    admin:      { bg: 'bg-blue-100',   border: 'border-blue-300',   text: 'text-blue-700' },
    personal:   { bg: 'bg-pink-100',   border: 'border-pink-300',   text: 'text-pink-700' },
    vacation:   { bg: 'bg-teal-100',   border: 'border-teal-300',   text: 'text-teal-700' },
    conference: { bg: 'bg-indigo-100', border: 'border-indigo-300', text: 'text-indigo-700' },
    sick:       { bg: 'bg-red-50',     border: 'border-red-300',    text: 'text-red-600' },
    other:      { bg: 'bg-gray-100',   border: 'border-gray-300',   text: 'text-gray-700' },
};

const CATEGORIES = ['break', 'lunch', 'meeting', 'admin', 'personal', 'vacation', 'conference', 'sick', 'other'];

const HOURS = Array.from({ length: 13 }, (_, i) => 7 + i); // 7..19

const timeToMinutes = (t) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
};

const minutesToTime = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;

// Pixel position from 07:00 (40px per half hour)
const timeToY = (timeStr) => ((timeToMinutes(timeStr) - 420) / 30) * 40;

const CATEGORY_LABELS = {
    break: 'catBreak', lunch: 'catLunch', meeting: 'catMeeting',
    admin: 'catAdmin', personal: 'catPersonal', vacation: 'catVacation',
    conference: 'catConference', sick: 'catSick', other: 'catOther',
};

// ─── Component ──────────────────────────────────────────────
const DoctorCalendar = ({ embedded = false }) => {
    const navigate = useNavigate();
    const { currentUser, doctorProfile } = useAuth();
    const { language } = useLanguage();
    const t = getTranslations('doctorCalendar', language);
    const dayLabels = [t.mon, t.tue, t.wed, t.thu, t.fri, t.sat, t.sun];

    const [activeTab, setActiveTab] = useState('month');
    const [currentMonth, setCurrentMonth] = useState(() => {
        const now = new Date();
        return { year: now.getFullYear(), month: now.getMonth() };
    });
    const [appointments, setAppointments] = useState([]);
    const [doctorEvents, setDoctorEvents] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [loading, setLoading] = useState(true);
    const [doctor, setDoctor] = useState(null);
    const [editingNote, setEditingNote] = useState(null);

    // Day/week view state
    const [dayViewDate, setDayViewDate] = useState(() => {
        const now = new Date();
        return fmtDate(now.getFullYear(), now.getMonth(), now.getDate());
    });

    // Event modal state
    const [showEventModal, setShowEventModal] = useState(false);
    const [editingEvent, setEditingEvent] = useState(null);
    const [eventForm, setEventForm] = useState({
        title: '', category: 'meeting', date: '', startTime: '09:00', endTime: '09:30', allDay: false, notes: ''
    });

    const apiUrl = import.meta.env.VITE_API_URL || '';

    // ─── Fetch appointments ─────────────────────────────────
    useEffect(() => {
        const fetchAppointments = async () => {
            if (!doctorProfile?.id || !currentUser) return;
            setLoading(true);
            try {
                const token = await currentUser.getIdToken();
                const res = await fetch(
                    `${apiUrl}/api/appointments?doctorId=${doctorProfile.id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                if (res.ok) {
                    const data = await res.json();
                    setAppointments(Array.isArray(data) ? data : []);
                }
            } catch (err) {
                console.error('Error fetching appointments:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchAppointments();
    }, [doctorProfile, currentUser]);

    // ─── Fetch doctor events ────────────────────────────────
    useEffect(() => {
        const fetchEvents = async () => {
            if (!doctorProfile?.id || !currentUser) return;
            try {
                const token = await currentUser.getIdToken();
                const res = await fetch(
                    `${apiUrl}/api/doctor-events/doctor/${doctorProfile.id}`,
                    { headers: { Authorization: `Bearer ${token}` } }
                );
                if (res.ok) {
                    const data = await res.json();
                    setDoctorEvents(Array.isArray(data) ? data : []);
                }
            } catch (err) {
                console.error('Error fetching doctor events:', err);
            }
        };
        fetchEvents();
    }, [doctorProfile, currentUser]);

    // ─── Fetch doctor for availability ──────────────────────
    useEffect(() => {
        const fetchDoctor = async () => {
            if (!doctorProfile?.id) return;
            try {
                const res = await fetch(`${apiUrl}/api/doctors/${doctorProfile.id}`);
                if (res.ok) setDoctor(await res.json());
            } catch (err) {
                console.error('Error fetching doctor:', err);
            }
        };
        fetchDoctor();
    }, [doctorProfile]);

    // ─── Derived data ───────────────────────────────────────
    const { year, month } = currentMonth;
    const todayStr = fmtDate(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

    const appointmentsByDate = useMemo(() => {
        const map = {};
        appointments.forEach(apt => {
            if (!map[apt.date]) map[apt.date] = [];
            map[apt.date].push(apt);
        });
        Object.values(map).forEach(arr => arr.sort((a, b) => (a.time || '').localeCompare(b.time || '')));
        return map;
    }, [appointments]);

    const eventsByDate = useMemo(() => {
        const map = {};
        doctorEvents.forEach(evt => {
            if (!map[evt.date]) map[evt.date] = [];
            map[evt.date].push(evt);
        });
        Object.values(map).forEach(arr => arr.sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')));
        return map;
    }, [doctorEvents]);

    const monthAppointments = useMemo(() => {
        const prefix = `${year}-${pad(month + 1)}`;
        return appointments.filter(a => a.date?.startsWith(prefix));
    }, [appointments, year, month]);

    const stats = useMemo(() => ({
        total: monthAppointments.length,
        pending: monthAppointments.filter(a => a.status === 'pending').length,
        confirmed: monthAppointments.filter(a => a.status === 'confirmed').length,
        rejected: monthAppointments.filter(a => a.status === 'rejected').length,
    }), [monthAppointments]);

    const selectedAppointments = selectedDate ? (appointmentsByDate[selectedDate] || []) : [];

    // Week dates for week view
    const weekDates = useMemo(() => {
        const d = new Date(dayViewDate + 'T00:00:00');
        const dayOfWeek = d.getDay();
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        const monday = new Date(d);
        monday.setDate(d.getDate() + mondayOffset);
        return Array.from({ length: 7 }, (_, i) => {
            const date = new Date(monday);
            date.setDate(monday.getDate() + i);
            return fmtDate(date.getFullYear(), date.getMonth(), date.getDate());
        });
    }, [dayViewDate]);

    // ─── Appointment actions ────────────────────────────────
    const handleStatusChange = async (appointmentId, newStatus) => {
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch(`${apiUrl}/api/appointments/${appointmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ status: newStatus })
            });
            if (res.ok) {
                const updated = await res.json();
                setAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, ...updated } : a));
                toast.success(newStatus === 'confirmed' ? t.confirmSuccess : t.rejectSuccess);
            } else {
                toast.error(t.updateError);
            }
        } catch {
            toast.error(t.updateError);
        }
    };

    const handleSaveNote = async (appointmentId, noteText) => {
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch(`${apiUrl}/api/appointments/${appointmentId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                body: JSON.stringify({ notes: noteText })
            });
            if (res.ok) {
                setAppointments(prev => prev.map(a => a.id === appointmentId ? { ...a, notes: noteText } : a));
                setEditingNote(null);
                toast.success(t.noteSaved);
            }
        } catch {
            toast.error(t.updateError);
        }
    };

    // ─── Event CRUD ─────────────────────────────────────────
    const openCreateEvent = (date, startTime) => {
        setEditingEvent(null);
        setEventForm({
            title: '', category: 'meeting', date: date || dayViewDate,
            startTime: startTime || '09:00', endTime: minutesToTime(timeToMinutes(startTime || '09:00') + 30),
            allDay: false, notes: ''
        });
        setShowEventModal(true);
    };

    const openEditEvent = (evt) => {
        setEditingEvent(evt);
        setEventForm({
            title: evt.title, category: evt.category, date: evt.date,
            startTime: evt.startTime, endTime: evt.endTime,
            allDay: evt.allDay || false, notes: evt.notes || ''
        });
        setShowEventModal(true);
    };

    const handleSaveEvent = async () => {
        if (!eventForm.title.trim()) return;
        try {
            const token = await currentUser.getIdToken();
            const body = {
                doctorId: doctorProfile.id,
                title: eventForm.title.trim(),
                category: eventForm.category,
                date: eventForm.date,
                startTime: eventForm.allDay ? '07:00' : eventForm.startTime,
                endTime: eventForm.allDay ? '19:00' : eventForm.endTime,
                allDay: eventForm.allDay,
                notes: eventForm.notes
            };

            if (editingEvent) {
                const res = await fetch(`${apiUrl}/api/doctor-events/${editingEvent.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify(body)
                });
                if (res.ok) {
                    const updated = await res.json();
                    setDoctorEvents(prev => prev.map(e => e.id === editingEvent.id ? { ...e, ...updated } : e));
                    toast.success(t.eventUpdated);
                } else { toast.error(t.eventError); return; }
            } else {
                const res = await fetch(`${apiUrl}/api/doctor-events`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
                    body: JSON.stringify(body)
                });
                if (res.ok) {
                    const created = await res.json();
                    setDoctorEvents(prev => [...prev, created]);
                    toast.success(t.eventCreated);
                } else { toast.error(t.eventError); return; }
            }
            setShowEventModal(false);
            setEditingEvent(null);
        } catch {
            toast.error(t.eventError);
        }
    };

    const handleDeleteEvent = async (evtId) => {
        try {
            const token = await currentUser.getIdToken();
            const res = await fetch(`${apiUrl}/api/doctor-events/${evtId}`, {
                method: 'DELETE',
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.ok) {
                setDoctorEvents(prev => prev.filter(e => e.id !== evtId));
                setShowEventModal(false);
                setEditingEvent(null);
                toast.success(t.eventDeleted);
            } else { toast.error(t.eventError); }
        } catch {
            toast.error(t.eventError);
        }
    };

    // ─── Navigation helpers ─────────────────────────────────
    const goToMonth = (delta) => {
        setCurrentMonth(prev => {
            let m = prev.month + delta;
            let y = prev.year;
            if (m < 0) { m = 11; y--; }
            if (m > 11) { m = 0; y++; }
            return { year: y, month: m };
        });
        setSelectedDate(null);
    };

    const goToday = () => {
        const now = new Date();
        setCurrentMonth({ year: now.getFullYear(), month: now.getMonth() });
        setSelectedDate(todayStr);
    };

    const goDay = (delta) => {
        const d = new Date(dayViewDate + 'T00:00:00');
        d.setDate(d.getDate() + delta);
        setDayViewDate(fmtDate(d.getFullYear(), d.getMonth(), d.getDate()));
    };

    const goWeek = (delta) => {
        const d = new Date(dayViewDate + 'T00:00:00');
        d.setDate(d.getDate() + delta * 7);
        setDayViewDate(fmtDate(d.getFullYear(), d.getMonth(), d.getDate()));
    };

    // ─── Calendar grid data ─────────────────────────────────
    const daysInMonth = getDaysInMonth(year, month);
    const firstOffset = getFirstDayOffset(year, month);
    const cells = [];
    for (let i = 0; i < firstOffset; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    // Tab config
    const TABS = [
        { id: 'month', label: t.monthTab || t.calendarTab },
        { id: 'day', label: t.dayTab || 'Jour' },
        { id: 'week', label: t.weekTab || 'Semaine' },
        { id: 'availability', label: t.availabilityTab },
    ];

    // Slot duration for computing appointment end times on timeline
    const slotDuration = doctor?.slotDuration || 30;

    // ─── Render ─────────────────────────────────────────────
    return (
        <div className={embedded ? '' : 'min-h-screen bg-slate-50'}>
            {/* Header */}
            {!embedded && <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
                <div className="container py-3 sm:py-6 px-3 sm:px-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <button onClick={() => navigate('/doctor-dashboard')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                                <ArrowLeft size={20} className="text-gray-600" />
                            </button>
                            <div>
                                <h1 className="text-xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
                                    <Calendar size={24} className="text-primary" />
                                    {t.title}
                                </h1>
                                <p className="text-gray-600 mt-1 text-sm sm:text-base">{t.subtitle}</p>
                            </div>
                        </div>
                        {activeTab !== 'availability' && (
                            <button
                                onClick={() => openCreateEvent(activeTab === 'day' ? dayViewDate : todayStr, '09:00')}
                                className="flex items-center gap-1.5 px-3 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                            >
                                <Plus size={16} /> {t.addEvent}
                            </button>
                        )}
                    </div>

                    {/* Tabs */}
                    <div className="flex gap-1 mt-4 bg-gray-100 p-1 rounded-lg w-fit overflow-x-auto">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                                    activeTab === tab.id ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </header>}

            <main className={embedded ? 'py-4 px-1' : 'container py-4 sm:py-6 px-3 sm:px-4'}>
                {embedded && (
                    <div className="flex gap-1 mb-4 bg-gray-100 p-1 rounded-lg w-fit overflow-x-auto">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`px-3 sm:px-4 py-2 text-sm font-medium rounded-md transition-all whitespace-nowrap ${
                                    activeTab === tab.id ? 'bg-white text-primary shadow-sm' : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                )}
                {/* ═══ MONTH TAB ═══ */}
                {activeTab === 'month' && (
                    <>
                        {/* Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
                            {[
                                { label: t.totalThisMonth, value: stats.total, icon: Calendar, color: 'text-blue-600 bg-blue-50' },
                                { label: t.pending, value: stats.pending, icon: Clock, color: 'text-yellow-600 bg-yellow-50' },
                                { label: t.confirmed, value: stats.confirmed, icon: CheckCircle, color: 'text-green-600 bg-green-50' },
                                { label: t.rejected, value: stats.rejected, icon: AlertCircle, color: 'text-red-600 bg-red-50' },
                            ].map(s => (
                                <Card key={s.label}>
                                    <CardContent className="pt-4 pb-4">
                                        <div className="flex items-center gap-3">
                                            <div className={`p-2 rounded-lg ${s.color}`}><s.icon size={18} /></div>
                                            <div>
                                                <p className="text-2xl font-bold text-gray-900">{s.value}</p>
                                                <p className="text-xs text-gray-500">{s.label}</p>
                                            </div>
                                        </div>
                                    </CardContent>
                                </Card>
                            ))}
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            {/* Calendar grid */}
                            <div className="lg:col-span-2">
                                <Card>
                                    <CardContent className="pt-4">
                                        <div className="flex items-center justify-between mb-4">
                                            <button onClick={() => goToMonth(-1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft size={20} /></button>
                                            <div className="text-center">
                                                <h2 className="text-lg font-bold text-gray-900">{MONTHS_FR[month]} {year}</h2>
                                                <button onClick={goToday} className="text-xs text-primary hover:underline">{t.today}</button>
                                            </div>
                                            <button onClick={() => goToMonth(1)} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight size={20} /></button>
                                        </div>

                                        <div className="grid grid-cols-7 gap-1 mb-1">
                                            {dayLabels.map(d => (
                                                <div key={d} className="text-center text-xs font-medium text-gray-500 py-1">{d}</div>
                                            ))}
                                        </div>

                                        {loading ? (
                                            <div className="flex items-center justify-center py-20">
                                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-7 gap-1">
                                                {cells.map((day, i) => {
                                                    if (day === null) return <div key={`e-${i}`} className="aspect-square" />;
                                                    const dateStr = fmtDate(year, month, day);
                                                    const dayApts = appointmentsByDate[dateStr] || [];
                                                    const dayEvts = eventsByDate[dateStr] || [];
                                                    const isToday = dateStr === todayStr;
                                                    const isSelected = dateStr === selectedDate;

                                                    return (
                                                        <button
                                                            key={dateStr}
                                                            onClick={() => setSelectedDate(dateStr)}
                                                            className={`aspect-square p-1 rounded-lg text-sm transition-all relative flex flex-col items-center justify-start gap-0.5
                                                                ${isSelected ? 'ring-2 ring-primary bg-primary/5' : 'hover:bg-gray-50'}
                                                                ${isToday && !isSelected ? 'bg-blue-50' : ''}
                                                            `}
                                                        >
                                                            <span className={`text-xs font-medium ${isToday ? 'text-primary font-bold' : 'text-gray-700'}`}>
                                                                {day}
                                                            </span>
                                                            {dayApts.length > 0 && (
                                                                <div className="flex gap-0.5 flex-wrap justify-center">
                                                                    {dayApts.slice(0, 4).map((apt, j) => (
                                                                        <span key={j} className={`w-1.5 h-1.5 rounded-full ${STATUS_COLORS[apt.status]?.dot || 'bg-gray-400'}`} />
                                                                    ))}
                                                                    {dayApts.length > 4 && (
                                                                        <span className="text-[8px] text-gray-400">+{dayApts.length - 4}</span>
                                                                    )}
                                                                </div>
                                                            )}
                                                            {dayEvts.length > 0 && (
                                                                <div className="w-3 h-0.5 rounded bg-purple-400 mt-0.5" />
                                                            )}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>

                            {/* Day detail panel */}
                            <div className="lg:col-span-1">
                                <Card className="sticky top-28">
                                    <CardContent className="pt-4">
                                        {selectedDate ? (
                                            <>
                                                <div className="flex items-center justify-between mb-3">
                                                    <h3 className="font-bold text-gray-900">
                                                        {new Date(selectedDate + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                                    </h3>
                                                    <button
                                                        onClick={() => { setDayViewDate(selectedDate); setActiveTab('day'); }}
                                                        className="flex items-center gap-1 text-xs text-primary hover:underline"
                                                    >
                                                        <Eye size={12} /> {t.viewDay}
                                                    </button>
                                                </div>

                                                {/* Events for this day */}
                                                {(eventsByDate[selectedDate] || []).length > 0 && (
                                                    <div className="space-y-1 mb-3">
                                                        {(eventsByDate[selectedDate] || []).map(evt => {
                                                            const ec = EVENT_COLORS[evt.category] || EVENT_COLORS.other;
                                                            return (
                                                                <button key={evt.id} onClick={() => openEditEvent(evt)}
                                                                    className={`w-full text-left px-2 py-1 rounded border text-xs ${ec.bg} ${ec.border} ${ec.text}`}>
                                                                    {evt.allDay ? t.eventAllDay : `${evt.startTime}-${evt.endTime}`} {evt.title}
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}

                                                {selectedAppointments.length === 0 && (eventsByDate[selectedDate] || []).length === 0 ? (
                                                    <p className="text-sm text-gray-400 py-8 text-center">{t.noAppointments}</p>
                                                ) : (
                                                    <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                                                        {selectedAppointments.map(apt => (
                                                            <AppointmentCard key={apt.id} apt={apt} t={t}
                                                                editingNote={editingNote} setEditingNote={setEditingNote}
                                                                onStatusChange={handleStatusChange} onSaveNote={handleSaveNote} />
                                                        ))}
                                                    </div>
                                                )}
                                            </>
                                        ) : (
                                            <div className="py-12 text-center">
                                                <Calendar size={32} className="mx-auto mb-3 text-gray-300" />
                                                <p className="text-sm text-gray-400">{t.selectDay}</p>
                                            </div>
                                        )}
                                    </CardContent>
                                </Card>
                            </div>
                        </div>
                    </>
                )}

                {/* ═══ DAY TAB ═══ */}
                {activeTab === 'day' && (
                    <DayView
                        date={dayViewDate}
                        appointments={appointmentsByDate[dayViewDate] || []}
                        events={eventsByDate[dayViewDate] || []}
                        slotDuration={slotDuration}
                        t={t}
                        todayStr={todayStr}
                        onPrev={() => goDay(-1)}
                        onNext={() => goDay(1)}
                        onToday={() => setDayViewDate(todayStr)}
                        onClickSlot={(time) => openCreateEvent(dayViewDate, time)}
                        onClickEvent={openEditEvent}
                        onStatusChange={handleStatusChange}
                        editingNote={editingNote}
                        setEditingNote={setEditingNote}
                        onSaveNote={handleSaveNote}
                    />
                )}

                {/* ═══ WEEK TAB ═══ */}
                {activeTab === 'week' && (
                    <WeekView
                        weekDates={weekDates}
                        appointmentsByDate={appointmentsByDate}
                        eventsByDate={eventsByDate}
                        slotDuration={slotDuration}
                        dayLabels={dayLabels}
                        t={t}
                        todayStr={todayStr}
                        onPrevWeek={() => goWeek(-1)}
                        onNextWeek={() => goWeek(1)}
                        onThisWeek={() => {
                            const now = new Date();
                            setDayViewDate(fmtDate(now.getFullYear(), now.getMonth(), now.getDate()));
                        }}
                        onClickSlot={(date, time) => openCreateEvent(date, time)}
                        onClickEvent={openEditEvent}
                        onClickDay={(date) => { setDayViewDate(date); setActiveTab('day'); }}
                    />
                )}

                {/* ═══ AVAILABILITY TAB ═══ */}
                {activeTab === 'availability' && (
                    <Card>
                        <CardContent className="pt-6">
                            <div className="flex items-center justify-between mb-6">
                                <h2 className="text-lg font-bold text-gray-900">{t.availabilityTab}</h2>
                                <button
                                    onClick={() => navigate(`/edit-doctor/${doctorProfile?.id}`)}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                                >
                                    <Edit2 size={16} /> {t.editAvailability}
                                </button>
                            </div>

                            {!doctor?.availability ? (
                                <p className="text-gray-400 text-center py-12">{t.notAvailable}</p>
                            ) : (
                                <div className="overflow-x-auto">
                                    <div className="min-w-[600px]">
                                        <div className="grid grid-cols-8 gap-px bg-gray-200 rounded-t-lg overflow-hidden">
                                            <div className="bg-gray-50 p-2 text-xs font-medium text-gray-500" />
                                            {DAY_KEYS.map((key, i) => (
                                                <div key={key} className="bg-gray-50 p-2 text-center text-xs font-medium text-gray-700">
                                                    {dayLabels[i]}
                                                </div>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-8 gap-px bg-gray-200 rounded-b-lg overflow-hidden">
                                            {HOURS.map(hour => (
                                                <HourRow key={hour} hour={hour} availability={doctor.availability} />
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </main>

            {/* ═══ EVENT MODAL ═══ */}
            {showEventModal && (
                <EventModal
                    t={t}
                    form={eventForm}
                    setForm={setEventForm}
                    isEditing={!!editingEvent}
                    onSave={handleSaveEvent}
                    onDelete={editingEvent ? () => handleDeleteEvent(editingEvent.id) : null}
                    onClose={() => { setShowEventModal(false); setEditingEvent(null); }}
                />
            )}
        </div>
    );
};

// ─── Appointment Card (shared between month detail + day view) ──
const AppointmentCard = ({ apt, t, editingNote, setEditingNote, onStatusChange, onSaveNote }) => {
    const sc = STATUS_COLORS[apt.status] || STATUS_COLORS.completed;
    const isEditing = editingNote?.id === apt.id;
    return (
        <div className="border border-gray-100 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <Clock size={14} className="text-gray-400" />
                    <span className="font-medium text-sm">{apt.time || '--:--'}</span>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${sc.badge}`}>
                    {t[apt.status] || apt.status}
                </span>
            </div>
            <div className="text-sm">
                <div className="flex items-center gap-1 text-gray-700">
                    <Users size={13} className="text-gray-400" />
                    <span className="font-medium">{apt.patientName || `${t.patient} #${apt.patientId}`}</span>
                </div>
                {apt.reason && <p className="text-xs text-gray-500 mt-1">{t.reason}: {apt.reason}</p>}
            </div>
            <div className="text-xs">
                {isEditing ? (
                    <div className="space-y-1">
                        <textarea className="w-full border rounded p-2 text-xs resize-none" rows={2}
                            value={editingNote.text}
                            onChange={e => setEditingNote({ ...editingNote, text: e.target.value })} />
                        <div className="flex gap-1">
                            <button onClick={() => onSaveNote(apt.id, editingNote.text)}
                                className="flex items-center gap-1 px-2 py-1 bg-primary text-white rounded text-xs">
                                <Save size={10} /> {t.save}
                            </button>
                            <button onClick={() => setEditingNote(null)}
                                className="px-2 py-1 text-gray-500 hover:text-gray-700 text-xs">{t.cancel}</button>
                        </div>
                    </div>
                ) : (
                    <button onClick={() => setEditingNote({ id: apt.id, text: apt.notes || '' })}
                        className="flex items-center gap-1 text-gray-400 hover:text-gray-600">
                        <Edit2 size={10} />
                        {apt.notes ? <span className="text-gray-600">{apt.notes}</span> : <span>{t.notes}...</span>}
                    </button>
                )}
            </div>
            {apt.status === 'pending' && (
                <div className="flex gap-2 pt-1">
                    <button onClick={() => onStatusChange(apt.id, 'confirmed')}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 transition-colors">
                        <Check size={14} /> {t.confirm}
                    </button>
                    <button onClick={() => onStatusChange(apt.id, 'rejected')}
                        className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors">
                        <X size={14} /> {t.reject}
                    </button>
                </div>
            )}
        </div>
    );
};

// ─── Day View ───────────────────────────────────────────────
const DayView = ({ date, appointments, events, slotDuration, t, todayStr, onPrev, onNext, onToday, onClickSlot, onClickEvent, onStatusChange, editingNote, setEditingNote, onSaveNote }) => {
    const isToday = date === todayStr;
    const dateLabel = new Date(date + 'T00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const totalHeight = HOURS.length * 80; // 80px per hour (2 * 40px half-hours)

    return (
        <div>
            {/* Day nav */}
            <div className="flex items-center justify-between mb-4">
                <button onClick={onPrev} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft size={20} /></button>
                <div className="text-center">
                    <h2 className="text-lg font-bold text-gray-900 capitalize">{dateLabel}</h2>
                    {!isToday && <button onClick={onToday} className="text-xs text-primary hover:underline">{t.today}</button>}
                </div>
                <button onClick={onNext} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight size={20} /></button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Timeline */}
                <div className="lg:col-span-2">
                    <Card>
                        <CardContent className="pt-4 pb-4">
                            <div className="relative" style={{ height: totalHeight }}>
                                {/* Hour lines */}
                                {HOURS.map(hour => {
                                    const y = (hour - 7) * 80;
                                    return (
                                        <div key={hour} className="absolute left-0 right-0" style={{ top: y }}>
                                            <div className="flex items-start">
                                                <span className="text-xs text-gray-400 w-12 text-right pr-2 -mt-2 shrink-0">{pad(hour)}:00</span>
                                                <div className="flex-1 border-t border-gray-100" />
                                            </div>
                                            {/* Half-hour line */}
                                            <div className="flex items-start" style={{ marginTop: 38 }}>
                                                <span className="w-12 shrink-0" />
                                                <div className="flex-1 border-t border-gray-50" />
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Clickable empty slots */}
                                {HOURS.map(hour => (
                                    [0, 30].map(min => {
                                        const time = `${pad(hour)}:${pad(min)}`;
                                        const y = timeToY(time);
                                        return (
                                            <button key={time} onClick={() => onClickSlot(time)}
                                                className="absolute left-12 right-0 h-[40px] hover:bg-primary/5 transition-colors rounded"
                                                style={{ top: y }} title={`${t.addEvent} ${time}`} />
                                        );
                                    })
                                ))}

                                {/* Doctor events */}
                                {events.map(evt => {
                                    const ec = EVENT_COLORS[evt.category] || EVENT_COLORS.other;
                                    const top = timeToY(evt.startTime);
                                    const height = Math.max(timeToY(evt.endTime) - top, 24);
                                    return (
                                        <button key={evt.id} onClick={() => onClickEvent(evt)}
                                            className={`absolute left-12 right-1/2 rounded-lg border px-2 py-1 text-xs overflow-hidden z-[2] ${ec.bg} ${ec.border} ${ec.text} hover:opacity-80 transition-opacity`}
                                            style={{ top, height }}>
                                            <div className="font-medium truncate">{evt.title}</div>
                                            {height > 30 && <div className="text-[10px] opacity-75">{evt.startTime}–{evt.endTime}</div>}
                                        </button>
                                    );
                                })}

                                {/* Appointments */}
                                {appointments.filter(a => a.time).map(apt => {
                                    const sc = STATUS_COLORS[apt.status] || STATUS_COLORS.completed;
                                    const top = timeToY(apt.time);
                                    const height = Math.max((slotDuration / 30) * 40, 24);
                                    return (
                                        <div key={apt.id}
                                            className={`absolute left-[calc(50%+0.25rem)] right-0 rounded-lg border px-2 py-1 text-xs overflow-hidden z-[2] ${sc.bg}`}
                                            style={{ top, height }}>
                                            <div className="font-medium truncate">{apt.patientName || `Patient #${apt.patientId}`}</div>
                                            {height > 30 && <div className="text-[10px] opacity-75">{apt.time} — {apt.reason || t[apt.status]}</div>}
                                        </div>
                                    );
                                })}
                            </div>
                        </CardContent>
                    </Card>
                </div>

                {/* Side panel: day appointments list */}
                <div className="lg:col-span-1">
                    <Card className="sticky top-28">
                        <CardContent className="pt-4">
                            <h3 className="font-bold text-gray-900 mb-3 text-sm">{t.calendarTab}</h3>
                            {appointments.length === 0 && events.length === 0 ? (
                                <p className="text-sm text-gray-400 py-6 text-center">{t.noAppointments}</p>
                            ) : (
                                <div className="space-y-3 max-h-[60vh] overflow-y-auto">
                                    {events.map(evt => {
                                        const ec = EVENT_COLORS[evt.category] || EVENT_COLORS.other;
                                        return (
                                            <button key={evt.id} onClick={() => onClickEvent(evt)}
                                                className={`w-full text-left rounded-lg border p-2 text-xs ${ec.bg} ${ec.border} ${ec.text}`}>
                                                <div className="font-medium">{evt.title}</div>
                                                <div className="text-[10px] opacity-75">{evt.allDay ? t.eventAllDay : `${evt.startTime}–${evt.endTime}`}</div>
                                            </button>
                                        );
                                    })}
                                    {appointments.map(apt => (
                                        <AppointmentCard key={apt.id} apt={apt} t={t}
                                            editingNote={editingNote} setEditingNote={setEditingNote}
                                            onStatusChange={onStatusChange} onSaveNote={onSaveNote} />
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

// ─── Week View ──────────────────────────────────────────────
const WeekView = ({ weekDates, appointmentsByDate, eventsByDate, slotDuration, dayLabels, t, todayStr, onPrevWeek, onNextWeek, onThisWeek, onClickSlot, onClickEvent, onClickDay }) => {
    const totalHeight = HOURS.length * 80;
    const weekStart = new Date(weekDates[0] + 'T00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
    const weekEnd = new Date(weekDates[6] + 'T00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });

    return (
        <div>
            {/* Week nav */}
            <div className="flex items-center justify-between mb-4">
                <button onClick={onPrevWeek} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronLeft size={20} /></button>
                <div className="text-center">
                    <h2 className="text-lg font-bold text-gray-900">{weekStart} — {weekEnd}</h2>
                    <button onClick={onThisWeek} className="text-xs text-primary hover:underline">{t.thisWeek || "Cette semaine"}</button>
                </div>
                <button onClick={onNextWeek} className="p-2 hover:bg-gray-100 rounded-lg"><ChevronRight size={20} /></button>
            </div>

            <Card>
                <CardContent className="pt-4 pb-4">
                    <div className="overflow-x-auto">
                        <div className="min-w-[700px]">
                            {/* Day headers */}
                            <div className="grid grid-cols-8 gap-px mb-px">
                                <div className="w-12" />
                                {weekDates.map((date, i) => {
                                    const isToday = date === todayStr;
                                    const dayNum = date.split('-')[2];
                                    return (
                                        <button key={date} onClick={() => onClickDay(date)}
                                            className={`text-center py-2 rounded-t-lg text-xs font-medium transition-colors hover:bg-gray-50 ${isToday ? 'bg-blue-50 text-primary font-bold' : 'text-gray-700'}`}>
                                            {dayLabels[i]} <span className="block text-sm">{parseInt(dayNum)}</span>
                                        </button>
                                    );
                                })}
                            </div>

                            {/* Timeline grid */}
                            <div className="relative grid grid-cols-8 gap-px" style={{ height: totalHeight }}>
                                {/* Time column */}
                                <div className="relative">
                                    {HOURS.map(hour => (
                                        <div key={hour} className="absolute left-0 right-0" style={{ top: (hour - 7) * 80 }}>
                                            <span className="text-[10px] text-gray-400 text-right block pr-1 -mt-2">{pad(hour)}:00</span>
                                        </div>
                                    ))}
                                </div>

                                {/* Day columns */}
                                {weekDates.map(date => {
                                    const dayApts = (appointmentsByDate[date] || []).filter(a => a.time);
                                    const dayEvts = eventsByDate[date] || [];
                                    return (
                                        <div key={date} className="relative border-l border-gray-100">
                                            {/* Hour lines */}
                                            {HOURS.map(hour => (
                                                <div key={hour} className="absolute left-0 right-0 border-t border-gray-50" style={{ top: (hour - 7) * 80 }} />
                                            ))}

                                            {/* Clickable slots */}
                                            {HOURS.map(hour => (
                                                [0, 30].map(min => {
                                                    const time = `${pad(hour)}:${pad(min)}`;
                                                    return (
                                                        <button key={time} onClick={() => onClickSlot(date, time)}
                                                            className="absolute left-0 right-0 h-[40px] hover:bg-primary/5 transition-colors"
                                                            style={{ top: timeToY(time) }} />
                                                    );
                                                })
                                            ))}

                                            {/* Events */}
                                            {dayEvts.map(evt => {
                                                const ec = EVENT_COLORS[evt.category] || EVENT_COLORS.other;
                                                const top = timeToY(evt.startTime);
                                                const height = Math.max(timeToY(evt.endTime) - top, 20);
                                                return (
                                                    <button key={evt.id} onClick={() => onClickEvent(evt)}
                                                        className={`absolute left-0.5 right-0.5 rounded border px-1 py-0.5 text-[10px] overflow-hidden z-[2] ${ec.bg} ${ec.border} ${ec.text} hover:opacity-80`}
                                                        style={{ top, height }}>
                                                        <div className="font-medium truncate">{evt.title}</div>
                                                    </button>
                                                );
                                            })}

                                            {/* Appointments */}
                                            {dayApts.map(apt => {
                                                const sc = STATUS_COLORS[apt.status] || STATUS_COLORS.completed;
                                                const top = timeToY(apt.time);
                                                const height = Math.max((slotDuration / 30) * 40, 20);
                                                return (
                                                    <div key={apt.id}
                                                        className={`absolute left-0.5 right-0.5 rounded border px-1 py-0.5 text-[10px] overflow-hidden z-[2] ${sc.bg}`}
                                                        style={{ top, height }}>
                                                        <div className="font-medium truncate">{apt.patientName || 'Patient'}</div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

// ─── Event Modal ────────────────────────────────────────────
const EventModal = ({ t, form, setForm, isEditing, onSave, onDelete, onClose }) => {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
            <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-6 space-y-4" onClick={e => e.stopPropagation()}>
                <h3 className="text-lg font-bold text-gray-900">{isEditing ? t.editEvent : t.addEvent}</h3>

                {/* Title */}
                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">{t.eventTitle}</label>
                    <input type="text" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                        value={form.title} onChange={e => setForm({ ...form, title: e.target.value })}
                        placeholder={t.eventTitle} autoFocus />
                </div>

                {/* Category */}
                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">{t.eventCategory}</label>
                    <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                        value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}>
                        {CATEGORIES.map(cat => (
                            <option key={cat} value={cat}>{t[CATEGORY_LABELS[cat]] || cat}</option>
                        ))}
                    </select>
                </div>

                {/* Date */}
                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">{t.eventDate}</label>
                    <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                        value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} />
                </div>

                {/* All day toggle */}
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={form.allDay}
                        onChange={e => setForm({ ...form, allDay: e.target.checked })}
                        className="rounded border-gray-300 text-primary focus:ring-primary" />
                    <span className="text-sm text-gray-700">{t.eventAllDay}</span>
                </label>

                {/* Time range */}
                {!form.allDay && (
                    <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">{t.eventStart}</label>
                            <input type="time" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                                value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} />
                        </div>
                        <div className="space-y-1">
                            <label className="text-sm font-medium text-gray-700">{t.eventEnd}</label>
                            <input type="time" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                                value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} />
                        </div>
                    </div>
                )}

                {/* Notes */}
                <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">{t.eventNotes}</label>
                    <textarea className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none"
                        rows={2} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
                        placeholder={t.eventNotes} />
                </div>

                {/* Actions */}
                <div className="flex items-center justify-between pt-2">
                    {isEditing && onDelete ? (
                        <button onClick={onDelete} className="flex items-center gap-1 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg text-sm transition-colors">
                            <Trash2 size={14} /> {t.deleteEvent}
                        </button>
                    ) : <div />}
                    <div className="flex gap-2">
                        <button onClick={onClose} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm transition-colors">
                            {t.cancel}
                        </button>
                        <button onClick={onSave} disabled={!form.title.trim()}
                            className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
                            {t.save}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ─── Availability hour row ──────────────────────────────────
const HourRow = ({ hour, availability }) => {
    const hourStr = `${pad(hour)}:00`;
    const halfStr = `${pad(hour)}:30`;

    return (
        <>
            <div className="bg-white p-1 text-xs text-gray-400 text-right pr-2 border-b border-gray-100">
                {hourStr}
            </div>
            {DAY_KEYS.map(day => {
                const ranges = availability[day] || [];
                const isInRange = (timeStr) => {
                    const mins = parseInt(timeStr.split(':')[0]) * 60 + parseInt(timeStr.split(':')[1]);
                    return ranges.some(r => {
                        const s = parseInt(r.start.split(':')[0]) * 60 + parseInt(r.start.split(':')[1]);
                        const e = parseInt(r.end.split(':')[0]) * 60 + parseInt(r.end.split(':')[1]);
                        return mins >= s && mins < e;
                    });
                };
                const topActive = isInRange(hourStr);
                const bottomActive = isInRange(halfStr);

                return (
                    <div key={day} className="bg-white border-b border-gray-100 h-10 flex flex-col">
                        <div className={`flex-1 ${topActive ? 'bg-primary/15' : ''}`} />
                        <div className={`flex-1 ${bottomActive ? 'bg-primary/15' : ''}`} />
                    </div>
                );
            })}
        </>
    );
};

export default DoctorCalendar;
