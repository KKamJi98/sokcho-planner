import { getDb } from "./db";
import { calculateReviewScore, type ReviewMetrics } from "./scoring";

export type Place = {
  id: number;
  category: "관광지" | "음식점";
  name: string;
  mapUrl: string;
  notes: string;
  planAt: string;
  planEndAt: string;
  personalRating: number;
  sortOrder: number;
  evaluation: (ReviewMetrics & { evidenceNote: string; verifiedAt: string }) | null;
};

export type Comment = { id: number; placeId: number | null; author: string; content: string; createdAt: string };
export type ScheduleItem = { id: number; placeId: number | null; startAt: string; endAt: string; title: string; transport: string; notes: string; sortOrder: number };

export function listPlanner() {
  const db = getDb();
  const places = db.prepare(`
    SELECT p.id, p.category, p.name, p.map_url AS mapUrl, p.notes, p.plan_at AS planAt, p.plan_end_at AS planEndAt, p.personal_rating AS personalRating, p.sort_order AS sortOrder,
      e.naver_rating AS naverRating, e.naver_reviews AS naverReviews,
      e.google_rating AS googleRating, e.google_reviews AS googleReviews,
      e.kakao_rating AS kakaoRating, e.kakao_reviews AS kakaoReviews,
      e.food, e.service, e.ambience, e.value, e.wait_score AS wait, e.itinerary_fit AS itineraryFit,
      e.evidence_note AS evidenceNote, e.verified_at AS verifiedAt
    FROM places p LEFT JOIN evaluations e ON e.place_id = p.id
    ORDER BY p.category, p.personal_rating DESC, p.sort_order, p.id
  `).all() as Array<Place & ReviewMetrics & { evidenceNote?: string; verifiedAt?: string }>;
  const scheduleItems = db.prepare(`
    SELECT id, place_id AS placeId, start_at AS startAt, end_at AS endAt, title, transport, notes, sort_order AS sortOrder
    FROM schedule_items ORDER BY start_at, sort_order, id
  `).all() as ScheduleItem[];
  const comments = db.prepare(`
    SELECT id, place_id AS placeId, author, content, created_at AS createdAt
    FROM comments ORDER BY created_at DESC, id DESC
  `).all() as Comment[];
  return {
    places: places.map((place) => ({
      id: place.id,
      category: place.category,
      name: place.name,
      mapUrl: place.mapUrl,
      notes: place.notes,
      planAt: place.planAt,
      planEndAt: place.planEndAt,
      personalRating: place.personalRating,
      sortOrder: place.sortOrder,
      evaluation: place.naverRating == null && place.food == null ? null : {
        naverRating: place.naverRating, naverReviews: place.naverReviews,
        googleRating: place.googleRating, googleReviews: place.googleReviews,
        kakaoRating: place.kakaoRating, kakaoReviews: place.kakaoReviews,
        food: place.food, service: place.service, ambience: place.ambience,
        value: place.value, wait: place.wait, itineraryFit: place.itineraryFit,
        evidenceNote: place.evidenceNote ?? "", verifiedAt: place.verifiedAt ?? "",
      },
    })),
    scheduleItems,
    comments,
  };
}

function syncPlaceSchedule(placeId: number) {
  const db = getDb();
  const place = db.prepare(`
    SELECT id, name, notes, plan_at AS planAt, plan_end_at AS planEndAt, sort_order AS sortOrder
    FROM places WHERE id = ?
  `).get(placeId) as { id: number; name: string; notes: string; planAt: string; planEndAt: string; sortOrder: number } | undefined;
  if (!place) return;

  if (!place.planAt) {
    db.prepare("DELETE FROM schedule_items WHERE place_id = ?").run(placeId);
    return;
  }

  const linked = db.prepare("SELECT id FROM schedule_items WHERE place_id = ?").get(placeId) as { id: number } | undefined;
  if (linked) {
    db.prepare(`
      UPDATE schedule_items
      SET start_at = ?, end_at = ?, title = ?, transport = '방문', notes = ?, sort_order = ?
      WHERE id = ?
    `).run(place.planAt, place.planEndAt, place.name, place.notes, place.sortOrder, linked.id);
  } else {
    db.prepare(`
      INSERT INTO schedule_items (place_id, start_at, end_at, title, transport, notes, sort_order)
      VALUES (?, ?, ?, ?, '방문', ?, ?)
    `).run(place.id, place.planAt, place.planEndAt, place.name, place.notes, place.sortOrder);
  }
}

export function createPlace(input: Omit<Place, "id" | "sortOrder" | "personalRating" | "evaluation" | "planEndAt"> & { planEndAt?: string }) {
  const db = getDb();
  const category = input.category;
  const name = input.name.trim();
  const insert = db.prepare(`
    INSERT INTO places (category, name, map_url, notes, plan_at, plan_end_at, sort_order)
    VALUES (?, ?, ?, ?, ?, ?, COALESCE((SELECT MAX(sort_order) + 10 FROM places), 10))
  `);
  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM deleted_seed_places WHERE category = ? AND name = ?").run(category, name);
    const result = insert.run(category, name, input.mapUrl.trim(), input.notes.trim(), input.planAt, input.planEndAt ?? "");
    const id = Number(result.lastInsertRowid);
    syncPlaceSchedule(id);
    return id;
  });
  return transaction();
}

export function updatePlace(id: number, input: Partial<Pick<Place, "notes" | "planAt" | "planEndAt">>) {
  const db = getDb();
  db.transaction(() => {
    db.prepare(`
      UPDATE places
      SET notes = COALESCE(?, notes), plan_at = COALESCE(?, plan_at), plan_end_at = COALESCE(?, plan_end_at)
      WHERE id = ?
    `).run(input.notes ?? null, input.planAt ?? null, input.planEndAt ?? null, id);
    syncPlaceSchedule(id);
  })();
}

export function setPlaceRating(id: number, rating: number) {
  if (!Number.isInteger(rating) || rating < 0 || rating > 5) return false;
  const db = getDb();
  const result = db.prepare("UPDATE places SET personal_rating = ? WHERE id = ?").run(rating, id);
  return result.changes > 0;
}

export function deletePlace(id: number) {
  const db = getDb();
  const place = db.prepare("SELECT category, name FROM places WHERE id = ?").get(id) as Pick<Place, "category" | "name"> | undefined;
  if (!place) return false;
  const transaction = db.transaction(() => {
    db.prepare("INSERT OR IGNORE INTO deleted_seed_places (category, name) VALUES (?, ?)").run(place.category, place.name);
    db.prepare("DELETE FROM schedule_items WHERE place_id = ?").run(id);
    db.prepare("DELETE FROM places WHERE id = ?").run(id);
  });
  transaction();
  return true;
}

export function createScheduleItem(input: Omit<ScheduleItem, "id" | "sortOrder" | "placeId">) {
  const db = getDb();
  const startAt = input.startAt.trim();
  const title = input.title.trim();
  const insert = db.prepare(`
    INSERT INTO schedule_items (start_at, end_at, title, transport, notes, sort_order)
    VALUES (?, ?, ?, ?, ?, COALESCE((SELECT MAX(sort_order) + 10 FROM schedule_items), 10))
  `);
  const transaction = db.transaction(() => {
    db.prepare("DELETE FROM deleted_seed_schedule_items WHERE start_at = ? AND title = ?").run(startAt, title);
    return insert.run(startAt, input.endAt.trim(), title, input.transport.trim(), input.notes.trim());
  });
  return Number(transaction().lastInsertRowid);
}

export function updateScheduleItem(id: number, input: Partial<Pick<ScheduleItem, "startAt" | "endAt" | "title" | "transport" | "notes">>) {
  const db = getDb();
  const result = db.prepare(`
    UPDATE schedule_items
    SET start_at = COALESCE(?, start_at), end_at = COALESCE(?, end_at), title = COALESCE(?, title),
        transport = COALESCE(?, transport), notes = COALESCE(?, notes)
    WHERE id = ?
  `).run(input.startAt ?? null, input.endAt ?? null, input.title?.trim() || null, input.transport ?? null, input.notes ?? null, id);
  return result.changes > 0;
}

export function deleteScheduleItem(id: number) {
  const db = getDb();
  const item = db.prepare("SELECT start_at AS startAt, title FROM schedule_items WHERE id = ?").get(id) as Pick<ScheduleItem, "startAt" | "title"> | undefined;
  if (!item) return false;
  const transaction = db.transaction(() => {
    db.prepare("INSERT OR IGNORE INTO deleted_seed_schedule_items (start_at, title) VALUES (?, ?)").run(item.startAt, item.title);
    db.prepare("DELETE FROM schedule_items WHERE id = ?").run(id);
  });
  transaction();
  return true;
}

export function createComment(input: Pick<Comment, "placeId" | "author" | "content">) {
  const db = getDb();
  const result = db.prepare("INSERT INTO comments (place_id, author, content) VALUES (?, ?, ?)")
    .run(input.placeId, input.author.trim() || "우리", input.content.trim());
  return Number(result.lastInsertRowid);
}

export function saveEvaluation(placeId: number, metrics: ReviewMetrics & { evidenceNote?: string; verifiedAt?: string }) {
  const db = getDb();
  db.prepare(`
    INSERT INTO evaluations (place_id, naver_rating, naver_reviews, google_rating, google_reviews, kakao_rating, kakao_reviews,
      food, service, ambience, value, wait_score, itinerary_fit, evidence_note, verified_at, updated_at)
    VALUES (@placeId, @naverRating, @naverReviews, @googleRating, @googleReviews, @kakaoRating, @kakaoReviews,
      @food, @service, @ambience, @value, @wait, @itineraryFit, @evidenceNote, @verifiedAt, CURRENT_TIMESTAMP)
    ON CONFLICT(place_id) DO UPDATE SET
      naver_rating=excluded.naver_rating, naver_reviews=excluded.naver_reviews,
      google_rating=excluded.google_rating, google_reviews=excluded.google_reviews,
      kakao_rating=excluded.kakao_rating, kakao_reviews=excluded.kakao_reviews,
      food=excluded.food, service=excluded.service, ambience=excluded.ambience, value=excluded.value,
      wait_score=excluded.wait_score, itinerary_fit=excluded.itinerary_fit,
      evidence_note=excluded.evidence_note, verified_at=excluded.verified_at, updated_at=CURRENT_TIMESTAMP
  `).run({ placeId, ...metrics, evidenceNote: metrics.evidenceNote ?? "", verifiedAt: metrics.verifiedAt ?? "" });
  return calculateReviewScore(metrics);
}
