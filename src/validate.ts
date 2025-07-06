import type { ValidationSchema, YamlError } from "./types";

export function getValueType(value: unknown): string {
  if (value === null) return "null";
  if (Array.isArray(value)) return "array";
  return typeof value;
}

export async function getValueAtPath(source: string, path: string) {
  try {
    const { parseDocument } = await import("yaml");
    const doc = parseDocument(source);
    const pathSegments = path.split(".");
    let current = doc.toJS();

    for (const segment of pathSegments) {
      if (current == null) return undefined;

      const numericSegment = Number(segment);
      if (!Number.isNaN(numericSegment) && Array.isArray(current)) {
        current = current[numericSegment];
      } else if (typeof current === "object") {
        current = current[segment];
      } else {
        return undefined;
      }
    }

    return current;
  } catch {
    return undefined;
  }
}

export function validateRequiredFields(
  schema: ValidationSchema,
  lookupFn: (path: string) => unknown,
  createErrorFn: (
    message: string,
    path: string,
    severity: "error" | "warning" | "info",
  ) => YamlError,
): YamlError[] {
  const errors: YamlError[] = [];

  if (schema.required) {
    for (const requiredPath of schema.required) {
      if (!lookupFn(requiredPath)) {
        errors.push(
          createErrorFn(
            `Required field '${requiredPath}' is missing`,
            requiredPath,
            "error",
          ),
        );
      }
    }
  }

  return errors;
}

export function validateTypes(
  schema: ValidationSchema,
  lookupFn: (path: string) => unknown,
  getValueFn: (path: string) => unknown,
  createErrorFn: (
    message: string,
    path: string,
    severity: "error" | "warning" | "info",
  ) => YamlError,
): YamlError[] {
  const errors: YamlError[] = [];

  if (schema.types) {
    for (const [path, expectedType] of Object.entries(schema.types)) {
      const location = lookupFn(path);
      if (location) {
        const value = getValueFn(path);
        const actualType = getValueType(value);

        if (actualType !== expectedType) {
          errors.push(
            createErrorFn(
              `Expected type '${expectedType}' but got '${actualType}'`,
              path,
              "error",
            ),
          );
        }
      }
    }
  }

  return errors;
}

export function validatePatterns(
  schema: ValidationSchema,
  lookupFn: (path: string) => unknown,
  getValueFn: (path: string) => unknown,
  createErrorFn: (
    message: string,
    path: string,
    severity: "error" | "warning" | "info",
  ) => YamlError,
): YamlError[] {
  const errors: YamlError[] = [];

  if (schema.patterns) {
    for (const [path, pattern] of Object.entries(schema.patterns)) {
      const location = lookupFn(path);
      if (location) {
        const value = getValueFn(path);
        if (typeof value === "string" && !pattern.test(value)) {
          errors.push(
            createErrorFn(
              `Value '${value}' does not match required pattern`,
              path,
              "error",
            ),
          );
        }
      }
    }
  }

  return errors;
}

export function validateCustomRules(
  schema: ValidationSchema,
  lookupFn: (path: string) => unknown,
  getValueFn: (path: string) => unknown,
  createErrorFn: (
    message: string,
    path: string,
    severity: "error" | "warning" | "info",
  ) => YamlError,
): YamlError[] {
  const errors: YamlError[] = [];

  if (schema.custom) {
    for (const customRule of schema.custom) {
      const location = lookupFn(customRule.path);
      if (location) {
        const value = getValueFn(customRule.path);
        const result = customRule.validator(value);

        if (typeof result === "string") {
          errors.push(createErrorFn(result, customRule.path, "error"));
        } else if (result === false) {
          const message =
            customRule.message ||
            `Custom validation failed for '${customRule.path}'`;
          errors.push(createErrorFn(message, customRule.path, "error"));
        }
      }
    }
  }

  return errors;
}
