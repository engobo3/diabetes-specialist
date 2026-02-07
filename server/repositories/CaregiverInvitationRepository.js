const BaseRepository = require('./BaseRepository');

class CaregiverInvitationRepository extends BaseRepository {
  constructor() {
    super('caregiver_invitations', 'caregiver_invitations.json');
  }

  /**
   * Find invitation by unique token
   * @param {string} token - The invitation token
   * @returns {Promise<Object|null>}
   */
  async findByToken(token) {
    const invitations = await this.findAll();
    return invitations.find(inv => inv.inviteToken === token) || null;
  }

  /**
   * Find all pending invitations for a caregiver email
   * @param {string} email - Caregiver email address
   * @returns {Promise<Array>}
   */
  async findPendingByEmail(email) {
    const invitations = await this.findAll();
    return invitations.filter(inv =>
      inv.caregiverEmail === email &&
      inv.status === 'pending' &&
      new Date(inv.expiresAt) > new Date()
    );
  }

  /**
   * Find all invitations (any status) for a specific patient
   * @param {string|number} patientId - Patient ID
   * @returns {Promise<Array>}
   */
  async findByPatientId(patientId) {
    const invitations = await this.findAll();
    return invitations.filter(inv => String(inv.patientId) === String(patientId));
  }

  /**
   * Find pending invitations requiring doctor approval
   * @param {string|number} doctorId - Doctor ID (optional)
   * @returns {Promise<Array>}
   */
  async findPendingNeedingApproval(doctorId = null) {
    const invitations = await this.findAll();
    let filtered = invitations.filter(inv =>
      inv.status === 'pending' &&
      inv.requiresDoctorApproval &&
      !inv.doctorApproved &&
      new Date(inv.expiresAt) > new Date()
    );

    if (doctorId) {
      filtered = filtered.filter(inv => String(inv.doctorId) === String(doctorId));
    }

    return filtered;
  }

  /**
   * Find expired invitations that need cleanup
   * @returns {Promise<Array>}
   */
  async findExpired() {
    const invitations = await this.findAll();
    const now = new Date();
    return invitations.filter(inv =>
      inv.status === 'pending' &&
      new Date(inv.expiresAt) < now
    );
  }

  /**
   * Mark expired invitations as expired
   * @returns {Promise<number>} Number of invitations updated
   */
  async markExpiredInvitations() {
    const expired = await this.findExpired();
    let count = 0;

    for (const invitation of expired) {
      await this.update(invitation.id, { status: 'expired' });
      count++;
    }

    return count;
  }
}

module.exports = CaregiverInvitationRepository;
