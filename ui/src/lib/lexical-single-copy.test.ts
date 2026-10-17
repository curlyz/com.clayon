import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join, parse } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { describe, expect, it } from "vitest";

const PACKAGE_MANIFEST_SCHEMA = z.object({ version: z.string() });

type PackageManifest = z.infer<typeof PACKAGE_MANIFEST_SCHEMA>;

/**
 * Lexical must resolve to exactly one copy across the app and the rich editor.
 *
 * The editor registers the app's own nodes (mention-aware links, paste
 * handling) into MDXEditor's Lexical instance. If the app and MDXEditor load
 * different copies — or different versions of the same package — Lexical's
 * `LexicalBuilder` invariant throws during render, the editor falls back to
 * its raw-source textarea, and every markdown field in the product silently
 * degrades.
 *
 * That is not hypothetical: root `overrides` once force-pinned the
 * Lexical family past the range `@mdxeditor/editor` supports, while leaving
 * `@lexical/extension` (absent from the override list) on the older line. The
 * mismatch shipped and broke the editor everywhere. These assertions fail
 * fast on the resolution graph instead of waiting for a render crash.
 */
describe("lexical single copy", () => {
  const requireFromUi = createRequire(import.meta.url);
  const mdxEditorEntry = requireFromUi.resolve("@mdxeditor/editor");
  const requireFromMdxEditor = createRequire(mdxEditorEntry);

  /** These packages block "./package.json" in exports, so read it off disk. */
  function manifestOf(specifier: string, from: NodeJS.Require): PackageManifest {
    let dir = dirname(from.resolve(specifier));
    const { root } = parse(dir);
    while (true) {
      let raw: unknown;
      try {
        // Parse inside the try: a malformed manifest is skipped by walking
        // up, exactly like an unreadable one, instead of aborting the walk.
        raw = JSON.parse(readFileSync(join(dir, "package.json"), "utf8"));
      } catch {
        if (dir === root) throw new Error(`no package.json above ${specifier}`);
        dir = dirname(dir);
        continue;
      }
      const parsed = PACKAGE_MANIFEST_SCHEMA.safeParse(raw);
      if (!parsed.success)
        throw new Error(`${join(dir, "package.json")} has no version string`, {
          cause: parsed.error,
        });
      return parsed.data;
    }
  }

  function versionOf(specifier: string, from: NodeJS.Require): string {
    return manifestOf(specifier, from).version;
  }

  /** Walks up from this file to the bun workspace root. */
  function workspaceRoot(): string {
    let dir = dirname(fileURLToPath(import.meta.url));
    const { root } = parse(dir);
    while (!existsSync(join(dir, "bun.lock"))) {
      if (dir === root) throw new Error("could not find the bun workspace root");
      dir = dirname(dir);
    }
    return dir;
  }

  it("keeps the Lexical family out of overrides", () => {
    // An override outranks the range `@mdxeditor/editor` declares, so bun
    // stops guaranteeing that the editor gets a version it supports. It also
    // pins only the packages it names: `@lexical/extension` was reached
    // transitively, never appeared in the list, and stayed a minor behind
    // while the listed packages moved forward. That is what split the graph.
    //
    // With no override, bun honours every declared range, and the copy
    // checks below confirm the app and the editor landed on the same one.
    const manifest = JSON.parse(readFileSync(join(workspaceRoot(), "package.json"), "utf8"));
    const overrides: Record<string, string> = manifest.overrides ?? {};
    const forced = Object.keys(overrides).filter(
      (name) => name === "lexical" || name.startsWith("@lexical/"),
    );
    expect(
      forced,
      "Pin Lexical through ui/package.json instead. An override cannot cover the "
        + "packages it does not name, and it hides the range @mdxeditor/editor declares.",
    ).toEqual([]);
  });

  it("resolves the same lexical copy for the app and the editor", () => {
    expect(requireFromMdxEditor.resolve("lexical")).toBe(requireFromUi.resolve("lexical"));
  });

  it("keeps the app's lexical packages on the editor's version line", () => {
    const core = versionOf("lexical", requireFromUi);
    // @lexical/link carries the mention-aware LinkNode the app subclasses, so
    // a version split here breaks node identity even with one core copy.
    expect(versionOf("@lexical/link", requireFromUi)).toBe(core);
    // bun resolved this copy from the range @mdxeditor/editor declares, and
    // the assertion above rules out an override bypassing that range. So an
    // equal version here also proves the app sits on a line the editor
    // supports, without this test having to parse a semver range itself.
    expect(versionOf("lexical", requireFromMdxEditor)).toBe(core);
    // @lexical/extension owns the LexicalBuilder invariant that throws on a
    // mixed graph, and it is reached transitively rather than declared.
    expect(versionOf("@lexical/extension", requireFromMdxEditor)).toBe(core);
  });
});
