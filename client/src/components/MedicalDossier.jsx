import { useState } from 'react';
import { Printer, ChevronDown, ChevronUp, Download, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const SectionHeader = ({ number, title, count }) => (
    <div className="border-b-2 border-gray-800 pb-1 mb-4 mt-8 first:mt-0 print:break-inside-avoid">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center gap-2">
            {number}. {title}
            {count !== undefined && <span className="text-xs font-normal text-gray-500 lowercase">({count} records)</span>}
        </h2>
    </div>
);

const EmptyRow = ({ colSpan = 5, text = 'None recorded' }) => (
    <tr><td colSpan={colSpan} className="p-3 text-center text-gray-400 italic text-sm border border-gray-300">{text}</td></tr>
);

const unitMap = {
    'Glucose': 'mg/dL',
    'Blood Pressure': 'mmHg',
    'Weight': 'kg',
    'Heart Rate': 'bpm',
};

const formatVitalValue = (v) => {
    const type = v.category || v.type;
    if (type === 'Blood Pressure') return `${v.systolic}/${v.diastolic} mmHg`;
    return `${v.value} ${unitMap[type] || v.unit || ''}`;
};

const MedicalDossier = ({
    patient = {},
    vitals = [],
    prescriptions = [],
    medicalRecords = [],
    documents = [],
    appointments = [],
}) => {
    const { currentUser } = useAuth();
    const [showAllVitals, setShowAllVitals] = useState(false);
    const [downloading, setDownloading] = useState(false);

    const handleDownloadPDF = async () => {
        if (!patient.id || !currentUser) return;
        setDownloading(true);
        try {
            const token = await currentUser.getIdToken();
            const apiUrl = import.meta.env.VITE_API_URL || '';
            const response = await fetch(`${apiUrl}/api/export/patient/${patient.id}/pdf`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error('PDF generation failed');
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `Dossier_Medical_${(patient.name || 'patient').replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (err) {
            console.error('PDF download error:', err);
            alert('Erreur lors du téléchargement du PDF.');
        } finally {
            setDownloading(false);
        }
    };

    // Group medical records by type
    const diagnoses = medicalRecords.filter(r => r.type === 'diagnosis').sort((a, b) => new Date(b.date) - new Date(a.date));
    const labResults = medicalRecords.filter(r => r.type === 'lab_result').sort((a, b) => new Date(b.date) - new Date(a.date));
    const procedures = medicalRecords.filter(r => r.type === 'procedure').sort((a, b) => new Date(b.date) - new Date(a.date));
    const clinicalNotes = medicalRecords.filter(r => r.type === 'clinical_note').sort((a, b) => new Date(b.date) - new Date(a.date));
    const referrals = medicalRecords.filter(r => r.type === 'referral').sort((a, b) => new Date(b.date) - new Date(a.date));

    // Latest vitals by type
    const vitalTypes = ['Glucose', 'Blood Pressure', 'Weight', 'Heart Rate'];
    const latestVitals = vitalTypes.map(type => {
        const filtered = (vitals || []).filter(v => (v.category || v.type) === type);
        const sorted = filtered.sort((a, b) => new Date(b.date) - new Date(a.date));
        return { type, latest: sorted[0] || null, count: sorted.length };
    });

    const allVitalsSorted = [...(vitals || [])].sort((a, b) => new Date(b.date) - new Date(a.date));
    const displayedVitals = showAllVitals ? allVitalsSorted : allVitalsSorted.slice(0, 20);

    const sortedPrescriptions = [...prescriptions].sort((a, b) => new Date(b.date) - new Date(a.date));
    const sortedAppointments = [...appointments].sort((a, b) => new Date(b.date) - new Date(a.date));
    const sortedDocuments = [...documents].sort((a, b) => new Date(b.date) - new Date(a.date));

    const generatedDate = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const generatedTime = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });

    const Field = ({ label, value }) => (
        <div className="flex text-sm py-1">
            <span className="font-semibold text-gray-600 w-28 sm:w-44 shrink-0">{label}:</span>
            <span className="text-gray-900 break-words min-w-0">{value || 'N/A'}</span>
        </div>
    );

    return (
        <div className="bg-white max-w-4xl mx-auto print:max-w-none print:mx-0" id="medical-dossier">
            {/* Print / Export Buttons */}
            <div className="flex justify-end gap-3 mb-4 print:hidden">
                <button
                    onClick={handleDownloadPDF}
                    disabled={downloading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium shadow-sm disabled:opacity-50"
                >
                    {downloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                    {downloading ? 'Génération...' : 'Télécharger PDF'}
                </button>
                <button
                    onClick={() => window.print()}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm font-medium shadow-sm"
                >
                    <Printer size={16} />
                    Imprimer
                </button>
            </div>

            {/* ===== DOCUMENT HEADER ===== */}
            <div className="border-2 border-gray-800 mb-6 print:break-inside-avoid">
                <div className="bg-gray-900 text-white px-3 sm:px-6 py-3 sm:py-4 text-center">
                    <h1 className="text-base sm:text-xl font-bold uppercase tracking-wider sm:tracking-widest">Comprehensive Medical Record</h1>
                    <p className="text-gray-300 text-xs mt-1 tracking-wide">DOSSIER MEDICAL COMPLET DU PATIENT</p>
                </div>
                <div className="px-3 sm:px-6 py-3 sm:py-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-sm">
                        <div>
                            <div className="text-xs text-gray-500 uppercase tracking-wider">Patient</div>
                            <div className="text-base sm:text-lg font-bold text-gray-900">{patient.name || 'N/A'}</div>
                        </div>
                        <div className="sm:text-right">
                            <div className="text-xs text-gray-500 uppercase tracking-wider">MRN (Medical Record Number)</div>
                            <div className="text-base sm:text-lg font-bold text-gray-900 font-mono">{patient.id || 'N/A'}</div>
                        </div>
                    </div>
                    <div className="border-t border-gray-200 mt-3 pt-3 flex flex-col sm:flex-row justify-between text-xs text-gray-500 gap-1">
                        <span>GlucoSoin Healthcare System</span>
                        <span>Generated: {generatedDate} at {generatedTime}</span>
                    </div>
                </div>
            </div>

            {/* ===== I. PATIENT DEMOGRAPHICS ===== */}
            <SectionHeader number="I" title="Patient Demographics / Informations du Patient" />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 mb-6 print:grid-cols-2">
                <div>
                    <Field label="Full Name" value={patient.name} />
                    <Field label="Age" value={patient.age ? `${patient.age} years` : null} />
                    <Field label="Gender" value={patient.gender} />
                    <Field label="Date of Birth" value={patient.dateOfBirth} />
                    <Field label="Blood Type" value={patient.bloodType} />
                </div>
                <div>
                    <Field label="Phone" value={patient.phone} />
                    <Field label="Email" value={patient.email} />
                    <Field label="Address" value={patient.address || patient.city} />
                    <Field label="Emergency Contact" value={patient.emergencyContact} />
                    <Field label="Insurance #" value={patient.insuranceNumber} />
                </div>
            </div>
            <div className="border-t border-gray-200 pt-3 mb-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 print:grid-cols-2">
                    <Field label="Primary Diagnosis" value={patient.type ? `Diabetes - ${patient.type}` : null} />
                    <Field label="Last Visit" value={patient.lastVisit} />
                </div>
                <div className="mt-2">
                    <div className="text-sm font-semibold text-gray-600 mb-1">Care Team / Attending Physicians:</div>
                    {(patient.doctors && patient.doctors.length > 0) ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 print:grid-cols-2">
                            {patient.doctors.map((doc, i) => (
                                <div key={doc.id || i} className="flex items-center gap-2 text-sm py-1 pl-2 border-l-2 border-blue-300">
                                    <span className="font-medium text-gray-900">Dr. {doc.name}</span>
                                    {doc.specialty && <span className="text-xs text-gray-500">({doc.specialty})</span>}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-sm text-gray-900 pl-2 border-l-2 border-blue-300">
                            Dr. {patient.doctorName || 'N/A'} {patient.doctorSpecialty && <span className="text-xs text-gray-500">({patient.doctorSpecialty})</span>}
                        </div>
                    )}
                </div>
            </div>

            {/* ===== II. PROBLEM LIST / ACTIVE DIAGNOSES ===== */}
            <SectionHeader number="II" title="Problem List / Active Diagnoses" count={diagnoses.length} />
            <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border-collapse print:break-inside-avoid min-w-[400px]">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="text-left p-2 border border-gray-300 font-semibold w-8">#</th>
                        <th className="text-left p-2 border border-gray-300 font-semibold">Diagnosis / Condition</th>
                        <th className="text-left p-2 border border-gray-300 font-semibold w-28">Date Onset</th>
                        <th className="text-left p-2 border border-gray-300 font-semibold w-36">Physician</th>
                    </tr>
                </thead>
                <tbody>
                    {/* Always show primary diabetes diagnosis first */}
                    {patient.type && (
                        <tr className="bg-yellow-50">
                            <td className="p-2 border border-gray-300 text-center font-bold">*</td>
                            <td className="p-2 border border-gray-300">
                                <span className="font-medium">Diabetes Mellitus - {patient.type}</span>
                                <span className="text-xs text-gray-500 ml-2">(Primary)</span>
                            </td>
                            <td className="p-2 border border-gray-300 text-gray-500">-</td>
                            <td className="p-2 border border-gray-300">{patient.doctors?.length > 1 ? 'Care Team' : (patient.doctorName || 'N/A')}</td>
                        </tr>
                    )}
                    {diagnoses.length > 0 ? diagnoses.map((d, i) => (
                        <tr key={d.id}>
                            <td className="p-2 border border-gray-300 text-center">{i + 1}</td>
                            <td className="p-2 border border-gray-300">
                                <div className="font-medium">{d.title}</div>
                                {d.content && <div className="text-xs text-gray-500 mt-1 whitespace-pre-wrap">{d.content}</div>}
                            </td>
                            <td className="p-2 border border-gray-300">{d.date}</td>
                            <td className="p-2 border border-gray-300">{d.doctorName || 'N/A'}</td>
                        </tr>
                    )) : !patient.type && <EmptyRow colSpan={4} text="No active diagnoses recorded." />}
                </tbody>
            </table>
            </div>

            {/* ===== III. MEDICATION LIST ===== */}
            <SectionHeader number="III" title="Medication List / Ordonnances" count={sortedPrescriptions.length} />
            <div className="overflow-x-auto mb-6">
            <table className="w-full text-sm border-collapse print:break-inside-avoid min-w-[500px]">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="text-left p-2 border border-gray-300 font-semibold">Medication</th>
                        <th className="text-left p-2 border border-gray-300 font-semibold">Dosage</th>
                        <th className="text-left p-2 border border-gray-300 font-semibold">Frequency</th>
                        <th className="text-left p-2 border border-gray-300 font-semibold w-28">Date</th>
                        <th className="text-left p-2 border border-gray-300 font-semibold">Instructions / Notes</th>
                    </tr>
                </thead>
                <tbody>
                    {sortedPrescriptions.length > 0 ? sortedPrescriptions.map(rx => (
                        <tr key={rx.id}>
                            <td className="p-2 border border-gray-300 font-medium">{rx.medication}</td>
                            <td className="p-2 border border-gray-300">{rx.dosage || '-'}</td>
                            <td className="p-2 border border-gray-300">{rx.frequency || '-'}</td>
                            <td className="p-2 border border-gray-300">{rx.date || '-'}</td>
                            <td className="p-2 border border-gray-300">{rx.instructions || rx.notes || '-'}</td>
                        </tr>
                    )) : <EmptyRow text="No medications on record." />}
                </tbody>
            </table>
            </div>

            {/* ===== IV. VITAL SIGNS ===== */}
            <SectionHeader number="IV" title="Vital Signs / Signes Vitaux" count={(vitals || []).length} />

            {/* Latest readings summary */}
            <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">Most Recent Readings</h3>
            <div className="overflow-x-auto mb-4">
            <table className="w-full text-sm border-collapse print:break-inside-avoid min-w-[400px]">
                <thead>
                    <tr className="bg-gray-100">
                        <th className="text-left p-2 border border-gray-300 font-semibold">Vital Sign</th>
                        <th className="text-left p-2 border border-gray-300 font-semibold">Latest Value</th>
                        <th className="text-left p-2 border border-gray-300 font-semibold w-28">Date</th>
                        <th className="text-left p-2 border border-gray-300 font-semibold w-28">Total Records</th>
                    </tr>
                </thead>
                <tbody>
                    {latestVitals.map(({ type, latest, count }) => (
                        <tr key={type}>
                            <td className="p-2 border border-gray-300 font-medium">{type}</td>
                            <td className="p-2 border border-gray-300">{latest ? formatVitalValue(latest) : 'N/A'}</td>
                            <td className="p-2 border border-gray-300">{latest?.date || '-'}</td>
                            <td className="p-2 border border-gray-300 text-center">{count}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
            </div>

            {/* Full history */}
            {allVitalsSorted.length > 0 && (
                <div className="mb-6">
                    <h3 className="text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                        Complete Vital Signs Log ({allVitalsSorted.length} entries)
                    </h3>
                    <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse min-w-[400px]">
                        <thead>
                            <tr className="bg-gray-50">
                                <th className="text-left p-2 border border-gray-300 font-semibold w-28">Date</th>
                                <th className="text-left p-2 border border-gray-300 font-semibold">Type</th>
                                <th className="text-left p-2 border border-gray-300 font-semibold">Value</th>
                                <th className="text-left p-2 border border-gray-300 font-semibold">Subtype</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayedVitals.map((v, i) => (
                                <tr key={v.id || i}>
                                    <td className="p-2 border border-gray-300">{v.date}</td>
                                    <td className="p-2 border border-gray-300">{v.category || v.type}</td>
                                    <td className="p-2 border border-gray-300">{formatVitalValue(v)}</td>
                                    <td className="p-2 border border-gray-300 text-gray-500">{v.subtype || '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    </div>
                    {allVitalsSorted.length > 20 && (
                        <button
                            onClick={() => setShowAllVitals(!showAllVitals)}
                            className="mt-2 text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1 print:hidden"
                        >
                            {showAllVitals ? <><ChevronUp size={14} /> Show less</> : <><ChevronDown size={14} /> Show all {allVitalsSorted.length} records</>}
                        </button>
                    )}
                    {/* Always show all in print */}
                    <div className="hidden print:block">
                        {!showAllVitals && allVitalsSorted.length > 20 && (
                            <table className="w-full text-sm border-collapse">
                                <tbody>
                                    {allVitalsSorted.slice(20).map((v, i) => (
                                        <tr key={v.id || `extra-${i}`}>
                                            <td className="p-2 border border-gray-300 w-28">{v.date}</td>
                                            <td className="p-2 border border-gray-300">{v.category || v.type}</td>
                                            <td className="p-2 border border-gray-300">{formatVitalValue(v)}</td>
                                            <td className="p-2 border border-gray-300 text-gray-500">{v.subtype || '-'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* ===== V. PROGRESS NOTES ===== */}
            <SectionHeader number="V" title="Progress Notes / Notes Cliniques" count={clinicalNotes.length} />
            {clinicalNotes.length > 0 ? (
                <div className="space-y-3 mb-6">
                    {clinicalNotes.map(note => (
                        <div key={note.id} className="border border-gray-300 p-4 print:break-inside-avoid">
                            <div className="flex justify-between items-start text-sm mb-2">
                                <span className="font-bold text-gray-900">{note.title}</span>
                                <span className="text-xs text-gray-500 shrink-0 ml-4">{note.date} &mdash; {note.doctorName || 'N/A'}</span>
                            </div>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{note.content}</p>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-gray-400 italic mb-6">No progress notes on file.</p>
            )}

            {/* ===== VI. LABORATORY RESULTS ===== */}
            <SectionHeader number="VI" title="Laboratory Results / Resultats de Laboratoire" count={labResults.length} />
            {labResults.length > 0 ? (
                <div className="space-y-3 mb-6">
                    {labResults.map(lab => (
                        <div key={lab.id} className="border border-gray-300 p-4 print:break-inside-avoid">
                            <div className="flex justify-between items-start text-sm mb-2">
                                <span className="font-bold text-gray-900">{lab.title}</span>
                                <span className="text-xs text-gray-500 shrink-0 ml-4">{lab.date} &mdash; {lab.doctorName || 'N/A'}</span>
                            </div>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{lab.content}</p>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-gray-400 italic mb-6">No laboratory results on file.</p>
            )}

            {/* ===== VII. PROCEDURES ===== */}
            <SectionHeader number="VII" title="Procedures / Procedures Medicales" count={procedures.length} />
            {procedures.length > 0 ? (
                <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm border-collapse print:break-inside-avoid min-w-[500px]">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="text-left p-2 border border-gray-300 font-semibold">Procedure</th>
                            <th className="text-left p-2 border border-gray-300 font-semibold">Details</th>
                            <th className="text-left p-2 border border-gray-300 font-semibold w-28">Date</th>
                            <th className="text-left p-2 border border-gray-300 font-semibold w-36">Physician</th>
                        </tr>
                    </thead>
                    <tbody>
                        {procedures.map(proc => (
                            <tr key={proc.id}>
                                <td className="p-2 border border-gray-300 font-medium">{proc.title}</td>
                                <td className="p-2 border border-gray-300 whitespace-pre-wrap">{proc.content}</td>
                                <td className="p-2 border border-gray-300">{proc.date}</td>
                                <td className="p-2 border border-gray-300">{proc.doctorName || 'N/A'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            ) : (
                <p className="text-sm text-gray-400 italic mb-6">No procedures on record.</p>
            )}

            {/* ===== VIII. REFERRALS ===== */}
            <SectionHeader number="VIII" title="Referrals / Orientations" count={referrals.length} />
            {referrals.length > 0 ? (
                <div className="space-y-3 mb-6">
                    {referrals.map(r => (
                        <div key={r.id} className="border border-gray-300 p-4 print:break-inside-avoid">
                            <div className="flex justify-between items-start text-sm mb-2">
                                <span className="font-bold text-gray-900">{r.title}</span>
                                <span className="text-xs text-gray-500 shrink-0 ml-4">{r.date} &mdash; {r.doctorName || 'N/A'}</span>
                            </div>
                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{r.content}</p>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="text-sm text-gray-400 italic mb-6">No referrals on file.</p>
            )}

            {/* ===== IX. DOCUMENTS & IMAGING ===== */}
            <SectionHeader number="IX" title="Documents & Imaging / Documents et Imagerie" count={sortedDocuments.length} />
            {sortedDocuments.length > 0 ? (
                <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm border-collapse print:break-inside-avoid min-w-[400px]">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="text-left p-2 border border-gray-300 font-semibold">Document Name</th>
                            <th className="text-left p-2 border border-gray-300 font-semibold">Type</th>
                            <th className="text-left p-2 border border-gray-300 font-semibold w-28">Date</th>
                            <th className="text-left p-2 border border-gray-300 font-semibold w-16 print:hidden">Link</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedDocuments.map((doc, i) => (
                            <tr key={doc.id || i}>
                                <td className="p-2 border border-gray-300 font-medium">{doc.name || doc.filename || 'Document'}</td>
                                <td className="p-2 border border-gray-300">{doc.type || '-'}</td>
                                <td className="p-2 border border-gray-300">{doc.date || '-'}</td>
                                <td className="p-2 border border-gray-300 print:hidden">
                                    {doc.url && <a href={doc.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-xs">View</a>}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            ) : (
                <p className="text-sm text-gray-400 italic mb-6">No documents on file.</p>
            )}

            {/* ===== X. APPOINTMENT HISTORY ===== */}
            <SectionHeader number="X" title="Appointment History / Historique des Rendez-vous" count={sortedAppointments.length} />
            {sortedAppointments.length > 0 ? (
                <div className="overflow-x-auto mb-6">
                <table className="w-full text-sm border-collapse print:break-inside-avoid min-w-[400px]">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="text-left p-2 border border-gray-300 font-semibold w-28">Date</th>
                            <th className="text-left p-2 border border-gray-300 font-semibold w-20">Time</th>
                            <th className="text-left p-2 border border-gray-300 font-semibold w-28">Status</th>
                            <th className="text-left p-2 border border-gray-300 font-semibold">Reason / Notes</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sortedAppointments.map(apt => (
                            <tr key={apt.id}>
                                <td className="p-2 border border-gray-300">{apt.date}</td>
                                <td className="p-2 border border-gray-300">{apt.time || '-'}</td>
                                <td className="p-2 border border-gray-300">
                                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                                        apt.status === 'confirmed' || apt.status === 'completed' ? 'bg-green-100 text-green-700' :
                                        apt.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                        apt.status === 'cancelled' ? 'bg-red-100 text-red-700' :
                                        'bg-gray-100 text-gray-700'
                                    }`}>{apt.status || 'N/A'}</span>
                                </td>
                                <td className="p-2 border border-gray-300">{apt.reason || apt.notes || '-'}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                </div>
            ) : (
                <p className="text-sm text-gray-400 italic mb-6">No appointment history available.</p>
            )}

            {/* ===== FOOTER ===== */}
            <div className="border-t-2 border-gray-800 mt-10 pt-4 print:break-inside-avoid">
                <div className="mb-6">
                    <div className="text-xs font-bold text-gray-700 uppercase mb-3">Attending Physician(s) Signature</div>
                    {(patient.doctors && patient.doctors.length > 0) ? (
                        <div className="space-y-4">
                            {patient.doctors.map((doc, i) => (
                                <div key={doc.id || i} className="grid grid-cols-2 gap-8">
                                    <div>
                                        <div className="border-b border-gray-400 h-8 mb-1"></div>
                                        <div className="text-xs text-gray-500">Dr. {doc.name}{doc.specialty ? ` (${doc.specialty})` : ''}</div>
                                    </div>
                                    {i === 0 && (
                                        <div>
                                            <div className="text-xs font-bold text-gray-700 uppercase mb-2">Date</div>
                                            <div className="border-b border-gray-400 h-8 mb-1"></div>
                                            <div className="text-xs text-gray-500">{generatedDate}</div>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-8">
                            <div>
                                <div className="border-b border-gray-400 h-8 mb-1"></div>
                                <div className="text-xs text-gray-500">{patient.doctorName || '________________________'}</div>
                            </div>
                            <div>
                                <div className="text-xs font-bold text-gray-700 uppercase mb-2">Date</div>
                                <div className="border-b border-gray-400 h-8 mb-1"></div>
                                <div className="text-xs text-gray-500">{generatedDate}</div>
                            </div>
                        </div>
                    )}
                </div>
                <div className="flex justify-between text-xs text-gray-400 border-t border-gray-200 pt-3">
                    <span>GlucoSoin Healthcare System &mdash; Comprehensive Medical Record</span>
                    <span>Page 1 of 1</span>
                </div>
                <p className="text-[10px] text-gray-400 mt-3 leading-relaxed">
                    CONFIDENTIALITY NOTICE: This document contains Protected Health Information (PHI) and is intended solely for the use of
                    the individual or entity to whom it is addressed. Any unauthorized review, use, disclosure, or distribution is prohibited.
                    If you are not the intended recipient, please contact the sender and destroy all copies of the original document.
                    HIPAA / Privacy Act applicable.
                </p>
            </div>
        </div>
    );
};

export default MedicalDossier;
