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

    const portalHref = activeRole === 'patient' || activeRole === 'caregiver' ? '/portal' : '/dashboard';

    return (
        <header className="w-full font-sans">
            {/* Utility Bar (Top) */}
            <div className="bg-slate-900 text-slate-300 text-xs py-2">
                <div className="container mx-auto px-4 flex justify-between items-center">
                    <div className="flex gap-4 items-center">
                        <span className="hover:text-white cursor-pointer hidden sm:inline transition-colors">{t.careers}</span>
                        <span className="hover:text-white cursor-pointer hidden sm:inline transition-colors">{t.news}</span>
                        <span className="hover:text-white cursor-pointer transition-colors">{t.contact}</span>
                    </div>
                    <div className="flex gap-2 sm:gap-4 items-center">
                        <span className="hidden sm:flex items-center gap-1.5 hover:text-white cursor-pointer transition-colors">
                            <Phone size={12} /> +243 81 000 0000
                        </span>
                        <span className="hidden sm:flex items-center gap-1.5 hover:text-white cursor-pointer transition-colors">
                            <MapPin size={12} /> {t.ourCenters}
                        </span>
                        <div className="h-3 w-px bg-slate-700 mx-2 hidden sm:block"></div>
                        <span className="text-white font-semibold hover:underline cursor-pointer">{t.donate}</span>
                        <div className="h-3 w-px bg-slate-700 mx-1"></div>
                        {/* Language Selector */}
                        <div className="flex items-center gap-1">
                            <Globe size={12} className="text-slate-400" />
                            <select
                                value={lang}
                                onChange={(e) => setLang(e.target.value)}
                                className="bg-transparent text-slate-300 text-xs border-none outline-none cursor-pointer hover:text-white transition-colors appearance-none pr-3"
                                style={{ backgroundImage: 'none' }}
                                aria-label="Language"
                            >
                                {LANGUAGES.map(l => (
                                    <option key={l.code} value={l.code} className="bg-slate-900 text-white">{l.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Navigation Bar — sticky with subtle glassmorphism */}
            <div className="bg-white/90 backdrop-blur-md supports-[backdrop-filter]:bg-white/75 border-b border-slate-200/80 shadow-xs sticky top-0 z-50">
                <div className="container mx-auto px-4 h-16 sm:h-20 flex items-center justify-between gap-4">
                    {/* Logo Section */}
                    <Link to="/" className="flex items-center gap-2 sm:gap-3 group shrink-0">
                        <div className="bg-gradient-to-br from-primary to-primary-dark text-white p-1.5 sm:p-2 rounded-lg shadow-sm group-hover:shadow-md transition-shadow">
                            <span className="text-xl sm:text-2xl leading-none" role="img" aria-label="hospital">🏥</span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-lg sm:text-xl font-bold text-slate-900 leading-tight tracking-tight group-hover:text-primary transition-colors">
                                GlucoSoin
                                <BetaBadge />
                            </span>
                            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold hidden sm:block">
                                {t.medicalCenter}
                            </span>
                        </div>
                    </Link>

                    {/* Desktop Menu */}
                    <nav className="hidden lg:flex items-center gap-7 font-medium text-slate-700">
                        <a href="#services" className="relative py-2 transition-colors hover:text-primary group">
                            {t.care}
                            <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-200 ease-out-expo origin-left" />
                        </a>
                        <a href="#specialties" className="relative py-2 transition-colors hover:text-primary group">
                            {t.specialties}
                            <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-200 ease-out-expo origin-left" />
                        </a>
                        <Link to="/find-doctor" className="relative py-2 transition-colors hover:text-primary group">
                            {t.findDoctor}
                            <span className="absolute left-0 right-0 -bottom-px h-0.5 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-200 ease-out-expo origin-left" />
                        </Link>
                        <button
                            type="button"
                            aria-label="Rechercher"
                            className="p-2 -mr-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-100 transition-colors"
                        >
                            <Search size={18} />
                        </button>
                    </nav>

                    {/* Mobile Menu Button */}
                    <button
                        type="button"
                        aria-label="Menu"
                        aria-expanded={mobileMenuOpen}
                        className="lg:hidden p-2 -mr-2 rounded-lg text-slate-600 hover:text-primary hover:bg-slate-100 transition-colors"
                        onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                    >
                        {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                    </button>

                    {/* Role Switcher + Notifications + CTA */}
                    <div className="hidden lg:flex items-center gap-3">
                        {currentUser && <NotificationBell />}
                        {currentUser && userRoles && userRoles.length > 1 && <RoleSwitcher />}

                        {currentUser ? (
                            <Link to={portalHref}>
                                <Button
                                    variant="primary"
                                    className="rounded-full px-5"
                                    leftIcon={<User size={16} />}
                                >
                                    {t.mySpace}
                                </Button>
                            </Link>
                        ) : (
                            <Link to="/login">
                                <Button
                                    variant="primary"
                                    className="rounded-full px-5"
                                    leftIcon={<User size={16} />}
                                >
                                    {t.login}
                                </Button>
                            </Link>
                        )}
                    </div>
                </div>

                {/* Mobile Menu Dropdown */}
                {mobileMenuOpen && (
                    <div className="lg:hidden border-t border-slate-200 bg-white px-4 py-4 space-y-1 animate-fade-in-up">
                        <a
                            href="#services"
                            className="block text-slate-700 hover:text-primary hover:bg-slate-50 rounded-lg px-3 py-3 font-medium min-h-[44px] transition-colors"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            {t.care}
                        </a>
                        <a
                            href="#specialties"
                            className="block text-slate-700 hover:text-primary hover:bg-slate-50 rounded-lg px-3 py-3 font-medium min-h-[44px] transition-colors"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            {t.specialties}
                        </a>
                        <Link
                            to="/find-doctor"
                            className="block text-slate-700 hover:text-primary hover:bg-slate-50 rounded-lg px-3 py-3 font-medium min-h-[44px] transition-colors"
                            onClick={() => setMobileMenuOpen(false)}
                        >
                            {t.findDoctor}
                        </Link>
                        {currentUser && (
                            <div className="border-t border-slate-100 pt-3 flex items-center gap-3 px-3">
                                <NotificationBell />
                                <span className="text-sm text-slate-600">Notifications</span>
                            </div>
                        )}
                        {currentUser && userRoles && userRoles.length > 1 && (
                            <div className="border-t border-slate-100 pt-3 px-3">
                                <RoleSwitcher />
                            </div>
                        )}
                        <div className="border-t border-slate-100 pt-3">
                            {currentUser ? (
                                <Link to={portalHref} onClick={() => setMobileMenuOpen(false)}>
                                    <Button
                                        variant="primary"
                                        size="lg"
                                        fullWidth
                                        className="rounded-full"
                                        leftIcon={<User size={16} />}
                                    >
                                        {t.mySpace}
                                    </Button>
                                </Link>
                            ) : (
                                <Link to="/login" onClick={() => setMobileMenuOpen(false)}>
                                    <Button
                                        variant="primary"
                                        size="lg"
                                        fullWidth
                                        className="rounded-full"
                                        leftIcon={<User size={16} />}
                                    >
                                        {t.loginShort}
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
