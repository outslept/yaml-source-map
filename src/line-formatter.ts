import { colorize } from "./color";
import type { ErrorColors, ErrorDisplayOptions } from "./types";

export class LineFormatter {
  private lines: string[];

  constructor(source: string) {
    this.lines = source.split("\n");
  }

  public formatCodeBlock(
    lineIndex: number,
    column: number,
    opts: Required<ErrorDisplayOptions>,
    colors: ErrorColors,
  ): string {
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

      if (opts.showLineNumbers) {
        const lineNum = String(currentLine).padStart(lineNumWidth, " ");

        if (opts.colorize) {
          const lineNumColor = isErrorLine ? colors.error! : colors.lineNumber!;
          result += `${colorize(lineNumColor, lineNum)} | `;
        } else {
          result += `${lineNum} | `;
        }
      }

      let displayLine = this.truncateLine(
        lineContent,
        column,
        opts.maxLineWidth,
      );

      if (isErrorLine && opts.colorize) {
        displayLine = this.highlightErrorInLine(displayLine, column, colors);
      }

      result += `${displayLine}\n`;

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

    return before + colorize(colors.highlight!, char) + after;
  }

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
      return spaces + colorize(colors.pointer!, pointer);
    } else {
      return spaces + pointer;
    }
  }
}
