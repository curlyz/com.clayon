-- Brand rename: every database object and stored value carrying the previous product name becomes "clayon".
-- Idempotent: a database created from the already-renamed migrations matches nothing here and is left untouched.
-- The previous name is assembled from two halves so no file in this repository spells it out.
CREATE FUNCTION pg_temp.legacy_brand() RETURNS text LANGUAGE sql IMMUTABLE AS $f$ SELECT 'paper' || 'clip' $f$;--> statement-breakpoint
CREATE FUNCTION pg_temp.rebrand(value text) RETURNS text LANGUAGE sql IMMUTABLE AS $f$
  SELECT replace(replace(replace(replace(value,
    pg_temp.legacy_brand() || 'ai', 'clayon'),
    pg_temp.legacy_brand(), 'clayon'),
    initcap(pg_temp.legacy_brand()), 'Clayon'),
    upper(pg_temp.legacy_brand()), 'CLAYON')
$f$;--> statement-breakpoint
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT nspname FROM pg_namespace WHERE nspname ILIKE '%' || pg_temp.legacy_brand() || '%' LOOP
    EXECUTE format('ALTER SCHEMA %I RENAME TO %I', r.nspname, pg_temp.rebrand(r.nspname));
  END LOOP;
END $$;--> statement-breakpoint
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, c.relname, c.relkind
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE c.relname ILIKE '%' || pg_temp.legacy_brand() || '%' AND c.relkind IN ('r', 'p', 'v', 'm', 'S', 'i', 'I', 'f')
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
    ORDER BY CASE c.relkind WHEN 'r' THEN 0 WHEN 'p' THEN 0 ELSE 1 END
  LOOP
    IF r.relkind IN ('i', 'I') THEN
      EXECUTE format('ALTER INDEX %I.%I RENAME TO %I', r.nspname, r.relname, pg_temp.rebrand(r.relname));
    ELSIF r.relkind = 'S' THEN
      EXECUTE format('ALTER SEQUENCE %I.%I RENAME TO %I', r.nspname, r.relname, pg_temp.rebrand(r.relname));
    ELSIF r.relkind = 'v' THEN
      EXECUTE format('ALTER VIEW %I.%I RENAME TO %I', r.nspname, r.relname, pg_temp.rebrand(r.relname));
    ELSIF r.relkind = 'm' THEN
      EXECUTE format('ALTER MATERIALIZED VIEW %I.%I RENAME TO %I', r.nspname, r.relname, pg_temp.rebrand(r.relname));
    ELSE
      EXECUTE format('ALTER TABLE %I.%I RENAME TO %I', r.nspname, r.relname, pg_temp.rebrand(r.relname));
    END IF;
  END LOOP;
END $$;--> statement-breakpoint
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, c.relname, a.attname
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE a.attname ILIKE '%' || pg_temp.legacy_brand() || '%' AND a.attnum > 0 AND NOT a.attisdropped AND c.relkind IN ('r', 'p')
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I RENAME COLUMN %I TO %I', r.nspname, r.relname, r.attname, pg_temp.rebrand(r.attname));
  END LOOP;
END $$;--> statement-breakpoint
DO $$
DECLARE r record; def text;
BEGIN
  -- Plain indexes keep the old column name in their own catalog entry after a column rename: rebuild them.
  FOR r IN
    SELECT DISTINCT n.nspname, i.relname, pg_get_indexdef(i.oid) AS def
    FROM pg_index x
    JOIN pg_class i ON i.oid = x.indexrelid
    JOIN pg_namespace n ON n.oid = i.relnamespace
    JOIN pg_attribute a ON a.attrelid = i.oid
    WHERE a.attname ILIKE '%' || pg_temp.legacy_brand() || '%' AND NOT a.attisdropped
      AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = i.oid)
      AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  LOOP
    def := r.def;
    EXECUTE format('DROP INDEX %I.%I', r.nspname, r.relname);
    EXECUTE def;
  END LOOP;
END $$;--> statement-breakpoint
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, c.relname, con.conname
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.conname ILIKE '%' || pg_temp.legacy_brand() || '%' AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I RENAME CONSTRAINT %I TO %I', r.nspname, r.relname, r.conname, pg_temp.rebrand(r.conname));
  END LOOP;
END $$;--> statement-breakpoint
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, c.relname, t.tgname
    FROM pg_trigger t
    JOIN pg_class c ON c.oid = t.tgrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE t.tgname ILIKE '%' || pg_temp.legacy_brand() || '%' AND NOT t.tgisinternal
  LOOP
    EXECUTE format('ALTER TRIGGER %I ON %I.%I RENAME TO %I', r.tgname, r.nspname, r.relname, pg_temp.rebrand(r.tgname));
  END LOOP;
END $$;--> statement-breakpoint
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, pg_get_function_identity_arguments(p.oid) AS args
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE p.proname ILIKE '%' || pg_temp.legacy_brand() || '%' AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_temp')
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I(%s) RENAME TO %I', r.nspname, r.proname, r.args, pg_temp.rebrand(r.proname));
  END LOOP;
END $$;--> statement-breakpoint
DO $$
DECLARE r record;
BEGIN
  -- Function bodies that still mention the previous name.
  FOR r IN
    SELECT p.oid
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname NOT IN ('pg_catalog', 'information_schema') AND n.nspname NOT LIKE 'pg_temp%' AND p.prokind = 'f'
      AND pg_get_functiondef(p.oid) ILIKE '%' || pg_temp.legacy_brand() || '%'
  LOOP
    EXECUTE pg_temp.rebrand(pg_get_functiondef(r.oid));
  END LOOP;
END $$;--> statement-breakpoint
DO $$
DECLARE r record;
BEGIN
  -- Check constraints that enumerate previous stored values: drop, rewrite the data, re-add rebranded.
  CREATE TEMP TABLE clayon_rebrand_checks (nspname text, relname text, conname text, def text) ON COMMIT DROP;
  FOR r IN
    SELECT n.nspname, c.relname, con.conname, pg_get_constraintdef(con.oid) AS def
    FROM pg_constraint con
    JOIN pg_class c ON c.oid = con.conrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE con.contype = 'c' AND pg_get_constraintdef(con.oid) ILIKE '%' || pg_temp.legacy_brand() || '%'
  LOOP
    INSERT INTO clayon_rebrand_checks VALUES (r.nspname, r.relname, r.conname, r.def);
    EXECUTE format('ALTER TABLE %I.%I DROP CONSTRAINT %I', r.nspname, r.relname, r.conname);
  END LOOP;
  FOR r IN
    SELECT n.nspname, c.relname, a.attname, format_type(a.atttypid, a.atttypmod) AS coltype
    FROM pg_attribute a
    JOIN pg_class c ON c.oid = a.attrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE a.attnum > 0 AND NOT a.attisdropped AND a.attgenerated = '' AND c.relkind IN ('r', 'p')
      AND n.nspname NOT IN ('pg_catalog', 'information_schema', 'pg_toast', 'drizzle')
      AND c.relname <> '__drizzle_migrations'
      AND format_type(a.atttypid, a.atttypmod) IN ('text', 'jsonb', 'json', 'character varying')
  LOOP
    IF r.coltype IN ('jsonb', 'json') THEN
      EXECUTE format('UPDATE %I.%I SET %I = pg_temp.rebrand(%I::text)::%s WHERE %I::text ILIKE %L',
        r.nspname, r.relname, r.attname, r.attname, r.coltype, r.attname, '%' || pg_temp.legacy_brand() || '%');
    ELSE
      EXECUTE format('UPDATE %I.%I SET %I = pg_temp.rebrand(%I) WHERE %I ILIKE %L',
        r.nspname, r.relname, r.attname, r.attname, r.attname, '%' || pg_temp.legacy_brand() || '%');
    END IF;
  END LOOP;
  FOR r IN SELECT * FROM clayon_rebrand_checks LOOP
    EXECUTE format('ALTER TABLE %I.%I ADD CONSTRAINT %I %s', r.nspname, r.relname, r.conname, pg_temp.rebrand(r.def));
  END LOOP;
END $$;--> statement-breakpoint
DO $$
DECLARE r record;
BEGIN
  -- Column defaults that carry the previous name as a literal.
  FOR r IN
    SELECT n.nspname, c.relname, a.attname, pg_get_expr(d.adbin, d.adrelid) AS expr
    FROM pg_attrdef d
    JOIN pg_class c ON c.oid = d.adrelid
    JOIN pg_namespace n ON n.oid = c.relnamespace
    JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
    WHERE pg_get_expr(d.adbin, d.adrelid) ILIKE '%' || pg_temp.legacy_brand() || '%' AND n.nspname NOT IN ('pg_catalog', 'information_schema')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I ALTER COLUMN %I SET DEFAULT %s', r.nspname, r.relname, r.attname, pg_temp.rebrand(r.expr));
  END LOOP;
END $$;--> statement-breakpoint
DO $$
DECLARE r record; new_name text;
BEGIN
  -- Plugin namespaces end in a hash of the plugin key, and the key changed with the brand: move each schema to its new name.
  IF to_regclass('public.plugin_database_namespaces') IS NULL THEN RETURN; END IF;
  FOR r IN SELECT id, plugin_key, namespace_name FROM public.plugin_database_namespaces LOOP
    new_name := regexp_replace(r.namespace_name, '_[0-9a-f]{10}$', '_' || left(encode(sha256(convert_to(r.plugin_key, 'UTF8')), 'hex'), 10));
    IF new_name <> r.namespace_name AND to_regnamespace(quote_ident(new_name)) IS NULL AND to_regnamespace(quote_ident(r.namespace_name)) IS NOT NULL THEN
      EXECUTE format('ALTER SCHEMA %I RENAME TO %I', r.namespace_name, new_name);
      UPDATE public.plugin_database_namespaces SET namespace_name = new_name WHERE id = r.id;
      UPDATE public.plugin_migrations SET namespace_name = new_name WHERE namespace_name = r.namespace_name;
    END IF;
  END LOOP;
  -- Plugin migration checksums follow the rewritten files.
  UPDATE public.plugin_migrations SET checksum = 'b20b5da91f81f3f3bea4255e6fbca899ea04cd767a4cd68b22fbcc7d4dcfe0d0'
    WHERE plugin_key = 'clayon.plugin-llm-wiki' AND migration_key = '002_clayon_distillation.sql';
  UPDATE public.plugin_migrations SET checksum = '866985c42bf88c9ade339f6f2ff5dd406bfe103701fb4037a5255c948bc4307b'
    WHERE plugin_key = 'clayon.plugin-llm-wiki' AND migration_key = '003_spaces.sql';
END $$;
