const axios = require('axios');
const { db } = require('../config/firebaseConfig');

const CLOUD_RUN_URL = process.env.FOOT_RISK_SERVICE_URL;

// --- Multilingual translations for recommendations and risk labels ---
const RISK_LABELS = {
    fr: { low: 'Risque Faible', moderate: 'Risque Modere', high: 'Risque Eleve' },
    ln: { low: 'Likama moke', moderate: 'Likama ya kati', high: 'Likama makasi' },
    sw: { low: 'Hatari ndogo', moderate: 'Hatari ya wastani', high: 'Hatari kubwa' },
    tsh: { low: 'Mpata wa panshi', moderate: 'Mpata wa pakati', high: 'Mpata wa muulu' },
    kg: { low: 'Nsaku ya fioti', moderate: 'Nsaku ya kati', high: 'Nsaku ya nene' },
};

const RECS = {
    fr: {
        urgentPodo: 'Consultation podologique urgente recommandee',
        footExam: 'Examen des pieds a chaque consultation',
        hba1c: 'Controle HbA1c a intensifier (objectif < 7%)',
        crp: 'Surveillance CRP - inflammation detectee',
        kidney: 'Evaluation de la fonction renale recommandee',
        nutrition: 'Evaluation nutritionnelle recommandee (albumine basse)',
        esr: 'VS elevee - rechercher une infection ou inflammation',
        neuropathy: 'Neuropathie detectee - chaussures therapeutiques recommandees',
        pvd: 'Arteriopathie - echo-Doppler arteriel recommande',
        hygiene: 'Hygiene des pieds quotidienne et chaussures adaptees',
    },
    ln: {
        urgentPodo: 'Kokende na monganga ya makolo na lombangu esengami',
        footExam: 'Kotala makolo na consultation nionso',
        hba1c: 'Boyekoli HbA1c esengeli koleka makasi (mokano < 7%)',
        crp: 'Kolandela CRP - nzoto epeli emonani',
        kidney: 'Bomeki ya bamfigo esengami',
        nutrition: 'Bomeki ya bilei esengami (albumine ekiti)',
        esr: 'VS etomboki - koluka bokono to nzoto epeli',
        neuropathy: 'Bokono ya misisa emonani - sapato ya minganga esengami',
        pvd: 'Bokono ya mituka ya makila - echo-Doppler esengami',
        hygiene: 'Bopeto ya makolo mokolo na mokolo mpe sapato ya malamu',
    },
    sw: {
        urgentPodo: 'Mashauriano ya haraka ya daktari wa miguu yanapendekezwa',
        footExam: 'Uchunguzi wa miguu kila kliniki',
        hba1c: 'Udhibiti wa HbA1c uimarishwe (lengo < 7%)',
        crp: 'Ufuatiliaji wa CRP - uvimbe umegunduliwa',
        kidney: 'Tathmini ya figo inapendekezwa',
        nutrition: 'Tathmini ya lishe inapendekezwa (albumini iko chini)',
        esr: 'VS imepanda - tafuta maambukizi au uvimbe',
        neuropathy: 'Ugonjwa wa neva umegunduliwa - viatu vya matibabu vinapendekezwa',
        pvd: 'Ugonjwa wa mishipa - echo-Doppler inapendekezwa',
        hygiene: 'Usafi wa miguu kila siku na viatu vinavyofaa',
    },
    tsh: {
        urgentPodo: 'Kuya kwa muganga wa makasa mu lubilu kusungidibua',
        footExam: 'Kutala makasa ku dimeki dionso',
        hba1c: 'Dimeki dia HbA1c difwane kukoleshiba (tshisumi < 7%)',
        crp: 'Kulama CRP - ditoka dia mubidi dimoneka',
        kidney: 'Dimeki dia mifigo disungidibua',
        nutrition: 'Dimeki dia bidia disungidibua (albumine idi panshi)',
        esr: 'VS ipite - kukeba maladi anyi ditoka',
        neuropathy: 'Maladi a misisa amoneka - bisabatu bia minganga bisungidibua',
        pvd: 'Maladi a mitshima ya mashi - echo-Doppler yisungidibua',
        hygiene: 'Bupupu bua makasa dituku ne dituku ne bisabatu bimpe',
    },
    kg: {
        urgentPodo: 'Kwenda na nganga ya makulu na nswalu yitumama',
        footExam: 'Kutala makulu na kimeki yonso',
        hba1c: 'Kimeki ya HbA1c yifweni kukindama (nsuka < 7%)',
        crp: 'Kulanda CRP - nitu yitumuki yimonika',
        kidney: 'Kimeki ya mfigo yitumama',
        nutrition: 'Kimeki ya bilei yitumama (albumine yikitidi)',
        esr: 'VS yimatidi - sosa maladi to nitu yitumuki',
        neuropathy: 'Maladi ya misisa yimonika - bisabatu bya banganga bitumama',
        pvd: 'Maladi ya nzila ya menga - echo-Doppler yitumama',
        hygiene: 'Bupeto bwa makulu lumbu na lumbu ye bisabatu bya mbote',
    },
};

/**
 * Predict diabetic foot risk. Tries Cloud Run service first, falls back to local rule-based scoring.
 * @param {object} biomarkers - patient biomarker data
 * @param {string} lang - language code (fr, ln, sw, tsh, kg)
 */
const predict = async (biomarkers, lang = 'fr') => {
    // Try Cloud Run service if URL is configured
    if (CLOUD_RUN_URL) {
        try {
            const response = await axios.post(`${CLOUD_RUN_URL}/predict`, { ...biomarkers, lang }, {
                timeout: 10000,
                headers: { 'Content-Type': 'application/json' }
            });
            return response.data;
        } catch (error) {
            console.warn('Cloud Run foot risk service failed, using fallback:', error.message);
        }
    }

    // Fallback: local rule-based scoring
    return ruleBasedFallback(biomarkers, lang);
};

/**
 * Local rule-based scoring (mirrors ml-service/scoring/rule_based.py)
 */
function ruleBasedFallback(data, lang = 'fr') {
    let score = 0;

    // HbA1c (max 20)
    const hba1c = parseFloat(data.hba1c) || 5;
    if (hba1c >= 9.0) score += 20;
    else if (hba1c >= 7.5) score += 14;
    else if (hba1c >= 6.5) score += 8;
    else score += 2;

    // CRP (max 15)
    const crp = parseFloat(data.crp) || 0;
    if (crp >= 10) score += 15;
    else if (crp >= 3) score += 10;
    else if (crp >= 1) score += 5;

    // Creatinine (max 15)
    const creatinine = parseFloat(data.creatinine) || 0.8;
    if (creatinine >= 2.0) score += 15;
    else if (creatinine >= 1.3) score += 10;
    else if (creatinine >= 1.0) score += 5;

    // Diabetes duration (max 15)
    const duration = parseFloat(data.diabetes_duration_years) || 0;
    if (duration >= 20) score += 15;
    else if (duration >= 10) score += 10;
    else if (duration >= 5) score += 5;

    // Albumin (max 10) - low = worse
    const albumin = parseFloat(data.albumin) || 4;
    if (albumin < 2.5) score += 10;
    else if (albumin < 3.5) score += 6;
    else score += 1;

    // ESR (max 10)
    const esr = parseFloat(data.esr) || 10;
    if (esr >= 40) score += 10;
    else if (esr >= 20) score += 6;
    else score += 1;

    // Age (max 10)
    const age = parseFloat(data.age) || 30;
    if (age >= 70) score += 10;
    else if (age >= 60) score += 7;
    else if (age >= 50) score += 4;

    // Sodium (max 5)
    const sodium = parseFloat(data.sodium) || 140;
    if (sodium < 130) score += 5;
    else if (sodium < 135) score += 3;

    // Boolean risk factors
    if (data.has_neuropathy) score += 5;
    if (data.has_pvd) score += 5;
    if (data.has_hypertension) score += 3;

    score = Math.min(Math.max(Math.round(score), 0), 100);

    const labels = RISK_LABELS[lang] || RISK_LABELS.fr;
    const r = RECS[lang] || RECS.fr;

    let risk_level;
    if (score <= 30) risk_level = 'low';
    else if (score <= 60) risk_level = 'moderate';
    else risk_level = 'high';
    const risk_label = labels[risk_level];

    const recommendations = [];
    if (score > 60) recommendations.push(r.urgentPodo);
    if (score > 30) recommendations.push(r.footExam);
    if (hba1c >= 7.5) recommendations.push(r.hba1c);
    if (crp >= 3) recommendations.push(r.crp);
    if (creatinine >= 1.3) recommendations.push(r.kidney);
    if (albumin < 3.5) recommendations.push(r.nutrition);
    if (esr >= 20) recommendations.push(r.esr);
    if (data.has_neuropathy) recommendations.push(r.neuropathy);
    if (data.has_pvd) recommendations.push(r.pvd);
    recommendations.push(r.hygiene);

    return {
        risk_score: score,
        risk_level,
        risk_label,
        shap_values: null,
        recommendations,
        model_version: 'rule_based_fallback_v1',
        fallback: true
    };
}

/**
 * Save assessment to Firestore subcollection
 */
const saveAssessment = async (patientId, assessment) => {
    if (!db) return;
    try {
        await db.collection('patients').doc(String(patientId))
            .collection('footRiskAssessments').add(assessment);
    } catch (error) {
        console.error('Error saving foot risk assessment:', error);
    }
};

/**
 * Get assessment history from Firestore
 */
const getAssessmentHistory = async (patientId) => {
    if (!db) return [];
    try {
        const snapshot = await db.collection('patients').doc(String(patientId))
            .collection('footRiskAssessments')
            .orderBy('assessedAt', 'desc')
            .limit(20)
            .get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('Error fetching foot risk history:', error);
        return [];
    }
};

// Language names for Gemini prompt
const LANG_NAMES = {
    fr: 'francais', ln: 'lingala', sw: 'kiswahili', tsh: 'tshiluba', kg: 'kikongo'
};

// Fallback strings for wound analysis when Gemini fails
const WOUND_FALLBACK = {
    fr: {
        desc: 'Analyse automatique non disponible - evaluation manuelle requise',
        notDetermined: 'Non determine',
        manualNeeded: 'Evaluation manuelle necessaire',
        aiUnavailable: 'Analyse IA indisponible - veuillez evaluer manuellement',
        summary: "L'analyse automatique n'a pas pu etre effectuee. Veuillez proceder a une evaluation visuelle manuelle de la plaie.",
    },
    ln: {
        desc: 'Bomeki na masini ekoki te - bomeki na maboko esengami',
        notDetermined: 'Eyebani te',
        manualNeeded: 'Bomeki na maboko esengami',
        aiUnavailable: 'IA ekoki te - bosala bomeki na maboko',
        summary: 'Bomeki na masini ekokaki te. Bosala bomeki ya pota na miso na bino moko.',
    },
    sw: {
        desc: 'Uchambuzi wa kiotomatiki haupatikani - tathmini ya mikono inahitajika',
        notDetermined: 'Haijulikani',
        manualNeeded: 'Tathmini ya mikono inahitajika',
        aiUnavailable: 'AI haipatikani - tafadhali tathmini kwa mikono',
        summary: 'Uchambuzi wa kiotomatiki haukuweza kufanywa. Tafadhali fanya tathmini ya kidonda kwa macho.',
    },
    tsh: {
        desc: 'Dimeki ne mashini kadiyi mua kuenzeka - dimeki ne bianza disungidibua',
        notDetermined: 'Kadiyi dimanye',
        manualNeeded: 'Dimeki ne bianza disungidibua',
        aiUnavailable: 'IA kayiyi mua mudimu - nuenu enzai dimeki ne bianza',
        summary: 'Dimeki ne mashini kadivua mua kuenzeka. Enzai dimeki dia mputa ne mesu enu.',
    },
    kg: {
        desc: 'Kimeki na masini kilendi kosalema ve - kimeki na moko yitumama',
        notDetermined: 'Kizayikana ve',
        manualNeeded: 'Kimeki na moko yitumama',
        aiUnavailable: 'IA yilendi ve - sala kimeki na moko',
        summary: 'Kimeki na masini kilendi kosalema ve. Sala kimeki ya mputa na meso na nge mosi.',
    },
};

/**
 * Analyze wound images using Gemini Vision AI
 * @param {string[]} imageUrls
 * @param {object} patientContext
 * @param {string} lang - language code
 */
const analyzeWoundImages = async (imageUrls, patientContext = {}, lang = 'fr') => {
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const langName = LANG_NAMES[lang] || 'francais';
    const fb = WOUND_FALLBACK[lang] || WOUND_FALLBACK.fr;

    try {
        const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || 'dummy_key');
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

        // Fetch images and convert to base64
        const imageParts = await Promise.all(
            imageUrls.map(async (url) => {
                const response = await axios.get(url, { responseType: 'arraybuffer' });
                const base64 = Buffer.from(response.data).toString('base64');
                const mimeType = response.headers['content-type'] || 'image/jpeg';
                return { inlineData: { data: base64, mimeType } };
            })
        );

        const prompt = `You are an expert dermatologist and diabetologist specialized in diabetic foot wounds.
Analyze this/these diabetic foot/wound image(s) and provide a structured assessment.
IMPORTANT: All text fields in your response MUST be written in ${langName}.

Patient context: Age ${patientContext.age || 'unknown'}, Diabetes ${patientContext.diabetesType || 'Type 2'}, Foot risk score: ${patientContext.riskScore || 'N/A'}/100.

Analyze:
1. Wagner Classification (grade 0-5):
   - Grade 0: At-risk foot, no open wound
   - Grade 1: Superficial ulcer
   - Grade 2: Deep ulcer (tendons, bone)
   - Grade 3: Abscess, osteomyelitis
   - Grade 4: Localized gangrene
   - Grade 5: Extensive gangrene

2. Infection signs (erythema, warmth, exudate, apparent odor)
3. Tissue type (granulation, necrotic, fibrinous/slough, mixed)
4. Estimated wound size
5. Healing assessment (good/moderate/poor progression)
6. Urgent concerns requiring immediate action

IMPORTANT: Respond STRICTLY in valid JSON without markdown formatting.
{
    "wagnerGrade": number,
    "wagnerDescription": "string in ${langName}",
    "infectionSigns": ["sign1 in ${langName}", "sign2 in ${langName}"],
    "tissueType": "string in ${langName}",
    "estimatedSize": "string (e.g. 2.5cm x 1.8cm)",
    "healingAssessment": "string in ${langName}",
    "urgentConcerns": ["concern in ${langName}"] or [],
    "overallSummary": "2-3 sentence summary in ${langName}",
    "confidence": "high|medium|low"
}`;

        const result = await model.generateContent([prompt, ...imageParts]);
        const response = await result.response;
        let text = response.text();
        text = text.replace(/```json/g, '').replace(/```/g, '').trim();

        const analysis = JSON.parse(text);
        analysis.analyzedAt = new Date().toISOString();
        analysis.model = 'gemini-1.5-flash';
        return analysis;
    } catch (aiError) {
        console.warn('Gemini Vision analysis failed, using fallback:', aiError.message);
        return {
            wagnerGrade: null,
            wagnerDescription: fb.desc,
            infectionSigns: [],
            tissueType: fb.notDetermined,
            estimatedSize: fb.notDetermined,
            healingAssessment: fb.manualNeeded,
            urgentConcerns: [fb.aiUnavailable],
            overallSummary: fb.summary,
            confidence: 'none',
            analyzedAt: new Date().toISOString(),
            model: 'fallback',
            fallback: true
        };
    }
};

module.exports = { predict, saveAssessment, getAssessmentHistory, analyzeWoundImages };
