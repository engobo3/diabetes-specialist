const request = require('supertest');
const { app } = require('../server');

describe('API Endpoints', () => {
    it('GET / should return status 200', async () => {
        const res = await request(app).get('/');
        expect(res.statusCode).toEqual(200);
        expect(res.text).toContain('Diabetes Specialist API is running');
    });

    // Since we don't have a real token in tests easily without mocking auth middleware, 
    // we might hit 401 or 403 on protected routes. 
    // For this initial pass, we'll test the public root endpoint and maybe 401 on protected.

    it('GET /api/patients should return 403 without token', async () => {
        const res = await request(app).get('/api/patients');
        // Assuming verifyToken middleware returns 403 or 401
        expect([401, 403]).toContain(res.statusCode);
    });
});
