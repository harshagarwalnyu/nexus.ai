import { tool } from "@langchain/core/tools";
import { z } from "zod";

export const EMAIL_TEMPLATES = {
  re_engagement: {
    label: "Re-engagement (Silent Account)",
    subject: (data) => `Checking in — ${data.account_name} × Nexus`,
    body: (data) => `Hi ${data.contact_name || "there"},\n\nI noticed it's been ${data.days_silent || "a while"} days since we last connected, and I wanted to check in on how things are going at ${data.account_name}.\n\n${data.open_tickets ? `I see you have ${data.open_tickets} open support ticket(s) — I want to make sure those are being addressed to your satisfaction.` : ""}\n\nYour current contract ($${Number(data.acv || 0).toLocaleString()} ACV) renews ${data.renewal_date ? `on ${data.renewal_date}` : "soon"}, and I'd love to schedule a 15-minute call to:\n- Review your team's usage and any gaps\n- Share some new features that might help\n- Discuss your renewal outlook\n\nWould any time this week work?\n\nBest,\n${data.rep_name || "Your Nexus Team"}`
  },
  qbr_invite: {
    label: "QBR / Business Review Invite",
    subject: (data) => `Q${data.quarter || "X"} Business Review — ${data.account_name}`,
    body: (data) => `Hi ${data.contact_name || "there"},\n\nI'd like to schedule our quarterly business review for ${data.account_name}. Here's what I'd like to cover:\n\n1. **Usage trends** — Your team's adoption over the past quarter\n2. **ROI recap** — Value delivered against your initial goals\n3. **Roadmap preview** — Upcoming features relevant to ${data.industry || "your industry"}\n4. **Open items** — ${data.open_tickets ? `${data.open_tickets} outstanding tickets` : "Any outstanding concerns"}\n\nCould you share 2-3 times that work for a 30-minute session? Happy to include anyone else from your team.\n\nBest,\n${data.rep_name || "Your Nexus Team"}`
  },
  expansion_pitch: {
    label: "Expansion / Upsell Opportunity",
    subject: (data) => `Unlocking more value for ${data.account_name}`,
    body: (data) => `Hi ${data.contact_name || "there"},\n\nBased on ${data.account_name}'s usage patterns, I think there's an opportunity to get even more value from Nexus.\n\n${data.usage_insight || "Your team's engagement has been strong, and I see potential to expand into additional use cases."}\n\nI'd love to walk you through:\n- **Advanced analytics** that teams in ${data.industry || "your space"} are leveraging\n- **Custom integrations** that could streamline your workflows\n- **Volume pricing** options that could reduce your per-seat cost\n\nCurrently at $${Number(data.acv || 0).toLocaleString()} ACV — I think we can deliver significantly more ROI with a modest expansion. 15 minutes to discuss?\n\nBest,\n${data.rep_name || "Your Nexus Team"}`
  },
  churn_save: {
    label: "Churn Prevention / Save",
    subject: (data) => `${data.account_name} — Let's make this right`,
    body: (data) => `Hi ${data.contact_name || "there"},\n\nI want to be upfront — I've noticed some signals that things might not be going as smoothly as we'd like at ${data.account_name}, and I take that seriously.\n\n${data.issues || "I want to understand what's working and what isn't."}\n\nHere's what I'd like to propose:\n- **Immediate escalation** of any open issues to our senior engineering team\n- **Dedicated onboarding session** for any team members who might benefit\n- **Flexible terms discussion** for your upcoming renewal\n\nYour partnership matters to us. Can we get 20 minutes on the calendar this week?\n\nBest,\n${data.rep_name || "Your Nexus Team"}`
  },
  ticket_followup: {
    label: "Support Ticket Follow-up",
    subject: (data) => `Following up on your recent support experience — ${data.account_name}`,
    body: (data) => `Hi ${data.contact_name || "there"},\n\nI wanted to personally follow up on ${data.ticket_count || "your recent"} support ticket(s)${data.ticket_subject ? ` regarding "${data.ticket_subject}"` : ""}.\n\n${data.resolved ? "I see this has been resolved — I want to make sure you're fully satisfied with the outcome." : "I understand this is still in progress, and I've escalated it internally to ensure a swift resolution."}\n\nA few things I want to confirm:\n- Was the resolution (or progress so far) satisfactory?\n- Are there any related issues we should proactively address?\n- Is there anything else your team needs right now?\n\nYour feedback directly shapes our product priorities.\n\nBest,\n${data.rep_name || "Your Nexus Team"}`
  },
  intro_new_contact: {
    label: "Introduction to New Stakeholder",
    subject: (data) => `Introduction — Your Nexus partnership at ${data.account_name}`,
    body: (data) => `Hi ${data.contact_name || "there"},\n\nI'm ${data.rep_name || "your account manager"} at Nexus, and I manage the relationship with ${data.account_name}. I understand you've recently joined as ${data.contact_role || "a key stakeholder"}, and I wanted to introduce myself.\n\nQuick snapshot of your Nexus partnership:\n- **Contract**: $${Number(data.acv || 0).toLocaleString()} ACV, ${data.account_tier || ""} tier\n- **Health**: ${data.health_archetype || "Active"} account\n- **Key use cases**: ${data.industry || "Enterprise"} analytics and intelligence\n\nI'd love to schedule a 15-minute intro call to:\n- Understand your priorities and how Nexus fits in\n- Share a quick overview of what your team is using today\n- Connect you with the right resources\n\nWhat does your calendar look like this week?\n\nBest,\n${data.rep_name || "Your Nexus Team"}`
  }
};

export const draftEmailTool = tool(
  async (input) => {
    const { template_type, account_name, contact_name, acv, days_silent, open_tickets, industry, rep_name, renewal_date, additional_context } = input;
    const template = EMAIL_TEMPLATES[template_type];
    if (!template) return "Err";
    const data = { account_name: account_name || "the account", contact_name: contact_name || "", acv: acv || 0, days_silent: days_silent || "", open_tickets: open_tickets || 0, industry: industry || "", rep_name: rep_name || "", renewal_date: renewal_date || "", usage_insight: additional_context || "", issues: additional_context || "", ticket_count: open_tickets || "", resolved: false, quarter: Math.ceil((new Date().getMonth() + 1) / 3) };
    return JSON.stringify({ template: template.label, subject: template.subject(data), body: template.body(data), to: contact_name ? `${contact_name} (${account_name})` : account_name });
  },
  {
    name: "draft_email",
    description: "Drafts outreach email",
    schema: z.object({ template_type: z.string(), account_name: z.string(), contact_name: z.string().optional(), acv: z.number().optional(), days_silent: z.number().optional(), open_tickets: z.number().optional(), industry: z.string().optional(), rep_name: z.string().optional(), renewal_date: z.string().optional(), additional_context: z.string().optional() })
  }
);
