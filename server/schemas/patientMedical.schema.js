/**
 * Patient Medical Schema (PHI - Protected Health Information)
 * Contains only medical/health information
 * Separated from PII for enhanced security and compliance
 */

const { z } = require('zod');

/**
 * Patient Medical Data - Health Information Only
 * This data requires highest level of protection and access control
 */
const PatientMedicalSchema = z.object({
  // Link to identity (foreign key)
  patientId: z.union([z.string(), z.number()]),

  // Medical Status
  type: z.enum(['Type 1', 'Type 2', 'Gestational', 'Prediabetes']).optional(),
  status: z.enum(['Stable', 'Attention Needed', 'Critical', 'Under Review']).optional(),
  diagnosisDate: z.string().optional(),

  // Medical Team
  doctorId: z.union([z.string(), z.number()]).optional(),
  doctorName: z.string().optional(),

  // Medical History
  conditions: z.array(z.string()).optional(),
  allergies: z.array(z.string()).optional(),
  medications: z.array(z.object({
    name: z.string(),
    dosage: z.string(),
    frequency: z.string(),
    startDate: z.string().optional()
  })).optional(),

  // Clinical Data
  bloodType: z.string().optional(),
  height: z.number().optional(), // cm
  weight: z.number().optional(), // kg
  bmi: z.number().optional(),

  // Last Visit & Notes
  lastVisit: z.string().optional(),
  lastA1C: z.number().optional(),
  targetA1C: z.number().optional(),

  // Clinical Notes (doctor only)
  clinicalNotes: z.array(z.object({
    date: z.string(),
    note: z.string(),
    doctorId: z.union([z.string(), z.number()]),
    private: z.boolean().default(false) // true = doctor eyes only
  })).optional(),

  // Treatment Plan
  treatmentPlan: z.object({
    goals: z.array(z.string()).optional(),
    restrictions: z.array(z.string()).optional(),
    recommendations: z.array(z.string()).optional(),
    lastUpdated: z.string().optional()
  }).optional(),

  // Caregiver Access Control
  caregivers: z.array(z.object({
    email: z.string().email(),
    relationship: z.enum(['parent', 'guardian', 'spouse', 'adult_child', 'sibling', 'caregiver']),
    permissions: z.object({
      viewVitals: z.boolean().default(true),
      viewAppointments: z.boolean().default(true),
      viewPrescriptions: z.boolean().default(true),
      requestAppointments: z.boolean().default(false),
      addVitals: z.boolean().default(false),
      viewDocuments: z.boolean().default(true),
      viewPayments: z.boolean().default(false)
    }).optional(),
    addedAt: z.string().optional(),
    addedBy: z.string().optional(),
    status: z.enum(['active', 'suspended']).default('active').optional()
  })).optional(),

  // Metadata
  createdAt: z.string().optional(),
  updatedAt: z.string().optional()
});

/**
 * Update Patient Medical Schema (for updates)
 * All fields optional except patientId for partial updates
 */
const UpdatePatientMedicalSchema = PatientMedicalSchema.partial().required({ patientId: true });

/**
 * Combined Patient View (for responses that need both)
 * Used when authorized user needs complete patient information
 */
const CombinedPatientSchema = z.object({
  // Identity fields
  id: z.union([z.string(), z.number()]),
  name: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  age: z.number().optional(),

  // Medical fields
  type: z.string().optional(),
  status: z.string().optional(),
  doctorId: z.union([z.string(), z.number()]).optional(),
  lastVisit: z.string().optional(),

  // Merged from both schemas
  _source: z.enum(['combined']).default('combined')
});

module.exports = {
  PatientMedicalSchema,
  UpdatePatientMedicalSchema,
  CombinedPatientSchema
};
