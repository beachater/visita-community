// Only deliberate product copy may cross from an API response into the UI.
// An upstream error, proxy response, or future server regression must not
// expose a stack trace, URL, status body, or implementation detail.
const PUBLIC_API_MESSAGES = new Set([
  "Accounts aren't available yet.",
  "Sign in to write a review.",
  "Sign in to add a photo.",
  "You've already reviewed this cafe. Edit your review instead.",
  "You can't review a cafe you manage.",
  "You haven't reviewed this cafe yet.",
  "You haven't reviewed this cafe.",
  "Pick a rating from 1 to 5 stars.",
  "Review text must be text.",
  "Keep it under 5000 characters.",
  "Unknown cafe.",
  "Couldn't post your review. Try again.",
  "Couldn't save your changes. Try again.",
  "Couldn't delete your review. Try again.",
  "Photos can be up to 8 MB.",
  "The photo is empty.",
  "That file isn't a JPEG, PNG or WebP photo.",
  "That review isn't yours.",
  "Couldn't attach the photo. Try again.",
  "Too many requests. Try again in a minute.",
  "This cafe is already scanned.",
  "Requests aren't available yet.",
  "Couldn't save your request. Try again later.",
]);

export function publicApiMessage(value: unknown, fallback: string): string {
  return typeof value === "string" && PUBLIC_API_MESSAGES.has(value) ? value : fallback;
}
