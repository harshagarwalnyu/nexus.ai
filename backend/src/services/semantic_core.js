import * as lancedb from "@lancedb/lancedb";
import path from "path";
import { HfInference } from "@huggingface/inference";

const DB_PATH = path.join(process.cwd(), ".lancedb");
const TABLE_NAME = "nexus_embeddings";
const hf = new HfInference(process.env.HF_TOKEN);

export class SemanticMemory {
    constructor() {
        this.db = null;
        this.table = null;
    }

    async init() {
        this.db = await lancedb.connect(DB_PATH);
        const tableNames = await this.db.tableNames();
        if (tableNames.includes(TABLE_NAME)) {
            this.table = await this.db.openTable(TABLE_NAME);
        }
    }

    async embed(text) {
        const result = await hf.featureExtraction({
            model: "BAAI/bge-m3",
            inputs: text,
        });
        return Array.from(result);
    }

    async ingest(docId, chunks) {
        const records = [];
        for (const chunk of chunks) {
            const vector = await this.embed(chunk.text || chunk);
            records.push({
                vector,
                text: chunk.text || chunk,
                docId,
                timestamp: new Date().toISOString(),
            });
        }

        if (!this.table) {
            this.table = await this.db.createTable(TABLE_NAME, records);
        } else {
            await this.table.add(records);
        }

        return { docId, chunks_ingested: records.length };
    }

    async query(queryText, topK = 5) {
        if (!this.table) return [];

        const queryVector = await this.embed(queryText);
        const results = await this.table
            .vectorSearch((queryVector))
            .limit(topK)
            .toArray();

        return results.map((r) => ({
            score: r._distance != null ? 1 - r._distance : 0,
            text: r.text,
            metadata: { docId: r.docId, timestamp: r.timestamp },
        }));
    }
}