import { NextRequest, NextResponse } from "next/server";

// Simplified route - just return empty for now
// Users will use the AI interface to work with Notion databases
export async function GET(request: NextRequest) {
  try {
    const userId = request.cookies.get("composio_user_id")?.value;
    if (!userId) {
      return NextResponse.json(
        { error: "User not connected. Please connect to Notion first." },
        { status: 401 }
      );
    }

    // For now, return empty databases list
    // The AI via /api/notion-action will handle all Notion operations
    console.log("Database list requested for user:", userId);

    return NextResponse.json({
      databases: [],
      message:
        "Use the AI prompt interface to create and manage Notion databases",
    });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "An error occurred",
      },
      { status: 500 }
    );
  }
}
