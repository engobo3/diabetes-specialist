/**
 * GlucoBot AI Agent — Tool declarations & execution handlers
 * Uses Gemini Function Calling format.
 */

const { db } = require('../config/firebaseConfig');
const {
    getAppointments,
    createAppointment,
    addVital,
    getVitals,
    getPrescriptions,
    createPrescription,
    getPatientById,
    getPatientsByDoctorId,
} = require('./database');
const MedicationScheduleRepository = require('../repositories/MedicationScheduleRepository');
const DoctorEventRepository = require('../repositories/DoctorEventRepository');
const { createNotification } = require('./notificationService');

const medScheduleRepo = new MedicationScheduleRepository();
const doctorEventRepo = new DoctorEventRepository();

// ─── Shared: Slot Computation ──────────────────────────────────────
/**
 * Compute available time slots for a doctor on a given date.
 * Extracted from doctorController.getAvailableSlots for reuse by agent tools.
 * @param {string} doctorId
 * @param {string} dateStr - YYYY-MM-DD
 * @returns {{ slots: string[], slotDuration: number, date: string }}
 */
async function computeAvailableSlots(doctorId, dateStr) {
    // Fetch doctor
    let doctorData = null;
    const docRef = db.collection('doctors').doc(String(doctorId));
    const docShot = await docRef.get();

    if (docShot.exists) {
        doctorData = docShot.data();
    } else {
        const numId = parseInt(doctorId);
        if (!isNaN(numId)) {
            const snapshot = await db.collection('doctors').where('id', '==', numId).limit(1).get();
            if (!snapshot.empty) {
                doctorData = snapshot.docs[0].data();
            }
        }
    }

    if (!doctorData) {
        return { slots: [], slotDuration: 30, date: dateStr, error: 'Medecin non trouve' };
    }

    const availability = doctorData.availability || {};
    const slotDuration = doctorData.slotDuration || 30;

    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const dateObj = new Date(dateStr + 'T00:00:00');
    const dayOfWeek = dayNames[dateObj.getDay()];

    const dayRanges = availability[dayOfWeek];
    if (!dayRanges || dayRanges.length === 0) {
        return { slots: [], slotDuration, date: dateStr, message: 'Medecin non disponible ce jour' };
    }

    // Generate all possible slots
    const allSlots = [];
    for (const range of dayRanges) {
        const [startH, startM] = range.start.split(':').map(Number);
        const [endH, endM] = range.end.split(':').map(Number);
        let currentMinutes = startH * 60 + startM;
        const endMinutes = endH * 60 + endM;

        while (currentMinutes + slotDuration <= endMinutes) {
            const h = String(Math.floor(currentMinutes / 60)).padStart(2, '0');
            const m = String(currentMinutes % 60).padStart(2, '0');
            allSlots.push(`${h}:${m}`);
            currentMinutes += slotDuration;
        }
    }

    // Filter booked appointments
    const appointments = await getAppointments(doctorId);
    const activeStatuses = ['pending', 'confirmed', 'Scheduled'];
    const bookedTimes = appointments
        .filter(a => a.date === dateStr && activeStatuses.includes(a.status))
        .map(a => a.time);

    // Filter doctor personal events
    const doctorEvents = await doctorEventRepo.findByDoctorAndDate(doctorId, dateStr);
    const blockedSlots = new Set();
    for (const evt of doctorEvents) {
        const evtStartMin = parseInt(evt.startTime.split(':')[0]) * 60 + parseInt(evt.startTime.split(':')[1]);
        const evtEndMin = parseInt(evt.endTime.split(':')[0]) * 60 + parseInt(evt.endTime.split(':')[1]);
        for (const slot of allSlots) {
            const slotMin = parseInt(slot.split(':')[0]) * 60 + parseInt(slot.split(':')[1]);
            if (slotMin >= evtStartMin && slotMin < evtEndMin) {
                blockedSlots.add(slot);
            }
        }
    }

    const availableSlots = allSlots.filter(slot => !bookedTimes.includes(slot) && !blockedSlots.has(slot));

    return { slots: availableSlots, slotDuration, date: dateStr, doctorName: doctorData.name };
}

// ─── Tool Declarations (Gemini functionDeclarations format) ─────────

const PATIENT_TOOLS = [
    {
        name: 'get_available_slots',
        description: "Recuperer les creneaux disponibles d'un medecin pour une date donnee. Utilise cette fonction quand le patient veut connaitre les disponibilites ou prendre rendez-vous.",
        parameters: {
            type: 'OBJECT',
            properties: {
                doctorId: { type: 'STRING', description: "ID du medecin" },
                date: { type: 'STRING', description: "Date au format YYYY-MM-DD" }
            },
            required: ['doctorId', 'date']
        }
    },
    {
        name: 'book_appointment',
        description: "Reserver un rendez-vous medical. Utilise apres avoir verifie les creneaux disponibles. Demande confirmation au patient avant de reserver.",
        parameters: {
            type: 'OBJECT',
            properties: {
                doctorId: { type: 'STRING', description: "ID du medecin" },
                date: { type: 'STRING', description: "Date au format YYYY-MM-DD" },
                time: { type: 'STRING', description: "Heure au format HH:MM" },
                reason: { type: 'STRING', description: "Motif du rendez-vous" }
            },
            required: ['doctorId', 'date', 'time']
        }
    },
    {
        name: 'log_vital',
        description: "Enregistrer une mesure de sante (glycemie, tension, poids, etc.). Utilise quand le patient donne une valeur a enregistrer.",
        parameters: {
            type: 'OBJECT',
            properties: {
                category: {
                    type: 'STRING',
                    description: "Type de mesure",
                    enum: ['Glucose', 'Blood Pressure', 'Weight', 'HbA1c', 'Heart Rate', 'Temperature']
                },
                value: { type: 'NUMBER', description: "Valeur de la mesure (pas pour tension arterielle)" },
                systolic: { type: 'NUMBER', description: "Pression systolique (tension uniquement)" },
                diastolic: { type: 'NUMBER', description: "Pression diastolique (tension uniquement)" },
                notes: { type: 'STRING', description: "Notes optionnelles" }
            },
            required: ['category']
        }
    },
    {
        name: 'get_health_summary',
        description: "Obtenir un resume complet de la sante du patient: dernieres mesures, medicaments actifs, prochains rendez-vous. Utilise pour donner une vue d'ensemble.",
        parameters: {
            type: 'OBJECT',
            properties: {},
            required: []
        }
    },
    {
        name: 'check_medications',
        description: "Consulter la liste des medicaments actifs du patient avec leurs horaires. Utilise quand le patient pose des questions sur ses medicaments.",
        parameters: {
            type: 'OBJECT',
            properties: {},
            required: []
        }
    },
    {
        name: 'log_medication_taken',
        description: "Enregistrer la prise ou l'oubli d'un medicament. Utilise quand le patient signale avoir pris ou oublie un medicament.",
        parameters: {
            type: 'OBJECT',
            properties: {
                medicationName: { type: 'STRING', description: "Nom du medicament" },
                taken: { type: 'BOOLEAN', description: "true si pris, false si oublie" },
                notes: { type: 'STRING', description: "Notes optionnelles" }
            },
            required: ['medicationName', 'taken']
        }
    },
    {
        name: 'trigger_emergency_alert',
        description: "Envoyer une alerte d'urgence au medecin du patient. UTILISE UNIQUEMENT en cas de symptomes graves: douleur thoracique, glycemie tres basse (<54) ou tres haute (>300), perte de connaissance, difficulte a respirer.",
        parameters: {
            type: 'OBJECT',
            properties: {
                symptomDescription: { type: 'STRING', description: "Description des symptomes du patient" }
            },
            required: ['symptomDescription']
        }
    }
];

const DOCTOR_TOOLS = [
    {
        name: 'generate_patient_summary',
        description: "Generer un resume complet d'un patient: demographiques, tendances des signes vitaux, medicaments, rendez-vous recents. Pour pre-consultation ou revue rapide.",
        parameters: {
            type: 'OBJECT',
            properties: {
                patientId: { type: 'STRING', description: "ID du patient" }
            },
            required: ['patientId']
        }
    },
    {
        name: 'draft_soap_note',
        description: "Rediger une note SOAP structuree pour une consultation. Genere un brouillon base sur les donnees du patient et le motif de consultation.",
        parameters: {
            type: 'OBJECT',
            properties: {
                patientId: { type: 'STRING', description: "ID du patient" },
                chiefComplaint: { type: 'STRING', description: "Motif principal de consultation" },
                findings: { type: 'STRING', description: "Observations cliniques (optionnel)" }
            },
            required: ['patientId', 'chiefComplaint']
        }
    },
    {
        name: 'draft_prescription',
        description: "Creer une ordonnance pour un patient. Enregistre directement dans le dossier du patient.",
        parameters: {
            type: 'OBJECT',
            properties: {
                patientId: { type: 'STRING', description: "ID du patient" },
                medication: { type: 'STRING', description: "Nom du medicament" },
                dosage: { type: 'STRING', description: "Dosage (ex: 500mg)" },
                frequency: { type: 'STRING', description: "Frequence (ex: 2x/jour)" },
                duration: { type: 'STRING', description: "Duree (ex: 30 jours)" },
                notes: { type: 'STRING', description: "Instructions supplementaires" }
            },
            required: ['patientId', 'medication', 'dosage', 'frequency']
        }
    },
    {
        name: 'find_empty_slots',
        description: "Trouver les creneaux libres du medecin pour une date donnee. Utile pour planifier ou reorganiser des consultations.",
        parameters: {
            type: 'OBJECT',
            properties: {
                date: { type: 'STRING', description: "Date au format YYYY-MM-DD" }
            },
            required: ['date']
        }
    }
];

// ─── Tool Execution Handlers ────────────────────────────────────────

/**
 * Execute a tool call and return structured result.
 * @param {string} toolName
 * @param {Object} args
 * @param {{ userId: string, role: string, patientId: string, doctorId: string }} context
 */
async function executeToolCall(toolName, args, context) {
    try {
        switch (toolName) {
            case 'get_available_slots': {
                const { doctorId, date } = args;
                if (!doctorId || !date) return { success: false, error: 'doctorId et date requis' };
                const result = await computeAvailableSlots(doctorId, date);
                return { success: true, ...result };
            }

            case 'book_appointment': {
                const { doctorId, date, time, reason } = args;
                if (!doctorId || !date || !time) return { success: false, error: 'doctorId, date et time requis' };

                // Verify slot is available
                const slotCheck = await computeAvailableSlots(doctorId, date);
                if (!slotCheck.slots.includes(time)) {
                    return { success: false, error: `Le creneau ${time} n'est pas disponible le ${date}` };
                }

                const appointment = await createAppointment({
                    patientId: context.patientId,
                    doctorId: String(doctorId),
                    date,
                    time,
                    reason: reason || 'Consultation',
                    status: 'pending',
                    createdAt: new Date().toISOString()
                });

                // Notify doctor
                createNotification({
                    userId: String(doctorId),
                    type: 'appointment_new',
                    title: 'Nouveau rendez-vous',
                    body: `Rendez-vous le ${date} a ${time}`,
                    data: { appointmentId: appointment.id, patientId: context.patientId }
                }).catch(() => {});

                return { success: true, appointmentId: appointment.id, date, time, doctorName: slotCheck.doctorName };
            }

            case 'log_vital': {
                const { category, value, systolic, diastolic, notes } = args;
                if (!category) return { success: false, error: 'category requis' };

                const vitalData = {
                    category,
                    date: new Date().toISOString().split('T')[0],
                    time: new Date().toTimeString().slice(0, 5),
                    notes: notes || ''
                };

                if (category === 'Blood Pressure') {
                    if (!systolic || !diastolic) return { success: false, error: 'systolic et diastolic requis pour la tension' };
                    vitalData.systolic = systolic;
                    vitalData.diastolic = diastolic;
                } else {
                    if (value == null) return { success: false, error: 'value requis pour cette mesure' };
                    vitalData.value = value;
                }

                await addVital(context.patientId, vitalData);
                return { success: true, category, value: value || `${systolic}/${diastolic}`, date: vitalData.date };
            }

            case 'get_health_summary': {
                const patientId = context.patientId;
                const [vitalsData, prescriptions, appointments, patient] = await Promise.all([
                    getVitals(patientId),
                    getPrescriptions(patientId),
                    context.doctorId ? getAppointments(context.doctorId) : Promise.resolve([]),
                    getPatientById(patientId)
                ]);

                const readings = vitalsData?.readings || vitalsData || [];
                const recentByCategory = {};
                const categories = ['Glucose', 'Blood Pressure', 'Weight', 'HbA1c', 'Heart Rate'];
                for (const cat of categories) {
                    const filtered = (Array.isArray(readings) ? readings : [])
                        .filter(v => (v.category || v.type) === cat)
                        .sort((a, b) => new Date(b.date) - new Date(a.date))
                        .slice(0, 3);
                    if (filtered.length) recentByCategory[cat] = filtered;
                }

                const activeMeds = prescriptions?.map(p => ({
                    medication: p.medication,
                    dosage: p.dosage,
                    frequency: p.frequency || p.instructions
                })) || [];

                const upcomingAppts = appointments
                    .filter(a => a.patientId == patientId && new Date(a.date) >= new Date() && a.status !== 'cancelled')
                    .sort((a, b) => new Date(a.date) - new Date(b.date))
                    .slice(0, 3)
                    .map(a => ({ date: a.date, time: a.time, status: a.status }));

                return {
                    success: true,
                    patient: { name: patient?.name, age: patient?.age, type: patient?.type || patient?.diabetesType },
                    recentVitals: recentByCategory,
                    medications: activeMeds,
                    upcomingAppointments: upcomingAppts
                };
            }

            case 'check_medications': {
                const schedules = await medScheduleRepo.findActiveByPatientId(context.patientId);
                const meds = schedules.map(s => ({
                    name: s.medicationName || s.medication,
                    dosage: s.dosage,
                    frequency: s.frequency,
                    times: s.times || [],
                    active: s.active !== false
                }));
                return { success: true, medications: meds };
            }

            case 'log_medication_taken': {
                const { medicationName, taken, notes } = args;
                if (!medicationName) return { success: false, error: 'medicationName requis' };

                // Find the schedule for this medication
                const schedules = await medScheduleRepo.findByPatientId(context.patientId);
                const schedule = schedules.find(s =>
                    (s.medicationName || s.medication || '').toLowerCase().includes(medicationName.toLowerCase())
                );

                if (schedule) {
                    const log = {
                        date: new Date().toISOString(),
                        taken,
                        notes: notes || ''
                    };
                    const adherenceLog = schedule.adherenceLog || [];
                    adherenceLog.push(log);
                    await medScheduleRepo.update(schedule.id, { adherenceLog });
                }

                return {
                    success: true,
                    medicationName,
                    taken,
                    loggedAt: new Date().toISOString()
                };
            }

            case 'trigger_emergency_alert': {
                const { symptomDescription } = args;
                if (!symptomDescription) return { success: false, error: 'symptomDescription requis' };

                // Find the patient's assigned doctor
                const patient = await getPatientById(context.patientId);
                const doctorId = patient?.doctorId || context.doctorId;

                if (!doctorId) {
                    return { success: false, error: "Aucun medecin assigne. Veuillez appeler les urgences." };
                }

                await createNotification({
                    userId: String(doctorId),
                    type: 'emergency_alert',
                    title: 'ALERTE URGENTE',
                    body: `Patient ${patient?.name || 'inconnu'}: ${symptomDescription}`,
                    data: {
                        patientId: context.patientId,
                        symptomDescription,
                        alertTime: new Date().toISOString()
                    }
                });

                return {
                    success: true,
                    message: 'Alerte envoyee a votre medecin. En cas de danger immediat, appelez les urgences.',
                    doctorNotified: true
                };
            }

            // ─── Doctor Tools ───────────────────────────────────────

            case 'generate_patient_summary': {
                const { patientId } = args;
                if (!patientId) return { success: false, error: 'patientId requis' };

                const [patient, vitalsData, prescriptions, appointments] = await Promise.all([
                    getPatientById(patientId),
                    getVitals(patientId),
                    getPrescriptions(patientId),
                    getAppointments(context.doctorId)
                ]);

                if (!patient) return { success: false, error: 'Patient non trouve' };

                const readings = vitalsData?.readings || vitalsData || [];
                const recentByCategory = {};
                for (const cat of ['Glucose', 'Blood Pressure', 'Weight', 'HbA1c', 'Heart Rate']) {
                    const filtered = (Array.isArray(readings) ? readings : [])
                        .filter(v => (v.category || v.type) === cat)
                        .sort((a, b) => new Date(b.date) - new Date(a.date))
                        .slice(0, 5);
                    if (filtered.length) recentByCategory[cat] = filtered;
                }

                const patientAppts = appointments
                    .filter(a => String(a.patientId) === String(patientId))
                    .sort((a, b) => new Date(b.date) - new Date(a.date))
                    .slice(0, 5);

                return {
                    success: true,
                    patient: {
                        name: patient.name,
                        age: patient.age,
                        type: patient.type || patient.diabetesType,
                        conditions: patient.conditions || [],
                        allergies: patient.allergies || [],
                        status: patient.status
                    },
                    recentVitals: recentByCategory,
                    medications: prescriptions?.map(p => ({
                        medication: p.medication,
                        dosage: p.dosage,
                        frequency: p.frequency || p.instructions,
                        date: p.date
                    })) || [],
                    recentAppointments: patientAppts.map(a => ({
                        date: a.date,
                        time: a.time,
                        reason: a.reason,
                        status: a.status
                    }))
                };
            }

            case 'draft_soap_note': {
                // Returns structured data — the AI will format the actual SOAP note text
                const { patientId, chiefComplaint, findings } = args;
                if (!patientId || !chiefComplaint) return { success: false, error: 'patientId et chiefComplaint requis' };

                const [patient, vitalsData, prescriptions] = await Promise.all([
                    getPatientById(patientId),
                    getVitals(patientId),
                    getPrescriptions(patientId)
                ]);

                if (!patient) return { success: false, error: 'Patient non trouve' };

                const readings = vitalsData?.readings || vitalsData || [];
                const latestVitals = {};
                for (const cat of ['Glucose', 'Blood Pressure', 'Weight', 'Heart Rate', 'Temperature']) {
                    const latest = (Array.isArray(readings) ? readings : [])
                        .filter(v => (v.category || v.type) === cat)
                        .sort((a, b) => new Date(b.date) - new Date(a.date))[0];
                    if (latest) latestVitals[cat] = latest;
                }

                return {
                    success: true,
                    soapContext: {
                        patient: { name: patient.name, age: patient.age, type: patient.type || patient.diabetesType },
                        chiefComplaint,
                        findings: findings || '',
                        latestVitals,
                        currentMedications: prescriptions?.map(p => `${p.medication} ${p.dosage}`) || []
                    }
                };
            }

            case 'draft_prescription': {
                const { patientId, medication, dosage, frequency, duration, notes } = args;
                if (!patientId || !medication || !dosage || !frequency) {
                    return { success: false, error: 'patientId, medication, dosage et frequency requis' };
                }

                const prescription = await createPrescription({
                    patientId: String(patientId),
                    doctorId: context.doctorId,
                    medication,
                    dosage,
                    frequency,
                    duration: duration || '',
                    instructions: notes || '',
                    date: new Date().toISOString().split('T')[0],
                    status: 'active'
                });

                return {
                    success: true,
                    prescriptionId: prescription.id,
                    medication,
                    dosage,
                    frequency,
                    duration: duration || 'non specifie'
                };
            }

            case 'find_empty_slots': {
                const { date } = args;
                if (!date) return { success: false, error: 'date requis' };
                const result = await computeAvailableSlots(context.doctorId, date);
                return { success: true, ...result };
            }

            default:
                return { success: false, error: `Outil inconnu: ${toolName}` };
        }
    } catch (error) {
        console.error(`Agent tool execution error [${toolName}]:`, error);
        return { success: false, error: error.message || 'Erreur interne' };
    }
}

// ─── Role-based tool selection ──────────────────────────────────────

function getToolsForRole(role) {
    if (role === 'doctor' || role === 'admin') {
        return DOCTOR_TOOLS;
    }
    // patient, caregiver
    return PATIENT_TOOLS;
}

module.exports = {
    PATIENT_TOOLS,
    DOCTOR_TOOLS,
    getToolsForRole,
    executeToolCall,
    computeAvailableSlots
};
