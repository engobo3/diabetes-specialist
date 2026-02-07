import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Users, Trash2, Shield, Clock } from 'lucide-react';

const CaregiverList = ({ patientId, onUpdate }) => {
  const { currentUser } = useAuth();
  const [caregivers, setCaregivers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCaregivers();
  }, [patientId]);

  const fetchCaregivers = async () => {
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/caregivers/patients/${patientId}/caregivers`,
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setCaregivers(data);
      }
    } catch (error) {
      console.error('Error fetching caregivers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async (caregiverEmail) => {
    if (!confirm(`Voulez-vous vraiment retirer ${caregiverEmail} comme aidant?`)) {
      return;
    }

    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/caregivers/${patientId}/${encodeURIComponent(caregiverEmail)}`,
        {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        }
      );

      if (response.ok) {
        fetchCaregivers();
        if (onUpdate) onUpdate();
      } else {
        const error = await response.json();
        alert(error.message || 'Erreur lors de la suppression');
      }
    } catch (error) {
      console.error('Error removing caregiver:', error);
      alert('Erreur réseau');
    }
  };

  const relationshipLabels = {
    parent: 'Parent',
    adult_child: 'Enfant Adulte',
    spouse: 'Conjoint(e)',
    sibling: 'Frère/Sœur',
    guardian: 'Tuteur',
    caregiver: 'Aidant(e)'
  };

  const permissionLabels = {
    viewVitals: 'Voir les constantes',
    viewAppointments: 'Voir les RDV',
    viewPrescriptions: 'Voir les ordonnances',
    requestAppointments: 'Demander RDV',
    addVitals: 'Ajouter constantes',
    viewDocuments: 'Voir les documents',
    viewPayments: 'Voir les paiements'
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center gap-2 mb-4">
        <Users size={20} className="text-primary" />
        <h3 className="text-lg font-semibold text-gray-900">
          Aidants Autorisés ({caregivers.length})
        </h3>
      </div>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Chargement...</div>
      ) : caregivers.length === 0 ? (
        <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
          <Users size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 text-sm">Aucun aidant enregistré</p>
        </div>
      ) : (
        <div className="space-y-3">
          {caregivers.map((cg, index) => (
            <div
              key={index}
              className="flex items-start justify-between p-4 bg-gray-50 rounded-lg border border-gray-100 hover:border-primary/30 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-gray-900 truncate">{cg.email}</div>

                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-100 text-blue-700">
                    {relationshipLabels[cg.relationship] || cg.relationship}
                  </span>

                  {cg.status === 'suspended' && (
                    <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-red-100 text-red-700">
                      Suspendu
                    </span>
                  )}

                  {cg.addedAt && (
                    <span className="text-xs text-gray-500 flex items-center gap-1">
                      <Clock size={12} />
                      Ajouté le {new Date(cg.addedAt).toLocaleDateString()}
                    </span>
                  )}
                </div>

                {cg.permissions && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {Object.entries(cg.permissions)
                      .filter(([_, value]) => value === true)
                      .slice(0, 4)
                      .map(([key]) => (
                        <span
                          key={key}
                          className="inline-flex items-center text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded"
                        >
                          <Shield size={10} className="mr-1" />
                          {permissionLabels[key] || key}
                        </span>
                      ))}
                    {Object.values(cg.permissions || {}).filter(v => v === true).length > 4 && (
                      <span className="text-xs text-gray-500">
                        +{Object.values(cg.permissions).filter(v => v === true).length - 4} autres
                      </span>
                    )}
                  </div>
                )}
              </div>

              <button
                onClick={() => handleRemove(cg.email)}
                className="ml-3 p-2 text-red-600 hover:bg-red-50 rounded-md transition-colors"
                title="Retirer cet aidant"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CaregiverList;
