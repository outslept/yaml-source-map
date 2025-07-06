import pc from "picocolors";
import type { ErrorColors } from "./types";

export const DEFAULT_COLORS: ErrorColors = {
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

export function colorize(color: string, text: string): string {
  switch (color) {
    case "red":
      return pc.red(text);
    case "yellow":
      return pc.yellow(text);
    case "blue":
      return pc.blue(text);
    case "green":
      return pc.green(text);
    case "cyan":
      return pc.cyan(text);
    case "magenta":
      return pc.magenta(text);
    case "white":
      return pc.white(text);
    case "gray":
      return pc.gray(text);
    case "dim":
      return pc.dim(text);
    case "bold":
      return pc.bold(text);
    case "italic":
      return pc.italic(text);
    case "underline":
      return pc.underline(text);
    case "strikethrough":
      return pc.strikethrough(text);
    case "inverse":
      return pc.inverse(text);
    case "bgRed":
      return pc.bgRed(text);
    case "bgYellow":
      return pc.bgYellow(text);
    case "bgBlue":
      return pc.bgBlue(text);
    case "bgGreen":
      return pc.bgGreen(text);
    case "bgCyan":
      return pc.bgCyan(text);
    case "bgMagenta":
      return pc.bgMagenta(text);
    case "bgWhite":
      return pc.bgWhite(text);
    case "bgBlack":
      return pc.bgBlack(text);
    default:
      return text;
  }
}

export function getSeverityColor(
  severity: string,
  colors: ErrorColors,
): string {
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
