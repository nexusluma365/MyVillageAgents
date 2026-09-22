import { describe, it, expect } from "vitest";
import {
  normalizeAriaResponse,
  normalizeAriaTransportError,
  splitAriaMessageSections,
  formatElapsed,
} from "../src/domain/ariaResponseNormalizer.js";
import { buildSafeEnvelope } from "../src/domain/transportParse.js";
import { FIXTURES } from "./fixtures/ariaResponses.js";

function toRawResponse(fixture) {
  const body = buildSafeEnvelope(fixture.text, { httpOk: fixture.httpOk });
  return { statusCode: fixture.httpOk ? 200 : fixture.statusCode ?? 500, body };
}

describe("normalizeAriaResponse end-to-end over fixtures (proxy output -> UI object)", () => {
  for (const fixture of FIXTURES) {
    if (fixture.httpOk === false || fixture.expect.success === false) continue; // failure fixtures assert transport-level behavior only
    it(`normalizes: ${fixture.name}`, () => {
      const normalized = normalizeAriaResponse(toRawResponse(fixture));
      expect(normalized.success).toBe(true);
      if (fixture.expect.messageIncludes) {
        expect(normalized.message).toEqual(expect.stringContaining(fixture.expect.messageIncludes));
      }
      if (fixture.expect.minLength) {
        expect(normalized.message.length).toBeGreaterThanOrEqual(fixture.expect.minLength);
      }
    });
  }

  it("a valid readable 200 response is never reported as 'trouble reading the result'", () => {
    const normalized = normalizeAriaResponse(toRawResponse({ text: "Plain readable ARIA answer.", httpOk: true }));
    expect(normalized.success).toBe(true);
    expect(normalized.message).toBe("Plain readable ARIA answer.");
  });
});

describe("splitAriaMessageSections — dialogue pagination", () => {
  it("returns one section for a short message", () => {
    expect(splitAriaMessageSections("Hi Boss, all good.")).toEqual(["Hi Boss, all good."]);
  });

  it("splits on paragraph boundaries", () => {
    const sections = splitAriaMessageSections("First paragraph.\n\nSecond paragraph.\n\nThird paragraph.");
    expect(sections.length).toBe(3);
  });

  it("breaks a very long single paragraph into multiple bounded sections", () => {
    const longParagraph = "This is a sentence about leads. ".repeat(40).trim();
    const sections = splitAriaMessageSections(longParagraph);
    expect(sections.length).toBeGreaterThan(1);
    sections.forEach((section) => expect(section.length).toBeLessThanOrEqual(500));
  });

  it("handles empty input safely", () => {
    expect(splitAriaMessageSections("")).toEqual([]);
    expect(splitAriaMessageSections(undefined)).toEqual([]);
  });
});

describe("formatElapsed", () => {
  it("formats seconds only", () => {
    expect(formatElapsed(8000)).toBe("8 sec");
  });
  it("formats minutes and seconds", () => {
    expect(formatElapsed(65000)).toBe("1 min 5 sec");
  });
  it("formats multiple minutes", () => {
    expect(formatElapsed(252000)).toBe("4 mins 12 sec");
  });
  it("never returns negative time", () => {
    expect(formatElapsed(-500)).toBe("0 sec");
  });
});

describe("normalizeAriaTransportError — status code classification", () => {
  it("classifies 524 as long_running, not malformed JSON", () => {
    const result = normalizeAriaTransportError({ statusCode: 524 });
    expect(result.code).toBe("long_running");
    expect(result.message).toMatch(/taking longer than expected/i);
  });
  it("classifies 500 as a server error", () => {
    const result = normalizeAriaTransportError({ statusCode: 500 });
    expect(result.code).toBe("server");
  });
  it("classifies 504 as a timeout", () => {
    const result = normalizeAriaTransportError({ statusCode: 504 });
    expect(result.code).toBe("timeout");
  });
  it("classifies network failures", () => {
    const result = normalizeAriaTransportError({ message: "Failed to fetch" });
    expect(result.code).toBe("network");
  });
});

describe("requestId isolation", () => {
  it("two concurrent requests keep independent normalized results", () => {
    const a = normalizeAriaResponse({ statusCode: 200, body: { success: true, message: "Result A", taskId: "req-a" } });
    const b = normalizeAriaResponse({ statusCode: 200, body: { success: true, message: "Result B", taskId: "req-b" } });
    expect(a.taskId).toBe("req-a");
    expect(b.taskId).toBe("req-b");
    expect(a.message).toBe("Result A");
    expect(b.message).toBe("Result B");
  });
});
