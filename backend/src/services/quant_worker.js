import { FinancialEngine } from "./quant_engine.js";
import { tableToIPC } from "apache-arrow";

self.onmessage = (event) => {
    const { revenue, id } = event.data;
    try {
        const engine = new FinancialEngine(revenue);
        const arrowTable = engine.runSimulation();
        const ipcStream = tableToIPC(arrowTable, "stream");

        self.postMessage(
            { id, success: true, data: ipcStream.buffer },
            [ipcStream.buffer]
        );
    } catch (error) {
        self.postMessage({ id, success: false, error: error.message });
    }
};