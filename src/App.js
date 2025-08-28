// src/App.js
import React, { useState, useRef, useEffect } from "react";
import exampleBundle from "./Bundle-Prescription-example-06.json";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

/*
  Lightweight uuid generator (client-side, fine for UI use).
  If you prefer, replace with `import { v4 as uuidv4 } from 'uuid'`.
*/
function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/* Return ISO string with local timezone offset, e.g. 2025-08-12T14:35:21+05:30 */
function getISOWithOffsetFromDateInput(dateInput /* optional 'YYYY-MM-DD' */) {
  const now = new Date();
  let d;
  if (dateInput) {
    // combine date with current time to preserve time-of-day
    const [y, m, day] = dateInput.split("-");
    const hh = String(now.getHours()).padStart(2, "0");
    const mm = String(now.getMinutes()).padStart(2, "0");
    const ss = String(now.getSeconds()).padStart(2, "0");
    d = new Date(`${y}-${m}-${day}T${hh}:${mm}:${ss}`);
  } else {
    d = now;
  }
  const tzOffsetMin = d.getTimezoneOffset();
  const sign = tzOffsetMin > 0 ? "-" : "+";
  const pad = (n) => String(n).padStart(2, "0");
  const offsetHr = pad(Math.floor(Math.abs(tzOffsetMin) / 60));
  const offsetMin = pad(Math.abs(tzOffsetMin) % 60);
  return d.toISOString().replace("Z", `${sign}${offsetHr}:${offsetMin}`);
}

/* Pretty-print */
const pretty = (o) => JSON.stringify(o, null, 2);

/* Line-level diff helper */
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
  // Practitioner first (top)
  const [practitioner, setPractitioner] = useState({
    name: "Dr. DEF",
    license: "21-1521-3828-3227",
  });

  // Patient list from API
  const [patientList, setPatientList] = useState([]); // all patients from API
  const [selectedPatientId, setSelectedPatientId] = useState(""); // dropdown selected id

  useEffect(() => {
    fetch("/patients.json") // replace with your actual API endpoint
      .then(res => res.json())
      .then(data => setPatientList(data))
      .catch(err => console.error("Error fetching patients:", err));
  }, []);



  // Patient
  const [patient, setPatient] = useState({
    name: "ABC",
    mrn: "22-7225-4829-5255",
    birthDate: "1981-01-12", // YYYY-MM-DD input
    gender: "male",
    phone: "+919818512600",
  });


  // Condition / Diagnosis
  const [condition, setCondition] = useState({
    text: "Abdominal pain",
    code: "21522001",
    clinicalStatus: "active",
  });

  // Composition / Prescription header
  const [composition, setComposition] = useState({
    title: "Prescription record",
    status: "final",
    date: new Date().toISOString().slice(0, 10), // default YYYY-MM-DD for date picker
  });

  // Medicines dynamic list
  const [medications, setMedications] = useState([
    {
      id: uuidv4(),
      medicationText: "Azithromycin 250 mg oral tablet",
      medicationCode: "1145423002", // SNOMED code (placeholder) //fetch via api
      dosageText: "One tablet at once",
      additionalInstruction: "With or after food", // optional
      frequency: 2,
      period: 1,
      periodUnit: "d",
      route: "Oral Route",
      method: "Swallow",
      authoredOn: formatDateOnly(composition.date),
    },
  ]);



  // Attachment (PDF) base64
  const [attachmentBase64, setAttachmentBase64] = useState(null);
  const [attachmentMime, setAttachmentMime] = useState(null);
  const fileRef = useRef();

  // Generated bundle & UI state
  const [generated, setGenerated] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [diffRows, setDiffRows] = useState([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Handlers
  const handlePractitionerChange = (e) =>
    setPractitioner({ ...practitioner, [e.target.name]: e.target.value });

  const handlePatientChange = (e) =>
    setPatient({ ...patient, [e.target.name]: e.target.value });

  const handleConditionChange = (e) =>
    setCondition({ ...condition, [e.target.name]: e.target.value });

  const handleCompositionChange = (e) =>
    setComposition({ ...composition, [e.target.name]: e.target.value });

  function handleMedChange(index, field, value) {
    const copy = [...medications];
    copy[index][field] = value;
    setMedications(copy);
  }

  function addMedication() {
    setMedications((prev) => [
      ...prev,
      {
        id: uuidv4(),
        medicationText: "",
        medicationCode: "",
        // default human-readable dosage
        dosageText: "One tablet at once",
        // default as string (matches your current selects) — buildDosageInstruction will map to codes
        additionalInstruction: "With or after food",
        // timing object used by buildDosageInstruction
        timing: { frequency: 2, period: 1, periodUnit: "d" },
        // route/method as strings (UI uses strings); builder will map to SNOMED codes
        route: "Oral Route",
        method: "Swallow",
        // keep authoredOn
        authoredOn: composition.date,
      },
    ]);
  }

  function removeMedication(index) {
    if (medications.length === 1) return;
    const copy = [...medications];
    copy.splice(index, 1);
    setMedications(copy);
  }

  // File -> base64 (supports PDF and JPEG/JPG)
  const handleFile = (file) => {
    // no file selected -> clear state
    if (!file) {
      setAttachmentBase64(null);
      setAttachmentMime(null);
      return;
    }

    // allowed MIME types
    const allowedTypes = ["application/pdf", "image/jpeg", "image/jpg"];
    if (!allowedTypes.includes(file.type)) {
      alert("Only PDF, JPG or JPEG files are allowed.");
      // clear the file input visually and state
      if (fileRef?.current) fileRef.current.value = "";
      setAttachmentBase64(null);
      setAttachmentMime(null);
      return;
    }

    // read file as data URL and store base64 + mime
    const reader = new FileReader();
    reader.onload = function (e) {
      const base64 = e.target.result.split(",")[1];
      setAttachmentBase64(base64);
      setAttachmentMime(file.type);
    };
    reader.onerror = function () {
      alert("Failed to read file.");
      setAttachmentBase64(null);
      setAttachmentMime(null);
    };
    reader.readAsDataURL(file);
  };


  /* Format date as YYYY-MM-DD */
  function formatDateOnly(dateInput) {
    return new Date(dateInput).toISOString().split("T")[0];
  }

  // Build dosageInstruction dynamically and robustly.
  // Accepts either strings (from your selects) or objects {code,display}.
  // Returns an array (dosageInstruction must be an array).
  const buildDosageInstruction = (formValues = {}) => {
    const dosage = {
      text: formValues.dosageText || "One tablet at once",
    };

    // additionalInstruction: accept string or {code,display}
    if (formValues.additionalInstruction) {
      const ai = formValues.additionalInstruction;
      const display = typeof ai === "string" ? ai : ai.display || String(ai);
      const code = typeof ai === "string" ? "311504000" : ai.code || "311504000";
      dosage.additionalInstruction = [
        {
          coding: [
            {
              system: "http://snomed.info/sct",
              code: code,
              display: display,
            },
          ],
        },
      ];
    }

    // timing: accept full timing object or separate frequency/period fields
    const timingSrc =
      formValues.timing ||
      (formValues.frequency || formValues.period
        ? {
          frequency: formValues.frequency || 2,
          period: formValues.period || 1,
          periodUnit: formValues.periodUnit || "d",
        }
        : null);

    if (timingSrc) {
      dosage.timing = {
        repeat: {
          ...(timingSrc.frequency ? { frequency: Number(timingSrc.frequency) } : {}),
          ...(timingSrc.period ? { period: Number(timingSrc.period) } : {}),
          periodUnit: timingSrc.periodUnit || "d",
        },
      };
    }

    // route: accept string or {code,display}
    if (formValues.route) {
      const r = formValues.route;
      const display = typeof r === "string" ? r : r.display || String(r);
      const code = typeof r === "string" ? "26643006" : r.code || "26643006";
      dosage.route = {
        coding: [
          {
            system: "http://snomed.info/sct",
            code,
            display,
          },
        ],
      };
    }

    // method: accept string or {code,display}
    if (formValues.method) {
      const mm = formValues.method;
      const display = typeof mm === "string" ? mm : mm.display || String(mm);
      const code = typeof mm === "string" ? "421521009" : mm.code || "421521009";
      dosage.method = {
        coding: [
          {
            system: "http://snomed.info/sct",
            code,
            display,
          },
        ],
      };
    }

    return [dosage];
  };



  /*
    Build the Bundle JSON with correct structures:
    - Dates in full ISO with timezone (dateTime)
    - medicationCodeableConcept.coding[] (system/code/display)
    - dosageInstruction: always include text; include extra fields only if provided
    - Entry order: Composition, Patient, Practitioner, MedicationRequest..., Condition, Binary
  */
  const buildBundle = () => {
    const compId = uuidv4();
    const patientId = uuidv4();
    const practitionerId = uuidv4();
    const conditionId = uuidv4();
    const medReqIds = medications.map(() => uuidv4());
    const binaryId = uuidv4();

    const bundle = {
      resourceType: "Bundle",
      id: `Prescription-${uuidv4()}`,
      meta: {
        versionId: "1",
        lastUpdated: getISOWithOffsetFromDateInput(),
        profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/DocumentBundle"],
        security: [
          {
            system: "http://terminology.hl7.org/CodeSystem/v3-Confidentiality",
            code: "V",
            display: "very restricted",
          },
        ],
      },
      identifier: {
        system: "http://hip.in",
        value: uuidv4(),
      },
      type: "document",
      timestamp: getISOWithOffsetFromDateInput(),
      entry: [],
    };

    /* Composition */
    const compositionResource = {
      resourceType: "Composition",
      id: compId,
      meta: {
        versionId: "1",
        lastUpdated: getISOWithOffsetFromDateInput(),
        profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/PrescriptionRecord"],
      },
      language: "en-IN",
      identifier: {
        system: "https://ndhm.in/phr",
        value: uuidv4(),
      },
      status: composition.status,
      type: {
        coding: [
          {
            system: "http://snomed.info/sct",
            code: "440545006",
            display: "Prescription record",
          },
        ],
        text: "Prescription record",
      },
      subject: { reference: `urn:uuid:${patientId}`, display: "Patient" },
      date: `${composition.date}T00:00:00+05:30`,
      author: [{ reference: `urn:uuid:${practitionerId}`, display: "Practitioner" }],
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
          entry: [
            ...medReqIds.map((id) => ({
              reference: `urn:uuid:${id}`,
              type: "MedicationRequest",
            })),
            ...(attachmentBase64 && attachmentMime
              ? [{ reference: `urn:uuid:${binaryId}`, type: "Binary" }]
              : []),
          ],
        },
      ],
    };

    /* Patient */
    const patientResource = {
      resourceType: "Patient",
      id: patientId,
      meta: {
        versionId: "1",
        lastUpdated: getISOWithOffsetFromDateInput(),
        profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient"],
      },
      identifier: [
        {
          type: {
            coding: [
              { system: "http://terminology.hl7.org/CodeSystem/v2-0203", code: "MR", display: "Medical record number" },
            ],
          },
          system: "https://healthid.ndhm.gov.in",
          value: patient.mrn,
        },
      ],
      name: [{ text: patient.name }],
      telecom: [{ system: "phone", value: patient.phone, use: "home" }],
      gender: patient.gender,
      birthDate: patient.birthDate,
    };

    /* Practitioner */
    const practitionerResource = {
      resourceType: "Practitioner",
      id: practitionerId,
      meta: {
        versionId: "1",
        lastUpdated: getISOWithOffsetFromDateInput(),
        profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/Practitioner"],
      },
      identifier: [
        {
          type: {
            coding: [
              { system: "http://terminology.hl7.org/CodeSystem/v2-0203", code: "MD", display: "Medical License number" },
            ],
          },
          system: "https://doctor.ndhm.gov.in",
          value: practitioner.license,
        },
      ],
      name: [{ text: practitioner.name }],
    };

    /* MedicationRequests */
    const medicationResources = medications.map((m, idx) => ({
      resourceType: "MedicationRequest",
      id: medReqIds[idx],
      meta: { profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/MedicationRequest"] },
      status: "active",
      intent: "order",
      medicationCodeableConcept:
        m.medicationCode && m.medicationCode.trim() !== ""
          ? { coding: [{ system: "http://snomed.info/sct", code: m.medicationCode.trim(), display: m.medicationText }] }
          : { text: m.medicationText },
      subject: { reference: `urn:uuid:${patientId}`, display: patient.name },
      authoredOn: formatDateOnly(composition.date),
      requester: { reference: `urn:uuid:${practitionerId}`, display: practitioner.name },
      reasonCode: [{ coding: [{ system: "http://snomed.info/sct", code: condition.code, display: condition.text }] }],
      reasonReference: [{ reference: `urn:uuid:${conditionId}`, display: "Condition" }],
      dosageInstruction: buildDosageInstruction({
        dosageText: m.dosageText,
        additionalInstruction: m.additionalInstruction,
        timing: m.timing,
        route: m.route,
        method: m.method
      }),
    }));

    /* Condition */
    const conditionResource = {
      resourceType: "Condition",
      id: conditionId,
      meta: { profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/Condition"] },
      clinicalStatus: {
        coding: [
          { system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: condition.clinicalStatus, display: "Active" },
        ],
      },
      code: {
        coding: [{ system: "http://snomed.info/sct", code: condition.code, display: condition.text }],
        text: condition.text,
      },
      subject: { reference: `urn:uuid:${patientId}`, display: "Patient" },
    };

    // simple placeholder base64s
    const placeholderSignature = "/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAIBAQIBAaNLDw+GnFRX...";

    /* Binary — include only if user uploaded file */
    let binaryResource = null;
    if (attachmentBase64 && attachmentMime) {
      binaryResource = {
        resourceType: "Binary",
        id: binaryId,
        meta: {
          profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/Binary"],
        },
        contentType: attachmentMime,
        data: attachmentBase64,
      };
    }

    /* Add resources in example's order */
    bundle.entry.push({ fullUrl: `urn:uuid:${compId}`, resource: compositionResource });
    bundle.entry.push({ fullUrl: `urn:uuid:${patientId}`, resource: patientResource });
    bundle.entry.push({ fullUrl: `urn:uuid:${practitionerId}`, resource: practitionerResource });
    medicationResources.forEach((mr) => bundle.entry.push({ fullUrl: `urn:uuid:${mr.id}`, resource: mr }));
    bundle.entry.push({ fullUrl: `urn:uuid:${conditionId}`, resource: conditionResource });
    if (binaryResource) {
      bundle.entry.push({ fullUrl: `urn:uuid:${binaryId}`, resource: binaryResource });
      compositionResource.section[0].entry.push({
        reference: `urn:uuid:${binaryId}`,
        type: "Binary"
      });
    }

    // Bundle-level signature
    bundle.signature = {
      type: [
        {
          system: "urn:iso-astm:E1762-95:2013",
          code: "1.2.840.10065.1.12.1.1",
          display: "Author's Signature"
        }
      ],
      when: getISOWithOffsetFromDateInput(),
      who: {
        reference: `urn:uuid:${practitionerId}`,
        display: practitioner.name || "Practitioner"
      },
      sigFormat: "image/jpeg",
      data: placeholderSignature
    };

    setGenerated(bundle);
    return bundle;
  };


  // Actions
  const handleGenerate = (e) => {
    e.preventDefault();
    setErrorMsg("");
    buildBundle();
    setTimeout(() => document.getElementById("generated-json")?.scrollIntoView({ behavior: "smooth" }), 100);
  };

  const handleSubmit = () => {
    const jsonOutput = buildBundle(); // still using your existing logic
    console.log("JSON pushed on server");
    // document.getElementById('successAlert').classList.remove('d-none');
    setSuccessMsg("Form Submitted ✅");
    setTimeout(() => {
      setSuccessMsg("");
    }, 3000);
    console.log(JSON.stringify(jsonOutput, null, 2));
  };

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

  // Helper for patient selection
  const handlePatientSelect = (id) => {
    setSelectedPatientId(id);
    const found = patientList.find((p) => p.user_id === id);
    if (found) {
      setPatient({
        name: found.name,
        mrn: found.abha_ref || "", // using abha_ref as MRN
        birthDate: convertDateFormat(found.dob), // convert to YYYY-MM-DD
        gender: found.gender ? found.gender.toLowerCase() : "",
        phone: found.mobile || ""
      });
    }
  };

  // Convert DD-MM-YYYY → YYYY-MM-DD
  const convertDateFormat = (dateStr) => {
    if (!dateStr) return "";
    const [day, month, year] = dateStr.split("-");
    return `${year}-${month}-${day}`;
  };

  return (
    <div className="container py-4">
      <h2 className="mb-3">Prescription Builder (Practitioner workflow) — Full validated output</h2>

      {/* Practitioner */}
      <div className="card mb-3">
        <div className="card-header">1. Practitioner (You) <span className="text-danger">*</span></div>
        <div className="card-body">
          <div className="row g-2">
            <div className="col-md-6">
              <label className="form-label">Practitioner Name <span className="text-danger">*</span></label>
              <input name="name" type="text" className="form-control" value={practitioner.name} onChange={handlePractitionerChange} />
            </div>
            <div className="col-md-6">
              <label className="form-label">Medical License No. <span className="text-danger">*</span></label>
              <input name="license" type="text" className="form-control" value={practitioner.license} onChange={handlePractitionerChange} />
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
              <label className="form-label">Select Patient</label>
              <select
                className="form-select"
                value={selectedPatientId}
                onChange={(e) => handlePatientSelect(e.target.value)}
              >
                <option value="">-- Select a patient --</option>
                {patientList.map((p) => (
                  <option key={p.user_id} value={p.user_id}>
                    {p.name} ({p.mobile})
                  </option>
                ))}
              </select>
            </div>
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
              <label className="form-label">Diagnosis Code (SNOMED) <small className="text-muted">(optional)</small></label>
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

      {/* Composition / Prescription info (before meds) */}
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
        </div>
      </div>

      {/* Medications dynamic list */}
      <div className="card mb-3">
        <div className="card-header">5. Medications <span className="text-danger">*</span></div>
        <div className="card-body">
          {medications.map((m, idx) => (
            <div className="border rounded p-3 mb-2" key={m.id}>
              <div className="d-flex justify-content-between align-items-center">
                <h6>Medication #{idx + 1}</h6>
                <div>
                  <button className="btn btn-sm btn-danger me-2" onClick={() => removeMedication(idx)} disabled={medications.length === 1}>
                    Remove
                  </button>
                </div>
              </div>

              <div className="row g-2">
                <div className="col-md-6">
                  <label className="form-label">Drug Name <span className="text-danger">*</span></label>
                  <input type="text" className="form-control" value={m.medicationText} onChange={(e) => handleMedChange(idx, "medicationText", e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">SNOMED Code (medication) <small className="text-muted">(optional)</small></label>
                  <input type="text" className="form-control" value={m.medicationCode} onChange={(e) => handleMedChange(idx, "medicationCode", e.target.value)} />
                </div>
                <div className="col-md-3">
                  <label className="form-label">Authored On</label>
                  <input type="date" className="form-control" value={m.authoredOn} onChange={(e) => handleMedChange(idx, "authoredOn", e.target.value)} />
                </div>

                <div className="col-md-12">
                  <label className="form-label">Dosage Instructions <span className="text-danger">*</span></label>
                  <input type="text" className="form-control" value={m.dosageText} onChange={(e) => handleMedChange(idx, "dosageText", e.target.value)} />
                </div>

                <div className="col-md-4">
                  <label className="form-label">Additional Instruction</label>
                  <select className="form-select" value={m.additionalInstruction} onChange={(e) => handleMedChange(idx, "additionalInstruction", e.target.value)}>
                    <option value="">-- none --</option>
                    <option>With or after food</option>
                    <option>Before food</option>
                    <option>Empty stomach</option>
                  </select>
                </div>

                <div className="col-md-2">
                  <label className="form-label">Frequency</label>
                  <input type="number" min="0" className="form-control" value={m.frequency ?? ""} onChange={(e) => handleMedChange(idx, "frequency", e.target.value !== "" ? Number(e.target.value) : null)} />
                </div>

                <div className="col-md-2">
                  <label className="form-label">Period</label>
                  <input type="number" min="0" className="form-control" value={m.period ?? ""} onChange={(e) => handleMedChange(idx, "period", e.target.value !== "" ? Number(e.target.value) : null)} />
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

                <div className="col-md-4">
                  <label className="form-label">Route</label>
                  <select className="form-select" value={m.route} onChange={(e) => handleMedChange(idx, "route", e.target.value)}>
                    <option value="">-- select --</option>
                    <option>Oral Route</option>
                    <option>Topical</option>
                    <option>Intravenous</option>
                    <option>Intramuscular</option>
                  </select>
                </div>

                <div className="col-md-4">
                  <label className="form-label">Method</label>
                  <select className="form-select" value={m.method} onChange={(e) => handleMedChange(idx, "method", e.target.value)}>
                    <option value="">-- select --</option>
                    <option>Swallow</option>
                    <option>Inhale</option>
                    <option>Apply</option>
                  </select>
                </div>

                <div className="col-md-4">
                  <label className="form-label">Reason (condition)</label>
                  <select className="form-select" value={m.reason ?? condition.text} onChange={(e) => handleMedChange(idx, "reason", e.target.value)}>
                    <option value={condition.text}>{condition.text}</option>
                  </select>
                </div>
              </div>
            </div>
          ))}

          <div className="mt-2">
            <button className="btn btn-sm btn-secondary" onClick={addMedication}>
              + Add Medication
            </button>
          </div>
          <small className="text-muted d-block mt-2">Each medication becomes a MedicationRequest entry. Extra dosage fields are included in JSON only if filled.</small>
        </div>
      </div>

      {/* Attachment */}
      <div className="card mb-3">
        <div className="card-header">6. Attachment (optional)</div>
        <div className="card-body">
          <input type="file" accept=".pdf,.jpg,.jpeg" ref={fileRef} onChange={(e) => handleFile(e.target.files[0])} />
          <small className="text-muted d-block mt-2">PDF will be encoded as Binary.data (base64).</small>
        </div>
      </div>

      {/* Actions */}
      <div className="mb-4">
        <button className="btn btn-outline-primary" onClick={handleSubmit}>Submit</button>
        {errorMsg && <div className="alert alert-danger mt-2">{errorMsg}</div>}
        {successMsg && <div className="alert alert-success mt-2">{successMsg}</div>}
      </div>

      <footer className="text-muted mt-4">
        <small>Notes: System fields (meta/profile/identifier.system, SNOMED codes) are currently placeholders and annotated with <code>//fetch via api</code>. Replace these with backend values when integrating.</small>
      </footer>
    </div>
  );
}
