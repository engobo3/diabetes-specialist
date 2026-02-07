/**
 * Patient Identity Repository (PII)
 * Handles personally identifiable information only
 * Separated from medical data for enhanced security
 */

const BaseRepository = require('./BaseRepository');
const { PatientIdentitySchema } = require('../schemas/patientIdentity.schema');

class PatientIdentityRepository extends BaseRepository {
    constructor() {
        super('patient_identity', 'patient_identity.json');
    }

    /**
     * Create patient identity record
     */
    async create(data) {
        const validated = PatientIdentitySchema.parse(data);
        validated.createdAt = new Date().toISOString();
        validated.updatedAt = new Date().toISOString();
        return super.create(validated);
    }

    /**
     * Update patient identity
     */
    async update(id, data) {
        data.updatedAt = new Date().toISOString();
        return super.update(id, data);
    }

    /**
     * Find by email (common lookup)
     */
    async findByEmail(email) {
        const all = await this.findAll();
        return all.find(p => p.email && p.email.toLowerCase() === email.toLowerCase());
    }

    /**
     * Find by phone
     */
    async findByPhone(phone) {
        const all = await this.findAll();
        return all.find(p => p.phone === phone);
    }

    /**
     * Find by Firebase UID
     */
    async findByUid(uid) {
        const all = await this.findAll();
        return all.find(p => p.uid === uid);
    }

    /**
     * Update last login timestamp
     */
    async updateLastLogin(id) {
        return this.update(id, {
            lastLoginAt: new Date().toISOString()
        });
    }

    /**
     * Search by name (for admin/receptionist)
     */
    async searchByName(query) {
        const all = await this.findAll();
        const searchTerm = query.toLowerCase();
        return all.filter(p =>
            p.name && p.name.toLowerCase().includes(searchTerm)
        );
    }
}

module.exports = PatientIdentityRepository;
