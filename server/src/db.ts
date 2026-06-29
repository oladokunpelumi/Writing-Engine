import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";

export function openDatabase(path = process.env.DATABASE_PATH ?? ".data/gbedu-desk.sqlite") {
  const dbPath = path === ":memory:" ? path : resolve(process.cwd(), path);
  if (dbPath !== ":memory:") {
    mkdirSync(dirname(dbPath), { recursive: true });
  }
  const db = new DatabaseSync(dbPath);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  migrate(db);
  return db;
}

export type AppDatabase = DatabaseSync;

function migrate(db: DatabaseSync) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS kv (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS posts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL,
      tags TEXT NOT NULL,
      word_count INTEGER NOT NULL,
      source_url TEXT,
      cover_image_url TEXT,
      seo TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      published_at TEXT
    );

    CREATE TABLE IF NOT EXISTS topic_ideas (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      angle TEXT NOT NULL,
      rationale TEXT NOT NULL,
      source_post_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS seo_packages (
      id TEXT PRIMARY KEY,
      post_id TEXT,
      meta_title TEXT NOT NULL,
      meta_description TEXT NOT NULL,
      slug TEXT NOT NULL,
      tags TEXT NOT NULL,
      social_blurb TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS image_assets (
      id TEXT PRIMARY KEY,
      post_id TEXT,
      prompt TEXT NOT NULL,
      url TEXT NOT NULL,
      provider TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS schedule_entries (
      id TEXT PRIMARY KEY,
      post_id TEXT,
      brief_id TEXT,
      title TEXT NOT NULL,
      target_date TEXT NOT NULL,
      status TEXT NOT NULL,
      reminder_channel TEXT NOT NULL,
      reminder_sent INTEGER NOT NULL,
      checklist TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS generations (
      id TEXT PRIMARY KEY,
      brief_json TEXT NOT NULL,
      frame_output TEXT,
      draft_output TEXT,
      critique_output TEXT,
      final_output TEXT,
      model_frame TEXT,
      model_draft TEXT,
      model_sharpen TEXT,
      tokens_used INTEGER,
      cache_hits INTEGER,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_batches (
      id TEXT PRIMARY KEY,
      source TEXT NOT NULL,
      posts_imported INTEGER NOT NULL,
      prompts_imported INTEGER NOT NULL,
      references_imported INTEGER NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prompt_templates (
      id TEXT PRIMARY KEY,
      stage TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      active_version_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS prompt_versions (
      id TEXT PRIMARY KEY,
      template_id TEXT NOT NULL,
      version INTEGER NOT NULL,
      body TEXT NOT NULL,
      notes TEXT NOT NULL,
      created_at TEXT NOT NULL,
      UNIQUE(template_id, version)
    );

    CREATE TABLE IF NOT EXISTS voice_distillations (
      id TEXT PRIMARY KEY,
      source_post_ids TEXT NOT NULL,
      traits TEXT NOT NULL,
      structures TEXT NOT NULL,
      rhythm TEXT NOT NULL,
      metaphors TEXT NOT NULL,
      theological_lenses TEXT NOT NULL,
      weak_patterns TEXT NOT NULL,
      exemplars TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS quality_reports (
      id TEXT PRIMARY KEY,
      generation_id TEXT,
      text_hash TEXT NOT NULL,
      vocabulary_violations TEXT NOT NULL,
      structural_violations TEXT NOT NULL,
      scores TEXT NOT NULL,
      verdict TEXT NOT NULL,
      summary TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS output_revisions (
      id TEXT PRIMARY KEY,
      generation_id TEXT,
      report_id TEXT,
      original_text TEXT NOT NULL,
      revised_text TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS generation_records (
      id TEXT PRIMARY KEY,
      stage TEXT NOT NULL,
      content TEXT NOT NULL,
      provider TEXT NOT NULL,
      model TEXT NOT NULL,
      prompt_version_id TEXT,
      brief_json TEXT,
      retrieved_post_ids TEXT NOT NULL,
      corpus_segment_ids TEXT NOT NULL DEFAULT '[]',
      citation_flags TEXT NOT NULL,
      quality_report_id TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS corpus_sources (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      checksum TEXT NOT NULL,
      imported_at TEXT NOT NULL,
      segment_count INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS corpus_segments (
      id TEXT PRIMARY KEY,
      source_id TEXT NOT NULL,
      source_path TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      type TEXT NOT NULL,
      memory_role TEXT NOT NULL,
      tags TEXT NOT NULL,
      line_start INTEGER NOT NULL,
      line_end INTEGER NOT NULL,
      confidence REAL NOT NULL,
      embedding_status TEXT NOT NULL,
      embedding_provider TEXT,
      judge_readiness TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(source_path, line_start, line_end)
    );

    CREATE TABLE IF NOT EXISTS brief_seeds (
      id TEXT PRIMARY KEY,
      corpus_segment_id TEXT UNIQUE,
      title TEXT NOT NULL,
      seed TEXT NOT NULL,
      topic TEXT NOT NULL,
      tension TEXT NOT NULL,
      raw_notes TEXT NOT NULL,
      tags TEXT NOT NULL,
      source_line_range TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflow_recipes (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL,
      stages TEXT NOT NULL,
      toggles TEXT NOT NULL,
      judge_readiness TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS post_embeddings (
      post_id TEXT NOT NULL,
      model TEXT NOT NULL,
      vector TEXT NOT NULL,
      created_at TEXT NOT NULL,
      PRIMARY KEY (post_id, model)
    );

    CREATE TABLE IF NOT EXISTS repurpose_packages (
      id TEXT PRIMARY KEY,
      post_id TEXT,
      tweet_thread TEXT NOT NULL,
      linkedin_post TEXT NOT NULL,
      newsletter_teaser TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS voice_profiles (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL DEFAULT 'owner-default',
      name TEXT NOT NULL,
      profile TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS shows (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL DEFAULT 'owner-default',
      name TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT 'essay',
      description TEXT NOT NULL DEFAULT '',
      voice_id TEXT,
      recipe_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS experiments (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL DEFAULT 'owner-default',
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      results TEXT NOT NULL DEFAULT '[]',
      winner TEXT,
      winner_variant TEXT,
      cost REAL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS territories (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL DEFAULT 'owner-default',
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      graph TEXT NOT NULL DEFAULT '{"nodes":[],"edges":[]}',
      created_at TEXT NOT NULL
    );
  `);
  ensureColumn(db, "generation_records", "corpus_segment_ids", "TEXT NOT NULL DEFAULT '[]'");
  ensureColumn(db, "posts", "reading_order", "INTEGER");
  ensureColumn(db, "topic_ideas", "series", "TEXT");
  ensureColumn(db, "topic_ideas", "series_order", "INTEGER");
  ensureColumn(db, "generation_records", "prompt_tokens", "INTEGER");
  ensureColumn(db, "generation_records", "completion_tokens", "INTEGER");
  ensureColumn(db, "generation_records", "total_tokens", "INTEGER");
  ensureColumn(db, "generation_records", "cost", "REAL");
  // Per-owner isolation: user-content tables carry owner_id (existing rows default to the single original owner).
  for (const table of [
    "posts",
    "corpus_sources",
    "corpus_segments",
    "brief_seeds",
    "schedule_entries",
    "generation_records",
    "topic_ideas",
    "seo_packages",
    "image_assets",
    "repurpose_packages",
    "voice_distillations"
  ]) {
    ensureColumn(db, table, "owner_id", "TEXT NOT NULL DEFAULT 'owner-default'");
  }
  ensureColumn(db, "image_assets", "role", "TEXT");
  ensureColumn(db, "image_assets", "style", "TEXT");
  ensureColumn(db, "image_assets", "caption", "TEXT");
}

function ensureColumn(db: DatabaseSync, table: string, column: string, definition: string) {
  const rows = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name?: string }>;
  if (rows.some((row) => row.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition};`);
}
