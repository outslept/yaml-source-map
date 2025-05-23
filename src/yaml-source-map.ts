import {
  isMap,
  isPair,
  isScalar,
  isSeq,
  LineCounter,
  parseDocument,
  type Document,
  type Node,
} from "yaml";
import { YamlErrorFormatter } from "./error-formatter";
import type {
  ErrorDisplayOptions,
  PathInput,
  PathSegment,
  SourceLocation,
  ValidationResult,
  ValidationSchema,
  YamlError,
} from "./types";

type NodeWithRange = Node & { range?: [number, number, number] | null };

export class YamlSourceMap {
  /** Internal map storing path-to-location mappings for all YAML nodes */
  private sourceMap: Map<string, SourceLocation> = new Map();
  /** Original YAML source text for reference and error display */
  private source: string = "";
  /** YAML parser's line counter for accurate position tracking */
  private lineCounter: LineCounter = new LineCounter();
  /** Error formatter instance for generating human-readable error messages */
  private errorFormatter?: YamlErrorFormatter;

  /**
   * Parse YAML source text and build a complete source map
   * @param yamlSource - The YAML content to parse
   * @returns The parsed JavaScript object representation
   */
  parse(yamlSource: string): unknown {
    this.source = yamlSource;
    this.lineCounter = new LineCounter();
    this.errorFormatter = new YamlErrorFormatter(yamlSource);

    const doc = parseDocument(yamlSource, {
      keepSourceTokens: true,
      lineCounter: this.lineCounter,
    });

    this.buildSourceMap(doc);
    return doc.toJS();
  }

  /**
   * Find the source location of a specific YAML path
   * @param path - YAML path in dot notation (e.g., "database.host") or as array
   * @returns Source location if found, undefined if path doesn't exist
   */
  lookup(path: PathInput): SourceLocation | undefined {
    const normalizedPath = this.normalizePath(path);
    return this.sourceMap.get(normalizedPath);
  }

  /**
   * Get all available YAML paths that have been mapped to source locations
   * @returns Sorted array of all mapped paths in dot notation
   */
  getPaths(): string[] {
    return Array.from(this.sourceMap.keys()).sort();
  }

  /**
   * Extract a portion of the original source text starting from a location
   * @param location - Starting position in the source
   * @param length - Number of characters to extract (optional, defaults to end of file)
   * @returns The extracted source text
   */
  getSourceText(location: SourceLocation, length?: number): string {
    const start = location.position;
    const end = length ? start + length : this.source.length;
    return this.source.slice(start, end);
  }

  /**
   * Get the complete text content of a specific line
   * @param lineNumber - Line number to retrieve (1-based)
   * @returns The text content of the line, or empty string if line doesn't exist
   */
  getLineText(lineNumber: number): string {
    const lines = this.source.split("\n");
    return lines[lineNumber - 1] || "";
  }

  /**
   * Get contextual lines around a specific location for error display
   * @param location - The source location to get context for
   * @param contextLines - Number of lines to include before and after (default: 2)
   * @returns Object containing before, current, and after line arrays
   */
  getContext(
    location: SourceLocation,
    contextLines: number = 2,
  ): {
    before: string[];
    current: string;
    after: string[];
  } {
    const lines = this.source.split("\n");
    const lineIndex = location.line - 1;

    return {
      before: lines.slice(Math.max(0, lineIndex - contextLines), lineIndex),
      current: lines[lineIndex] || "",
      after: lines.slice(lineIndex + 1, lineIndex + 1 + contextLines),
    };
  }

  /**
   * Create a new YAML error with automatic source location lookup
   * @param message - Human-readable error description
   * @param path - Optional YAML path where the error occurred
   * @param severity - Error severity level (default: 'error')
   * @returns Configured YamlError object
   */
  createError(
    message: string,
    path?: string,
    severity: "error" | "warning" | "info" = "error",
  ): YamlError {
    const location = path ? this.lookup(path) : undefined;
    return {
      message,
      path,
      location,
      severity,
    };
  }

  /**
   * Format a single error with source context and highlighting
   * @param error - The error to format
   * @param options - Display customization options
   * @returns Formatted error string ready for console output
   * @throws Error if called before parse()
   */
  formatError(error: YamlError, options?: ErrorDisplayOptions): string {
    if (!this.errorFormatter) {
      throw new Error(
        "No source available for error formatting. Call parse() first.",
      );
    }
    return this.errorFormatter.formatError(error, options);
  }

  /**
   * Format multiple errors with a summary header
   * @param errors - Array of errors to format
   * @param options - Display customization options
   * @returns Formatted string containing summary and all errors
   * @throws Error if called before parse()
   */
  formatErrors(errors: YamlError[], options?: ErrorDisplayOptions): string {
    if (!this.errorFormatter) {
      throw new Error(
        "No source available for error formatting. Call parse() first.",
      );
    }
    return this.errorFormatter.formatMultipleErrors(errors, options);
  }

  /**
   * Validate the parsed YAML against a schema definition
   * @param schema - Validation rules including required fields, types, and patterns
   * @param options - Error formatting options for the result
   * @returns Validation result with errors, warnings, and formatted output
   */
  validate(
    schema?: ValidationSchema,
    options?: ErrorDisplayOptions,
  ): ValidationResult {
    const errors: YamlError[] = [];
    const warnings: YamlError[] = [];

    if (schema) {
      this.validateAgainstSchema(schema, errors, warnings);
    }

    const allIssues = [...errors, ...warnings];

    return {
      valid: errors.length === 0,
      errors,
      warnings,
      formattedErrors:
        allIssues.length > 0
          ? this.formatErrors(allIssues, options)
          : undefined,
    };
  }

  /**
   * Validate a specific YAML path using a custom validator function
   * @param path - YAML path to validate
   * @param validator - Function that returns true for valid values, false or error message for invalid
   * @returns YamlError if validation fails, null if validation passes
   */
  validatePath(
    path: string,
    validator: (value: unknown, location: SourceLocation) => boolean | string,
  ): YamlError | null {
    const location = this.lookup(path);
    if (!location) {
      return this.createError(`Path '${path}' not found`, path, "error");
    }

    const value = this.getValueAtPath(path);
    const result = validator(value, location);

    if (result === true) {
      return null;
    }

    const message =
      typeof result === "string"
        ? result
        : `Validation failed for path '${path}'`;
    return this.createError(message, path, "error");
  }

  /**
   * Retrieve the actual value at a specific YAML path
   * @param path - Dot-notation path to the value
   * @returns The value at the path, or undefined if not found
   */
  private getValueAtPath(path: string): unknown {
    try {
      const doc = parseDocument(this.source);
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

  /**
   * Perform validation against a complete schema definition
   * @param schema - The validation schema with rules to check
   * @param errors - Array to collect validation errors
   * @param warnings - Array to collect validation warnings
   */
  private validateAgainstSchema(
    schema: ValidationSchema,
    errors: YamlError[],
    // warnings: YamlError[],
  ): void {
    // Check required fields
    if (schema.required) {
      for (const requiredPath of schema.required) {
        if (!this.lookup(requiredPath)) {
          errors.push(
            this.createError(
              `Required field '${requiredPath}' is missing`,
              requiredPath,
              "error",
            ),
          );
        }
      }
    }

    // Check data types
    if (schema.types) {
      for (const [path, expectedType] of Object.entries(schema.types)) {
        const location = this.lookup(path);
        if (location) {
          const value = this.getValueAtPath(path);
          const actualType = this.getValueType(value);

          if (actualType !== expectedType) {
            errors.push(
              this.createError(
                `Expected type '${expectedType}' but got '${actualType}'`,
                path,
                "error",
              ),
            );
          }
        }
      }
    }

    // Check pattern matching for strings
    if (schema.patterns) {
      for (const [path, pattern] of Object.entries(schema.patterns)) {
        const location = this.lookup(path);
        if (location) {
          const value = this.getValueAtPath(path);
          if (typeof value === "string" && !pattern.test(value)) {
            errors.push(
              this.createError(
                `Value '${value}' does not match required pattern`,
                path,
                "error",
              ),
            );
          }
        }
      }
    }

    // Run custom validation functions
    if (schema.custom) {
      for (const customRule of schema.custom) {
        const location = this.lookup(customRule.path);
        if (location) {
          const value = this.getValueAtPath(customRule.path);
          const result = customRule.validator(value);

          if (typeof result === "string") {
            errors.push(this.createError(result, customRule.path, "error"));
          } else if (result === false) {
            const message =
              customRule.message ||
              `Custom validation failed for '${customRule.path}'`;
            errors.push(this.createError(message, customRule.path, "error"));
          }
        }
      }
    }
  }

  /**
   * Determine the JavaScript type of a value for validation purposes
   * @param value - The value to check
   * @returns String representation of the value's type
   */
  private getValueType(value: unknown): string {
    if (value === null) return "null";
    if (Array.isArray(value)) return "array";
    return typeof value;
  }

  /**
   * Build the complete source map by traversing the parsed YAML document
   * @param doc - The parsed YAML document from the yaml library
   */
  private buildSourceMap(doc: Document): void {
    if (!doc.contents) return;
    this.traverseNode(doc.contents, []);
  }

  /**
   * Recursively traverse YAML nodes to build path-to-location mappings
   * @param node - Current YAML node being processed
   * @param path - Current path segments leading to this node
   */
  private traverseNode(node: Node | null, path: PathSegment[]): void {
    if (!node) return;

    if (this.hasRange(node)) {
      this.addToSourceMap(path, node);
    }

    if (isMap(node)) {
      node.items.forEach((pair) => {
        if (isPair(pair) && pair.key && this.hasRange(pair.key)) {
          const keyValue = this.getScalarValue(pair.key);
          if (keyValue !== null) {
            const keyPath = [...path, keyValue];
            this.addToSourceMap(keyPath, pair.key);

            if (pair.value && this.isNode(pair.value)) {
              this.traverseNode(pair.value, keyPath);
            }
          }
        }
      });
    } else if (isSeq(node)) {
      node.items.forEach((item, index) => {
        if (item && this.isNode(item)) {
          const itemPath = [...path, index];
          this.traverseNode(item, itemPath);
        }
      });
    }
  }

  /**
   * Extract the scalar value from a YAML node for use as a path segment
   * @param node - YAML node to extract value from
   * @returns String or number value, or null if not a scalar
   */
  private getScalarValue(node: Node): string | number | null {
    if (isScalar(node)) {
      return typeof node.value === "string" || typeof node.value === "number"
        ? node.value
        : String(node.value);
    }
    return null;
  }

  /**
   * Type guard to check if a value is a valid YAML node
   * @param value - Value to check
   * @returns True if the value is a YAML node
   */
  private isNode(value: unknown): value is Node {
    return (
      value !== null &&
      typeof value === "object" &&
      (isScalar(value) ||
        isMap(value) ||
        isSeq(value) ||
        value.constructor?.name?.includes("Alias"))
    );
  }

  /**
   * Type guard to check if a node has range information for source mapping
   * @param node - Node to check
   * @returns True if the node has valid range data
   */
  private hasRange(node: unknown): node is NodeWithRange {
    if (!this.isNode(node)) return false;

    const nodeWithRange = node;
    return (
      "range" in nodeWithRange &&
      nodeWithRange.range !== null &&
      nodeWithRange.range !== undefined &&
      Array.isArray(nodeWithRange.range) &&
      nodeWithRange.range.length >= 2
    );
  }

  /**
   * Add a path-to-location mapping to the source map with multiple path formats
   * @param path - Array of path segments
   * @param node - YAML node with range information
   */
  private addToSourceMap(path: PathSegment[], node: NodeWithRange): void {
    if (!node.range) return;

    const offset = node.range[0];
    const linePos = this.lineCounter.linePos(offset);

    const location: SourceLocation = {
      line: linePos.line,
      column: linePos.col,
      position: offset,
    };

    // Store multiple path formats for flexible lookup
    const pathString = this.pathToString(path);
    this.sourceMap.set(pathString, location);

    const dotPath = this.pathToDotNotation(path);
    if (dotPath !== pathString) {
      this.sourceMap.set(dotPath, location);
    }

    const bracketPath = this.pathToBracketNotation(path);
    if (bracketPath !== pathString && bracketPath !== dotPath) {
      this.sourceMap.set(bracketPath, location);
    }
  }

  /**
   * Normalize different path input formats to a string representation
   * @param path - Path in various formats (string, array, etc.)
   * @returns Normalized dot-notation path string
   */
  private normalizePath(path: PathInput): string {
    if (Array.isArray(path)) {
      return this.pathToString(path);
    }

    if (typeof path !== "string") {
      return String(path);
    }

    let normalizedPath = path;

    // Remove leading dot if present
    if (normalizedPath.startsWith(".")) {
      normalizedPath = normalizedPath.slice(1);
    }

    // Convert bracket notation to dot notation
    normalizedPath = normalizedPath.replaceAll(/\[(\d+)\]/g, ".$1");
    normalizedPath = normalizedPath.replaceAll(/\['([^']+)'\]/g, ".$1");
    normalizedPath = normalizedPath.replaceAll(/\["([^"]+)"\]/g, ".$1");

    return normalizedPath;
  }

  /**
   * Convert path segments array to dot-notation string
   * @param path - Array of path segments
   * @returns Dot-notation path string
   */
  private pathToString(path: PathSegment[]): string {
    return path.map((segment) => String(segment)).join(".");
  }

  /**
   * Convert path segments array to dot-notation string (alias for pathToString)
   * @param path - Array of path segments
   * @returns Dot-notation path string
   */
  private pathToDotNotation(path: PathSegment[]): string {
    return path.map((segment) => String(segment)).join(".");
  }

  /**
   * Convert path segments array to bracket notation string
   * @param path - Array of path segments
   * @returns Bracket-notation path string (e.g., "root['key'][0]")
   */
  private pathToBracketNotation(path: PathSegment[]): string {
    if (path.length === 0) return "";

    const first = path[0];
    const rest = path.slice(1);

    let result = String(first);
    for (const segment of rest) {
      if (typeof segment === "number") {
        result += `[${segment}]`;
      } else {
        result += `['${segment}']`;
      }
    }

    return result;
  }
}

/**
 * Convenience function to parse YAML and create a source map in one operation
 *
 * @param yamlSource - The YAML content to parse
 * @param options - Optional parsing configuration (currently unused but reserved for future features)
 * @returns Object containing both the parsed data and the source map instance
 *
 * @example
 * ```typescript
 * const { data, sourceMap } = parseWithSourceMap(`
 *   database:
 *     host: localhost
 *     port: 5432
 * `);
 *
 * console.log(data.database.host); // "localhost"
 * const location = sourceMap.lookup('database.port');
 * console.log(`Port defined at line ${location.line}`); // "Port defined at line 3"
 * ```
 */
export function parseWithSourceMap(
  yamlSource: string,
  // options?: YamlSourceMapOptions,
): {
  data: unknown;
  sourceMap: YamlSourceMap;
} {
  const sourceMap = new YamlSourceMap();
  const data = sourceMap.parse(yamlSource);

  return { data, sourceMap };
}
