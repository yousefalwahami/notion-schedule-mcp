import { NextResponse } from "next/server";

export async function GET(request: Request) {
  try {
    const composioApiKey = process.env.COMPOSIO_API_KEY;

    if (!composioApiKey) {
      return NextResponse.json(
        { error: "Composio API key not configured" },
        { status: 500 }
      );
    }

    const origin = new URL(request.url).origin;

    // Generate a unique user ID (in production, use your actual user ID)
    const userId = `user-${Math.random().toString(36).substring(2, 15)}`;

    // Store userId in a cookie so we can retrieve it in the callback
    const response = NextResponse.redirect(
      `${origin}/api/composio/link?userId=${userId}`
    );
    response.cookies.set("composio_user_id", userId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 3600, // 1 hour
    });

    return response;
  } catch (error) {
    console.error("Error in connect-notion:", error);
    return NextResponse.json(
      {
        error: "Failed to initiate connection",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
