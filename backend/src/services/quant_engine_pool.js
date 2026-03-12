import { v4 as uuidv4 } from "uuid";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const workerPath = path.resolve(__dirname, "quant_worker.js");

const POOL_SIZE = Math.max(2, (navigator.hardwareConcurrency || 4) - 1);
const pool = [];
const pendingRequests = new Map();

function initPool() {
    for (let i = 0; i < POOL_SIZE; i++) {
        const worker = new Worker(workerPath);
        const workerInfo = { worker, active: false };
        
        worker.onmessage = (event) => {
            const { id, success, data, error } = event.data;
            workerInfo.active = false;
            
            const resolveReject = pendingRequests.get(id);
            if (resolveReject) {
                pendingRequests.delete(id);
                if (success) {
                    resolveReject.resolve(data);
                } else {
                    resolveReject.reject(new Error(error));
                }
            }
            
            processQueue();
        };

        worker.onerror = (err) => {
            console.error(`Quant Worker ${i} Error:`, err);
            workerInfo.active = false;
            processQueue();
        };

        pool.push(workerInfo);
    }
}

const queue = [];

function processQueue() {
    const idleWorkerInfo = pool.find(w => !w.active);
    if (idleWorkerInfo && queue.length > 0) {
        const { id, revenue, resolve, reject } = queue.shift();
        idleWorkerInfo.active = true;
        pendingRequests.set(id, { resolve, reject });
        idleWorkerInfo.worker.postMessage({ id, revenue });
    }
}

initPool();

export function runSimulationAsync(revenue) {
    return new Promise((resolve, reject) => {
        const id = uuidv4();
        queue.push({ id, revenue, resolve, reject });
        processQueue();
    });
}