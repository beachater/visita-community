// Opening the review sheet from elsewhere (the walkthrough's info panel).
// On a cafe page whose review island has loaded, the sheet opens in place;
// otherwise (the map's walkthrough overlay) we go to the cafe page, which
// opens it on arrival.

export const WRITE_REVIEW_EVENT = "visita:write-review";

export function openReviewSheet(slug: string): void {
  const island = document.getElementById("reviews");
  if (island?.dataset.ready === slug) {
    window.dispatchEvent(new CustomEvent(WRITE_REVIEW_EVENT, { detail: { slug } }));
  } else {
    window.location.assign(`/cafe/${slug}?review=1#reviews`);
  }
}
