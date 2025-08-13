// src/App.js
import React, { useState, useRef } from "react";
import "bootstrap/dist/css/bootstrap.min.css";
import "bootstrap/dist/js/bootstrap.bundle.min.js";

/* Generate UUIDs */
function uuidv4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/* Return current date-time with offset */
function getISOWithOffset(dateInput) {
  const now = new Date();
  const d = dateInput ? new Date(dateInput) : now;
  const tzOffsetMin = d.getTimezoneOffset();
  const sign = tzOffsetMin > 0 ? "-" : "+";
  const pad = (n) => String(n).padStart(2, "0");
  const offsetHr = pad(Math.floor(Math.abs(tzOffsetMin) / 60));
  const offsetMin = pad(Math.abs(tzOffsetMin) % 60);
  return d.toISOString().replace("Z", `${sign}${offsetHr}:${offsetMin}`);
}

/* Format date as YYYY-MM-DD */
function formatDateOnly(dateInput) {
  return new Date(dateInput).toISOString().split("T")[0];
}

/* Pretty-print JSON */
const pretty = (o) => JSON.stringify(o, null, 2);

export default function App() {
  const [practitioner] = useState({
    name: "Dr. DEF",
    license: "21-1521-3828-3227",
  });

  const [patient] = useState({
    name: "ABC",
    mrn: "22-7225-4829-5255",
    birthDate: "1981-01-12",
    gender: "male",
    phone: "+919818512600",
  });

  const [condition] = useState({
    text: "Abdominal pain",
    code: "21522001",
    clinicalStatus: "active",
  });

  const [composition] = useState({
    title: "Prescription record",
    status: "final",
    date: formatDateOnly(new Date()), // YYYY-MM-DD
  });

  const [medications] = useState([
    {
      medicationText: "Azithromycin 250 mg oral tablet",
      medicationCode: "1145423002",
      dosageText: "One tablet at once",
      additionalInstruction: "With or after food",
      frequency: 1,
      period: 1,
      periodUnit: "d",
      route: "Oral Route",
      method: "Swallow",
    },
    {
      medicationText: "Paracetemol 500mg Oral Tab",
      medicationCode: "",
      dosageText: "Take two tablets orally with or after meal once a day",
    },
  ]);

  const [generated, setGenerated] = useState(null);
  const [attachmentBase64, setAttachmentBase64] = useState(null);
  const fileRef = useRef();

  /* Build XHTML narrative block with namespace + styled elements */
  const buildNarrative = (title, contentHtml) => {
    return `<div xmlns="http://www.w3.org/1999/xhtml">
      <p class="res-header-id"><b>Generated Narrative: ${title}</b></p>
      <div style="display: inline-block; background-color: #d9e0e7; padding: 6px; margin: 4px; border: 1px solid #8da1b4; border-radius: 5px;">
        ${contentHtml}
      </div>
    </div>`;
  };

  /* Main Bundle builder */
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
        lastUpdated: getISOWithOffset(),
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
      timestamp: getISOWithOffset(),
      entry: [],
    };

    /* Composition */
    const compositionResource = {
      resourceType: "Composition",
      id: compId,
      meta: {
        versionId: "1",
        lastUpdated: getISOWithOffset(),
        profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/PrescriptionRecord"],
      },
      language: "en-IN",
      text: {
        status: "generated",
        div: buildNarrative("Composition", `<p>status: ${composition.status}</p><p>date: ${composition.date}</p>`),
      },
      identifier: {
        system: "https://ndhm.in/phr",
        value: uuidv4(),
      },
      status: composition.status,
      type: {
        coding: [
          { system: "http://snomed.info/sct", code: "440545006", display: "Prescription record" },
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
              { system: "http://snomed.info/sct", code: "440545006", display: "Prescription record" },
            ],
          },
          entry: [
            ...medReqIds.map((id) => ({ reference: `urn:uuid:${id}`, type: "MedicationRequest" })),
            { reference: `urn:uuid:${binaryId}`, type: "Binary" },
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
        lastUpdated: getISOWithOffset(),
        profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/Patient"],
      },
      text: {
        status: "generated",
        div: buildNarrative("Patient", `<p>${patient.name}, DoB: ${patient.birthDate}</p>`),
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
        lastUpdated: getISOWithOffset(),
        profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/Practitioner"],
      },
      text: {
        status: "generated",
        div: buildNarrative("Practitioner", `<p>name: ${practitioner.name}</p>`),
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
      text: {
        status: "generated",
        div: buildNarrative("MedicationRequest", `<p>medication: ${m.medicationText}</p>`),
      },
      status: "active",
      intent: "order",
      medicationCodeableConcept:
        m.medicationCode && m.medicationCode.trim() !== ""
          ? { coding: [{ system: "http://snomed.info/sct", code: m.medicationCode.trim(), display: m.medicationText }] }
          : { text: m.medicationText },
      subject: { reference: `urn:uuid:${patientId}`, display: patient.name },
      authoredOn: composition.date,
      requester: { reference: `urn:uuid:${practitionerId}`, display: practitioner.name },
      reasonCode: [{ coding: [{ system: "http://snomed.info/sct", code: condition.code, display: condition.text }] }],
      reasonReference: [{ reference: `urn:uuid:${conditionId}`, display: "Condition" }],
      dosageInstruction: [{ text: m.dosageText }],
    }));

    /* Condition */
    const conditionResource = {
      resourceType: "Condition",
      id: conditionId,
      meta: { profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/Condition"] },
      text: {
        status: "generated",
        div: buildNarrative("Condition", `<p>${condition.text}</p>`),
      },
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

    /* Binary */
    const binaryResource = {
      resourceType: "Binary",
      id: binaryId,
      meta: { profile: ["https://nrces.in/ndhm/fhir/r4/StructureDefinition/Binary"] },
      contentType: "application/pdf",
      data: attachmentBase64 || "JVBERi0xLjQKJ...", // Placeholder base64
    };

    /* Add resources in example's order */
    bundle.entry.push({ fullUrl: `urn:uuid:${compId}`, resource: compositionResource });
    bundle.entry.push({ fullUrl: `urn:uuid:${patientId}`, resource: patientResource });
    bundle.entry.push({ fullUrl: `urn:uuid:${practitionerId}`, resource: practitionerResource });
    medicationResources.forEach((mr) => bundle.entry.push({ fullUrl: `urn:uuid:${mr.id}`, resource: mr }));
    bundle.entry.push({ fullUrl: `urn:uuid:${conditionId}`, resource: conditionResource });
    bundle.entry.push({ fullUrl: `urn:uuid:${binaryId}`, resource: binaryResource });

    setGenerated(bundle);
    return bundle;
  };

  return (
    <div className="container">
      <h1>FHIR Bundle Generator</h1>
      <button className="btn btn-primary" onClick={buildBundle}>Generate Bundle</button>
      {generated && (
        <pre style={{ marginTop: "20px" }}>{pretty(generated)}</pre>
      )}
    </div>
  );
}
