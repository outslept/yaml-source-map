import { describe, it, expect } from 'vitest';
import { YamlSourceMap } from './index';

describe('YamlSourceMap', () => {
  it.each([
    {
      name: 'nested objects',
      yaml: `foo:
  bar: "value"
  baz: 42`,
      expectedPaths: ['foo', 'foo.bar', 'foo.baz'],
      lookupTests: [
        { path: 'foo.bar', shouldExist: true },
        { path: 'foo.missing', shouldExist: false }
      ]
    },
    {
      name: 'arrays',
      yaml: `items:
  - name: alpha
    value: 100
  - name: beta
    value: 200`,
      expectedPaths: ['items', 'items.0', 'items.0.name', 'items.0.value', 'items.1', 'items.1.name', 'items.1.value'],
      lookupTests: [
        { path: 'items.0.name', shouldExist: true },
        { path: 'items.2', shouldExist: false }
      ]
    }
  ])('parses $name correctly', ({ yaml, expectedPaths, lookupTests }) => {
    const result = YamlSourceMap.parseWithSourceMap(yaml);
    const { sourceMap, data } = result;

    expect({
      data,
      paths: sourceMap.getPaths(),
      pathCount: sourceMap.getPaths().length
    }).toMatchSnapshot();

    expect(sourceMap.getPaths()).toEqual(expect.arrayContaining(expectedPaths));

    lookupTests.forEach(({ path, shouldExist }) => {
      const location = sourceMap.lookup(path);
      expect(!!location).toBe(shouldExist);
    });
  });

  it.each([
    {
      name: 'valid path',
      yaml: `server:
  port: 8080`,
      path: 'server.port',
      message: 'Invalid port value'
    },
    {
      name: 'nested path',
      yaml: `database:
  credentials:
    username: admin`,
      path: 'database.credentials.username',
      message: 'Invalid username format'
    },
    {
      name: 'nonexistent path',
      yaml: `foo: bar`,
      path: 'nonexistent.path',
      message: 'Path does not exist'
    },
    {
      name: 'no path',
      yaml: `foo: bar`,
      path: undefined,
      message: 'General error'
    }
  ])('creates error $name', ({ yaml, path, message }) => {
    const result = YamlSourceMap.parseWithSourceMap(yaml);
    const { sourceMap } = result;

    const error = sourceMap.createError(message, path);
    const location = path ? sourceMap.lookup(path) : undefined;

    expect({
      message: error.message,
      position: error.pos,
      code: error.code,
      hasLocation: !!location,
      lineNumber: location?.line
    }).toMatchSnapshot();
  });

  it.each([
    {
      name: 'source text with length',
      yaml: `foo: "test value"`,
      path: 'foo',
      length: 5,
      expectTruncated: true
    },
    {
      name: 'source text without length',
      yaml: `foo: "test value"`,
      path: 'foo',
      length: undefined,
      expectTruncated: false
    },
    {
      name: 'line text valid line',
      yaml: `first: line
second: line`,
      lineNumber: 2,
      expectedText: 'second: line'
    },
    {
      name: 'line text invalid line',
      yaml: `foo: bar`,
      lineNumber: 999,
      expectedText: ''
    },
    {
      name: 'line text zero line',
      yaml: `foo: bar`,
      lineNumber: 0,
      expectedText: ''
    },
    {
      name: 'line text negative line',
      yaml: `foo: bar`,
      lineNumber: -1,
      expectedText: ''
    }
  ])('handles $name', ({ yaml, path, length, expectTruncated, lineNumber, expectedText }) => {
    const result = YamlSourceMap.parseWithSourceMap(yaml);
    const { sourceMap } = result;

    if (path) {
      const location = sourceMap.lookup(path);
      expect(location).toBeDefined();

      const sourceText = sourceMap.getSourceText(location!, length);

      expect({
        path,
        sourceText,
        hasLength: length !== undefined,
        isTruncated: expectTruncated ? sourceText.length === length : sourceText.includes(yaml.slice(location!.position))
      }).toMatchSnapshot();
    }

    if (lineNumber !== undefined) {
      const lineText = sourceMap.getLineText(lineNumber);
      expect(lineText).toBe(expectedText);
    }
  });

  it('handles empty document', () => {
    const result = YamlSourceMap.parseWithSourceMap('');
    const { sourceMap, data } = result;

    expect({
      data,
      paths: sourceMap.getPaths(),
      pathCount: sourceMap.getPaths().length
    }).toMatchSnapshot();
  });

  it('handles document with null content', () => {
    const result = YamlSourceMap.parseWithSourceMap('# comment only');
    const { sourceMap, data } = result;

    expect({
      data,
      paths: sourceMap.getPaths(),
      pathCount: sourceMap.getPaths().length
    }).toMatchSnapshot();
  });

  it('formats error with code context like IDE', () => {
    const yaml = `name: "MyApp"
version: "1.0.0"
database:
  host: "localhost"
  port: "invalid_port"
  timeout: -5
config:
  servers:
    - name: "web-01"
      memory: "bad_format"
    - name: "web-02"
      cpu: "invalid"`;

    const result = YamlSourceMap.parseWithSourceMap(yaml);
    const { sourceMap } = result;

    const validationErrors = [
      { path: 'database.port', message: 'Port must be numeric' },
      { path: 'database.timeout', message: 'Timeout cannot be negative' },
      { path: 'config.servers.0.memory', message: 'Invalid memory format' },
      { path: 'config.servers.1.cpu', message: 'Invalid CPU specification' }
    ];

    const lines = yaml.split('\n');

    const formattedErrors = validationErrors.map(({ path, message }) => {
      const location = sourceMap.lookup(path);
      if (!location) return null;

      const lineNumber = location.line;
      const column = location.column;

      const contextLines = [];
      const startLine = Math.max(1, lineNumber - 2);
      const endLine = Math.min(lines.length, lineNumber + 2);

      for (let i = startLine; i <= endLine; i++) {
        const lineContent = lines[i - 1] || '';
        const linePrefix = i === lineNumber ? '>' : ' ';
        const paddedLineNum = String(i).padStart(3);
        contextLines.push(`${linePrefix} ${paddedLineNum} | ${lineContent}`);

        if (i === lineNumber) {
          const pointer = ' '.repeat(7 + column - 1) + '^';
          contextLines.push(`    ${pointer}`);
        }
      }

      return {
        path,
        message,
        location: `${lineNumber}:${column}`,
        context: contextLines.join('\n')
      };
    }).filter(Boolean);

    expect(formattedErrors).toMatchSnapshot();
  });
});
