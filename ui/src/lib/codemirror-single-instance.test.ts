import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { z } from "zod";
import { describe, expect, it } from "vitest";

// CodeMirror validates extensions with instanceof, and Lezer allocates
// NodeProp IDs within each module instance. The installed graph must contain
// one physical copy of their shared primitives. Duplicates can crash extension
// validation or read unrelated syntax metadata as highlighting tags.
// The overrides entries in the root package.json hold the graph to a
// single resolution; this file pins that invariant against the graph the
// current install actually resolved, so it holds wherever the tests run —
// CI (which installs from the lockfile it regenerates for the PR) and
// local checkouts alike.
const SINGLE_INSTANCE_PACKAGES = [
  ["@codemirror/state", 6],
  ["@codemirror/view", 6],
  ["@lezer/common", 1],
] as const;

const repoRoot = path.resolve(__dirname, "../../..");
const uiRoot = path.resolve(__dirname, "../..");
const uiRequire = createRequire(path.join(uiRoot, "package.json"));
const editorRequire = createRequire(uiRequire.resolve("@mdxeditor/editor"));
const languagesRequire = createRequire(editorRequire.resolve("@codemirror/language-data"));
const languageRequire = createRequire(languagesRequire.resolve("@codemirror/language"));
const ROOT_MANIFEST_SCHEMA = z.object({
  overrides: z.record(z.string(), z.unknown()).optional(),
});

type RootManifest = z.infer<typeof ROOT_MANIFEST_SCHEMA>;

const parsedRootManifest = ROOT_MANIFEST_SCHEMA.safeParse(
  JSON.parse(readFileSync(path.join(repoRoot, "package.json"), "utf8")),
);
const rootManifest: RootManifest = parsedRootManifest.success ? parsedRootManifest.data : {};

/**
 * Every physical copy of `target` reachable from the ui package's
 * installed graph. Bun installs with the isolated linker (root
 * `bunfig.toml`), so the store lives in `node_modules/.bun/<pkg>+<ver>`
 * buckets and install entries are symlinks into them; a bucket's own
 * dependencies sit in its private `node_modules`, and a bucket package's
 * shared ancestors resolve through the parent node_modules check below.
 * The walk realpaths every link, so each resolved version collapses to
 * one path. Walking from the ui roots keeps the census to the graph the
 * ui package actually resolves.
 */
function reachableCopies(target: string): string[] {
  const copies = new Set<string>();
  const visited = new Set<string>();
  const queue: string[] = [uiRoot];

  const packageEntries = (nodeModulesDir: string): string[] => {
    const entries: string[] = [];
    for (const name of readdirSync(nodeModulesDir)) {
      if (name.startsWith(".")) continue;
      if (name.startsWith("@")) {
        const scopeDir = path.join(nodeModulesDir, name);
        for (const child of readdirSync(scopeDir)) {
          if (!child.startsWith(".")) entries.push(`${name}/${child}`);
        }
      } else {
        entries.push(name);
      }
    }
    return entries;
  };

  while (queue.length > 0) {
    const packageDir = queue.shift()!;
    if (visited.has(packageDir)) continue;
    visited.add(packageDir);
    if (visited.size > 20_000) {
      throw new Error("dependency walk exceeded its safety bound");
    }

    // A package's dependencies live in its own node_modules (workspace
    // packages, and the private node_modules inside an isolated-linker
    // `.bun` bucket) and in the ancestor node_modules whose symlinks
    // resolve into the store.
    const dependencyDirs = [path.join(packageDir, "node_modules")];
    const parent = path.dirname(packageDir);
    const grandparent = path.dirname(parent);
    if (path.basename(parent) === "node_modules") {
      dependencyDirs.push(parent);
    } else if (path.basename(grandparent) === "node_modules") {
      dependencyDirs.push(grandparent); // scoped package
    }

    for (const dependencyDir of dependencyDirs) {
      if (!existsSync(dependencyDir)) continue;
      for (const entry of packageEntries(dependencyDir)) {
        let entryDir: string;
        try {
          entryDir = realpathSync(path.join(dependencyDir, entry));
        } catch {
          continue; // dangling symlink
        }
        if (entry === target) copies.add(entryDir);
        queue.push(entryDir);
      }
    }
  }
  return [...copies];
}

describe("codemirror single-instance invariant", () => {
  for (const [pkg, major] of SINGLE_INSTANCE_PACKAGES) {
    it(`keeps the ${pkg} override in the root manifest`, () => {
      // Removing the override is the only way a second copy can come
      // back (an override rewrites every dependent's range), so the
      // override's presence is the other half of the invariant.
      expect(
        rootManifest.overrides?.[pkg],
        `${pkg} must stay in overrides (root package.json); without ` +
          "it the graph can resolve two copies and shared editor " +
          "primitives no longer have the same identity.",
      ).toMatch(new RegExp(`^\\^${major}\\.`));
    });

    it(`installs exactly one physical copy of ${pkg}`, () => {
      const copies = reachableCopies(pkg);
      expect(
        copies.length,
        `${pkg} is not installed anywhere in the ui graph`,
      ).toBeGreaterThan(0);
      expect(
        copies,
        `the installed graph carries multiple physical copies of ${pkg}, ` +
          "which break shared primitives inside the editor. Reinstall " +
          "against the current manifests; if the copies persist, fix the " +
          "overrides entry in the root package.json instead of " +
          "allowing a second copy.",
      ).toHaveLength(1);
    });
  }

  // Exercise the installed editor graph directly. Separate @lezer/common
  // instances allocate colliding NodeProp IDs: the highlighter then reads
  // another parser property as style tags and throws "tags is not iterable".
  // Using Node resolution also keeps a test bundler from hiding the split.
  it.each([
    ["@codemirror/lang-python", "python", "def greet(name):\n    return name + '!'\n"],
    ["@codemirror/lang-javascript", "javascript", "function greet(name) { return name + '!'; }"],
    ["@codemirror/lang-html", "html", '<div class="greeting">Hello</div>'],
    ["@codemirror/lang-sql", "sql", "SELECT name FROM greetings WHERE id = 1;"],
  ])("highlights code with %s through the editor's installed dependencies", (pkg, factory, code) => {
    const language = languagesRequire(pkg)[factory]().language;
    const { highlightTree, classHighlighter } = languageRequire("@lezer/highlight");
    const spans: Array<{ from: number; to: number; css: string }> = [];
    highlightTree(language.parser.parse(code), classHighlighter, (from: number, to: number, css: string) => {
      spans.push({ from, to, css });
    });
    expect(spans.length).toBeGreaterThan(0);
    for (const span of spans) {
      expect(span.from).toBeGreaterThanOrEqual(0);
      expect(span.to).toBeGreaterThan(span.from);
      expect(span.to).toBeLessThanOrEqual(code.length);
      expect(span.css).toMatch(/\S/);
    }
  });
});
