
import { useState } from 'react';
import { CreditCard, Banknote, Smartphone, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import Button from './ui/Button';
import Input from './ui/Input';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { useAuth } from '../context/AuthContext';

const PaymentForm = ({ onSuccess, doctorId, patientId: propPatientId }) => {
    const { currentUser, patientId: authPatientId } = useAuth();
    const patientId = propPatientId || authPatientId;
    const [amount, setAmount] = useState('');
    const [currency, setCurrency] = useState('CDF'); // CDF or USD
    const [method, setMethod] = useState('Cash'); // Cash, M-Pesa, Orange Money, Airtel Money, Card
    const [phoneNumber, setPhoneNumber] = useState('');
    const [loading, setLoading] = useState(false);
    const [loadingStep, setLoadingStep] = useState(''); // 'init', 'ussd_push', 'finalizing'
    const [message, setMessage] = useState(null); // { type: 'success' | 'error', text: '' }

    const isMobileMoney = ['M-Pesa', 'Orange Money', 'Airtel Money'].includes(method);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);
        setLoadingStep('init');

        try {
            // 1. Simulate Aggregator Handshake
            if (isMobileMoney) {
                setLoadingStep('ussd_push');
                // Simulate waiting for user to approve USSD on phone
                await new Promise(resolve => setTimeout(resolve, 4000));
            } else if (method === 'Card') {
                setLoadingStep('finalizing');
                await new Promise(resolve => setTimeout(resolve, 2000));
            }

            setLoadingStep('finalizing');

            const token = await currentUser.getIdToken();
            const apiUrl = import.meta.env.VITE_API_URL || '';

            // Route to correct endpoint based on payment method
            let endpoint;
            let body;
            if (method === 'Cash') {
                endpoint = `${apiUrl}/api/payments/cash`;
                body = { amount: parseFloat(amount), currency, description: 'Consultation médicale', patientId, doctorId };
            } else if (method === 'Card') {
                endpoint = `${apiUrl}/api/payments/card`;
                body = { amount: parseFloat(amount), currency, description: 'Consultation médicale', patientId, doctorId, cardNumber: '0000', cardExpiry: '12/30', cardCvv: '000' };
            } else {
                // Mobile money
                endpoint = `${apiUrl}/api/payments/mobile-money`;
                body = { amount: parseFloat(amount), currency, phoneNumber, provider: method, description: 'Consultation médicale', patientId, doctorId };
            }

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(body)
            });

            if (response.ok) {
                setMessage({ type: 'success', text: 'Paiement confirmé avec succès!' });
                setAmount('');
                setPhoneNumber('');
                if (onSuccess) onSuccess();
            } else {
                throw new Error('Payment failed');
            }
        } catch (error) {
            console.error(error);
            setMessage({ type: 'error', text: 'Échec du paiement. Veuillez réessayer.' });
        } finally {
            setLoading(false);
            setLoadingStep('');
        }
    };

    return (
        <Card className="max-w-md mx-auto">
            <CardHeader>
                <CardTitle className="text-xl flex items-center gap-2">
                    <Banknote className="text-primary" /> Nouveau Paiement
                </CardTitle>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Amount & Currency */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Montant</label>
                            <Input
                                type="number"
                                required
                                min="1"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium text-gray-700">Devise</label>
                            <div className="flex bg-gray-100 p-1 rounded-lg">
                                {['CDF', 'USD'].map((curr) => (
                                    <button
                                        key={curr}
                                        type="button"
                                        onClick={() => setCurrency(curr)}
                                        className={`flex-1 py-2 text-sm font-medium rounded-md transition-all ${currency === curr
                                            ? 'bg-white text-primary shadow-sm'
                                            : 'text-gray-500 hover:text-gray-700'
                                            }`}
                                    >
                                        {curr}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Moyen de Paiement</label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                            {[
                                { id: 'Cash', icon: Banknote, label: 'Espèces' },
                                { id: 'Card', icon: CreditCard, label: 'Carte' },
                                { id: 'M-Pesa', icon: Smartphone, label: 'M-Pesa' },
                                { id: 'Orange Money', icon: Smartphone, label: 'Orange' },
                                { id: 'Airtel Money', icon: Smartphone, label: 'Airtel' }
                            ].map((m) => (
                                <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => setMethod(m.id)}
                                    className={`flex flex-col items-center justify-center gap-2 p-3 min-h-[48px] rounded-lg border transition-all ${method === m.id
                                        ? 'border-primary bg-primary/5 text-primary'
                                        : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                                        }`}
                                >
                                    <m.icon size={20} />
                                    <span className="text-xs font-medium text-center">{m.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Mobile Money Phone Input */}
                    {isMobileMoney && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-1 duration-300">
                            <label className="text-sm font-medium text-gray-700">Numéro de téléphone ({method})</label>
                            <Input
                                type="tel"
                                required
                                placeholder="ex: 082 123 4567"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                            />
                            <p className="text-xs text-gray-500">
                                Un message de validation sera envoyé sur ce numéro.
                            </p>
                        </div>
                    )}

                    {message && (
                        <div className={`p-3 rounded-lg flex items-center gap-2 text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
                            }`}>
                            {message.type === 'success' ? <CheckCircle size={16} /> : <AlertCircle size={16} />}
                            {message.text}
                        </div>
                    )}

                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? (
                            <div className="flex items-center">
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                {loadingStep === 'ussd_push' ? 'Veuillez valider sur votre mobile...' : 'Traitement...'}
                            </div>
                        ) : (
                            `Payer ${amount ? `${amount} ${currency}` : ''}`
                        )}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
};

export default PaymentForm;
