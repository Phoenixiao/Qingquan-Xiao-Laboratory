CREATE TABLE IF NOT EXISTS site_stats (
    id TEXT PRIMARY KEY,
    total_visits INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO site_stats (id, total_visits)
VALUES ('qingquan-xiao-lab', 0);
