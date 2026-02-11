const PDFDocument = require('pdfkit');

const COLORS = {
    primary: '#1e293b',    // slate-800
    secondary: '#475569',  // slate-600
    accent: '#2563eb',     // blue-600
    light: '#94a3b8',      // slate-400
    border: '#cbd5e1',     // slate-300
    bg: '#f8fafc',         // slate-50
};

/**
 * Build a complete patient medical dossier as a PDFKit document.
 * Returns a PDFDocument stream (pipe to res).
 */
function buildDossierPDF({ patient, vitals, prescriptions, medicalRecords, appointments, documents }) {
    const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });

    const pageWidth = doc.page.width - 100; // margins
    const generatedDate = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });
    const generatedTime = new Date().toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

    // ===== HEADER =====
    doc.rect(50, 50, pageWidth, 60).fill(COLORS.primary);
    doc.fillColor('#ffffff')
        .fontSize(16).font('Helvetica-Bold')
        .text('DOSSIER MEDICAL COMPLET', 60, 62, { width: pageWidth - 20, align: 'center' });
    doc.fontSize(9).font('Helvetica')
        .text('COMPREHENSIVE MEDICAL RECORD', 60, 82, { width: pageWidth - 20, align: 'center' });

    doc.moveDown(1);
    doc.y = 130;

    // Patient info bar
    doc.fillColor(COLORS.primary).fontSize(12).font('Helvetica-Bold')
        .text(patient.name || 'N/A', 50);
    doc.fillColor(COLORS.secondary).fontSize(9).font('Helvetica')
        .text(`MRN: ${patient.id || 'N/A'}  |  Generated: ${generatedDate} at ${generatedTime}  |  GlucoSoin Healthcare System`, 50);

    doc.moveDown(0.5);
    drawLine(doc, pageWidth);
    doc.moveDown(0.5);

    // ===== I. PATIENT DEMOGRAPHICS =====
    sectionHeader(doc, 'I', 'Patient Demographics / Informations du Patient');
    const fields = [
        ['Full Name', patient.name],
        ['Age', patient.age ? `${patient.age} years` : 'N/A'],
        ['Gender', patient.gender || 'N/A'],
        ['Phone', patient.phone || 'N/A'],
        ['Email', patient.email || 'N/A'],
        ['Address', patient.address || patient.city || 'N/A'],
        ['Primary Diagnosis', patient.type ? `Diabetes - ${patient.type}` : 'N/A'],
        ['Status', patient.status || 'N/A'],
    ];
    fields.forEach(([label, value]) => fieldRow(doc, label, value));

    // Care team
    if (patient.doctors && patient.doctors.length > 0) {
        doc.moveDown(0.3);
        doc.fillColor(COLORS.secondary).fontSize(8).font('Helvetica-Bold').text('Care Team:');
        patient.doctors.forEach(d => {
            doc.fillColor(COLORS.primary).fontSize(8).font('Helvetica')
                .text(`  Dr. ${d.name}${d.specialty ? ` (${d.specialty})` : ''}`, { indent: 10 });
        });
    }
    doc.moveDown(0.5);

    // ===== II. ACTIVE DIAGNOSES =====
    const diagnoses = (medicalRecords || []).filter(r => r.type === 'diagnosis').sort(byDateDesc);
    sectionHeader(doc, 'II', `Active Diagnoses (${diagnoses.length})`);
    if (patient.type) {
        doc.fillColor(COLORS.primary).fontSize(9).font('Helvetica-Bold')
            .text(`* Diabetes Mellitus - ${patient.type} (Primary)`);
    }
    if (diagnoses.length > 0) {
        diagnoses.forEach(d => {
            checkPageSpace(doc, 40);
            doc.fillColor(COLORS.primary).fontSize(9).font('Helvetica-Bold')
                .text(`${d.title}`, { continued: true });
            doc.font('Helvetica').fillColor(COLORS.light).text(`  ${d.date || ''}`);
            if (d.content) {
                doc.fillColor(COLORS.secondary).fontSize(8).font('Helvetica').text(d.content, { indent: 10 });
            }
        });
    } else if (!patient.type) {
        emptyNote(doc, 'No active diagnoses recorded.');
    }
    doc.moveDown(0.5);

    // ===== III. MEDICATIONS =====
    const sortedRx = [...(prescriptions || [])].sort(byDateDesc);
    sectionHeader(doc, 'III', `Medications / Ordonnances (${sortedRx.length})`);
    if (sortedRx.length > 0) {
        const rxHeaders = ['Medication', 'Dosage', 'Frequency', 'Date', 'Instructions'];
        const rxWidths = [0.22, 0.15, 0.15, 0.13, 0.35];
        const rxRows = sortedRx.map(rx => [
            rx.medication || '-',
            rx.dosage || '-',
            rx.frequency || '-',
            rx.date || '-',
            rx.instructions || rx.notes || '-',
        ]);
        drawTable(doc, rxHeaders, rxRows, rxWidths, pageWidth);
    } else {
        emptyNote(doc, 'No medications on record.');
    }
    doc.moveDown(0.5);

    // ===== IV. VITAL SIGNS =====
    const allVitals = [...(vitals || [])].sort(byDateDesc).slice(0, 20);
    sectionHeader(doc, 'IV', `Vital Signs (latest ${allVitals.length} of ${(vitals || []).length})`);
    if (allVitals.length > 0) {
        const vHeaders = ['Date', 'Type', 'Value', 'Subtype'];
        const vWidths = [0.2, 0.25, 0.30, 0.25];
        const vRows = allVitals.map(v => [
            v.date || '-',
            v.category || v.type || '-',
            formatVitalValue(v),
            v.subtype || '-',
        ]);
        drawTable(doc, vHeaders, vRows, vWidths, pageWidth);
    } else {
        emptyNote(doc, 'No vital signs recorded.');
    }
    doc.moveDown(0.5);

    // ===== V. CLINICAL NOTES =====
    const clinicalNotes = (medicalRecords || []).filter(r => r.type === 'clinical_note').sort(byDateDesc);
    sectionHeader(doc, 'V', `Clinical Notes (${clinicalNotes.length})`);
    if (clinicalNotes.length > 0) {
        clinicalNotes.forEach(note => {
            checkPageSpace(doc, 50);
            doc.fillColor(COLORS.primary).fontSize(9).font('Helvetica-Bold')
                .text(note.title, { continued: true });
            doc.font('Helvetica').fillColor(COLORS.light).text(`  ${note.date || ''} — ${note.doctorName || 'N/A'}`);
            doc.fillColor(COLORS.secondary).fontSize(8).font('Helvetica')
                .text(note.content || '', { indent: 10 });
            doc.moveDown(0.3);
        });
    } else {
        emptyNote(doc, 'No clinical notes on file.');
    }
    doc.moveDown(0.5);

    // ===== VI. LAB RESULTS =====
    const labResults = (medicalRecords || []).filter(r => r.type === 'lab_result').sort(byDateDesc);
    sectionHeader(doc, 'VI', `Laboratory Results (${labResults.length})`);
    if (labResults.length > 0) {
        labResults.forEach(lab => {
            checkPageSpace(doc, 50);
            doc.fillColor(COLORS.primary).fontSize(9).font('Helvetica-Bold')
                .text(lab.title, { continued: true });
            doc.font('Helvetica').fillColor(COLORS.light).text(`  ${lab.date || ''} — ${lab.doctorName || 'N/A'}`);
            doc.fillColor(COLORS.secondary).fontSize(8).font('Helvetica')
                .text(lab.content || '', { indent: 10 });
            doc.moveDown(0.3);
        });
    } else {
        emptyNote(doc, 'No laboratory results on file.');
    }
    doc.moveDown(0.5);

    // ===== VII. PROCEDURES =====
    const procedures = (medicalRecords || []).filter(r => r.type === 'procedure').sort(byDateDesc);
    sectionHeader(doc, 'VII', `Procedures (${procedures.length})`);
    if (procedures.length > 0) {
        procedures.forEach(proc => {
            checkPageSpace(doc, 50);
            doc.fillColor(COLORS.primary).fontSize(9).font('Helvetica-Bold')
                .text(proc.title, { continued: true });
            doc.font('Helvetica').fillColor(COLORS.light).text(`  ${proc.date || ''} — ${proc.doctorName || 'N/A'}`);
            doc.fillColor(COLORS.secondary).fontSize(8).font('Helvetica')
                .text(proc.content || '', { indent: 10 });
            doc.moveDown(0.3);
        });
    } else {
        emptyNote(doc, 'No procedures on record.');
    }
    doc.moveDown(0.5);

    // ===== VIII. APPOINTMENTS =====
    const sortedApts = [...(appointments || [])].sort(byDateDesc);
    sectionHeader(doc, 'VIII', `Appointment History (${sortedApts.length})`);
    if (sortedApts.length > 0) {
        const aHeaders = ['Date', 'Time', 'Status', 'Reason / Notes'];
        const aWidths = [0.18, 0.12, 0.18, 0.52];
        const aRows = sortedApts.map(a => [
            a.date || '-',
            a.time || '-',
            a.status || '-',
            a.reason || a.notes || '-',
        ]);
        drawTable(doc, aHeaders, aRows, aWidths, pageWidth);
    } else {
        emptyNote(doc, 'No appointment history.');
    }
    doc.moveDown(0.5);

    // ===== IX. DOCUMENTS =====
    const sortedDocs = [...(documents || [])].sort(byDateDesc);
    sectionHeader(doc, 'IX', `Documents & Imaging (${sortedDocs.length})`);
    if (sortedDocs.length > 0) {
        const dHeaders = ['Name', 'Type', 'Date'];
        const dWidths = [0.50, 0.25, 0.25];
        const dRows = sortedDocs.map(d => [
            d.name || d.filename || 'Document',
            d.type || '-',
            d.date || '-',
        ]);
        drawTable(doc, dHeaders, dRows, dWidths, pageWidth);
    } else {
        emptyNote(doc, 'No documents on file.');
    }

    // ===== FOOTER =====
    doc.moveDown(1);
    drawLine(doc, pageWidth);
    doc.moveDown(0.5);
    doc.fillColor(COLORS.light).fontSize(7).font('Helvetica')
        .text('CONFIDENTIALITY NOTICE: This document contains Protected Health Information (PHI) and is intended solely for the use of the individual or entity to whom it is addressed. Any unauthorized review, use, disclosure, or distribution is prohibited.', 50, doc.y, { width: pageWidth, align: 'justify' });
    doc.moveDown(0.3);
    doc.text(`GlucoSoin Healthcare System — Generated ${generatedDate} at ${generatedTime}`, { align: 'center' });

    // Add page numbers
    const pages = doc.bufferedPageRange();
    for (let i = pages.start; i < pages.start + pages.count; i++) {
        doc.switchToPage(i);
        doc.fillColor(COLORS.light).fontSize(7).font('Helvetica')
            .text(`Page ${i + 1} of ${pages.count}`, 50, doc.page.height - 40, { width: pageWidth, align: 'right' });
    }

    doc.end();
    return doc;
}

// ===== Helpers =====

function sectionHeader(doc, num, title) {
    checkPageSpace(doc, 30);
    doc.moveDown(0.3);
    doc.fillColor(COLORS.primary).fontSize(11).font('Helvetica-Bold')
        .text(`${num}. ${title}`);
    doc.moveTo(50, doc.y).lineTo(doc.page.width - 50, doc.y)
        .strokeColor(COLORS.primary).lineWidth(1.5).stroke();
    doc.moveDown(0.3);
}

function fieldRow(doc, label, value) {
    doc.fillColor(COLORS.secondary).fontSize(8).font('Helvetica-Bold')
        .text(`${label}: `, 50, doc.y, { continued: true });
    doc.font('Helvetica').fillColor(COLORS.primary).text(value || 'N/A');
}

function emptyNote(doc, text) {
    doc.fillColor(COLORS.light).fontSize(8).font('Helvetica').text(text, { oblique: true });
}

function drawLine(doc, width) {
    doc.moveTo(50, doc.y).lineTo(50 + width, doc.y)
        .strokeColor(COLORS.border).lineWidth(0.5).stroke();
}

function drawTable(doc, headers, rows, widths, totalWidth) {
    const startX = 50;
    const rowHeight = 18;
    const fontSize = 8;

    // Check space for header + at least a few rows
    checkPageSpace(doc, rowHeight * Math.min(rows.length + 1, 6));

    // Header row
    let x = startX;
    doc.rect(startX, doc.y, totalWidth, rowHeight).fill('#f1f5f9');
    const headerY = doc.y + 5;
    headers.forEach((h, i) => {
        const colW = totalWidth * widths[i];
        doc.fillColor(COLORS.primary).fontSize(fontSize).font('Helvetica-Bold')
            .text(h, x + 4, headerY, { width: colW - 8, ellipsis: true });
        x += colW;
    });
    doc.y = headerY - 5 + rowHeight;

    // Data rows
    rows.forEach((row) => {
        checkPageSpace(doc, rowHeight + 5);
        x = startX;
        const rowY = doc.y;

        // Light alternating bg
        row.forEach((cell, i) => {
            const colW = totalWidth * widths[i];
            doc.fillColor(COLORS.secondary).fontSize(fontSize).font('Helvetica')
                .text(String(cell), x + 4, rowY + 4, { width: colW - 8, ellipsis: true });
            x += colW;
        });
        doc.y = rowY + rowHeight;
    });

    // Bottom border
    doc.moveTo(startX, doc.y).lineTo(startX + totalWidth, doc.y)
        .strokeColor(COLORS.border).lineWidth(0.5).stroke();
}

function checkPageSpace(doc, needed) {
    if (doc.y + needed > doc.page.height - 70) {
        doc.addPage();
    }
}

function formatVitalValue(v) {
    const type = v.category || v.type;
    const unitMap = { 'Glucose': 'mg/dL', 'Blood Pressure': 'mmHg', 'Weight': 'kg', 'Heart Rate': 'bpm' };
    if (type === 'Blood Pressure') return `${v.systolic || ''}/${v.diastolic || ''} mmHg`;
    return `${v.value || ''} ${unitMap[type] || v.unit || ''}`.trim();
}

function byDateDesc(a, b) {
    return new Date(b.date || 0) - new Date(a.date || 0);
}

module.exports = { buildDossierPDF };
