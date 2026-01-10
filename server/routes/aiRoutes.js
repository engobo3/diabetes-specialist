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

        // Use the Gemini model
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
        const text = response.text();

        res.json({ reply: text });

    } catch (error) {
        console.error("AI Error:", error);
        res.status(500).json({
            error: "Failed to generate response",
            details: error.message
        });
    }
});

router.post('/forecast', async (req, res) => {
    try {
        const { history, type } = req.body; // history is array of { date, value }, type is 'Glucose', etc.

        if (!history || history.length < 3) {
            return res.status(400).json({ error: "Need at least 3 data points for forecasting" });
        }

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

        const data = JSON.parse(text);
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
