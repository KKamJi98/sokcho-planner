import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const databasePath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "sokcho-planner.db");

type DatabaseInstance = InstanceType<typeof Database>;
const globalForDb = globalThis as unknown as { sokchoPlannerDb?: DatabaseInstance };

function seed(db: DatabaseInstance) {
  const insert = db.prepare(`
    INSERT INTO places (category, name, map_url, notes, plan_at, sort_order)
    SELECT @category, @name, @mapUrl, @notes, @planAt, @sortOrder
    WHERE NOT EXISTS (SELECT 1 FROM places WHERE category = @category AND name = @name)
  `);
  const naverSearch = (name: string) => `https://map.naver.com/p/search/${encodeURIComponent(name)}`;
  const rows = [
    {
      category: "관광지",
      name: "속초아이 대관람차",
      mapUrl: naverSearch("속초아이 대관람차"),
      notes: "청초호·속초해변 동선과 함께 시간대를 정해보세요.",
      planAt: "",
      sortOrder: 10,
    },
    {
      category: "관광지",
      name: "속초관광수산시장",
      mapUrl: naverSearch("속초관광수산시장"),
      notes: "속초관광시장으로도 검색됩니다. 포장·간식 동선을 고려해보세요.",
      planAt: "",
      sortOrder: 20,
    },
    {
      category: "음식점",
      name: "단천식당 속초",
      mapUrl: naverSearch("단천식당 속초"),
      notes: "아바이순대·오징어순대 후보. 속초아이 뒤 청호동/아바이마을 동선. 메뉴·영업·대기 확인 필요.",
      planAt: "",
      sortOrder: 110,
    },
    {
      category: "음식점",
      name: "2대송림순대집 속초",
      mapUrl: naverSearch("2대송림순대집 속초"),
      notes: "아바이순대 후보. 청호동 동선 비교용. 메뉴·영업·대기 확인 필요.",
      planAt: "",
      sortOrder: 120,
    },
    {
      category: "음식점",
      name: "속초항아리물회",
      mapUrl: naverSearch("속초항아리물회"),
      notes: "물회 후보. 속초아이/해변 전후 동선 비교용. 메뉴·영업·대기 확인 필요.",
      planAt: "",
      sortOrder: 130,
    },
    {
      category: "음식점",
      name: "청초수물회 속초",
      mapUrl: naverSearch("청초수물회 속초"),
      notes: "물회 후보. 청초호·관광수산시장 동선 비교용. 메뉴·영업·대기 확인 필요.",
      planAt: "",
      sortOrder: 140,
    },
    {
      category: "음식점",
      name: "88생선구이 속초",
      mapUrl: naverSearch("88생선구이 속초"),
      notes: "생선구이 후보. 관광수산시장 방문 전후 식사 후보. 메뉴·영업·대기 확인 필요.",
      planAt: "",
      sortOrder: 150,
    },
    {
      category: "음식점",
      name: "중앙닭강정 속초",
      mapUrl: naverSearch("중앙닭강정 속초"),
      notes: "관광수산시장 포장 후보. 당일 대기·매진·영업시간 확인 필요.",
      planAt: "",
      sortOrder: 160,
    },
    {
      category: "음식점",
      name: "만석닭강정 본점 속초",
      mapUrl: naverSearch("만석닭강정 본점 속초"),
      notes: "관광수산시장 포장 후보. 중앙닭강정과 당일 대기·동선 비교용.",
      planAt: "",
      sortOrder: 170,
    },
    {
      category: "음식점",
      name: "봉포머구리집 속초",
      mapUrl: naverSearch("봉포머구리집 속초"),
      notes: "물회 후보. 시내/관광시장과 이동시간을 먼저 비교하세요. 메뉴·영업·대기 확인 필요.",
      planAt: "",
      sortOrder: 180,
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
