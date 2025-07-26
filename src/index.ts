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
} from 'yaml';

export interface SourceLocation {
  readonly line: number;
  readonly column: number;
  readonly position: number;
}

export interface ParseOptions extends YamlParseOptions, DocumentOptions, SchemaOptions {
  readonly keepSourceTokens?: boolean;
  readonly lineCounter?: LineCounter;
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

  static parseWithSourceMap(yamlSource: string, options?: ParseOptions) {
    const sourceMap = new YamlSourceMap(yamlSource, options);
    const document = sourceMap.parseDocument(options);
    return {
      document,
      sourceMap,
      data: document.toJS()
    };
  }

  parseDocument(options: ParseOptions = {}): YamlDocument {
    const doc = parseYamlDocument(this.source, {
      keepSourceTokens: true,
      lineCounter: this.lineCounter,
      ...options
    });

    this.buildSourceMap(doc);
    return doc;
  }

  lookup(path: string): SourceLocation | undefined {
    return this.sourceMap.get(path);
  }

  getPaths(): string[] {
    if (!this.cachedPaths) {
      this.cachedPaths = [...this.sourceMap.keys()].sort();
    }
    return this.cachedPaths;
  }

  getSourceText(location: SourceLocation, length?: number): string {
    return this.source.slice(location.position, length != null ? location.position + length : this.source.length);
  }

  getLineText(lineNumber: number): string {
    return this.source.split('\n')[lineNumber - 1] ?? '';
  }

  createError(message: string, path?: string): YAMLParseError {
    const location = path ? this.lookup(path) : undefined;
    return new YAMLParseError(location ? [location.position, location.position] : [0, 0], 'UNEXPECTED_TOKEN', message);
  }

  private buildSourceMap(doc: YamlDocument): void {
    this.sourceMap.clear();
    this.cachedPaths = undefined;

    if (doc.contents) {
      this.traverseNode(doc.contents, []);
    }
  }

  private traverseNode(node: Node, path: (string | number)[]): void {
    if (!node.range) return;

    const linePos = this.lineCounter.linePos(node.range[0]);
    this.sourceMap.set(path.join('.'), {
      line: linePos.line,
      column: linePos.col,
      position: node.range[0]
    });

    if (isMap(node)) {
      for (const pair of node.items) {
        if (isPair(pair) && pair.key && isScalar(pair.key) && pair.value && isNode(pair.value)) {
          const keyValue = pair.key.value;
          if (keyValue != null) {
            this.traverseNode(pair.value, [...path, String(keyValue)]);
          }
        }
      }
    } else if (isSeq(node)) {
      for (const [index, item] of node.items.entries()) {
        if (item && isNode(item)) {
          this.traverseNode(item, [...path, index]);
        }
      }
    }
  }
}
