import React from 'react';
import Header from '../components/Header';
import { ArrowRight, Users, Heart, ShieldCheck, Activity } from 'lucide-react';
import { Link } from 'react-router-dom';
import Button from '../components/ui/Button';

const About = () => {
    return (
        <div className="min-h-screen bg-slate-50 font-sans text-gray-900">
            <Header />

            {/* Hero Section */}
            <div className="bg-slate-900 text-white py-20">
                <div className="container mx-auto px-4 text-center">
                    <h1 className="text-4xl md:text-5xl font-serif font-bold mb-6">Notre Raison d'Être</h1>
                    <p className="text-xl text-slate-300 max-w-3xl mx-auto leading-relaxed">
                        Briser la distance entre le patient et le spécialiste. <br />
                        Rendre les soins du diabète accessibles, humains et continus en RDC.
                    </p>
                </div>
            </div>

            {/* The Problem & Solution */}
            <section className="py-16 md:py-24">
                <div className="container mx-auto px-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                        <div className="order-2 md:order-1">
                            <img
                                src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&q=80&w=2070"
                                alt="Médecin et patient consultation"
                                className="rounded-lg shadow-xl"
                            />
                        </div>
                        <div className="order-1 md:order-2">
                            <h2 className="text-3xl font-bold text-gray-900 mb-6 font-serif">Pourquoi GlucoSoin ?</h2>
                            <div className="space-y-6 text-lg text-gray-600">
                                <p>
                                    En République Démocratique du Congo, l'accès à un diabétologue spécialisé reste un défi majeur. Les patients parcourent souvent de longues distances, affrontent des files d'attente interminables et subissent des interruptions dans leur suivi médical.
                                </p>
                                <p>
                                    Nous avons créé <span className="font-bold text-primary">GlucoSoin</span> pour changer cette réalité.
                                </p>
                                <p>
                                    Notre plateforme n'est pas seulement une application de rendez-vous. C'est un pont numérique qui connecte directement les patients aux meilleurs spécialistes du pays. Nous permettons un suivi continu, une gestion simplifiée des dossiers et, surtout, une relation de confiance renouvelée entre le soignant et le soigné.
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Values Section */}
            <section className="bg-white py-16 border-y border-gray-100">
                <div className="container mx-auto px-4">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-gray-900 font-serif">Nos Valeurs Fondatrices</h2>
                        <div className="w-16 h-1 bg-primary mx-auto mt-4 rounded-full"></div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div className="text-center p-6">
                            <div className="w-16 h-16 bg-blue-50 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
                                <Users size={32} />
                            </div>
                            <h3 className="text-xl font-bold mb-3">Proximité</h3>
                            <p className="text-gray-600">
                                La technologie doit rapprocher, pas éloigner. Nous ramenons le médecin « au chevet » du patient, où qu'il soit.
                            </p>
                        </div>
                        <div className="text-center p-6">
                            <div className="w-16 h-16 bg-blue-50 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
                                <Heart size={32} />
                            </div>
                            <h3 className="text-xl font-bold mb-3">Empathie</h3>
                            <p className="text-gray-600">
                                Derrière chaque donnée de glycémie, il y a une personne. Notre approche est centrée sur le bien-être global du patient.
                            </p>
                        </div>
                        <div className="text-center p-6">
                            <div className="w-16 h-16 bg-blue-50 text-primary rounded-full flex items-center justify-center mx-auto mb-6">
                                <ShieldCheck size={32} />
                            </div>
                            <h3 className="text-xl font-bold mb-3">Excellence</h3>
                            <p className="text-gray-600">
                                Nous collaborons uniquement avec des spécialistes certifiés pour garantir des soins de la plus haute qualité.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Call to Action */}
            <section className="py-20 bg-primary/5">
                <div className="container mx-auto px-4 text-center">
                    <h2 className="text-3xl font-bold text-gray-900 mb-6 font-serif">Rejoignez le Mouvement</h2>
                    <p className="text-xl text-gray-600 mb-10 max-w-2xl mx-auto">
                        Que vous soyez un patient cherchant un meilleur suivi ou un spécialiste souhaitant toucher plus de vies.
                    </p>
                    <div className="flex flex-col sm:flex-row gap-4 justify-center">
                        <Link to="/register">
                            <Button size="lg" className="w-full sm:w-auto px-8">
                                Je suis Patient <ArrowRight size={18} className="ml-2" />
                            </Button>
                        </Link>
                        <Link to="/find-doctor">
                            <Button variant="outline" size="lg" className="w-full sm:w-auto px-8 bg-white">
                                Voir nos Spécialistes
                            </Button>
                        </Link>
                    </div>
                </div>
            </section>

            {/* Simple Footer (Reused design for consistency) */}
            <footer className="bg-slate-900 text-slate-400 py-8 text-center text-sm">
                <div className="container mx-auto px-4">
                    <p>&copy; 2024 Centre Médical GlucoSoin. Tous droits réservés.</p>
                </div>
            </footer>
        </div>
    );
};

export default About;
