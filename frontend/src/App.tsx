import { useState } from "react";
import { getJobStatus } from "./services/videoService";

function App() {
  const [progress, setProgress] = useState(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [file, setFile] = useState<File | null>(null);

  // -------------------------------
  // 📂 HANDLE FILE SELECT
  // -------------------------------
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  }

  // -------------------------------
  // 📤 UPLOAD FILE
  // -------------------------------
  async function uploadFile() {
    if (!file) return alert("Select a file first");

    const formData = new FormData();
    formData.append("file", file);

    await fetch("/api/evidence/upload", {
      method: "POST",
      body: formData,
    });

    alert("✅ Upload complete");
  }

  // -------------------------------
  // 🎥 PROCESS VIDEO
  // -------------------------------
  async function processVideo() {
    try {
      setIsProcessing(true);
      setProgress(0);

      const res = await fetch("/api/video/process/test-case", {
        method: "POST",
      });

      const data = await res.json();

      trackJob(data.jobId);
    } catch (err) {
      console.error("❌ Failed to start processing:", err);
      setIsProcessing(false);
    }
  }

  // -------------------------------
  // 📡 TRACK JOB
  // -------------------------------
  function trackJob(jobId: string) {
    const interval = setInterval(async () => {
      try {
        const data = await getJobStatus(jobId);

        setProgress(data.progress || 0);

        if (data.state === "completed") {
          clearInterval(interval);
          setProgress(100);
          setIsProcessing(false);
        }

        if (data.state === "failed") {
          clearInterval(interval);
          setIsProcessing(false);
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 1000);
  }

  return (
    <div style={{ padding: 40 }}>
      <h1>🔥 CourtAccess — Core System</h1>

      {/* ------------------------------- */}
      {/* 📂 FILE UPLOAD */}
      {/* ------------------------------- */}
      <div style={{ marginTop: 20 }}>
        <h3>Upload Evidence</h3>

        <input type="file" onChange={handleFileChange} />

        <button
          onClick={uploadFile}
          style={{
            marginLeft: 10,
            padding: "6px 12px",
          }}
        >
          Upload
        </button>
      </div>

      {/* ------------------------------- */}
      {/* 🎥 VIDEO PROCESSING */}
      {/* ------------------------------- */}
      <div style={{ marginTop: 30 }}>
        <h3>Video Processing</h3>

        <button
          onClick={processVideo}
          style={{
            padding: "10px 20px",
            background: "#2563eb",
            color: "white",
            borderRadius: "6px",
          }}
        >
          🎥 Process Video
        </button>
      </div>

      {/* ------------------------------- */}
      {/* 📊 PROGRESS BAR */}
      {/* ------------------------------- */}
      {isProcessing && (
        <div style={{ marginTop: 20 }}>
          <div>{progress}%</div>

          <div
            style={{
              width: "100%",
              height: 10,
              background: "#eee",
              borderRadius: 5,
            }}
          >
            <div
              style={{
                width: `${progress}%`,
                height: "100%",
                background: "#22c55e",
                borderRadius: 5,
                transition: "width 0.5s ease",
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
