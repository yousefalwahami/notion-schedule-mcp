import { NextRequest, NextResponse } from "next/server";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

// Set a dummy worker source to prevent worker errors in Node.js
pdfjsLib.GlobalWorkerOptions.workerSrc =
  "pdfjs-dist/legacy/build/pdf.worker.mjs";

// Nebius AI configuration
const NEBIUS_API_KEY = process.env.NEBIUS_API_KEY;
const NEBIUS_API_URL = "https://api.studio.nebius.com/v1/chat/completions";

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

async function extractTextFromPDF(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
      useWorkerFetch: false,
      isEvalSupported: false,
      standardFontDataUrl: undefined,
    });
    const pdfDocument = await loadingTask.promise;

    let fullText = "";

    for (let pageNum = 1; pageNum <= pdfDocument.numPages; pageNum++) {
      const page = await pdfDocument.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => ("str" in item ? item.str : ""))
        .join(" ");
      fullText += pageText + "\n";
    }

    return fullText;
  } catch (error) {
    console.error("Error extracting text from PDF:", error);
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
2. Due Date (in ISO format YYYY-MM-DD if possible, otherwise as written)
3. Weight/Percentage (e.g., "20%", "15 points")
4. Type (e.g., "Exam", "Assignment", "Project", "Quiz", "Paper")
5. Description (if available)
6. Any additional important notes

Also extract:
- Course name/code
- Semester/term
- Instructor name

Syllabus text:
${text}

Return ONLY a valid JSON object with this structure (no markdown, no code blocks):
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
}`;

  try {
    // Call Nebius AI API
    const response = await fetch(NEBIUS_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${NEBIUS_API_KEY}`,
      },
      body: JSON.stringify({
        // model: "meta-llama/Meta-Llama-3.1-70B-Instruct",
        model: "openai/gpt-oss-120b",
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
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Nebius AI API error:", response.status, errorText);
      throw new Error(
        `Nebius AI API error: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    const data = await response.json();
    const responseText = data.choices[0]?.message?.content || "{}";

    // Remove markdown code blocks if present
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
        const text = await extractTextFromPDF(arrayBuffer);

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
