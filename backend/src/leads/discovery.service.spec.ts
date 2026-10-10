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
    vi.stubEnv("SERPAPI_API_KEY", "test-key");
    vi.stubEnv("HEXAWAVE_DISCOVERY_DAILY_ENABLED", "false");
    leads = new LeadsService();
    discovery = new DiscoveryService(leads);
    fetchMock = vi.fn(async () => new Response(JSON.stringify({
      organic_results: [{
        title: "Example Systems",
        link: "https://example.com/about",
        snippet: "An example public search result.",
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
    const queries = fetchMock.mock.calls.map(([input]) => new URL(String(input)).searchParams.get("q"));

    expect(fetchMock).toHaveBeenCalledTimes(6);
    expect(queries).toEqual(expect.arrayContaining([
      expect.stringContaining("small business OR startup"),
      expect.stringContaining("mid-sized company"),
      expect.stringContaining("large enterprise"),
      expect.stringContaining("India official website"),
      expect.stringContaining("International official website"),
    ]));
    expect(result.status).toBe("completed");
    expect(result.added).toBe(1);
    expect(result.skipped).toBe(5);

    const lead = leads.list()[0];
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
    vi.stubEnv("SERPAPI_API_KEY", "");
    await expect(discovery.runNow()).rejects.toBeInstanceOf(
      ServiceUnavailableException,
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not enable the daily schedule without provider credentials", () => {
    vi.stubEnv("SERPAPI_API_KEY", "");
    expect(() => discovery.updateSchedule(true)).toThrow(
      ServiceUnavailableException,
    );
    expect(discovery.status().scheduleEnabled).toBe(false);
  });

  it("rejects invalid target segments before searching", async () => {
    await expect(discovery.runNow({
      industries: ["technology"],
      sizeSegments: ["unknown" as "small"],
    })).rejects.toThrow("Choose at least one supported company-size segment.");
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
