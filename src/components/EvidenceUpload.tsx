import { useState, useEffect } from "react";

export default function EvidenceUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [caseId, setCaseId] = useState("");
  const [cases, setCases] = useState<any[]>([]);
  const [status, setStatus] = useState("Loading cases...");

  useEffect(() => {
    async function loadCases() {
      try {
        const res = await fetch("/api/cases");

        if (!res.ok) {
          throw new Error("Failed to fetch cases");
        }

        const data = await res.json();

        console.log("Cases:", data);

        // 🔥 SAFE HANDLING
        if (Array.isArray(data)) {
          setCases(data);
        } else {
          setCases([]);
        }

        setStatus("");
      } catch (err) {
        console.error(err);
        setStatus("⚠️ Failed to load cases");
      }
    }

    loadCases();
  }, []);

  const handleUpload = async () => {
    if (!file || !caseId) {
      setStatus("❌ Select file and case");
      return;
    }

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("caseId", caseId);

      setStatus("Uploading...");

      const res = await fetch("/api/evidence/upload", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Upload failed");
      }

      setStatus("✅ Uploaded successfully");
    } catch (err) {
      console.error(err);
      setStatus("❌ Upload failed");
    }
  };

  return (
    <div style={{ padding: 20, border: "1px solid #ccc" }}>
      <h2>Upload Evidence</h2>

      {/* CASE SELECT */}
      <select
        value={caseId}
        onChange={(e) => setCaseId(e.target.value)}
      >
        <option value="">Select Case</option>

        {cases.map((c: any) => (
          <option key={c.caseId} value={c.caseId}>
            {c.name || c.caseNumber || c.caseId}
          </option>
        ))}
      </select>

      <br /><br />

      {/* FILE INPUT */}
      <input
        type="file"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      <br /><br />

      {/* BUTTON */}
      <button onClick={handleUpload}>
        Upload
      </button>

      <p>{status}</p>
    </div>
  );
}
