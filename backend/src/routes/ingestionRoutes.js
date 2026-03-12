import express from "express";
import multer from "multer";
import { processDataRoomZip } from "../services/ingestionService.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/upload", upload.single("file"), async (req, res) => {
    try {
        const file =  (req).file;

        if (!file) {
            return res.status(400).json({ success: false, error: "No zip file provided" });
        }

        const result = await processDataRoomZip(file.buffer);

        return res.json({
            success: true,
            ...result
        });
    } catch (err) {
        console.error("[express:ingestion] Upload error:", err);
        return res.status(500).json({ success: false, error: err.message });
    }
});

export default router;