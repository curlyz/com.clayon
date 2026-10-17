// The spec.json import is loaded as TEXT (wrangler.jsonc rules), so its
// type here is string — the Worker serves the file's exact bytes at
// /api/openapi.json instead of a re-serialized copy.
declare module "@clayon/openapi/spec.json" {
  const spec: string;
  export default spec;
}
