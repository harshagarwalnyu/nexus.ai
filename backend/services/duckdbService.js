import { Database } from "duckdb-async";
import path from "path";

const DB_PATH = path.join(process.cwd(), "nexus-local.duckdb");
let db = null;

async function getDB() {
    if (!db) {
        db = await Database.create(DB_PATH);
        await seedIfEmpty();
    }
    return db;
}

async function seedIfEmpty() {
    const tables = await db.all("SELECT table_name FROM information_schema.tables WHERE table_schema = 'main'");
    const tableNames = tables.map(t => t.table_name);

    if (!tableNames.includes("accounts")) {
        await db.run(`
            CREATE TABLE accounts (
                account_id VARCHAR PRIMARY KEY,
                account_name VARCHAR NOT NULL,
                industry VARCHAR,
                annual_contract_value DOUBLE,
                contract_renewal_date DATE,
                assigned_rep VARCHAR,
                region VARCHAR,
                days_since_last_contact INTEGER,
                health_archetype VARCHAR,
                account_tier VARCHAR,
                hq_lat DOUBLE,
                hq_lng DOUBLE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
        `);

        await db.run(`
            INSERT INTO accounts VALUES
            ('ACC-0001', 'Acme Corp', 'Technology', 5000000, '2026-06-15', 'Jane Smith', 'US-West', 3, 'expanding', 'T1', 37.7749, -122.4194, CURRENT_TIMESTAMP),
            ('ACC-0002', 'GlobalTech Inc', 'Financial Services', 2500000, '2026-09-01', 'John Doe', 'US-East', 15, 'at_risk', 'T2', 40.7128, -74.0060, CURRENT_TIMESTAMP),
            ('ACC-0003', 'MedHealth Solutions', 'Healthcare', 1200000, '2026-03-30', 'Sarah Lee', 'EU-West', 45, 'dormant', 'T2', 51.5074, -0.1278, CURRENT_TIMESTAMP),
            ('ACC-0004', 'EnergyFirst', 'Energy', 800000, '2026-12-01', 'Mike Chen', 'US-Central', 7, 'healthy', 'T3', 29.7604, -95.3698, CURRENT_TIMESTAMP),
            ('ACC-0005', 'RetailMax', 'Retail', 3500000, '2026-07-15', 'Amy Park', 'APAC', 2, 'expanding', 'T1', 35.6762, 139.6503, CURRENT_TIMESTAMP)
        `);
    }

    if (!tableNames.includes("support_tickets")) {
        await db.run(`
            CREATE TABLE support_tickets (
                ticket_id VARCHAR PRIMARY KEY,
                account_id VARCHAR,
                subject VARCHAR,
                priority VARCHAR,
                severity VARCHAR,
                status VARCHAR,
                category VARCHAR,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                resolved_at TIMESTAMP,
                resolution_hours DOUBLE
            )
        `);

        await db.run(`
            INSERT INTO support_tickets VALUES
            ('TK-001', 'ACC-0001', 'API latency spike', 'P1', 'High', 'open', 'Performance', CURRENT_TIMESTAMP, NULL, NULL),
            ('TK-002', 'ACC-0002', 'SSO login failures', 'P2', 'Medium', 'resolved', 'Authentication', CURRENT_TIMESTAMP - INTERVAL 5 DAY, CURRENT_TIMESTAMP - INTERVAL 4 DAY, 24.0),
            ('TK-003', 'ACC-0003', 'Feature request: bulk export', 'P3', 'Low', 'open', 'Feature Request', CURRENT_TIMESTAMP - INTERVAL 30 DAY, NULL, NULL),
            ('TK-004', 'ACC-0001', 'Dashboard rendering issue', 'P2', 'Medium', 'resolved', 'UI/UX', CURRENT_TIMESTAMP - INTERVAL 10 DAY, CURRENT_TIMESTAMP - INTERVAL 8 DAY, 48.0)
        `);
    }

    if (!tableNames.includes("contacts")) {
        await db.run(`
            CREATE TABLE contacts (
                contact_id VARCHAR PRIMARY KEY,
                account_id VARCHAR,
                name VARCHAR,
                role VARCHAR,
                email VARCHAR,
                email_response_time_hrs DOUBLE,
                last_meeting_days_ago INTEGER,
                previous_account_id VARCHAR,
                linkedin_connections_to_reps INTEGER
            )
        `);

        await db.run(`
            INSERT INTO contacts VALUES
            ('C-001', 'ACC-0001', 'Alice Johnson', 'CEO', 'alice@acme.com', 2.5, 5, NULL, 12),
            ('C-002', 'ACC-0001', 'Bob Williams', 'CTO', 'bob@acme.com', 4.0, 10, NULL, 8),
            ('C-003', 'ACC-0002', 'Carol Davis', 'VP Engineering', 'carol@globaltech.com', 12.0, 30, 'ACC-0001', 3),
            ('C-004', 'ACC-0003', 'Dan Miller', 'CFO', 'dan@medhealth.com', 48.0, 60, NULL, 1)
        `);
    }

    if (!tableNames.includes("telemetry")) {
        await db.run(`
            CREATE TABLE telemetry (
                account_id VARCHAR,
                recorded_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                admin_logins INTEGER,
                feature_usage_depth DOUBLE,
                session_duration_avg_mins DOUBLE,
                api_calls INTEGER,
                active_users INTEGER
            )
        `);

        await db.run(`
            INSERT INTO telemetry VALUES
            ('ACC-0001', CURRENT_TIMESTAMP, 45, 0.85, 32.5, 12500, 180),
            ('ACC-0002', CURRENT_TIMESTAMP, 12, 0.35, 8.2, 2100, 25),
            ('ACC-0003', CURRENT_TIMESTAMP, 2, 0.10, 3.1, 150, 5),
            ('ACC-0004', CURRENT_TIMESTAMP, 28, 0.65, 22.0, 7800, 95),
            ('ACC-0005', CURRENT_TIMESTAMP, 55, 0.92, 45.0, 18000, 250)
        `);
    }

    if (!tableNames.includes("research_cache")) {
        await db.run(`
            CREATE TABLE research_cache (
                cache_id VARCHAR PRIMARY KEY,
                account_id VARCHAR,
                account_name VARCHAR,
                researched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                model_pipeline VARCHAR,
                synthesis TEXT,
                confidence DOUBLE,
                tasks_planned INTEGER,
                tasks_executed INTEGER
            )
        `);
    }

    console.log("[duckdb] Local database seeded with sample data");
}

export async function query(sql, params = []) {
    const conn = await getDB();

    let localSql = sql
        .replace(/nexus_catalog\.raw_data\./g, "")
        .replace(/finwise\.raw_data\./g, "")
        .replace(new RegExp(`${process.env.DATABRICKS_CATALOG || "nexus_catalog"}\\.${process.env.DATABRICKS_SCHEMA || "raw_data"}\\.`, "g"), "");

    const values = [];
    const namedParamRegex = /:(\w+)/g;
    let match;
    let i = 0;
    
    const processedSql = localSql.replace(namedParamRegex, (match, paramName) => {
        const param = params.find(p => p.name === paramName);
        if (param) {
            values.push(param.value);
            return "?";
        }
        return match;
    });

    try {
        const rows = await conn.all(processedSql, ...values);
        return rows;
    } catch (err) {
        console.error("[duckdb] Query error:", err.message, "\nSQL:", processedSql);
        throw err;
    }
}

export async function writeResearchCache(accountId, accountName, pipeline, result) {
    try {
        const cacheId = `cache-${accountId}-${Date.now()}`;
        await query(
            `INSERT INTO research_cache (cache_id, account_id, account_name, model_pipeline, synthesis, confidence, tasks_planned, tasks_executed)
             VALUES (:cacheId, :accountId, :accountName, :pipeline, :synthesis, :confidence, :planned, :executed)`,
            [
                { name: "cacheId", value: cacheId },
                { name: "accountId", value: accountId },
                { name: "accountName", value: accountName },
                { name: "pipeline", value: pipeline },
                { name: "synthesis", value: JSON.stringify(result.synthesis || result) },
                { name: "confidence", value: result.average_confidence || 0 },
                { name: "planned", value: result.tasks_planned || 0 },
                { name: "executed", value: result.tasks_executed || 0 }
            ]
        );
    } catch (err) {
        console.error("[duckdb] Cache write failed:", err.message);
    }
}

export async function getLatestResearch(accountId) {
    const rows = await query(
        `SELECT * FROM research_cache WHERE account_id = :accountId ORDER BY researched_at DESC LIMIT 1`,
        [{ name: "accountId", value: accountId }]
    );
    return rows[0] || null;
}

export async function getResearchHistory(accountId, limit = 5) {
    return query(
        `SELECT cache_id, account_id, account_name, researched_at, model_pipeline, confidence, tasks_planned, tasks_executed
         FROM research_cache WHERE account_id = :accountId ORDER BY researched_at DESC LIMIT :limit`,
        [
            { name: "accountId", value: accountId },
            { name: "limit", value: limit }
        ]
    );
}