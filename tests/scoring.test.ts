import assert from "node:assert/strict";
import test from "node:test";
import { calculateReviewScore } from "../lib/scoring";

test("calculates a deterministic weighted score", () => {
  const result = calculateReviewScore({
    naverRating: 4.5,
    googleRating: 4.0,
    kakaoRating: 4.0,
    food: 90,
    service: 80,
    ambience: 70,
    value: 85,
    wait: 70,
    itineraryFit: 95,
    naverReviews: 500,
    googleReviews: 300,
    kakaoReviews: 250,
  });
  assert.equal(result.score, 84.3);
  assert.equal(result.confidence, "높음");
});

test("does not invent a score when no metric exists", () => {
  assert.deepEqual(calculateReviewScore({}), { score: null, confidence: "낮음", reviewCount: 0 });
});
