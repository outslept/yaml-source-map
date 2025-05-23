export interface SourceLocation {
  /** Line number in the source file (1-based) */
  line: number;
  /** Column number within the line (1-based) */
  column: number;
  /** Absolute character position from the start of the file (0-based) */
  position: number;
}

export interface YamlSourceMapOptions {
  /** Whether to include comment nodes in the source map */
  includeComments?: boolean;
  /** Whether to include whitespace nodes in the source map */
  includeWhitespace?: boolean;
}

export type PathSegment = string | number;
export type PathArray = PathSegment[];
export type PathInput = string | PathArray;

export interface YamlError {
  /** Human-readable error message describing the issue */
  message: string;
  /** Optional dot-notation path to the problematic YAML node */
  path?: string;
  /** Source location where the error occurred, if available */
  location?: SourceLocation;
  /** Severity level of the issue */
  severity?: "error" | "warning" | "info";
  /** Optional error code for programmatic handling */
  code?: string;
}

export interface ErrorDisplayOptions {
  /** Number of context lines to show before and after the error line */
  contextLines?: number;
  /** Whether to display line numbers in the code block */
  showLineNumbers?: boolean;
  /** Character used to point to the exact error location */
  highlightChar?: string;
  /** Maximum width for displayed lines before truncation */
  maxLineWidth?: number;
  /** Whether to apply color formatting to the output */
  colorize?: boolean;
  /** Whether to show the YAML path in error messages */
  showPath?: boolean;
  /** Whether to display line and column position information */
  showPosition?: boolean;
  /** Whether to show the severity level (ERROR, WARNING, INFO) */
  showSeverity?: boolean;
  /** Number of spaces for indentation in formatted output */
  indentSize?: number;
  /** Extra padding around line numbers for alignment */
  lineNumberPadding?: number;
  /** Custom color scheme for different error elements */
  colors?: ErrorColors;
}

export interface ErrorColors {
  /** Color for error severity messages and error line numbers */
  error?: string;
  /** Color for warning severity messages */
  warning?: string;
  /** Color for info severity messages */
  info?: string;
  /** Color for non-error line numbers in context */
  lineNumber?: string;
  /** Color for the error pointer character (^) */
  pointer?: string;
  /** Background color for highlighting the exact error character */
  highlight?: string;
  /** Color for context lines around the error */
  context?: string;
  /** Color for displaying YAML paths in error messages */
  path?: string;
  /** Color for line and column position information */
  position?: string;
  /** Color for helpful hint messages */
  hint?: string;
}

export interface ValidationSchema {
  /** Array of required YAML paths that must exist */
  required?: string[];
  /** Expected data types for specific YAML paths */
  types?: Record<string, "string" | "number" | "boolean" | "array" | "object">;
  /** Regular expression patterns that string values must match */
  patterns?: Record<string, RegExp>;
  /** Custom validation functions for complex business logic */
  custom?: Array<{
    /** YAML path to validate */
    path: string;
    /**
     * Validation function that returns true for valid values,
     * false for invalid, or a string error message
     */
    validator: (value: unknown) => boolean | string;
    /** Optional custom error message for validation failures */
    message?: string;
  }>;
}

export interface ValidationResult {
  /** Whether the YAML passed all validation checks */
  valid: boolean;
  /** Array of validation errors that prevent the YAML from being valid */
  errors: YamlError[];
  /** Array of validation warnings that don't affect validity */
  warnings: YamlError[];
  /** Pre-formatted string containing all errors and warnings for display */
  formattedErrors?: string;
}
