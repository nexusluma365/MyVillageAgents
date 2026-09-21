// Lightweight structural validator — no schema library dependency.
// Spec shape: { field: "string" | "boolean" | "string?" | "boolean?" }
// ("?" suffix = optional). Returns an array of human-readable error
// strings; empty array means valid.
export function validateShape(value, spec) {
  const errors = [];
  if (!value || typeof value !== "object") {
    return ["Response was not a JSON object."];
  }
  for (const [key, typeSpec] of Object.entries(spec)) {
    const optional = typeSpec.endsWith("?");
    const baseType = optional ? typeSpec.slice(0, -1) : typeSpec;
    const val = value[key];

    if (val === undefined || val === null || val === "") {
      if (!optional) errors.push(`Missing required field: ${key}`);
      continue;
    }
    if (baseType === "string" && typeof val !== "string") errors.push(`${key} must be a string`);
    if (baseType === "boolean" && typeof val !== "boolean") errors.push(`${key} must be a boolean`);
  }
  return errors;
}
