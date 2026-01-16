import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';

import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister';

// Lazy load pages for performance
const LandingPage = lazy(() => import('./pages/LandingPage'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const PatientDetails = lazy(() => import('./pages/PatientDetails'));
const AddPatient = lazy(() => import('./pages/AddPatient'));
const EditPatient = lazy(() => import('./pages/EditPatient'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const DoctorMessaging = lazy(() => import('./pages/DoctorMessaging'));
const PatientPortal = lazy(() => import('./pages/PatientPortal'));
const DoctorProfile = lazy(() => import('./pages/DoctorProfile'));
const FindDoctor = lazy(() => import('./pages/FindDoctor'));
const AddDoctor = lazy(() => import('./pages/AddDoctor'));
const EditDoctor = lazy(() => import('./pages/EditDoctor'));
const PaymentTerminal = lazy(() => import('./pages/PaymentTerminal'));
const Specialties = lazy(() => import('./pages/Specialties'));

// Loading component
const LoadingSpinner = () => (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
    </div>
);

// Create a client
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            gcTime: 1000 * 60 * 60 * 24, // 24 hours
            staleTime: 1000 * 60 * 5, // 5 minutes
        },
    },
});

// Create a persister using localStorage (synchronous)
const persister = createSyncStoragePersister({
    storage: window.localStorage,
});

const ProtectedRoute = ({ children }) => {
    const { currentUser, loading } = useAuth();
    if (loading) return <div>Chargement...</div>;
    if (!currentUser) return <Navigate to="/login" replace />;
    return children;
};

function App() {
    return (
        <PersistQueryClientProvider
            client={queryClient}
            persistOptions={{ persister }}
            onSuccess={() => {
                // resume mutations after initial restore from localStorage was successful
                queryClient.resumePausedMutations().then(() => {
                    queryClient.invalidateQueries();
                });
            }}
        >
            <AuthProvider>
                <Router>
                    <Suspense fallback={<LoadingSpinner />}>
                        <Routes>
                            <Route path="/" element={<LandingPage />} />
                            <Route path="/login" element={<Login />} />
                            <Route path="/register" element={<Register />} />
                            <Route path="/specialties" element={<Specialties />} />
                            <Route path="/find-doctor" element={<FindDoctor />} />
                            <Route path="/add-doctor" element={<ProtectedRoute><AddDoctor /></ProtectedRoute>} />
                            <Route path="/edit-doctor/:id" element={<ProtectedRoute><EditDoctor /></ProtectedRoute>} />
                            <Route path="/doctor/:id" element={<DoctorProfile />} />
                            <Route path="/messaging" element={<ProtectedRoute><DoctorMessaging /></ProtectedRoute>} />
                            <Route path="/terminal" element={<ProtectedRoute><PaymentTerminal /></ProtectedRoute>} />
                            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
                            <Route path="/portal" element={<ProtectedRoute><PatientPortal /></ProtectedRoute>} />
                            <Route path="/add-patient" element={<ProtectedRoute><AddPatient /></ProtectedRoute>} />
                            <Route path="/edit-patient/:id" element={<ProtectedRoute><EditPatient /></ProtectedRoute>} />
                            <Route path="/patients/:id" element={<ProtectedRoute><PatientDetails /></ProtectedRoute>} />
                        </Routes>
                    </Suspense>
                </Router>
            </AuthProvider>
        </PersistQueryClientProvider>
    );
}

export default App;
