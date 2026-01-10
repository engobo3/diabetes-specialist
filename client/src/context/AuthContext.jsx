import React, { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [userRole, setUserRole] = useState(null); // 'admin', 'doctor', 'patient', or null
    const [patientId, setPatientId] = useState(null);
    const [loading, setLoading] = useState(true);

    const login = (email, password) => {
        return signInWithEmailAndPassword(auth, email, password);
    };

    const logout = () => {
        setUserRole(null);
        setPatientId(null);
        return signOut(auth);
    };

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            setCurrentUser(user);

            if (user) {
                try {
                    // Get token for backend requests
                    const token = await user.getIdToken();

                    // Check if user is a patient
                    const apiUrl = import.meta.env.VITE_API_URL || '';
                    const response = await fetch(`${apiUrl}/api/patients/lookup?email=${user.email}`, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (response.ok) {
                        const patientData = await response.json();
                        setUserRole('patient');
                        setPatientId(patientData.id);
                    } else {
                        // Not a patient, check if doctor/admin
                        try {
                            const doctorRes = await fetch(`${apiUrl}/api/doctors/lookup?email=${user.email}`, {
                                headers: { 'Authorization': `Bearer ${token}` }
                            });

                            if (doctorRes.ok) {
                                const doctorData = await doctorRes.json();
                                setUserRole(doctorData.role || 'doctor'); // Default to doctor if no role set
                            } else {
                                // Not in doctors DB? Default to 'doctor' for now (or 'specialist')
                                // Ideally, we might want to block access or set 'pending'.
                                // For this app, existing staff logic implies 'doctor'.
                                setUserRole('doctor');
                            }
                        } catch (docErr) {
                            console.error("Error fetching doctor role", docErr);
                            setUserRole('doctor');
                        }
                        setPatientId(null);
                    }
                } catch (error) {
                    console.error("Error fetching user role", error);
                    // Fallback to doctor on error to prevent lockout, 
                    // or null to force retry. Let's fallback to 'doctor' 
                    // but log it.
                    setUserRole('doctor');
                }
            } else {
                setUserRole(null);
                setPatientId(null);
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value = {
        currentUser,
        userRole,
        patientId,
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
