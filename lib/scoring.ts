export type ReviewMetrics = {
  naverRating?: number | null;
  naverReviews?: number | null;
  googleRating?: number | null;
  googleReviews?: number | null;
  kakaoRating?: number | null;
  kakaoReviews?: number | null;
  food?: number | null;
  service?: number | null;
  ambience?: number | null;
  value?: number | null;
  wait?: number | null;
  itineraryFit?: number | null;
};

const ratingToHundred = (rating?: number | null) =>
  rating == null ? null : Math.max(0, Math.min(100, rating * 20));

const weightedAverage = (values: Array<[number | null, number]>) => {
  const present = values.filter(([value]) => value != null) as Array<[number, number]>;
  if (!present.length) return null;
  const totalWeight = present.reduce((sum, [, weight]) => sum + weight, 0);
  return present.reduce((sum, [value, weight]) => sum + value * weight, 0) / totalWeight;
};

/** Deterministic 100-point score; review counts increase confidence, not the rating itself. */
export function calculateReviewScore(metrics: ReviewMetrics) {
  const platformScore = weightedAverage([
    [ratingToHundred(metrics.naverRating), 0.4],
    [ratingToHundred(metrics.googleRating), 0.35],
    [ratingToHundred(metrics.kakaoRating), 0.25],
  ]);
  const qualitativeScore = weightedAverage([
    [metrics.food ?? null, 0.35],
    [metrics.service ?? null, 0.15],
    [metrics.ambience ?? null, 0.1],
    [metrics.value ?? null, 0.15],
    [metrics.wait ?? null, 0.1],
    [metrics.itineraryFit ?? null, 0.15],
  ]);
  const score = weightedAverage([
    [platformScore, 0.45],
    [qualitativeScore, 0.55],
  ]);
  const reviewCount = (metrics.naverReviews ?? 0) + (metrics.googleReviews ?? 0) + (metrics.kakaoReviews ?? 0);
  const confidence = reviewCount >= 1000 ? "높음" : reviewCount >= 200 ? "보통" : "낮음";
  return { score: score == null ? null : Math.round(score * 10) / 10, confidence, reviewCount };
}
