import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { ArrowLeft, CheckCircle, AlertCircle, Mail, KeyRound, Lock, Phone } from 'lucide-react';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';
import { useLanguage } from '../context/LanguageContext';
import { getTranslations } from '../translations';

const Register = () => {
    const navigate = useNavigate();
    const { lang } = useLanguage();
    const t = getTranslations('register', lang);
    const [step, setStep] = useState(1); // 1: Identifier, 2: Code, 3: Password
    const [identifier, setIdentifier] = useState(''); // email or phone
    const [activationCode, setActivationCode] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [patientName, setPatientName] = useState('');
    const [patientEmail, setPatientEmail] = useState(''); // email from verify response
    const [resendLoading, setResendLoading] = useState(false);
    const [resendMessage, setResendMessage] = useState('');

    const apiUrl = import.meta.env.VITE_API_URL || '';

    // Detect if identifier is a phone number (digits only, possibly with +)
    const isPhone = (val) => /^\+?\d[\d\s-]{5,}$/.test(val.trim());
    const cleanPhone = (val) => val.replace(/[\s-]/g, '').replace(/^\+/, '');

    // Step 1: Submit identifier and move to code entry
    const handleIdentifierSubmit = (e) => {
        e.preventDefault();
        setError('');
        setResendMessage('');
        setStep(2);
    };

    // Step 2: Verify activation code
    const verifyCode = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Backend accepts email or phone in the "email" field
            const lookupValue = isPhone(identifier) ? cleanPhone(identifier) : identifier.trim();
            const response = await fetch(`${apiUrl}/api/patients/activate/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: lookupValue, code: activationCode })
            });

            const data = await response.json();
            if (response.ok) {
                setPatientName(data.patientName);
                setPatientEmail(data.email || '');
                setStep(3);
            } else {
                setError(data.message || t.invalidCode);
            }
        } catch (err) {
            console.error(err);
            setError(t.serverError);
        } finally {
            setLoading(false);
        }
    };

    // Resend activation code
    const resendCode = async () => {
        setResendLoading(true);
        setResendMessage('');
        setError('');

        try {
            const lookupValue = isPhone(identifier) ? cleanPhone(identifier) : identifier.trim();
            const response = await fetch(`${apiUrl}/api/patients/activate/resend`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: lookupValue })
            });

            if (response.ok) {
                if (isPhone(identifier)) {
                    setResendMessage(t.resendPhone);
                } else {
                    setResendMessage(t.resendEmail);
                }
            } else {
                const data = await response.json();
                setError(data.message || t.resendError);
            }
        } catch (err) {
            setError(t.serverError);
        } finally {
            setResendLoading(false);
        }
    };

    // Step 3: Create Firebase Auth account
    const handleRegister = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            return setError(t.passwordMismatch);
        }

        setLoading(true);
        setError('');

        try {
            // For phone-only patients, use synthetic email for Firebase Auth
            const usingPhone = isPhone(identifier);
            const authEmail = usingPhone
                ? `${cleanPhone(identifier)}@glucosoin.crm`
                : identifier.trim();

            await createUserWithEmailAndPassword(auth, authEmail, password);

            // Mark patient as activated (send original identifier for lookup)
            const lookupValue = usingPhone ? cleanPhone(identifier) : identifier.trim();
            await fetch(`${apiUrl}/api/patients/activate/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: lookupValue })
            }).catch(err => console.error('Activation complete failed:', err));

            navigate('/portal');
        } catch (err) {
            console.error('Registration Error:', err);
            if (err.code === 'auth/email-already-in-use') {
                setError(t.accountExists);
            } else {
                setError(t.createError);
            }
        } finally {
            setLoading(false);
        }
    };

    const steps = [
        { icon: isPhone(identifier) ? Phone : Mail, label: t.stepContact },
        { icon: KeyRound, label: t.stepCode },
        { icon: Lock, label: t.stepPassword }
    ];

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white p-4 sm:p-8 rounded-lg shadow-md">
                <Link to="/login" className="flex items-center text-sm text-gray-500 hover:text-primary mb-6">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    {t.back}
                </Link>

                <div className="text-center mb-6">
                    <h2 className="text-2xl font-bold text-gray-900">{t.title}</h2>
                    <p className="text-sm text-gray-600">{t.subtitle}</p>
                </div>

                {/* Step Indicator */}
                <div className="flex items-center justify-center gap-1.5 sm:gap-2 mb-6 sm:mb-8">
                    {steps.map((s, i) => {
                        const stepNum = i + 1;
                        const isActive = step === stepNum;
                        const isCompleted = step > stepNum;
                        return (
                            <React.Fragment key={stepNum}>
                                {i > 0 && (
                                    <div className={`h-px w-6 sm:w-8 ${isCompleted ? 'bg-primary' : 'bg-gray-200'}`} />
                                )}
                                <div className={`flex items-center justify-center w-9 h-9 rounded-full text-sm font-medium transition-all ${
                                    isCompleted ? 'bg-primary text-white' :
                                    isActive ? 'bg-primary/10 text-primary border-2 border-primary' :
                                    'bg-gray-100 text-gray-400'
                                }`}>
                                    {isCompleted ? <CheckCircle size={16} /> : <s.icon size={16} />}
                                </div>
                            </React.Fragment>
                        );
                    })}
                </div>

                {error && (
                    <div className="bg-red-50 text-red-700 p-3 rounded-md flex items-center gap-2 mb-6 text-sm">
                        <AlertCircle size={16} className="shrink-0" />
                        {error}
                    </div>
                )}

                {/* Step 1: Email or Phone */}
                {step === 1 && (
                    <form onSubmit={handleIdentifierSubmit} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.emailLabel}</label>
                            <Input
                                type="text"
                                value={identifier}
                                onChange={(e) => setIdentifier(e.target.value)}
                                placeholder={t.emailPlaceholder}
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                {t.emailHint}
                            </p>
                        </div>
                        <Button type="submit" className="w-full">
                            {t.continue}
                        </Button>
                    </form>
                )}

                {/* Step 2: Activation Code */}
                {step === 2 && (
                    <form onSubmit={verifyCode} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <p className="text-sm text-gray-600 text-center">
                            {isPhone(identifier)
                                ? <>{t.enterCodePhone} <strong>{identifier}</strong></>
                                : <>{t.enterCodeEmail} <strong>{identifier}</strong></>
                            }
                        </p>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.activationCode}</label>
                            <Input
                                type="text"
                                value={activationCode}
                                onChange={(e) => setActivationCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                placeholder="000000"
                                maxLength={6}
                                className="text-center text-lg sm:text-2xl tracking-widest font-mono"
                                required
                                autoFocus
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading || activationCode.length !== 6}>
                            {loading ? t.verifying : t.verifyCode}
                        </Button>

                        <div className="text-center space-y-2">
                            <button
                                type="button"
                                onClick={resendCode}
                                disabled={resendLoading}
                                className="text-sm text-primary hover:underline disabled:text-gray-400"
                            >
                                {resendLoading ? t.sending : t.resendCode}
                            </button>
                            {resendMessage && (
                                <p className="text-xs text-green-600">{resendMessage}</p>
                            )}
                        </div>

                        <button
                            type="button"
                            onClick={() => { setStep(1); setActivationCode(''); setError(''); }}
                            className="text-sm text-gray-500 hover:text-gray-700 w-full text-center"
                        >
                            {isPhone(identifier) ? t.changePhone : t.changeEmail}
                        </button>
                    </form>
                )}

                {/* Step 3: Create Password */}
                {step === 3 && (
                    <form onSubmit={handleRegister} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="bg-green-50 p-4 rounded-md flex items-center gap-3 mb-4">
                            <CheckCircle className="text-green-600 h-5 w-5 shrink-0" />
                            <div>
                                <p className="text-sm font-semibold text-green-800">{t.codeVerified}</p>
                                <p className="text-xs text-green-700">{t.hello}, {patientName}. {t.createPassword}</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.password}</label>
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">{t.confirm}</label>
                            <Input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? t.activating : t.activate}
                        </Button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default Register;
