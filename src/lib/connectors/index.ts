// Central connector registry — importing this module registers every
// connector. API routes import from here so the registry is always complete.

import "./news";
import "./earth";
import "./cyber";
import "./aviation";
import "./notams";
import "./maritime";
import "./space";
import "./markets";
import "./startup";
import "./government";
import "./patents";
import "./infrastructure";

export { NEWS_CONNECTOR_IDS, searchGoogleNews } from "./news";
export { EARTH_CONNECTOR_IDS, fetchWeather } from "./earth";
export { CYBER_CONNECTOR_IDS } from "./cyber";
export { AVIATION_CONNECTOR_IDS, fetchFlights, REGIONS } from "./aviation";
export { MARITIME_CONNECTOR_IDS } from "./maritime";
export { SPACE_CONNECTOR_IDS, fetchIss, fetchKIndex } from "./space";
export { MARKETS_CONNECTOR_IDS, fetchStockHistory, fetchCryptoHistory } from "./markets";
export { STARTUP_CONNECTOR_IDS, fetchReadme } from "./startup";
export { GOVERNMENT_CONNECTOR_IDS, searchDataGov } from "./government";
export { INFRASTRUCTURE_CONNECTOR_IDS, fetchPlatformStatuses } from "./infrastructure";
export {
  connectors,
  connectorStatuses,
  runConnector,
  runConnectors,
  runConnectorsWithBudget,
} from "./framework";

import { NEWS_CONNECTOR_IDS } from "./news";
import { EARTH_CONNECTOR_IDS } from "./earth";
import { CYBER_CONNECTOR_IDS } from "./cyber";
import { AVIATION_CONNECTOR_IDS } from "./aviation";
import { MARITIME_CONNECTOR_IDS } from "./maritime";
import { SPACE_CONNECTOR_IDS } from "./space";
import { MARKETS_CONNECTOR_IDS } from "./markets";
import { STARTUP_CONNECTOR_IDS } from "./startup";
import { GOVERNMENT_CONNECTOR_IDS } from "./government";
import { INFRASTRUCTURE_CONNECTOR_IDS } from "./infrastructure";

export const MODULE_CONNECTORS: Record<string, string[]> = {
  news: NEWS_CONNECTOR_IDS,
  earth: EARTH_CONNECTOR_IDS,
  cyber: CYBER_CONNECTOR_IDS,
  aviation: AVIATION_CONNECTOR_IDS,
  maritime: MARITIME_CONNECTOR_IDS,
  space: SPACE_CONNECTOR_IDS,
  markets: MARKETS_CONNECTOR_IDS,
  startup: STARTUP_CONNECTOR_IDS,
  government: GOVERNMENT_CONNECTOR_IDS,
  infrastructure: INFRASTRUCTURE_CONNECTOR_IDS,
};
