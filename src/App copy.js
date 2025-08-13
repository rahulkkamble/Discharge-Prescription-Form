// src/App.js
import React, { useState, useRef } from "react";
import exampleBundle from "./Bundle-Prescription-example-06.json"; // uploaded example JSON
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js"; // bootstrap JS (modal etc.)

/**
 * Simple UUID generator for client-side ids (urn:uuid:)
 * Not cryptographically secure but fine for UI/testing.
 */
function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Utility: pretty JSON string
 */
const pretty = (obj) => JSON.stringify(obj, null, 2);

/**
 * Simple line-by-line diff array between two pretty JSON strings.
 * Returns array of { leftLine, rightLine, same }
 */
function lineDiff(leftStr, rightStr) {
  const left = leftStr.split("\n");
  const right = rightStr.split("\n");
  const max = Math.max(left.length, right.length);
  const rows = [];
  for (let i = 0; i < max; i++) {
    const l = left[i] ?? "";
    const r = right[i] ?? "";
    rows.push({ leftLine: l, rightLine: r, same: l === r });
  }
  return rows;
}

export default function App() {
  // Practitioner top (doctor)
  const [practitioner, setPractitioner] = useState({
    name: "Dr. DEF", // placeholder
    license: "21-1521-3828-3227",
  });

  // Patient
  const [patient, setPatient] = useState({
    name: "ABC",
    mrn: "22-7225-4829-5255",
    birthDate: "1981-01-12",
    gender: "male",
    phone: "+919818512600",
  });

  // Condition / Diagnosis
  const [condition, setCondition] = useState({
    text: "Abdominal pain",
    code: "21522001",
    clinicalStatus: "active",
  });

  // Prescription (Composition)
  const [composition, setComposition] = useState({
    title: "Prescription record",
    status: "final",
    date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
  });

  // Dynamic medications list (maps to MedicationRequest entries)
  const [medications, setMedications] = useState([
    {
      id: uuidv4(),
      medicationText: "Azithromycin 250 mg oral tablet",
      dosageText: "One tablet at once",
      additionalInstruction: "With or after food",
      frequency: 1,
      period: 1,
      periodUnit: "d",
      route: "Oral Route",
      method: "Swallow",
      reason: "Abdominal pain",
      authoredOn: new Date().toISOString().slice(0, 10),
    },
    {
      id: uuidv4(),
      medicationText: "Paracetemol 500mg Oral Tab",
      dosageText: "Take two tablets orally with or after meal once a day",
      additionalInstruction: "",
      frequency: null,
      period: null,
      periodUnit: "d",
      route: "",
      method: "",
      reason: "Abdominal pain",
      authoredOn: new Date().toISOString().slice(0, 10),
    },
  ]);

  // Optional attachment file -> base64 data
  const [attachmentBase64, setAttachmentBase64] = useState(null);
  const fileRef = useRef();

  // Generated JSON and UI
  const [generated, setGenerated] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [diffRows, setDiffRows] = useState([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Form handlers
  const handlePractitionerChange = (e) =>
    setPractitioner({ ...practitioner, [e.target.name]: e.target.value });

  const handlePatientChange = (e) =>
    setPatient({ ...patient, [e.target.name]: e.target.value });

  const handleConditionChange = (e) =>
    setCondition({ ...condition, [e.target.name]: e.target.value });

  const handleCompositionChange = (e) =>
    setComposition({ ...composition, [e.target.name]: e.target.value });

  const handleMedChange = (index, field, value) => {
    const copy = [...medications];
    copy[index][field] = value;
    setMedications(copy);
  };

  const addMedication = () => {
    setMedications([
      ...medications,
      {
        id: uuidv4(),
        medicationText: "",
        dosageText: "",
        additionalInstruction: "",
        frequency: null,
        period: null,
        periodUnit: "d",
        route: "",
        method: "",
        reason: condition.text || "",
        authoredOn: composition.date,
      },
    ]);
  };

  const removeMedication = (index) => {
    const copy = [...medications];
    copy.splice(index, 1);
    setMedications(copy);
  };

  // Attachment file -> base64
  const handleFile = (file) => {
    if (!file) {
      setAttachmentBase64(null);
      return;
    }
    if (file.type !== "application/pdf") {
      alert("Only PDF attachments allowed.");
      fileRef.current.value = "";
      setAttachmentBase64(null);
      return;
    }
    const reader = new FileReader();
    reader.onload = function (e) {
      const base64 = e.target.result.split(",")[1];
      setAttachmentBase64(base64);
    };
    reader.onerror = function (e) {
      alert("Failed to read file.");
      setAttachmentBase64(null);
    };
    reader.readAsDataURL(file);
  };

  /**
   * Build the Bundle JSON matching structure/order of example:
   * 1. Composition
   * 2. Patient
   * 3. Practitioner
   * 4. MedicationRequest... (for each med)
   * 5. Condition
   * 6. Binary (if any)
   *
   * Some system fields are hardcoded / placeholders and can be replaced by backend via //fetch via api
   */
  const buildBundle = () => {
    try {
      setErrorMsg("");
      // Basic validation
      if (!practitioner.name || !practitioner.license) {
        throw new Error("Practitioner name and license are required.");
      }
      if (!patient.name || !patient.mrn || !patient.birthDate) {
        throw new Error("Patient name, MRN and DOB are required.");
      }
      if (!condition.text) {
        throw new Error("Condition/Diagnosis is required.");
      }
      if (!composition.title || !composition.date || !composition.status) {
        throw new Error("Prescription title, date and status are required.");
      }
      if (!medications.length) {
        throw new Error("Add at least one medication.");
      }
      medications.forEach((m, idx) => {
        if (!m.medicationText || !m.dosageText) {
          throw new Error(
            `Medication #${idx + 1}: Drug name and Dosage Instructions are required.`
          );
        }
      });

      // Generate ids for resources
      const compId = uuidv4();
      const patientId = uuidv4();
      const practitionerId = uuidv4();
      const conditionId = uuidv4();
      const medReqIds = medications.map(() => uuidv4());
      const binaryId = attachmentBase64 ? uuidv4() : null;

      // System-generated meta (could be fetched from backend)
      const hardcodedMetaBundle = {
        versionId: "1", // //fetch via api
        lastUpdated: new Date().toISOString(),
        profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle"],
        // security example from uploaded file
        security: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v3-Confidentiality",
            code: "V",
            display: "very restricted",
          },
        ],
      };

      const bundleIdentifier = {
        system: "http://hip.in", // //fetch via api
        value: uuidv4(),
      };

      // Build Composition (Prescription header)
      const compositionResource = {
        resourceType: "Composition",
        id: compId,
        meta: {
          versionId: "1", // //fetch via api
          lastUpdated: new Date().toISOString(),
          profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/PrescriptionRecord"],
        },
        language: "en-IN",
        text: {
          status: "generated",
          div: `<div><p>Generated Narrative: Composition ${compId}</p><p>identifier: ${bundleIdentifier.system}/${bundleIdentifier.value}</p><p>status: ${composition.status}</p><p>date: ${composition.date}</p></div>`,
        },
        identifier: {
          system: "https://ndhm.in/phr", // //fetch via api
          value: uuidv4(),
        },
        status: composition.status === "final" ? "final" : composition.status,
        type: {
          coding: [
            {
              system: "http://snomed.info/sct", // prescription code default
              code: "440545006",
              display: "Prescription record",
            },
          ],
          text: "Prescription record",
        },
        subject: {
          reference: `urn:uuid:${patientId}`,
          display: patient.name,
        },
        date: composition.date,
        author: [
          {
            reference: `urn:uuid:${practitionerId}`,
            display: practitioner.name,
          },
        ],
        title: composition.title,
        section: [
          {
            title: "Prescription record",
            code: {
              coding: [
                {
                  system: "http://snomed.info/sct",
                  code: "440545006",
                  display: "Prescription record",
                },
              ],
            },
            entry: medications.map((m, idx) => ({
              reference: `urn:uuid:${medReqIds[idx]}`,
              type: "MedicationRequest",
            })).concat(binaryId ? [{ reference: `urn:uuid:${binaryId}`, type: "Binary" }] : []),
          },
        ],
      };

      // Build Patient resource
      const patientResource = {
        resourceType: "Patient",
        id: patientId,
        meta: {
          versionId: "1",
          lastUpdated: new Date().toISOString(),
          profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient"],
        },
        text: {
          status: "generated",
          div: `<div><p>Patient ${patient.name}, DoB: ${patient.birthDate}</p></div>`,
        },
        identifier: [
          {
            type: {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/v2-0203",
                  code: "MR",
                  display: "Medical record number",
                },
              ],
            },
            system: "https://healthid.ndhm.gov.in", // //fetch via api
            value: patient.mrn,
          },
        ],
        name: [{ text: patient.name }],
        telecom: [{ system: "phone", value: patient.phone, use: "home" }],
        gender: patient.gender,
        birthDate: patient.birthDate,
      };

      // Practitioner resource
      const practitionerResource = {
        resourceType: "Practitioner",
        id: practitionerId,
        meta: {
          versionId: "1",
          lastUpdated: new Date().toISOString(),
          profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/Practitioner"],
        },
        text: {
          status: "generated",
          div: `<div><p>Practitioner ${practitioner.name}</p></div>`,
        },
        identifier: [
          {
            type: {
              coding: [
                {
                  system: "http://terminology.hl7.org/CodeSystem/v2-0203",
                  code: "MD",
                  display: "Medical License number",
                },
              ],
            },
            system: "https://doctor.ndhm.gov.in", // //fetch via api
            value: practitioner.license,
          },
        ],
        name: [{ text: practitioner.name }],
      };

      // MedicationRequest resources
      const medicationResources = medications.map((m, idx) => {
        const dosage = {
          text: m.dosageText,
        };

        if (m.additionalInstruction) {
          dosage.additionalInstruction = [
            {
              coding: [
                {
                  system: "http://snomed.info/sct",
                  // mapping to code would be done server-side; using placeholder
                  code: "311504000",
                  display: m.additionalInstruction,
                },
              ],
            },
          ];
        }

        if (m.frequency || m.period) {
          dosage.timing = {
            repeat: {
              ...(m.frequency ? { frequency: Number(m.frequency) } : {}),
              ...(m.period ? { period: Number(m.period) } : {}),
              periodUnit: m.periodUnit || "d",
            },
          };
        }

        if (m.route) {
          dosage.route = {
            coding: [
              {
                system: "http://snomed.info/sct",
                code: "26643006",
                display: m.route,
              },
            ],
          };
        }

        if (m.method) {
          dosage.method = {
            coding: [
              {
                system: "http://snomed.info/sct",
                code: "421521009",
                display: m.method,
              },
            ],
          };
        }

        return {
          resourceType: "MedicationRequest",
          id: medReqIds[idx],
          meta: { profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/MedicationRequest"] },
          text: {
            status: "generated",
            div: `<div><p>MedicationRequest ${medReqIds[idx]}</p><p>medication: ${m.medicationText}</p><p>dosage: ${m.dosageText}</p></div>`,
          },
          status: "active", // default
          intent: "order",
          medicationCodeableConcept: m.medicationText ? { text: m.medicationText } : undefined,
          subject: { reference: `urn:uuid:${patientId}`, display: patient.name },
          authoredOn: m.authoredOn || composition.date,
          requester: { reference: `urn:uuid:${practitionerId}`, display: practitioner.name },
          reasonCode: [
            {
              coding: [
                {
                  system: "http://snomed.info/sct",
                  code: condition.code || "unknown",
                  display: condition.text,
                },
              ],
            },
          ],
          reasonReference: [{ reference: `urn:uuid:${conditionId}`, display: "Condition" }],
          dosageInstruction: [dosage],
        };
      });

      // Condition resource
      const conditionResource = {
        resourceType: "Condition",
        id: conditionId,
        meta: { profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/Condition"] },
        text: {
          status: "generated",
          div: `<div><p>Condition ${condition.text}</p></div>`,
        },
        clinicalStatus: {
          coding: [
            {
              system: "http://terminology.hl7.org/CodeSystem/condition-clinical",
              code: condition.clinicalStatus || "active",
              display: condition.clinicalStatus || "Active",
            },
          ],
        },
        code: {
          coding: [
            {
              system: "http://snomed.info/sct",
              code: condition.code || "21522001",
              display: condition.text,
            },
          ],
          text: condition.text,
        },
        subject: { reference: `urn:uuid:${patientId}`, display: patient.name },
      };

      // Binary resource (attachment) if present
      const binaryResource = attachmentBase64
        ? {
            resourceType: "Binary",
            id: binaryId,
            meta: { profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/Binary"] },
            contentType: "application/pdf",
            data: attachmentBase64,
          }
        : null;

      // Compose final Bundle in correct order
      const entries = [];

      // Composition first (as in example)
      entries.push({
        fullUrl: `urn:uuid:${compositionResource.id}`,
        resource: compositionResource,
      });

      // Patient (after composition)
      entries.push({
        fullUrl: `urn:uuid:${patientResource.id}`,
        resource: patientResource,
      });

      // Practitioner
      entries.push({
        fullUrl: `urn:uuid:${practitionerResource.id}`,
        resource: practitionerResource,
      });

      // MedicationRequests
      medicationResources.forEach((mr) =>
        entries.push({
          fullUrl: `urn:uuid:${mr.id}`,
          resource: mr,
        })
      );

      // Condition
      entries.push({
        fullUrl: `urn:uuid:${conditionResource.id}`,
        resource: conditionResource,
      });

      // Binary (optional)
      if (binaryResource) {
        entries.push({
          fullUrl: `urn:uuid:${binaryResource.id}`,
          resource: binaryResource,
        });
      }

      const bundle = {
        resourceType: "Bundle",
        id: composition.identifier?.value || `Prescription-${uuidv4()}`,
        meta: hardcodedMetaBundle,
        identifier: bundleIdentifier,
        type: "document",
        timestamp: new Date().toISOString(),
        entry: entries,
      };

      // Save generated JSON to state
      setGenerated(bundle);
      return bundle;
    } catch (err) {
      setErrorMsg(err.message || String(err));
      console.error(err);
      return null;
    }
  };

  // Generate button handler
  const handleGenerate = (e) => {
    e.preventDefault();
    try {
      const b = buildBundle();
      if (b) {
        setErrorMsg("");
        // Scroll to JSON view (optional)
        setTimeout(() => {
          document.getElementById("generated-json")?.scrollIntoView({ behavior: "smooth" });
        }, 100);
      }
    } catch (err) {
      setErrorMsg(err.message || "Failed to generate JSON");
    }
  };

  // Download JSON
  const handleDownload = () => {
    if (!generated) {
      alert("Generate JSON first.");
      return;
    }
    try {
      const blob = new Blob([pretty(generated)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${generated.id || "prescription"}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("Download failed: " + err.message);
    }
  };

  // Compare with uploaded example JSON and show modal
  const handleCompare = () => {
    if (!generated) {
      alert("Generate JSON first to compare.");
      return;
    }
    const left = pretty(exampleBundle);
    const right = pretty(generated);
    const rows = lineDiff(left, right);
    setDiffRows(rows);
    setShowCompareModal(true);
  };

  return (
    <div className="container py-4">
      <h2 className="mb-3">Prescription Builder (Practitioner workflow)</h2>

      {/* Practitioner */}
      <div className="card mb-3">
        <div className="card-header">1. Practitioner (You) <span className="text-danger">*</span></div>
        <div className="card-body">
          <div className="row g-2">
            <div className="col-md-6">
              <label className="form-label">Practitioner Name <span className="text-danger">*</span></label>
              <input
                name="name"
                type="text"
                className="form-control"
                value={practitioner.name}
                onChange={handlePractitionerChange}
              />
            </div>
            <div className="col-md-6">
              <label className="form-label">Medical License No. <span className="text-danger">*</span></label>
              <input
                name="license"
                type="text"
                className="form-control"
                value={practitioner.license}
                onChange={handlePractitionerChange}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Patient */}
      <div className="card mb-3">
        <div className="card-header">2. Patient Info <span className="text-danger">*</span></div>
        <div className="card-body">
          <div className="row g-2">
            <div className="col-md-4">
              <label className="form-label">Full Name <span className="text-danger">*</span></label>
              <input name="name" type="text" className="form-control" value={patient.name} onChange={handlePatientChange} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Medical Record No. <span className="text-danger">*</span></label>
              <input name="mrn" type="text" className="form-control" value={patient.mrn} onChange={handlePatientChange} />
            </div>
            <div className="col-md-4">
              <label className="form-label">Phone</label>
              <input name="phone" type="tel" className="form-control" value={patient.phone} onChange={handlePatientChange} />
            </div>

            <div className="col-md-4 mt-2">
              <label className="form-label">Date of Birth <span className="text-danger">*</span></label>
              <input name="birthDate" type="date" className="form-control" value={patient.birthDate} onChange={handlePatientChange} />
            </div>
            <div className="col-md-4 mt-2">
              <label className="form-label">Gender <span className="text-danger">*</span></label>
              <select name="gender" className="form-select" value={patient.gender} onChange={handlePatientChange}>
                <option value="male">Male</option>
                <option value="female">Female</option>
                <option value="other">Other</option>
                <option value="unknown">Unknown</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Condition */}
      <div className="card mb-3">
        <div className="card-header">3. Condition / Diagnosis <span className="text-danger">*</span></div>
        <div className="card-body">
          <div className="row g-2">
            <div className="col-md-6">
              <label className="form-label">Diagnosis Name <span className="text-danger">*</span></label>
              <input name="text" type="text" className="form-control" value={condition.text} onChange={handleConditionChange} />
            </div>
            <div className="col-md-3">
              <label className="form-label">Diagnosis Code (optional)</label>
              <input name="code" type="text" className="form-control" value={condition.code} onChange={handleConditionChange} />
            </div>
            <div className="col-md-3">
              <label className="form-label">Clinical Status</label>
              <select name="clinicalStatus" className="form-select" value={condition.clinicalStatus} onChange={handleConditionChange}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Prescription / Composition info BEFORE medications (as requested) */}
      <div className="card mb-3 border-primary">
        <div className="card-header bg-primary text-white">4. Prescription / Document Info <span className="text-danger">*</span></div>
        <div className="card-body">
          <div className="row g-2">
            <div className="col-md-6">
              <label className="form-label">Title <span className="text-danger">*</span></label>
              <input name="title" type="text" className="form-control" value={composition.title} onChange={handleCompositionChange} />
            </div>
            <div className="col-md-3">
              <label className="form-label">Status <span className="text-danger">*</span></label>
              <select name="status" className="form-select" value={composition.status} onChange={handleCompositionChange}>
                <option value="final">Final</option>
                <option value="draft">Draft</option>
              </select>
            </div>
            <div className="col-md-3">
              <label className="form-label">Prescription Date <span className="text-danger">*</span></label>
              <input name="date" type="date" className="form-control" value={composition.date} onChange={handleCompositionChange} />
            </div>
          </div>
          <small className="text-muted d-block mt-2">This section will be the header (Composition) in the generated JSON and will reference patient & practitioner.</small>
        </div>
      </div>

      {/* Medications dynamic list */}
      <div className="card mb-3">
        <div className="card-header">5. Medications <span className="text-danger">*</span></div>
        <div className="card-body">
          {medications.map((m, idx) => (
            <div className="border rounded p-3 mb-2" key={m.id}>
              <div className="d-flex justify-content-between">
                <h6>Medication #{idx + 1}</h6>
                <div>
                  <button
                    className="btn btn-sm btn-danger me-2"
                    onClick={() => removeMedication(idx)}
                    disabled={medications.length === 1}
                    title="Remove medication"
                  >
                    Remove
                  </button>
                </div>
              </div>

              <div className="row g-2">
                <div className="col-md-6">
                  <label className="form-label">Drug Name <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    value={m.medicationText}
                    onChange={(e) => handleMedChange(idx, "medicationText", e.target.value)}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Dosage Instructions <span className="text-danger">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    value={m.dosageText}
                    onChange={(e) => handleMedChange(idx, "dosageText", e.target.value)}
                  />
                </div>

                <div className="col-md-4">
                  <label className="form-label">Additional Instruction</label>
                  <select
                    className="form-select"
                    value={m.additionalInstruction}
                    onChange={(e) => handleMedChange(idx, "additionalInstruction", e.target.value)}
                  >
                    <option value="">-- none --</option>
                    <option>With or after food</option>
                    <option>Before food</option>
                    <option>Empty stomach</option>
                  </select>
                </div>

                <div className="col-md-2">
                  <label className="form-label">Frequency</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={m.frequency ?? ""}
                    onChange={(e) => handleMedChange(idx, "frequency", e.target.value !== "" ? Number(e.target.value) : null)}
                  />
                </div>

                <div className="col-md-2">
                  <label className="form-label">Period</label>
                  <input
                    type="number"
                    min="0"
                    className="form-control"
                    value={m.period ?? ""}
                    onChange={(e) => handleMedChange(idx, "period", e.target.value !== "" ? Number(e.target.value) : null)}
                  />
                </div>

                <div className="col-md-2">
                  <label className="form-label">Unit</label>
                  <select className="form-select" value={m.periodUnit} onChange={(e) => handleMedChange(idx, "periodUnit", e.target.value)}>
                    <option value="d">Day(s)</option>
                    <option value="h">Hour(s)</option>
                    <option value="wk">Week(s)</option>
                    <option value="mo">Month(s)</option>
                  </select>
                </div>

                <div className="col-md-3">
                  <label className="form-label">Route</label>
                  <select className="form-select" value={m.route} onChange={(e) => handleMedChange(idx, "route", e.target.value)}>
                    <option value="">-- select --</option>
                    <option>Oral Route</option>
                    <option>Topical</option>
                    <option>Intravenous</option>
                    <option>Intramuscular</option>
                  </select>
                </div>

                <div className="col-md-3">
                  <label className="form-label">Method</label>
                  <select className="form-select" value={m.method} onChange={(e) => handleMedChange(idx, "method", e.target.value)}>
                    <option value="">-- select --</option>
                    <option>Swallow</option>
                    <option>Inhale</option>
                    <option>Apply</option>
                  </select>
                </div>

                <div className="col-md-3">
                  <label className="form-label">Reason (Condition)</label>
                  <select className="form-select" value={m.reason} onChange={(e) => handleMedChange(idx, "reason", e.target.value)}>
                    <option value={condition.text}>{condition.text}</option>
                  </select>
                </div>

                <div className="col-md-3">
                  <label className="form-label">Authored On</label>
                  <input type="date" className="form-control" value={m.authoredOn} onChange={(e) => handleMedChange(idx, "authoredOn", e.target.value)} />
                </div>
              </div>
            </div>
          ))}

          <div className="mt-2">
            <button className="btn btn-sm btn-secondary" onClick={addMedication}>
              + Add Medication
            </button>
          </div>
          <small className="text-muted d-block mt-2">Each medication maps to one MedicationRequest entry in the generated JSON.</small>
        </div>
      </div>

      {/* Attachment */}
      <div className="card mb-3">
        <div className="card-header">6. Attachment (Optional)</div>
        <div className="card-body">
          <div className="mb-2">
            <input type="file" accept="application/pdf" ref={fileRef} onChange={(e) => handleFile(e.target.files[0])} />
          </div>
          <small className="text-muted">If you upload a PDF, it will be encoded into the Bundle as a Binary resource (base64).</small>
        </div>
      </div>

      {/* Actions */}
      <div className="mb-4">
        <button className="btn btn-primary me-2" onClick={handleGenerate}>
          Generate JSON
        </button>
        <button className="btn btn-outline-primary me-2" onClick={handleDownload}>
          Download JSON
        </button>
        <button className="btn btn-outline-secondary" onClick={handleCompare}>
          Compare With Example
        </button>
        {errorMsg && <div className="alert alert-danger mt-2">{errorMsg}</div>}
      </div>

      {/* Generated JSON display */}
      <div id="generated-json" className="mb-5">
        <h5>Generated JSON</h5>
        {generated ? (
          <pre style={{ maxHeight: 500, overflow: "auto", background: "#f7f7f7", padding: 12 }}>{pretty(generated)}</pre>
        ) : (
          <div className="text-muted">No JSON generated yet. Click "Generate JSON".</div>
        )}
      </div>

      {/* Compare Modal */}
      {showCompareModal && (
        <div className="modal show d-block" tabIndex="-1" role="dialog" style={{ background: "rgba(0,0,0,0.5)" }}>
          <div className="modal-dialog modal-xl" role="document">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Compare Generated JSON vs Example</h5>
                <button
                  type="button"
                  className="btn-close"
                  aria-label="Close"
                  onClick={() => {
                    setShowCompareModal(false);
                  }}
                ></button>
              </div>
              <div className="modal-body" style={{ fontFamily: "monospace", fontSize: 12 }}>
                <div className="row">
                  <div className="col-md-6 border-end">
                    <h6>Example (uploaded)</h6>
                    <div style={{ maxHeight: "60vh", overflow: "auto" }}>
                      {diffRows.map((r, i) => (
                        <div key={i} style={{ whiteSpace: "pre-wrap", background: r.same ? "transparent" : "#ffe6e6" }}>
                          {r.leftLine}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="col-md-6">
                    <h6>Generated</h6>
                    <div style={{ maxHeight: "60vh", overflow: "auto" }}>
                      {diffRows.map((r, i) => (
                        <div key={i} style={{ whiteSpace: "pre-wrap", background: r.same ? "transparent" : "#e6ffe6" }}>
                          {r.rightLine}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="mt-3">
                  <small className="text-muted">Red = example differs; Green = generated differs. This is a line-level visual diff to help spot differences quickly.</small>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setShowCompareModal(false)}>
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <footer className="text-muted mt-5">
        <small>
          Notes: System-generated fields (ids, meta.profile, identifier.system) are set client-side as placeholders. Replace them from backend or API as needed (marked in code with{" "}
          <code>//fetch via api</code> comments).
        </small>
      </footer>
    </div>
  );
}
