# yaml-source-map-x

Experiments with replacting the unmaintained [`yaml-source-map`](https://www.npmjs.com/package/yaml-source-map) library.

## Quick Start

```typescript
import { parseWithSourceMap } from 'yaml-source-map-x';

const yamlContent = `
database:
  host: localhost
  port: 5432
  credentials:
    username: admin
`;

const { data, sourceMap } = parseWithSourceMap(yamlContent);

// Get parsed data
console.log(data.database.host); // "localhost"

// Find source location
const location = sourceMap.lookup('database.port');
console.log(`Port defined at line ${location.line}, column ${location.column}`);
```

## Validation

```typescript
import { YamlSourceMap } from 'yaml-source-map-x';

const sourceMap = new YamlSourceMap();
sourceMap.parse(yamlContent);

const schema = {
  required: ['database.host', 'database.port'],
  types: {
    'database.port': 'number',
    'database.host': 'string'
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

### parseWithSourceMap(yamlSource, options?)

**Parameters:**
- `yamlSource` (string): YAML content to parse
- `options` (YamlSourceMapOptions, optional): Parsing options

**Returns:** Object with `data` and `sourceMap` properties

### YamlSourceMap

#### Methods

- `parse(yamlSource: string): unknown` - Parse YAML and build source map
- `lookup(path: string | string[]): SourceLocation | undefined` - Find source location for a path
- `validate(schema?: ValidationSchema): ValidationResult` - Validate against schema
- `formatError(error: YamlError): string` - Format single error
- `formatErrors(errors: YamlError[]): string` - Format multiple errors
- `getPaths(): string[]` - Get all available paths
- `getContext(location: SourceLocation): object` - Get surrounding lines

### ValidationSchema

```typescript
interface ValidationSchema {
  required?: string[];
  types?: Record<string, 'string' | 'number' | 'boolean' | 'array' | 'object'>;
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
  contextLines?: number;        // Lines of context around errors
  showLineNumbers?: boolean;    // Show line numbers
  highlightChar?: string;       // Character for error pointer
  maxLineWidth?: number;        // Maximum line width
  colorize?: boolean;          // Enable color output
  showPath?: boolean;          // Show YAML path in errors
  showPosition?: boolean;      // Show line/column info
  colors?: ErrorColors;        // Custom color scheme
}
```

## Path Formats

```typescript
// Dot notation
sourceMap.lookup('database.credentials.username');

// Array notation
sourceMap.lookup(['database', 'credentials', 'username']);

// Bracket notation
sourceMap.lookup('database[0].name');
sourceMap.lookup("database['credentials'].username");
```

## License

MIT
