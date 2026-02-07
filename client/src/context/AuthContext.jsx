import React, { createContext, useContext, useEffect, useState } from "react";
import { auth } from "../firebase";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";

const AuthContext = createContext();

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }) => {
    const [currentUser, setCurrentUser] = useState(null);
    const [userRole, setUserRole] = useState(null); // Legacy - kept for backward compatibility
    const [userRoles, setUserRoles] = useState([]); // Array of all roles: ['patient', 'caregiver', 'doctor']
    const [activeRole, setActiveRole] = useState(null); // Currently active role
    const [patientId, setPatientId] = useState(null);
    const [patientData, setPatientData] = useState(null); // User's own patient record
    const [doctorProfile, setDoctorProfile] = useState(null);
    const [managedPatients, setManagedPatients] = useState([]); // For caregivers
    const [loading, setLoading] = useState(true);

    const login = (email, password) => {
        if (!auth) return Promise.reject("Auth not initialized");
        return signInWithEmailAndPassword(auth, email, password);
    };

    const logout = () => {
        setUserRole(null);
        setUserRoles([]);
        setActiveRole(null);
        setPatientId(null);
        setPatientData(null);
        setManagedPatients([]);
        setDoctorProfile(null);
        if (!auth) return Promise.resolve();
        return signOut(auth);
    };

    const selectPatient = (newPatientId) => {
        setPatientId(newPatientId);
    };

    const switchRole = (newRole) => {
        if (!userRoles.includes(newRole)) {
            console.error('User does not have role:', newRole);
            return;
        }

        setActiveRole(newRole);
        setUserRole(newRole); // Keep for backward compatibility

        if (newRole === 'patient' && patientData) {
            setPatientId(patientData.id);
        } else if (newRole === 'caregiver' && managedPatients.length > 0) {
            setPatientId(managedPatients[0].id);
        } else if (newRole === 'doctor' || newRole === 'admin') {
            setPatientId(null);
        }
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
                    const apiUrl = import.meta.env.VITE_API_URL || '';

                    let patientLookupUrl = `${apiUrl}/api/patients/lookup?email=${user.email}`;

                    // Handle synthetic email for phone login
                    if (user.email && user.email.endsWith('@glucosoin.crm')) {
                        const phone = user.email.split('@')[0];
                        patientLookupUrl = `${apiUrl}/api/patients/lookup?phone=${phone}`;
                    }

                    // Check ALL roles in parallel (including admin)
                    const [patientRes, caregiverRes, doctorRes, userProfileRes] = await Promise.all([
                        fetch(patientLookupUrl, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        }).catch(e => ({ ok: false, error: e })),
                        fetch(`${apiUrl}/api/patients/lookup/caregiver?email=${user.email}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        }).catch(e => ({ ok: false, error: e })),
                        fetch(`${apiUrl}/api/doctors/lookup?email=${user.email}`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        }).catch(e => ({ ok: false, error: e })),
                        fetch(`${apiUrl}/api/users/me`, {
                            headers: { 'Authorization': `Bearer ${token}` }
                        }).catch(e => ({ ok: false, error: e }))
                    ]);

                    const roles = [];
                    let defaultRole = null;
                    let defaultPatientId = null;

                    // Check if user is a patient
                    if (patientRes.ok) {
                        const patientRecord = await patientRes.json();
                        roles.push('patient');
                        setPatientData(patientRecord);
                        defaultRole = 'patient';
                        defaultPatientId = patientRecord.id;

                        // Sync UID to database if missing
                        if (!patientRecord.uid) {
                            fetch(`${apiUrl}/api/patients/${patientRecord.id}`, {
                                method: 'PUT',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${token}`
                                },
                                body: JSON.stringify({ uid: user.uid })
                            }).catch(e => console.error("Failed to sync UID", e));
                        }
                    }

                    // Check if user is a caregiver
                    if (caregiverRes.ok) {
                        const caregiverPatients = await caregiverRes.json();
                        if (Array.isArray(caregiverPatients) && caregiverPatients.length > 0) {
                            roles.push('caregiver');
                            setManagedPatients(caregiverPatients);

                            // If not already a patient, set caregiver as default
                            if (!defaultRole) {
                                defaultRole = 'caregiver';
                                defaultPatientId = caregiverPatients[0].id;
                            }
                            console.log("Caregiver found with", caregiverPatients.length, "patients");
                        }
                    }

                    // Check if user is a doctor
                    if (doctorRes.ok) {
                        const doctorRecord = await doctorRes.json();
                        roles.push('doctor');
                        setDoctorProfile(doctorRecord);

                        // If not already patient or caregiver, set doctor as default
                        if (!defaultRole) {
                            defaultRole = 'doctor';
                        }
                    }

                    // Check if user is an admin
                    if (userProfileRes.ok) {
                        const userProfile = await userProfileRes.json();
                        if (userProfile.role === 'admin') {
                            roles.push('admin');
                            // If user is admin+doctor, default to doctor for daily use
                            if (!defaultRole) {
                                defaultRole = 'admin';
                            }
                        }
                    }

                    // Set roles and defaults
                    setUserRoles(roles);
                    setActiveRole(defaultRole);
                    setUserRole(defaultRole); // Backward compatibility
                    setPatientId(defaultPatientId);

                    console.log('User roles detected:', roles, 'Active:', defaultRole);

                    // If no roles found, default to doctor (legacy behavior)
                    if (roles.length === 0) {
                        setUserRole('doctor');
                        setUserRoles(['doctor']);
                        setActiveRole('doctor');
                    }
                } catch (error) {
                    console.error("Error fetching user roles", error);
                    setUserRole('doctor');
                    setUserRoles(['doctor']);
                    setActiveRole('doctor');
                }
            } else {
                setUserRole(null);
                setUserRoles([]);
                setActiveRole(null);
                setPatientId(null);
                setPatientData(null);
                setManagedPatients([]);
                setDoctorProfile(null);
            }

            setLoading(false);
        });

        return unsubscribe;
    }, []);

    const value = {
        currentUser,
        userRole,        // Legacy - kept for backward compatibility
        userRoles,       // NEW: array of all roles ['patient', 'caregiver', 'doctor']
        activeRole,      // NEW: currently active role
        patientId,
        patientData,     // NEW: user's own patient record (if they are a patient)
        doctorProfile,
        managedPatients,
        selectPatient,
        switchRole,      // NEW: function to switch between roles
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
