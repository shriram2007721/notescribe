import { describe, expect, it } from "vitest";
import { applyVocabulary, parseVocabulary, similarity } from "@/lib/vocab";

describe("speech vocabulary correction", () => {
  it("fixes close misspellings of names and terms", () => {
    const text = "the four Coughman conditions are mutual exclusion and by Kauffman algorithm";
    expect(applyVocabulary(text, "Coffman conditions, Banker's algorithm")).toContain("Coffman");
    expect(applyVocabulary("the Kauffman conditions", "Coffman")).toBe("the Coffman conditions");
  });

  it("fixes names that sound alike even when spelled quite differently", () => {
    expect(applyVocabulary("The four Kaufmann conditions", "Coffman")).toBe("The four Coffman conditions");
    expect(applyVocabulary("the Kaufmann conditions", "Coffman")).toBe("the Coffman conditions");
  });

  it("matches multi-word names regardless of case", () => {
    expect(applyVocabulary("this was told to Shri ram yesterday", "Shri Ram")).toBe("this was told to Shri Ram yesterday");
  });

  it("keeps punctuation after the replaced word", () => {
    expect(applyVocabulary("Coughman, is key.", "Coffman")).toBe("Coffman, is key.");
  });

  it("does not change plurals of a saved term", () => {
    expect(applyVocabulary("the Deadlocks in systems", "Deadlock")).toBe("the Deadlocks in systems");
  });

  it("leaves unrelated words alone", () => {
    const text = "the process holds a resource and waits";
    expect(applyVocabulary(text, "Coffman, Mukesh")).toBe(text);
  });

  it("does nothing without a vocabulary", () => {
    expect(applyVocabulary("hello there", "")).toBe("hello there");
  });

  it("parses one term per line or comma-separated, skipping very short entries", () => {
    expect(parseVocabulary("Shri Ram\nMukesh, Thilak, a")).toEqual(["Shri Ram", "Mukesh", "Thilak"]);
  });

  it("scores similar spellings high and different words low", () => {
    expect(similarity("Coughman", "Coffman")).toBeGreaterThanOrEqual(0.6);
    expect(similarity("table", "process")).toBeLessThan(0.5);
  });
});
