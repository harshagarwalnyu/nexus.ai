import express from "express";
import { draftSECForm } from "../services/complianceService.js";
import { generateReportHash } from "../services/provenanceService.js";

const router = express.Router();

router.post("/draft", async (req, res) => {
  try {
    const { formType, rawData } = req.body;
    if (!formType || !rawData) {
      return res.status(400).json({ error: "Missing formType or rawData" });
    }

    const draftedForm = await draftSECForm(formType, rawData);
    res.json({ success: true, draftedForm });
  } catch (error) {
    res.status(500).json({ error: error.message || "Failed to draft form" });
  }
});

router.post("/hash", (req, res) => {
  try {
    const { reportContent } = req.body;
    if (!reportContent) {
      return res.status(400).json({ error: "Missing reportContent" });
    }

    const hash = generateReportHash(reportContent);
    res.json({ success: true, hash });
  } catch (error) {
    res.status(500).json({ error: "Failed to generate hash" });
  }
});

export function registerComplianceRoutes(app) {
  app.use("/api/v1/compliance", router);
}