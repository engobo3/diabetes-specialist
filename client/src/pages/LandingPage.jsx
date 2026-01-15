import React from 'react';
import { Link } from 'react-router-dom';
import useInstallPrompt from '../hooks/useInstallPrompt';
import Header from '../components/Header';
import { Card, CardContent } from '../components/ui/Card';
import { Calendar, UserSearch, FileText, CreditCard, Activity, ArrowRight, HeartPulse, Brain, Baby, Stethoscope } from 'lucide-react';
import Button from '../components/ui/Button';

const LandingPage = () => {
    const { isInstallable, promptInstall } = useInstallPrompt();

    // Quick Action Tiles Data
    const quickActions = [
        { icon: Calendar, label: "Prendre Rendez-vous", desc: "Réservez une visite en ligne", link: "/portal" },
        { icon: UserSearch, label: "Trouver un Médecin", desc: "Recherche par spécialité", link: "/find-doctor" },
        { icon: FileText, label: "Portail Patient", desc: "Accédez à vos dossiers", link: "/login" },
        { icon: CreditCard, label: "Payer une Facture", desc: "Paiement sécurisé en ligne", link: "/portal" },
    ];

    // Centers of Excellence Data
    const specialties = [
        { icon: Activity, title: "Soins du Diabète", desc: "Suivi métabolique avancé et traitement." },
        { icon: HeartPulse, title: "Cardiologie", desc: "Santé cardiaque complète et soins vasculaires." },
        { icon: Brain, title: "Neurologie", desc: "Traitement de pointe pour les troubles neurologiques." },
        { icon: Baby, title: "Pédiatrie", desc: "Soins spécialisés pour nourrissons, enfants et adolescents." },
        { icon: Stethoscope, title: "Médecine Générale", desc: "Gestion de la santé holistique pour toute la famille." },
    ];

    return (
        <div className="min-h-screen bg-slate-50 text-gray-900 font-sans">
            <Header />

            {/* PWA Install Banner (Functionality reserved) */}
            {isInstallable && (
                <div className="bg-primary text-white text-center py-2 text-sm font-medium cursor-pointer hover:bg-primary-dark transition-colors" onClick={promptInstall}>
                    📲 Installez l'application GlucoSoin pour un accès mobile
                </div>
            )}

            {/* Hero Section */}
            <div className="relative bg-slate-900 text-white h-[500px] flex items-center overflow-hidden">
                {/* Abstract Background Overlay */}
                <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/40 to-transparent z-10 w-full sm:w-2/3"></div>
                <img
                    src="https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?auto=format&fit=crop&q=80&w=2053"
                    alt="Équipe Médicale"
                    className="absolute inset-0 w-full h-full object-cover opacity-60"
                />

                <div className="container mx-auto px-4 relative z-20 mt-[-60px]">
                    <h1 className="text-4xl md:text-6xl font-serif font-bold mb-4 leading-tight">
                        Soins de Classe Mondiale, <br /> Près de Chez Vous.
                    </h1>
                    <p className="text-xl md:text-2xl text-slate-200 max-w-xl mb-8 font-light">
                        Faire avancer la médecine et transformer des vies grâce à la recherche, l'éducation et la compassion.
                    </p>
                    <div className="flex gap-4">
                        <Link to="/specialties">
                            <Button size="lg" className="w-full sm:w-auto px-8 py-4 text-lg shadow-lg hover:shadow-xl transition-all">
                                Trouver un Spécialiste
                            </Button>
                        </Link>
                        <Link to="/login">
                            <Button className="bg-white/10 hover:bg-white/20 text-white border-white/30 backdrop-blur-sm text-lg px-8 py-6">
                                Accès Démo
                            </Button>
                        </Link>
                    </div>
                </div>
            </div>

            {/* Overlapping Quick Action Tiles */}
            <div className="container mx-auto px-4 relative z-30 mt-[-60px] mb-20">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {quickActions.map((action, idx) => (
                        <Link key={idx} to={action.link} className="block group">
                            <Card className="h-full border-none shadow-lg hover:shadow-xl hover:-translate-y-1 transition-all duration-300 bg-white">
                                <CardContent className="p-6 flex flex-col items-center text-center">
                                    <div className="bg-blue-50 p-4 rounded-full mb-4 group-hover:bg-primary group-hover:text-white transition-colors text-primary">
                                        <action.icon size={28} />
                                    </div>
                                    <h3 className="text-lg font-bold text-gray-900 group-hover:text-primary transition-colors">{action.label}</h3>
                                    <p className="text-sm text-gray-500 mt-2">{action.desc}</p>
                                </CardContent>
                            </Card>
                        </Link>
                    ))}
                </div>
            </div>

            {/* Centers of Excellence */}
            <section id="specialties" className="py-16 bg-white">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-12">
                        <h2 className="text-sm font-bold text-primary uppercase tracking-widest mb-2">Notre Expertise</h2>
                        <h3 className="text-3xl md:text-4xl font-serif font-bold text-gray-900">Centres d'Excellence</h3>
                        <div className="w-20 h-1 bg-accent mx-auto mt-4"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {specialties.map((spec, idx) => (
                            <div key={idx} className="flex gap-4 p-6 border border-gray-100 rounded-lg hover:border-gray-300 hover:bg-slate-50 transition-colors cursor-pointer group">
                                <spec.icon className="text-primary mt-1 group-hover:scale-110 transition-transform" size={40} />
                                <div>
                                    <h4 className="text-xl font-bold text-gray-900 mb-2 group-hover:text-primary transition-colors">{spec.title}</h4>
                                    <p className="text-gray-600 leading-relaxed">{spec.desc}</p>
                                    <div className="mt-4 flex items-center text-sm font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                        En savoir plus <ArrowRight size={16} className="ml-1" />
                                    </div>
                                </div>
                            </div>
                        ))}
                        {/* More Link */}
                        <div className="flex flex-col justify-center items-center p-6 border-2 border-dashed border-gray-200 rounded-lg hover:border-primary/50 hover:bg-primary/5 transition-colors cursor-pointer text-gray-400 hover:text-primary">
                            <div className="text-lg font-semibold">Voir Toutes les Spécialités</div>
                            <ArrowRight size={24} className="mt-2" />
                        </div>
                    </div>
                </div>
            </section>

            {/* Team Preview Section */}
            <section id="doctors" className="bg-slate-50 py-20 border-t border-gray-200">
                <div className="container mx-auto px-4 text-center">
                    <h2 className="text-3xl font-serif font-bold text-gray-900 mb-6">Meet Our Specialists</h2>
                    <p className="text-lg text-gray-600 mb-12 max-w-2xl mx-auto">
                        Our team of board-certified experts is dedicated to providing personalized care for your diabetes journey.
                    </p>

                    <div className="flex justify-center flex-wrap gap-8 mb-12">
                        <Link to="/doctor/1" className="group">
                            <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-xl transition-all border border-gray-100 w-72">
                                <div className="relative w-32 h-32 mx-auto mb-4 rounded-full overflow-hidden border-4 border-slate-50 shadow-inner">
                                    <img src="https://randomuser.me/api/portraits/women/68.jpg" alt="Dr. Connor" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                </div>
                                <h3 className="font-bold text-xl text-gray-900 mb-1">Dr. Sarah Connor</h3>
                                <p className="text-primary font-medium text-sm mb-4 uppercase tracking-wide">Endocrinologist</p>
                                <div className="text-sm font-semibold text-blue-600 group-hover:underline">View Profile &rarr;</div>
                            </div>
                        </Link>
                        <Link to="/doctor/2" className="group">
                            <div className="bg-white p-6 rounded-xl shadow-sm hover:shadow-xl transition-all border border-gray-100 w-72">
                                <div className="relative w-32 h-32 mx-auto mb-4 rounded-full overflow-hidden border-4 border-slate-50 shadow-inner">
                                    <img src="https://randomuser.me/api/portraits/men/32.jpg" alt="Dr. Kim" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                </div>
                                <h3 className="font-bold text-xl text-gray-900 mb-1">Dr. John Kim</h3>
                                <p className="text-primary font-medium text-sm mb-4 uppercase tracking-wide">Pediatric Specialist</p>
                                <div className="text-sm font-semibold text-blue-600 group-hover:underline">View Profile &rarr;</div>
                            </div>
                        </Link>
                    </div>

                    <Link to="/find-doctor">
                        <Button className="bg-white text-primary border-2 border-primary hover:bg-primary hover:text-white px-8 py-3 text-lg font-semibold rounded-full transition-colors">
                            Search Our Full Doctor Network
                        </Button>
                    </Link>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-slate-900 text-slate-400 py-12 text-sm">
                <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
                    <div>
                        <div className="text-white text-lg font-bold mb-4 flex items-center gap-2"><span>🏥</span> GlucoCare</div>
                        <p>Providing world-class diabetes care and research for our community.</p>
                    </div>
                    <div>
                        <h4 className="text-white font-bold mb-4 uppercase tracking-wider">Patients</h4>
                        <ul className="space-y-2">
                            <li><Link to="/login" className="hover:text-white">MyChart Login</Link></li>
                            <li><a href="#" className="hover:text-white">Pay a Bill</a></li>
                            <li><a href="#" className="hover:text-white">Insurance</a></li>
                            <li><a href="#" className="hover:text-white">Medical Records</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-white font-bold mb-4 uppercase tracking-wider">Organization</h4>
                        <ul className="space-y-2">
                            <li><a href="#" className="hover:text-white">About Us</a></li>
                            <li><a href="#" className="hover:text-white">Careers</a></li>
                            <li><a href="#" className="hover:text-white">Newsroom</a></li>
                            <li><a href="#" className="hover:text-white">Contact</a></li>
                        </ul>
                    </div>
                    <div>
                        <h4 className="text-white font-bold mb-4 uppercase tracking-wider">Connect</h4>
                        <p className="mb-2">1234 Medical Center Dr.<br />Seattle, WA 98104</p>
                        <p>(206) 555-0100</p>
                    </div>
                </div>
                <div className="container mx-auto px-4 mt-8 pt-8 border-t border-slate-800 text-center">
                    &copy; 2024 GlucoCare Medical Center. All rights reserved.
                </div>
            </footer>
        </div>
    );
};

export default LandingPage;
