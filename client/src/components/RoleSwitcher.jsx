import React from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Users, Stethoscope } from 'lucide-react';

const RoleSwitcher = () => {
  const { userRoles, activeRole, switchRole } = useAuth();

  // Don't render if user has only one role or no roles
  if (!userRoles || userRoles.length <= 1) return null;

  const roleConfig = {
    patient: {
      icon: User,
      label: 'Mon Dossier',
      color: 'blue'
    },
    caregiver: {
      icon: Users,
      label: 'Patients Gérés',
      color: 'green'
    },
    doctor: {
      icon: Stethoscope,
      label: 'Espace Médecin',
      color: 'purple'
    }
  };

  return (
    <div className="flex gap-1 bg-white rounded-lg p-1 shadow-sm border border-gray-200">
      {userRoles.map(role => {
        const config = roleConfig[role];
        if (!config) return null;

        const Icon = config.icon;
        const isActive = activeRole === role;

        return (
          <button
            key={role}
            onClick={() => switchRole(role)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
              isActive
                ? `bg-${config.color}-50 text-${config.color}-700 shadow-sm`
                : 'text-gray-600 hover:bg-gray-50'
            }`}
            title={config.label}
          >
            <Icon size={16} />
            <span className="hidden sm:inline">{config.label}</span>
          </button>
        );
      })}
    </div>
  );
};

export default RoleSwitcher;
