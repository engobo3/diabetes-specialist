/**
 * Patient Identity Schema (PII)
 * Contains only personally identifiable information
 * Separated from medical data for enhanced security
 */

const { z } = require('zod');

/**
 * Patient Identity - Personal Information Only
 * This data is used for identification, contact, and administrative purposes
 */
const PatientIdentitySchema = z.object({
  // Core Identity
  id: z.union([z.string(), z.number()]).optional(),
  name: z.string().min(1, 'Name is required'),
  email: z.string().email('Valid email is required').optional(),
  phone: z.string().optional(),

  // Demographics (non-medical)
  age: z.number().int().positive().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(['male', 'female', 'other', 'prefer-not-to-say']).optional(),

  // Contact Information
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    state: z.string().optional(),
    postalCode: z.string().optional(),
    country: z.string().default('DRC')
  }).optional(),

  // Emergency Contact
  emergencyContact: z.object({
    name: z.string(),
    relationship: z.string(),
    phone: z.string()
  }).optional(),

  // Administrative
  registrationDate: z.string().optional(),
  uid: z.string().optional(), // Firebase Auth UID

  // Metadata
  createdAt: z.string().optional(),
  updatedAt: z.string().optional(),
  lastLoginAt: z.string().optional()
});

/**
 * Update Patient Identity Schema (for updates)
 * All fields optional for partial updates
 */
const UpdatePatientIdentitySchema = PatientIdentitySchema.partial();

module.exports = {
  PatientIdentitySchema,
  UpdatePatientIdentitySchema
};
