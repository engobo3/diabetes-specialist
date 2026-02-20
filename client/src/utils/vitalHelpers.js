import {
    Droplets, Heart, Scale, Activity, HeartPulse, TestTube, Ruler, Thermometer
} from 'lucide-react';

const ICON_MAP = {
    Droplets,
    Heart,
    Scale,
    Activity,
    HeartPulse,
    TestTube,
    Ruler,
    Thermometer,
};

/**
 * Resolve an icon name string to a lucide-react component.
 */
export function resolveIcon(iconName) {
    return ICON_MAP[iconName] || Activity;
}

/**
 * Build a unit map from vitalTypes array: { "Glucose": "mg/dL", ... }
 */
export function buildUnitMap(vitalTypes) {
    const map = {};
    for (const vt of vitalTypes) {
        map[vt.key] = vt.unit;
    }
    return map;
}

/**
 * Get the default vital type key (first in config list).
 */
export function getDefaultVitalType(vitalTypes) {
    return vitalTypes?.[0]?.key || 'Glucose';
}

/**
 * Look up a vital type config object from the vitalTypes array by key.
 */
export function findVitalType(vitalTypes, key) {
    return vitalTypes?.find(vt => vt.key === key) || null;
}

/**
 * Get the chart data key(s) for a vital type.
 * Returns a string or array of strings.
 */
export function getChartDataKey(vitalTypeConfig) {
    if (!vitalTypeConfig) return 'value';
    return vitalTypeConfig.chartDataKey || 'value';
}

/**
 * Build the payload to submit a vital reading based on config.
 */
export function buildPayload(vitalTypeConfig, formData) {
    const payload = {
        type: vitalTypeConfig.key,
        category: vitalTypeConfig.key,
        date: formData.date,
    };

    if (vitalTypeConfig.chartType === 'dual') {
        // Blood Pressure style: systolic/diastolic
        const sys = parseInt(formData.systolic);
        const dia = parseInt(formData.diastolic);
        payload.systolic = sys;
        payload.diastolic = dia;
        payload.value = `${sys}/${dia}`;
    } else {
        // Single-value vital
        const fieldKey = vitalTypeConfig.formFields[0];
        const val = parseFloat(formData[fieldKey] ?? formData.value);
        payload.value = val;
        // Store under the specific field key too (e.g., glucose, weight, heartRate)
        payload[fieldKey] = val;
    }

    // Glucose subtype
    if (vitalTypeConfig.extras?.subtypes && formData.subtype) {
        payload.subtype = formData.subtype;
    }

    return payload;
}

/**
 * French labels for vital type keys used in UI.
 */
const VITAL_LABELS_FR = {
    'Glucose': 'Glucose',
    'Blood Pressure': 'Tension',
    'Weight': 'Poids',
    'Heart Rate': 'Rythme',
    'HbA1c': 'HbA1c',
    'Cholesterol': 'Cholestérol',
    'Height': 'Taille',
    'Temperature': 'Température',
};

export function getVitalLabelFr(key) {
    return VITAL_LABELS_FR[key] || key;
}

/**
 * French labels for form fields.
 */
const FIELD_LABELS_FR = {
    glucose: 'Glucose (mg/dL)',
    systolic: 'Systolique',
    diastolic: 'Diastolique',
    weight: 'Poids (kg)',
    heartRate: 'Rythme (bpm)',
    hba1c: 'HbA1c (%)',
    cholesterol: 'Cholestérol (mg/dL)',
    height: 'Taille (cm)',
    temperature: 'Température (°C)',
};

export function getFieldLabelFr(fieldKey) {
    return FIELD_LABELS_FR[fieldKey] || fieldKey;
}

/**
 * Default specialty config (diabetology) to use while the API config is loading.
 * Matches the existing hardcoded behavior so there's no flash of empty content.
 */
export const DEFAULT_VITAL_TYPES = [
    {
        key: 'Glucose', label: 'Glucose', unit: 'mg/dL', color: '#3b82f6',
        iconName: 'Droplets', chartType: 'single', chartDataKey: 'glucose',
        formFields: ['glucose'], extras: { subtypes: ['Fasting', 'Post-Prandial', 'Random'] }
    },
    {
        key: 'Blood Pressure', label: 'Blood Pressure', unit: 'mmHg', color: '#ef4444',
        iconName: 'Heart', chartType: 'dual', chartDataKey: ['systolic', 'diastolic'],
        formFields: ['systolic', 'diastolic']
    },
    {
        key: 'Weight', label: 'Weight', unit: 'kg', color: '#10b981',
        iconName: 'Scale', chartType: 'single', chartDataKey: 'weight',
        formFields: ['weight']
    },
    {
        key: 'HbA1c', label: 'HbA1c', unit: '%', color: '#8b5cf6',
        iconName: 'TestTube', chartType: 'single', chartDataKey: 'hba1c',
        formFields: ['hba1c']
    }
];
