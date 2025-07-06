# yaml-source-map-x

TypeScript library for parsing YAML with source location tracking and validation capabilities.

## Quick Start

```typescript
import { parseWithSourceMap } from 'yaml-source-map-x';

const yamlContent = `
database:
  host: localhost
  port: 5432
  credentials:
    username: admin
    password: secret
`;

const { data, sourceMap } = parseWithSourceMap(yamlContent);

// Access parsed data
console.log(data.database.host); // "localhost"

// Get source location for any path
const location = sourceMap.lookup('database.port');
console.log(`Port defined at line ${location.line}, column ${location.column}`);
// Output: Port defined at line 4, column 9
```

## Schema Validation

Define validation schemas to ensure your YAML meets requirements:

```typescript
import { YamlSourceMap } from 'yaml-source-map-x';

const sourceMap = new YamlSourceMap();
sourceMap.parse(yamlContent);

const schema = {
  required: ['database.host', 'database.port'],
  types: {
    'database.port': 'number',
    'database.host': 'string',
    'database.credentials': 'object'
  },
  patterns: {
    'database.host': /^[a-z0-9.-]+$/i
  },
  custom: [{
    path: 'database.port',
    validator: (value) => value > 0 && value < 65536,
    message: 'Port must be between 1 and 65535'
  }]
};

const result = sourceMap.validate(schema);
if (!result.valid) {
  console.log(result.formattedErrors);
}
```

## Error Formatting

Get beautifully formatted error messages with source context:

```
ERROR: Expected type 'number' but got 'string' at database.port
line 4, column 9

  2 | database:
  3 |   host: localhost
  4 |   port: "5432"
           ^
  5 |   credentials:
  6 |     username: admin
```

## API Reference

### parseWithSourceMap(yamlSource)

Parse YAML content and create a source map in one operation.

**Parameters:**
- `yamlSource` (string): The YAML content to parse

**Returns:** `{ data: unknown, sourceMap: YamlSourceMap }`

### YamlSourceMap

#### Core Methods

- `parse(yamlSource: string): unknown` - Parse YAML and build source map
- `lookup(path: PathInput): SourceLocation | undefined` - Find source location
- `getPaths(): string[]` - Get all available paths in the document

#### Validation Methods

- `validate(schema?: ValidationSchema): ValidationResult` - Validate against schema
- `validatePath(path: string, validator: Function): YamlError | null` - Validate single path

#### Error Formatting Methods

- `formatError(error: YamlError, options?: ErrorDisplayOptions): string` - Format single error
- `formatErrors(errors: YamlError[], options?: ErrorDisplayOptions): string` - Format multiple errors

#### Utility Methods

- `getSourceText(location: SourceLocation, length?: number): string` - Extract source text
- `getLineText(lineNumber: number): string` - Get complete line text
- `getContext(location: SourceLocation, contextLines?: number): object` - Get surrounding context
- `createError(message: string, path?: string, severity?: string): YamlError` - Create error object

## Type Definitions

### ValidationSchema

```typescript
interface ValidationSchema {
  required?: string[];
  types?: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'object' | 'null'>;
  patterns?: Record<string, RegExp>;
  custom?: Array<{
    path: string;
    validator: (value: unknown) => boolean | string;
    message?: string;
  }>;
}
```

### ErrorDisplayOptions

```typescript
interface ErrorDisplayOptions {
  contextLines?: number;        // Lines of context (default: 2)
  showLineNumbers?: boolean;    // Show line numbers (default: true)
  highlightChar?: string;       // Error pointer character (default: '^')
  maxLineWidth?: number;        // Max line width (default: 120)
  colorize?: boolean;          // Enable colors (default: true)
  showPath?: boolean;          // Show YAML path (default: true)
  showPosition?: boolean;      // Show line/column (default: true)
  showSeverity?: boolean;      // Show error severity (default: true)
  colors?: ErrorColors;        // Custom color scheme
}
```

### SourceLocation

```typescript
interface SourceLocation {
  line: number;      // 1-based line number
  column: number;    // 1-based column number
  position: number;  // 0-based character offset
}
```

### ValidationResult

```typescript
interface ValidationResult {
  valid: boolean;
  errors: YamlError[];
  warnings: YamlError[];
  formattedErrors?: string;
}
```

## Path Formats

The library supports multiple path formats for maximum flexibility:

```typescript
// Dot notation
sourceMap.lookup('database.credentials.username');

// Array notation
sourceMap.lookup(['database', 'credentials', 'username']);

// Bracket notation (arrays)
sourceMap.lookup('users[0].name');

// Bracket notation (objects)
sourceMap.lookup("database['credentials'].username");

// Mixed notation
sourceMap.lookup('servers[0].database.host');
```

## License

MIT
