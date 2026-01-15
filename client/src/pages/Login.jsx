import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { login, currentUser, userRole } = useAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (currentUser && userRole) {
            if (userRole === 'patient') {
                navigate('/portal');
            } else {
                navigate('/dashboard');
            }
        }
    }, [currentUser, userRole, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            setError('');
            setLoading(true);

            // Auto-detect phone number and append suffix
            const isPhone = /^\d+$/.test(email.replace(/\s/g, '').replace('+', ''));
            const authIdentifier = isPhone
                ? `${email.replace(/\s/g, '').replace('+', '')}@glucosoin.crm`
                : email;

            await login(authIdentifier, password);
            // Redirection handled by useEffect
        } catch (err) {
            setError('Échec de la connexion. Vérifiez vos identifiants.');
            console.error(err);
            setLoading(false);
        }
    };

    const handleDemoLogin = async () => {
        try {
            setError('');
            setLoading(true);
            const demoEmail = 'demo@glucosoin.com';
            const demoPass = 'demo1234';

            try {
                // Try logging in
                await login(demoEmail, demoPass);
            } catch (loginErr) {
                // If user not found, create it
                if (loginErr.code === 'auth/user-not-found' || loginErr.code === 'auth/invalid-credential') {
                    await createUserWithEmailAndPassword(auth, demoEmail, demoPass);
                    // Login happens automatically after create
                } else {
                    throw loginErr;
                }
            }
        } catch (err) {
            console.error("Demo Login Error:", err);
            setError("Erreur lors de la connexion démo. Veuillez réessayer.");
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-lg shadow-md">
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center text-sm text-gray-500 hover:text-blue-600 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    Retour à l'accueil
                </button>
                <div>
                    <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
                        GlucoCare
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Connectez-vous à votre espace personnel
                    </p>
                </div>
                {error && <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">{error}</div>}
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div className="rounded-md shadow-sm -space-y-px">
                        <div>
                            <label htmlFor="email-address" className="sr-only">Email ou Téléphone</label>
                            <input
                                id="email-address"
                                name="email"
                                type="text"
                                autoComplete="username"
                                required
                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-t-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Email ou Téléphone"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">Mot de passe</label>
                            <input
                                id="password"
                                name="password"
                                type="password"
                                autoComplete="current-password"
                                required
                                className="appearance-none rounded-none relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 rounded-b-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                                placeholder="Mot de passe"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
                        >
                            {loading ? 'Connexion...' : 'Se connecter'}
                        </button>
                    </div>
                </form>

                <div className="mt-6 text-center">
                    <p className="text-sm text-gray-600 mb-4">
                        Première visite ?{' '}
                        <button
                            onClick={() => navigate('/register')}
                            className="font-medium text-blue-600 hover:text-blue-500"
                        >
                            Activer votre compte patient
                        </button>
                    </p>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-gray-500">Recruteurs / Visiteurs</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleDemoLogin}
                        disabled={loading}
                        className="mt-4 w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                        👨‍⚕️ Accès Démo (Médecin)
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;
