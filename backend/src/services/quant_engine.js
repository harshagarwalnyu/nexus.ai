import { tableFromArrays, Table, Float32, Int32, Utf8, Builder, Float64, tableToIPC } from "apache-arrow";
import * as math from "mathjs";
import { v4 as uuidv4 } from "uuid";

const SIMULATION_YEARS = 5;
const DT = 1 / 252;
const PATHS = 1000;

export class FinancialEngine {
    constructor(initialRevenue, volatility = 0.25, drift = 0.08) {
        this.S0 = initialRevenue;
        this.sigma = volatility;
        this.mu = drift;
    }

    runSimulation() {
        console.time("Monte Carlo Simulation");
        const steps = SIMULATION_YEARS * 252;

        const timePoints = new Float32Array(steps);
        const meanPath = new Float64Array(steps);
        const upperCI = new Float64Array(steps);
        const lowerCI = new Float64Array(steps);

        const driftTerm = (this.mu - 0.5 * this.sigma ** 2) * DT;
        const volTerm = this.sigma * Math.sqrt(DT);

        let currentPrices = new Float64Array(PATHS).fill(this.S0);

        for (let t = 0; t < steps; t++) {
            timePoints[t] = t / 252;
            let sum = 0;
            let values = [];

            for (let p = 0; p < PATHS; p++) {
                const z = this.boxMullerRandom();
                const shock = Math.exp(driftTerm + volTerm * z);
                currentPrices[p] *= shock;
                sum += currentPrices[p];
                values.push(currentPrices[p]);
            }

            meanPath[t] = math.mean(values);
            const stdDev = math.std(values);
            lowerCI[t] = math.quantileSeq(values, 0.025);
            upperCI[t] = math.quantileSeq(values, 0.975);
        }

        console.timeEnd("Monte Carlo Simulation");

        const arrowTable = tableFromArrays({
            time: timePoints,
            mean_revenue: meanPath,
            upper_bound: upperCI,
            lower_bound: lowerCI,
            simulation_id: new Array(steps).fill(uuidv4()),
        });

        return arrowTable;
    }

    boxMullerRandom() {
        let u = 0, v = 0;
        while(u === 0) u = Math.random();
        while(v === 0) v = Math.random();
        return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    }
}

export function benchmarkArrow() {
    const engine = new FinancialEngine(100_000_000);
    const table = engine.runSimulation();

    console.time("Arrow Serialization");
    const ipcBuffer =  tableToIPC(table, "stream");
    console.timeEnd("Arrow Serialization");

    console.log(`Serialized Size: ${(ipcBuffer.byteLength / 1024).toFixed(2)} KB`);
    return ipcBuffer;
}