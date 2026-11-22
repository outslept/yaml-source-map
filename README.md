# yaml-source-map

Parse YAML with source location tracking (`line`, `column`, `position`, `endPosition`) for schema validation and CLI diagnostics.

## Usage

```ts
import { YamlSourceMap } from "yaml-source-map";

const yaml = `database:
  host: localhost
  port: 5432
  credentials:
    username: admin`;

const { data, sourceMap } = YamlSourceMap.parseWithSourceMap(yaml);

// Lookup by dot-separated string or path array (e.g. from Zod / Standard Schema issues)
const loc = sourceMap.lookup(["database", "port"]);
// { line: 3, column: 9, position: 32, endPosition: 36 }
```

## Error Reporting

```ts
const { sourceMap } = YamlSourceMap.parseWithSourceMap(yaml);

const loc = sourceMap.lookup("database.port")!;
const lineText = sourceMap.getLineText(loc.line);
const underline = " ".repeat(loc.column - 1) + "^".repeat(loc.endPosition - loc.position);

console.log(`${loc.line} | ${lineText}`);
console.log(`  | ${underline}`);
```

## API

### `YamlSourceMap.parseWithSourceMap<T>(yaml: string, options?: ParseOptions)`

Parses a YAML string and builds its source map.
Returns `{ document, sourceMap, data: T }`.

### `sourceMap.lookup(path: string | readonly (string | number)[]): SourceLocation | undefined`

Returns `{ line, column, position, endPosition }` (`1`-based `line` and `column`, `0`-based character offsets) or `undefined`.

### `sourceMap.getPaths(): string[]`

Returns all mapped dot-separated paths in sorted order.

### `sourceMap.getSourceText(location: SourceLocation, length?: number): string`

Extracts the node's source text (`position..endPosition`), or `length` characters starting at `location.position`.

### `sourceMap.getLineText(lineNumber: number): string`

Returns the text of the `1`-based line without trailing newline characters.

### `sourceMap.createError(message: string, path?: string | readonly (string | number)[]): YAMLParseError`

Creates a `YAMLParseError` pointing to the token range `[position, endPosition]` (or `[0, 0]` if not found).

## License

MIT
