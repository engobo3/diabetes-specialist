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
      // Short-circuit for staff roles BEFORE any DB lookup. Most requests on
      // patient-scoped routes come from doctors/admins; hitting Firestore for
      // every one of those is wasteful, and it also broke tests that mocked
      // the controller but not the repository.
      const role = req.user?.role;
      if (role === 'doctor' || role === 'admin') {
        return next();
      }

      // Patients accessing their own data identify by patientId (set by
      // verifyToken from users/{uid}.patientId). Short-circuit on that match
      // before hitting the DB.
      const { patientId, id } = req.params;
      const targetPatientId = patientId || id;
      if (!targetPatientId) {
        return res.status(400).json({ message: 'Patient ID required' });
      }
      if (role === 'patient' && req.user?.patientId != null &&
          String(req.user.patientId) === String(targetPatientId)) {
        return next();
      }

      const userEmail = req.user?.email;
      if (!userEmail) {
        return res.status(403).json({ message: 'No email on token' });
      }

      // Fetch patient (caregivers only past this point)
      const patient = await patientRepo.findById(targetPatientId);
      if (!patient) {
        return res.status(404).json({ message: 'Patient not found' });
      }

      // Patient self-access via email match (in case patientId wasn't enriched)
      if (patient.email && patient.email.toLowerCase() === userEmail.toLowerCase()) {
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
    // Same short-circuit pattern as checkCaregiverPermission.
    const role = req.user?.role;
    if (role === 'doctor' || role === 'admin') {
      return next();
    }

    const { patientId, id } = req.params;
    const targetPatientId = patientId || id;
    if (!targetPatientId) {
      return res.status(400).json({ message: 'Patient ID required' });
    }

    if (role === 'patient' && req.user?.patientId != null &&
        String(req.user.patientId) === String(targetPatientId)) {
      return next();
    }

    const userEmail = req.user?.email;
    if (!userEmail) {
      return res.status(403).json({ message: 'No email on token' });
    }

    // Fetch patient
    const patient = await patientRepo.findById(targetPatientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Patient self-access via email match
    if (patient.email && patient.email.toLowerCase() === userEmail.toLowerCase()) {
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
