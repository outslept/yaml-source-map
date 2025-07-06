import type { PathInput, PathSegment } from "./types";

export function normalizePath(path: PathInput): string {
  if (Array.isArray(path)) {
    return pathToString(path);
  }

  if (typeof path !== "string") {
    return String(path);
  }

  let normalizedPath = path;

  if (normalizedPath.startsWith(".")) {
    normalizedPath = normalizedPath.slice(1);
  }

  normalizedPath = normalizedPath.replaceAll(/\[(\d+)\]/g, ".$1");
  normalizedPath = normalizedPath.replaceAll(/\['([^']+)'\]/g, ".$1");
  normalizedPath = normalizedPath.replaceAll(/\["([^"]+)"\]/g, ".$1");

  return normalizedPath;
}

export function pathToString(path: PathSegment[]): string {
  return path.map((segment) => String(segment)).join(".");
}

export function pathToDotNotation(path: PathSegment[]): string {
  return path.map((segment) => String(segment)).join(".");
}

export function pathToBracketNotation(path: PathSegment[]): string {
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
