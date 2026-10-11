import { NextResponse, type NextRequest } from "next/server";
import { parseView, VIEW_COOKIE, VIEW_MAX_AGE } from "~/lib/view";

const CANONICAL_HOST = "jenkinsdetailing.com";
/**
 * The review deploy (`wrangler deploy --env preview`, see wrangler.jsonc) answers on its own
 * workers.dev address: served in place for the client to check, and kept out of search.
 */
const PREVIEW_HOST_PREFIX = "jenkins-detailing-preview.";

/**
 * Where the old OpenCart addresses go. The previous site lived entirely under
 * /index.php?route=...; every service category and information page maps to its new
 * home so search rankings carry over, and anything unmapped lands on the home page.
 */
const OLD_CATEGORY: Record<string, string> = {
  "89": "/services",
  "89_88": "/services/undersealing",
  "89_91": "/services/detailing",
  "89_92": "/services/paint-correction",
  "89_93": "/services/sanitising",
  "89_94": "/services/yacht-detailing",
  "90": "/services",
  "87": "/services",
  "95": "/services",
};
const OLD_INFORMATION: Record<string, string> = {
  "1": "/about",
  "2": "/terms",
  "3": "/privacy",
  "4": "/about",
  "6": "/contact",
};

function legacyRedirect(url: URL): string | null {
  if (url.pathname !== "/index.php") return null;
  const route = url.searchParams.get("route") ?? "";
  if (route === "product/category") return OLD_CATEGORY[url.searchParams.get("path") ?? ""] ?? "/services";
  if (route === "information/information") return OLD_INFORMATION[url.searchParams.get("information_id") ?? ""] ?? "/";
  if (route === "information/contact") return "/contact";
  if (route.startsWith("product/")) return "/services";
  return "/";
}

/**
 * One address for the site. The www alias and the workers.dev origin both answer, but
 * they redirect permanently to the apex so search engines and shared links agree on a
 * single canonical host. Local and preview hosts are left alone; the review deploy's
 * pages also carry noindex. Old OpenCart addresses are redirected on every host.
 */
export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const url = request.nextUrl.clone();
  const legacy = legacyRedirect(url);
  const preview = host.startsWith(PREVIEW_HOST_PREFIX) && host.endsWith(".workers.dev");
  const wrongHost = host === `www.${CANONICAL_HOST}` || (host.endsWith(".workers.dev") && !preview);
  if (!legacy && !wrongHost) {
    const response = NextResponse.next();
    if (preview) response.headers.set("X-Robots-Tag", "noindex, nofollow");
    const view = parseView(url.searchParams.get("view"));
    if (url.pathname === "/watch" && view) {
      response.cookies.set(VIEW_COOKIE, view, {
        path: "/",
        maxAge: VIEW_MAX_AGE,
        sameSite: "lax",
        secure: url.protocol === "https:",
      });
    }
    return response;
  }
  if (wrongHost) {
    url.protocol = "https:";
    url.host = CANONICAL_HOST;
    url.port = "";
  }
  if (legacy) {
    url.pathname = legacy;
    url.search = "";
  }
  return NextResponse.redirect(url, 301);
}

export const config = {
  // Pages, metadata routes and the old index.php; static files and the API keep their own hosts.
  matcher: ["/((?!_next/|api/|photos/|photos-derived/|videos/|og/|brand/|icons/|models/|decoders/|admin/|favicon.ico).*)"],
};
