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
import {
  normalizePath,
  pathToBracketNotation,
  pathToDotNotation,
  pathToString,
} from "./path";
import {
  getValueAtPath,
  validateCustomRules,
  validatePatterns,
  validateRequiredFields,
  validateTypes,
} from "./validate";
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

  lookup(path: PathInput): SourceLocation | undefined {
    const normalizedPath = normalizePath(path);
    return this.sourceMap.get(normalizedPath);
  }

  getPaths(): string[] {
    return Array.from(this.sourceMap.keys()).sort();
  }

  getSourceText(location: SourceLocation, length?: number): string {
    const start = location.position;
    const end = length ? start + length : this.source.length;
    return this.source.slice(start, end);
  }

  getLineText(lineNumber: number): string {
    const lines = this.source.split("\n");
    return lines[lineNumber - 1] || "";
  }

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

  formatError(error: YamlError, options?: ErrorDisplayOptions): string {
    if (!this.errorFormatter) {
      throw new Error(
        "No source available for error formatting. Call parse() first.",
      );
    }
    return this.errorFormatter.formatError(error, options);
  }

  formatErrors(errors: YamlError[], options?: ErrorDisplayOptions): string {
    if (!this.errorFormatter) {
      throw new Error(
        "No source available for error formatting. Call parse() first.",
      );
    }
    return this.errorFormatter.formatMultipleErrors(errors, options);
  }

  validate(
    schema?: ValidationSchema,
    options?: ErrorDisplayOptions,
  ): ValidationResult {
    const errors: YamlError[] = [];
    const warnings: YamlError[] = [];

    if (schema) {
      this.validateAgainstSchema(schema, errors);
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

  validatePath(
    path: string,
    validator: (value: unknown, location: SourceLocation) => boolean | string,
  ): YamlError | null {
    const location = this.lookup(path);
    if (!location) {
      return this.createError(`Path '${path}' not found`, path, "error");
    }

    const value = getValueAtPath(this.source, path);
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

  private validateAgainstSchema(
    schema: ValidationSchema,
    errors: YamlError[],
  ): void {
    const lookupFn = (path: string) => this.lookup(path);
    const getValueFn = (path: string) => getValueAtPath(this.source, path);
    const createErrorFn = (
      message: string,
      path: string,
      severity: "error" | "warning" | "info",
    ) => this.createError(message, path, severity);

    errors.push(
      ...validateRequiredFields(schema, lookupFn, createErrorFn),
      ...validateTypes(schema, lookupFn, getValueFn, createErrorFn),
      ...validatePatterns(schema, lookupFn, getValueFn, createErrorFn),
      ...validateCustomRules(schema, lookupFn, getValueFn, createErrorFn),
    );
  }

  private buildSourceMap(doc: Document): void {
    if (!doc.contents) return;
    this.traverseNode(doc.contents, []);
  }

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

  private getScalarValue(node: Node): string | number | null {
    if (isScalar(node)) {
      return typeof node.value === "string" || typeof node.value === "number"
        ? node.value
        : String(node.value);
    }
    return null;
  }

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

  private addToSourceMap(path: PathSegment[], node: NodeWithRange): void {
    if (!node.range) return;

    const offset = node.range[0];
    const linePos = this.lineCounter.linePos(offset);

    const location: SourceLocation = {
      line: linePos.line,
      column: linePos.col,
      position: offset,
    };

    const pathString = pathToString(path);
    this.sourceMap.set(pathString, location);

    const dotPath = pathToDotNotation(path);
    if (dotPath !== pathString) {
      this.sourceMap.set(dotPath, location);
    }

    const bracketPath = pathToBracketNotation(path);
    if (bracketPath !== pathString && bracketPath !== dotPath) {
      this.sourceMap.set(bracketPath, location);
    }
  }
}

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
