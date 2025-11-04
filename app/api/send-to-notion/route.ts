import { NextRequest, NextResponse } from "next/server";

interface Assignment {
  title: string;
  dueDate: string;
  weight: string;
  description?: string;
  type?: string;
  additionalNotes?: string;
}

interface ParsedSyllabus {
  fileName: string;
  courseName?: string;
  assignments: Assignment[];
  semester?: string;
  instructor?: string;
}

export async function POST(request: NextRequest) {
  try {
    const { results, notionDatabaseId } = (await request.json()) as {
      results: ParsedSyllabus[];
      notionDatabaseId?: string;
    };

    if (!results || results.length === 0) {
      return NextResponse.json(
        { error: "No results provided" },
        { status: 400 }
      );
    }

    const composioApiKey = process.env.COMPOSIO_API_KEY;
    if (!composioApiKey) {
      return NextResponse.json(
        { error: "Composio API key not configured" },
        { status: 500 }
      );
    }

    // Flatten all assignments from all syllabi
    const allAssignments = results.flatMap((syllabus) =>
      syllabus.assignments.map((assignment) => ({
        ...assignment,
        courseName: syllabus.courseName || "Unknown Course",
        semester: syllabus.semester || "",
        instructor: syllabus.instructor || "",
        fileName: syllabus.fileName,
      }))
    );

    // Use Composio MCP to create Notion pages
    // Composio action: NOTION_CREATE_PAGE
    const notionPages = [];

    for (const assignment of allAssignments) {
      try {
        // Make request to Composio API to create Notion page
        const response = await fetch(
          "https://backend.composio.dev/api/v1/actions/NOTION_CREATE_PAGE/execute",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-API-Key": composioApiKey,
            },
            body: JSON.stringify({
              input: {
                parent: notionDatabaseId
                  ? {
                      database_id: notionDatabaseId,
                    }
                  : {
                      page_id: "default", // User needs to configure their database
                    },
                properties: {
                  Name: {
                    title: [
                      {
                        text: {
                          content: assignment.title,
                        },
                      },
                    ],
                  },
                  Course: {
                    rich_text: [
                      {
                        text: {
                          content: assignment.courseName,
                        },
                      },
                    ],
                  },
                  "Due Date": {
                    date: {
                      start: assignment.dueDate,
                    },
                  },
                  Weight: {
                    rich_text: [
                      {
                        text: {
                          content: assignment.weight,
                        },
                      },
                    ],
                  },
                  Type: {
                    select: {
                      name: assignment.type || "Assignment",
                    },
                  },
                  Status: {
                    select: {
                      name: "Not Started",
                    },
                  },
                },
                children: [
                  {
                    object: "block",
                    type: "paragraph",
                    paragraph: {
                      rich_text: [
                        {
                          type: "text",
                          text: {
                            content:
                              assignment.description ||
                              "No description provided",
                          },
                        },
                      ],
                    },
                  },
                  ...(assignment.additionalNotes
                    ? [
                        {
                          object: "block",
                          type: "callout",
                          callout: {
                            rich_text: [
                              {
                                type: "text",
                                text: {
                                  content: assignment.additionalNotes,
                                },
                              },
                            ],
                            icon: {
                              emoji: "📝",
                            },
                          },
                        },
                      ]
                    : []),
                ],
              },
            }),
          }
        );

        if (!response.ok) {
          console.error(`Failed to create Notion page for ${assignment.title}`);
          continue;
        }

        const data = await response.json();
        notionPages.push({
          title: assignment.title,
          notionUrl: data.url,
        });
      } catch (error) {
        console.error(
          `Error creating Notion page for ${assignment.title}:`,
          error
        );
      }
    }

    return NextResponse.json({
      success: true,
      message: `Successfully created ${notionPages.length} out of ${allAssignments.length} assignments in Notion`,
      pages: notionPages,
    });
  } catch (error) {
    console.error("Error in send-to-notion route:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
