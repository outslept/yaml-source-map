import { colorize, DEFAULT_COLORS, getSeverityColor } from "./color";
import { LineFormatter } from "./line-formatter";
import type { ErrorColors, ErrorDisplayOptions, YamlError } from "./types";

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
  private lineFormatter: LineFormatter;

  constructor(source: string) {
    this.lineFormatter = new LineFormatter(source);
  }

  formatError(error: YamlError, options: ErrorDisplayOptions = {}): string {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const colors = { ...DEFAULT_COLORS, ...opts.colors };

    if (!error.location) {
      return this.formatSimpleError(error, opts, colors);
    }

    return this.formatDetailedError(error, opts, colors);
  }

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

  private formatSimpleError(
    error: YamlError,
    opts: Required<ErrorDisplayOptions>,
    colors: ErrorColors,
  ): string {
    const fullErrorText = this.buildFullErrorText(error, opts);

    if (opts.colorize) {
      const severityColor = getSeverityColor(error.severity || "error", colors);
      return colorize(severityColor, fullErrorText);
    }

    return fullErrorText;
  }

  private formatDetailedError(
    error: YamlError,
    opts: Required<ErrorDisplayOptions>,
    colors: ErrorColors,
  ): string {
    const { line, column } = error.location!;
    const lineIndex = line - 1;

    let result = "";

    const header = this.buildFullErrorText(error, opts);
    if (opts.colorize) {
      const severityColor = getSeverityColor(error.severity || "error", colors);
      result += `${colorize(severityColor, header)}\n`;
    } else {
      result += `${header}\n`;
    }

    if (opts.showPosition) {
      const position = this.formatPosition(line, column, opts, colors);
      result += `${position}\n`;
    }

    result += "\n";

    const codeBlock = this.lineFormatter.formatCodeBlock(
      lineIndex,
      column,
      opts,
      colors,
    );
    result += codeBlock;

    return result;
  }

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

  private formatPosition(
    line: number,
    column: number,
    opts: Required<ErrorDisplayOptions>,
    colors: ErrorColors,
  ): string {
    const lineText = opts.colorize
      ? colorize(colors.position!, `line ${line}`)
      : `line ${line}`;
    const columnText = opts.colorize
      ? colorize(colors.position!, `column ${column}`)
      : `column ${column}`;

    return `${lineText}, ${columnText}`;
  }

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
      parts.push(opts.colorize ? colorize(colors.error!, text) : text);
    }

    if (warningCount > 0) {
      const text = `${warningCount} warning${warningCount > 1 ? "s" : ""}`;
      parts.push(opts.colorize ? colorize(colors.warning!, text) : text);
    }

    if (infoCount > 0) {
      const text = `${infoCount} info`;
      parts.push(opts.colorize ? colorize(colors.info!, text) : text);
    }

    const summary = parts.join(", ");
    return `Found ${summary}`;
  }
}
