export async function getJobStatus(jobId: string) {
  const res = await fetch(`/api/jobs/${jobId}`);
  return res.json();
}
