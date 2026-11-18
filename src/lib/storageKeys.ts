/**
 * Every localStorage key the app uses, in one place. Read/write them only
 * through lib/storage (safeGet/safeSet), never localStorage directly.
 */

// ── Synced user data (backed up by exportAllData, pushed to Supabase) ──
export const TRACKER_KEY = 'whub_tracker_v3' // Record<YYYY-MM-DD, DayData>
export const RECIPES_KEY = 'whub_custom_recipes_v1'
export const TAGS_KEY = 'whub_custom_tags_v1'
export const GROCERY_KEY = 'whub_grocery_v1' // checked grocery items
export const GROCERY_CATALOG_KEY = 'whub_grocery_catalog_v1'
export const FOOD_LIBRARY_KEY = 'whub_food_library_v1'
export const WEEK_SCHEDULE_KEY = 'whub_schedule_v2'
export const MED_GUIDES_KEY = 'whub_med_guides_v1'
export const REMINDERS_KEY = 'whub_reminders_v1'
export const HIDDEN_RECIPES_KEY = 'whub_hidden_recipes_v1'
export const USER_SETTINGS_KEY = 'whub_user_settings_v1'
export const BODY_STATS_KEY = 'whub_body_stats_v1'
export const WORKOUT_PLAN_KEY = 'whub_workout_plan_v1'

// ── Sync bookkeeping ──
export const SYNC_DIRTY_KEY = 'whub_sync_dirty' // boolean: some push failed
export const SYNC_DIRTY_RECORDS_KEY = 'whub_sync_dirty_records_v1' // Record<record, seq>: unconfirmed local edits

// ── Device-local state ──
export const DRAFT_KEY = 'whub_workout_draft_v1' // workout in progress
export const SEEDED_KEY = 'whub_grocery_initialized_v1' // grocery list seeded once

// ── Caches (derived / re-fetchable — not in backups) ──
export const BUILTIN_CACHE_KEY = 'whub_builtin_recipes_v1' // built-in recipe catalog
export const READINESS_CACHE_KEY = 'whub_oura_readiness_v1' // Oura readiness per day
export const CYCLE_CACHE_KEY = 'whub_oura_cycle_v1' // Oura temperature cycle estimate
export const HISTORY_SYNC_KEY = 'whub_oura_history_sync_v1' // last Oura workout backfill (ms)
export const IMPORT_STAMP_KEY = 'whub_oura_import_v1' // Record<date, { wk?: number; med?: number }>
export const TOMBSTONE_KEY = 'whub_oura_dismissed_v1' // Record<date, string[]>: Oura sessions the user removed
export const USDA_CACHE_KEY = 'whub_usda_per100g_v1' // USDA per-100 g nutrient lookups

// ── Legacy (read once for migration) ──
export const SCHEDULE_KEY = 'whub_schedule_v1' // v1 flat schedule → migrated to v2
