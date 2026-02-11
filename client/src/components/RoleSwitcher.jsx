import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { User, Users, Stethoscope, Shield } from 'lucide-react';
import toast from 'react-hot-toast';

const RoleSwitcher = () => {
  const { userRoles, activeRole, switchRole } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Don't render if user has only one role or no roles
  if (!userRoles || userRoles.length <= 1) return null;

  const roleConfig = {
    patient: {
      icon: User,
      label: 'Mon Dossier',
      path: '/portal',
      activeClass: 'bg-blue-50 text-blue-700 shadow-sm ring-1 ring-blue-200',
      inactiveClass: 'text-gray-600 hover:bg-gray-50'
    },
    caregiver: {
      icon: Users,
      label: 'Patients Gérés',
      path: '/portal',
      activeClass: 'bg-green-50 text-green-700 shadow-sm ring-1 ring-green-200',
      inactiveClass: 'text-gray-600 hover:bg-gray-50'
    },
    doctor: {
      icon: Stethoscope,
      label: 'Espace Médecin',
      path: '/dashboard',
      activeClass: 'bg-purple-50 text-purple-700 shadow-sm ring-1 ring-purple-200',
      inactiveClass: 'text-gray-600 hover:bg-gray-50'
    },
    admin: {
      icon: Shield,
      label: 'Admin',
      path: '/dashboard',
      activeClass: 'bg-red-50 text-red-700 shadow-sm ring-1 ring-red-200',
      inactiveClass: 'text-gray-600 hover:bg-gray-50'
    }
  };

  const handleRoleSwitch = (role) => {
    if (activeRole === role) return; // Already on this role

    switchRole(role);
    const config = roleConfig[role];
    const targetPath = config.path;

    // Navigate if on a different page
    if (location.pathname !== targetPath) {
      navigate(targetPath);
    }

    toast.success(`Rôle changé: ${config.label}`, { duration: 2000 });
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
            onClick={() => handleRoleSwitch(role)}
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
