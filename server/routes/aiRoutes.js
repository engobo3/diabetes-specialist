const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");
const verifyToken = require('../middleware/authMiddleware');
const { validateBody } = require('../middleware/validationMiddleware');
const { AIChatSchema, AIForecastSchema, AIAnalyzeHealthSchema } = require('../schemas/auth.schema');
const { getToolsForRole, executeToolCall } = require('../services/agentTools');

// Auth on all AI routes
router.use(verifyToken);

// Fail-fast in production if the API key isn't set. Dev keeps the dummy fallback so
// the keyword-based fallback responder can take over without crashing.
const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey && process.env.NODE_ENV === 'production') {
    console.error('GEMINI_API_KEY missing in production — AI routes will return fallback responses only');
}
const genAI = new GoogleGenerativeAI(apiKey || "dummy_key");
const MODEL_NAME = "gemini-2.0-flash";

const LANG_NAMES = { fr: 'francais', ln: 'lingala', sw: 'kiswahili', tsh: 'tshiluba', kg: 'kikongo' };

function buildSystemPrompt(ctx, langName, role) {
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

    const isDoctor = role === 'doctor' || role === 'admin';

    const toolInstructions = isDoctor
        ? `\n\nOUTILS DISPONIBLES:
Tu as des outils pour aider le medecin. Utilise-les quand c'est pertinent:
- generate_patient_summary: pour obtenir un resume patient avant consultation
- draft_soap_note: pour rediger un brouillon de note SOAP
- draft_prescription: pour creer une ordonnance
- find_empty_slots: pour voir tes creneaux libres
Utilise ces outils de maniere proactive quand le medecin en a besoin.`
        : `\n\nOUTILS DISPONIBLES:
Tu as des outils pour aider le patient. Utilise-les quand c'est pertinent:
- get_available_slots / book_appointment: pour les rendez-vous
- log_vital: pour enregistrer des mesures de sante
- get_health_summary: pour un resume de sante complet
- check_medications / log_medication_taken: pour les medicaments
- trigger_emergency_alert: SEULEMENT en cas de danger vital (glycemie <54 ou >300, douleur thoracique, etc.)
Quand le patient veut faire une action, utilise l'outil correspondant au lieu de juste donner des instructions.`;

    return `Tu es GlucoBot, un assistant IA agent specialise en diabetologie pour l'application GlucoSoin, utilisee en RD Congo et en Afrique Centrale.

ROLE: ${isDoctor ? 'Tu assistes le medecin dans la gestion de ses patients.' : 'Tu accompagnes les patients diabetiques au quotidien avec empathie et expertise.'}${patientSection}${toolInstructions}

REGLES:
- Reponds TOUJOURS en ${langName}.
- Sois concis (2-3 phrases max sauf si on te demande des details).
- Sois empathique, encourageant et clair.
- Utilise les donnees du patient ci-dessus pour personnaliser tes reponses.
- Si la glycemie est < 54 mg/dL ou > 300 mg/dL, ALERTE le patient et recommande de consulter immediatement.
- ${isDoctor ? 'Tu peux proposer des actions concretes (prescriptions, notes SOAP, etc.).' : 'Ne fais JAMAIS de diagnostic ni de prescription. Recommande toujours de consulter un vrai medecin.'}
- L'application s'appelle "GlucoSoin".
- Apres avoir utilise un outil, resume le resultat au patient/medecin de maniere claire et naturelle.`;
}

const FALLBACK_RESPONSES = require('./aiFallbacks');

function getFallbackResponse(topic, lang) {
    const langResponses = FALLBACK_RESPONSES[lang] || FALLBACK_RESPONSES.fr;
    return langResponses[topic] || langResponses.unknown;
}

function getFallbackErrorMessage(lang) {
    return (FALLBACK_RESPONSES[lang] || FALLBACK_RESPONSES.fr).error;
}

router.post('/chat', validateBody(AIChatSchema), async (req, res) => {
    const lang = req.body.lang || 'fr';

    try {
        const { message, history, patientContext, role } = req.body;

        const userRole = role || req.user?.role || 'patient';
        const context = {
            userId: req.user?.uid || '',
            role: userRole,
            patientId: req.body.patientId || patientContext?.patientId || '',
            doctorId: req.body.doctorId || ''
        };

        let text = "";
        const actions = [];

        try {
            const langName = LANG_NAMES[lang] || 'francais';
            const systemPrompt = buildSystemPrompt(patientContext, langName, userRole);

            const chatHistory = [];
            if (history && history.length > 0) {
                for (const msg of history.slice(-10)) {
                    chatHistory.push({
                        role: msg.role === 'user' ? 'user' : 'model',
                        parts: [{ text: msg.text }]
                    });
                }
            }

            const toolDeclarations = getToolsForRole(userRole);

            const model = genAI.getGenerativeModel({
                model: MODEL_NAME,
                systemInstruction: { parts: [{ text: systemPrompt }] },
                tools: [{ functionDeclarations: toolDeclarations }]
            });

            const chat = model.startChat({ history: chatHistory });
            let result = await chat.sendMessage(message);
            let response = result.response;

            for (let i = 0; i < 5; i++) {
                const functionCalls = response.functionCalls();
                if (!functionCalls || functionCalls.length === 0) break;

                const fc = functionCalls[0];
                const toolResult = await executeToolCall(fc.name, fc.args, context);
                actions.push({ tool: fc.name, args: fc.args, result: toolResult });

                result = await chat.sendMessage([{
                    functionResponse: { name: fc.name, response: toolResult }
                }]);
                response = result.response;
            }

            text = response.text();

        } catch (aiError) {
            // Don't leak the upstream error — log a redacted summary
            console.warn("Gemini API failed, using fallback:", aiError.code || aiError.name || 'unknown');

            const topics = {
                emergency: ['mal', 'douleur', 'urgence', 'grave', 'sang', 'inconscient', 'poitrine', 'coeur', 'respirer', 'blessure', 'malaise', 'urgent', 'aide', 'hopital', 'pied', 'coupe', 'vision', 'flou'],
                nutrition: ['manger', 'repas', 'dejeuner', 'diner', 'souper', 'fruit', 'sucre', 'glucide', 'pain', 'riz', 'regime', 'faim', 'poids', 'recette', 'viande', 'legume', 'boire', 'eau', 'alcool', 'diet', 'nourriture'],
                exercise: ['sport', 'marcher', 'courir', 'exercice', 'activite', 'forme', 'gym', 'muscle', 'bouger', 'promener', 'velo', 'fitness'],
                glucose_tracking: ['taux', 'glycemie', 'mesure', 'test', 'doigt', 'capteur', 'haut', 'bas', 'hypo', 'hyper', 'controle', 'resultat', 'normale', 'sucre', 'glucose'],
                mental_health: ['fatigue', 'stress', 'peur', 'anxiete', 'triste', 'deprime', 'seul', 'moral', 'dormir', 'insomnie', 'epuise', 'nerveux', 'dodo', 'sommeil'],
                medication: ['medicament', 'insuline', 'piqure', 'comprime', 'pilule', 'traitement', 'dose', 'oubli', 'ordonnance', 'pharmacie', 'metformine'],
                general: ['bonjour', 'salut', 'hello', 'ca va', 'aide', 'quoi', 'comment', 'qui', 'mbote', 'habari', 'muoyo']
            };

            const normalizedMsg = message.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
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

        res.json({ reply: text, actions });

    } catch (error) {
        console.error("AI Error:", error.message);
        res.json({ reply: getFallbackErrorMessage(lang), actions: [] });
    }
});


router.post('/forecast', validateBody(AIForecastSchema), async (req, res) => {
    try {
        const { history, type } = req.body;

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
            console.warn("Gemini Forecast failed, using fallback:", aiError.code || aiError.name || 'unknown');

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
        console.error("AI Forecast Error:", error.message);
        res.status(500).json({ error: "Failed to generate forecast" });
    }
});


router.post('/analyze-health', validateBody(AIAnalyzeHealthSchema), async (req, res) => {
    try {
        const { patientData, vitals, prescriptions, timeframe } = req.body;

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
                "trends": { "glucose": {...}, "bloodPressure": {...}, "weight": {...}, "heartRate": {...} },
                "riskAssessment": { "level": "low|moderate|high", "factors": [...], "urgentConcerns": [...] },
                "insights": [...],
                "recommendations": [...],
                "nextSteps": [...]
            }
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            let text = response.text();

            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            analysis = JSON.parse(text);

        } catch (aiError) {
            console.warn("Gemini Health Analysis failed, using fallback:", aiError.code || aiError.name || 'unknown');

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
                insights.push({ type: "warning", title: "Glycemie elevee detectee", message: `Votre glycemie moyenne est de ${avgGlucose} mg/dL, ce qui est au-dessus de la cible. Il est important de consulter votre medecin.` });
            } else if (avgGlucose < 70) {
                insights.push({ type: "warning", title: "Hypoglycemie detectee", message: `Votre glycemie moyenne est de ${avgGlucose} mg/dL. Attention aux hypoglycemies. Consultez votre medecin pour ajuster votre traitement.` });
            } else if (avgGlucose >= 80 && avgGlucose <= 120) {
                insights.push({ type: "positive", title: "Excellent controle glycemique", message: `Votre glycemie moyenne de ${avgGlucose} mg/dL est dans la cible optimale. Continuez comme ca !` });
            } else {
                insights.push({ type: "info", title: "Controle glycemique acceptable", message: `Votre glycemie moyenne est de ${avgGlucose} mg/dL. Quelques ajustements pourraient l'ameliorer.` });
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
                { category: "monitoring", priority: "high", action: "Mesurez votre glycemie a jeun chaque matin et 2h apres les repas principaux" },
                { category: "nutrition", priority: "high", action: "Privilegiez les legumes, proteines maigres et cereales completes. Limitez les sucres rapides." },
                { category: "exercise", priority: "medium", action: "Marchez 30 minutes par jour, de preference apres les repas pour stabiliser la glycemie" }
            ];

            if (avgGlucose > 140) {
                recommendations.push({ category: "medication", priority: "high", action: "Discutez avec votre medecin d'un possible ajustement de votre traitement" });
            }

            analysis = {
                overallStatus,
                healthScore,
                trends: {
                    glucose: { status: glucoseStatus, average: avgGlucose, concern: glucoseConcern },
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
                    heartRate: { status: "stable", average: 0, concern: "low" }
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
        console.error("AI Health Analysis Error:", error.message);
        res.status(500).json({ error: "Failed to analyze health data" });
    }
});

module.exports = router;
