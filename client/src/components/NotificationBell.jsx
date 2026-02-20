import { useState, useEffect, useRef } from 'react';
import { Bell, Check, CheckCheck, Calendar, Activity, AlertCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const TYPE_CONFIG = {
    appointment_new: { icon: Calendar, color: 'text-blue-500', bg: 'bg-blue-50' },
    appointment_confirmed: { icon: Calendar, color: 'text-green-500', bg: 'bg-green-50' },
    appointment_rejected: { icon: Calendar, color: 'text-red-500', bg: 'bg-red-50' },
    appointment_reminder: { icon: Calendar, color: 'text-amber-500', bg: 'bg-amber-50' },
    vital_reminder: { icon: Activity, color: 'text-purple-500', bg: 'bg-purple-50' },
    new_patient_data: { icon: Activity, color: 'text-teal-500', bg: 'bg-teal-50' },
    system: { icon: AlertCircle, color: 'text-gray-500', bg: 'bg-gray-50' }
};

const NotificationBell = () => {
    const { currentUser } = useAuth();
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const dropdownRef = useRef(null);

    // Poll unread count every 60s
    useEffect(() => {
        if (!currentUser) return;

        const fetchCount = async () => {
            try {
                const token = await currentUser.getIdToken();
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/notifications/unread-count`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setUnreadCount(data.count);
                }
            } catch (err) {
                // silent
            }
        };

        fetchCount();
        const interval = setInterval(fetchCount, 60000);
        return () => clearInterval(interval);
    }, [currentUser]);

    // Load notifications when dropdown opens
    useEffect(() => {
        if (!open || !currentUser) return;

        const fetchNotifications = async () => {
            setLoading(true);
            try {
                const token = await currentUser.getIdToken();
                const res = await fetch(`${import.meta.env.VITE_API_URL}/api/notifications?limit=20`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setNotifications(data);
                }
            } catch (err) {
                console.error('Error fetching notifications:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchNotifications();
    }, [open, currentUser]);

    // Close on outside click
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setOpen(false);
            }
        };
        if (open) document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [open]);

    const markOneRead = async (id) => {
        try {
            const token = await currentUser.getIdToken();
            await fetch(`${import.meta.env.VITE_API_URL}/api/notifications/${id}/read`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (err) {
            // silent
        }
    };

    const markAllRead = async () => {
        try {
            const token = await currentUser.getIdToken();
            await fetch(`${import.meta.env.VITE_API_URL}/api/notifications/read-all`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (err) {
            // silent
        }
    };

    const timeAgo = (dateStr) => {
        const diff = Date.now() - new Date(dateStr).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1) return "À l'instant";
        if (mins < 60) return `Il y a ${mins}min`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `Il y a ${hrs}h`;
        const days = Math.floor(hrs / 24);
        return `Il y a ${days}j`;
    };

    if (!currentUser) return null;

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setOpen(!open)}
                className="relative p-2 text-gray-600 hover:text-primary transition-colors rounded-full hover:bg-gray-100"
                aria-label="Notifications"
            >
                <Bell size={20} />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-[28rem] flex flex-col">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                        <h3 className="font-semibold text-sm text-gray-900">Notifications</h3>
                        {unreadCount > 0 && (
                            <button
                                onClick={markAllRead}
                                className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                            >
                                <CheckCheck size={14} /> Tout marquer comme lu
                            </button>
                        )}
                    </div>

                    {/* List */}
                    <div className="overflow-y-auto flex-1">
                        {loading ? (
                            <div className="p-4 text-center text-sm text-gray-500">Chargement...</div>
                        ) : notifications.length === 0 ? (
                            <div className="p-8 text-center text-sm text-gray-400">
                                <Bell size={24} className="mx-auto mb-2 opacity-40" />
                                Aucune notification
                            </div>
                        ) : (
                            notifications.map(n => {
                                const config = TYPE_CONFIG[n.type] || TYPE_CONFIG.system;
                                const Icon = config.icon;
                                return (
                                    <div
                                        key={n.id}
                                        className={`flex items-start gap-3 px-4 py-3 border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer ${!n.read ? 'bg-blue-50/30' : ''}`}
                                        onClick={() => !n.read && markOneRead(n.id)}
                                    >
                                        <div className={`p-1.5 rounded-full ${config.bg} mt-0.5`}>
                                            <Icon size={14} className={config.color} />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <p className={`text-sm ${!n.read ? 'font-semibold text-gray-900' : 'text-gray-700'} truncate`}>
                                                    {n.title}
                                                </p>
                                                {!n.read && <span className="w-2 h-2 bg-primary rounded-full flex-shrink-0" />}
                                            </div>
                                            <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.body}</p>
                                            <p className="text-[10px] text-gray-400 mt-1">{timeAgo(n.createdAt)}</p>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
