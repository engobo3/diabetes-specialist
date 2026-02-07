import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserPlus, CheckCircle, XCircle } from 'lucide-react';

const CaregiverInviteForm = ({ patientId, onSuccess }) => {
  const { currentUser } = useAuth();
  const [formData, setFormData] = useState({
    caregiverEmail: '',
    relationship: '',
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const relationships = [
    { value: 'parent', label: 'Parent' },
    { value: 'adult_child', label: 'Enfant Adulte' },
    { value: 'spouse', label: 'Conjoint(e)' },
    { value: 'sibling', label: 'Frère/Sœur' },
    { value: 'guardian', label: 'Tuteur Légal' },
    { value: 'caregiver', label: 'Aidant(e)' }
  ];

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/caregivers/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          patientId,
          ...formData
        })
      });

      if (response.ok) {
        setMessage({
          type: 'success',
          text: 'Invitation envoyée avec succès!'
        });
        setFormData({ caregiverEmail: '', relationship: '', notes: '' });
        if (onSuccess) onSuccess();
      } else {
        const error = await response.json();
        setMessage({
          type: 'error',
          text: error.message || 'Erreur lors de l\'envoi de l\'invitation'
        });
      }
    } catch (error) {
      console.error('Error sending invitation:', error);
      setMessage({
        type: 'error',
        text: 'Erreur réseau'
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <UserPlus size={20} className="text-primary" />
        <h3 className="text-lg font-semibold text-gray-900">Inviter un Aidant</h3>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Email de l'aidant <span className="text-red-500">*</span>
          </label>
          <input
            type="email"
            required
            value={formData.caregiverEmail}
            onChange={(e) => setFormData({ ...formData, caregiverEmail: e.target.value })}
            placeholder="aidant@example.com"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Relation <span className="text-red-500">*</span>
          </label>
          <select
            required
            value={formData.relationship}
            onChange={(e) => setFormData({ ...formData, relationship: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
          >
            <option value="">Sélectionner...</option>
            {relationships.map(rel => (
              <option key={rel.value} value={rel.value}>{rel.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Message personnel (optionnel)
          </label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent"
            rows={3}
            placeholder="Ex: Bonjour maman, je t'invite à suivre mon dossier médical..."
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-primary text-white px-4 py-2 rounded-md hover:bg-primary-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {loading ? 'Envoi en cours...' : 'Envoyer l\'invitation'}
        </button>

        {message.type === 'success' && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-3 rounded-md border border-green-200">
            <CheckCircle size={16} />
            <span>{message.text}</span>
          </div>
        )}

        {message.type === 'error' && (
          <div className="flex items-center gap-2 text-sm text-red-700 bg-red-50 p-3 rounded-md border border-red-200">
            <XCircle size={16} />
            <span>{message.text}</span>
          </div>
        )}

        {message.type === 'success' && (
          <p className="text-xs text-gray-500 text-center">
            L'aidant recevra un lien d'invitation à l'adresse email fournie.
          </p>
        )}
      </form>
    </div>
  );
};

export default CaregiverInviteForm;
