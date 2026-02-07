const { z } = require('zod');

/**
 * Permissions schema for caregiver access control
 */
const PermissionsSchema = z.object({
  viewVitals: z.boolean().default(true),
  viewAppointments: z.boolean().default(true),
  viewPrescriptions: z.boolean().default(true),
  requestAppointments: z.boolean().default(false),
  addVitals: z.boolean().default(false),
  viewDocuments: z.boolean().default(true),
  viewPayments: z.boolean().default(false)
});

/**
 * Relationship types for caregivers
 */
const RelationshipEnum = z.enum([
  'parent',
  'guardian',
  'spouse',
  'adult_child',
  'sibling',
  'caregiver'
]);

/**
 * Invitation status types
 */
const InvitationStatusEnum = z.enum([
  'pending',
  'accepted',
  'rejected',
  'cancelled',
  'expired'
]);

/**
 * Who invited the caregiver
 */
const InvitedByEnum = z.enum(['patient', 'doctor']);

/**
 * Caregiver object schema (for patient.caregivers array)
 */
const CaregiverSchema = z.object({
  email: z.string().email('Valid email required'),
  relationship: RelationshipEnum,
  addedAt: z.string().optional(),
  addedBy: z.string().optional(),
  permissions: PermissionsSchema.optional(),
  status: z.enum(['active', 'suspended']).default('active')
});

/**
 * Caregiver invitation schema
 */
const CaregiverInvitationSchema = z.object({
  id: z.union([z.string(), z.number()]).optional(),
  patientId: z.union([z.string(), z.number()]),
  patientName: z.string().min(1, 'Patient name required'),
  doctorId: z.union([z.string(), z.number()]).optional(),
  caregiverEmail: z.string().email('Valid email required'),
  relationship: RelationshipEnum,
  status: InvitationStatusEnum,
  invitedBy: InvitedByEnum,
  requiresDoctorApproval: z.boolean().default(true),
  doctorApproved: z.boolean().nullable().optional(),
  doctorApprovedBy: z.string().optional(),
  doctorApprovedAt: z.string().optional(),
  permissions: PermissionsSchema,
  inviteToken: z.string().min(10, 'Token must be at least 10 characters'),
  createdAt: z.string(),
  expiresAt: z.string(),
  acceptedAt: z.string().optional(),
  rejectedAt: z.string().optional(),
  notes: z.string().optional()
});

/**
 * Schema for creating a new invitation (client request)
 */
const CreateInvitationSchema = z.object({
  patientId: z.union([z.string(), z.number()]),
  caregiverEmail: z.string().email('Valid email required'),
  relationship: RelationshipEnum,
  permissions: PermissionsSchema.partial().optional(),
  notes: z.string().max(500).optional()
});

/**
 * Schema for accepting an invitation
 */
const AcceptInvitationSchema = z.object({
  caregiverName: z.string().min(1).optional(),
  caregiverPhone: z.string().optional()
});

/**
 * Schema for updating caregiver permissions
 */
const UpdatePermissionsSchema = z.object({
  permissions: PermissionsSchema.partial()
});

/**
 * Schema for doctor approval
 */
const ApproveInvitationSchema = z.object({
  approved: z.boolean(),
  notes: z.string().max(500).optional()
});

module.exports = {
  PermissionsSchema,
  RelationshipEnum,
  InvitationStatusEnum,
  InvitedByEnum,
  CaregiverSchema,
  CaregiverInvitationSchema,
  CreateInvitationSchema,
  AcceptInvitationSchema,
  UpdatePermissionsSchema,
  ApproveInvitationSchema
};
