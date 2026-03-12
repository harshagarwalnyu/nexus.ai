import { App } from "@slack/bolt";

import { HumanMessage } from "@langchain/core/messages";
import { EMAIL_TEMPLATES } from "../tools/email.js";
import { PRIORITY, classifyPriority } from "../services/signalService.js";
import { query } from "../services/dataService.js";
import { orchestratedResearch } from "../services/researchService.js";
import { auditLog } from "../services/auditService.js";
import { sendEmail, writeSentEmail, writeDraft, updateDraftStatus } from "./gmail.js";

const CATALOG = process.env.DATABRICKS_CATALOG || "nexus_catalog";
const SCHEMA = process.env.DATABRICKS_SCHEMA || "raw_data";

let slackApp = null;

export function initSlackBot() {
  const token = process.env.SLACK_BOT_TOKEN;
  const signingSecret = process.env.SLACK_SIGNING_SECRET;
  const appToken = process.env.SLACK_APP_TOKEN;

  const isPlaceholder = (v) => !v || v.startsWith("xoxb-...") || v.startsWith("xapp-...") || v === "...";
  if (isPlaceholder(token) || isPlaceholder(signingSecret)) {
    console.log("   Slack    : ⚠️  not configured (set SLACK_BOT_TOKEN + SLACK_SIGNING_SECRET)");
    return null;
  }

  const opts = { token, signingSecret };
  if (appToken) {
    opts.socketMode = true;
    opts.appToken = appToken;
  }

  slackApp = new App(opts);

  registerMentionHandler();
  registerDMHandler();
  registerSlashCommands();
  registerActionHandlers();
  registerModalHandler();

  return slackApp;
}

export async function startSlackBot() {
  if (!slackApp) return;
  if (process.env.SLACK_APP_TOKEN) {
    await slackApp.start();
    console.log("   Slack    : ✅ connected (Socket Mode)");
  } else {
    console.log("   Slack    : ✅ configured (HTTP receiver — verify request URL in Slack app settings)");
  }
  const gmailReady = !!(process.env.GMAIL_CLIENT_ID && process.env.GMAIL_CLIENT_SECRET && process.env.GMAIL_REFRESH_TOKEN);
  console.log(`   Gmail    : ${gmailReady ? "✅ configured" : "⚠️  not configured — email send will fail (set GMAIL_CLIENT_ID + GMAIL_CLIENT_SECRET + GMAIL_REFRESH_TOKEN)"}`);
}

export function getSlackReceiver() {
  return slackApp?.receiver;
}

export async function postAlert(signal, priority) {
  if (!slackApp) {
    console.warn("[slack] postAlert called but Slack bot is not initialised.");
    return { ok: false, error: "Slack bot not initialised" };
  }

  const p = PRIORITY[priority];
  try {
    await slackApp.client.chat.postMessage({
      channel: p.channel,
      text: `${p.emoji} ${p.label} — ${signal.company || signal.account_name}`,
      blocks: buildAlertBlocks(signal, priority),
    });
    console.log(`[slack] Alert posted → ${p.channel} (${priority}: ${signal.company})`);
    return { ok: true };
  } catch (err) {
    console.error(`[slack] postAlert failed (${priority}):`, err.message);
    return { ok: false, error: err.message };
  }
}

export { classifyPriority };

function buildAlertBlocks(signal, priority) {
  const p = PRIORITY[priority];
  const acvDisplay = signal.acv ? `$${Number(signal.acv).toLocaleString()}` : "N/A";
  const btnValue = JSON.stringify({
    account_id: signal.account_id,
    company: signal.company || signal.account_name,
  });

  return [
    {
      type: "header",
      text: { type: "plain_text", text: `${p.emoji} ${p.label} — ${signal.company || signal.account_name}` },
    },
    {
      type: "section",
      fields: [
        { type: "mrkdwn", text: `*Severity:* ${signal.severity || "Unknown"}` },
        { type: "mrkdwn", text: `*ACV:* ${acvDisplay}` },
        { type: "mrkdwn", text: `*SLA:* ${p.sla}` },
        { type: "mrkdwn", text: `*Source:* ${signal.source || "CRM / Signals"}` },
      ],
    },
    {
      type: "section",
      text: { type: "mrkdwn", text: signal.description || "_No description provided._" },
    },
    {
      type: "actions",
      elements: [
        {
          type: "button",
          text: { type: "plain_text", text: "Run Research" },
          style: "primary",
          action_id: "run_research",
          value: btnValue,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Draft Email" },
          action_id: "draft_email",
          value: btnValue,
        },
        {
          type: "button",
          text: { type: "plain_text", text: "Dismiss" },
          style: "danger",
          action_id: "dismiss_alert",
          value: btnValue,
          confirm: {
            title: { type: "plain_text", text: "Dismiss this alert?" },
            text: { type: "mrkdwn", text: "This will mark the alert as dismissed. You can re-run signals anytime." },
            confirm: { type: "plain_text", text: "Dismiss" },
            deny: { type: "plain_text", text: "Cancel" },
          },
        },
      ],
    },
    {
      type: "context",
      elements: [
        { type: "mrkdwn", text: `Account: \`${signal.account_id || "N/A"}\` · ${new Date().toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}` },
      ],
    },
  ];
}

function buildStatusBlocks(health) {
  const rows = Object.entries(health).map(([svc, info]) => {
    const icon = info.ok ? "✅" : "❌";
    const err = info.error ? ` — \`${info.error}\`` : "";
    return `${icon} *${svc}*${err}`;
  });
  return [
    { type: "header", text: { type: "plain_text", text: "🔧 Nexus Service Health" } },
    { type: "section", text: { type: "mrkdwn", text: rows.join("\n") } },
    { type: "context", elements: [{ type: "mrkdwn", text: `Checked at ${new Date().toLocaleTimeString()}` }] },
  ];
}

function registerMentionHandler() {
  slackApp.event("app_mention", async ({ event, say }) => {
    const userQuery = event.text.replace(/<@[A-Z0-9]+>/g, "").trim();
    if (!userQuery) {
      await say({ text: "Hey! Ask me anything about your portfolio, accounts, or market data.", thread_ts: event.ts });
      return;
    }
    await say({ text: "🔍 Analyzing...", thread_ts: event.ts });
    try {
      const result = await runAgentBrief(userQuery);
      await say({ text: result, thread_ts: event.ts });
    } catch (err) {
      console.error("[slack] mention agent error:", err.message);
      await say({ text: `⚠️ Agent error: ${err.message}`, thread_ts: event.ts });
    }
  });
}

function registerDMHandler() {
  slackApp.event("message", async ({ event, say }) => {
    if (event.channel_type !== "im" || event.bot_id) return;
    const userQuery = event.text?.trim();
    if (!userQuery) return;

    await say({ text: "🔍 Analyzing..." });
    try {
      const result = await runAgentBrief(userQuery);
      await say({ text: result });
    } catch (err) {
      console.error("[slack] DM agent error:", err.message);
      await say({ text: `⚠️ Agent error: ${err.message}` });
    }
  });
}

function registerSlashCommands() {
  slackApp.command("/nexus", async ({ command, ack, respond, client }) => {
    await ack();

    const [subcommand, ...argParts] = command.text.trim().split(/\s+/);
    const arg = argParts.join(" ").trim();

    switch ((subcommand || "").toLowerCase()) {
      case "research":
        await handleResearchCommand(arg, respond);
        break;

      case "draft":
        await handleDraftCommand(arg, respond, command.trigger_id, client, command.user_id);
        break;

      case "status":
        await handleStatusCommand(respond);
        break;

      default:
        await respond({
          response_type: "ephemeral",
          text: [
            "Available commands:",
            "• `/nexus research <account name>` — run orchestrated AI research",
            "• `/nexus draft <account name>` — generate a draft outreach email",
            "• `/nexus status` — check service health",
          ].join("\n"),
        });
    }
  });
}

async function handleResearchCommand(accountQuery, respond) {
  if (!accountQuery) {
    await respond({ response_type: "ephemeral", text: "Usage: `/nexus research <account name>`" });
    return;
  }

  await respond({ response_type: "in_channel", text: `🔍 Starting orchestrated research for *${accountQuery}*…` });

  try {
    const { account, tickets, contacts } = await fetchAccountContext(accountQuery);
    if (!account) {
      await respond({ response_type: "ephemeral", text: `❌ No account found matching "*${accountQuery}*". Check the name and try again.` });
      return;
    }

    const result = await orchestratedResearch(account, tickets, contacts, {
      onProgress: () => { },
    });

    if (!result.success) {
      await respond({ response_type: "ephemeral", text: `⚠️ Research completed with errors for ${account.account_name}.` });
      return;
    }

    const s = result.synthesis;
    const confPct = s.confidence_score ? `${Math.round(s.confidence_score * 100)}%` : "N/A";
    const risks = (s.risks || []).slice(0, 3).map((r) => `• ${r}`).join("\n");
    const opps = (s.opportunities || []).slice(0, 3).map((o) => `• ${o}`).join("\n");

    const summary = [
      `*${account.account_name}* — Research Summary (confidence: ${confPct})`,
      "",
      `*Executive Summary*\n${s.executive_summary || "_None_"}`,
      risks ? `\n*Top Risks*\n${risks}` : "",
      opps ? `\n*Opportunities*\n${opps}` : "",
      s.narrative ? `\n*Narrative*\n${s.narrative}` : "",
    ].filter(Boolean).join("\n");

    await respond({
      response_type: "in_channel",
      text: summary.length > 3900 ? summary.slice(0, 3900) + "\n\n_…truncated. Run a full report from the dashboard._" : summary,
    });

    auditLog("slack_research_command", { account_id: account.account_id, status: "success" });
  } catch (err) {
    console.error("[slack] /nexus research error:", err.message);
    await respond({ response_type: "ephemeral", text: `⚠️ Research failed: ${err.message}` });
  }
}

async function handleDraftCommand(accountQuery, respond, triggerId, client, userId = null) {
  if (!accountQuery) {
    await respond({ response_type: "ephemeral", text: "Usage: `/nexus draft <account name>`" });
    return;
  }

  let viewId = null;
  try {
    const opened = await client.views.open({
      trigger_id: triggerId,
      view: buildLoadingModalView(`Generating draft for *${accountQuery}*…`),
    });
    viewId = opened.view?.id;
  } catch (err) {
    console.error("[slack] /nexus draft: could not open loading modal:", err.message);
    await respond({ response_type: "ephemeral", text: `⚠️ Could not open modal: ${err.message}` });
    return;
  }

  try {
    const { account, matchedContact } = await fetchAccountContext(accountQuery);
    if (!account) {
      await client.views.update({
        view_id: viewId,
        view: buildErrorModalView(
          `No account found matching "*${accountQuery}*". Try the company name or a contact/rep name.`
        ),
      });
      return;
    }

    const draft = generateEmailDraft(account, matchedContact);
    const draftId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    await client.views.update({
      view_id: viewId,
      view: buildEmailModalView(draft, {
        accountId: account.account_id,
        to: draft.to || "",
        template: draft.template || "custom",
        draftId,
      }),
    });

    writeDraft({
      draftId,
      accountId: account.account_id || "",
      templateType: draft.template || "custom",
      subject: draft.subject || "",
      body: draft.body || "",
      generatedBySlackUser: userId || "",
      status: "pending",
    });

    auditLog("slack_draft_command", { account_id: account.account_id, status: "modal_opened" });
  } catch (err) {
    console.error("[slack] /nexus draft error:", err.message);
    if (viewId) {
      try {
        await client.views.update({
          view_id: viewId,
          view: buildErrorModalView(`Draft failed: ${err.message}`),
        });
      } catch (_) {  }
    }
  }
}

async function handleStatusCommand(respond) {
  try {
    const health = await fetchHealthStatus();
    await respond({
      response_type: "ephemeral",
      blocks: buildStatusBlocks(health),
      text: "Nexus service health",
    });
  } catch (err) {
    await respond({ response_type: "ephemeral", text: `⚠️ Could not fetch status: ${err.message}` });
  }
}

function registerActionHandlers() {

  slackApp.action("run_research", async ({ ack, action, body, client }) => {
    await ack();
    const { account_id, company } = safeParseJSON(action.value, {});
    const channelId = body.container?.channel_id || body.channel?.id;
    const messageTs = body.container?.message_ts || body.message?.ts;

    try {

      await client.chat.postMessage({
        channel: channelId,
        thread_ts: messageTs,
        text: `🔍 Running orchestrated research for *${company}*…`,
      });

      const { account, tickets, contacts } = await fetchAccountContext(company, account_id);
      if (!account) throw new Error(`Account not found: ${company}`);

      const result = await orchestratedResearch(account, tickets, contacts, { onProgress: () => { } });
      const s = result.synthesis || {};
      const confPct = s.confidence_score ? `${Math.round(s.confidence_score * 100)}%` : "N/A";

      const summary = [
        `*Research complete for ${account.account_name}* (confidence: ${confPct})`,
        s.executive_summary ? `\n${s.executive_summary}` : "",
        (s.risks || []).length ? `\n*Risks:* ${(s.risks || []).slice(0, 3).join(" · ")}` : "",
        (s.opportunities || []).length ? `\n*Opportunities:* ${(s.opportunities || []).slice(0, 3).join(" · ")}` : "",
      ].filter(Boolean).join("\n");

      await client.chat.postMessage({
        channel: channelId,
        thread_ts: messageTs,
        text: summary.length > 3900 ? summary.slice(0, 3900) + "\n_…truncated_" : summary,
      });

      auditLog("slack_action_run_research", { account_id, status: "success" });
    } catch (err) {
      console.error("[slack] run_research action error:", err.message);
      await client.chat.postMessage({
        channel: channelId,
        thread_ts: messageTs,
        text: `⚠️ Research failed: ${err.message}`,
      });
    }
  });

  slackApp.action("draft_email", async ({ ack, action, body, client }) => {
    await ack();
    const { account_id, company } = safeParseJSON(action.value, {});
    const triggerId = body.trigger_id;
    const userId = body.user?.id;

    let viewId = null;
    try {
      const opened = await client.views.open({
        trigger_id: triggerId,
        view: buildLoadingModalView(`Generating draft for *${company}*…`),
      });
      viewId = opened.view?.id;
    } catch (err) {
      console.error("[slack] draft_email: could not open loading modal:", err.message);
      return;
    }

    try {
      const { account, matchedContact } = await fetchAccountContext(company, account_id);
      if (!account) throw new Error(`Account not found: ${company}`);

      const draft = await generateEmailDraft(account, matchedContact);
      const draftId = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      await client.views.update({
        view_id: viewId,
        view: buildEmailModalView(draft, {
          accountId: account.account_id,
          to: draft.to || "",
          template: draft.template || "custom",
          draftId,
        }),
      });

      writeDraft({
        draftId,
        accountId: account.account_id || "",
        templateType: draft.template || "custom",
        subject: draft.subject || "",
        body: draft.body || "",
        generatedBySlackUser: userId || "",
        status: "pending",
      });

      auditLog("slack_action_draft_email", { account_id, status: "modal_opened" });
    } catch (err) {
      console.error("[slack] draft_email action error:", err.message);
      if (viewId) {
        try {
          await client.views.update({
            view_id: viewId,
            view: buildErrorModalView(`Draft failed: ${err.message}`),
          });
        } catch (_) {  }
      }
    }
  });

  slackApp.action("dismiss_alert", async ({ ack, action, body, client }) => {
    await ack();
    const { account_id, company } = safeParseJSON(action.value, {});
    const channelId = body.container?.channel_id || body.channel?.id;
    const messageTs = body.container?.message_ts || body.message?.ts;

    try {
      await client.chat.update({
        channel: channelId,
        ts: messageTs,
        text: `~${body.message?.text || "Alert"}~ — _Dismissed by <@${body.user?.id}>_`,
        blocks: [
          {
            type: "section",
            text: {
              type: "mrkdwn",
              text: `~*Alert for ${company}*~ — ✅ dismissed by <@${body.user?.id}> at ${new Date().toLocaleTimeString()}`,
            },
          },
        ],
      });
      auditLog("slack_action_dismiss_alert", { account_id, status: "dismissed", details: `dismissed by ${body.user?.id}` });
    } catch (err) {
      console.error("[slack] dismiss_alert action error:", err.message);
    }
  });
}

function registerModalHandler() {
  slackApp.view("submit_email_draft", async ({ ack, body, view }) => {
    await ack();

    const toAddress = view.state.values?.to_block?.to_input?.value || "";
    const subject = view.state.values?.subject_block?.subject_input?.value || "";
    const emailBody = view.state.values?.body_block?.body_input?.value || "";
    const approvedBy = body.user?.id || "";

    const meta = safeParseJSON(view.private_metadata, {});
    const accountId = meta.accountId || "";
    const template = meta.template || "custom";
    const draftId = meta.draftId || "";

    if (!toAddress?.trim()) {

      console.warn(`[slack] Email modal submitted with empty To address (account: ${accountId})`);
      auditLog("slack_email_send_failed", { account_id: accountId, status: "failed", details: "empty to address" });
      if (draftId) updateDraftStatus(draftId, "discarded");
      return;
    }

    const result = await sendEmail({
      to: toAddress,
      subject,
      body: emailBody,
      accountId,
      approvedBy,
    });

    if (result.ok) {
      auditLog("slack_email_sent", {
        account_id: accountId,
        status: "sent",
        details: result.messageId,
      });
      writeSentEmail({
        accountId,
        toAddress,
        subject,
        body: emailBody,
        templateType: template,
        approvedBySlackUser: approvedBy,
        gmailMessageId: result.messageId,
        status: "sent",
      });
      if (draftId) updateDraftStatus(draftId, "approved");
    } else {
      console.error(`[slack] Email send failed for account ${accountId}:`, result.error);
      auditLog("slack_email_send_failed", {
        account_id: accountId,
        status: "failed",
        details: result.error,
      });
      if (draftId) updateDraftStatus(draftId, "discarded");
    }
  });
}

async function runAgentBrief(query) {
  const graph = buildChatGraph("brief");
  const result = await graph.invoke({ messages: [new HumanMessage(query)] });

  const lastMsg = result.messages[result.messages.length - 1];
  let content = "";

  if (typeof lastMsg.content === "string") {
    content = lastMsg.content;
  } else if (Array.isArray(lastMsg.content)) {
    content = lastMsg.content.filter((b) => b.type === "text").map((b) => b.text).join("");
  }

  if (content.length > 3900) {
    content = content.slice(0, 3900) + "\n\n_…truncated. Ask for a detailed report._";
  }

  return content || "I wasn't able to generate a response. Try rephrasing your question.";
}

async function fetchAccountContext(nameOrQuery, accountId = null) {
  let accountRows;
  let matchedContact = null;

  if (accountId) {
    accountRows = await query(
      `SELECT account_id, account_name, industry, annual_contract_value, contract_renewal_date, assigned_rep, region, days_since_last_contact, health_archetype, account_tier, hq_lat, hq_lng, created_at FROM ${CATALOG}.${SCHEMA}.accounts WHERE account_id = '${accountId}' LIMIT 1`
    );
  } else {
    const safe = nameOrQuery.replace(/'/g, "''");

    // 1. Try account name first
    accountRows = await query(
      `SELECT account_id, account_name, industry, annual_contract_value, contract_renewal_date, assigned_rep, region, days_since_last_contact, health_archetype, account_tier, hq_lat, hq_lng, created_at FROM ${CATALOG}.${SCHEMA}.accounts
       WHERE LOWER(account_name) LIKE LOWER('%${safe}%')
       ORDER BY annual_contract_value DESC LIMIT 1`
    );

    // 2. Try contact name — resolve to their account and remember who was matched
    if (!accountRows?.length) {
      const contactRows = await query(
        `SELECT contact_id, account_id, name, role, email, email_response_time_hrs, last_meeting_days_ago, previous_account_id, linkedin_connections_to_reps FROM ${CATALOG}.${SCHEMA}.contacts
         WHERE LOWER(name) LIKE LOWER('%${safe}%')
         LIMIT 1`
      );
      if (contactRows?.length) {
        matchedContact = contactRows[0];
        accountRows = await query(
          `SELECT account_id, account_name, industry, annual_contract_value, contract_renewal_date, assigned_rep, region, days_since_last_contact, health_archetype, account_tier, hq_lat, hq_lng, created_at FROM ${CATALOG}.${SCHEMA}.accounts
           WHERE account_id = '${matchedContact.account_id}' LIMIT 1`
        );
      }
    }

    // 3. Try assigned_rep name — resolve to their highest-ACV account
    if (!accountRows?.length) {
      accountRows = await query(
        `SELECT account_id, account_name, industry, annual_contract_value, contract_renewal_date, assigned_rep, region, days_since_last_contact, health_archetype, account_tier, hq_lat, hq_lng, created_at FROM ${CATALOG}.${SCHEMA}.accounts
         WHERE LOWER(assigned_rep) LIKE LOWER('%${safe}%')
         ORDER BY annual_contract_value DESC LIMIT 1`
      );
    }
  }

  const account = accountRows?.[0] || null;
  if (!account) return { account: null, tickets: [], contacts: [], matchedContact: null };

  const [tickets, contacts] = await Promise.all([
    query(`SELECT ticket_id, account_id, subject, priority, severity, status, category, created_at, resolved_at, resolution_hours FROM ${CATALOG}.${SCHEMA}.support_tickets WHERE account_id = '${account.account_id}' ORDER BY created_at DESC LIMIT 10`),
    query(`SELECT contact_id, account_id, name, role, email, email_response_time_hrs, last_meeting_days_ago, previous_account_id, linkedin_connections_to_reps FROM ${CATALOG}.${SCHEMA}.contacts        WHERE account_id = '${account.account_id}' LIMIT 5`),
  ]);

  return { account, tickets: tickets || [], contacts: contacts || [], matchedContact };
}

/**
 * Generate an email draft directly from EMAIL_TEMPLATES — no agent involved.
 *
 * Using a ReAct loop here caused persistent sender/recipient confusion:
 * the agent would call queryCRMTool, re-interpret the schema, and swap who is
 * the rep (sender) vs the contact (recipient). We have all the data we need already,
 * so we render the template directly.
 *
 * @param {object} account        — account row from Databricks
 * @param {object|null} toContact — specific contact to address (recipient)
 * @returns {{ subject, body, template, to }}
 */
function generateEmailDraft(account, toContact = null) {
  const archetype = account.health_archetype || "healthy";
  const templateKey = {
    at_risk: "churn_save",
    dormant: "re_engagement",
    expanding: "expansion_pitch",
    healthy: "qbr_invite",
  }[archetype] || "re_engagement";

  const template = EMAIL_TEMPLATES[templateKey];

  const data = {
    account_name: account.account_name || "your account",
    contact_name: toContact?.name || "",
    contact_role: toContact?.role || "",
    acv: account.annual_contract_value || 0,
    days_silent: account.days_since_last_contact || "",
    open_tickets: 0,
    industry: account.industry || "",
    health_archetype: archetype,
    account_tier: account.account_tier || "",
    rep_name: account.assigned_rep || "Your Nexus Team",
    renewal_date: account.contract_renewal_date || "",
    quarter: Math.ceil((new Date().getMonth() + 1) / 3),
    usage_insight: "",
    issues: "",
    ticket_subject: "",
    ticket_count: "",
    resolved: false,
  };

  return {
    template: templateKey,
    subject: template.subject(data),
    body: template.body(data),
    to: toContact?.email || "",  // real email address, not a display string
  };
}

/** Placeholder modal shown immediately while async draft generation runs. */
function buildLoadingModalView(message) {
  return {
    type: "modal",
    callback_id: "submit_email_draft",
    private_metadata: JSON.stringify({ loading: true }),
    title: { type: "plain_text", text: "Email Draft" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `✍️ ${message}\n_This usually takes 5–15 seconds…_` },
      },
    ],
  };
}

/** Error state modal — replaces the loading modal on failure. */
function buildErrorModalView(message) {
  return {
    type: "modal",
    callback_id: "submit_email_draft",
    private_metadata: JSON.stringify({}),
    title: { type: "plain_text", text: "Email Draft" },
    close: { type: "plain_text", text: "Close" },
    blocks: [
      {
        type: "section",
        text: { type: "mrkdwn", text: `⚠️ ${message}` },
      },
    ],
  };
}

/**
 * Fully populated email draft modal view.
 * Used with both views.open (fast path) and views.update (async path).
 */
function buildEmailModalView(draft, meta) {
  return {
    type: "modal",
    callback_id: "submit_email_draft",
    private_metadata: JSON.stringify(meta),
    title: { type: "plain_text", text: "Email Draft" },
    submit: { type: "plain_text", text: "Approve & Send" },
    close: { type: "plain_text", text: "Cancel" },
    blocks: [
      {
        type: "input",
        block_id: "to_block",
        label: { type: "plain_text", text: "To (email address)" },
        element: {
          type: "plain_text_input",
          action_id: "to_input",
          placeholder: { type: "plain_text", text: "recipient@example.com" },
          initial_value: draft.to || "",
        },
      },
      {
        type: "input",
        block_id: "subject_block",
        label: { type: "plain_text", text: "Subject" },
        element: {
          type: "plain_text_input",
          action_id: "subject_input",
          initial_value: draft.subject || "",
        },
      },
      {
        type: "input",
        block_id: "body_block",
        label: { type: "plain_text", text: "Body" },
        element: {
          type: "plain_text_input",
          action_id: "body_input",
          multiline: true,
          initial_value: (draft.body || "").slice(0, 3000),
        },
      },
      {
        type: "context",
        elements: [
          { type: "mrkdwn", text: `Template: _${draft.template || "custom"}_ · Edit freely before approving.` },
        ],
      },
    ],
  };
}

/** Fetch health status by calling each service probe inline. */
async function fetchHealthStatus() {
  const port = process.env.PORT || 3001;
  try {
    const resp = await fetch(`http://localhost:${port}/health`);
    const data = await resp.json();
    return data.services || data;
  } catch (_) {
    return { backend: { ok: false, error: "Could not reach backend health endpoint" } };
  }
}

function safeParseJSON(str, fallback = {}) {
  try { return JSON.parse(str); } catch (_) { return fallback; }
}