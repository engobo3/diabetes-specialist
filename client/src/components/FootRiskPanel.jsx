import { useState, useEffect } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { AlertTriangle, Shield, CheckCircle, Loader2, History, ClipboardList, Info, Camera, X, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import Badge from './ui/Badge';
import Button from './ui/Button';
import Input from './ui/Input';
import { useAuth } from '../context/AuthContext';
import { useLanguage } from '../context/LanguageContext';
import { storage } from '../firebase';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

const T = {
    fr: {
        title: 'Evaluation du Risque Podologique',
        autoFillBanner: 'Pre-rempli depuis la derniere evaluation',
        hba1c: 'HbA1c (%)',
        crp: 'CRP (mg/L)',
        creatinine: 'Creatinine (mg/dL)',
        albumin: 'Albumine (g/dL)',
        esr: 'VS / ESR (mm/h)',
        sodium: 'Sodium (mEq/L)',
        age: 'Age (ans)',
        diabetesDuration: 'Duree diabete (ans)',
        hypertension: 'Hypertension',
        neuropathy: 'Neuropathie',
        pvd: 'Arteriopathie (PVD)',
        woundPhotos: 'Photos de plaie (optionnel)',
        woundDesc: "Ajoutez jusqu'a 3 photos pour une analyse IA de la plaie (Wagner, infection, tissu).",
        addPhoto: 'Ajouter',
        maxImages: 'Maximum 3 images autorisees',
        notAnImage: "n'est pas une image",
        exceeds5MB: 'depasse 5MB',
        uploading: 'Upload des images en cours...',
        analyzing: 'Analyse IA de la plaie en cours...',
        analyzeBtn: 'Analyser le Risque',
        analyzingBtn: 'Analyse en cours...',
        riskLow: 'Faible',
        riskModerate: 'Modere',
        riskHigh: 'Eleve',
        fallbackMode: 'Mode simplifie (regles cliniques)',
        shapTitle: 'Facteurs Contributifs (SHAP)',
        riskFactors: 'Facteurs de Risque',
        shapTooltipRisk: 'risque',
        shapTooltipProtect: 'protecteur',
        shapTooltipImpact: 'Impact',
        shapUnavailable: 'Analyse SHAP disponible avec le modele LightGBM.',
        shapCurrentMode: 'Mode actuel: regles cliniques',
        recommendations: 'Recommandations',
        noRecommendations: 'Aucune recommandation.',
        woundAnalysisTitle: 'Analyse de la Plaie (Vision IA)',
        wagnerLabel: 'Classification Wagner',
        infectionSigns: "Signes d'infection",
        tissue: 'Tissu',
        size: 'Taille',
        healing: 'Guerison',
        urgentConcerns: 'Preoccupations urgentes',
        woundFallback: 'Mode fallback - analyse manuelle recommandee',
        historyTitle: 'Historique des Evaluations',
        hide: 'Masquer',
        show: 'Afficher',
        dateCol: 'Date',
        scoreCol: 'Score',
        levelCol: 'Niveau',
        woundCol: 'Plaie',
        modelCol: 'Modele',
        noHistory: 'Aucune evaluation precedente.',
        loading: 'Chargement...',
        error: 'Erreur',
        featureLabels: {
            hba1c: 'HbA1c', crp: 'CRP (inflammation)', creatinine: 'Creatinine (reins)',
            albumin: 'Albumine (nutrition)', esr: 'VS (sedimentation)', sodium: 'Sodium',
            age: 'Age', diabetes_duration_years: 'Duree diabete',
            has_hypertension: 'Hypertension', has_neuropathy: 'Neuropathie', has_pvd: 'Arteriopathie'
        }
    },
    ln: {
        title: 'Bomeki ya Likama ya Makolo',
        autoFillBanner: 'Etondisami na bomeki ya suka',
        hba1c: 'HbA1c (%)',
        crp: 'CRP (mg/L)',
        creatinine: 'Creatinine (mg/dL)',
        albumin: 'Albumine (g/dL)',
        esr: 'VS / ESR (mm/h)',
        sodium: 'Sodium (mEq/L)',
        age: 'Mibu (mbula)',
        diabetesDuration: 'Ntango ya sukali (mbula)',
        hypertension: 'Tension makasi',
        neuropathy: 'Bokono ya misisa',
        pvd: 'Bokono ya mituka ya makila',
        woundPhotos: 'Bafoto ya pota (soki ezali)',
        woundDesc: 'Bakisa bafoto 3 mpo na bomeki ya IA ya pota (Wagner, bokono, misuni).',
        addPhoto: 'Bakisa',
        maxImages: 'Bafoto 3 kaka nde bakoki',
        notAnImage: 'ezali foto te',
        exceeds5MB: 'eleki 5MB',
        uploading: 'Kotinda bafoto ezali kokende...',
        analyzing: 'Bomeki ya IA ya pota ezali kosalema...',
        analyzeBtn: 'Meka Likama',
        analyzingBtn: 'Bomeki ezali kosalema...',
        riskLow: 'Moke',
        riskModerate: 'Ya kati',
        riskHigh: 'Makasi',
        fallbackMode: 'Lolenge ya pete (mibeko ya minganga)',
        shapTitle: 'Makambo oyo etindaki (SHAP)',
        riskFactors: 'Makambo ya Likama',
        shapTooltipRisk: 'likama',
        shapTooltipProtect: 'bobateli',
        shapTooltipImpact: 'Nguya',
        shapUnavailable: 'Bomeki SHAP ezali na modele LightGBM.',
        shapCurrentMode: 'Lolenge ya sikawa: mibeko ya minganga',
        recommendations: 'Toli',
        noRecommendations: 'Toli ezali te.',
        woundAnalysisTitle: 'Bomeki ya Pota (IA ya Miso)',
        wagnerLabel: 'Bokeli Wagner',
        infectionSigns: 'Bilembo ya bokono',
        tissue: 'Misuni',
        size: 'Bonene',
        healing: 'Kobika',
        urgentConcerns: 'Makambo ya lombangu',
        woundFallback: 'Lolenge ya secours - bomeki na maboko esengami',
        historyTitle: 'Lisolo ya Bomeki',
        hide: 'Bomba',
        show: 'Lakisa',
        dateCol: 'Mokolo',
        scoreCol: 'Mbongo',
        levelCol: 'Ndelo',
        woundCol: 'Pota',
        modelCol: 'Modele',
        noHistory: 'Bomeki ya liboso ezali te.',
        loading: 'Ezali kokota...',
        error: 'Libunga',
        featureLabels: {
            hba1c: 'HbA1c', crp: 'CRP (nzoto epeli)', creatinine: 'Creatinine (bamfigo)',
            albumin: 'Albumine (bilei)', esr: 'VS (sedimentation)', sodium: 'Sodium',
            age: 'Mibu', diabetes_duration_years: 'Ntango ya sukali',
            has_hypertension: 'Tension makasi', has_neuropathy: 'Bokono ya misisa', has_pvd: 'Bokono ya mituka'
        }
    },
    sw: {
        title: 'Tathmini ya Hatari ya Miguu',
        autoFillBanner: 'Imejazwa kutoka tathmini ya mwisho',
        hba1c: 'HbA1c (%)',
        crp: 'CRP (mg/L)',
        creatinine: 'Creatinine (mg/dL)',
        albumin: 'Albumini (g/dL)',
        esr: 'VS / ESR (mm/h)',
        sodium: 'Sodiamu (mEq/L)',
        age: 'Umri (miaka)',
        diabetesDuration: 'Muda wa kisukari (miaka)',
        hypertension: 'Shinikizo la damu',
        neuropathy: 'Ugonjwa wa neva',
        pvd: 'Ugonjwa wa mishipa ya damu',
        woundPhotos: 'Picha za kidonda (hiari)',
        woundDesc: 'Ongeza hadi picha 3 kwa uchambuzi wa AI wa kidonda (Wagner, maambukizi, tishu).',
        addPhoto: 'Ongeza',
        maxImages: 'Picha 3 tu zinaruhusiwa',
        notAnImage: 'si picha',
        exceeds5MB: 'inazidi 5MB',
        uploading: 'Kupakia picha...',
        analyzing: 'Uchambuzi wa AI wa kidonda unaendelea...',
        analyzeBtn: 'Chambua Hatari',
        analyzingBtn: 'Uchambuzi unaendelea...',
        riskLow: 'Ndogo',
        riskModerate: 'Wastani',
        riskHigh: 'Kubwa',
        fallbackMode: 'Hali rahisi (kanuni za kimatibabu)',
        shapTitle: 'Vipengele Vinavyochangia (SHAP)',
        riskFactors: 'Vipengele vya Hatari',
        shapTooltipRisk: 'hatari',
        shapTooltipProtect: 'kinga',
        shapTooltipImpact: 'Athari',
        shapUnavailable: 'Uchambuzi wa SHAP unapatikana na modeli ya LightGBM.',
        shapCurrentMode: 'Hali ya sasa: kanuni za kimatibabu',
        recommendations: 'Mapendekezo',
        noRecommendations: 'Hakuna mapendekezo.',
        woundAnalysisTitle: 'Uchambuzi wa Kidonda (AI ya Macho)',
        wagnerLabel: 'Uainishaji wa Wagner',
        infectionSigns: 'Dalili za maambukizi',
        tissue: 'Tishu',
        size: 'Ukubwa',
        healing: 'Uponyaji',
        urgentConcerns: 'Wasiwasi wa haraka',
        woundFallback: 'Hali ya dharura - tathmini ya mikono inapendekezwa',
        historyTitle: 'Historia ya Tathmini',
        hide: 'Ficha',
        show: 'Onyesha',
        dateCol: 'Tarehe',
        scoreCol: 'Alama',
        levelCol: 'Kiwango',
        woundCol: 'Kidonda',
        modelCol: 'Modeli',
        noHistory: 'Hakuna tathmini ya awali.',
        loading: 'Inapakia...',
        error: 'Kosa',
        featureLabels: {
            hba1c: 'HbA1c', crp: 'CRP (uvimbe)', creatinine: 'Creatinine (figo)',
            albumin: 'Albumini (lishe)', esr: 'VS (kutulia)', sodium: 'Sodiamu',
            age: 'Umri', diabetes_duration_years: 'Muda wa kisukari',
            has_hypertension: 'Shinikizo la damu', has_neuropathy: 'Ugonjwa wa neva', has_pvd: 'Ugonjwa wa mishipa'
        }
    },
    tsh: {
        title: 'Dimeki dia Njiwu wa Makasa',
        autoFillBanner: 'Diuwula ku dimeki dia ndekelu',
        hba1c: 'HbA1c (%)',
        crp: 'CRP (mg/L)',
        creatinine: 'Creatinine (mg/dL)',
        albumin: 'Albumine (g/dL)',
        esr: 'VS / ESR (mm/h)',
        sodium: 'Sodium (mEq/L)',
        age: 'Bidimu (mivu)',
        diabetesDuration: 'Tshikondo tsha maladi a sukali (mivu)',
        hypertension: 'Ntension wa mashi',
        neuropathy: 'Maladi a misisa',
        pvd: 'Maladi a mitshima ya mashi',
        woundPhotos: 'Bifoto bia mputa (bua kusua)',
        woundDesc: 'Bakisa bifoto 3 bua dimeki dia IA dia mputa (Wagner, maladi, misuni).',
        addPhoto: 'Bakisa',
        maxImages: 'Bifoto 3 nkuabu ke',
        notAnImage: 'ki tshifoto to',
        exceeds5MB: 'kupita 5MB',
        uploading: 'Kutuma bifoto...',
        analyzing: 'Dimeki dia IA dia mputa didi dienzeka...',
        analyzeBtn: 'Meka Njiwu',
        analyzingBtn: 'Dimeki didi dienzeka...',
        riskLow: 'Mukese',
        riskModerate: 'Wa pakati',
        riskHigh: 'Munene',
        fallbackMode: 'Mushindu wa patupu (mikenji ya minganga)',
        shapTitle: 'Bintu bivua bitambe (SHAP)',
        riskFactors: 'Bintu bia Njiwu',
        shapTooltipRisk: 'njiwu',
        shapTooltipProtect: 'dilamatu',
        shapTooltipImpact: 'Bukole',
        shapUnavailable: 'Dimeki dia SHAP didi ne modele wa LightGBM.',
        shapCurrentMode: 'Mushindu wa mpindieu: mikenji ya minganga',
        recommendations: 'Mafutu',
        noRecommendations: 'Mafutu kuena to.',
        woundAnalysisTitle: 'Dimeki dia Mputa (IA ya Mesu)',
        wagnerLabel: 'Diyisha dia Wagner',
        infectionSigns: 'Bimanyinu bia maladi',
        tissue: 'Misuni',
        size: 'Bunene',
        healing: 'Kupanda',
        urgentConcerns: 'Makosa a lubilu',
        woundFallback: 'Mushindu wa secours - dimeki ne bianza disungidibua',
        historyTitle: 'Muyuki wa Dimeki',
        hide: 'Shiika',
        show: 'Leja',
        dateCol: 'Dituku',
        scoreCol: 'Mbadi',
        levelCol: 'Muaba',
        woundCol: 'Mputa',
        modelCol: 'Modele',
        noHistory: 'Dimeki dia kumpala diena to.',
        loading: 'Didi dikota...',
        error: 'Tshilema',
        featureLabels: {
            hba1c: 'HbA1c', crp: 'CRP (ditoka)', creatinine: 'Creatinine (mifigo)',
            albumin: 'Albumine (bidia)', esr: 'VS (sedimentation)', sodium: 'Sodium',
            age: 'Bidimu', diabetes_duration_years: 'Tshikondo tsha sukali',
            has_hypertension: 'Ntension wa mashi', has_neuropathy: 'Maladi a misisa', has_pvd: 'Maladi a mitshima'
        }
    },
    kg: {
        title: 'Ntalu ya Nsaku ya Makulu',
        autoFillBanner: 'Yitondisama na ntalu ya nsuka',
        hba1c: 'HbA1c (%)',
        crp: 'CRP (mg/L)',
        creatinine: 'Creatinine (mg/dL)',
        albumin: 'Albumine (g/dL)',
        esr: 'VS / ESR (mm/h)',
        sodium: 'Sodium (mEq/L)',
        age: 'Mvula (bambuta)',
        diabetesDuration: 'Ntangu ya maladi ya sukali (bambuta)',
        hypertension: 'Makasi ma menga',
        neuropathy: 'Maladi ya misisa',
        pvd: 'Maladi ya nzila ya menga',
        woundPhotos: 'Bifoto bya mputa (si ya tina)',
        woundDesc: 'Tula bifoto 3 mpo na ntalu ya IA ya mputa (Wagner, maladi, misuni).',
        addPhoto: 'Tula',
        maxImages: 'Bifoto 3 kaka nde bafweni',
        notAnImage: 'si kifoto ve',
        exceeds5MB: 'yilutidi 5MB',
        uploading: 'Kutindika bifoto...',
        analyzing: 'Ntalu ya IA ya mputa yizali kosalema...',
        analyzeBtn: 'Tala Nsaku',
        analyzingBtn: 'Ntalu yizali kosalema...',
        riskLow: 'Ya fioti',
        riskModerate: 'Ya kati',
        riskHigh: 'Ya nene',
        fallbackMode: 'Nzila ya pete (minsiku ya minganga)',
        shapTitle: 'Mambu matindiki (SHAP)',
        riskFactors: 'Mambu ya Nsaku',
        shapTooltipRisk: 'nsaku',
        shapTooltipProtect: 'kibatudi',
        shapTooltipImpact: 'Ngolo',
        shapUnavailable: 'Ntalu ya SHAP yizali na modele ya LightGBM.',
        shapCurrentMode: 'Nzila ya mpindieu: minsiku ya minganga',
        recommendations: 'Makanisi',
        noRecommendations: 'Makanisi me ve.',
        woundAnalysisTitle: 'Ntalu ya Mputa (IA ya Meso)',
        wagnerLabel: 'Ndongokolo ya Wagner',
        infectionSigns: 'Bimanisu bya maladi',
        tissue: 'Misuni',
        size: 'Bunene',
        healing: 'Kubuka',
        urgentConcerns: 'Mambu ya nswalu',
        woundFallback: 'Nzila ya lusadisu - ntalu na moko yisungama',
        historyTitle: 'Nsangu ya Ntalu',
        hide: 'Sweka',
        show: 'Monisa',
        dateCol: 'Lumbu',
        scoreCol: 'Ntalu',
        levelCol: 'Kanda',
        woundCol: 'Mputa',
        modelCol: 'Modele',
        noHistory: 'Ntalu ya ntete ke ve.',
        loading: 'Yizali kokota...',
        error: 'Foti',
        featureLabels: {
            hba1c: 'HbA1c', crp: 'CRP (nitu yitumuki)', creatinine: 'Creatinine (mfigo)',
            albumin: 'Albumine (bilei)', esr: 'VS (sedimentation)', sodium: 'Sodium',
            age: 'Mvula', diabetes_duration_years: 'Ntangu ya sukali',
            has_hypertension: 'Makasi ma menga', has_neuropathy: 'Maladi ya misisa', has_pvd: 'Maladi ya nzila'
        }
    }
};

const getRiskColor = (level) => {
    switch (level) {
        case 'low': return '#10B981';
        case 'moderate': return '#F59E0B';
        case 'high': return '#EF4444';
        default: return '#6B7280';
    }
};

const getRiskIcon = (level) => {
    switch (level) {
        case 'low': return <CheckCircle className="text-green-500" size={24} />;
        case 'moderate': return <AlertTriangle className="text-amber-500" size={24} />;
        case 'high': return <AlertTriangle className="text-red-500" size={24} />;
        default: return <Shield className="text-gray-400" size={24} />;
    }
};

const FootRiskPanel = ({ patientId, patient }) => {
    const { currentUser } = useAuth();
    const { lang } = useLanguage();
    const t = T[lang] || T.fr;
    const [result, setResult] = useState(null);
    const [loading, setLoading] = useState(false);
    const [history, setHistory] = useState([]);
    const [historyLoading, setHistoryLoading] = useState(true);
    const [showHistory, setShowHistory] = useState(false);
    const [autoFilled, setAutoFilled] = useState(false);

    // Wound image state
    const [woundImages, setWoundImages] = useState([]);
    const [woundPreviews, setWoundPreviews] = useState([]);
    const [woundAnalysis, setWoundAnalysis] = useState(null);
    const [analyzingWound, setAnalyzingWound] = useState(false);
    const [uploadingImages, setUploadingImages] = useState(false);

    const [formData, setFormData] = useState({
        hba1c: '',
        crp: '',
        creatinine: '',
        albumin: '',
        esr: '',
        sodium: '',
        age: patient?.age || '',
        diabetes_duration_years: '',
        has_hypertension: false,
        has_neuropathy: false,
        has_pvd: false,
    });

    useEffect(() => {
        fetchHistory();
    }, [patientId]);

    // Auto-fill from most recent assessment
    useEffect(() => {
        if (history.length > 0 && history[0].input) {
            const lastInput = history[0].input;
            setFormData(prev => ({
                ...prev,
                hba1c: lastInput.hba1c ?? prev.hba1c,
                crp: lastInput.crp ?? prev.crp,
                creatinine: lastInput.creatinine ?? prev.creatinine,
                albumin: lastInput.albumin ?? prev.albumin,
                esr: lastInput.esr ?? prev.esr,
                sodium: lastInput.sodium ?? prev.sodium,
                age: patient?.age || lastInput.age || prev.age,
                diabetes_duration_years: lastInput.diabetes_duration_years ?? prev.diabetes_duration_years,
                has_hypertension: lastInput.has_hypertension ?? prev.has_hypertension,
                has_neuropathy: lastInput.has_neuropathy ?? prev.has_neuropathy,
                has_pvd: lastInput.has_pvd ?? prev.has_pvd,
            }));
            setAutoFilled(true);
        }
    }, [history]);

    // Compute diabetes duration from patient diagnosisDate
    useEffect(() => {
        if (patient?.diagnosisDate && !formData.diabetes_duration_years) {
            const diagDate = new Date(patient.diagnosisDate);
            const now = new Date();
            const years = Math.floor((now - diagDate) / (365.25 * 24 * 60 * 60 * 1000));
            if (years >= 0) {
                setFormData(prev => ({
                    ...prev,
                    diabetes_duration_years: prev.diabetes_duration_years || years
                }));
            }
        }
    }, [patient]);

    const fetchHistory = async () => {
        if (!currentUser || !patientId) return;
        setHistoryLoading(true);
        try {
            const token = await currentUser.getIdToken();
            const apiUrl = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${apiUrl}/api/foot-risk/history/${patientId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                setHistory(data);
                if (data.length > 0 && !result) {
                    setResult(data[0]);
                    if (data[0].woundAnalysis) {
                        setWoundAnalysis(data[0].woundAnalysis);
                    }
                }
            }
        } catch (err) {
            console.error('Error fetching foot risk history:', err);
        } finally {
            setHistoryLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: type === 'checkbox' ? checked : value
        }));
    };

    // --- Wound image handlers ---
    const handleImageSelect = (e) => {
        const files = Array.from(e.target.files);
        if (woundImages.length + files.length > 3) {
            alert(t.maxImages);
            return;
        }

        const valid = files.filter(f => {
            if (!f.type.startsWith('image/')) { alert(`${f.name} ${t.notAnImage}`); return false; }
            if (f.size > 5 * 1024 * 1024) { alert(`${f.name} ${t.exceeds5MB}`); return false; }
            return true;
        });

        setWoundImages(prev => [...prev, ...valid]);

        valid.forEach(file => {
            const reader = new FileReader();
            reader.onload = (ev) => {
                setWoundPreviews(prev => [...prev, { name: file.name, url: ev.target.result }]);
            };
            reader.readAsDataURL(file);
        });
    };

    const handleRemoveImage = (index) => {
        setWoundImages(prev => prev.filter((_, i) => i !== index));
        setWoundPreviews(prev => prev.filter((_, i) => i !== index));
    };

    const uploadWoundImages = async () => {
        if (woundImages.length === 0) return [];
        setUploadingImages(true);
        try {
            const urls = await Promise.all(
                woundImages.map(async (file) => {
                    const storageRef = ref(storage, `patients/${patientId}/foot-images/${Date.now()}_${file.name}`);
                    const snapshot = await uploadBytes(storageRef, file);
                    const downloadURL = await getDownloadURL(snapshot.ref);
                    return {
                        url: downloadURL,
                        filename: file.name,
                        uploadedAt: new Date().toISOString()
                    };
                })
            );
            return urls;
        } finally {
            setUploadingImages(false);
        }
    };

    const analyzeWoundWithAI = async (imageUrls) => {
        if (imageUrls.length === 0) return null;
        setAnalyzingWound(true);
        try {
            const token = await currentUser.getIdToken();
            const apiUrl = import.meta.env.VITE_API_URL || '';
            const res = await fetch(`${apiUrl}/api/foot-risk/analyze-wound/${patientId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    imageUrls: imageUrls.map(img => img.url),
                    lang,
                    patientContext: {
                        age: formData.age,
                        diabetesType: patient?.type || '',
                        riskScore: result?.risk_score || null
                    }
                })
            });
            if (!res.ok) throw new Error('Wound analysis failed');
            const analysis = await res.json();
            setWoundAnalysis(analysis);
            return analysis;
        } catch (err) {
            console.error('Wound analysis error:', err);
            return null;
        } finally {
            setAnalyzingWound(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!currentUser || !patientId) return;
        setLoading(true);

        try {
            // Step 1: Upload wound images to Firebase Storage
            const uploadedImages = await uploadWoundImages();

            // Step 2: Analyze wound images with Gemini Vision
            let analysis = null;
            if (uploadedImages.length > 0) {
                analysis = await analyzeWoundWithAI(uploadedImages);
            }

            // Step 3: Submit biomarker prediction with wound data
            const token = await currentUser.getIdToken();
            const apiUrl = import.meta.env.VITE_API_URL || '';
            const response = await fetch(`${apiUrl}/api/foot-risk/predict/${patientId}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    ...formData,
                    diabetes_type: patient?.type || '',
                    lang,
                    woundImages: uploadedImages,
                    woundAnalysis: analysis
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || 'Prediction failed');
            }

            const data = await response.json();
            setResult(data);

            // Clear wound images after successful submission
            setWoundImages([]);
            setWoundPreviews([]);

            fetchHistory();
        } catch (err) {
            console.error('Prediction error:', err);
            alert(`${t.error}: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    // Prepare SHAP chart data
    const shapData = result?.shap_values
        ? Object.entries(result.shap_values)
            .map(([feature, value]) => ({
                feature: t.featureLabels[feature] || feature,
                value: parseFloat(value.toFixed(3)),
                fill: value > 0 ? '#EF4444' : '#10B981'
            }))
            .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
        : [];

    const activeWoundAnalysis = result?.woundAnalysis || woundAnalysis;

    return (
        <div className="space-y-6">
            {/* Biomarker Input Form */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                        <ClipboardList size={18} className="text-primary" />
                        {t.title}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    {autoFilled && history.length > 0 && (
                        <div className="flex items-center gap-2 text-xs text-blue-600 bg-blue-50 px-3 py-2 rounded-md mb-3">
                            <Info size={14} />
                            <span>{t.autoFillBanner}
                                ({history[0]?.assessedAt ? new Date(history[0].assessedAt).toLocaleDateString() : ''})</span>
                        </div>
                    )}
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t.hba1c}</label>
                                <Input type="number" name="hba1c" value={formData.hba1c} onChange={handleChange} required min="3" max="20" step="0.1" placeholder="ex: 7.5" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t.crp}</label>
                                <Input type="number" name="crp" value={formData.crp} onChange={handleChange} required min="0" max="200" step="0.1" placeholder="ex: 3.2" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t.creatinine}</label>
                                <Input type="number" name="creatinine" value={formData.creatinine} onChange={handleChange} required min="0" max="30" step="0.1" placeholder="ex: 1.2" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t.albumin}</label>
                                <Input type="number" name="albumin" value={formData.albumin} onChange={handleChange} required min="0" max="10" step="0.1" placeholder="ex: 3.8" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t.esr}</label>
                                <Input type="number" name="esr" value={formData.esr} onChange={handleChange} required min="0" max="200" step="1" placeholder="ex: 15" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t.sodium}</label>
                                <Input type="number" name="sodium" value={formData.sodium} onChange={handleChange} required min="100" max="200" step="1" placeholder="ex: 140" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t.age}</label>
                                <Input type="number" name="age" value={formData.age} onChange={handleChange} required min="0" max="150" step="1" placeholder="ex: 55" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">{t.diabetesDuration}</label>
                                <Input type="number" name="diabetes_duration_years" value={formData.diabetes_duration_years} onChange={handleChange} required min="0" max="100" step="1" placeholder="ex: 10" />
                            </div>
                        </div>

                        {/* Boolean toggles */}
                        <div className="flex flex-wrap gap-4">
                            {[
                                { name: 'has_hypertension', label: t.hypertension },
                                { name: 'has_neuropathy', label: t.neuropathy },
                                { name: 'has_pvd', label: t.pvd },
                            ].map(({ name, label }) => (
                                <label key={name} className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        name={name}
                                        checked={formData[name]}
                                        onChange={handleChange}
                                        className="rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <span className="text-sm text-gray-700">{label}</span>
                                </label>
                            ))}
                        </div>

                        {/* Wound Image Upload Section */}
                        <div className="border-t border-gray-200 pt-4 mt-2">
                            <h4 className="text-sm font-semibold text-gray-700 flex items-center gap-2 mb-2">
                                <Camera size={16} className="text-primary" />
                                {t.woundPhotos}
                            </h4>
                            <p className="text-xs text-gray-500 mb-3">
                                {t.woundDesc}
                            </p>

                            <div className="flex flex-wrap gap-3 mb-3">
                                {woundPreviews.map((preview, idx) => (
                                    <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden border border-gray-300 group">
                                        <img src={preview.url} alt={preview.name} className="w-full h-full object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveImage(idx)}
                                            className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                                        >
                                            <X size={12} />
                                        </button>
                                    </div>
                                ))}

                                {woundImages.length < 3 && (
                                    <label className="w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-blue-50 transition-colors">
                                        <Camera size={20} className="text-gray-400 mb-1" />
                                        <span className="text-xs text-gray-400">{t.addPhoto}</span>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            capture="environment"
                                            className="hidden"
                                            onChange={handleImageSelect}
                                            multiple
                                        />
                                    </label>
                                )}
                            </div>

                            {uploadingImages && (
                                <div className="flex items-center gap-2 text-xs text-blue-600">
                                    <Loader2 size={14} className="animate-spin" />
                                    {t.uploading}
                                </div>
                            )}
                            {analyzingWound && (
                                <div className="flex items-center gap-2 text-xs text-indigo-600">
                                    <Loader2 size={14} className="animate-spin" />
                                    {t.analyzing}
                                </div>
                            )}
                        </div>

                        <Button type="submit" className="w-full sm:w-auto" disabled={loading || uploadingImages || analyzingWound}>
                            {loading ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 size={16} className="animate-spin" /> {t.analyzingBtn}
                                </span>
                            ) : (
                                t.analyzeBtn
                            )}
                        </Button>
                    </form>
                </CardContent>
            </Card>

            {/* Results */}
            {result && (
                <>
                    {/* Risk Score Display */}
                    <Card className="border-l-4" style={{ borderLeftColor: getRiskColor(result.risk_level) }}>
                        <CardContent className="py-5">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                                <div className="flex items-center gap-4">
                                    {getRiskIcon(result.risk_level)}
                                    <div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-4xl font-bold" style={{ color: getRiskColor(result.risk_level) }}>
                                                {result.risk_score}
                                            </span>
                                            <span className="text-gray-400 text-lg">/100</span>
                                        </div>
                                        <div className="text-sm font-medium text-gray-600 mt-1">{result.risk_label}</div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-start sm:items-end gap-1">
                                    <Badge variant={result.risk_level === 'low' ? 'success' : result.risk_level === 'moderate' ? 'warning' : 'danger'}>
                                        {result.risk_label}
                                    </Badge>
                                    {result.fallback && (
                                        <span className="text-xs text-gray-400 flex items-center gap-1">
                                            <Info size={12} /> {t.fallbackMode}
                                        </span>
                                    )}
                                    <span className="text-xs text-gray-400">{result.model_version}</span>
                                </div>
                            </div>

                            {/* Risk bar */}
                            <div className="mt-4">
                                <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden">
                                    <div
                                        className="h-full rounded-full transition-all duration-700"
                                        style={{
                                            width: `${result.risk_score}%`,
                                            backgroundColor: getRiskColor(result.risk_level)
                                        }}
                                    />
                                </div>
                                <div className="flex justify-between text-xs text-gray-400 mt-1">
                                    <span>{t.riskLow}</span>
                                    <span>{t.riskModerate}</span>
                                    <span>{t.riskHigh}</span>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Wound Analysis Results */}
                    {activeWoundAnalysis && (
                        <Card className="border-l-4 border-l-indigo-500">
                            <CardHeader>
                                <CardTitle className="text-sm flex items-center gap-2">
                                    <Eye size={16} className="text-indigo-500" />
                                    {t.woundAnalysisTitle}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-3">
                                    {/* Wagner Grade */}
                                    <div className="flex items-center justify-between">
                                        <span className="text-sm font-medium text-gray-600">{t.wagnerLabel}</span>
                                        <Badge variant={
                                            activeWoundAnalysis.wagnerGrade === null ? 'default' :
                                            activeWoundAnalysis.wagnerGrade <= 1 ? 'success' :
                                            activeWoundAnalysis.wagnerGrade <= 3 ? 'warning' : 'danger'
                                        }>
                                            Grade {activeWoundAnalysis.wagnerGrade ?? '?'}
                                        </Badge>
                                    </div>
                                    <p className="text-sm text-gray-700">{activeWoundAnalysis.wagnerDescription}</p>

                                    {/* Infection Signs */}
                                    {activeWoundAnalysis.infectionSigns?.length > 0 && (
                                        <div>
                                            <span className="text-xs font-semibold text-red-600 uppercase">{t.infectionSigns}</span>
                                            <ul className="mt-1 space-y-1">
                                                {activeWoundAnalysis.infectionSigns.map((sign, i) => (
                                                    <li key={i} className="text-sm text-red-700 flex items-center gap-2">
                                                        <AlertTriangle size={12} /> {sign}
                                                    </li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Tissue & Size */}
                                    <div className="grid grid-cols-2 gap-3 text-sm">
                                        <div><span className="text-gray-500">{t.tissue}: </span><span className="font-medium">{activeWoundAnalysis.tissueType}</span></div>
                                        <div><span className="text-gray-500">{t.size}: </span><span className="font-medium">{activeWoundAnalysis.estimatedSize}</span></div>
                                    </div>

                                    {/* Healing Assessment */}
                                    <div className="text-sm">
                                        <span className="text-gray-500">{t.healing}: </span>
                                        <span className="font-medium">{activeWoundAnalysis.healingAssessment}</span>
                                    </div>

                                    {/* Urgent Concerns */}
                                    {activeWoundAnalysis.urgentConcerns?.length > 0 && !activeWoundAnalysis.fallback && (
                                        <div className="bg-red-50 border border-red-200 rounded-md p-3">
                                            <span className="text-xs font-bold text-red-700 uppercase">{t.urgentConcerns}</span>
                                            <ul className="mt-1 space-y-1">
                                                {activeWoundAnalysis.urgentConcerns.map((concern, i) => (
                                                    <li key={i} className="text-sm text-red-700">{concern}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}

                                    {/* Summary */}
                                    <p className="text-sm text-gray-700 italic border-t pt-2">{activeWoundAnalysis.overallSummary}</p>

                                    {activeWoundAnalysis.fallback && (
                                        <p className="text-xs text-gray-400 flex items-center gap-1">
                                            <Info size={12} /> {t.woundFallback}
                                        </p>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* SHAP Chart */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">
                                    {shapData.length > 0 ? t.shapTitle : t.riskFactors}
                                </CardTitle>
                            </CardHeader>
                            <CardContent>
                                {shapData.length > 0 ? (
                                    <ResponsiveContainer width="100%" height={280}>
                                        <BarChart data={shapData} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" />
                                            <XAxis type="number" />
                                            <YAxis dataKey="feature" type="category" width={130} tick={{ fontSize: 11 }} />
                                            <Tooltip formatter={(value) => [value > 0 ? `+${value} (${t.shapTooltipRisk})` : `${value} (${t.shapTooltipProtect})`, t.shapTooltipImpact]} />
                                            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                                                {shapData.map((entry, i) => (
                                                    <Cell key={i} fill={entry.fill} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                ) : (
                                    <div className="h-[280px] flex items-center justify-center text-sm text-gray-400 italic">
                                        <div className="text-center">
                                            <Info size={24} className="mx-auto mb-2 text-gray-300" />
                                            <p>{t.shapUnavailable}</p>
                                            <p className="text-xs mt-1">{t.shapCurrentMode}</p>
                                        </div>
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        {/* Recommendations */}
                        <Card>
                            <CardHeader>
                                <CardTitle className="text-sm">{t.recommendations}</CardTitle>
                            </CardHeader>
                            <CardContent>
                                {result.recommendations && result.recommendations.length > 0 ? (
                                    <ul className="space-y-2">
                                        {result.recommendations.map((rec, i) => (
                                            <li key={i} className="flex items-start gap-2 text-sm">
                                                <span className="mt-1 w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: getRiskColor(result.risk_level) }} />
                                                <span className="text-gray-700">{rec}</span>
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    <p className="text-sm text-gray-400 italic">{t.noRecommendations}</p>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}

            {/* History */}
            <Card>
                <CardHeader>
                    <CardTitle className="text-sm flex items-center justify-between">
                        <span className="flex items-center gap-2">
                            <History size={16} /> {t.historyTitle}
                        </span>
                        {history.length > 0 && (
                            <button
                                onClick={() => setShowHistory(!showHistory)}
                                className="text-xs text-primary hover:underline font-normal"
                            >
                                {showHistory ? t.hide : `${t.show} (${history.length})`}
                            </button>
                        )}
                    </CardTitle>
                </CardHeader>
                {(showHistory || history.length <= 3) && (
                    <CardContent>
                        {historyLoading ? (
                            <div className="flex items-center gap-2 text-sm text-gray-400">
                                <Loader2 size={14} className="animate-spin" /> {t.loading}
                            </div>
                        ) : history.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200">
                                            <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase">{t.dateCol}</th>
                                            <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase">{t.scoreCol}</th>
                                            <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase">{t.levelCol}</th>
                                            <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase">{t.woundCol}</th>
                                            <th className="text-left py-2 px-2 text-xs font-semibold text-gray-500 uppercase">{t.modelCol}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {history.map((h) => (
                                            <tr key={h.id} className="border-b border-gray-100 hover:bg-gray-50">
                                                <td className="py-2 px-2 text-gray-600">
                                                    {h.assessedAt ? new Date(h.assessedAt).toLocaleDateString('fr-FR') : '-'}
                                                </td>
                                                <td className="py-2 px-2 font-medium" style={{ color: getRiskColor(h.risk_level) }}>
                                                    {h.risk_score}/100
                                                </td>
                                                <td className="py-2 px-2">
                                                    <Badge variant={h.risk_level === 'low' ? 'success' : h.risk_level === 'moderate' ? 'warning' : 'danger'}>
                                                        {h.risk_label}
                                                    </Badge>
                                                </td>
                                                <td className="py-2 px-2">
                                                    {h.woundImages?.length > 0 ? (
                                                        <span className="text-indigo-500" title={`${h.woundImages.length} photo(s) - Wagner ${h.woundAnalysis?.wagnerGrade ?? '?'}`}>
                                                            <Camera size={14} />
                                                        </span>
                                                    ) : (
                                                        <span className="text-gray-300">-</span>
                                                    )}
                                                </td>
                                                <td className="py-2 px-2 text-xs text-gray-400">{h.model_version}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="text-sm text-gray-400 italic">{t.noHistory}</p>
                        )}
                    </CardContent>
                )}
            </Card>
        </div>
    );
};

export default FootRiskPanel;
