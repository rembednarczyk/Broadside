import { describe, expect, it } from "vitest";
import { ammoPrice, crewPrice, plunderValue, priceFactor, prizeMoney, provisionsPrice, repairBill } from "../src/economy/port-trade";

describe("port trade", () => {
  it("prices by the port's standing towards the captain", () => {
    expect(priceFactor("pirates", "crown")).toBe(1.35);
    expect(priceFactor("crown", "republic")).toBeNull();
    expect(priceFactor("crown", "player")).toBe(1);
  });

  it("charges for each service", () => {
    expect(ammoPrice("round", 10, 1)).toBe(20);
    expect(crewPrice(10, 1)).toBe(120);
    expect(provisionsPrice(100, 10, 1)).toBe(150);
    const bill = repairBill(100, 50, 0.5, 300, 0.2, 100, 1);
    expect(bill.total).toBe(bill.hull + bill.masts + bill.canvas + bill.rigging);
    expect(bill.hull).toBe(50);
  });

  it("pays for plunder and prizes", () => {
    expect(plunderValue(1000, "pirates")).toBe(800);
    expect(plunderValue(1000, "crown")).toBe(1000);
    expect(prizeMoney(10000, true)).toBeGreaterThan(prizeMoney(10000, false));
  });
});
