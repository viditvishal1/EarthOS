import type { CctvSource } from "@/lib/live/cctv/types";

export type CameraLegalMode =
  | "image"
  | "hls"
  | "youtube_embed"
  | "external_only"
  | "unavailable";

export interface CameraProviderDefinition {
  id: CctvSource;
  label: string;
  attribution: string;
  licenseUrl: string;
  legalMode: CameraLegalMode;
  allowlistedHosts: string[];
  regions: string[];
}

export const CAMERA_PROVIDERS: CameraProviderDefinition[] = [
  {
    id: "tfl",
    label: "TfL JamCams",
    attribution: "Transport for London open data",
    licenseUrl: "https://tfl.gov.uk/info/terms/",
    legalMode: "image",
    allowlistedHosts: ["tfl.gov.uk", "jamcam.tfl.gov.uk"],
    regions: ["London"],
  },
  {
    id: "wsdot",
    label: "WSDOT",
    attribution: "Washington State DOT",
    licenseUrl: "https://wsdot.wa.gov/about/policies/web-privacy-notice",
    legalMode: "image",
    allowlistedHosts: ["wsdot.wa.gov", "images.wsdot.wa.gov"],
    regions: ["Washington"],
  },
  {
    id: "caltrans",
    label: "Caltrans",
    attribution: "California DOT",
    licenseUrl: "https://dot.ca.gov/legal",
    legalMode: "image",
    allowlistedHosts: ["dot.ca.gov", "video.dot.ca.gov"],
    regions: ["California"],
  },
  {
    id: "nycdot",
    label: "NYC DOT / 511NY",
    attribution: "NYSDOT / NYC DOT",
    licenseUrl: "https://511ny.org/about/terms",
    legalMode: "image",
    allowlistedHosts: ["511ny.org", "nyc.gov"],
    regions: ["New York"],
  },
  {
    id: "vicroads",
    label: "VicRoads",
    attribution: "VicRoads Victoria",
    licenseUrl: "https://www.vicroads.vic.gov.au/about-vicroads/terms-and-conditions",
    legalMode: "image",
    allowlistedHosts: ["vicroads.vic.gov.au"],
    regions: ["Victoria"],
  },
];

const byId = new Map(CAMERA_PROVIDERS.map((p) => [p.id, p]));

export function getCameraProvider(id: CctvSource): CameraProviderDefinition | undefined {
  return byId.get(id);
}

export function isAllowlistedCameraUrl(source: CctvSource, url: string): boolean {
  const provider = getCameraProvider(source);
  if (!provider) return false;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return provider.allowlistedHosts.some((h) => host === h || host.endsWith(`.${h}`));
  } catch {
    return false;
  }
}

export function cameraLegalMode(source: CctvSource): CameraLegalMode {
  return getCameraProvider(source)?.legalMode ?? "unavailable";
}

export function cameraAttribution(source: CctvSource): string {
  return getCameraProvider(source)?.attribution ?? source;
}
