import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import Badge from './ui/Badge';
import { Shield, AlertTriangle, CheckCircle, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const getRiskColor = (level) => {
    switch (level) {
        case 'low': return '#10B981';
        case 'moderate': return '#F59E0B';
        case 'high': return '#EF4444';
        default: return '#6B7280';
    }
};

const FootRiskSummaryCard = ({ patientId }) => {
    const { currentUser } = useAuth();
    const [latest, setLatest] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLatest = async () => {
            if (!patientId || !currentUser) { setLoading(false); return; }
            try {
                const token = await currentUser.getIdToken();
                const apiUrl = import.meta.env.VITE_API_URL || '';
                const res = await fetch(`${apiUrl}/api/foot-risk/history/${patientId}`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.length > 0) setLatest(data[0]);
                }
            } catch (err) {
                console.error('Error fetching foot risk:', err);
            } finally {
                setLoading(false);
            }
        };
        fetchLatest();
    }, [patientId, currentUser]);

    if (loading) {
        return (
            <Card>
                <CardContent className="py-8 flex items-center justify-center">
                    <Loader2 size={20} className="animate-spin text-gray-400" />
                </CardContent>
            </Card>
        );
    }

    if (!latest) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <Shield size={20} className="text-gray-400" />
                        Risque Podologique
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-sm text-gray-400 italic">
                        Aucune evaluation disponible. Votre medecin effectuera une analyse lors de votre prochaine consultation.
                    </p>
                </CardContent>
            </Card>
        );
    }

    const { risk_score, risk_level, risk_label, recommendations, assessedAt } = latest;
    const RiskIcon = risk_level === 'low' ? CheckCircle : AlertTriangle;
    const iconColor = risk_level === 'low' ? 'text-green-500' : risk_level === 'moderate' ? 'text-amber-500' : 'text-red-500';

    return (
        <Card className="border-l-4" style={{ borderLeftColor: getRiskColor(risk_level) }}>
            <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                    <Shield size={20} className="text-primary" />
                    Risque Podologique
                </CardTitle>
            </CardHeader>
            <CardContent>
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-3">
                        <RiskIcon size={28} className={iconColor} />
                        <div>
                            <span className="text-3xl font-bold" style={{ color: getRiskColor(risk_level) }}>
                                {risk_score}
                            </span>
                            <span className="text-gray-400 text-lg">/100</span>
                        </div>
                    </div>
                    <Badge variant={risk_level === 'low' ? 'success' : risk_level === 'moderate' ? 'warning' : 'danger'}>
                        {risk_label}
                    </Badge>
                </div>

                {/* Risk bar */}
                <div className="mb-4">
                    <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${risk_score}%`, backgroundColor: getRiskColor(risk_level) }}
                        />
                    </div>
                </div>

                <p className="text-xs text-gray-400 mb-3">
                    Derniere evaluation: {assessedAt ? new Date(assessedAt).toLocaleDateString('fr-FR') : '-'}
                </p>

                {recommendations && recommendations.length > 0 && (
                    <div>
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Recommandations</p>
                        <ul className="space-y-1.5">
                            {recommendations.slice(0, 4).map((rec, i) => (
                                <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                                    <span className="mt-1.5 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getRiskColor(risk_level) }} />
                                    {rec}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

export default FootRiskSummaryCard;
