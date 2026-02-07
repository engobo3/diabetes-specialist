/**
 * Validates patient data against the defined schema.
 * @param {Object} patient - The patient object to validate.
 * @returns {Object} - { isValid: boolean, error: string | null }
 */
const validatePatient = (patient) => {
    const { name, age, type, status, doctorId } = patient;
    const errors = [];

    // 1. Name Validation
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
        errors.push('Name is required and must be at least 2 characters.');
    }

    // 2. Age Validation
    if (age === undefined || typeof age !== 'number' || age < 0 || age > 120) {
        errors.push('Age is required and must be a number between 0 and 120.');
    }

    // 3. Type Validation
    const allowedTypes = ['Type 1', 'Type 2', 'Gestational', 'Prediabetes'];
    if (!type || !allowedTypes.includes(type)) {
        errors.push(`Type is required. Allowed values: ${allowedTypes.join(', ')}.`);
    }

    // 4. Status Validation
    const allowedStatuses = ['Stable', 'Attention Needed', 'Critical'];
    if (!status || !allowedStatuses.includes(status)) {
        errors.push(`Status is required. Allowed values: ${allowedStatuses.join(', ')}.`);
    }

    // 5. Doctor Link Validation
    if (!doctorId || typeof doctorId !== 'number') {
        errors.push('Doctor ID is required and must be a number to link the patient.');
    }

    if (errors.length > 0) {
        return { isValid: false, error: errors.join(' ') };
    }

    return { isValid: true, error: null };
};


/**
 * Validates doctor data against the defined schema.
 * @param {Object} doctor - The doctor object to validate.
 * @returns {Object} - { isValid: boolean, error: string | null }
 */
const validateDoctor = (doctor) => {
    const { name, specialty, city, contact, education, languages } = doctor;
    const errors = [];

    if (!name || typeof name !== 'string' || name.trim().length < 2) {
        errors.push('Name is required and must be a string (min 2 chars).');
    }

    if (!specialty || typeof specialty !== 'string') {
        errors.push('Specialty is required.');
    }

    if (!city || typeof city !== 'string') {
        errors.push('City is required.');
    }

    if (!contact || typeof contact !== 'object' || !contact.email) {
        errors.push('Contact information with email is required.');
    } else if (typeof contact.email !== 'string' || !contact.email.includes('@')) {
        errors.push('Valid email is required.');
    }

    if (education && !Array.isArray(education)) {
        errors.push('Education must be an array of strings.');
    }

    if (languages && !Array.isArray(languages)) {
        errors.push('Languages must be an array of strings.');
    }

    if (errors.length > 0) {
        return { isValid: false, error: errors.join(' ') };
    }

    return { isValid: true, error: null };
};

module.exports = { validatePatient, validateDoctor };
