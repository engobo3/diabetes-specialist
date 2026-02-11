const { getPopulationAnalytics } = require('../services/populationHealthService');

const getPopulationHealth = async (req, res) => {
    try {
        const analytics = await getPopulationAnalytics();
        res.json(analytics);
    } catch (error) {
        console.error('Error fetching population analytics:', error);
        res.status(500).json({ message: 'Error fetching population analytics' });
    }
};

module.exports = { getPopulationHealth };
