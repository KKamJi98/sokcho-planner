import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const databasePath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "sokcho-planner.db");

type DatabaseInstance = InstanceType<typeof Database>;
const globalForDb = globalThis as unknown as { sokchoPlannerDb?: DatabaseInstance };

function seed(db: DatabaseInstance) {
  const count = db.prepare("SELECT COUNT(*) AS count FROM places").get() as { count: number };
  if (count.count > 0) return;
  const insert = db.prepare(`
    INSERT INTO places (category, name, map_url, notes, plan_at, sort_order)
    VALUES (@category, @name, @mapUrl, @notes, @planAt, @sortOrder)
  `);
  const rows = [
    {
      category: "관광지",
      name: "속초아이 대관람차",
      mapUrl: "https://map.naver.com/p/search/%EC%86%8D%EC%B4%88%EC%95%84%EC%9D%B4%20%EB%8C%80%EA%B4%80%EB%9E%8C%EC%B0%A8",
      notes: "청초호·속초해변 동선과 함께 시간대를 정해보세요.",
      planAt: "",
      sortOrder: 10,
    },
    {
      category: "관광지",
      name: "속초관광수산시장",
      mapUrl: "https://map.naver.com/p/search/%EC%86%8D%EC%B4%88%EA%B4%80%EA%B4%91%EC%88%98%EC%82%B0%EC%8B%9C%EC%9E%A5",
      notes: "속초관광시장으로도 검색됩니다. 포장·간식 동선을 고려해보세요.",
      planAt: "",
      sortOrder: 20,
    },
  ];
  const transaction = db.transaction(() => rows.forEach((row) => insert.run(row)));
  transaction();
}

export function getDb() {
  if (globalForDb.sokchoPlannerDb) return globalForDb.sokchoPlannerDb;
  fs.mkdirSync(path.dirname(databasePath), { recursive: true });
  const db = new Database(databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS places (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL CHECK (category IN ('관광지', '음식점')),
      name TEXT NOT NULL,
      map_url TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      plan_at TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 100,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      place_id INTEGER,
      author TEXT NOT NULL DEFAULT '우리',
      content TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS evaluations (
      place_id INTEGER PRIMARY KEY,
      naver_rating REAL,
      naver_reviews INTEGER,
      google_rating REAL,
      google_reviews INTEGER,
      kakao_rating REAL,
      kakao_reviews INTEGER,
      food INTEGER,
      service INTEGER,
      ambience INTEGER,
      value INTEGER,
      wait_score INTEGER,
      itinerary_fit INTEGER,
      evidence_note TEXT NOT NULL DEFAULT '',
      verified_at TEXT NOT NULL DEFAULT '',
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (place_id) REFERENCES places(id) ON DELETE CASCADE
    );
  `);
  seed(db);
  globalForDb.sokchoPlannerDb = db;
  return db;
}
