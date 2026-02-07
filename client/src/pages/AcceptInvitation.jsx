import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { auth } from '../firebase';
import { UserPlus, AlertCircle, Loader, CheckCircle } from 'lucide-react';

const AcceptInvitation = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [invitation, setInvitation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1); // 1: View Invitation, 2: Create Account
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    password: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (token) {
      fetchInvitation();
    } else {
      setError('Token d\'invitation manquant');
      setLoading(false);
    }
  }, [token]);

  const fetchInvitation = async () => {
    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/caregivers/invitations/${token}`
      );

      if (response.ok) {
        const data = await response.json();
        setInvitation(data);
      } else {
        setError('Invitation invalide ou expirée');
      }
    } catch (err) {
      console.error('Error fetching invitation:', err);
      setError('Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async (e) => {
    e.preventDefault();

    if (formData.password !== formData.confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (formData.password.length < 6) {
      setError('Le mot de passe doit contenir au moins 6 caractères');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Try to sign in first (in case user already has account)
      let user;
      try {
        const userCredential = await signInWithEmailAndPassword(
          auth,
          invitation.caregiverEmail,
          formData.password
        );
        user = userCredential.user;
      } catch (signInError) {
        // If user doesn't exist, create account
        if (signInError.code === 'auth/user-not-found' || signInError.code === 'auth/invalid-credential') {
          const userCredential = await createUserWithEmailAndPassword(
            auth,
            invitation.caregiverEmail,
            formData.password
          );
          user = userCredential.user;
        } else {
          throw signInError;
        }
      }

      // Accept invitation
      const idToken = await user.getIdToken();
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/caregivers/invitations/${invitation.id}/accept`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            caregiverName: formData.name,
            caregiverPhone: formData.phone
          })
        }
      );

      if (response.ok) {
        // Success! Redirect to portal
        navigate('/portal', {
          state: { message: 'Invitation acceptée! Bienvenue sur votre espace aidant.' }
        });
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Erreur lors de l\'acceptation');
      }
    } catch (err) {
      console.error('Error accepting invitation:', err);
      if (err.code === 'auth/email-already-in-use') {
        setError('Un compte existe déjà avec cet email. Essayez de vous connecter.');
      } else if (err.code === 'auth/weak-password') {
        setError('Le mot de passe est trop faible');
      } else {
        setError('Erreur lors de l\'activation du compte');
      }
    } finally {
      setLoading(false);
    }
  };

  const relationshipLabels = {
    parent: 'Parent',
    adult_child: 'Enfant Adulte',
    spouse: 'Conjoint(e)',
    sibling: 'Frère/Sœur',
    guardian: 'Tuteur Légal',
    caregiver: 'Aidant(e)'
  };

  if (loading && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader className="animate-spin text-primary" size={48} />
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full">
          <div className="text-center">
            <AlertCircle className="text-red-500 mx-auto mb-4" size={48} />
            <h3 className="text-lg font-bold text-gray-900 mb-2">Invitation Invalide</h3>
            <p className="text-gray-600 mb-6">{error}</p>
            <button
              onClick={() => navigate('/login')}
              className="bg-primary text-white px-6 py-2 rounded-md hover:bg-primary-dark transition-colors"
            >
              Retour à la connexion
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-lg w-full">
        <div className="flex items-center gap-3 mb-6">
          <UserPlus className="text-primary" size={28} />
          <h2 className="text-2xl font-bold text-gray-900">Invitation Aidant</h2>
        </div>

        {step === 1 && (
          <div className="space-y-6">
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
              <h4 className="font-bold text-blue-900 mb-2">
                {invitation.patientName} vous invite
              </h4>
              <p className="text-sm text-blue-700 mb-3">
                Vous êtes invité(e) à devenir <strong>{relationshipLabels[invitation.relationship]}</strong> pour suivre le dossier médical de <strong>{invitation.patientName}</strong>.
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-blue-600 bg-blue-100 px-2 py-1 rounded">
                  {relationshipLabels[invitation.relationship]}
                </span>
              </div>
            </div>

            {invitation.notes && (
              <div className="border-l-4 border-gray-300 pl-4 py-2 bg-gray-50 rounded-r">
                <p className="text-sm text-gray-600 italic">"{invitation.notes}"</p>
              </div>
            )}

            {invitation.requiresDoctorApproval && !invitation.doctorApproved && (
              <div className="bg-yellow-50 p-3 rounded-md border border-yellow-100 flex items-start gap-2">
                <AlertCircle size={16} className="text-yellow-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-yellow-700">
                  En attente d'approbation du médecin
                </p>
              </div>
            )}

            {invitation.requiresDoctorApproval && invitation.doctorApproved && (
              <div className="bg-green-50 p-3 rounded-md border border-green-100 flex items-start gap-2">
                <CheckCircle size={16} className="text-green-600 mt-0.5 flex-shrink-0" />
                <p className="text-sm text-green-700">
                  Invitation approuvée par le médecin
                </p>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              <button
                onClick={() => navigate('/login')}
                className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors"
              >
                Refuser
              </button>
              <button
                onClick={() => setStep(2)}
                disabled={invitation.requiresDoctorApproval && !invitation.doctorApproved}
                className="flex-1 bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Accepter
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <form onSubmit={handleAccept} className="space-y-4">
            {error && (
              <div className="bg-red-50 text-red-700 p-3 rounded-md flex items-center gap-2 text-sm">
                <AlertCircle size={16} className="flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Email (invitation)
              </label>
              <input
                type="email"
                value={invitation.caregiverEmail}
                disabled
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm bg-gray-50 text-gray-600"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Votre Nom <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Jean Dupont"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Téléphone (optionnel)
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="+33 6 12 34 56 78"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Mot de passe <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Minimum 6 caractères"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Confirmer mot de passe <span className="text-red-500">*</span>
              </label>
              <input
                type="password"
                required
                minLength={6}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                placeholder="Même mot de passe"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="button"
                onClick={() => setStep(1)}
                className="flex-1 border border-gray-300 text-gray-700 px-4 py-2 rounded-md hover:bg-gray-50 transition-colors"
              >
                Retour
              </button>
              <button
                type="submit"
                disabled={loading}
                className="flex-1 bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
              >
                {loading ? 'Activation...' : 'Activer mon compte'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default AcceptInvitation;
