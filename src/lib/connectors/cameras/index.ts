/** Connector registry bridge — CCTV agency adapters remain in lib/live/cctv. */
export {
  CCTV_ADAPTERS,
  CCTV_SOURCES,
  fetchAllCctvCameras,
  fetchCctvBySource,
  isAdapterEnabled,
  type CctvCamera,
  type CctvSource,
} from "@/lib/live/cctv";

export {
  CAMERA_PROVIDERS,
  cameraAttribution,
  cameraLegalMode,
  getCameraProvider,
  isAllowlistedCameraUrl,
} from "@/lib/cameras/registry";

export { queryCameras, type CameraRecord } from "@/lib/cameras/service";
