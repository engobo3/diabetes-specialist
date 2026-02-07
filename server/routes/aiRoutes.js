const express = require('express');
const router = express.Router();
const { GoogleGenerativeAI } = require("@google/generative-ai");

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "dummy_key");

router.post('/chat', async (req, res) => {
    try {
        const { message, context } = req.body;

        if (!message) {
            return res.status(400).json({ error: "Message is required" });
        }

        let text = "";

        try {
            // Attempt real AI generation
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });

            // Health-focused prompt
            const prompt = `
            Tu es GlucoBot, un assistant IA amical et utile pour l'application de gestion du diabète GlucoSoin.
            Ton but est de répondre aux questions des patients sur le diabète, la santé et l'utilisation de l'application.
            
            Directives :
            - Réponds TOUJOURS en français.
            - Sois empathique, encourageant et clair.
            - Donne des conseils de santé généraux mais conseille TOUJOURS de consulter un vrai médecin pour les décisions médicales.
            - Garde les réponses concises (max 2-3 phrases sauf si on demande des détails).
            - L'application s'appelle "GlucoSoin".
    
            Contexte Utilisateur (si disponible) : ${JSON.stringify(context || {})}
            
            Question Utilisateur : ${message}
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            text = response.text();

        } catch (aiError) {
            console.warn("Gemini API failed or key missing, using fallback.", aiError.message);
            // Fallback rules for demo/no-key scenarios
            // Robust Intent-Based Classification System

            // 1. Define Topics and Keywords
            const topics = {
                emergency: {
                    keywords: ['mal', 'douleur', 'urgence', 'grave', 'sang', 'inconscient', 'poitrine', 'cœur', 'respirer', 'blessure', 'malaise', 'urgent', 'aide', 'hopital', 'pied', 'coupe', 'vision', 'flou'],
                    response: "⚠️ **Attention** : Pour tout symptôme grave (douleur thoracique, difficulté à respirer, blessure au pied, troubles de la vision), consultez immédiatement un médecin ou allez aux urgences. Je ne suis qu'une IA."
                },
                nutrition: {
                    keywords: ['manger', 'repas', 'dejeuner', 'diner', 'souper', 'fruit', 'sucre', 'glucide', 'pain', 'riz', 'regime', 'faim', 'poids', 'recette', 'viande', 'legume', 'boire', 'eau', 'alcool', 'diet', 'nourriture'],
                    response: "🍎 **Nutrition** : Privilégiez les aliments à index glycémique bas (légumes, céréales complètes, légumineuses). Associez toujours des protéines et des fibres à vos glucides pour éviter les pics de glycémie. N'oubliez pas de bien vous hydrater !"
                },
                exercise: {
                    keywords: ['sport', 'marcher', 'courir', 'exercice', 'activite', 'forme', 'gym', 'muscle', 'bouger', 'promener', 'velo', 'fitness'],
                    response: "🏃 **Activité Physique** : Bouger 30 minutes par jour aide énormément à réguler la glycémie. La marche rapide est idéale. Pensez à vérifier votre taux avant et après l'effort, et ayez toujours du sucre sur vous en cas d'hypo."
                },
                glucose_tracking: {
                    keywords: ['taux', 'glycemie', 'mesure', 'test', 'doigt', 'capteur', 'haut', 'bas', 'hypo', 'hyper', 'controle', 'resultat', 'normale', 'sucre', 'glucose'],
                    response: "🩸 **Suivi Glycémique** : La régularité est la clé. Notez vos valeurs à jeun et 2h après les repas. Une glycémie normale à jeun se situe généralement entre 70 et 100 mg/dL, mais suivez les objectifs fixés par votre médecin."
                },
                mental_health: {
                    keywords: ['fatigue', 'stress', 'peur', 'anxiete', 'triste', 'deprime', 'seul', 'moral', 'dormir', 'insomnie', 'epuise', 'nerveux', 'dodo', 'sommeil'],
                    response: "🧠 **Bien-être** : Le diabète peut être stressant. Le stress influence directement votre glycémie (souvent à la hausse). Prenez du temps pour vous détendre, dormez suffisamment et n'hésitez pas à en parler à vos proches ou à un psychologue."
                },
                medication: {
                    keywords: ['medicament', 'insuline', 'piqure', 'comprime', 'pilule', 'traitement', 'dose', 'oubli', 'ordonnance', 'pharmacie', 'metformine'],
                    response: "💊 **Traitement** : Respectez scrupuleusement votre ordonnance. En cas d'oubli ou d'effets secondaires, ne modifiez pas votre traitement seul : contactez votre médecin ou pharmacien. Vérifiez toujours la date de péremption de votre insuline."
                },
                general: {
                    keywords: ['bonjour', 'salut', 'hello', 'ca va', 'aide', 'quoi', 'comment', 'qui'],
                    response: "👋 Bonjour ! Je suis GlucoBot. Je peux vous aider avec des conseils sur l'alimentation, le sport, la gestion de la glycémie ou votre bien-être. Posez-moi une question précise !"
                }
            };

            // 2. Score the Message
            const normalizedMsg = message.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
            let bestTopic = 'unknown';
            let maxScore = 0;

            for (const [key, category] of Object.entries(topics)) {
                let score = 0;
                category.keywords.forEach(word => {
                    if (normalizedMsg.includes(word)) score += 1;
                });

                // Weight Emergency higher to be safe
                if (key === 'emergency') score *= 1.5;

                if (score > maxScore) {
                    maxScore = score;
                    bestTopic = key;
                }
            }

            // 3. Select Response
            if (maxScore > 0) {
                text = topics[bestTopic].response;
                // Add specific context if emergency or unknown
                if (bestTopic === 'emergency') {
                    text += " \n\n(Note: Détection de mots-clés liés à une urgence ou une douleur.)";
                }
            } else {
                text = "Je ne suis pas sûr de comprendre. Je peux parler de :\n- 🍎 Nutrition\n- 🏃 Sport\n- 🩸 Glycémie\n- 🧠 Stress\n- 💊 Médicaments\n\nEssayez de reformuler avec des mots simples.";
            }
        }

        res.json({ reply: text });

    } catch (error) {
        console.error("AI Error:", error);
        // Even in outer catch, try to return something friendly
        res.json({ reply: "Désolé, je suis en maintenance pour l'instant. Mais n'oubliez pas de bien vous hydrater !" });
    }
});


router.post('/forecast', async (req, res) => {
    try {
        const { history, type } = req.body; // history is array of { date, value }, type is 'Glucose', etc.

        if (!history || history.length < 3) {
            return res.status(400).json({ error: "Need at least 3 data points for forecasting" });
        }

        let data;

        try {
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });

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

            // Cleanup markdown if present
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            data = JSON.parse(text);

        } catch (aiError) {
            console.warn("Gemini Forecast failed, using fallback.", aiError.message);

            // Simple fallback calculation
            const lastVal = history[history.length - 1].value;
            let trend = "stable";
            if (history.length > 1) {
                const prevVal = history[history.length - 2].value;
                if (lastVal > prevVal * 1.05) trend = "rising";
                else if (lastVal < prevVal * 0.95) trend = "falling";
            }

            // Generate 3 mock days
            const lastDate = new Date(history[history.length - 1].date);
            const predictions = [];
            for (let i = 1; i <= 3; i++) {
                const nextDate = new Date(lastDate);
                nextDate.setDate(lastDate.getDate() + i);

                let nextVal = lastVal;
                if (trend === 'rising') nextVal += (i * 2);
                if (trend === 'falling') nextVal -= (i * 2);
                // Add some noise
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
                    : "Légère variation détectée, surveillez votre régime."
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
 * Analyzes all patient vitals, prescriptions, and conditions to provide personalized insights
 */
router.post('/analyze-health', async (req, res) => {
    try {
        const { patientData, vitals, prescriptions, timeframe } = req.body;

        if (!patientData || !vitals) {
            return res.status(400).json({ error: "Patient data and vitals are required" });
        }

        let analysis;

        try {
            const model = genAI.getGenerativeModel({ model: "gemini-pro" });

            // Prepare comprehensive data summary
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
                    { "type": "positive|warning|info", "title": "Titre court", "message": "Explication détaillée" }
                ],
                "recommendations": [
                    { "category": "nutrition|exercise|medication|monitoring", "priority": "high|medium|low", "action": "Action spécifique à prendre" }
                ],
                "nextSteps": ["Étape 1", "Étape 2", "Étape 3"]
            }
            `;

            const result = await model.generateContent(prompt);
            const response = await result.response;
            let text = response.text();

            // Cleanup markdown if present
            text = text.replace(/```json/g, '').replace(/```/g, '').trim();
            analysis = JSON.parse(text);

        } catch (aiError) {
            console.warn("Gemini Health Analysis failed, using fallback.", aiError.message);

            // Intelligent fallback analysis
            const glucoseReadings = vitals.readings?.filter(v => v.category === 'Glucose' || !v.category) || [];
            const bpReadings = vitals.readings?.filter(v => v.category === 'Blood Pressure') || [];
            const weightReadings = vitals.readings?.filter(v => v.category === 'Weight') || [];

            // Calculate glucose average
            const avgGlucose = glucoseReadings.length > 0
                ? Math.round(glucoseReadings.reduce((sum, r) => sum + (r.glucose || r.value || 0), 0) / glucoseReadings.length)
                : 0;

            // Assess glucose status
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

            // Determine overall status
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

            // Generate insights
            const insights = [];
            if (avgGlucose > 180) {
                insights.push({
                    type: "warning",
                    title: "Glycémie élevée détectée",
                    message: `Votre glycémie moyenne est de ${avgGlucose} mg/dL, ce qui est au-dessus de la cible. Il est important de consulter votre médecin.`
                });
            } else if (avgGlucose < 70) {
                insights.push({
                    type: "warning",
                    title: "Hypoglycémie détectée",
                    message: `Votre glycémie moyenne est de ${avgGlucose} mg/dL. Attention aux hypoglycémies. Consultez votre médecin pour ajuster votre traitement.`
                });
            } else if (avgGlucose >= 80 && avgGlucose <= 120) {
                insights.push({
                    type: "positive",
                    title: "Excellent contrôle glycémique",
                    message: `Votre glycémie moyenne de ${avgGlucose} mg/dL est dans la cible optimale. Continuez comme ça !`
                });
            } else {
                insights.push({
                    type: "info",
                    title: "Contrôle glycémique acceptable",
                    message: `Votre glycémie moyenne est de ${avgGlucose} mg/dL. Quelques ajustements pourraient l'améliorer.`
                });
            }

            // Add weight insight if data available
            if (weightReadings.length > 1) {
                const weightChange = weightReadings[weightReadings.length - 1].value - weightReadings[0].value;
                if (Math.abs(weightChange) > 2) {
                    insights.push({
                        type: "info",
                        title: weightChange > 0 ? "Prise de poids détectée" : "Perte de poids détectée",
                        message: `Vous avez ${weightChange > 0 ? 'gagné' : 'perdu'} ${Math.abs(weightChange).toFixed(1)} kg sur la période analysée.`
                    });
                }
            }

            // Generate recommendations
            const recommendations = [
                {
                    category: "monitoring",
                    priority: "high",
                    action: "Mesurez votre glycémie à jeun chaque matin et 2h après les repas principaux"
                },
                {
                    category: "nutrition",
                    priority: "high",
                    action: "Privilégiez les légumes, protéines maigres et céréales complètes. Limitez les sucres rapides."
                },
                {
                    category: "exercise",
                    priority: "medium",
                    action: "Marchez 30 minutes par jour, de préférence après les repas pour stabiliser la glycémie"
                }
            ];

            if (avgGlucose > 140) {
                recommendations.push({
                    category: "medication",
                    priority: "high",
                    action: "Discutez avec votre médecin d'un possible ajustement de votre traitement"
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
                    factors: avgGlucose > 180 ? ["Glycémie chroniquement élevée", "Risque de complications"] : [],
                    urgentConcerns: avgGlucose > 250 || avgGlucose < 60 ? ["Consulter un médecin rapidement"] : []
                },
                insights,
                recommendations,
                nextSteps: [
                    "Continuez à enregistrer vos mesures quotidiennement",
                    "Suivez les recommandations nutritionnelles personnalisées",
                    "Planifiez votre prochain rendez-vous médical si nécessaire"
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
