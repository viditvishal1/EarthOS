import { NextRequest } from "next/server";
import { GET as viewportGET } from "@/app/api/map/viewport/route";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** v1 viewport-bounded map API — delegates to existing implementation. */
export async function GET(req: NextRequest) {
  return viewportGET(req);
}
