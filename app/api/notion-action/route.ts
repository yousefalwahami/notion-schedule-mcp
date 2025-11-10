import { NextRequest, NextResponse } from "next/server";
import { Composio } from "@composio/core";
import OpenAI from "openai";

// Helper function to transform database properties to Notion format
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformDbProperties(props: any[]) {
  // Return array format with name and type
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return props.map((prop: any) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const result: any = {
      name: prop.name,
      type: prop.type === "text" ? "rich_text" : prop.type,
    };

    // Add select options if present
    if (prop.type === "select" && prop.options) {
      result.select = {
        options: prop.options.map((o: string) => ({ name: o })),
      };
    }

    return result;
  });
}

// Helper function to transform page properties to Notion format
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function transformPageProperties(page: Record<string, any>) {
  // Return array format: [{name: "Field", type: "...", value: "..."}]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const propsArray: any[] = [];

  for (const [key, value] of Object.entries(page)) {
    if (key === "Name") {
      propsArray.push({
        name: key,
        type: "title",
        value: value ?? "",
      });
      continue;
    }

    if (key === "Due Date") {
      // If null/empty, skip this property entirely instead of sending "null"
      if (!value) {
        continue;
      }
      propsArray.push({
        name: key,
        type: "date",
        value: value,
      });
      continue;
    }

    if (["Course", "Type", "Status"].includes(key)) {
      // If null/empty, skip this property entirely
      if (!value) {
        continue;
      }
      propsArray.push({
        name: key,
        type: "select",
        value: value,
      });
      continue;
    }

    if (key === "Weight") {
      propsArray.push({
        name: key,
        type: "rich_text",
        value: value ?? "",
      });
      continue;
    }

    // ✅ Ignore unsupported fields
    // (your JSON includes `description`, Notion DB doesn't have that)
  }

  return propsArray;
}

export async function POST(request: NextRequest) {
  try {
    const composioApiKey = process.env.COMPOSIO_API_KEY;
    const groqApiKey = process.env.GROQ_API_KEY;

    if (!composioApiKey || !groqApiKey) {
      return NextResponse.json(
        { error: "API keys not configured" },
        { status: 500 }
      );
    }

    const userId = request.cookies.get("composio_user_id")?.value;
    if (!userId) {
      return NextResponse.json(
        { error: "User not connected. Please connect to Notion first." },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { prompt } = body;

    if (!prompt) {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

    console.log("Processing prompt for user:", userId);
    console.log("Prompt:", prompt);

    const composio = new Composio({
      apiKey: composioApiKey,
      baseURL: process.env.COMPOSIO_BASE_URL || "https://backend.composio.dev",
    });

    const openai = new OpenAI({
      apiKey: groqApiKey,
      baseURL: "https://api.groq.com/openai/v1",
    });

    console.log("Processing request...");

    const completion = await openai.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are a JSON generator. Extract database information and respond ONLY with valid JSON. No other text.\n\n" +
            "Format:\n" +
            "{\n" +
            '  "action": "create_database",\n' +
            '  "database_name": "string",\n' +
            '  "properties": [{"name": "string", "type": "title|date|select|rich_text", "options": ["opt1", "opt2"]}],\n' +
            '  "pages": [{"Name": "value", "Field": "value"}]\n' +
            "}\n\n" +
            "Valid types: title, date, select, rich_text\n" +
            "Only select type needs options array.\n" +
            "Generate clean, valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    console.log("AI response received");
    const responseText = completion.choices[0].message.content;
    console.log("Response:", responseText);

    if (!responseText) {
      return NextResponse.json({
        success: false,
        message: "No response from AI",
      });
    }

    const parsedResponse = JSON.parse(responseText);

    if (parsedResponse.action === "create_database") {
      const results = [];

      // Step 0: Search for a page to use as parent (or get workspace root)
      let parentId;
      try {
        console.log("Searching for parent page...");
        const searchResult = await composio.tools.execute(
          "NOTION_SEARCH_NOTION_PAGE",
          {
            userId: userId,
            arguments: {
              query: "",
            },
            version: "20251027_00",
          }
        );

        console.log("Search result:", JSON.stringify(searchResult, null, 2));

        // Use the first page found as parent, or we'll need to handle this differently
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const searchResults = (searchResult.data as any)?.results;
        if (searchResult.successful && searchResults?.length > 0) {
          parentId = searchResults[0].id;
          console.log("Using parent page ID:", parentId);
        } else {
          return NextResponse.json({
            success: false,
            message:
              "Could not find a parent page in your Notion workspace. Please create at least one page first.",
            results: [],
          });
        }
      } catch (searchError) {
        console.error("Error searching for parent:", searchError);
        return NextResponse.json({
          success: false,
          message: "Failed to find parent page",
          error:
            searchError instanceof Error
              ? searchError.message
              : "Unknown error",
        });
      }

      // Step 1: Create the database
      try {
        console.log("Creating database:", parsedResponse.database_name);

        // Transform properties to Notion format
        const properties = transformDbProperties(parsedResponse.properties);

        const dbResult = await composio.tools.execute(
          "NOTION_CREATE_DATABASE",
          {
            userId: userId,
            arguments: {
              parent_id: parentId,
              title: parsedResponse.database_name,
              properties: properties,
            },
            version: "20251027_00",
          }
        );

        console.log(
          "Database creation result:",
          JSON.stringify(dbResult, null, 2)
        );

        results.push({
          tool: "NOTION_CREATE_DATABASE",
          success: dbResult.successful,
          data: dbResult.data,
        });

        // Check if database was created successfully
        if (!dbResult.successful || !dbResult.data?.id) {
          console.error("Database creation failed or no ID returned");
          console.error("Full result:", dbResult);

          return NextResponse.json({
            success: false,
            message: "Failed to create database",
            results: results,
            error: dbResult.error || "No database ID returned",
          });
        }

        console.log("Database created successfully with ID:", dbResult.data.id);

        // Step 2: Add pages to the database (if any)
        if (parsedResponse.pages && parsedResponse.pages.length > 0) {
          for (const page of parsedResponse.pages) {
            try {
              console.log("Adding page:", page);

              const transformedProps = transformPageProperties(page);
              console.log(
                "Transformed properties:",
                JSON.stringify(transformedProps, null, 2)
              );

              const pageResult = await composio.tools.execute(
                "NOTION_INSERT_ROW_DATABASE",
                {
                  userId: userId,
                  arguments: {
                    database_id: dbResult.data.id,
                    properties: transformedProps,
                  },
                  version: "20251027_00",
                }
              );

              // console.log("Page result:", JSON.stringify(pageResult, null, 2));

              results.push({
                tool: "NOTION_INSERT_ROW_DATABASE",
                success: pageResult.successful,
                data: pageResult.data,
              });
            } catch (pageError) {
              console.error("Error adding page:", pageError);
              results.push({
                tool: "NOTION_INSERT_ROW_DATABASE",
                success: false,
                error:
                  pageError instanceof Error
                    ? pageError.message
                    : "Unknown error",
              });
            }
          }
        }
      } catch (error) {
        console.error("Error creating database:", error);
        results.push({
          tool: "NOTION_CREATE_DATABASE",
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
        });
      }

      return NextResponse.json({
        success: true,
        message: "Database operations completed",
        results: results,
      });
    }

    return NextResponse.json({
      success: true,
      message: responseText,
      results: [],
    });
  } catch (error) {
    console.error("Error in notion-action:", error);
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "An error occurred",
      },
      { status: 500 }
    );
  }
}
