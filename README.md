# yaml-source-map

TypeScript library for parsing YAML with source location tracking.

## Installation

> This is a WIP.

## Quick Start

```typescript
import { YamlSourceMap } from 'yaml-source-map';

const yaml = `
database:
  host: localhost
  port: 5432
  credentials:
    username: admin
    password: secret
`;

const { data, sourceMap } = YamlSourceMap.parseWithSourceMap(yaml);

console.log(data.database.host); // "localhost"

const location = sourceMap.lookup('database.port');
console.log(`Port at line ${location.line}, column ${location.column}`);
// Output: Port at line 4, column 9
```

## Error Reporting

```typescript
const { sourceMap } = YamlSourceMap.parseWithSourceMap(yaml);

const error = sourceMap.createError('Invalid port value', 'database.port');

const location = sourceMap.lookup('database.port');
const lineText = sourceMap.getLineText(location.line);
const pointer = ' '.repeat(location.column - 1) + '^';

console.log(`Line ${location.line}: ${lineText}`);
console.log(`       ${pointer}`);
```

## API

### YamlSourceMap.parseWithSourceMap(yaml)

Parse YAML and create source map.

Returns: `{ document, sourceMap, data }`

### sourceMap.lookup(path)

Find source location for a path.

Returns: `{ line, column, position }` or `undefined`

### sourceMap.getPaths()

Get all paths in the document.

Returns: `string[]`

### sourceMap.getSourceText(location, length?)

Extract source text from location.

### sourceMap.getLineText(lineNumber)

Get complete line text.

### sourceMap.createError(message, path?)

Create YAML parse error with location.

## License

MIT
