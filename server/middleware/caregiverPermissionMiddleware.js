const PatientRepository = require('../repositories/PatientRepository');
const patientRepo = new PatientRepository();

/**
 * Middleware to check if user has permission to access patient data
 * @param {string} requiredPermission - The permission to check (e.g., 'viewVitals', 'addVitals')
 * @returns {Function} Express middleware function
 */
const checkCaregiverPermission = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const { patientId, id } = req.params;
      const targetPatientId = patientId || id;

      if (!targetPatientId) {
        return res.status(400).json({ message: 'Patient ID required' });
      }

      const userEmail = req.user.email;

      // Fetch patient
      const patient = await patientRepo.findById(targetPatientId);
      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }

      // Check if user is the patient themselves
      if (patient.email && patient.email.toLowerCase() === userEmail.toLowerCase()) {
        // Patients have full access to their own data
        return next();
      }

      // Check if user is the assigned doctor
      if (req.user.role === 'doctor' || req.user.role === 'admin') {
        // Doctors and admins have full access
        return next();
      }

      // Check if user is a caregiver with permission
      const caregiver = patient.caregivers?.find(
        cg => cg.email.toLowerCase() === userEmail.toLowerCase()
      );

      if (!caregiver) {
        return res.status(403).json({
          message: 'Unauthorized: Not a caregiver for this patient'
        });
      }

      if (caregiver.status === 'suspended') {
        return res.status(403).json({
          message: 'Unauthorized: Caregiver access suspended'
        });
      }

      // Check specific permission
      if (!caregiver.permissions || !caregiver.permissions[requiredPermission]) {
        return res.status(403).json({
          message: `Unauthorized: Missing permission '${requiredPermission}'`
        });
      }

      // Permission granted
      next();
    } catch (error) {
      console.error('Permission check error:', error);
      res.status(500).json({ message: 'Error checking permissions' });
    }
  };
};

/**
 * Middleware to check if user has any caregiver relationship with patient
 * (doesn't check specific permissions)
 */
const checkCaregiverRelationship = async (req, res, next) => {
  try {
    const { patientId, id } = req.params;
    const targetPatientId = patientId || id;

    if (!targetPatientId) {
      return res.status(400).json({ message: 'Patient ID required' });
    }

    const userEmail = req.user.email;

    // Fetch patient
    const patient = await patientRepo.findById(targetPatientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Check if user is the patient themselves
    if (patient.email && patient.email.toLowerCase() === userEmail.toLowerCase()) {
      return next();
    }

    // Check if user is doctor/admin
    if (req.user.role === 'doctor' || req.user.role === 'admin') {
      return next();
    }

    // Check if user is a caregiver (any permission)
    const caregiver = patient.caregivers?.find(
      cg => cg.email.toLowerCase() === userEmail.toLowerCase()
    );

    if (!caregiver || caregiver.status === 'suspended') {
      return res.status(403).json({
        message: 'Unauthorized: No caregiver relationship with this patient'
      });
    }

    next();
  } catch (error) {
    console.error('Relationship check error:', error);
    res.status(500).json({ message: 'Error checking caregiver relationship' });
  }
};

module.exports = {
  checkCaregiverPermission,
  checkCaregiverRelationship
};
