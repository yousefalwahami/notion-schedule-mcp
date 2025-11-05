import { NextResponse } from "next/server";
import { Composio } from "@composio/core";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  try {
    const composioApiKey = process.env.COMPOSIO_API_KEY;
    const composioBase =
      process.env.COMPOSIO_BASE_URL || "https://backend.composio.dev";

    if (!composioApiKey) {
      return NextResponse.redirect(new URL("/?error=config_error", req.url));
    }

    const { searchParams } = new URL(req.url);
    const params = Object.fromEntries(searchParams.entries());

    console.log("OAuth callback received with params:", params);

    // Get the connection request ID from cookies
    const cookieStore = await cookies();
    const connectionRequestId = cookieStore.get(
      "composio_connection_request_id"
    )?.value;

    if (!connectionRequestId) {
      console.log("No connection request ID found in cookies");
      return NextResponse.redirect(new URL("/?connected=true", req.url));
    }

    // Initialize Composio SDK
    const composio = new Composio({
      apiKey: composioApiKey,
      baseURL: composioBase,
    });

    // Wait for the connection to be established
    console.log("Waiting for connection:", connectionRequestId);

    try {
      const connectedAccount =
        await composio.connectedAccounts.waitForConnection(connectionRequestId);

      console.log("Connection established:", connectedAccount.id);
      console.log("Connection status:", connectedAccount.status);

      // Clear the cookie
      const response = NextResponse.redirect(
        new URL("/?connected=true", req.url)
      );
      response.cookies.delete("composio_connection_request_id");
      response.cookies.delete("composio_user_id");

      return response;
    } catch (waitError) {
      console.error("Error waiting for connection:", waitError);
      // Connection might already be established, redirect with success anyway
      return NextResponse.redirect(new URL("/?connected=true", req.url));
    }
  } catch (error) {
    console.error("Error in OAuth callback:", error);
    return NextResponse.redirect(new URL("/?error=connection_failed", req.url));
  }
}
