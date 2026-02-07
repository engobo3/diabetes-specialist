const BaseRepository = require('./BaseRepository');
const { DoctorSchema } = require('../schemas/doctor.schema');

class DoctorRepository extends BaseRepository {
    constructor() {
        super('doctors', 'doctors.json');
    }

    async create(data) {
        const validated = DoctorSchema.parse(data);
        return super.create(validated);
    }

    async update(id, data) {
        const validated = DoctorSchema.partial().parse(data);
        return super.update(id, validated);
    }
}

module.exports = DoctorRepository;
