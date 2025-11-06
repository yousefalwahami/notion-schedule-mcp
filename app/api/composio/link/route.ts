import { NextResponse } from "next/server";
import { Composio } from "@composio/core";

export async function GET(request: Request) {
  try {
    const composioApiKey = process.env.COMPOSIO_API_KEY;
    const composioBase =
      process.env.COMPOSIO_BASE_URL || "https://backend.composio.dev";
    const authConfigId =
      process.env.COMPOSIO_AUTH_CONFIG_ID || "ac_JfypGVWUC8pZ";

    if (!composioApiKey) {
      return NextResponse.json(
        { error: "Composio API key not configured" },
        { status: 500 }
      );
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "User ID required" }, { status: 400 });
    }

    const origin = new URL(request.url).origin;
    const callbackUrl = `${origin}/api/composio/callback`;

    // Initialize Composio SDK
    const composio = new Composio({
      apiKey: composioApiKey,
      baseURL: composioBase,
    });

    console.log("Initiating connection for user:", userId);
    console.log("Using auth config:", authConfigId);
    console.log("Callback URL:", callbackUrl);

    // Use initiate method per official docs
    const connectionRequest = await composio.connectedAccounts.initiate(
      userId,
      authConfigId,
      { callbackUrl }
    );

    const redirectUrl = connectionRequest.redirectUrl;

    if (!redirectUrl) {
      throw new Error("No redirect URL returned from Composio");
    }

    console.log("Redirecting to:", redirectUrl);

    // Store connection request ID for callback
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.set(
      "composio_connection_request_id",
      connectionRequest.id,
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 3600,
      }
    );

    return response;
  } catch (error) {
    console.error("Error linking account:", error);
    return NextResponse.json(
      {
        error: "Failed to link account",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
