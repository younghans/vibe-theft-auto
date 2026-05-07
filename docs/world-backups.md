# World Backups

The world persistence layer captures lightweight backups after successful saves and on a backup timer. Backups are enabled by default for the `primary` world only, so local `staging` sessions do not create backups unless explicitly configured.

Defaults:

- `WORLD_BACKUP_ENABLED=true`
- `WORLD_BACKUP_WORLD_KEY=primary`
- `WORLD_BACKUP_INTERVAL_MS=900000`
- `WORLD_BACKUP_RECENT_DAYS=3`
- `WORLD_BACKUP_MAX_DAILY_DAYS=30`

Retention keeps every changed backup inside the recent window. Older backups are compacted to the newest backup per UTC day per world. Set `WORLD_BACKUP_MAX_DAILY_DAYS=0` to keep daily backups without a max age.

Postgres persistence writes backups to `world_snapshot_backups`. File persistence writes JSON backups plus an `index.json` file under `server/data/world-backups` by default. Override the local file directory with `WORLD_BACKUP_PATH`.

Backups are skipped when the current layout hash matches the newest backup. Saves made more frequently than `WORLD_BACKUP_INTERVAL_MS` do not create extra backup rows/files immediately, but the timer will capture the latest changed layout on a later interval.
