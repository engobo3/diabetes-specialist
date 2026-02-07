const { getPatients } = require('./controllers/patientController');

// Mock Req/Res
const req = {
    query: {
        doctorId: '99'
    }
};

const res = {
    json: (data) => {
        console.log("Controller returned JSON:", data.length, "items");
        const bertol = data.find(p => p.name.includes('Bertol'));
        console.log("Contains Bertol?", !!bertol);
        if (bertol) console.log(JSON.stringify(bertol, null, 2));
    },
    status: (code) => {
        console.log("Controller status:", code);
        return {
            json: (data) => console.log("Error JSON:", data)
        };
    }
};

async function test() {
    await getPatients(req, res);
}

test();
