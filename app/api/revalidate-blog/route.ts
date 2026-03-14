import { NextResponse } from "next/server"

type RevalidateRequestBody = {
  slug?: string | null
}

/**
 * Admin-side proxy that securely forwards revalidation requests to website.
 * Keeps website revalidation secret on the server.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as RevalidateRequestBody
  const endpoint = process.env.WEBSITE_REVALIDATE_ENDPOINT
  const secret = process.env.WEBSITE_REVALIDATE_SECRET

  if (!endpoint || !secret) {
    return NextResponse.json(
      {
        ok: false,
        error:
          "Missing WEBSITE_REVALIDATE_ENDPOINT or WEBSITE_REVALIDATE_SECRET environment variables",
      },
      { status: 500 }
    )
  }

  const paths = ["/blog"]
  if (body.slug) {
    paths.push(`/blog/${body.slug}`)
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
      },
      body: JSON.stringify({
        secret,
        paths,
      }),
      cache: "no-store",
    })

    if (!response.ok) {
      const responseText = await response.text()
      return NextResponse.json(
        {
          ok: false,
          error: `Website revalidation failed: ${response.status} ${responseText}`,
        },
        { status: 502 }
      )
    }

    return NextResponse.json({ ok: true, paths })
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Unknown revalidation error",
      },
      { status: 502 }
    )
  }
}
