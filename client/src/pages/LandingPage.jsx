import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import useInstallPrompt from '../hooks/useInstallPrompt';
import Header from '../components/Header';
import { Card, CardContent } from '../components/ui/Card';
import Badge from '../components/ui/Badge';
import Skeleton from '../components/ui/Skeleton';
import {
    Calendar, UserSearch, FileText, CreditCard,
    Activity, ArrowRight, HeartPulse, Brain, Baby, Stethoscope,
    Shield, Clock, Users, Award, Phone, MapPin, ChevronRight, Star, Download
} from 'lucide-react';
import Button from '../components/ui/Button';
import { useLanguage } from '../context/LanguageContext';
import { getTranslations } from '../translations';

const LandingPage = () => {
    const { isInstallable, promptInstall } = useInstallPrompt();
    const { lang } = useLanguage();
    const t = getTranslations('landing', lang);
    const [diabetesDoctors, setDiabetesDoctors] = useState([]);

    useEffect(() => {
        fetch(`${import.meta.env.VITE_API_URL}/api/doctors`)
            .then(res => res.json())
            .then(data => {
                const specialists = data.filter(doc =>
                    doc.specialty === 'Endocrinologist' ||
                    doc.specialty === 'Pediatric Diabetologist'
                ).slice(0, 3);
                setDiabetesDoctors(specialists);
            })
            .catch(err => console.error("Failed to load doctors", err));
    }, []);

    const quickActions = [
        { icon: Calendar, label: t.appointment, desc: t.appointmentDesc, link: "/portal" },
        { icon: UserSearch, label: t.findDoctorAction, desc: t.findDoctorDesc, link: "/find-doctor" },
        { icon: FileText, label: t.patientPortal, desc: t.patientPortalDesc, link: "/login" },
        { icon: CreditCard, label: t.payBill, desc: t.payBillDesc, link: "/portal" },
    ];

    const specialties = [
        { icon: Activity, title: t.diabetesCare, desc: t.diabetesDesc, link: "/find-doctor?specialty=Endocrinologist" },
        { icon: HeartPulse, title: t.cardiology, desc: t.cardiologyDesc, link: "/find-doctor?specialty=Cardiologist" },
        { icon: Brain, title: t.neurology, desc: t.neurologyDesc, link: "/find-doctor?specialty=Neurologist" },
        { icon: Baby, title: t.pediatrics, desc: t.pediatricsDesc, link: "/find-doctor?specialty=Pediatrician" },
        { icon: Stethoscope, title: t.generalMedicine, desc: t.generalMedicineDesc, link: "/find-doctor?specialty=General+Practitioner" },
    ];

    const stats = [
        { value: "15+", label: t.yearsExp, icon: Award },
        { value: "10 000+", label: t.patientsFollowed, icon: Users },
        { value: "24/7", label: t.emergencies, icon: Clock },
        { value: "98%", label: t.satisfaction, icon: Star },
    ];

    return (
        <div className="min-h-screen bg-slate-50 text-gray-900 font-sans">
            <Header />

            {/* PWA Install Banner */}
            {isInstallable && (
                <div
                    className="bg-primary text-white text-center py-2.5 px-4 text-sm font-medium cursor-pointer hover:bg-primary-dark transition-colors flex items-center justify-center gap-2"
                    onClick={promptInstall}
                >
                    <Download size={16} />
                    <span>{t.installBanner}</span>
                    <ArrowRight size={14} className="ml-1" />
                </div>
            )}

            {/* Hero Section */}
            <section className="relative bg-slate-900 text-white min-h-[500px] sm:min-h-[600px] lg:min-h-[680px] flex items-center overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/80 to-slate-900/30 z-10" />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent z-10" />
                <img
                    src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=2053"
                    alt="Équipe Médicale GlucoSoin"
                    className="absolute inset-0 w-full h-full object-cover opacity-50"
                    loading="eager"
                />

                <div className="container mx-auto px-5 sm:px-6 lg:px-8 relative z-20">
                    <div className="max-w-2xl">
                        <div className="flex items-center gap-2 mb-6">
                            <div className="h-px w-8 bg-accent" />
                            <span className="text-accent text-sm font-semibold uppercase tracking-widest">
                                {t.heroSubtitle}
                            </span>
                        </div>

                        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] tracking-tight mb-6">
                            {t.heroTitle1}
                            <br />
                            <span className="text-primary-light">{t.heroTitle2}</span>
                        </h1>

                        <p className="text-lg sm:text-xl text-slate-300 max-w-lg mb-8 leading-relaxed">
                            {t.heroDesc}
                        </p>

                        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                            <Link to="/find-doctor">
                                <Button size="lg" className="w-full sm:w-auto px-8 py-3.5 text-base shadow-lg hover:shadow-xl transition-all">
                                    {t.findSpecialist}
                                </Button>
                            </Link>
                            <Link to="/login">
                                <Button variant="secondary" className="w-full sm:w-auto bg-white/10 hover:bg-white/20 text-white border border-white/20 backdrop-blur-sm px-8 py-3.5 text-base">
                                    {t.doctorSpace}
                                </Button>
                            </Link>
                        </div>
                    </div>
                </div>
            </section>

            {/* Quick Action Tiles */}
            <div className="container mx-auto px-5 sm:px-6 lg:px-8 relative z-30 -mt-16 mb-16 md:mb-24">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                    {quickActions.map((action, idx) => (
                        <Link key={idx} to={action.link} className="block group">
                            <Card className="h-full border-none shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300">
                                <CardContent className="p-5 sm:p-6 flex flex-col items-center text-center">
                                    <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary group-hover:scale-105 transition-all duration-300">
                                        <action.icon size={26} className="text-primary group-hover:text-white transition-colors duration-300" />
                                    </div>
                                    <h3 className="text-sm sm:text-base font-bold text-gray-900 group-hover:text-primary transition-colors leading-tight">
                                        {action.label}
                                    </h3>
                                    <p className="text-xs sm:text-sm text-gray-500 mt-1.5 leading-snug hidden sm:block">
                                        {action.desc}
                                    </p>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Trust Stats Bar */}
            <section className="py-12 md:py-16 bg-white border-y border-gray-100">
                <div className="container mx-auto px-5 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
                        {stats.map((stat, idx) => (
                            <div key={idx} className="text-center">
                                <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary/10 mb-3">
                                    <stat.icon size={22} className="text-primary" />
                                </div>
                                <div className="text-3xl sm:text-4xl font-bold text-gray-900 tracking-tight">
                                    {stat.value}
                                </div>
                                <div className="text-sm text-gray-500 mt-1 font-medium">
                                    {stat.label}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* Centers of Excellence */}
            <section id="specialties" className="py-16 md:py-24 bg-slate-50">
                <div className="container mx-auto px-5 sm:px-6 lg:px-8">
                    <div className="text-center mb-12 md:mb-16">
                        <span className="inline-block text-sm font-semibold text-primary uppercase tracking-widest mb-3">
                            {t.ourExpertise}
                        </span>
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
                            {t.ourSpecialties}
                        </h2>
                        <div className="w-16 h-1 bg-accent mx-auto mt-4 rounded-full" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {specialties.map((spec, idx) => (
                            <Link key={idx} to={spec.link} className="group">
                                <Card className="h-full border border-gray-100 hover:border-primary/30 hover:shadow-lg transition-all duration-300">
                                    <CardContent className="p-6 sm:p-8">
                                        <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-5 group-hover:bg-primary transition-colors duration-300">
                                            <spec.icon size={24} className="text-primary group-hover:text-white transition-colors duration-300" />
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-900 mb-2 group-hover:text-primary transition-colors">
                                            {spec.title}
                                        </h3>
                                        <p className="text-gray-500 text-sm leading-relaxed mb-4">
                                            {spec.desc}
                                        </p>
                                        <span className="inline-flex items-center text-sm font-semibold text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                                            {t.learnMore}
                                            <ChevronRight size={16} className="ml-1" />
                                        </span>
                                    </CardContent>
                                </Card>
                            </Link>
                        ))}

                        <Link to="/find-doctor" className="group">
                            <div className="h-full border-2 border-dashed border-gray-200 rounded-xl flex flex-col items-center justify-center p-8 hover:border-primary/40 hover:bg-primary/5 transition-all duration-300 cursor-pointer min-h-[200px]">
                                <div className="w-12 h-12 rounded-full border-2 border-gray-300 flex items-center justify-center mb-4 group-hover:border-primary group-hover:text-primary transition-colors">
                                    <ArrowRight size={20} className="text-gray-400 group-hover:text-primary transition-colors" />
                                </div>
                                <span className="font-semibold text-gray-500 group-hover:text-primary transition-colors">
                                    {t.viewAllSpecialties}
                                </span>
                            </div>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Doctors Section */}
            <section id="doctors" className="py-16 md:py-24 bg-white">
                <div className="container mx-auto px-5 sm:px-6 lg:px-8">
                    <div className="text-center mb-12 md:mb-16">
                        <span className="inline-block text-sm font-semibold text-primary uppercase tracking-widest mb-3">
                            {t.ourTeam}
                        </span>
                        <h2 className="text-3xl md:text-4xl font-bold text-gray-900 tracking-tight">
                            {t.meetSpecialists}
                        </h2>
                        <p className="text-gray-500 mt-4 max-w-xl mx-auto leading-relaxed">
                            {t.teamDesc}
                        </p>
                        <div className="w-16 h-1 bg-accent mx-auto mt-6 rounded-full" />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
                        {diabetesDoctors.length > 0 ? (
                            diabetesDoctors.map(doctor => (
                                <Link key={doctor.id} to={`/doctor/${doctor.id}`} className="group">
                                    <Card className="h-full overflow-hidden hover:shadow-lg transition-all duration-300">
                                        <div className="relative h-56 sm:h-64 overflow-hidden bg-gray-100">
                                            <img
                                                src={doctor.image}
                                                alt={doctor.name}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                                            />
                                            <div className="absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/30 to-transparent" />
                                        </div>
                                        <CardContent className="p-5 sm:p-6">
                                            <Badge variant="primary" className="mb-3">
                                                {doctor.specialty}
                                            </Badge>
                                            <h3 className="text-lg font-bold text-gray-900 group-hover:text-primary transition-colors">
                                                {doctor.name}
                                            </h3>
                                            <p className="text-sm text-gray-500 mt-1 line-clamp-2">
                                                {doctor.bio || t.defaultBio}
                                            </p>
                                            <div className="mt-4 flex items-center text-sm font-semibold text-primary">
                                                {t.viewProfile}
                                                <ChevronRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />
                                            </div>
                                        </CardContent>
                                    </Card>
                                </Link>
                            ))
                        ) : (
                            Array.from({ length: 3 }).map((_, idx) => (
                                <Card key={idx} className="h-full overflow-hidden">
                                    <Skeleton className="h-56 sm:h-64 w-full rounded-none" />
                                    <CardContent className="p-5 sm:p-6 space-y-3">
                                        <Skeleton className="h-5 w-24" />
                                        <Skeleton className="h-6 w-48" />
                                        <Skeleton className="h-4 w-full" />
                                        <Skeleton className="h-4 w-32 mt-2" />
                                    </CardContent>
                                </Card>
                            ))
                        )}
                    </div>

                    <div className="text-center">
                        <Link to="/find-doctor">
                            <Button variant="secondary" size="lg" className="px-8 border-2 border-primary text-primary hover:bg-primary hover:text-white transition-colors">
                                {t.searchNetwork}
                                <ArrowRight size={18} className="ml-2" />
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Pre-Footer CTA Banner */}
            <section className="py-16 md:py-24 bg-primary relative overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                    <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/20" />
                    <div className="absolute -bottom-32 -left-32 w-[500px] h-[500px] rounded-full bg-white/10" />
                </div>

                <div className="container mx-auto px-5 sm:px-6 lg:px-8 relative z-10 text-center">
                    <h2 className="text-3xl md:text-4xl font-bold text-white tracking-tight mb-4">
                        {t.ctaTitle}
                    </h2>
                    <p className="text-teal-100 text-lg max-w-xl mx-auto mb-8 leading-relaxed">
                        {t.ctaDesc}
                    </p>
                    <div className="flex flex-col sm:flex-row gap-3 justify-center">
                        <Link to="/portal">
                            <Button size="lg" className="w-full sm:w-auto bg-white text-primary hover:bg-gray-100 px-8 py-3.5 text-base font-semibold shadow-lg">
                                {t.bookAppointment}
                            </Button>
                        </Link>
                        <Link to="/find-doctor">
                            <Button size="lg" className="w-full sm:w-auto bg-transparent text-white border border-white/30 hover:bg-white/10 px-8 py-3.5 text-base">
                                <Phone size={18} className="mr-2" />
                                {t.contactUs}
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-slate-900 text-slate-400">
                <div className="container mx-auto px-5 sm:px-6 lg:px-8 py-12 md:py-16">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-12">
                        <div className="sm:col-span-2 lg:col-span-1">
                            <div className="flex items-center gap-2.5 mb-4">
                                <div className="bg-primary text-white p-1.5 rounded-md">
                                    <Shield size={20} />
                                </div>
                                <span className="text-white text-lg font-bold">GlucoSoin</span>
                            </div>
                            <p className="text-sm leading-relaxed">
                                {t.heroDesc}
                            </p>
                        </div>

                        <div>
                            <h4 className="text-white text-sm font-bold uppercase tracking-wider mb-5">{t.patients}</h4>
                            <ul className="space-y-3 text-sm">
                                <li>
                                    <Link to="/login" className="hover:text-white transition-colors inline-flex items-center gap-1">
                                        <ChevronRight size={14} className="text-slate-600" /> {t.patientPortalFooter}
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/portal" className="hover:text-white transition-colors inline-flex items-center gap-1">
                                        <ChevronRight size={14} className="text-slate-600" /> {t.payBillFooter}
                                    </Link>
                                </li>
                                <li>
                                    <Link to="/login" className="hover:text-white transition-colors inline-flex items-center gap-1">
                                        <ChevronRight size={14} className="text-slate-600" /> {t.medicalRecords}
                                    </Link>
                                </li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-white text-sm font-bold uppercase tracking-wider mb-5">{t.organization}</h4>
                            <ul className="space-y-3 text-sm">
                                <li>
                                    <Link to="/about" className="hover:text-white transition-colors inline-flex items-center gap-1">
                                        <ChevronRight size={14} className="text-slate-600" /> {t.about}
                                    </Link>
                                </li>
                                <li>
                                    <a href="#" className="hover:text-white transition-colors inline-flex items-center gap-1">
                                        <ChevronRight size={14} className="text-slate-600" /> {t.careersFooter}
                                    </a>
                                </li>
                                <li>
                                    <a href="#" className="hover:text-white transition-colors inline-flex items-center gap-1">
                                        <ChevronRight size={14} className="text-slate-600" /> {t.contactFooter}
                                    </a>
                                </li>
                            </ul>
                        </div>

                        <div>
                            <h4 className="text-white text-sm font-bold uppercase tracking-wider mb-5">{t.contactTitle}</h4>
                            <div className="space-y-3 text-sm">
                                <div className="flex items-start gap-2.5">
                                    <MapPin size={16} className="text-primary-light mt-0.5 shrink-0" />
                                    <span>Av. de la Médecine, Gombe<br />Kinshasa, RDC</span>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <Phone size={16} className="text-primary-light shrink-0" />
                                    <span>+243 81 000 0000</span>
                                </div>
                                <div className="flex items-center gap-2.5">
                                    <Clock size={16} className="text-primary-light shrink-0" />
                                    <span>{t.hours}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="border-t border-slate-800">
                    <div className="container mx-auto px-5 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
                        <span>&copy; {new Date().getFullYear()} {t.copyright}</span>
                        <div className="flex gap-4">
                            <a href="#" className="hover:text-white transition-colors">{t.privacy}</a>
                            <a href="#" className="hover:text-white transition-colors">{t.terms}</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
