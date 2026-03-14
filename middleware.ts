import { type NextRequest, NextResponse } from "next/server"

import { getSessionFromRequest } from "@/lib/auth/middleware"

const LOGIN_PATH = "/login"
const DASHBOARD_HOME_PATH = "/dashboard/home"

function redirectWithCookies(
  url: URL,
  sourceResponse: NextResponse
): NextResponse {
  const redirectResponse = NextResponse.redirect(url)
  sourceResponse.cookies.getAll().forEach(({ name, value }) => {
    redirectResponse.cookies.set(name, value)
  })
  return redirectResponse
}

export async function middleware(request: NextRequest) {
  const { user, response } = await getSessionFromRequest(request)
  const pathname = request.nextUrl.pathname
  const isLoginPage =
    pathname === LOGIN_PATH || pathname.startsWith(`${LOGIN_PATH}/`)

  if (user && isLoginPage) {
    return redirectWithCookies(
      new URL(DASHBOARD_HOME_PATH, request.url),
      response
    )
  }

  if (!user && !isLoginPage) {
    const loginUrl = new URL(LOGIN_PATH, request.url)
    loginUrl.searchParams.set("next", pathname)
    return redirectWithCookies(loginUrl, response)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, other static assets
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
}
