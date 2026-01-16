import React, { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [userRole, setUserRole] = useState(null); // 'admin', 'doctor', 'patient', or null
    const [patientId, setPatientId] = useState(null);
    const [doctorProfile, setDoctorProfile] = useState(null);
    const [loading, setLoading] = useState(true);

    const login = (email, password) => {
        if (!auth) return Promise.reject("Auth not initialized");
        return signInWithEmailAndPassword(auth, email, password);
    };

    const logout = () => {
        setUserRole(null);
        setPatientId(null);
        if (!auth) return Promise.resolve();
        return signOut(auth);
    };

    useEffect(() => {
        // Safety timeout to ensure loading is set to false even if Firebase hangs
        const timer = setTimeout(() => {
            setLoading(false);
        }, 2000);

        if (!auth) {
            console.warn("Auth not initialized, skipping auth listener");
            return;
        }

        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            clearTimeout(timer);
            setCurrentUser(user);

            if (user) {
                try {
                    // Get token for backend requests
                    const token = await user.getIdToken();

                    // Check if user is a patient
                    const apiUrl = import.meta.env.VITE_API_URL || '';

                    let lookupUrl = `${apiUrl}/api/patients/lookup?email=${user.email}`;

                    // Handle synthetic email for phone login
                    if (user.email && user.email.endsWith('@glucosoin.crm')) {
                        const phone = user.email.split('@')[0];
                        lookupUrl = `${apiUrl}/api/patients/lookup?phone=${phone}`;
                    }

                    const response = await fetch(lookupUrl, {
                        headers: {
                            'Authorization': `Bearer ${token}`
                        }
                    });

                    if (response.ok) {
                        const patientData = await response.json();
                        setUserRole('patient');
                        setPatientId(patientData.id);

                        // Sync UID to database if missing (Self-healing ID link)
                        if (!patientData.uid) {
                            try {
                                fetch(`${apiUrl}/api/patients/${patientData.id}`, {
                                    method: 'PUT',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'Authorization': `Bearer ${token}`
                                    },
                                    body: JSON.stringify({ uid: user.uid })
                                });
                                console.log("Linked Firebase UID to Patient Record");
                            } catch (e) {
                                console.error("Failed to sync UID", e);
                            }
                        }
                    } else {
                        // Not a patient, check if doctor/admin
                        try {
                            const doctorRes = await fetch(`${apiUrl}/api/doctors/lookup?email=${user.email}`, {
                                headers: { 'Authorization': `Bearer ${token}` }
                            });

                            if (doctorRes.ok) {
                                const doctorData = await doctorRes.json();
                                setUserRole(doctorData.role || 'doctor');
                                setDoctorProfile(doctorData); // Store full profile
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
        doctorProfile,
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
