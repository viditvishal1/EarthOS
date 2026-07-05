import { describe, expect, it } from "vitest";
import { parseAisStreamMessage } from "./aisstream";

describe("parseAisStreamMessage", () => {
  it("maps PositionReport to vessel Item", () => {
    const item = parseAisStreamMessage({
      MessageType: "PositionReport",
      MetaData: { ShipName: "ARGUS TEST", MMSI: 123456789 },
      Message: {
        PositionReport: {
          UserId: 123456789,
          Latitude: 51.5,
          Longitude: -0.12,
          Sog: 12.3,
          Cog: 180,
        },
      },
    });
    expect(item).not.toBeNull();
    expect(item!.title).toBe("ARGUS TEST");
    expect(item!.lat).toBe(51.5);
    expect(item!.lon).toBe(-0.12);
    expect(item!.connectorId).toBe("aisstream_vessels");
  });

  it("ignores non-position messages", () => {
    expect(parseAisStreamMessage({ MessageType: "ShipStaticData" })).toBeNull();
  });
});
