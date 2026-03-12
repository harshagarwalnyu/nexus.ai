import { google }   from "googleapis";
import { query }    from "../services/dataService.js";
import { redactPII } from "../services/governanceService.js";

const CATALOG       = process.env.DATABRICKS_CATALOG || "nexus_catalog";
const SCHEMA        = process.env.DATABRICKS_SCHEMA  || "raw_data";
const DRAFTS_TABLE  = `${CATALOG}.${SCHEMA}.email_drafts`;
const SENT_TABLE    = `${CATALOG}.${SCHEMA}.sent_emails`;

let draftsTableReady = false;
let sentTableReady   = false;

async function ensureDraftsTable() {
  if (draftsTableReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS ${DRAFTS_TABLE} (
      draft_id                STRING,
      account_id              STRING,
      template_type           STRING,
      subject                 STRING,
      body                    STRING,
      generated_at            TIMESTAMP,
      generated_by_slack_user STRING,
      status                  STRING
    )
    USING DELTA
  `);
  draftsTableReady = true;
}

async function ensureSentTable() {
  if (sentTableReady) return;
  await query(`
    CREATE TABLE IF NOT EXISTS ${SENT_TABLE} (
      email_id                STRING,
      account_id              STRING,
      to_address              STRING,
      subject                 STRING,
      body                    STRING,
      template_type           STRING,
      approved_by_slack_user  STRING,
      sent_at                 TIMESTAMP,
      gmail_message_id        STRING,
      status                  STRING
    )
    USING DELTA
  `);
  sentTableReady = true;
}

function escSql(val) {
  if (val === null || val === undefined) return "NULL";
  return `'${String(val).replace(/'/g, "''")}'`;
}

function createGmailClient() {
  const { GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN } = process.env;
  if (!GMAIL_CLIENT_ID || !GMAIL_CLIENT_SECRET || !GMAIL_REFRESH_TOKEN) {
    return null;
  }
  const auth = new google.auth.OAuth2(GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET);
  auth.setCredentials({ refresh_token: GMAIL_REFRESH_TOKEN });
  return google.gmail({ version: "v1", auth });
}

function buildRawEmail({ from, to, subject, body }) {
  const message = [
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${subject}`,
    `MIME-Version: 1.0`,
    `Content-Type: text/plain; charset=UTF-8`,
    ``,
    body,
  ].join("\r\n");

  return Buffer.from(message)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\
    .replace(/=+$/, "");
}

export async function sendEmail({ to, subject, body, accountId, approvedBy }) {
  const gmail = createGmailClient();
  if (!gmail) {
    const error = "Gmail not configured — set GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET, GMAIL_REFRESH_TOKEN";
    console.error(`[gmail] sendEmail skipped: ${error}`);
    return { ok: false, error };
  }

  const from = process.env.GMAIL_FROM_ADDRESS || "nexus-bot@example.com";
  try {
    const raw = buildRawEmail({ from, to, subject, body });
    const res = await gmail.users.messages.send({
      userId: "me",
      requestBody: { raw },
    });
    const messageId = res.data.id;
    console.log(`[gmail] Sent → ${to} (msgId: ${messageId}, acct: ${accountId}, by: ${approvedBy})`);
    return { ok: true, messageId };
  } catch (err) {
    console.error(`[gmail] sendEmail error (account: ${accountId}):`, err.message);
    return { ok: false, error: err.message };
  }
}

export function writeSentEmail({
  emailId,
  accountId,
  toAddress,
  subject,
  body,
  templateType,
  approvedBySlackUser,
  gmailMessageId,
  status,
}) {
  (async () => {
    try {
      await ensureSentTable();
      const id       = emailId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const safeBody = redactPII(body || "").redacted;

      await query(`
        INSERT INTO ${SENT_TABLE}
          (email_id, account_id, to_address, subject, body, template_type,
           approved_by_slack_user, sent_at, gmail_message_id, status)
        VALUES (
          ${escSql(id)},
          ${escSql(accountId)},
          ${escSql(toAddress)},
          ${escSql(subject)},
          ${escSql(safeBody)},
          ${escSql(templateType)},
          ${escSql(approvedBySlackUser)},
          CURRENT_TIMESTAMP(),
          ${escSql(gmailMessageId)},
          ${escSql(status || "sent")}
        )
      `);
    } catch (err) {
      console.error(`[gmail] writeSentEmail failed for account ${accountId}:`, err.message);
    }
  })();
}

export function writeDraft({
  draftId,
  accountId,
  templateType,
  subject,
  body,
  generatedBySlackUser,
  status = "pending",
}) {
  (async () => {
    try {
      await ensureDraftsTable();
      const id       = draftId || `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const safeBody = redactPII(body || "").redacted;

      await query(`
        INSERT INTO ${DRAFTS_TABLE}
          (draft_id, account_id, template_type, subject, body,
           generated_at, generated_by_slack_user, status)
        VALUES (
          ${escSql(id)},
          ${escSql(accountId)},
          ${escSql(templateType)},
          ${escSql(subject)},
          ${escSql(safeBody)},
          CURRENT_TIMESTAMP(),
          ${escSql(generatedBySlackUser)},
          ${escSql(status)}
        )
      `);
    } catch (err) {
      console.error(`[gmail] writeDraft failed for account ${accountId}:`, err.message);
    }
  })();
}

export function updateDraftStatus(draftId, status) {
  (async () => {
    try {
      await ensureDraftsTable();
      await query(`
        UPDATE ${DRAFTS_TABLE}
        SET status = ${escSql(status)}
        WHERE draft_id = ${escSql(draftId)}
      `);
    } catch (err) {
      console.error(`[gmail] updateDraftStatus failed for draft ${draftId}:`, err.message);
    }
  })();
}

export async function getEmailDrafts(accountId) {
  const [draftsResult, sentResult] = await Promise.allSettled([
    (async () => {
      await ensureDraftsTable();
      return query(
        `SELECT draft_id, account_id, template_type, subject,
                generated_at, generated_by_slack_user, status
         FROM ${DRAFTS_TABLE}
         WHERE account_id = ${escSql(accountId)}
         ORDER BY generated_at DESC
         LIMIT 20`
      );
    })(),
    (async () => {
      await ensureSentTable();
      return query(
        `SELECT email_id, account_id, to_address, subject, template_type,
                approved_by_slack_user, sent_at, gmail_message_id, status
         FROM ${SENT_TABLE}
         WHERE account_id = ${escSql(accountId)}
         ORDER BY sent_at DESC
         LIMIT 20`
      );
    })(),
  ]);

  return {
    drafts: draftsResult.status === "fulfilled" ? draftsResult.value : [],
    sent:   sentResult.status   === "fulfilled" ? sentResult.value   : [],
  };
}