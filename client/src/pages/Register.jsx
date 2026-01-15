import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth'; // Direct Firebase use for creation
import { auth } from '../firebase';
import { ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';
import Input from '../components/ui/Input';
import Button from '../components/ui/Button';

const Register = () => {
    const navigate = useNavigate();
    const [step, setStep] = useState(1); // 1: Check Email, 2: Create Password
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [patientName, setPatientName] = useState('');

    // Step 1: Verify if the email belongs to an invited patient
    const verifyEmail = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Check against our backend to see if this email exists in 'patients' DB
            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/patients/lookup?email=${email}`);

            if (response.ok) {
                const data = await response.json();
                setPatientName(data.name);
                setStep(2); // Move to password creation
            } else {
                setError("Cet email n'a pas été trouvé. Veuillez contacter votre médecin pour une invitation.");
            }
        } catch (err) {
            console.error(err);
            setError("Erreur de connexion serveur.");
        } finally {
            setLoading(false);
        }
    };

    // Step 2: Create Firebase Account
    const handleRegister = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            return setError("Les mots de passe ne correspondent pas.");
        }

        setLoading(true);
        setError('');

        try {
            // Create Auth User
            await createUserWithEmailAndPassword(auth, email, password);
            // On success, AuthContext will auto-detect login and redirect to Portal
            // But we might want to update the backend state to 'Active' here if needed.
            navigate('/portal');
        } catch (err) {
            console.error('Registration Error:', err);
            if (err.code === 'auth/email-already-in-use') {
                setError("Ce compte existe déjà. Veuillez vous connecter.");
            } else {
                setError("Erreur lors de la création du compte. Réessayez.");
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-md">
                <Link to="/login" className="flex items-center text-sm text-gray-500 hover:text-blue-600 mb-6">
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Retour à la connexion
                </Link>

                <div className="text-center mb-8">
                    <h2 className="text-2xl font-bold text-gray-900">Activation du Compte</h2>
                    <p className="text-sm text-gray-600">Pour les patients de GlucoCare</p>
                </div>

                {error && (
                    <div className="bg-red-50 text-red-700 p-3 rounded-md flex items-center gap-2 mb-6 text-sm">
                        <AlertCircle size={16} />
                        {error}
                    </div>
                )}

                {step === 1 && (
                    <form onSubmit={verifyEmail} className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Votre Email</label>
                            <Input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="email@exemple.com"
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">
                                Utilisez l'adresse email que vous avez donnée au médecin.
                            </p>
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Vérification...' : 'Vérifier mon invitation'}
                        </Button>
                    </form>
                )}

                {step === 2 && (
                    <form onSubmit={handleRegister} className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                        <div className="bg-green-50 p-4 rounded-md flex items-center gap-3 mb-4">
                            <CheckCircle className="text-green-600 h-5 w-5" />
                            <div>
                                <p className="text-sm font-semibold text-green-800">Dossier Trouvé !</p>
                                <p className="text-xs text-green-700">Bonjour, {patientName}. Créez votre mot de passe.</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Mot de passe</label>
                            <Input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                                minLength={6}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Confirmer</label>
                            <Input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                required
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={loading}>
                            {loading ? 'Activation...' : 'Activer mon compte'}
                        </Button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default Register;
