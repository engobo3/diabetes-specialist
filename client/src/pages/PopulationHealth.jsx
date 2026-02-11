import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Header from '../components/Header';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import Skeleton from '../components/ui/Skeleton';
import { Activity, ArrowLeft, Users, Pill, CalendarDays, TrendingUp, ShieldCheck } from 'lucide-react';
import {
    PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar, XAxis, YAxis, CartesianGrid,
    LineChart, Line,
    AreaChart, Area
} from 'recharts';

const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

const PopulationHealth = () => {
    const { currentUser } = useAuth();

    const { data, isLoading, error } = useQuery({
        queryKey: ['population-analytics'],
        queryFn: async () => {
            const token = await currentUser.getIdToken();
            const apiUrl = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${apiUrl}/api/analytics/population`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch analytics');
            return res.json();
        },
        enabled: !!currentUser,
        staleTime: 1000 * 60 * 10, // 10 minutes
    });

    return (
        <div className="min-h-screen bg-slate-50 font-sans text-gray-900">
            <Header />
            <div className="container mx-auto px-3 sm:px-4 py-6 sm:py-8">
                <div className="flex items-center gap-3 mb-6">
                    <Link to="/dashboard" className="text-gray-500 hover:text-primary">
                        <ArrowLeft size={20} />
                    </Link>
                    <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                        <Activity className="text-primary" size={24} />
                        Analytiques de Sante Populationnelle
                    </h1>
                </div>

                {/* Privacy notice */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-3 mb-6 flex items-start gap-2">
                    <ShieldCheck size={18} className="text-green-600 mt-0.5 shrink-0" />
                    <p className="text-sm text-green-800">
                        Toutes les donnees sont anonymisees et agregees. Aucune information personnelle n'est affichee.
                        Les groupes de moins de 5 patients sont fusionnes pour proteger la confidentialite.
                    </p>
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6 text-red-700">
                        Erreur lors du chargement des analytiques: {error.message}
                    </div>
                )}

                {isLoading ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-80 w-full" />)}
                    </div>
                ) : data ? (
                    <>
                        {/* Summary stat */}
                        <div className="mb-6">
                            <Card>
                                <CardContent className="py-4 flex items-center gap-3">
                                    <Users size={20} className="text-primary" />
                                    <span className="text-sm text-gray-600">Population totale analysee:</span>
                                    <span className="text-lg font-bold text-gray-900">{data.totalPatients} patients</span>
                                </CardContent>
                            </Card>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* 1. Diabetes Type Distribution - Pie */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Users size={18} className="text-blue-600" />
                                        Repartition par Type de Diabete
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {data.diabetesTypeDistribution.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={280}>
                                            <PieChart>
                                                <Pie
                                                    data={data.diabetesTypeDistribution}
                                                    dataKey="value"
                                                    nameKey="name"
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={100}
                                                    label={({ name, percent }) => `${name} (${(percent * 100).toFixed(0)}%)`}
                                                >
                                                    {data.diabetesTypeDistribution.map((_, i) => (
                                                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip />
                                                <Legend />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <EmptyState text="Pas assez de donnees pour afficher ce graphique." />
                                    )}
                                </CardContent>
                            </Card>

                            {/* 2. Glucose by Age Group - Bar */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <TrendingUp size={18} className="text-green-600" />
                                        Glucose Moyen par Tranche d'Age
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {data.glucoseByAgeGroup.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={280}>
                                            <BarChart data={data.glucoseByAgeGroup}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="ageGroup" />
                                                <YAxis unit=" mg/dL" />
                                                <Tooltip
                                                    formatter={(value) => [`${value} mg/dL`, 'Glucose moyen']}
                                                    labelFormatter={(label) => `Tranche: ${label}`}
                                                />
                                                <Bar dataKey="avgGlucose" fill="#2563eb" radius={[4, 4, 0, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <EmptyState text="Pas assez de donnees de glucose par tranche d'age." />
                                    )}
                                </CardContent>
                            </Card>

                            {/* 3. Glucose Trends Over Time - Line */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Activity size={18} className="text-purple-600" />
                                        Tendance Glucose Mensuelle
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {data.vitalTrends.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={280}>
                                            <LineChart data={data.vitalTrends}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="month" />
                                                <YAxis unit=" mg/dL" />
                                                <Tooltip
                                                    formatter={(value) => [`${value} mg/dL`, 'Glucose moyen']}
                                                    labelFormatter={(label) => `Mois: ${label}`}
                                                />
                                                <Line
                                                    type="monotone"
                                                    dataKey="avgGlucose"
                                                    stroke="#8b5cf6"
                                                    strokeWidth={2}
                                                    dot={{ r: 4 }}
                                                />
                                            </LineChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <EmptyState text="Pas assez de mesures pour afficher la tendance." />
                                    )}
                                </CardContent>
                            </Card>

                            {/* 4. Top Medications - Horizontal Bar */}
                            <Card>
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <Pill size={18} className="text-orange-600" />
                                        Medicaments les Plus Prescrits
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {data.topMedications.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={280}>
                                            <BarChart data={data.topMedications} layout="vertical">
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis type="number" />
                                                <YAxis dataKey="medication" type="category" width={120} tick={{ fontSize: 12 }} />
                                                <Tooltip formatter={(value) => [`${value} prescriptions`, 'Total']} />
                                                <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                                            </BarChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <EmptyState text="Pas assez de prescriptions pour afficher ce graphique." />
                                    )}
                                </CardContent>
                            </Card>

                            {/* 5. Appointment Volume - Area */}
                            <Card className="lg:col-span-2">
                                <CardHeader>
                                    <CardTitle className="text-base flex items-center gap-2">
                                        <CalendarDays size={18} className="text-cyan-600" />
                                        Volume de Rendez-vous par Mois
                                    </CardTitle>
                                </CardHeader>
                                <CardContent>
                                    {data.appointmentVolume.length > 0 ? (
                                        <ResponsiveContainer width="100%" height={280}>
                                            <AreaChart data={data.appointmentVolume}>
                                                <CartesianGrid strokeDasharray="3 3" />
                                                <XAxis dataKey="month" />
                                                <YAxis />
                                                <Tooltip
                                                    formatter={(value) => [`${value}`, 'Rendez-vous']}
                                                    labelFormatter={(label) => `Mois: ${label}`}
                                                />
                                                <Area
                                                    type="monotone"
                                                    dataKey="appointments"
                                                    stroke="#06b6d4"
                                                    fill="#06b6d4"
                                                    fillOpacity={0.2}
                                                />
                                            </AreaChart>
                                        </ResponsiveContainer>
                                    ) : (
                                        <EmptyState text="Pas assez de rendez-vous pour afficher ce graphique." />
                                    )}
                                </CardContent>
                            </Card>
                        </div>
                    </>
                ) : null}
            </div>
        </div>
    );
};

const EmptyState = ({ text }) => (
    <div className="h-[280px] flex items-center justify-center text-gray-400 text-sm italic">
        {text}
    </div>
);

export default PopulationHealth;
