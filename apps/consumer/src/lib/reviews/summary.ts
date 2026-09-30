/** Average rating to one decimal, over visible reviews only. */
export function ratingSummary(ratings: number[]): { average: number | null; count: number } {
  if (ratings.length === 0) return { average: null, count: 0 };
  const mean = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  return { average: Math.round(mean * 10) / 10, count: ratings.length };
}
