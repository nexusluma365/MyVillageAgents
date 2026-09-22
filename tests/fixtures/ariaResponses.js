// Fixtures for large/odd ARIA transport responses.
// Each fixture is { name, text, httpOk, statusCode, expect } where `expect`
// describes what the parsed/normalized result should contain. These back
// tests/transportParse.test.js and tests/ariaResponseNormalizer.test.js.

const UNIT_20K = "SAGE found several qualified leads today. ";
const LONG_20K = UNIT_20K.repeat(Math.ceil(20000 / UNIT_20K.length));
const UNIT_100K = "MILO drafted the campaign copy and it is ready for review. ";
const LONG_100K = UNIT_100K.repeat(Math.ceil(100000 / UNIT_100K.length));

export const FIXTURES = [
  {
    name: "normal_aria_json",
    text: JSON.stringify({ success: true, agent: "aria", status: "completed", message: "Okay Boss, 3 leads are ready." }),
    httpOk: true,
    expect: { success: true, messageIncludes: "3 leads" },
  },
  {
    name: "20000_char_message",
    text: JSON.stringify({ success: true, message: LONG_20K }),
    httpOk: true,
    expect: { success: true, minLength: 20000 },
  },
  {
    name: "100000_char_message",
    text: JSON.stringify({ success: true, message: LONG_100K }),
    httpOk: true,
    expect: { success: true, minLength: 100000 },
  },
  {
    name: "two_paragraph_response",
    text: JSON.stringify({ success: true, message: "First paragraph here.\n\nSecond paragraph here." }),
    httpOk: true,
    expect: { success: true, sectionsAtLeast: 2 },
  },
  {
    name: "twenty_paragraph_response",
    text: JSON.stringify({ success: true, message: Array.from({ length: 20 }, (_, i) => `Paragraph number ${i + 1} with some content.`).join("\n\n") }),
    httpOk: true,
    expect: { success: true, sectionsAtLeast: 10 },
  },
  {
    name: "nested_findings_arrays",
    text: JSON.stringify({
      success: true,
      message: "Findings are in.",
      findings: [{ message: "Lead A is qualified" }, { text: "Lead B needs follow-up" }, "Lead C is cold"],
    }),
    httpOk: true,
    expect: { success: true, findingsCount: 3 },
  },
  {
    name: "quotes_inside_message",
    text: JSON.stringify({ success: true, message: 'Boss said "go ahead" so I did.' }),
    httpOk: true,
    expect: { success: true, messageIncludes: '"go ahead"' },
  },
  {
    name: "apostrophes",
    text: JSON.stringify({ success: true, message: "I can't finish that yet, it's still SAGE's task." }),
    httpOk: true,
    expect: { success: true, messageIncludes: "can't" },
  },
  {
    name: "new_lines",
    text: JSON.stringify({ success: true, message: "Line one\nLine two\nLine three" }),
    httpOk: true,
    expect: { success: true, messageIncludes: "Line two" },
  },
  {
    name: "unicode",
    text: JSON.stringify({ success: true, message: "Renter café résumé naïve — looks good 好的" }),
    httpOk: true,
    expect: { success: true, messageIncludes: "café" },
  },
  {
    name: "emoji",
    text: JSON.stringify({ success: true, message: "Great news! 🎉 3 leads closed 🏠✅" }),
    httpOk: true,
    expect: { success: true, messageIncludes: "🎉" },
  },
  {
    name: "em_dash",
    text: JSON.stringify({ success: true, message: "SAGE finished — MILO is next." }),
    httpOk: true,
    expect: { success: true, messageIncludes: "—" },
  },
  {
    name: "json_inside_markdown_fence",
    text: '```json\n{"success": true, "message": "Fenced JSON recovered."}\n```',
    httpOk: true,
    expect: { success: true, messageIncludes: "Fenced JSON recovered" },
  },
  {
    name: "json_string_containing_json",
    text: JSON.stringify(JSON.stringify({ success: true, message: "Double-encoded JSON recovered." })),
    httpOk: true,
    expect: { success: true, messageIncludes: "Double-encoded" },
  },
  {
    name: "array_containing_response",
    text: JSON.stringify([{ success: true, message: "Array-wrapped response." }]),
    httpOk: true,
    expect: { success: true, messageIncludes: "Array-wrapped" },
  },
  {
    name: "data_wrapper",
    text: JSON.stringify({ data: { success: true, message: "Data-wrapped response." } }),
    httpOk: true,
    expect: { success: true, messageIncludes: "Data-wrapped" },
  },
  {
    name: "body_wrapper",
    text: JSON.stringify({ body: { success: true, message: "Body-wrapped response." } }),
    httpOk: true,
    expect: { success: true, messageIncludes: "Body-wrapped" },
  },
  {
    name: "result_wrapper",
    text: JSON.stringify({ result: { success: true, message: "Result-wrapped response." } }),
    httpOk: true,
    expect: { success: true, messageIncludes: "Result-wrapped" },
  },
  {
    name: "response_wrapper",
    text: JSON.stringify({ response: { success: true, message: "Response-wrapped response." } }),
    httpOk: true,
    expect: { success: true, messageIncludes: "Response-wrapped" },
  },
  {
    name: "openai_output_wrapper",
    text: JSON.stringify({ output: [{ content: [{ type: "output_text", text: '{"success": true, "message": "OpenAI-shaped output recovered."}' }] }] }),
    httpOk: true,
    expect: { success: true, messageIncludes: "OpenAI-shaped" },
  },
  {
    name: "whitespace_before_json",
    text: "   \n\n  " + JSON.stringify({ success: true, message: "Leading whitespace handled." }),
    httpOk: true,
    expect: { success: true, messageIncludes: "Leading whitespace" },
  },
  {
    name: "utf8_bom",
    text: "\uFEFF" + JSON.stringify({ success: true, message: "BOM handled." }),
    httpOk: true,
    expect: { success: true, messageIncludes: "BOM handled" },
  },
  {
    name: "plain_readable_text_http_200",
    text: "Okay Boss, I finished reviewing the leads and everything looks good.",
    httpOk: true,
    expect: { success: true, messageIncludes: "everything looks good" },
  },
  {
    // Note: buildSafeEnvelope's job for non-2xx responses is only to recover
    // a readable message (see server/ariaProxy.js's readableError()); the
    // final `success: false` shape is assembled by the caller, not here.
    name: "html_error_page",
    text: "<!DOCTYPE html><html><head><title>524</title></head><body>A timeout occurred</body></html>",
    httpOk: false,
    statusCode: 524,
    expect: { messageExcludes: "<html" },
  },
  {
    name: "empty_response",
    text: "",
    httpOk: true,
    expect: { success: false, message: "" },
  },
  {
    name: "http_500",
    text: JSON.stringify({ message: "Internal server error in workflow." }),
    httpOk: false,
    statusCode: 500,
    expect: { messageIncludes: "Internal server error" },
  },
  {
    name: "http_502",
    text: "",
    httpOk: false,
    statusCode: 502,
    expect: {},
  },
  {
    name: "http_504",
    text: "",
    httpOk: false,
    statusCode: 504,
    expect: {},
  },
  {
    name: "http_524",
    text: "",
    httpOk: false,
    statusCode: 524,
    expect: {},
  },
  {
    name: "malformed_json_with_readable_message",
    text: '{"success": true, "message": "Almost valid JSON but truncated...',
    httpOk: true,
    expect: { success: true, messageIncludes: "Almost valid JSON" },
  },
];
