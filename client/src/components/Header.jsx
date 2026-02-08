import React from 'react';
import { Link } from 'react-router-dom';
import { Phone, Search, Menu, User, MapPin } from 'lucide-react';
import Button from './ui/Button';
import BetaBadge from './ui/BetaBadge';
import RoleSwitcher from './RoleSwitcher';
import { useAuth } from '../context/AuthContext';

const Header = () => {
    const { currentUser, userRoles, activeRole } = useAuth();

    return (
        <header className="w-full font-sans">
            {/* Utility Bar (Top) */}
            <div className="bg-slate-900 text-slate-300 text-xs py-2">
                <div className="container mx-auto px-4 flex justify-between items-center">
                    <div className="flex gap-4">
                        <span className="hover:text-white cursor-pointer hidden sm:inline">Carrières</span>
                        <span className="hover:text-white cursor-pointer hidden sm:inline">Actualités</span>
                        <span className="hover:text-white cursor-pointer">Nous Contacter</span>
                    </div>
                    <div className="flex gap-4 items-center">
                        <span className="flex items-center gap-1 hover:text-white cursor-pointer">
                            <Phone size={12} /> +243 81 000 0000
                        </span>
                        <span className="flex items-center gap-1 hover:text-white cursor-pointer">
                            <MapPin size={12} /> Nos Centres
                        </span>
                        <div className="h-3 w-px bg-slate-700 mx-2"></div>
                        <span className="text-white font-bold hover:underline cursor-pointer">Faire un Don</span>
                    </div>
                </div>
            </div>

            {/* Main Navigation Bar */}
            <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
                <div className="container mx-auto px-4 h-20 flex items-center justify-between">
                    {/* Logo Section */}
                    <Link to="/" className="flex items-center gap-3 group">
                        <div className="bg-primary text-white p-2 rounded-md">
                            <span className="text-2xl">🏥</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-xl font-bold text-gray-900 leading-tight group-hover:text-primary transition-colors">
                                GlucoSoin
                                <BetaBadge />
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold">
                                Centre Médical
                            </span>
                        </div>
                    </Link>

                    {/* Desktop Menu */}
                    <nav className="hidden lg:flex items-center gap-8 font-medium text-gray-700">
                        <a href="#services" className="hover:text-primary py-2 border-b-2 border-transparent hover:border-primary transition-all">
                            Soins
                        </a>
                        <a href="#specialties" className="hover:text-primary py-2 border-b-2 border-transparent hover:border-primary transition-all">
                            Spécialités
                        </a>
                        <Link to="/find-doctor" className="hover:text-primary py-2 border-b-2 border-transparent hover:border-primary transition-all">
                            Trouver un Médecin
                        </Link>
                        <div className="flex items-center gap-2 text-gray-400 cursor-pointer hover:text-primary">
                            <Search size={18} />
                            <span className="sr-only">Rechercher</span>
                        </div>
                    </nav>

                    {/* Mobile Menu Button */}
                    <button className="lg:hidden p-2 text-gray-600 hover:text-primary">
                        <Menu size={24} />
                    </button>

                    {/* Role Switcher (for users with multiple roles) */}
                    <div className="hidden lg:flex items-center gap-3">
                        {currentUser && userRoles && userRoles.length > 1 && <RoleSwitcher />}

                        {/* Primary Action - routes based on role */}
                        {currentUser ? (
                            <Link to={activeRole === 'patient' || activeRole === 'caregiver' ? '/portal' : '/dashboard'}>
                                <Button className="bg-blue-900 hover:bg-blue-800 text-white border-none shadow-none rounded-full px-6 flex items-center gap-2">
                                    <User size={16} /> Mon Espace
                                </Button>
                            </Link>
                        ) : (
                            <Link to="/login">
                                <Button className="bg-blue-900 hover:bg-blue-800 text-white border-none shadow-none rounded-full px-6 flex items-center gap-2">
                                    <User size={16} /> Espace Patient / Connexion
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </header>
    );
};

export default Header;
