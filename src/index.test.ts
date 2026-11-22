import { describe, expect, it } from "vitest";
import { YamlSourceMap } from "./index.js";

describe("YamlSourceMap", () => {
  it("maps nested objects and supports string or array paths", () => {
    const yaml = `foo:\n  bar: "value"\n  baz: 42`;
    const { sourceMap, data } = YamlSourceMap.parseWithSourceMap(yaml);

    expect(data).toEqual({ foo: { bar: "value", baz: 42 } });
    expect(sourceMap.getPaths()).toEqual(["", "foo", "foo.bar", "foo.baz"]);

    expect(sourceMap.lookup("foo.bar")).toEqual({
      line: 2,
      column: 8,
      position: 12,
      endPosition: 19,
    });
    expect(sourceMap.lookup(["foo", "baz"])).toEqual({
      line: 3,
      column: 8,
      position: 27,
      endPosition: 29,
    });
    expect(sourceMap.lookup("foo.missing")).toBeUndefined();
  });

  it("maps sequences and nested items", () => {
    const yaml = `items:\n  - name: alpha\n    value: 100\n  - name: beta\n    value: 200`;
    const { sourceMap, data } = YamlSourceMap.parseWithSourceMap(yaml);

    expect(data).toEqual({
      items: [
        { name: "alpha", value: 100 },
        { name: "beta", value: 200 },
      ],
    });
    expect(sourceMap.getPaths()).toEqual([
      "",
      "items",
      "items.0",
      "items.0.name",
      "items.0.value",
      "items.1",
      "items.1.name",
      "items.1.value",
    ]);
    expect(sourceMap.lookup(["items", 1, "name"])).toEqual({
      line: 4,
      column: 11,
      position: 48,
      endPosition: 52,
    });
    expect(sourceMap.lookup("items.2")).toBeUndefined();
  });

  it("creates YAMLParseError with token range or fallback position", () => {
    const yaml = `server:\n  port: 8080`;
    const { sourceMap } = YamlSourceMap.parseWithSourceMap(yaml);

    const err = sourceMap.createError("Invalid port value", ["server", "port"]);
    expect(err.code).toBe("UNEXPECTED_TOKEN");
    expect(err.pos).toEqual([16, 20]);
    expect(err.message).toContain("Invalid port value");

    const missingErr = sourceMap.createError("Missing", "unknown.path");
    expect(missingErr.pos).toEqual([0, 0]);

    const generalErr = sourceMap.createError("General error");
    expect(generalErr.pos).toEqual([0, 0]);
  });

  it("extracts node source text and individual lines (LF and CRLF)", () => {
    const yaml = `foo: "test value"\r\nsecond: line`;
    const { sourceMap } = YamlSourceMap.parseWithSourceMap(yaml);

    const loc = sourceMap.lookup("foo")!;
    expect(sourceMap.getSourceText(loc)).toBe('"test value"');
    expect(sourceMap.getSourceText(loc, 6)).toBe('"test ');

    expect(sourceMap.getLineText(1)).toBe('foo: "test value"');
    expect(sourceMap.getLineText(2)).toBe("second: line");
    expect(sourceMap.getLineText(0)).toBe("");
    expect(sourceMap.getLineText(-1)).toBe("");
    expect(sourceMap.getLineText(999)).toBe("");
  });

  it("handles empty and comment-only documents", () => {
    const empty = YamlSourceMap.parseWithSourceMap("");
    expect(empty.data).toBeNull();
    expect(empty.sourceMap.getPaths()).toEqual([]);

    const comments = YamlSourceMap.parseWithSourceMap("# comment only");
    expect(comments.data).toBeNull();
    expect(comments.sourceMap.getPaths()).toEqual([]);
  });
});
