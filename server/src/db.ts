import type { Pool as PgPool } from "pg";

// Async storage adapter with two backends, same Postgres dialect:
//   - production: node-postgres `Pool` when DATABASE_URL is set (Railway managed PG)
//   - dev / tests: @electric-sql/pglite (in-process Postgres, WASM) — file dir or in-memory
// The repository keeps writing `?`-placeholder SQL; `prepare()` rewrites `?` → `$n`,
// so the sync→async migration touched call shape (await) far more than SQL text.

interface RawDb {
  query(sql: string, params?: unknown[]): Promise<{ rows: any[] }>;
  exec?(sql: string): Promise<unknown>;
}

export interface Prepared {
  run(...args: unknown[]): Promise<void>;
  get<T = any>(...args: unknown[]): Promise<T | undefined>;
  all<T = any>(...args: unknown[]): Promise<T[]>;
}

export interface AppDatabase {
  prepare(sql: string): Prepared;
  exec(sql: string): Promise<void>;
}

function toPg(sql: string): string {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

export async function openDatabase(): Promise<AppDatabase> {
  const url = process.env.DATABASE_URL;
  let raw: RawDb;

  if (url) {
    const { Pool } = await import("pg");
    const pool: PgPool = new Pool({
      connectionString: url,
      ssl: process.env.DATABASE_SSL === "require" ? { rejectUnauthorized: false } : undefined
    });
    raw = { query: (sql, params) => pool.query(sql, params as unknown[]) };
  } else {
    const { PGlite } = await import("@electric-sql/pglite");
    const dir = process.env.PGLITE_PATH; // undefined => ephemeral in-memory (tests)
    const lite = new PGlite(dir);
    raw = {
      query: (sql, params) => lite.query(sql, params as unknown[]) as Promise<{ rows: any[] }>,
      exec: (sql) => lite.exec(sql)
    };
  }

  const db: AppDatabase = {
    prepare(sql: string): Prepared {
      const pg = toPg(sql);
      return {
        run: async (...args) => {
          await raw.query(pg, args);
        },
        get: async (...args) => (await raw.query(pg, args)).rows[0],
        all: async (...args) => (await raw.query(pg, args)).rows
      };
    },
    exec: async (sql: string) => {
      if (raw.exec) await raw.exec(sql);
      else await raw.query(sql);
    }
  };

  await migrate(db);
  return db;
}

async function migrate(db: AppDatabase) {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS kv (
      key text PRIMARY KEY,
      value text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS posts (
      id text PRIMARY KEY,
      owner_id text NOT NULL DEFAULT 'owner-default',
      title text NOT NULL,
      body text NOT NULL,
      status text NOT NULL,
      tags text NOT NULL,
      word_count integer NOT NULL,
      reading_order integer,
      source_url text,
      cover_image_url text,
      seo text,
      created_at text NOT NULL,
      updated_at text NOT NULL,
      published_at text
    );

    CREATE TABLE IF NOT EXISTS topic_ideas (
      id text PRIMARY KEY,
      owner_id text NOT NULL DEFAULT 'owner-default',
      type text NOT NULL,
      title text NOT NULL,
      angle text NOT NULL,
      rationale text NOT NULL,
      source_post_id text,
      series text,
      series_order integer,
      created_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS seo_packages (
      id text PRIMARY KEY,
      owner_id text NOT NULL DEFAULT 'owner-default',
      post_id text,
      meta_title text NOT NULL,
      meta_description text NOT NULL,
      slug text NOT NULL,
      tags text NOT NULL,
      social_blurb text NOT NULL,
      created_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS image_assets (
      id text PRIMARY KEY,
      owner_id text NOT NULL DEFAULT 'owner-default',
      post_id text,
      prompt text NOT NULL,
      url text NOT NULL,
      provider text NOT NULL,
      role text,
      style text,
      caption text,
      data bytea,
      mime text,
      created_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedule_entries (
      id text PRIMARY KEY,
      owner_id text NOT NULL DEFAULT 'owner-default',
      post_id text,
      brief_id text,
      title text NOT NULL,
      target_date text NOT NULL,
      status text NOT NULL,
      reminder_channel text NOT NULL,
      reminder_sent integer NOT NULL,
      checklist text NOT NULL,
      created_at text NOT NULL,
      updated_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS generations (
      id text PRIMARY KEY,
      brief_json text NOT NULL,
      frame_output text,
      draft_output text,
      critique_output text,
      final_output text,
      model_frame text,
      model_draft text,
      model_sharpen text,
      tokens_used integer,
      cache_hits integer,
      created_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_batches (
      id text PRIMARY KEY,
      source text NOT NULL,
      posts_imported integer NOT NULL,
      prompts_imported integer NOT NULL,
      references_imported integer NOT NULL,
      created_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prompt_templates (
      id text PRIMARY KEY,
      stage text NOT NULL UNIQUE,
      name text NOT NULL,
      description text NOT NULL,
      active_version_id text NOT NULL,
      created_at text NOT NULL,
      updated_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prompt_versions (
      id text PRIMARY KEY,
      template_id text NOT NULL,
      version integer NOT NULL,
      body text NOT NULL,
      notes text NOT NULL,
      created_at text NOT NULL,
      UNIQUE(template_id, version)
    );

    CREATE TABLE IF NOT EXISTS voice_distillations (
      id text PRIMARY KEY,
      owner_id text NOT NULL DEFAULT 'owner-default',
      source_post_ids text NOT NULL,
      traits text NOT NULL,
      structures text NOT NULL,
      rhythm text NOT NULL,
      metaphors text NOT NULL,
      theological_lenses text NOT NULL,
      weak_patterns text NOT NULL,
      exemplars text NOT NULL,
      created_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quality_reports (
      id text PRIMARY KEY,
      generation_id text,
      text_hash text NOT NULL,
      vocabulary_violations text NOT NULL,
      structural_violations text NOT NULL,
      scores text NOT NULL,
      verdict text NOT NULL,
      summary text NOT NULL,
      created_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS output_revisions (
      id text PRIMARY KEY,
      generation_id text,
      report_id text,
      original_text text NOT NULL,
      revised_text text NOT NULL,
      created_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS generation_records (
      id text PRIMARY KEY,
      owner_id text NOT NULL DEFAULT 'owner-default',
      stage text NOT NULL,
      content text NOT NULL,
      provider text NOT NULL,
      model text NOT NULL,
      prompt_version_id text,
      brief_json text,
      retrieved_post_ids text NOT NULL,
      corpus_segment_ids text NOT NULL DEFAULT '[]',
      citation_flags text NOT NULL,
      quality_report_id text,
      prompt_tokens integer,
      completion_tokens integer,
      total_tokens integer,
      cost double precision,
      created_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS corpus_sources (
      id text PRIMARY KEY,
      owner_id text NOT NULL DEFAULT 'owner-default',
      path text NOT NULL UNIQUE,
      name text NOT NULL,
      checksum text NOT NULL,
      imported_at text NOT NULL,
      segment_count integer NOT NULL
    );

    CREATE TABLE IF NOT EXISTS corpus_segments (
      id text PRIMARY KEY,
      owner_id text NOT NULL DEFAULT 'owner-default',
      source_id text NOT NULL,
      source_path text NOT NULL,
      title text NOT NULL,
      body text NOT NULL,
      type text NOT NULL,
      memory_role text NOT NULL,
      tags text NOT NULL,
      line_start integer NOT NULL,
      line_end integer NOT NULL,
      confidence double precision NOT NULL,
      embedding_status text NOT NULL,
      embedding_provider text,
      judge_readiness text NOT NULL,
      created_at text NOT NULL,
      updated_at text NOT NULL,
      UNIQUE(source_path, line_start, line_end)
    );

    CREATE TABLE IF NOT EXISTS brief_seeds (
      id text PRIMARY KEY,
      owner_id text NOT NULL DEFAULT 'owner-default',
      corpus_segment_id text UNIQUE,
      title text NOT NULL,
      seed text NOT NULL,
      topic text NOT NULL,
      tension text NOT NULL,
      raw_notes text NOT NULL,
      tags text NOT NULL,
      source_line_range text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflow_recipes (
      id text PRIMARY KEY,
      name text NOT NULL UNIQUE,
      description text NOT NULL,
      stages text NOT NULL,
      toggles text NOT NULL,
      judge_readiness text NOT NULL,
      created_at text NOT NULL,
      updated_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS post_embeddings (
      post_id text NOT NULL,
      model text NOT NULL,
      vector text NOT NULL,
      created_at text NOT NULL,
      PRIMARY KEY (post_id, model)
    );

    CREATE TABLE IF NOT EXISTS repurpose_packages (
      id text PRIMARY KEY,
      owner_id text NOT NULL DEFAULT 'owner-default',
      post_id text,
      tweet_thread text NOT NULL,
      linkedin_post text NOT NULL,
      newsletter_teaser text NOT NULL,
      created_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS voice_profiles (
      id text PRIMARY KEY,
      owner_id text NOT NULL DEFAULT 'owner-default',
      name text NOT NULL,
      profile text NOT NULL,
      created_at text NOT NULL,
      updated_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id text PRIMARY KEY,
      email text NOT NULL UNIQUE,
      password_hash text NOT NULL,
      created_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shows (
      id text PRIMARY KEY,
      owner_id text NOT NULL DEFAULT 'owner-default',
      name text NOT NULL,
      kind text NOT NULL DEFAULT 'essay',
      description text NOT NULL DEFAULT '',
      voice_id text,
      recipe_id text,
      created_at text NOT NULL,
      updated_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS experiments (
      id text PRIMARY KEY,
      owner_id text NOT NULL DEFAULT 'owner-default',
      name text NOT NULL,
      kind text NOT NULL,
      results text NOT NULL DEFAULT '[]',
      winner text,
      winner_variant text,
      cost double precision,
      created_at text NOT NULL
    );

    CREATE TABLE IF NOT EXISTS territories (
      id text PRIMARY KEY,
      owner_id text NOT NULL DEFAULT 'owner-default',
      name text NOT NULL,
      kind text NOT NULL,
      graph text NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
      created_at text NOT NULL
    );
  `);
}
