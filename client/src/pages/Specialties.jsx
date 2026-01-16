import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Heart, Activity, Utensils, Baby, Eye, ArrowRight, MapPin } from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';

const Specialties = () => {
    const navigate = useNavigate();

    const specialties = [
        {
            id: 'Endocrinologist',
            name: 'Diabétologue',
            icon: Activity,
            description: 'Spécialistes du diabète et troubles métaboliques.',
            active: true,
            count: 'Disponible'
        },
        {
            id: 'Cardiologist',
            name: 'Cardiologue',
            icon: Heart,
            description: 'Santé cardiaque et prévention.',
            active: true,
            count: 'Disponible'
        },
        {
            id: 'Nutritionist',
            name: 'Nutritionniste',
            icon: Utensils,
            description: 'Plans alimentaires adaptés aux diabétiques.',
            active: true,
            count: 'Disponible'
        },
        {
            id: 'Pediatric Diabetologist',
            name: 'Pédiatrie',
            icon: Baby,
            description: 'Soins pour enfants diabétiques.',
            active: true,
            count: 'Disponible'
        },
        {
            id: 'Ophthalmologist',
            name: 'Ophtalmologue',
            icon: Eye,
            description: 'Dépistage de la rétinopathie.',
            active: true,
            count: 'Disponible'
        }
    ];

    const handleSelect = (spec) => {
        if (spec.active) {
            // Navigate to FindDoctor pre-filtered with the specialty
            // Use encodeURIComponent to handle spaces in specialty names
            navigate(`/find-doctor?specialty=${encodeURIComponent(spec.id)}&city=Kinshasa`);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50">
            {/* Header */}
            <div className="bg-white border-b border-gray-200 py-8">
                <div className="container mx-auto px-4">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">Nos Spécialités</h1>
                    <div className="flex items-center gap-2 text-gray-600">
                        <MapPin size={18} className="text-primary" />
                        <span>Région active : <span className="font-semibold text-gray-900">Kinshasa</span></span>
                    </div>
                </div>
            </div>

            <div className="container mx-auto px-4 py-12">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {specialties.map((spec) => (
                        <Card
                            key={spec.id}
                            onClick={() => handleSelect(spec)}
                            className={`cursor-pointer transition-all hover:shadow-md border-transparent ${spec.active ? 'hover:border-primary/50' : 'opacity-70 grayscale-[0.5]'
                                }`}
                        >
                            <CardContent className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div className={`p-3 rounded-xl ${spec.active ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'}`}>
                                        <spec.icon size={32} />
                                    </div>
                                    <span className={`text-xs px-2 py-1 rounded-full ${spec.active ? 'bg-green-100 text-green-700 font-medium' : 'bg-gray-100 text-gray-500'
                                        }`}>
                                        {spec.count}
                                    </span>
                                </div>
                                <h3 className="text-xl font-bold text-gray-900 mb-2">{spec.name}</h3>
                                <p className="text-gray-500 text-sm mb-4 h-10">{spec.description}</p>

                                {spec.active ? (
                                    <div className="flex items-center text-primary font-medium text-sm">
                                        Voir les docteurs <ArrowRight size={16} className="ml-1" />
                                    </div>
                                ) : (
                                    <div className="flex items-center text-gray-400 text-sm">
                                        Indisponible pour le moment
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    ))}
                </div>

                <div className="mt-12 text-center bg-blue-50 p-8 rounded-2xl border border-blue-100">
                    <h2 className="text-xl font-bold text-blue-900 mb-2">Vous ne trouvez pas votre besoin ?</h2>
                    <p className="text-blue-700 max-w-2xl mx-auto">
                        Nous étendons nos services progressivement. La région de Kinshasa est notre priorité actuelle
                        pour les soins diabétiques. D'autres spécialités arriveront bientôt.
                    </p>
                </div>
            </div>
        </div>
    );
};

export default Specialties;
