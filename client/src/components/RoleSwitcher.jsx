import React from 'react';
import { useAuth } from '../context/AuthContext';
import { User, Users, Stethoscope, Shield } from 'lucide-react';

const RoleSwitcher = () => {
  const { userRoles, activeRole, switchRole } = useAuth();

  // Don't render if user has only one role or no roles
  if (!userRoles || userRoles.length <= 1) return null;

  const roleConfig = {
    patient: {
      icon: User,
      label: 'Mon Dossier',
      activeClass: 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-200',
      inactiveClass: 'text-gray-600 hover:bg-gray-50'
    },
    caregiver: {
      icon: Users,
      label: 'Patients Gérés',
      activeClass: 'bg-green-50 text-green-700 shadow-sm ring-1 ring-green-200',
      inactiveClass: 'text-gray-600 hover:bg-gray-50'
    },
    doctor: {
      icon: Stethoscope,
      label: 'Espace Médecin',
      activeClass: 'bg-purple-50 text-purple-700 shadow-sm ring-1 ring-purple-200',
      inactiveClass: 'text-gray-600 hover:bg-gray-50'
    },
    admin: {
      icon: Shield,
      label: 'Admin',
      activeClass: 'bg-red-50 text-red-700 shadow-sm ring-1 ring-red-200',
      inactiveClass: 'text-gray-600 hover:bg-gray-50'
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
              isActive ? config.activeClass : config.inactiveClass
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
