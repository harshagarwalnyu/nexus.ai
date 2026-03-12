import { triggerResearch } from "./researchService.js";

const jobs = new Map();

function makeId() {
  return `job-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createJob(accountIds, depth = "standard", options = {}) {
  const jobId = makeId();

  const job = {
    job_id: jobId,
    account_ids: accountIds,
    depth,
    options,
    status: "pending",
    created_at: new Date().toISOString(),
    started_at: null,
    completed_at: null,
    results: {},
    errors: {},
    progress: { done: 0, total: accountIds.length },
  };

  jobs.set(jobId, job);
  console.log(`[jobs] Created job ${jobId} for ${accountIds.length} account(s), depth=${depth}`);
  return { job_id: jobId, status: job.status };
}

export function getJob(jobId) {
  return jobs.get(jobId) ?? null;
}

export function listJobs() {
  return [...jobs.values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
}

export async function startJob(jobId, getAccountFn) {
  const job = jobs.get(jobId);
  if (!job) throw new Error(`Job ${jobId} not found`);
  if (job.status !== "pending") {
    throw new Error(`Job ${jobId} is already ${job.status}`);
  }

  job.status = "running";
  job.started_at = new Date().toISOString();

  (async () => {
    console.log(`[jobs] Starting job ${jobId} (${job.account_ids.length} accounts)`);

    for (const accountId of job.account_ids) {
      let account;
      try {
        account = await getAccountFn(accountId);
        if (!account) {
          job.errors[accountId] = "Account not found";
          job.progress.done++;
          continue;
        }
      } catch (err) {
        job.errors[accountId] = `Fetch failed: ${err.message}`;
        job.progress.done++;
        continue;
      }

      const result = await triggerResearch(account, {
        depth: job.depth,
        userInstruction: job.options.userInstruction ?? "",
        jobId,
      });

      if (result.success) {
        job.results[accountId] = result.result;
      } else {
        job.errors[accountId] = result.error;
      }

      job.progress.done++;
      console.log(`[jobs] ${jobId}: ${job.progress.done}/${job.progress.total} accounts done`);
    }

    const hasErrors = Object.keys(job.errors).length > 0;
    const hasResults = Object.keys(job.results).length > 0;

    job.status = hasResults ? "done" : "failed";
    job.completed_at = new Date().toISOString();

    console.log(
      `[jobs] Job ${jobId} finished — status: ${job.status}, ` +
      `results: ${Object.keys(job.results).length}, errors: ${Object.keys(job.errors).length}`
    );

    if (job.options.callbackUrl) {
      try {
        await fetch(job.options.callbackUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ job_id: jobId, status: job.status }),
        });
        console.log(`[jobs] Callback sent to ${job.options.callbackUrl}`);
      } catch (err) {
        console.warn(`[jobs] Callback failed: ${err.message}`);
      }
    }
  })();

  return job;
}