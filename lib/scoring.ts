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
  verifiedAt?: string | null;
};

const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const ratingToHundred = (rating?: number | null) => rating == null ? null : clamp(rating * 20);
const average = (values: Array<number | null | undefined>) => {
  const present = values.filter((value): value is number => value != null);
  return present.length ? present.reduce((sum, value) => sum + value, 0) / present.length : null;
};

function recencyScore(verifiedAt: string | null | undefined, now: Date) {
  if (!verifiedAt) return 0;
  const observed = new Date(`${verifiedAt}T00:00:00Z`);
  if (Number.isNaN(observed.valueOf()) || observed > now) return 0;
  const days = (now.valueOf() - observed.valueOf()) / 86_400_000;
  if (days <= 14) return 15;
  if (days <= 30) return 12;
  if (days <= 90) return 7;
  return 3;
}

/**
 * A conservative 100-point comparison score. It rewards corroboration and recent
 * evidence; a candidate still needs the separate operational hard-filter review.
 */
export function calculateReviewScore(metrics: ReviewMetrics, now = new Date()) {
  const ratings = [ratingToHundred(metrics.naverRating), ratingToHundred(metrics.googleRating), ratingToHundred(metrics.kakaoRating)];
  const platformAverage = average(ratings);
  const platformScore = platformAverage == null ? 0 : (platformAverage / 100) * 30 * (ratings.filter((rating) => rating != null).length / 3);

  const reviewCount = (metrics.naverReviews ?? 0) + (metrics.googleReviews ?? 0) + (metrics.kakaoReviews ?? 0);
  const volumeScore = Math.min(15, (Math.log10(Math.max(0, reviewCount) + 1) / 3) * 15);
  const contentAverage = average([metrics.food, metrics.service, metrics.ambience, metrics.value]);
  const contentScore = contentAverage == null ? 0 : (clamp(contentAverage) / 100) * 25;
  const operationalAverage = average([metrics.wait, metrics.itineraryFit]);
  const operationalScore = operationalAverage == null ? 0 : (clamp(operationalAverage) / 100) * 15;
  const hasEvidence = platformAverage != null || contentAverage != null || operationalAverage != null || reviewCount > 0;
  const score = hasEvidence ? platformScore + volumeScore + recencyScore(metrics.verifiedAt, now) + contentScore + operationalScore : null;
  const platformCount = ratings.filter((rating) => rating != null).length;
  const confidence = platformCount >= 2 && reviewCount >= 200 && recencyScore(metrics.verifiedAt, now) >= 12
    ? "높음"
    : platformCount >= 2 || reviewCount >= 100 ? "보통" : "낮음";
  return { score: score == null ? null : Math.round(score * 10) / 10, confidence, reviewCount, platformCount };
}
