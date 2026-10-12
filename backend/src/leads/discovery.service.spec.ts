import {
  ConflictException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiscoveryService } from "./discovery.service";
import { LeadsService } from "./leads.service";

describe("DiscoveryService", () => {
  let leads: LeadsService;
  let discovery: DiscoveryService;
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.stubEnv("TAVILY_API_KEY", "test-key");
    vi.stubEnv("HEXAWAVE_DISCOVERY_DAILY_ENABLED", "false");
    leads = new LeadsService();
    discovery = new DiscoveryService(leads);
    fetchMock = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response(JSON.stringify({
      results: [{
        title: "Example Systems",
        url: "https://example.com/about",
        content: "An example public search result.",
      }],
    })));
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    discovery.onModuleDestroy();
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("searches each requested company-size segment in India and internationally", async () => {
    const result = await discovery.runNow({
      industries: ["healthcare"],
      sizeSegments: ["small", "medium", "large"],
    });
    const requests = fetchMock.mock.calls.map(([input, init]) => ({
      url: String(input),
      body: JSON.parse(String(init?.body)) as {
        api_key: string;
        query: string;
        country?: string;
      },
    }));
    const queries = requests.map(({ body }) => body.query);

    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(requests.every(({ url }) => url === "https://api.tavily.com/search")).toBe(true);
    expect(requests[0].body.api_key).toBe("test-key");
    expect(requests[0].body.country).toBe("india");
    expect(requests[1].body.country).toBeUndefined();
    expect(queries).toEqual(expect.arrayContaining([
      expect.stringContaining("small business OR startup"),
      expect.stringContaining("mid-sized company"),
      expect.stringContaining("large enterprise"),
      expect.stringContaining("India official website"),
      expect.stringContaining("international official website"),
    ]));
    expect(result.status).toBe("completed");
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(5);

    const lead = leads.list()[0];
    expect(lead.source).toBe("Tavily Search API");
    expect(lead.sourceUrl).toBe("https://example.com/about");
    expect(lead.email).toBe("");
    expect(lead.qualification).toBe("UNSCORED");
    expect(lead.targetSizeSegment).toBe("small");
  });

  it("caps total provider queries per UTC day", async () => {
    await discovery.runNow();
    await expect(discovery.runNow()).rejects.toBeInstanceOf(ConflictException);
    expect(fetchMock).toHaveBeenCalledTimes(6);
  });

  it("does not claim a search succeeded when the provider is not configured", async () => {
    vi.stubEnv("TAVILY_API_KEY", "");
    await expect(discovery.runNow()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not enable the daily schedule without provider credentials", () => {
    vi.stubEnv("TAVILY_API_KEY", "");
    expect(() => discovery.updateSchedule(true)).toThrow(
      ServiceUnavailableException,
    );
    expect(discovery.status().scheduleEnabled).toBe(false);
  });

  it("reports Tavily as the configured discovery provider", () => {
    expect(discovery.status()).toMatchObject({
      provider: "Tavily Search API",
      providerConfigured: true,
    });
  });

  it("does not forward a provider error response into CRM errors", async () => {
    fetchMock.mockResolvedValueOnce(new Response("invalid API key: test-key", { status: 401 }));

    await expect(discovery.runNow({
      industries: ["healthcare"],
      sizeSegments: ["small"],
    })).rejects.toThrow("Tavily Search API returned HTTP 401");
    expect(discovery.status().lastRun.error).toContain("Tavily Search API returned HTTP 401");
    expect(discovery.status().lastRun.error).not.toContain("test-key");
  });

  it("rejects invalid target segments before searching", async () => {
    await expect(discovery.runNow({
      industries: ["technology"],
      sizeSegments: ["unknown" as "small"],
    })).rejects.toThrow("Choose at least one supported company-size segment.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
