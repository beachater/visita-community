import { describe, expect, it } from "vitest";
import { constrainWalkStep, emptyScanExperience, insideWalkable, scanExperienceError } from "./scan-experience";

const square: [number, number][] = [[0, 0], [4, 0], [4, 4], [0, 4]];

describe("walkable area", () => {
  it("accepts interior and edge points while rejecting the void", () => {
    expect(insideWalkable([2, 2], square)).toBe(true);
    expect(insideWalkable([4, 2], square)).toBe(true);
    expect(insideWalkable([5, 2], square)).toBe(false);
  });

  it("keeps movement inside and slides along a wall", () => {
    expect(constrainWalkStep([3.9, 2], [4.2, 2.3], square)).toEqual([3.9, 2.3]);
    expect(constrainWalkStep([2, 2], [3, 3], square)).toEqual([3, 3]);
  });

  it("requires a safe start and stops before publication", () => {
    const experience = { ...emptyScanExperience(), walkable: square, start: { position: [2, 1.6, 2] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] } };
    expect(scanExperienceError(experience)).toBeNull();
    experience.start.position = [5, 1.6, 2];
    expect(scanExperienceError(experience)).toMatch(/starting view/i);
  });

  it("rejects a crossing boundary", () => {
    const experience = { ...emptyScanExperience(), walkable: [[0, 0], [4, 4], [0, 4], [4, 0]] as [number, number][], start: { position: [2, 1.6, 2] as [number, number, number], rotation: [0, 0, 0] as [number, number, number] } };
    expect(scanExperienceError(experience)).toMatch(/crosses itself/i);
  });
});
