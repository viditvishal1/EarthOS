import { describe, expect, it } from "vitest";
import { parseAdsbRoute } from "@/lib/aviation/adsb-enrichment";

describe("parseAdsbRoute", () => {
  it("returns null for unknown routes", () => {
    expect(parseAdsbRoute({ airport_codes: "unknown" })).toBeNull();
  });

  it("parses ICAO and IATA airport codes", () => {
    const route = parseAdsbRoute({
      callsign: "RPA3504",
      airport_codes: "KEWR-KCLT",
      _airport_codes_iata: "EWR-CLT",
      airline_code: "RPA",
      number: "3504",
      plausible: true,
      _airports: [
        { icao: "KEWR", iata: "EWR", name: "Newark", lat: 40.69, lon: -74.17 },
        { icao: "KCLT", iata: "CLT", name: "Charlotte", lat: 35.21, lon: -80.94 },
      ],
    });
    expect(route?.airportCodes).toBe("KEWR-KCLT");
    expect(route?.airportCodesIata).toBe("EWR-CLT");
    expect(route?.airports).toHaveLength(2);
    expect(route?.airlineCode).toBe("RPA");
  });
});
