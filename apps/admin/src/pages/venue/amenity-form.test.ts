import { describe, expect, it } from "vitest";
import type { AmenityEntry } from "@visita/shared-types";
import { describeEntry, toEntry } from "./amenity-form";

const def = (value_type: "boolean" | "number" | "text" | "list", unit: string | null = null) => ({ value_type, unit });

describe("toEntry", () => {
  it("reads yes/no for a boolean", () => expect(toEntry(def("boolean"), "yes", "")).toEqual({ value: true }));
  it("reads a number, with a display label", () => expect(toEntry(def("number"), "9", "7 inside, 2 outside")).toEqual({ value: 9, label: "7 inside, 2 outside" }));
  it("refuses a number that isn't one", () => expect(toEntry(def("number"), "lots", "")).toBe("invalid"));
  it("splits a list on commas", () => expect(toEntry(def("list"), " Cash, GCash ,, Card", "")).toEqual({ value: ["Cash", "GCash", "Card"] }));
  it("allows a label on its own", () => expect(toEntry(def("text"), "", "Air-conditioned upstairs")).toEqual({ label: "Air-conditioned upstairs" }));
  it("is empty when nothing was entered", () => expect(toEntry(def("boolean"), "", " ")).toBeNull());
});

describe("describeEntry", () => {
  it("prefers the label", () => expect(describeEntry(def("number"), { value: 9, label: "Nine outlets" })).toBe("Nine outlets"));
  it.each<[ReturnType<typeof def>, AmenityEntry | undefined, string]>([
    [def("boolean"), { value: false }, "No"],
    [def("number", "Mbps"), { value: 100 }, "100 Mbps"],
    [def("list"), { value: ["Cash", "GCash"] }, "Cash, GCash"],
    [def("text"), undefined, "Not listed"],
  ])("%j %j → %s", (d, e, text) => expect(describeEntry(d, e)).toBe(text));
});
