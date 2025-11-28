import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
// Import worker BEFORE PDFParse for serverless environments (Vercel, AWS Lambda, etc.)
import "pdf-parse/worker";
import { PDFParse, VerbosityLevel } from "pdf-parse";
import * as mammoth from "mammoth";

// Groq AI configuration
const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: "https://api.groq.com/openai/v1",
});

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

async function extractTextFromDOCX(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const buffer = Buffer.from(arrayBuffer);

    const result = await mammoth.extractRawText({ buffer });

    return result.value || "";
  } catch (error) {
    console.error("DOCX parse error:", error);
    throw new Error("Failed to extract text from DOCX");
  }
}

async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    // Convert ArrayBuffer to Buffer for pdf-parse v2
    const buffer = Buffer.from(arrayBuffer);

    // Initialize PDFParse with buffer data
    // Note: Worker configuration is automatic in Node.js/serverless environments
    // pdf-parse v2 handles worker setup automatically for Next.js/Vercel
    const parser = new PDFParse({
      data: buffer,
      verbosity: VerbosityLevel.ERRORS, // Reduce logging in production
    });

    // Extract text from PDF
    const result = await parser.getText();

    // Clean up resources
    await parser.destroy();

    return result.text;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
    if (error instanceof Error) {
      console.error("Error details:", error.message);
    }
    throw new Error("Failed to extract text from PDF");
  }
}
async function parseAssignmentsWithAI(
  text: string,
  fileName: string
): Promise<ParsedSyllabus> {
const prompt = `You are an expert at parsing course syllabi. Extract all assignments, exams, projects, and deadlines from the following syllabus text.

For each assignment/deadline, extract:
1. Title/Name
2. Due Date - CRITICAL FORMAT RULES:
   - MUST be a specific date like "2025-01-15", "Jan 15, 2025", "01/15/2025"
   - If the syllabus says "Every Friday" or "Weekly on Monday" and a semester date range is provided, calculate and extract EACH occurrence as separate assignments with specific dates
   - If date is vague like "During exam period" or "TBA" - leave date as an empty string ""
   - NEVER use vague descriptions like "Every Thursday" or "Weekly" - always convert to actual dates if possible
3. Weight/Percentage - STRICT RULES:
   - Output ONLY a final numeric percentage like "7%" or "12.5%"
   - NEVER output text such as "part of", "portion of", "35%/5", or any explanations
   - If a total weight is shared across multiple assignments (e.g., "5 quizzes = 20%"), divide the total evenly and return ONLY the final percentage per item (e.g., "4%")
   - If weight is described in points (e.g., "50 points"), return exactly that string (e.g., "50 points")
   - If no weight is specified, return an empty string ""
4. Type (only use exactly one of: "Exam", "Assignment", "Project", "Quiz", "Paper", or "Participation")
5. Description (if available, otherwise generate a quick summary)
6. Any additional important notes (otherwise empty string "")

Also extract:
- Course name/code
- Semester/term
- Instructor name

IMPORTANT:
- For recurring assignments, create SEPARATE entries for each occurrence with a calculated real date
- NEVER include calculations, explanations, or fractions in any field
- ALL fields must be plain strings
- EMPTY values must be returned as ""

Syllabus text:
${text}

Return ONLY a valid JSON object with this EXACT structure:
{
  "courseName": "Course Name",
  "semester": "Fall 2024",
  "instructor": "Professor Name",
  "assignments": [
    {
      "title": "Assignment 1",
      "dueDate": "2024-09-15",
      "weight": "10%",
      "type": "Assignment",
      "description": "Description here",
      "additionalNotes": "Any notes"
    }
  ]
}

Do NOT include markdown, comments, or extra explanations.`;

  try {
    // Call Groq AI API
    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful assistant that extracts structured data from syllabi. Always return valid JSON only, no markdown formatting.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      temperature: 0.1,
      response_format: { type: "json_object" },
    });

    const responseText = completion.choices[0]?.message?.content || "{}";

    // Remove markdown code blocks if present (just in case)
    let cleanedText = responseText.trim();
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText.replace(/^```json\n/, "").replace(/\n```$/, "");
    } else if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/^```\n/, "").replace(/\n```$/, "");
    }

    const parsed = JSON.parse(cleanedText);

    return {
      fileName,
      courseName: parsed.courseName,
      semester: parsed.semester,
      instructor: parsed.instructor,
      assignments: parsed.assignments || [],
    };
  } catch (error) {
    console.error("Error parsing with AI:", error);
    throw new Error("Failed to parse syllabus with AI");
  }
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const files = formData.getAll("files") as File[];

    if (!files || files.length === 0) {
      return NextResponse.json({ error: "No files provided" }, { status: 400 });
    }

    const results: ParsedSyllabus[] = [];

    for (const file of files) {
      try {
        // Convert file to ArrayBuffer
        const arrayBuffer = await file.arrayBuffer();

        // Extract text from PDF
        let text = "";
        const fileType = file.name.toLowerCase();

        if (fileType.endsWith(".pdf")) {
          text = await extractTextFromPDF(arrayBuffer);
        } else if (fileType.endsWith(".docx")) {
          text = await extractTextFromDOCX(arrayBuffer);
        } else {
          results.push({
            fileName: file.name,
            assignments: [],
            courseName: "Unsupported file type",
          });
          continue;
        }

        // Parse with AI
        const parsed = await parseAssignmentsWithAI(text, file.name);
        results.push(parsed);
      } catch (error) {
        console.error(`Error processing file ${file.name}:`, error);
        results.push({
          fileName: file.name,
          assignments: [],
          courseName: "Error parsing file",
        });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("Error in parse-syllabus route:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
