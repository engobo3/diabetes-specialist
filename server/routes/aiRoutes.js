const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const verifyToken = require('../middleware/authMiddleware');

// Auth on all AI routes
router.use(verifyToken);

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "dummy_key");
const MODEL_NAME = "gemini-2.0-flash";

const LANG_NAMES = { fr: 'francais', ln: 'lingala', sw: 'kiswahili', tsh: 'tshiluba', kg: 'kikongo' };

// ─── System Prompt Builder ──────────────────────────────────────────
function buildSystemPrompt(ctx, langName) {
    let patientSection = '';
    if (ctx) {
        const parts = [];
        if (ctx.name) parts.push(`Nom: ${ctx.name}`);
        if (ctx.age) parts.push(`Age: ${ctx.age}`);
        if (ctx.type) parts.push(`Type de diabete: ${ctx.type}`);
        if (ctx.conditions?.length) parts.push(`Conditions: ${ctx.conditions.join(', ')}`);
        if (ctx.allergies?.length) parts.push(`Allergies: ${ctx.allergies.join(', ')}`);
        if (ctx.latestWeight) parts.push(`Poids actuel: ${ctx.latestWeight} kg`);
        if (ctx.medications?.length) {
            parts.push(`Medicaments: ${ctx.medications.map(m => `${m.name} (${m.dosage})`).join(', ')}`);
        }
        if (ctx.recentGlucose?.length) {
            parts.push(`Glycemie recente: ${ctx.recentGlucose.map(g => `${g.date}: ${g.value} mg/dL`).join(', ')}`);
        }
        if (ctx.recentBP?.length) {
            parts.push(`Tension recente: ${ctx.recentBP.map(b => `${b.date}: ${b.systolic}/${b.diastolic}`).join(', ')}`);
        }
        patientSection = `\n\nPROFIL DU PATIENT:\n${parts.join('\n')}`;
    }

    return `Tu es GlucoBot, un assistant IA specialise en diabetologie pour l'application GlucoSoin, utilisee en RD Congo et en Afrique Centrale.

ROLE: Tu accompagnes les patients diabetiques au quotidien avec empathie et expertise.${patientSection}

REGLES:
- Reponds TOUJOURS en ${langName}.
- Sois concis (2-3 phrases max sauf si on te demande des details).
- Sois empathique, encourageant et clair.
- Utilise les donnees du patient ci-dessus pour personnaliser tes reponses.
- Si la glycemie est < 54 mg/dL ou > 300 mg/dL, ALERTE le patient et recommande de consulter immediatement.
- Ne fais JAMAIS de diagnostic ni de prescription. Recommande toujours de consulter un vrai medecin.
- L'application s'appelle "GlucoSoin".`;
}

// ─── Conversation Context Builder ───────────────────────────────────
function buildConversationContext(history) {
    if (!history || history.length === 0) return '';
    const recent = history.slice(-10);
    const lines = recent.map(m =>
        m.role === 'user' ? `Patient: ${m.text}` : `GlucoBot: ${m.text}`
    );
    return `\n\nHISTORIQUE DE CONVERSATION:\n${lines.join('\n')}\n`;
}

// ─── Multilingual Fallback Responses ────────────────────────────────
const FALLBACK_RESPONSES = {
    fr: {
        emergency: "Attention : Pour tout symptome grave (douleur thoracique, difficulte a respirer, blessure au pied, troubles de la vision), consultez immediatement un medecin ou allez aux urgences.",
        nutrition: "Privilegiez les aliments a index glycemique bas (legumes, cereales completes, legumineuses). Associez toujours des proteines et des fibres a vos glucides pour eviter les pics de glycemie.",
        exercise: "Bouger 30 minutes par jour aide enormement a reguler la glycemie. La marche rapide est ideale. Verifiez votre taux avant et apres l'effort.",
        glucose_tracking: "La regularite est la cle. Notez vos valeurs a jeun et 2h apres les repas. Une glycemie normale a jeun se situe entre 70 et 100 mg/dL.",
        mental_health: "Le diabete peut etre stressant. Le stress influence directement votre glycemie. Prenez du temps pour vous detendre et dormez suffisamment.",
        medication: "Respectez scrupuleusement votre ordonnance. En cas d'oubli ou d'effets secondaires, contactez votre medecin. Verifiez la date de peremption de votre insuline.",
        general: "Bonjour ! Je suis GlucoBot. Je peux vous aider avec des conseils sur l'alimentation, le sport, la gestion de la glycemie ou votre bien-etre.",
        unknown: "Je ne suis pas sur de comprendre. Je peux parler de : nutrition, sport, glycemie, stress, medicaments. Essayez de reformuler.",
        error: "Desole, je suis en maintenance. N'oubliez pas de bien vous hydrater !"
    },
    ln: {
        emergency: "Keba : Mpo na maladi ya makasi (mpasi ya ntolo, mpasi ya kopema, mpota na lokolo, mitungisi ya miso), kende na monganga to na urgence nokinoki.",
        nutrition: "Lia bilei oyo ezali na index glycemique ya nse (ndunda, mbuma ya cereale, madesu). Sangisa ntango nyonso ba proteines na ba fibres na ba glucides na yo.",
        exercise: "Kosala sport miniti 30 mokolo na mokolo esalisaka mingi mpo na glycemie. Kotambola nokinoki ezali malamu. Tala taux na yo liboso mpe nsima ya sport.",
        glucose_tracking: "Kosala yango mbala na mbala ezali fungola. Koma ba valeurs na yo na ntongo mpe nsima ya bilie. Glycemie ya malamu na ntongo ezali 70-100 mg/dL.",
        mental_health: "Diabete ekoki kopesa stress. Stress ezali kobongola glycemie na yo. Kamata ntango ya kopema mpe lala malamu.",
        medication: "Landa ordonnance na yo malamu. Soki obosani to ozali na ba effets secondaires, benga monganga na yo. Tala date ya insuline na yo.",
        general: "Mbote ! Nazali GlucoBot. Nakoki kosalisa yo na toli ya bilie, sport, glycemie to bien-etre na yo.",
        unknown: "Nayebi te ndenge ya kolimbola. Nakoki kosolola na yo mpo na: bilie, sport, glycemie, stress, ba nkisi. Meka koloba na maloba mosusu.",
        error: "Bolimbisi, nazali na bobongisi. Kobosana te komela mai !"
    },
    sw: {
        emergency: "Tahadhari: Kwa dalili kali (maumivu ya kifua, ugumu wa kupumua, jeraha la mguu, matatizo ya macho), tafadhali tembelea daktari au nenda hospitali haraka.",
        nutrition: "Kula vyakula vyenye fahirisi ya glycemiki ya chini (mboga, nafaka nzima, kunde). Changanya protini na nyuzi na wanga wako kuzuia kupanda kwa sukari.",
        exercise: "Kufanya mazoezi dakika 30 kwa siku kunasaidia sana kudhibiti sukari. Kutembea haraka ni bora. Angalia kiwango chako kabla na baada ya mazoezi.",
        glucose_tracking: "Uthabiti ni muhimu. Andika viwango vyako asubuhi na masaa 2 baada ya kula. Sukari ya kawaida asubuhi ni 70-100 mg/dL.",
        mental_health: "Kisukari inaweza kusababisha msongo. Msongo huathiri moja kwa moja sukari yako. Pumzika na ulale vizuri.",
        medication: "Fuata dawa yako kwa uangalifu. Ikiwa umesahau au una madhara, wasiliana na daktari wako. Angalia tarehe ya muda wa insulini.",
        general: "Habari! Mimi ni GlucoBot. Ninaweza kukusaidia na ushauri kuhusu lishe, mazoezi, sukari, au ustawi wako.",
        unknown: "Sijaelewa vizuri. Ninaweza kuzungumza kuhusu: lishe, mazoezi, sukari, msongo, dawa. Tafadhali jaribu tena.",
        error: "Samahani, niko katika matengenezo. Usisahau kunywa maji!"
    },
    tsh: {
        emergency: "Dimuka : Bua maladi ya bunene (mpasi ya ntulu, dipama dia kupema, tshilonda tsha dikasa, mitungisi ya mesu), ndaku kudi muganga nokinoki.",
        nutrition: "Dia bidia bia glycemiki ya panshi (matamba, bidia bia cereale, nyama ya mashi). Sangisha ba proteines na ba fibres na glucides yebe.",
        exercise: "Kuenza sport miniti 30 dituku na dituku dikwasha bua glycemie. Kutambuka nokinoki kudi kuimpe. Tala taux yebe kumpala na nyima ya sport.",
        glucose_tracking: "Kuenza bimpe mvua ne mvua nkudiangaja. Fumina ba valeurs yebe mu dinda ne nsima ya bidia. Glycemie ya buimpe mu dinda idi 70-100 mg/dL.",
        mental_health: "Diabete udi mua kupeta stress. Stress udi ubongola glycemie yebe. Kamata diba dia kupemena ne lala bimpe.",
        medication: "Londa ordonnance yebe bimpe. Bu ubosane anyi udi na ba effets secondaires, bikila muganga webe. Tala date ya insuline yebe.",
        general: "Muoyo ! Ndi GlucoBot. Ndi mua kukwasha na malongesha a bidia, sport, glycemie anyi bien-etre yebe.",
        unknown: "Tshiena mumanye mua kulondolola to. Ndi mua kuakula ne wewe bua: bidia, sport, glycemie, stress, nkisi. Meka kuamba mu njila yisatu.",
        error: "Lumbuluisha, ndi mu bobongisi. Kubosana te kumena mai !"
    },
    kg: {
        emergency: "Keba : Mpo na maladi ya makasi (mpasi ya ntulu, mpasi ya kupema, mpota na lokolo, mitungisi ya meso), kwenda na nganga to na lopitalo nokinoki.",
        nutrition: "Dia bilei ya glycemiki ya nse (ndunda, bilei ya cereale, madesu). Sangisa ba proteines na ba fibres na glucides na nge.",
        exercise: "Kusala sport miniti 30 lumbu na lumbu kusadisaka mingi mpo na glycemie. Kutambula nokinoki kuzali mbote. Tala taux na nge kumpala ye nsima ya sport.",
        glucose_tracking: "Kusala yango mvua ne mvua kuzali fungola. Sonika ba valeurs na nge na nsuka ye nsima ya bilei. Glycemie ya mbote na nsuka kuzali 70-100 mg/dL.",
        mental_health: "Diabete lenda kupesa stress. Stress kuzali kubadula glycemie na nge. Kamata ntangu ya kupemena ye lala mbote.",
        medication: "Landa ordonnance na nge mbote. Kansi ubosane to uzali na ba effets secondaires, bikila nganga na nge. Tala date ya insuline na nge.",
        general: "Mbote ! Mono nzali GlucoBot. Nzali lenda kusadisa nge na malongi ya bilei, sport, glycemie to bien-etre na nge.",
        unknown: "Ke yazabi ve ndenge ya kulondolola. Nzali lenda kusolula na nge mpo na: bilei, sport, glycemie, stress, nkisi. Meka kulanda na ndinga mosusu.",
        error: "Bolimbisi, nzali na bobongisi. Kubosana te kumela mamba !"
    }
};

function getFallbackResponse(topic, lang) {
    const langResponses = FALLBACK_RESPONSES[lang] || FALLBACK_RESPONSES.fr;
    return langResponses[topic] || langResponses.unknown;
}

function getFallbackErrorMessage(lang) {
    return (FALLBACK_RESPONSES[lang] || FALLBACK_RESPONSES.fr).error;
}

// ─── /chat ──────────────────────────────────────────────────────────
router.post('/chat', async (req, res) => {
    const lang = req.body.lang || 'fr';

    try {
        const { message, history, patientContext } = req.body;

        if (!message) {
            return res.status(400).json({ error: "Message is required" });
        }

        let text = "";

        try {
            const langName = LANG_NAMES[lang] || 'francais';
            const systemPrompt = buildSystemPrompt(patientContext, langName);
            const conversationCtx = buildConversationContext(history);

            const model = genAI.getGenerativeModel({ model: MODEL_NAME });

            const prompt = `${systemPrompt}${conversationCtx}\n\nNouveau message du patient: ${message}`;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            text = response.text();

        } catch (aiError) {
            console.warn("Gemini API failed or key missing, using fallback.", aiError.message);

            // Keyword-based fallback (French keywords work across accented input)
            const topics = {
                emergency: ['mal', 'douleur', 'urgence', 'grave', 'sang', 'inconscient', 'poitrine', 'coeur', 'respirer', 'blessure', 'malaise', 'urgent', 'aide', 'hopital', 'pied', 'coupe', 'vision', 'flou'],
                nutrition: ['manger', 'repas', 'dejeuner', 'diner', 'souper', 'fruit', 'sucre', 'glucide', 'pain', 'riz', 'regime', 'faim', 'poids', 'recette', 'viande', 'legume', 'boire', 'eau', 'alcool', 'diet', 'nourriture'],
                exercise: ['sport', 'marcher', 'courir', 'exercice', 'activite', 'forme', 'gym', 'muscle', 'bouger', 'promener', 'velo', 'fitness'],
                glucose_tracking: ['taux', 'glycemie', 'mesure', 'test', 'doigt', 'capteur', 'haut', 'bas', 'hypo', 'hyper', 'controle', 'resultat', 'normale', 'sucre', 'glucose'],
                mental_health: ['fatigue', 'stress', 'peur', 'anxiete', 'triste', 'deprime', 'seul', 'moral', 'dormir', 'insomnie', 'epuise', 'nerveux', 'dodo', 'sommeil'],
                medication: ['medicament', 'insuline', 'piqure', 'comprime', 'pilule', 'traitement', 'dose', 'oubli', 'ordonnance', 'pharmacie', 'metformine'],
                general: ['bonjour', 'salut', 'hello', 'ca va', 'aide', 'quoi', 'comment', 'qui', 'mbote', 'habari', 'muoyo']
            };

            const normalizedMsg = message.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            let bestTopic = 'unknown';
            let maxScore = 0;

            for (const [key, keywords] of Object.entries(topics)) {
                let score = 0;
                keywords.forEach(word => {
                    if (normalizedMsg.includes(word)) score += 1;
                });
                if (key === 'emergency') score *= 1.5;
                if (score > maxScore) {
                    maxScore = score;
                    bestTopic = key;
                }
            }

            text = maxScore > 0
                ? getFallbackResponse(bestTopic, lang)
                : getFallbackResponse('unknown', lang);
        }

        res.json({ reply: text });

    } catch (error) {
        console.error("AI Error:", error);
        res.json({ reply: getFallbackErrorMessage(lang) });
    }
});


router.post('/forecast', async (req, res) => {
    try {
        const { history, type } = req.body;

        if (!history || history.length < 3) {
            return res.status(400).json({ error: "Need at least 3 data points for forecasting" });
        }

        let data;

        try {
            const model = genAI.getGenerativeModel({ model: MODEL_NAME });

            const prompt = `
            Act as a medical data analyst. Analyze the following ${type} readings from a diabetes patient.

            Data (Chronological):
            ${JSON.stringify(history)}

            Task:
            1. Identify the trend (stable, rising, falling, fluctuating).
            2. Predict the next 3 probable values (one per day starting after the last date).
            3. Provide a brief 1-sentence medical insight or advice based on the trend.

            Output Format:
            STRICTLY return a valid JSON object with no markdown formatting.
            {
                "trend": "string",
                "predictions": [
                    { "date": "YYYY-MM-DD", "value": number, "type": "predicted" }
                ],
                "insight": "string"
            }
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            let text = response.text();

            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            data = JSON.parse(text);

        } catch (aiError) {
            console.warn("Gemini Forecast failed, using fallback.", aiError.message);

            const lastVal = history[history.length - 1].value;
            let trend = "stable";
            if (history.length > 1) {
                const prevVal = history[history.length - 2].value;
                if (lastVal > prevVal * 1.05) trend = "rising";
                else if (lastVal < prevVal * 0.95) trend = "falling";
            }

            const lastDate = new Date(history[history.length - 1].date);
            const predictions = [];
            for (let i = 1; i <= 3; i++) {
                const nextDate = new Date(lastDate);
                nextDate.setDate(lastDate.getDate() + i);

                let nextVal = lastVal;
                if (trend === 'rising') nextVal += (i * 2);
                if (trend === 'falling') nextVal -= (i * 2);
                nextVal = Math.round(nextVal + (Math.random() * 4 - 2));

                predictions.push({
                    date: nextDate.toISOString().split('T')[0],
                    value: nextVal,
                    type: 'predicted'
                });
            }

            data = {
                trend: trend,
                predictions: predictions,
                insight: trend === 'stable'
                    ? "Vos taux semblent stables. Continuez ainsi."
                    : "Legere variation detectee, surveillez votre regime."
            };
        }

        res.json(data);

    } catch (error) {
        console.error("AI Forecast Error:", error);
        res.status(500).json({
            error: "Failed to generate forecast",
            details: error.message
        });
    }
});


/**
 * Comprehensive Health Analysis
 */
router.post('/analyze-health', async (req, res) => {
    try {
        const { patientData, vitals, prescriptions, timeframe } = req.body;

        if (!patientData || !vitals) {
            return res.status(400).json({ error: "Patient data and vitals are required" });
        }

        let analysis;

        try {
            const model = genAI.getGenerativeModel({ model: MODEL_NAME });

            const dataContext = {
                patient: {
                    type: patientData.type || 'Type 2',
                    conditions: patientData.conditions || [],
                    allergies: patientData.allergies || [],
                    age: patientData.age,
                    gender: patientData.gender
                },
                vitals: {
                    glucose: vitals.readings?.filter(v => v.category === 'Glucose' || !v.category).slice(-14) || [],
                    bloodPressure: vitals.readings?.filter(v => v.category === 'Blood Pressure').slice(-7) || [],
                    weight: vitals.readings?.filter(v => v.category === 'Weight').slice(-7) || [],
                    heartRate: vitals.readings?.filter(v => v.category === 'Heart Rate').slice(-7) || []
                },
                medications: prescriptions?.map(p => ({
                    name: p.medication,
                    dosage: p.dosage,
                    instructions: p.instructions
                })) || [],
                timeframe: timeframe || '14 days'
            };

            const prompt = `
            You are an expert diabetes specialist and medical data analyst. Analyze the following comprehensive patient data and provide personalized health insights and recommendations.

            PATIENT PROFILE:
            ${JSON.stringify(dataContext.patient, null, 2)}

            VITAL SIGNS (Last ${dataContext.timeframe}):
            ${JSON.stringify(dataContext.vitals, null, 2)}

            CURRENT MEDICATIONS:
            ${JSON.stringify(dataContext.medications, null, 2)}

            TASKS:
            1. Analyze ALL vital trends (glucose, blood pressure, weight, heart rate)
            2. Identify concerning patterns or improvements
            3. Assess medication effectiveness based on trends
            4. Provide risk assessment (low, moderate, high)
            5. Generate 3-5 personalized, actionable recommendations
            6. Suggest lifestyle modifications specific to their data

            IMPORTANT:
            - Be empathetic and encouraging
            - Provide specific, actionable advice
            - Always recommend consulting their doctor for major concerns
            - Respond in French
            - Focus on diabetes management context

            OUTPUT FORMAT (STRICT JSON, no markdown):
            {
                "overallStatus": "excellent|good|fair|concerning",
                "healthScore": 0-100,
                "trends": {
                    "glucose": { "status": "stable|improving|worsening", "average": number, "concern": "low|medium|high" },
                    "bloodPressure": { "status": "stable|improving|worsening", "average": "120/80", "concern": "low|medium|high" },
                    "weight": { "status": "stable|improving|worsening", "change": "+/-X kg", "concern": "low|medium|high" },
                    "heartRate": { "status": "stable|improving|worsening", "average": number, "concern": "low|medium|high" }
                },
                "riskAssessment": {
                    "level": "low|moderate|high",
                    "factors": ["factor1", "factor2"],
                    "urgentConcerns": ["concern1"] or []
                },
                "insights": [
                    { "type": "positive|warning|info", "title": "Titre court", "message": "Explication detaillee" }
                ],
                "recommendations": [
                    { "category": "nutrition|exercise|medication|monitoring", "priority": "high|medium|low", "action": "Action specifique a prendre" }
                ],
                "nextSteps": ["Etape 1", "Etape 2", "Etape 3"]
            }
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            let text = response.text();

            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            analysis = JSON.parse(text);

        } catch (aiError) {
            console.warn("Gemini Health Analysis failed, using fallback.", aiError.message);

            const glucoseReadings = vitals.readings?.filter(v => v.category === 'Glucose' || !v.category) || [];
            const bpReadings = vitals.readings?.filter(v => v.category === 'Blood Pressure') || [];
            const weightReadings = vitals.readings?.filter(v => v.category === 'Weight') || [];

            const avgGlucose = glucoseReadings.length > 0
                ? Math.round(glucoseReadings.reduce((sum, r) => sum + (r.glucose || r.value || 0), 0) / glucoseReadings.length)
                : 0;

            let glucoseStatus = "stable";
            let glucoseConcern = "low";
            if (avgGlucose > 180) {
                glucoseStatus = "worsening";
                glucoseConcern = "high";
            } else if (avgGlucose < 70) {
                glucoseStatus = "worsening";
                glucoseConcern = "high";
            } else if (avgGlucose > 140) {
                glucoseConcern = "medium";
            }

            let overallStatus = "good";
            let healthScore = 75;
            if (glucoseConcern === "high") {
                overallStatus = "concerning";
                healthScore = 50;
            } else if (glucoseConcern === "medium") {
                overallStatus = "fair";
                healthScore = 65;
            } else if (avgGlucose >= 80 && avgGlucose <= 120) {
                overallStatus = "excellent";
                healthScore = 90;
            }

            const insights = [];
            if (avgGlucose > 180) {
                insights.push({
                    type: "warning",
                    title: "Glycemie elevee detectee",
                    message: `Votre glycemie moyenne est de ${avgGlucose} mg/dL, ce qui est au-dessus de la cible. Il est important de consulter votre medecin.`
                });
            } else if (avgGlucose < 70) {
                insights.push({
                    type: "warning",
                    title: "Hypoglycemie detectee",
                    message: `Votre glycemie moyenne est de ${avgGlucose} mg/dL. Attention aux hypoglycemies. Consultez votre medecin pour ajuster votre traitement.`
                });
            } else if (avgGlucose >= 80 && avgGlucose <= 120) {
                insights.push({
                    type: "positive",
                    title: "Excellent controle glycemique",
                    message: `Votre glycemie moyenne de ${avgGlucose} mg/dL est dans la cible optimale. Continuez comme ca !`
                });
            } else {
                insights.push({
                    type: "info",
                    title: "Controle glycemique acceptable",
                    message: `Votre glycemie moyenne est de ${avgGlucose} mg/dL. Quelques ajustements pourraient l'ameliorer.`
                });
            }

            if (weightReadings.length > 1) {
                const weightChange = weightReadings[weightReadings.length - 1].value - weightReadings[0].value;
                if (Math.abs(weightChange) > 2) {
                    insights.push({
                        type: "info",
                        title: weightChange > 0 ? "Prise de poids detectee" : "Perte de poids detectee",
                        message: `Vous avez ${weightChange > 0 ? 'gagne' : 'perdu'} ${Math.abs(weightChange).toFixed(1)} kg sur la periode analysee.`
                    });
                }
            }

            const recommendations = [
                {
                    category: "monitoring",
                    priority: "high",
                    action: "Mesurez votre glycemie a jeun chaque matin et 2h apres les repas principaux"
                },
                {
                    category: "nutrition",
                    priority: "high",
                    action: "Privilegiez les legumes, proteines maigres et cereales completes. Limitez les sucres rapides."
                },
                {
                    category: "exercise",
                    priority: "medium",
                    action: "Marchez 30 minutes par jour, de preference apres les repas pour stabiliser la glycemie"
                }
            ];

            if (avgGlucose > 140) {
                recommendations.push({
                    category: "medication",
                    priority: "high",
                    action: "Discutez avec votre medecin d'un possible ajustement de votre traitement"
                });
            }

            analysis = {
                overallStatus,
                healthScore,
                trends: {
                    glucose: {
                        status: glucoseStatus,
                        average: avgGlucose,
                        concern: glucoseConcern
                    },
                    bloodPressure: {
                        status: "stable",
                        average: bpReadings.length > 0 ? `${bpReadings[bpReadings.length - 1].systolic}/${bpReadings[bpReadings.length - 1].diastolic}` : "N/A",
                        concern: "low"
                    },
                    weight: {
                        status: "stable",
                        change: weightReadings.length > 1
                            ? `${(weightReadings[weightReadings.length - 1].value - weightReadings[0].value).toFixed(1)} kg`
                            : "N/A",
                        concern: "low"
                    },
                    heartRate: {
                        status: "stable",
                        average: 0,
                        concern: "low"
                    }
                },
                riskAssessment: {
                    level: glucoseConcern === "high" ? "high" : glucoseConcern === "medium" ? "moderate" : "low",
                    factors: avgGlucose > 180 ? ["Glycemie chroniquement elevee", "Risque de complications"] : [],
                    urgentConcerns: avgGlucose > 250 || avgGlucose < 60 ? ["Consulter un medecin rapidement"] : []
                },
                insights,
                recommendations,
                nextSteps: [
                    "Continuez a enregistrer vos mesures quotidiennement",
                    "Suivez les recommandations nutritionnelles personnalisees",
                    "Planifiez votre prochain rendez-vous medical si necessaire"
                ]
            };
        }

        res.json(analysis);

    } catch (error) {
        console.error("AI Health Analysis Error:", error);
        res.status(500).json({
            error: "Failed to analyze health data",
            details: error.message
        });
    }
});

module.exports = router;
