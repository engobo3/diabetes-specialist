import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import Button from './ui/Button';
import Badge from './ui/Badge';
import {
    Sparkles,
    TrendingUp,
    TrendingDown,
    Activity,
    AlertCircle,
    CheckCircle,
    Info,
    Loader,
    Droplets,
    Heart,
    Scale,
    Pill
} from 'lucide-react';

const HealthInsightsPanel = ({ patientData, vitals, prescriptions, currentUser }) => {
    const [analysis, setAnalysis] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const analyzeHealth = async () => {
        setLoading(true);
        setError(null);

        try {
            const token = await currentUser.getIdToken();
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/ai/analyze-health`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    patientData,
                    vitals,
                    prescriptions,
                    timeframe: '14 days'
                })
            });

            if (!response.ok) {
                throw new Error('Échec de l\'analyse');
            }

            const data = await response.json();
            setAnalysis(data);
        } catch (err) {
            console.error('Health analysis error:', err);
            setError('Impossible d\'analyser vos données. Veuillez réessayer.');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'excellent': return 'text-green-600 bg-green-50';
            case 'good': return 'text-blue-600 bg-blue-50';
            case 'fair': return 'text-yellow-600 bg-yellow-50';
            case 'concerning': return 'text-red-600 bg-red-50';
            default: return 'text-gray-600 bg-gray-50';
        }
    };

    const getStatusLabel = (status) => {
        switch (status) {
            case 'excellent': return 'Excellent';
            case 'good': return 'Bon';
            case 'fair': return 'Acceptable';
            case 'concerning': return 'À surveiller';
            default: return status;
        }
    };

    const getTrendIcon = (status) => {
        switch (status) {
            case 'improving': return <TrendingUp className="w-4 h-4 text-green-600" />;
            case 'worsening': return <TrendingDown className="w-4 h-4 text-red-600" />;
            case 'stable': return <Activity className="w-4 h-4 text-blue-600" />;
            default: return <Activity className="w-4 h-4 text-gray-600" />;
        }
    };

    const getConcernBadge = (concern) => {
        const variants = {
            low: 'success',
            medium: 'warning',
            high: 'danger'
        };
        const labels = {
            low: 'Normal',
            medium: 'Attention',
            high: 'Urgent'
        };
        return <Badge variant={variants[concern] || 'info'}>{labels[concern] || concern}</Badge>;
    };

    const getInsightIcon = (type) => {
        switch (type) {
            case 'positive': return <CheckCircle className="w-5 h-5 text-green-600" />;
            case 'warning': return <AlertCircle className="w-5 h-5 text-yellow-600" />;
            case 'info': return <Info className="w-5 h-5 text-blue-600" />;
            default: return <Info className="w-5 h-5 text-gray-600" />;
        }
    };

    const getCategoryIcon = (category) => {
        switch (category) {
            case 'nutrition': return '🍎';
            case 'exercise': return '🏃';
            case 'medication': return '💊';
            case 'monitoring': return '🩸';
            default: return '📋';
        }
    };

    const getPriorityColor = (priority) => {
        switch (priority) {
            case 'high': return 'border-l-red-500';
            case 'medium': return 'border-l-yellow-500';
            case 'low': return 'border-l-blue-500';
            default: return 'border-l-gray-500';
        }
    };

    if (!analysis) {
        return (
            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <Sparkles className="w-5 h-5 text-purple-600" />
                        Analyse IA de votre santé
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-center py-8">
                        <Sparkles className="w-16 h-16 mx-auto mb-4 text-purple-300" />
                        <h3 className="text-lg font-semibold text-gray-900 mb-2">
                            Analyse personnalisée par IA
                        </h3>
                        <p className="text-gray-600 mb-6 max-w-md mx-auto">
                            Obtenez des insights détaillés sur vos tendances de santé, des recommandations personnalisées et une évaluation complète de votre état.
                        </p>
                        <Button
                            onClick={analyzeHealth}
                            disabled={loading}
                            className="gap-2"
                        >
                            {loading ? (
                                <>
                                    <Loader className="w-4 h-4 animate-spin" />
                                    Analyse en cours...
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    Analyser ma santé
                                </>
                            )}
                        </Button>
                        {error && (
                            <p className="text-red-600 text-sm mt-4">{error}</p>
                        )}
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <div className="space-y-6">
            {/* Overall Status */}
            <Card>
                <CardContent className="pt-6">
                    <div className="flex items-center justify-between mb-6">
                        <div>
                            <h3 className="text-2xl font-bold text-gray-900 mb-1">
                                État de santé global
                            </h3>
                            <p className="text-gray-500">Analyse basée sur les 14 derniers jours</p>
                        </div>
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={analyzeHealth}
                            disabled={loading}
                        >
                            {loading ? <Loader className="w-4 h-4 animate-spin" /> : 'Actualiser'}
                        </Button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Health Score */}
                        <div className="bg-gradient-to-br from-purple-50 to-blue-50 rounded-lg p-6 border-2 border-purple-100">
                            <div className="flex items-center justify-between mb-4">
                                <span className="text-sm font-medium text-gray-600">Score de santé</span>
                                <span className={`px-3 py-1 rounded-full text-sm font-bold ${getStatusColor(analysis.overallStatus)}`}>
                                    {getStatusLabel(analysis.overallStatus)}
                                </span>
                            </div>
                            <div className="flex items-end gap-2">
                                <span className="text-5xl font-bold text-gray-900">{analysis.healthScore}</span>
                                <span className="text-2xl text-gray-500 mb-1">/100</span>
                            </div>
                            <div className="mt-4 bg-gray-200 rounded-full h-3 overflow-hidden">
                                <div
                                    className="bg-gradient-to-r from-purple-500 to-blue-500 h-full rounded-full transition-all duration-1000"
                                    style={{ width: `${analysis.healthScore}%` }}
                                />
                            </div>
                        </div>

                        {/* Risk Assessment */}
                        <div className="bg-white rounded-lg p-6 border-2 border-gray-100">
                            <h4 className="text-sm font-medium text-gray-600 mb-4">Évaluation des risques</h4>
                            <div className="space-y-3">
                                <div className="flex items-center justify-between">
                                    <span className="text-gray-700">Niveau de risque</span>
                                    <Badge variant={
                                        analysis.riskAssessment.level === 'high' ? 'danger' :
                                        analysis.riskAssessment.level === 'moderate' ? 'warning' : 'success'
                                    }>
                                        {analysis.riskAssessment.level === 'high' ? 'Élevé' :
                                         analysis.riskAssessment.level === 'moderate' ? 'Modéré' : 'Faible'}
                                    </Badge>
                                </div>
                                {analysis.riskAssessment.factors.length > 0 && (
                                    <div className="pt-3 border-t border-gray-100">
                                        <p className="text-xs text-gray-500 mb-2">Facteurs de risque:</p>
                                        <ul className="space-y-1">
                                            {analysis.riskAssessment.factors.map((factor, idx) => (
                                                <li key={idx} className="text-sm text-gray-700 flex items-start gap-2">
                                                    <span className="text-yellow-500 mt-0.5">•</span>
                                                    {factor}
                                                </li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {analysis.riskAssessment.urgentConcerns.length > 0 && (
                                    <div className="pt-3 border-t border-red-100 bg-red-50 -mx-6 -mb-6 mt-4 px-6 py-3 rounded-b-lg">
                                        <p className="text-sm font-semibold text-red-700 flex items-center gap-2">
                                            <AlertCircle className="w-4 h-4" />
                                            Préoccupations urgentes:
                                        </p>
                                        <ul className="mt-2 space-y-1">
                                            {analysis.riskAssessment.urgentConcerns.map((concern, idx) => (
                                                <li key={idx} className="text-sm text-red-600">• {concern}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Vital Trends */}
            <Card>
                <CardHeader>
                    <CardTitle>Tendances des signes vitaux</CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Glucose */}
                        <div className="p-4 rounded-lg border-2 border-gray-100 hover:border-teal-200 transition-colors">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Droplets className="w-5 h-5 text-teal-600" />
                                    <span className="font-semibold text-gray-900">Glycémie</span>
                                </div>
                                {getTrendIcon(analysis.trends.glucose.status)}
                            </div>
                            <div className="flex items-end justify-between">
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">{analysis.trends.glucose.average}</p>
                                    <p className="text-sm text-gray-500">mg/dL moyenne</p>
                                </div>
                                {getConcernBadge(analysis.trends.glucose.concern)}
                            </div>
                        </div>

                        {/* Blood Pressure */}
                        <div className="p-4 rounded-lg border-2 border-gray-100 hover:border-red-200 transition-colors">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Activity className="w-5 h-5 text-red-600" />
                                    <span className="font-semibold text-gray-900">Tension artérielle</span>
                                </div>
                                {getTrendIcon(analysis.trends.bloodPressure.status)}
                            </div>
                            <div className="flex items-end justify-between">
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">{analysis.trends.bloodPressure.average}</p>
                                    <p className="text-sm text-gray-500">mmHg</p>
                                </div>
                                {getConcernBadge(analysis.trends.bloodPressure.concern)}
                            </div>
                        </div>

                        {/* Weight */}
                        <div className="p-4 rounded-lg border-2 border-gray-100 hover:border-green-200 transition-colors">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Scale className="w-5 h-5 text-green-600" />
                                    <span className="font-semibold text-gray-900">Poids</span>
                                </div>
                                {getTrendIcon(analysis.trends.weight.status)}
                            </div>
                            <div className="flex items-end justify-between">
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">{analysis.trends.weight.change}</p>
                                    <p className="text-sm text-gray-500">variation</p>
                                </div>
                                {getConcernBadge(analysis.trends.weight.concern)}
                            </div>
                        </div>

                        {/* Heart Rate */}
                        <div className="p-4 rounded-lg border-2 border-gray-100 hover:border-orange-200 transition-colors">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Heart className="w-5 h-5 text-orange-600" />
                                    <span className="font-semibold text-gray-900">Fréquence cardiaque</span>
                                </div>
                                {getTrendIcon(analysis.trends.heartRate.status)}
                            </div>
                            <div className="flex items-end justify-between">
                                <div>
                                    <p className="text-2xl font-bold text-gray-900">{analysis.trends.heartRate.average || 'N/A'}</p>
                                    <p className="text-sm text-gray-500">bpm</p>
                                </div>
                                {getConcernBadge(analysis.trends.heartRate.concern)}
                            </div>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* Insights */}
            {analysis.insights && analysis.insights.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Insights personnalisés</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {analysis.insights.map((insight, idx) => (
                                <div
                                    key={idx}
                                    className={`p-4 rounded-lg border-2 ${
                                        insight.type === 'positive' ? 'bg-green-50 border-green-200' :
                                        insight.type === 'warning' ? 'bg-yellow-50 border-yellow-200' :
                                        'bg-blue-50 border-blue-200'
                                    }`}
                                >
                                    <div className="flex items-start gap-3">
                                        {getInsightIcon(insight.type)}
                                        <div className="flex-1">
                                            <h4 className="font-semibold text-gray-900 mb-1">{insight.title}</h4>
                                            <p className="text-sm text-gray-700">{insight.message}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Recommendations */}
            {analysis.recommendations && analysis.recommendations.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Recommandations personnalisées</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-3">
                            {analysis.recommendations.map((rec, idx) => (
                                <div
                                    key={idx}
                                    className={`p-4 rounded-lg border-l-4 bg-gray-50 border-gray-200 hover:bg-white transition-colors ${getPriorityColor(rec.priority)}`}
                                >
                                    <div className="flex items-start gap-3">
                                        <span className="text-2xl">{getCategoryIcon(rec.category)}</span>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-1">
                                                <Badge variant={
                                                    rec.priority === 'high' ? 'danger' :
                                                    rec.priority === 'medium' ? 'warning' : 'info'
                                                }>
                                                    {rec.priority === 'high' ? 'Priorité haute' :
                                                     rec.priority === 'medium' ? 'Priorité moyenne' : 'Priorité basse'}
                                                </Badge>
                                            </div>
                                            <p className="text-sm text-gray-900 font-medium">{rec.action}</p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Next Steps */}
            {analysis.nextSteps && analysis.nextSteps.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Prochaines étapes</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-2">
                            {analysis.nextSteps.map((step, idx) => (
                                <div key={idx} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                                    <div className="w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5">
                                        {idx + 1}
                                    </div>
                                    <p className="text-sm text-gray-700 flex-1">{step}</p>
                                </div>
                            ))}
                        </div>
                    </CardContent>
                </Card>
            )}
        </div>
    );
};

export default HealthInsightsPanel;
