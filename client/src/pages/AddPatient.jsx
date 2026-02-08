import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

import { useAuth } from '../context/AuthContext';

const AddPatient = () => {
    const navigate = useNavigate();
    const { currentUser, doctorProfile } = useAuth();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        age: '',
        type: 'Type 1',
        status: 'Stable'
    });

    const handleChange = (e) => {
        setFormData({
            ...formData,
            [e.target.name]: e.target.value
        });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const token = await currentUser.getIdToken();
            const payload = {
                ...formData,
                age: parseInt(formData.age, 10),
                doctorId: doctorProfile?.id,
                doctorName: doctorProfile?.name
            };

            const response = await fetch(`${import.meta.env.VITE_API_URL}/api/patients`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (response.ok) {
                navigate('/dashboard');
            } else {
                const errData = await response.json();
                alert(`Erreur: ${errData.message || 'Impossible de créer le patient'}`);
            }
        } catch (error) {
            console.error("Error creating patient", error);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <nav className="bg-white border-b border-gray-200">
                <div className="container flex items-center h-16 gap-4">
                    <button onClick={() => navigate('/dashboard')} className="flex items-center text-gray-500 hover:text-primary transition-colors">
                        <ArrowLeft className="w-5 h-5 mr-1" />
                        Retour
                    </button>
                    <div className="text-xl font-bold text-primary">GlucoCare <span className="text-xs font-normal text-gray-500">/ Ajouter un Patient</span></div>
                </div>
            </nav>

            <main className="container py-8">
                <div className="max-w-2xl mx-auto bg-white rounded-lg shadow-sm border border-gray-200 p-8">
                    <h1 className="text-2xl font-bold text-gray-900 mb-6">Nouveau Patient</h1>

                    <form onSubmit={handleSubmit}>
                        <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="name">
                                Nom Complet
                            </label>
                            <input
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                id="name"
                                type="text"
                                name="name"
                                value={formData.name}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="email">
                                Email (Optionnel)
                            </label>
                            <input
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                id="email"
                                type="email"
                                name="email"
                                value={formData.email}
                                onChange={handleChange}
                                placeholder="patient@exemple.com"
                            />
                            <p className="text-xs text-gray-500 mt-1">Option: Laissez vide si le patient n'a pas d'email.</p>
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="phone">
                                Téléphone (Recommandé pour activation)
                            </label>
                            <input
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                id="phone"
                                type="tel"
                                name="phone"
                                value={formData.phone}
                                onChange={handleChange}
                                placeholder="ex: 0812345678"
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="age">
                                Âge
                            </label>
                            <input
                                className="shadow appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                id="age"
                                type="number"
                                name="age"
                                value={formData.age}
                                onChange={handleChange}
                                required
                            />
                        </div>

                        <div className="mb-4">
                            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="type">
                                Type de Diabète
                            </label>
                            <select
                                className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                id="type"
                                name="type"
                                value={formData.type}
                                onChange={handleChange}
                            >
                                <option value="Type 1">Type 1</option>
                                <option value="Type 2">Type 2</option>
                                <option value="Pre-diabetic">Pré-diabétique</option>
                            </select>
                        </div>

                        <div className="mb-6">
                            <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="status">
                                Statut Initial
                            </label>
                            <select
                                className="shadow border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                                id="status"
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                            >
                                <option value="Stable">Stable</option>
                                <option value="Attention Needed">Attention Requise</option>
                                <option value="Critical">Critique</option>
                            </select>
                        </div>

                        <div className="flex items-center justify-end">
                            <button
                                className="btn btn-primary"
                                type="submit"
                            >
                                Enregistrer
                            </button>
                        </div>
                    </form>
                </div>
            </main>
        </div>
    );
};

export default AddPatient;
