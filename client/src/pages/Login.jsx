import React, { useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { auth } from '../firebase';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useLanguage } from '../context/LanguageContext';
import { getTranslations } from '../translations';

const Login = () => {
    const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm();
    const { login, currentUser, userRole } = useAuth();
    const { lang } = useLanguage();
    const t = getTranslations('login', lang);
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

    const onSubmit = async (data) => {
        try {
            const { email, password } = data;

            // Auto-detect phone number and append suffix
            const isPhone = /^\d+$/.test(email.replace(/\s/g, '').replace('+', ''));
            const authIdentifier = isPhone
                ? `${email.replace(/\s/g, '').replace('+', '')}@glucosoin.crm`
                : email;

            await login(authIdentifier, password);
            toast.success(t.loginSuccess);
            // Redirection handled by useEffect
        } catch (err) {
            console.error(err);
            toast.error(t.loginFailed);
        }
    };

    const handleDemoLogin = async () => {
        try {
            const demoEmail = 'demo@glucosoin.com';
            const demoPass = 'demo1234';
            const toastId = toast.loading(t.demoLoading);

            try {
                // Try logging in
                await login(demoEmail, demoPass);
                toast.success(t.demoSuccess, { id: toastId });
            } catch (loginErr) {
                // If user not found, create it
                if (loginErr.code === 'auth/user-not-found' || loginErr.code === 'auth/invalid-credential') {
                    await createUserWithEmailAndPassword(auth, demoEmail, demoPass);
                    toast.success(t.demoCreated, { id: toastId });
                    // Login happens automatically after create
                } else {
                    toast.error(t.demoError, { id: toastId });
                    throw loginErr;
                }
            }
        } catch (err) {
            console.error("Demo Login Error:", err);
            toast.error(t.demoLoginError);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center py-6 sm:py-12 px-4 sm:px-6 lg:px-8">
            <div className="max-w-md w-full space-y-8 bg-white p-4 sm:p-8 rounded-lg shadow-md">
                <button
                    onClick={() => navigate('/')}
                    className="flex items-center text-sm text-gray-500 hover:text-blue-600 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4 mr-1" />
                    {t.back}
                </button>
                <div>
                    <h2 className="mt-6 text-center text-2xl sm:text-3xl font-extrabold text-gray-900">
                        {t.title}
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        {t.subtitle}
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
                    <div className="space-y-4">
                        <div>
                            <label htmlFor="email" className="sr-only">{t.emailLabel}</label>
                            <input
                                id="email"
                                type="text"
                                {...register("email", {
                                    required: t.emailRequired,
                                })}
                                className={`appearance-none relative block w-full px-3 py-2 border ${errors.email ? 'border-red-500' : 'border-gray-300'} placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm transition-colors`}
                                placeholder={t.emailPlaceholder}
                            />
                            {errors.email && <p className="mt-1 text-xs text-red-500">{errors.email.message}</p>}
                        </div>
                        <div>
                            <label htmlFor="password" className="sr-only">{t.passwordLabel}</label>
                            <input
                                id="password"
                                type="password"
                                {...register("password", {
                                    required: t.passwordRequired,
                                    minLength: { value: 6, message: t.passwordMin }
                                })}
                                className={`appearance-none relative block w-full px-3 py-2 border ${errors.password ? 'border-red-500' : 'border-gray-300'} placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm transition-colors`}
                                placeholder={t.passwordPlaceholder}
                            />
                            {errors.password && <p className="mt-1 text-xs text-red-500">{errors.password.message}</p>}
                        </div>
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                        >
                            {isSubmitting ? (
                                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                            ) : (
                                t.submit
                            )}
                        </button>
                    </div>
                </form>

                <div className="mt-6 text-center">
                    <p className="text-sm text-gray-600 mb-4">
                        {t.firstVisit}{' '}
                        <button
                            onClick={() => navigate('/register')}
                            className="font-medium text-blue-600 hover:text-blue-500"
                        >
                            {t.activateAccount}
                        </button>
                    </p>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300"></div>
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white text-gray-500">{t.recruiters}</span>
                        </div>
                    </div>

                    <button
                        type="button"
                        onClick={handleDemoLogin}
                        disabled={isSubmitting}
                        className="mt-4 w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
                    >
                        {t.demoAccess}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default Login;
