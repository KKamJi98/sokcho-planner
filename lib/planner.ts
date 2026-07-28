import { getDb } from "./db";
import { calculateReviewScore, type ReviewMetrics } from "./scoring";

export type Place = {
  id: number;
  category: "관광지" | "음식점";
  name: string;
  mapUrl: string;
  notes: string;
  planAt: string;
  sortOrder: number;
  evaluation: (ReviewMetrics & { evidenceNote: string; verifiedAt: string }) | null;
};

export type Comment = { id: number; placeId: number | null; author: string; content: string; createdAt: string };

export function listPlanner() {
  const db = getDb();
  const places = db.prepare(`
    SELECT p.id, p.category, p.name, p.map_url AS mapUrl, p.notes, p.plan_at AS planAt, p.sort_order AS sortOrder,
      e.naver_rating AS naverRating, e.naver_reviews AS naverReviews,
      e.google_rating AS googleRating, e.google_reviews AS googleReviews,
      e.kakao_rating AS kakaoRating, e.kakao_reviews AS kakaoReviews,
      e.food, e.service, e.ambience, e.value, e.wait_score AS wait, e.itinerary_fit AS itineraryFit,
      e.evidence_note AS evidenceNote, e.verified_at AS verifiedAt
    FROM places p LEFT JOIN evaluations e ON e.place_id = p.id
    ORDER BY p.category, p.sort_order, p.id
  `).all() as Array<Place & ReviewMetrics & { evidenceNote?: string; verifiedAt?: string }>;
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
    comments,
  };
}

export function createPlace(input: Omit<Place, "id" | "sortOrder" | "evaluation">) {
  const db = getDb();
  const result = db.prepare(`
    INSERT INTO places (category, name, map_url, notes, plan_at, sort_order)
    VALUES (?, ?, ?, ?, ?, COALESCE((SELECT MAX(sort_order) + 10 FROM places), 10))
  `).run(input.category, input.name.trim(), input.mapUrl.trim(), input.notes.trim(), input.planAt);
  return Number(result.lastInsertRowid);
}

export function updatePlace(id: number, input: Partial<Pick<Place, "notes" | "planAt">>) {
  const db = getDb();
  db.prepare("UPDATE places SET notes = COALESCE(?, notes), plan_at = COALESCE(?, plan_at) WHERE id = ?")
    .run(input.notes ?? null, input.planAt ?? null, id);
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
