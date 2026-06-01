import { NextResponse, type NextRequest } from "next/server";

const PUBLIC_FILE = /\.(.*)$/;

function isPublicPath(pathname: string) {
  return (
    pathname === "/login" ||
    pathname === "/api/health" ||
    pathname === "/api/auth/session" ||
    pathname === "/api/auth/logout" ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/icons/") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname === "/favicon.ico" ||
    PUBLIC_FILE.test(pathname)
  );
}

export async function middleware(request: NextRequest) {
  const session = request.cookies.get("session")?.value;
  const { pathname } = request.nextUrl;
  const isApi = pathname.startsWith("/api/");

  if (!session && !isPublicPath(pathname)) {
    if (isApi) {
      return NextResponse.json({ message: "Please sign in to continue." }, { status: 401 });
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (session && pathname === "/login") {
    const homeUrl = request.nextUrl.clone();
    homeUrl.pathname = "/";
    homeUrl.search = "";
    return NextResponse.redirect(homeUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/image).*)"]
};
