const footRiskService = require('../services/footRiskService');

const REQUIRED_FIELDS = ['hba1c', 'crp', 'creatinine', 'albumin', 'esr', 'sodium', 'age', 'diabetes_duration_years'];

const predictFootRisk = async (req, res) => {
    try {
        const { patientId } = req.params;
        const biomarkers = req.body;

        // Validate required fields
        const missing = REQUIRED_FIELDS.filter(f => biomarkers[f] === undefined || biomarkers[f] === null || biomarkers[f] === '');
        if (missing.length > 0) {
            return res.status(400).json({ error: 'Champs manquants', details: missing });
        }

        // Parse numeric values
        const parsed = {};
        for (const field of REQUIRED_FIELDS) {
            parsed[field] = parseFloat(biomarkers[field]);
            if (isNaN(parsed[field])) {
                return res.status(400).json({ error: `Valeur invalide pour ${field}` });
            }
        }

        // Boolean fields
        parsed.diabetes_type = biomarkers.diabetes_type || '';
        parsed.has_hypertension = !!biomarkers.has_hypertension;
        parsed.has_neuropathy = !!biomarkers.has_neuropathy;
        parsed.has_pvd = !!biomarkers.has_pvd;

        const lang = biomarkers.lang || 'fr';
        const result = await footRiskService.predict(parsed, lang);

        // Build assessment data
        const assessmentData = {
            ...result,
            input: parsed,
            assessedAt: new Date().toISOString(),
            assessedBy: req.user?.uid || null
        };

        // Attach wound data if present
        if (biomarkers.woundImages && Array.isArray(biomarkers.woundImages) && biomarkers.woundImages.length > 0) {
            assessmentData.woundImages = biomarkers.woundImages;
        }
        if (biomarkers.woundAnalysis && typeof biomarkers.woundAnalysis === 'object') {
            assessmentData.woundAnalysis = biomarkers.woundAnalysis;
        }

        await footRiskService.saveAssessment(patientId, assessmentData);

        res.json({ ...result, woundAnalysis: biomarkers.woundAnalysis || null });
    } catch (error) {
        console.error('Foot Risk Prediction Error:', error);
        res.status(500).json({ error: 'Erreur lors de la prediction du risque podologique' });
    }
};

const getFootRiskHistory = async (req, res) => {
    try {
        const { patientId } = req.params;
        const history = await footRiskService.getAssessmentHistory(patientId);
        res.json(history);
    } catch (error) {
        console.error('Foot Risk History Error:', error);
        res.status(500).json({ error: "Erreur lors de la recuperation de l'historique" });
    }
};

const analyzeWoundImage = async (req, res) => {
    try {
        const { imageUrls, patientContext, lang } = req.body;

        if (!imageUrls || !Array.isArray(imageUrls) || imageUrls.length === 0) {
            return res.status(400).json({ error: 'Au moins une image est requise' });
        }
        if (imageUrls.length > 3) {
            return res.status(400).json({ error: 'Maximum 3 images autorisees' });
        }

        const analysis = await footRiskService.analyzeWoundImages(imageUrls, patientContext || {}, lang || 'fr');
        res.json(analysis);
    } catch (error) {
        console.error('Wound Analysis Error:', error);
        res.status(500).json({ error: "Erreur lors de l'analyse de la plaie" });
    }
};

module.exports = { predictFootRisk, getFootRiskHistory, analyzeWoundImage };
