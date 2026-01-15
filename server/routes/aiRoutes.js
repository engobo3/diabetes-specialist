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

module.exports = router;
