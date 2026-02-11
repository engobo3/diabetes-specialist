const PatientRepository = require('../repositories/PatientRepository');
const VitalRepository = require('../repositories/VitalRepository');
const PrescriptionRepository = require('../repositories/PrescriptionRepository');
const AppointmentRepository = require('../repositories/AppointmentRepository');

const K_ANONYMITY_THRESHOLD = 5;

/**
 * Aggregates population-level health data with k-anonymity.
 * No PII is returned - all data is bucketed/aggregated server-side.
 */
async function getPopulationAnalytics() {
    const patientRepo = new PatientRepository();
    const vitalRepo = new VitalRepository();
    const prescriptionRepo = new PrescriptionRepository();
    const appointmentRepo = new AppointmentRepository();

    // Fetch all raw data
    const [patients, allAppointments] = await Promise.all([
        patientRepo.findAll(),
        appointmentRepo.findAll(),
    ]);

    // Fetch vitals and prescriptions per patient in parallel
    const patientIds = (patients || []).map(p => p.id);
    const [vitalsByPatient, prescriptionsByPatient] = await Promise.all([
        Promise.all(patientIds.map(id => vitalRepo.getByPatientId(id).catch(() => []))),
        Promise.all(patientIds.map(id => prescriptionRepo.findByPatientId(id).catch(() => []))),
    ]);

    const allVitals = vitalsByPatient.flat();
    const allPrescriptions = prescriptionsByPatient.flat();

    return {
        diabetesTypeDistribution: aggregateDiabetesTypes(patients || []),
        glucoseByAgeGroup: aggregateGlucoseByAge(patients || [], vitalsByPatient),
        vitalTrends: aggregateVitalTrends(allVitals),
        topMedications: aggregateTopMedications(allPrescriptions),
        appointmentVolume: aggregateAppointmentVolume(allAppointments || []),
        totalPatients: (patients || []).length,
    };
}

/**
 * 1. Diabetes type distribution (Pie chart)
 */
function aggregateDiabetesTypes(patients) {
    const counts = {};
    patients.forEach(p => {
        const type = p.type || 'Unknown';
        counts[type] = (counts[type] || 0) + 1;
    });

    return applyKAnonymity(counts);
}

/**
 * 2. Average glucose by age group (Bar chart)
 */
function aggregateGlucoseByAge(patients, vitalsByPatient) {
    const ageBuckets = { '0-18': [], '19-35': [], '36-55': [], '56+': [] };

    patients.forEach((p, idx) => {
        const age = parseInt(p.age);
        if (!age || isNaN(age)) return;

        const bucket = age <= 18 ? '0-18' : age <= 35 ? '19-35' : age <= 55 ? '36-55' : '56+';
        const patientVitals = vitalsByPatient[idx] || [];
        const glucoseReadings = patientVitals
            .filter(v => (v.category || v.type) === 'Glucose' && v.value)
            .map(v => parseFloat(v.value))
            .filter(v => !isNaN(v));

        if (glucoseReadings.length > 0) {
            const avg = glucoseReadings.reduce((a, b) => a + b, 0) / glucoseReadings.length;
            ageBuckets[bucket].push(avg);
        }
    });

    return Object.entries(ageBuckets)
        .filter(([, values]) => values.length >= K_ANONYMITY_THRESHOLD)
        .map(([group, values]) => ({
            ageGroup: group,
            avgGlucose: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
            patientCount: values.length,
        }));
}

/**
 * 3. Vital trends over time (Line chart - monthly averages)
 */
function aggregateVitalTrends(allVitals) {
    const monthlyBuckets = {};

    allVitals.forEach(v => {
        if (!v.date) return;
        const type = v.category || v.type;
        if (type !== 'Glucose') return; // Focus on glucose for trends

        const val = parseFloat(v.value);
        if (isNaN(val)) return;

        const date = new Date(v.date);
        if (isNaN(date.getTime())) return;
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        if (!monthlyBuckets[monthKey]) monthlyBuckets[monthKey] = [];
        monthlyBuckets[monthKey].push(val);
    });

    return Object.entries(monthlyBuckets)
        .filter(([, values]) => values.length >= K_ANONYMITY_THRESHOLD)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, values]) => ({
            month,
            avgGlucose: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
            readingCount: values.length,
        }));
}

/**
 * 4. Most prescribed medications (Bar chart - top 10)
 */
function aggregateTopMedications(allPrescriptions) {
    const counts = {};
    allPrescriptions.forEach(rx => {
        const med = (rx.medication || '').trim();
        if (!med) return;
        counts[med] = (counts[med] || 0) + 1;
    });

    return Object.entries(counts)
        .filter(([, count]) => count >= K_ANONYMITY_THRESHOLD)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([medication, count]) => ({ medication, count }));
}

/**
 * 5. Appointment volume over time (Area chart - monthly counts)
 */
function aggregateAppointmentVolume(allAppointments) {
    const monthlyBuckets = {};

    allAppointments.forEach(a => {
        if (!a.date) return;
        const date = new Date(a.date);
        if (isNaN(date.getTime())) return;
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyBuckets[monthKey] = (monthlyBuckets[monthKey] || 0) + 1;
    });

    return Object.entries(monthlyBuckets)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, count]) => ({ month, appointments: count }));
}

/**
 * K-anonymity helper: merge groups with fewer than K members into "Autre"
 */
function applyKAnonymity(counts) {
    const result = [];
    let otherCount = 0;

    Object.entries(counts).forEach(([key, count]) => {
        if (count >= K_ANONYMITY_THRESHOLD) {
            result.push({ name: key, value: count });
        } else {
            otherCount += count;
        }
    });

    if (otherCount > 0) {
        result.push({ name: 'Autre', value: otherCount });
    }

    return result;
}

module.exports = { getPopulationAnalytics };
