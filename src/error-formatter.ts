import ansis from "ansis";
import type { ErrorColors, ErrorDisplayOptions, YamlError } from "./types";

const DEFAULT_COLORS: ErrorColors = {
  error: "red",
  warning: "yellow",
  info: "blue",
  lineNumber: "dim",
  pointer: "red",
  highlight: "bgRed",
  context: "dim",
  path: "cyan",
  position: "dim",
};

const DEFAULT_OPTIONS: Required<ErrorDisplayOptions> = {
  contextLines: 2,
  showLineNumbers: true,
  highlightChar: "^",
  maxLineWidth: 120,
  colorize: true,
  showPath: true,
  showPosition: true,
  showSeverity: true,
  indentSize: 2,
  lineNumberPadding: 1,
  colors: DEFAULT_COLORS,
};

export class YamlErrorFormatter {
  /** Source lines split for efficient line-by-line access during formatting */
  private lines: string[];

  /**
   * Initialize the formatter with YAML source content
   * @param source - The original YAML source text for context display
   */
  constructor(source: string) {
    this.lines = source.split("\n");
  }

  /**
   * Format a single YAML error with optional source context and highlighting
   * @param error - The error to format
   * @param options - Display customization options
   * @returns Formatted error string ready for console output
   */
  formatError(error: YamlError, options: ErrorDisplayOptions = {}): string {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const colors = { ...DEFAULT_COLORS, ...opts.colors };

    if (!error.location) {
      return this.formatSimpleError(error, opts, colors);
    }

    return this.formatDetailedError(error, opts, colors);
  }

  /**
   * Format multiple errors with a summary header showing total counts by severity
   * @param errors - Array of errors to format
   * @param options - Display customization options applied to all errors
   * @returns Formatted string with summary and all individual errors
   */
  formatMultipleErrors(
    errors: YamlError[],
    options: ErrorDisplayOptions = {},
  ): string {
    if (errors.length === 0) return "";

    const opts = { ...DEFAULT_OPTIONS, ...options };
    const colors = { ...DEFAULT_COLORS, ...opts.colors };

    let result = "";

    const errorCount = errors.filter((e) => e.severity === "error").length;
    const warningCount = errors.filter((e) => e.severity === "warning").length;
    const infoCount = errors.filter((e) => e.severity === "info").length;

    const summary = this.formatSummary(
      errorCount,
      warningCount,
      infoCount,
      opts,
      colors,
    );
    result += `${summary}\n\n`;

    errors.forEach((error, index) => {
      if (index > 0) result += "\n";
      result += this.formatError(error, options);
    });

    return result;
  }

  /**
   * Apply ansis color formatting to text
   * @param color - ansis color name (e.g., 'red', 'bgRed', 'dim')
   * @param text - Text to colorize
   * @returns Colorized text with ANSI escape codes
   */
  private colorize(color: string, text: string): string {
    return (ansis as any)[color](text);
  }

  /**
   * Format errors that don't have source location information
   * @param error - Error without location data
   * @param opts - Complete formatting options
   * @param colors - Color scheme configuration
   * @returns Simple formatted error message
   */
  private formatSimpleError(
    error: YamlError,
    opts: Required<ErrorDisplayOptions>,
    colors: ErrorColors,
  ): string {
    const fullErrorText = this.buildFullErrorText(error, opts);

    if (opts.colorize) {
      const severityColor = this.getSeverityColor(
        error.severity || "error",
        colors,
      );
      return this.colorize(severityColor, fullErrorText);
    }

    return fullErrorText;
  }

  /**
   * Format errors with source location, including context lines and error pointer
   * @param error - Error with location information
   * @param opts - Complete formatting options
   * @param colors - Color scheme configuration
   * @returns Detailed formatted error with source context
   */
  private formatDetailedError(
    error: YamlError,
    opts: Required<ErrorDisplayOptions>,
    colors: ErrorColors,
  ): string {
    const { line, column } = error.location!;
    const lineIndex = line - 1;

    let result = "";

    // Format error header
    const header = this.buildFullErrorText(error, opts);
    if (opts.colorize) {
      const severityColor = this.getSeverityColor(
        error.severity || "error",
        colors,
      );
      result += `${this.colorize(severityColor, header)}\n`;
    } else {
      result += `${header}\n`;
    }

    // Add position information
    if (opts.showPosition) {
      const position = this.formatPosition(line, column, opts, colors);
      result += `${position}\n`;
    }

    result += "\n";

    // Add source code context
    const codeBlock = this.formatCodeBlock(error, lineIndex, opts, colors);
    result += codeBlock;

    return result;
  }

  /**
   * Build the main error message text with severity, code, message, and path
   * @param error - Error object to format
   * @param opts - Formatting options
   * @returns Complete error message string
   */
  private buildFullErrorText(
    error: YamlError,
    opts: Required<ErrorDisplayOptions>,
  ): string {
    let result = "";

    if (opts.showSeverity) {
      result += (error.severity || "error").toUpperCase();
    }

    result += error.message;

    if (error.path && opts.showPath) {
      result += ` at ${error.path}`;
    }

    return result;
  }

  /**
   * Get the appropriate color for a given severity level
   * @param severity - Error severity level
   * @param colors - Color scheme configuration
   * @returns ansis color name for the severity
   */
  private getSeverityColor(severity: string, colors: ErrorColors): string {
    switch (severity) {
      case "error":
        return colors.error!;
      case "warning":
        return colors.warning!;
      case "info":
        return colors.info!;
      default:
        return colors.error!;
    }
  }

  /**
   * Format line and column position information
   * @param line - Line number (1-based)
   * @param column - Column number (1-based)
   * @param opts - Formatting options
   * @param colors - Color scheme configuration
   * @returns Formatted position string
   */
  private formatPosition(
    line: number,
    column: number,
    opts: Required<ErrorDisplayOptions>,
    colors: ErrorColors,
  ): string {
    const lineText = opts.colorize
      ? this.colorize(colors.position!, `line ${line}`)
      : `line ${line}`;
    const columnText = opts.colorize
      ? this.colorize(colors.position!, `column ${column}`)
      : `column ${column}`;

    return `${lineText}, ${columnText}`;
  }

  /**
   * Format the source code block with context lines, line numbers, and error highlighting
   * @param error - Error with location information
   * @param lineIndex - Zero-based line index of the error
   * @param opts - Formatting options
   * @param colors - Color scheme configuration
   * @returns Formatted code block with context and error pointer
   */
  private formatCodeBlock(
    error: YamlError,
    lineIndex: number,
    opts: Required<ErrorDisplayOptions>,
    colors: ErrorColors,
  ): string {
    const { column } = error.location!;
    const startLine = Math.max(0, lineIndex - opts.contextLines);
    const endLine = Math.min(
      this.lines.length - 1,
      lineIndex + opts.contextLines,
    );
    const maxLineNum = endLine + 1;
    const lineNumWidth = String(maxLineNum).length + opts.lineNumberPadding;

    let result = "";

    for (let i = startLine; i <= endLine; i++) {
      const currentLine = i + 1;
      const lineContent = this.lines[i] || "";
      const isErrorLine = i === lineIndex;

      // Add line numbers if enabled
      if (opts.showLineNumbers) {
        const lineNum = String(currentLine).padStart(lineNumWidth, " ");

        if (opts.colorize) {
          const lineNumColor = isErrorLine ? colors.error! : colors.lineNumber!;
          result += `${this.colorize(lineNumColor, lineNum)} | `;
        } else {
          result += `${lineNum} | `;
        }
      }

      let displayLine = this.truncateLine(
        lineContent,
        column,
        opts.maxLineWidth,
      );

      // Highlight the specific error character
      if (isErrorLine && opts.colorize) {
        displayLine = this.highlightErrorInLine(displayLine, column, colors);
      }

      result += `${displayLine}\n`;

      // Add error pointer below the error line
      if (isErrorLine) {
        const pointer = this.formatErrorPointer(
          column,
          lineNumWidth,
          opts,
          colors,
        );
        result += `${pointer}\n`;
      }
    }

    return result;
  }

  /**
   * Truncate long lines to fit within the maximum width, keeping the error position visible
   * @param line - Source line content
   * @param errorColumn - Column where the error occurs
   * @param maxWidth - Maximum line width before truncation
   * @returns Truncated line with ellipsis indicators if needed
   */
  private truncateLine(
    line: string,
    errorColumn: number,
    maxWidth: number,
  ): string {
    if (!maxWidth || line.length <= maxWidth) {
      return line;
    }

    const halfWidth = Math.floor(maxWidth / 2);
    const start = Math.max(0, errorColumn - halfWidth);
    const end = start + maxWidth;

    let result = line.slice(start, end);

    if (start > 0) {
      result = `…${result.slice(1)}`;
    }

    if (end < line.length) {
      result = `${result.slice(0, -1)}…`;
    }

    return result;
  }

  /**
   * Highlight the specific character where the error occurs with background color
   * @param line - Source line content
   * @param column - Column position of the error (1-based)
   * @param colors - Color scheme configuration
   * @returns Line with the error character highlighted
   */
  private highlightErrorInLine(
    line: string,
    column: number,
    colors: ErrorColors,
  ): string {
    if (column <= 0 || column > line.length) {
      return line;
    }

    const char = line[column - 1];
    const before = line.slice(0, column - 1);
    const after = line.slice(column);

    return before + this.colorize(colors.highlight!, char) + after;
  }

  /**
   * Format the error pointer that appears below the error line
   * @param column - Column position for the pointer (1-based)
   * @param lineNumWidth - Width of the line number column for alignment
   * @param opts - Formatting options
   * @param colors - Color scheme configuration
   * @returns Formatted pointer string with proper spacing
   */
  private formatErrorPointer(
    column: number,
    lineNumWidth: number,
    opts: Required<ErrorDisplayOptions>,
    colors: ErrorColors,
  ): string {
    const lineNumberSpace = opts.showLineNumbers ? lineNumWidth + 3 : 0;
    const spaces = " ".repeat(lineNumberSpace + Math.max(0, column - 1));
    const pointer = opts.highlightChar;

    if (opts.colorize) {
      return spaces + this.colorize(colors.pointer!, pointer);
    } else {
      return spaces + pointer;
    }
  }

  /**
   * Format a summary line showing counts of errors, warnings, and info messages
   * @param errorCount - Number of errors
   * @param warningCount - Number of warnings
   * @param infoCount - Number of info messages
   * @param opts - Formatting options
   * @param colors - Color scheme configuration
   * @returns Formatted summary string
   */
  private formatSummary(
    errorCount: number,
    warningCount: number,
    infoCount: number,
    opts: Required<ErrorDisplayOptions>,
    colors: ErrorColors,
  ): string {
    const parts: string[] = [];

    if (errorCount > 0) {
      const text = `${errorCount} error${errorCount > 1 ? "s" : ""}`;
      parts.push(opts.colorize ? this.colorize(colors.error!, text) : text);
    }

    if (warningCount > 0) {
      const text = `${warningCount} warning${warningCount > 1 ? "s" : ""}`;
      parts.push(opts.colorize ? this.colorize(colors.warning!, text) : text);
    }

    if (infoCount > 0) {
      const text = `${infoCount} info`;
      parts.push(opts.colorize ? this.colorize(colors.info!, text) : text);
    }

    const summary = parts.join(", ");
    return `Found ${summary}`;
  }
}
