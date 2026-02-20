/**
 * Multi-Specialty Vital Type Config Registry
 *
 * Central config defining which vital types each medical specialty uses.
 * Adding a new specialty = adding one entry here. No other files need to change.
 */

const SPECIALTIES = {
    diabetology: {
        label: 'Diabetology / Endocrinology',
        vitalTypes: [
            {
                key: 'Glucose',
                label: 'Glucose',
                unit: 'mg/dL',
                color: '#3b82f6',
                iconName: 'Droplets',
                chartType: 'single',
                chartDataKey: 'glucose',
                formFields: ['glucose'],
                extras: { subtypes: ['Fasting', 'Post-Prandial', 'Random'] }
            },
            {
                key: 'Blood Pressure',
                label: 'Blood Pressure',
                unit: 'mmHg',
                color: '#ef4444',
                iconName: 'Heart',
                chartType: 'dual',
                chartDataKey: ['systolic', 'diastolic'],
                formFields: ['systolic', 'diastolic']
            },
            {
                key: 'Weight',
                label: 'Weight',
                unit: 'kg',
                color: '#10b981',
                iconName: 'Scale',
                chartType: 'single',
                chartDataKey: 'weight',
                formFields: ['weight']
            },
            {
                key: 'HbA1c',
                label: 'HbA1c',
                unit: '%',
                color: '#8b5cf6',
                iconName: 'TestTube',
                chartType: 'single',
                chartDataKey: 'hba1c',
                formFields: ['hba1c']
            }
        ]
    },
    cardiology: {
        label: 'Cardiology',
        vitalTypes: [
            {
                key: 'Blood Pressure',
                label: 'Blood Pressure',
                unit: 'mmHg',
                color: '#ef4444',
                iconName: 'Heart',
                chartType: 'dual',
                chartDataKey: ['systolic', 'diastolic'],
                formFields: ['systolic', 'diastolic']
            },
            {
                key: 'Heart Rate',
                label: 'Heart Rate',
                unit: 'bpm',
                color: '#ec4899',
                iconName: 'HeartPulse',
                chartType: 'single',
                chartDataKey: 'heartRate',
                formFields: ['heartRate']
            },
            {
                key: 'Weight',
                label: 'Weight',
                unit: 'kg',
                color: '#10b981',
                iconName: 'Scale',
                chartType: 'single',
                chartDataKey: 'weight',
                formFields: ['weight']
            },
            {
                key: 'Cholesterol',
                label: 'Cholesterol',
                unit: 'mg/dL',
                color: '#6366f1',
                iconName: 'TestTube',
                chartType: 'single',
                chartDataKey: 'cholesterol',
                formFields: ['cholesterol']
            }
        ]
    },
    pediatrics: {
        label: 'Pediatrics',
        vitalTypes: [
            {
                key: 'Weight',
                label: 'Weight',
                unit: 'kg',
                color: '#10b981',
                iconName: 'Scale',
                chartType: 'single',
                chartDataKey: 'weight',
                formFields: ['weight']
            },
            {
                key: 'Height',
                label: 'Height',
                unit: 'cm',
                color: '#14b8a6',
                iconName: 'Ruler',
                chartType: 'single',
                chartDataKey: 'height',
                formFields: ['height']
            },
            {
                key: 'Temperature',
                label: 'Temperature',
                unit: '°C',
                color: '#f97316',
                iconName: 'Thermometer',
                chartType: 'single',
                chartDataKey: 'temperature',
                formFields: ['temperature']
            },
            {
                key: 'Glucose',
                label: 'Glucose',
                unit: 'mg/dL',
                color: '#3b82f6',
                iconName: 'Droplets',
                chartType: 'single',
                chartDataKey: 'glucose',
                formFields: ['glucose'],
                extras: { subtypes: ['Fasting', 'Post-Prandial', 'Random'] }
            }
        ]
    },
    general: {
        label: 'General Practice',
        vitalTypes: [
            {
                key: 'Blood Pressure',
                label: 'Blood Pressure',
                unit: 'mmHg',
                color: '#ef4444',
                iconName: 'Heart',
                chartType: 'dual',
                chartDataKey: ['systolic', 'diastolic'],
                formFields: ['systolic', 'diastolic']
            },
            {
                key: 'Heart Rate',
                label: 'Heart Rate',
                unit: 'bpm',
                color: '#ec4899',
                iconName: 'HeartPulse',
                chartType: 'single',
                chartDataKey: 'heartRate',
                formFields: ['heartRate']
            },
            {
                key: 'Weight',
                label: 'Weight',
                unit: 'kg',
                color: '#10b981',
                iconName: 'Scale',
                chartType: 'single',
                chartDataKey: 'weight',
                formFields: ['weight']
            },
            {
                key: 'Temperature',
                label: 'Temperature',
                unit: '°C',
                color: '#f97316',
                iconName: 'Thermometer',
                chartType: 'single',
                chartDataKey: 'temperature',
                formFields: ['temperature']
            }
        ]
    }
};

// Map free-form specialty strings to config keys
const SPECIALTY_ALIASES = {
    'diabetes specialist': 'diabetology',
    'diabetologist': 'diabetology',
    'diabetologue': 'diabetology',
    'endocrinologist': 'diabetology',
    'endocrinologue': 'diabetology',
    'pediatric diabetologist': 'diabetology',
    'cardiologist': 'cardiology',
    'cardiologue': 'cardiology',
    'pediatrician': 'pediatrics',
    'pédiatre': 'pediatrics',
    'pediatre': 'pediatrics',
    'general practitioner': 'general',
    'médecin généraliste': 'general',
    'medecin generaliste': 'general',
};

/**
 * Normalize a free-form specialty string to a config key.
 * Falls back to 'diabetology' if not recognized (preserves existing behavior).
 */
function normalizeSpecialty(raw) {
    if (!raw) return 'diabetology';
    const lower = raw.toLowerCase().trim();
    // Direct match
    if (SPECIALTIES[lower]) return lower;
    // Alias match
    if (SPECIALTY_ALIASES[lower]) return SPECIALTY_ALIASES[lower];
    // Partial match
    for (const [alias, key] of Object.entries(SPECIALTY_ALIASES)) {
        if (lower.includes(alias) || alias.includes(lower)) return key;
    }
    return 'diabetology';
}

/**
 * Get the full config for a specialty key.
 */
function getSpecialtyConfig(key) {
    return SPECIALTIES[key] || SPECIALTIES.diabetology;
}

/**
 * List all available specialties (key + label).
 */
function listSpecialties() {
    return Object.entries(SPECIALTIES).map(([key, val]) => ({
        key,
        label: val.label
    }));
}

module.exports = {
    SPECIALTIES,
    SPECIALTY_ALIASES,
    normalizeSpecialty,
    getSpecialtyConfig,
    listSpecialties
};
