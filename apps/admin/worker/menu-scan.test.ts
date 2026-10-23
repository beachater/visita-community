import { afterEach, describe, expect, it, vi } from "vitest";
import worker from "./index";

const VENUE = "aaaaaaaa-0000-4000-8000-000000000001";
const path = `https://admin.example.test/api/venues/${VENUE}/menu-scan`;
const image = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0]);

function request(type = "image/jpeg", bytes = image) {
  return new Request(path, {
    method: "POST",
    headers: { authorization: "Bearer visitor-token", "content-type": type },
    body: bytes,
  }) as Parameters<typeof worker.fetch>[0];
}

function env(answer: unknown = { items: [{ name: "Latte", price: 140, section: "Coffee" }] }) {
  const run = vi.fn().mockResolvedValue({ response: answer });
  return {
    run,
    value: {
      AI: { run },
      SUPABASE_URL: "https://supabase.example.test",
      SUPABASE_PUBLISHABLE_KEY: "public-test-key",
    },
  };
}

function auth(owner: boolean, admin = false) {
  const fetch = vi.fn((input: string | URL | Request) => {
    const url = String(input);
    if (url.endsWith("/rpc/is_venue_owner")) return Promise.resolve(Response.json(owner));
    if (url.endsWith("/rpc/is_admin")) return Promise.resolve(Response.json(admin));
    throw new Error(`Unexpected request: ${url}`);
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => vi.unstubAllGlobals());

describe("menu scan Worker route", () => {
  it("returns editable rows to an owner without writing the menu", async () => {
    const fetch = auth(true);
    const binding = env();
    const response = await worker.fetch(request(), binding.value as never);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ rows: [{ name: "Latte", price: "140", section: "Coffee", note: "" }] });
    expect(binding.run).toHaveBeenCalledOnce();
    const [model, options] = binding.run.mock.calls[0]!;
    expect(model).toBe("@cf/meta/llama-4-scout-17b-16e-instruct");
    expect(options.guided_json).toHaveProperty("required", ["items"]);
    expect(options.messages[1].content[1].image_url.url).toMatch(/^data:image\/jpeg;base64,/);
    expect(fetch).toHaveBeenCalledTimes(2); // The two role checks; no database write.
  });

  it("rejects someone who owns neither the venue nor an admin role", async () => {
    auth(false);
    const binding = env();
    const response = await worker.fetch(request(), binding.value as never);
    expect(response.status).toBe(404);
    expect(binding.run).not.toHaveBeenCalled();
  });

  it("accepts an admin and rejects unsupported photo bytes before AI runs", async () => {
    auth(false, true);
    const binding = env();
    const response = await worker.fetch(request("image/gif", new Uint8Array([0x47, 0x49, 0x46, 0x38])), binding.value as never);
    expect(response.status).toBe(415);
    expect(binding.run).not.toHaveBeenCalled();
  });

  it("returns a plain retry message when the model fails", async () => {
    auth(true);
    const binding = env();
    binding.run.mockRejectedValueOnce(new Error("private model detail"));
    const response = await worker.fetch(request(), binding.value as never);
    expect(response.status).toBe(502);
    expect(JSON.stringify(await response.json())).not.toContain("private model detail");
  });

  it("asks for another photo when no items can be read", async () => {
    auth(true);
    const binding = env("no items here");
    const response = await worker.fetch(request(), binding.value as never);
    expect(response.status).toBe(422);
  });
});
