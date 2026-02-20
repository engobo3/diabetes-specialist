import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Phone, Search, Menu, User, MapPin, X, Globe } from 'lucide-react';
import Button from './ui/Button';
import BetaBadge from './ui/BetaBadge';
import RoleSwitcher from './RoleSwitcher';
import NotificationBell from './NotificationBell';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { getTranslations } from '../translations';

const Header = () => {
    const { currentUser, userRoles, activeRole } = useAuth();
    const { lang, setLang, LANGUAGES } = useLanguage();
    const t = getTranslations('header', lang);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    return (
        <header className="w-full font-sans">
            {/* Utility Bar (Top) */}
            <div className="bg-slate-900 text-slate-300 text-xs py-2">
                <div className="container mx-auto px-4 flex justify-between items-center">
                    <div className="flex gap-4 items-center">
                        <span className="hover:text-white cursor-pointer hidden sm:inline">{t.careers}</span>
                        <span className="hover:text-white cursor-pointer hidden sm:inline">{t.news}</span>
                        <span className="hover:text-white cursor-pointer">{t.contact}</span>
                    </div>
                    <div className="flex gap-2 sm:gap-4 items-center">
                        <span className="hidden sm:flex items-center gap-1 hover:text-white cursor-pointer">
                            <Phone size={12} /> +243 81 000 0000
                        </span>
                        <span className="hidden sm:flex items-center gap-1 hover:text-white cursor-pointer">
                            <MapPin size={12} /> {t.ourCenters}
                        </span>
                        <div className="h-3 w-px bg-slate-700 mx-2 hidden sm:block"></div>
                        <span className="text-white font-bold hover:underline cursor-pointer">{t.donate}</span>
                        <div className="h-3 w-px bg-slate-700 mx-1"></div>
                        {/* Language Selector */}
                        <div className="flex items-center gap-1">
                            <Globe size={12} className="text-slate-400" />
                            <select
                                value={lang}
                                onChange={(e) => setLang(e.target.value)}
                                className="bg-transparent text-slate-300 text-xs border-none outline-none cursor-pointer hover:text-white appearance-none pr-3"
                                style={{ backgroundImage: 'none' }}
                            >
                                {LANGUAGES.map(l => (
                                    <option key={l.code} value={l.code} className="bg-slate-900 text-white">{l.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Navigation Bar */}
            <div className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-50">
                <div className="container mx-auto px-4 h-16 sm:h-20 flex items-center justify-between">
                    {/* Logo Section */}
                    <Link to="/" className="flex items-center gap-2 sm:gap-3 group">
                        <div className="bg-primary text-white p-1.5 sm:p-2 rounded-md">
                            <span className="text-xl sm:text-2xl">🏥</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-lg sm:text-xl font-bold text-gray-900 leading-tight group-hover:text-primary transition-colors">
                                GlucoSoin
                                <BetaBadge />
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-gray-500 font-semibold hidden sm:block">
                                {t.medicalCenter}
                            </span>
                        </div>
                    </Link>

                    {/* Desktop Menu */}
                    <nav className="hidden lg:flex items-center gap-8 font-medium text-gray-700">
                        <a href="#services" className="hover:text-primary py-2 border-b-2 border-transparent hover:border-primary transition-all">
                            {t.care}
                        </a>
                        <a href="#specialties" className="hover:text-primary py-2 border-b-2 border-transparent hover:border-primary transition-all">
                            {t.specialties}
                        </a>
                        <Link to="/find-doctor" className="hover:text-primary py-2 border-b-2 border-transparent hover:border-primary transition-all">
                            {t.findDoctor}
                        </Link>
                        <div className="flex items-center gap-2 text-gray-400 cursor-pointer hover:text-primary">
                            <Search size={18} />
                            <span className="sr-only">Rechercher</span>
                        </div>
                    </nav>

                    {/* Mobile Menu Button */}
                    <button
                        className="lg:hidden p-2 text-gray-600 hover:text-primary"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    >
                        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>

                    {/* Role Switcher + Notifications (for users with multiple roles) */}
                    <div className="hidden lg:flex items-center gap-3">
                        {currentUser && <NotificationBell />}
                        {currentUser && userRoles && userRoles.length > 1 && <RoleSwitcher />}

                        {/* Primary Action - routes based on role */}
                        {currentUser ? (
                            <Link to={activeRole === 'patient' || activeRole === 'caregiver' ? '/portal' : '/dashboard'}>
                                <Button className="bg-blue-900 hover:bg-blue-800 text-white border-none shadow-none rounded-full px-6 flex items-center gap-2">
                                    <User size={16} /> {t.mySpace}
                                </Button>
                            </Link>
                        ) : (
                            <Link to="/login">
                                <Button className="bg-blue-900 hover:bg-blue-800 text-white border-none shadow-none rounded-full px-6 flex items-center gap-2">
                                    <User size={16} /> {t.login}
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Mobile Menu Dropdown */}
                {mobileMenuOpen && (
                    <div className="lg:hidden border-t border-gray-200 bg-white px-4 py-4 space-y-1">
                        <a href="#services" className="block text-gray-700 hover:text-primary py-3 font-medium min-h-[44px]" onClick={() => setMobileMenuOpen(false)}>
                            {t.care}
                        </a>
                        <a href="#specialties" className="block text-gray-700 hover:text-primary py-3 font-medium min-h-[44px]" onClick={() => setMobileMenuOpen(false)}>
                            {t.specialties}
                        </a>
                        <Link to="/find-doctor" className="block text-gray-700 hover:text-primary py-3 font-medium min-h-[44px]" onClick={() => setMobileMenuOpen(false)}>
                            {t.findDoctor}
                        </Link>
                        {currentUser && (
                            <div className="border-t border-gray-100 pt-3 flex items-center gap-3">
                                <NotificationBell />
                                <span className="text-sm text-gray-600">Notifications</span>
                            </div>
                        )}
                        {currentUser && userRoles && userRoles.length > 1 && (
                            <div className="border-t border-gray-100 pt-3">
                                <RoleSwitcher />
                            </div>
                        )}
                        <div className="border-t border-gray-100 pt-3">
                            {currentUser ? (
                                <Link to={activeRole === 'patient' || activeRole === 'caregiver' ? '/portal' : '/dashboard'} onClick={() => setMobileMenuOpen(false)}>
                                    <Button className="w-full min-h-[48px] bg-blue-900 hover:bg-blue-800 text-white border-none shadow-none rounded-full flex items-center justify-center gap-2">
                                        <User size={16} /> {t.mySpace}
                                    </Button>
                                </Link>
                            ) : (
                                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                                    <Button className="w-full min-h-[48px] bg-blue-900 hover:bg-blue-800 text-white border-none shadow-none rounded-full flex items-center justify-center gap-2">
                                        <User size={16} /> {t.loginShort}
                                    </Button>
                                </Link>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </header>
    );
};

export default Header;
