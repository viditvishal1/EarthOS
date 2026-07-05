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
import "./gdelt";
import "./conflict";
import "./macro";
import "./firms";

export { NEWS_CONNECTOR_IDS, searchGoogleNews } from "./news";
export { FIRMS_CONNECTOR_ID } from "./firms";
export { EARTH_CONNECTOR_IDS, fetchWeather } from "./earth";
export { CYBER_CONNECTOR_IDS } from "./cyber";
export { AVIATION_CONNECTOR_IDS, fetchFlights, REGIONS } from "./aviation";
export { MARITIME_CONNECTOR_IDS } from "./maritime";
export { SPACE_CONNECTOR_IDS, fetchIss, fetchKIndex } from "./space";
export { MARKETS_CONNECTOR_IDS, fetchStockHistory, fetchCryptoHistory } from "./markets";
export { STARTUP_CONNECTOR_IDS, fetchReadme } from "./startup";
export { GOVERNMENT_CONNECTOR_IDS, searchDataGov } from "./government";
export { INFRASTRUCTURE_CONNECTOR_IDS, fetchPlatformStatuses } from "./infrastructure";
export { GDELT_CONNECTOR_ID } from "./gdelt";
export { CONFLICT_CONNECTOR_IDS } from "./conflict";
export { MACRO_CONNECTOR_IDS } from "./macro";
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
import { GDELT_CONNECTOR_ID } from "./gdelt";
import { CONFLICT_CONNECTOR_IDS } from "./conflict";
import { MACRO_CONNECTOR_IDS } from "./macro";

export const MODULE_CONNECTORS: Record<string, string[]> = {
  news: [...NEWS_CONNECTOR_IDS, GDELT_CONNECTOR_ID],
  conflict: CONFLICT_CONNECTOR_IDS,
  macro: MACRO_CONNECTOR_IDS,
  earth: [...EARTH_CONNECTOR_IDS, "nasa-firms"],
  cyber: CYBER_CONNECTOR_IDS,
  aviation: AVIATION_CONNECTOR_IDS,
  maritime: MARITIME_CONNECTOR_IDS,
  space: SPACE_CONNECTOR_IDS,
  markets: MARKETS_CONNECTOR_IDS,
  startup: STARTUP_CONNECTOR_IDS,
  government: GOVERNMENT_CONNECTOR_IDS,
  infrastructure: INFRASTRUCTURE_CONNECTOR_IDS,
};
