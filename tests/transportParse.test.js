import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSafeEnvelope, parseTransportBody } from "../src/domain/transportParse.js";
import { FIXTURES } from "./fixtures/ariaResponses.js";

describe("buildSafeEnvelope — large/odd ARIA response fixtures", () => {
  for (const fixture of FIXTURES) {
    it(`handles: ${fixture.name}`, () => {
      const envelope = buildSafeEnvelope(fixture.text, { httpOk: fixture.httpOk });

      if (fixture.httpOk !== false && "success" in fixture.expect) {
        expect(envelope.success).toBe(fixture.expect.success);
      }
      if ("message" in fixture.expect) {
        expect(envelope.message).toBe(fixture.expect.message);
      }
      if (fixture.expect.messageIncludes) {
        expect(envelope.message).toEqual(expect.stringContaining(fixture.expect.messageIncludes));
      }
      if (fixture.expect.messageExcludes) {
        expect(envelope.message || "").not.toEqual(expect.stringContaining(fixture.expect.messageExcludes));
      }
      if (fixture.expect.minLength) {
        expect((envelope.message || "").length).toBeGreaterThanOrEqual(fixture.expect.minLength);
      }
      if (fixture.expect.findingsCount) {
        expect(Array.isArray(envelope.findings) ? envelope.findings.length : 0).toBeGreaterThanOrEqual(0);
        // findings survive the transport layer unmodified — normalization
        // (array-of-objects -> strings) happens in ariaResponseNormalizer.
        expect(envelope.findings.length).toBe(fixture.expect.findingsCount);
      }
    });
  }

  it("never throws, even on garbage input", () => {
    const inputs = [null, undefined, "", "{", "}}}}", "not json at all", "\u0000\u0001binary-ish", "[".repeat(100000)];
    for (const input of inputs) {
      expect(() => buildSafeEnvelope(input, { httpOk: true })).not.toThrow();
    }
  });

  it("never uses eval or Function on the body", () => {
    const src = readFileSync(join(process.cwd(), "src/domain/transportParse.js"), "utf8");
    expect(src).not.toMatch(/\beval\s*\(/);
    expect(src).not.toMatch(/new Function\s*\(/);
  });

  it("does not hang on deeply/adversarially nested wrapper input (bounded unwrap depth)", () => {
    let value = { message: "core message" };
    for (let i = 0; i < 50; i++) value = { data: value };
    const start = Date.now();
    const envelope = buildSafeEnvelope(JSON.stringify(value), { httpOk: true });
    expect(Date.now() - start).toBeLessThan(1000);
    expect(typeof envelope).toBe("object");
  });

  it("extracts a balanced JSON object surrounded by prose without truncating nested structures", () => {
    const text = 'Here is the result: {"success": true, "message": "ok", "nested": {"a": [1, 2, {"b": "}"}]}} — done.';
    const parsed = parseTransportBody(text);
    expect(parsed.ok).toBe(true);
    expect(parsed.value.nested.a[2].b).toBe("}");
  });

  it("does not surface raw HTML error pages to the message", () => {
    const envelope = buildSafeEnvelope("<!DOCTYPE html><html><body>Cloudflare error</body></html>", { httpOk: false });
    expect(envelope.success).toBe(false);
    expect(envelope.message).not.toMatch(/<html/i);
  });
});
