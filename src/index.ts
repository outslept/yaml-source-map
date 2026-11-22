import {
  parseDocument as parseYamlDocument,
  Document as YamlDocument,
  LineCounter,
  YAMLParseError,
  isMap,
  isSeq,
  isScalar,
  isPair,
  isNode,
  type Node,
  type ParseOptions as YamlParseOptions,
  type DocumentOptions,
  type SchemaOptions,
} from "yaml";

export interface SourceLocation {
  readonly line: number;
  readonly column: number;
  readonly position: number;
  readonly endPosition: number;
}

export type PathInput = string | readonly (string | number)[];

export interface ParseOptions extends YamlParseOptions, DocumentOptions, SchemaOptions {
  readonly lineCounter?: LineCounter;
}

function normalizePath(path: PathInput): string {
  return typeof path === "string" ? path : path.join(".");
}

export class YamlSourceMap {
  private sourceMap = new Map<string, SourceLocation>();
  private source: string;
  private lineCounter: LineCounter;
  private cachedPaths?: string[];

  constructor(yamlSource: string, options: ParseOptions = {}) {
    this.source = yamlSource;
    this.lineCounter = options.lineCounter ?? new LineCounter();
  }

  static parseWithSourceMap<T = unknown>(yamlSource: string, options?: ParseOptions) {
    const sourceMap = new YamlSourceMap(yamlSource, options);
    const document = sourceMap.parseDocument(options);
    return {
      document,
      sourceMap,
      data: document.toJS() as T,
    };
  }

  parseDocument(options: ParseOptions = {}): YamlDocument {
    const doc = parseYamlDocument(this.source, {
      ...options,
      lineCounter: this.lineCounter,
    });
    this.buildSourceMap(doc);
    return doc;
  }

  lookup(path: PathInput): SourceLocation | undefined {
    return this.sourceMap.get(normalizePath(path));
  }

  getPaths(): string[] {
    return (this.cachedPaths ??= [...this.sourceMap.keys()].sort());
  }

  getSourceText(location: SourceLocation, length?: number): string {
    const end = length != null ? location.position + length : location.endPosition;
    return this.source.slice(location.position, end);
  }

  getLineText(lineNumber: number): string {
    const starts = this.lineCounter.lineStarts;
    const idx = lineNumber - 1;
    if (idx < 0 || idx >= starts.length) return "";
    const start = starts[idx]!;
    const nextStart = starts[idx + 1] ?? this.source.length;
    return this.source.slice(start, nextStart).replace(/\r?\n$/, "");
  }

  createError(message: string, path?: PathInput): YAMLParseError {
    const loc = path != null ? this.lookup(path) : undefined;
    return new YAMLParseError(
      loc ? [loc.position, loc.endPosition] : [0, 0],
      "UNEXPECTED_TOKEN",
      message,
    );
  }

  private buildSourceMap(doc: YamlDocument): void {
    this.sourceMap.clear();
    this.cachedPaths = undefined;
    if (doc.contents) {
      this.traverseNode(doc.contents, "");
    }
  }

  private traverseNode(node: Node, prefix: string): void {
    if (!node.range) return;
    const pos = this.lineCounter.linePos(node.range[0]);
    this.sourceMap.set(prefix, {
      line: pos.line,
      column: pos.col,
      position: node.range[0],
      endPosition: node.range[1],
    });

    if (isMap(node)) {
      for (const pair of node.items) {
        if (isPair(pair) && isScalar(pair.key) && pair.key.value != null && isNode(pair.value)) {
          const key = String(pair.key.value);
          this.traverseNode(pair.value, prefix ? `${prefix}.${key}` : key);
        }
      }
    } else if (isSeq(node)) {
      for (let i = 0; i < node.items.length; i++) {
        const item = node.items[i];
        if (isNode(item)) {
          this.traverseNode(item, prefix ? `${prefix}.${i}` : String(i));
        }
      }
    }
  }
}
