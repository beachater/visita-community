import { describe, expect, it } from "vitest";
import {
  PAGE_SIZE,
  afterCursorFilter,
  decodeCursor,
  encodeCursor,
  loadFirstReviewPage,
  loadReviewPage,
  splitPage,
  toSummary,
  type ReviewRow,
  type ReviewsClient,
} from "./page";
import { appendReviews } from "./more";
import { toClientReview } from "./page";

const VENUE = "aaaaaaaa-0000-0000-0000-000000000001";
const ME = "11111111-1111-1111-1111-111111111111";

const uuid = (n: number) => `00000000-0000-0000-0000-${n.toString(16).padStart(12, "0")}`;

// 250 reviews on one cafe. Every third pair shares a timestamp, so the id
// tie-break matters; a few are hidden by moderators. Ratings cycle 1..5.
function fixture(): ReviewRow[] {
  const base = Date.parse("2026-01-01T00:00:00Z");
  return Array.from({ length: 250 }, (_, i) => {
    const second = i % 3 === 0 && i > 0 ? i - 1 : i;
    return {
      id: uuid(i + 1),
      author_id: uuid(10_000 + i),
      rating: (i % 5) + 1,
      body: `Review ${i}`,
      photo_url: null,
      status: i % 17 === 0 ? "hidden" : "visible",
      created_at: new Date(base + second * 60_000).toISOString().replace("Z", "+00:00").replace(/\.(\d{3})/, ".$1123"),
      profiles: { display_name: `Visitor ${i}`, avatar_url: null },
      review_replies: null,
    } satisfies ReviewRow;
  });
}

// What RLS lets the caller read: visible reviews, plus their own.
function visibleTo(rows: ReviewRow[], userId: string | null) {
  return rows.filter((r) => r.status === "visible" || r.author_id === userId);
}

// A stand-in for the Supabase client that applies the same filters PostgREST
// would, including the `or` string the cursor turns into.
function fakeClient(all: ReviewRow[], userId: string | null) {
  const calls: { or: string[]; limits: number[]; orders: string[] } = { or: [], limits: [], orders: [] };
  const time = (s: string) => Date.parse(s) * 1000 + Number(s.match(/\.\d{3}(\d{3})/)?.[1] ?? 0);
  function query(rows: ReviewRow[]): any {
    return {
      // Every fixture review belongs to VENUE.
      eq: (col: keyof ReviewRow | "venue_id", v: string) => query(rows.filter((r) => (col === "venue_id" ? VENUE : r[col]) === v)),
      neq: (col: keyof ReviewRow, v: string) => query(rows.filter((r) => r[col] !== v)),
      or(filter: string) {
        calls.or.push(filter);
        const m = filter.match(/^created_at\.lt\."([^"]+)",and\(created_at\.eq\."([^"]+)",id\.lt\.([0-9a-f-]+)\)$/);
        if (!m || m[1] !== m[2]) throw new Error(`unexpected filter ${filter}`);
        const t = time(m[1]!);
        return query(rows.filter((r) => time(r.created_at) < t || (time(r.created_at) === t && r.id < m[3]!)));
      },
      order(col: "created_at" | "id", { ascending }: { ascending: boolean }) {
        calls.orders.push(`${col} ${ascending ? "asc" : "desc"}`);
        return query([...rows].sort((a, b) => time(b.created_at) - time(a.created_at) || (b.id < a.id ? -1 : b.id > a.id ? 1 : 0)));
      },
      limit(n: number) {
        calls.limits.push(n);
        return query(rows.slice(0, n));
      },
      maybeSingle: () => Promise.resolve({ data: rows[0] ?? null, error: rows.length > 1 ? { message: "many" } : null }),
      then: (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) => Promise.resolve({ data: rows, error: null }).then(resolve, reject),
    };
  }
  const client = {
    from: () => ({ select: () => query(visibleTo(all, userId)) }),
    rpc: (_fn: string, { p_venue_id }: { p_venue_id: string }) => {
      // Mirrors venue_review_summary: visible reviews only, rounded to one decimal.
      const ratings = all.filter((r) => r.status === "visible" && p_venue_id === VENUE).map((r) => r.rating);
      const avg = ratings.length ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : null;
      return Promise.resolve({ data: [{ average: avg, review_count: ratings.length }], error: null });
    },
  } as unknown as ReviewsClient;
  return { client, calls };
}

async function readAll(client: ReviewsClient, userId: string | null) {
  const first = await loadFirstReviewPage(client, VENUE, userId);
  let shown = first.reviews.map((r) => toClientReview(r, false));
  let cursor = first.nextCursor;
  let pages = 1;
  while (cursor) {
    const page = await loadReviewPage(client, VENUE, userId, cursor);
    shown = appendReviews(shown, page.reviews.map((r) => toClientReview(r, false)));
    cursor = page.nextCursor;
    pages++;
  }
  return { first, shown, pages };
}

describe("reviews past 100 (BEA-18)", () => {
  const rows = fixture();
  const visible = rows.filter((r) => r.status === "visible");

  it("has a fixture with well over 100 visible reviews", () => expect(visible.length).toBeGreaterThan(200));

  it("pages through every visible review exactly once, newest first", async () => {
    const { client } = fakeClient(rows, null);
    const { first, shown, pages } = await readAll(client, null);
    expect(first.reviews).toHaveLength(PAGE_SIZE);
    expect(pages).toBe(Math.ceil(visible.length / PAGE_SIZE));
    expect(shown.map((r) => r.id).sort()).toEqual(visible.map((r) => r.id).sort());
    expect(new Set(shown.map((r) => r.id)).size).toBe(shown.length);
    const times = shown.map((r) => Date.parse(r.createdAt));
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("takes the count and average from the database aggregate, not the first page", async () => {
    const { client } = fakeClient(rows, null);
    const first = await loadFirstReviewPage(client, VENUE, null);
    const mean = visible.reduce((sum, r) => sum + r.rating, 0) / visible.length;
    expect(first.summary).toEqual({ count: visible.length, average: Math.round(mean * 10) / 10 });
    expect(first.summary.count).toBeGreaterThan(100);
  });

  it("always shows the signed-in visitor's own review, however old, and not twice", async () => {
    const mine = { ...rows[3]!, author_id: ME }; // near the oldest end, far past 100
    const withMine = rows.map((r) => (r.id === mine.id ? mine : r));
    const { client } = fakeClient(withMine, ME);
    const { first, shown } = await readAll(client, ME);
    expect(first.own?.id).toBe(mine.id);
    expect(shown.some((r) => r.id === mine.id)).toBe(false);
    expect(shown).toHaveLength(visible.length - 1);
  });

  it("shows the visitor's own review even when a moderator hid it, without counting it", async () => {
    const mine = { ...rows[0]!, author_id: ME };
    expect(mine.status).toBe("hidden");
    const { client } = fakeClient(rows.map((r) => (r.id === mine.id ? mine : r)), ME);
    const first = await loadFirstReviewPage(client, VENUE, ME);
    expect(first.own?.id).toBe(mine.id);
    expect(toClientReview(first.own!, true)).toMatchObject({ own: true, hidden: true });
    expect(first.summary.count).toBe(visible.length);
  });

  it("orders by the cursor columns and asks for one row more than a page", async () => {
    const { client, calls } = fakeClient(rows, null);
    await loadReviewPage(client, VENUE, null);
    expect(calls.orders).toEqual(["created_at desc", "id desc"]);
    expect(calls.limits).toEqual([PAGE_SIZE + 1]);
  });

  it("rejects a tampered cursor instead of putting it in a filter", async () => {
    const { client } = fakeClient(rows, null);
    await expect(loadReviewPage(client, VENUE, null, "2026-01-01T00:00:00Z_x),status.eq.hidden")).rejects.toThrow(RangeError);
  });
});

describe("cursors", () => {
  const row = { created_at: "2026-11-14T03:04:05.123456+00:00", id: "bbbbbbbb-0000-0000-0000-000000000001" };

  it("round-trip", () => expect(decodeCursor(encodeCursor(row))).toEqual({ createdAt: row.created_at, id: row.id }));
  it("accept a UTC Z timestamp", () => expect(decodeCursor(`2026-11-14T03:04:05Z_${row.id}`)).not.toBeNull());
  it.each([null, "", "nope", `${row.created_at}_not-a-uuid`, `2026-13-45T99:99:99Z_${row.id}`, `x_${row.id}`, `${row.created_at}"_${row.id}`])(
    "reject %j",
    (raw) => expect(decodeCursor(raw)).toBeNull(),
  );
  it("quote the timestamp in the filter, since it holds + and :", () =>
    expect(afterCursorFilter({ createdAt: row.created_at, id: row.id })).toBe(
      `created_at.lt."${row.created_at}",and(created_at.eq."${row.created_at}",id.lt.${row.id})`,
    ));
});

describe("splitPage", () => {
  const rows = fixture().slice(0, 5);
  it("has no next page when the read fits", () => expect(splitPage(rows, 5).nextCursor).toBeNull());
  it("points the next page after the last row shown", () => {
    const page = splitPage(rows, 4);
    expect(page.reviews).toHaveLength(4);
    expect(page.nextCursor).toBe(encodeCursor(rows[3]!));
  });
});

describe("toSummary", () => {
  it("reads Postgres numeric as a number", () => expect(toSummary({ average: "4.3", review_count: 3 })).toEqual({ average: 4.3, count: 3 }));
  it("has no average without reviews", () => expect(toSummary({ average: null, review_count: 0 })).toEqual({ average: null, count: 0 }));
  it("copes with no row", () => expect(toSummary(undefined)).toEqual({ average: null, count: 0 }));
});
