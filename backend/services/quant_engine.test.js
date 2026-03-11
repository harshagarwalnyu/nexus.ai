import { expect, test, describe } from "bun:test";
import { FinancialEngine } from "./quant_engine.js";

describe("Financial Simulation Engine", () => {
  test("initializes correctly", () => {
    const engine = new FinancialEngine(100_000_000);
    expect(engine.S0).toBe(100_000_000);
  });

  test("runs simulation and returns arrow table", () => {
    const engine = new FinancialEngine(100_000_000);
    const table = engine.runSimulation();
    
    expect(table).toBeDefined();
    expect(table.numRows).toBeGreaterThan(0);
    expect(table.getChild("mean_revenue")).toBeDefined();
    expect(table.getChild("upper_bound")).toBeDefined();
    expect(table.getChild("lower_bound")).toBeDefined();
  });

  test("simulation results are reasonable", () => {
    const initial = 100_000_000;
    const engine = new FinancialEngine(initial, 0.2, 0.05);
    const table = engine.runSimulation();
    const meanRevenue = table.getChild("mean_revenue").toArray();
    
    // Check if mean revenue generally follows the drift (not guaranteed but highly likely for 1000 paths)
    const finalMean = meanRevenue[meanRevenue.length - 1];
    expect(finalMean).toBeGreaterThan(initial * 0.5); // Very loose bound to handle stochasticity
  });
});
