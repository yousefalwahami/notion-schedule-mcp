"use client";

import { useState, useEffect } from "react";

interface UploadedFile {
  file: File;
  id: string;
}

interface Assignment {
  title: string;
  dueDate: string;
  weight: string;
  description?: string;
  type?: string;
  additionalNotes?: string;
  isRecurring?: boolean;
  recurringDayOfWeek?: string; // "Monday", "Friday", etc.
  expandedDates?: string[]; // Actual dates if recurring
}

interface ParsedSyllabus {
  fileName: string;
  courseName?: string;
  assignments: Assignment[];
  semester?: string;
  instructor?: string;
}

export default function Home() {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isParsing, setIsParsing] = useState(false);
  const [parsedResults, setParsedResults] = useState<ParsedSyllabus[]>([]);
  const [error, setError] = useState<string>("");
  const [isSendingToNotion, setIsSendingToNotion] = useState(false);
  const [notionSuccess, setNotionSuccess] = useState<string>("");
  const [notionPageUrl, setNotionPageUrl] = useState<string>("");
  const [notionConnected, setNotionConnected] = useState(false);
  const [isConnectingNotion, setIsConnectingNotion] = useState(false);
  const [semesterStart, setSemesterStart] = useState<string>("");
  const [semesterEnd, setSemesterEnd] = useState<string>("");
  const [isEditingAssignments, setIsEditingAssignments] = useState(false);
  const [editingAssignment, setEditingAssignment] = useState<{
    syllabusIdx: number;
    assignmentIdx: number;
    assignment: Assignment;
  } | null>(null);
  const [isDatePickerOpen, setIsDatePickerOpen] = useState(false);
  const [selectedDates, setSelectedDates] = useState<string[]>([]);

  // Check if Notion was just connected (from OAuth redirect)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("connected") === "true") {
      setNotionConnected(true);
      // Clean up URL
      window.history.replaceState({}, "", "/");
    } else if (params.get("error")) {
      setError("Failed to connect to Notion. Please try again.");
      // Clean URL
      window.history.replaceState({}, "", "/");
    }

    // Restore parsed results from sessionStorage if available
    const savedResults = sessionStorage.getItem("parsedResults");
    if (savedResults) {
      try {
        const results = JSON.parse(savedResults);
        setParsedResults(results);
      } catch (err) {
        console.error("Failed to restore parsed results:", err);
      }
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
        .filter((file) => {
          const ext = file.name.toLowerCase().split(".").pop() || "";
          return ["pdf", "docx", "doc"].includes(ext);
        })
        .map((file) => ({
          file,
          id: `${file.name}-${Date.now()}-${Math.random()}`,
        }));
      setFiles((prev) => [...prev, ...newFiles]);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const droppedFiles = Array.from(e.dataTransfer.files)
      .filter((file) => {
        const ext = file.name.toLowerCase().split(".").pop() || "";
        return ["pdf", "docx", "doc"].includes(ext);
      })
      .map((file) => ({
        file,
        id: `${file.name}-${Date.now()}-${Math.random()}`,
      }));
    setFiles((prev) => [...prev, ...droppedFiles]);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const removeFile = (id: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
  };

  // Helper function to detect and process recurring dates
  const processRecurringDate = (assignment: Assignment): Assignment => {
    const dueDate = assignment.dueDate.toLowerCase();

    // Don't mark as recurring if it has a specific date (contains numbers or months)
    const hasSpecificDate =
      /\d{1,2}|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec|january|february|march|april|june|july|august|september|october|november|december)\b/i.test(
        assignment.dueDate
      );

    // Only process as recurring if it's clearly a weekly pattern
    const isWeeklyPattern =
      /\b(every|each|weekly)\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)/i.test(
        dueDate
      );

    // Detect day of week patterns ONLY if it's a weekly pattern and no specific date
    const dayPatterns = [
      { regex: /\b(monday|mon)s?\b/, day: "Monday" },
      { regex: /\b(tuesday|tue|tues)s?\b/, day: "Tuesday" },
      { regex: /\b(wednesday|wed)s?\b/, day: "Wednesday" },
      { regex: /\b(thursday|thu|thur|thurs)s?\b/, day: "Thursday" },
      { regex: /\b(friday|fri)s?\b/, day: "Friday" },
      { regex: /\b(saturday|sat)s?\b/, day: "Saturday" },
      { regex: /\b(sunday|sun)s?\b/, day: "Sunday" },
    ];

    if (!hasSpecificDate && isWeeklyPattern) {
      for (const pattern of dayPatterns) {
        if (pattern.regex.test(dueDate)) {
          const expandedDates =
            semesterStart && semesterEnd
              ? generateRecurringDates(pattern.day, semesterStart, semesterEnd)
              : [];

          return {
            ...assignment,
            isRecurring: true,
            recurringDayOfWeek: pattern.day,
            expandedDates,
          };
        }
      }
    }

    // Detect "throughout semester" pattern
    if (
      dueDate.includes("throughout") ||
      dueDate.includes("ongoing") ||
      dueDate.includes("continuous")
    ) {
      const expandedDates =
        semesterStart && semesterEnd
          ? generateWeeklyDates(semesterStart, semesterEnd)
          : [];

      return {
        ...assignment,
        isRecurring: true,
        expandedDates,
      };
    }

    return assignment;
  };

  // Generate all occurrences of a specific day of week in date range
  const generateRecurringDates = (
    dayOfWeek: string,
    startDate: string,
    endDate: string
  ): string[] => {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const dayMap: { [key: string]: number } = {
      Sunday: 0,
      Monday: 1,
      Tuesday: 2,
      Wednesday: 3,
      Thursday: 4,
      Friday: 5,
      Saturday: 6,
    };

    const targetDay = dayMap[dayOfWeek];
    const current = new Date(start);

    // Find first occurrence of target day
    while (current.getDay() !== targetDay && current <= end) {
      current.setDate(current.getDate() + 1);
    }

    // Generate all occurrences
    while (current <= end) {
      dates.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 7);
    }

    return dates;
  };

  // Generate weekly dates throughout semester
  const generateWeeklyDates = (
    startDate: string,
    endDate: string
  ): string[] => {
    const dates: string[] = [];
    const start = new Date(startDate);
    const end = new Date(endDate);
    const current = new Date(start);

    while (current <= end) {
      dates.push(current.toISOString().split("T")[0]);
      current.setDate(current.getDate() + 7);
    }

    return dates;
  };

  const connectNotion = async () => {
    setIsConnectingNotion(true);
    setError("");

    // Use the new Composio connect flow
    window.location.href = "/api/composio/connect-notion";
  };

  // Update assignment dates after date picker selection
  const updateAssignmentDates = (
    syllabusIdx: number,
    assignmentIdx: number,
    newDates: string[]
  ) => {
    const updatedResults = [...parsedResults];
    updatedResults[syllabusIdx].assignments[assignmentIdx].expandedDates =
      newDates;
    setParsedResults(updatedResults);
    sessionStorage.setItem("parsedResults", JSON.stringify(updatedResults));
  };

  // Update assignment details
  const updateAssignment = (
    syllabusIdx: number,
    assignmentIdx: number,
    updates: Partial<Assignment>
  ) => {
    const updatedResults = [...parsedResults];
    updatedResults[syllabusIdx].assignments[assignmentIdx] = {
      ...updatedResults[syllabusIdx].assignments[assignmentIdx],
      ...updates,
    };
    setParsedResults(updatedResults);
    sessionStorage.setItem("parsedResults", JSON.stringify(updatedResults));
  };

  const handleParseSyllabi = async () => {
    if (files.length === 0) return;

    setIsParsing(true);
    setError("");

    try {
      const formData = new FormData();
      files.forEach(({ file }) => {
        formData.append("files", file);
      });

      const response = await fetch("/api/parse-syllabus", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to parse syllabi");
      }

      const data = await response.json();

      // Process and expand recurring dates
      const processedResults = data.results.map((syllabus: ParsedSyllabus) => ({
        ...syllabus,
        assignments: syllabus.assignments.map((assignment: Assignment) => {
          const processed = processRecurringDate(assignment);
          return processed;
        }),
      }));

      setParsedResults(processedResults);

      // Save to sessionStorage to persist through OAuth redirect
      sessionStorage.setItem("parsedResults", JSON.stringify(processedResults));

      // Scroll to bottom after results are set
      setTimeout(() => {
        window.scrollTo({
          top: document.documentElement.scrollHeight,
          behavior: "smooth",
        });
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setIsParsing(false);
    }
  };

  const sendToNotion = async () => {
    if (parsedResults.length === 0) return;

    setIsSendingToNotion(true);
    setError("");
    setNotionSuccess("");

    try {
      // Build a prompt for the AI to create database and add assignments
      // Expand recurring assignments into multiple entries
      const assignmentsList = parsedResults.flatMap((syllabus) =>
        syllabus.assignments.flatMap((a) => {
          // If recurring and has expanded dates, create one entry per date
          if (a.isRecurring && a.expandedDates && a.expandedDates.length > 0) {
            return a.expandedDates.map((date, index) => ({
              course: syllabus.courseName || syllabus.fileName,
              title: `${a.title}${
                a.expandedDates && a.expandedDates.length > 1
                  ? ` (${index + 1}/${a.expandedDates.length})`
                  : ""
              }`,
              dueDate: date,
              weight: a.weight,
              type: a.type,
              description: a.description,
            }));
          }

          // Regular assignment
          return [
            {
              course: syllabus.courseName || syllabus.fileName,
              title: a.title,
              dueDate: a.dueDate,
              weight: a.weight,
              type: a.type,
              description: a.description,
            },
          ];
        })
      )
      .reverse();

      const prompt = `Create a Notion database called "Assignment Tracker ${new Date().getFullYear()}" with properties: Name (title), Due Date (date), Course (select), Weight (text), Status (create with options: Not Started, In Progress, Completed), Type (create with options: Assignment, Quiz, Exam, Project, Participation). Then add these ${
        assignmentsList.length
      } assignments to it: ${JSON.stringify(assignmentsList, null, 2)}`;

      const response = await fetch("/api/notion-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ prompt }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to send to Notion");
      }

      const data = await response.json();
      setNotionSuccess(
        "Successfully created database and added all assignments to Notion!"
      );

      // Extract URL from response if available
      const notionUrl = data?.results?.[0]?.data.url;
      console.log("Notion URL:", notionUrl);

      if (notionUrl) {
        setNotionPageUrl(notionUrl);
      }

      // Clear sessionStorage after successful upload
      sessionStorage.removeItem("parsedResults");

      console.log("AI Response:", data);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "An error occurred sending to Notion"
      );
    } finally {
      setIsSendingToNotion(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-zinc-900 p-4">
      <main className="w-full max-w-4xl bg-white dark:bg-zinc-800 rounded-lg shadow-lg p-8">
        <h1 className="text-3xl font-bold mb-2 text-zinc-900 dark:text-zinc-50">
          Syllabus to Notion Schedule
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400 mb-8">
          Upload your course syllabus PDFs or DOCX files to automatically create a Notion
          deadline tracker
        </p>

        
        {/* Semester Date Input 
        <div className="mb-8 p-6 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">
            📅 Semester Dates
          </h2>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
            Enter your semester dates to help convert vague due dates (like
            &ldquo;Fridays&rdquo; or &ldquo;Throughout the semester&rdquo;) into
            specific dates.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="semester-start"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
              >
                Semester Start Date
              </label>
              <input
                id="semester-start"
                type="date"
                value={semesterStart}
                onChange={(e) => setSemesterStart(e.target.value)}
                className="cursor-pointer w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <div>
              <label
                htmlFor="semester-end"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2"
              >
                Semester End Date
              </label>
              <input
                id="semester-end"
                type="date"
                value={semesterEnd}
                onChange={(e) => setSemesterEnd(e.target.value)}
                className="cursor-pointer w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
        </div>
        */}

        {/* Notion Connection Section */}
        {!notionConnected ? (
          <div className="mb-8 p-6 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="flex items-start gap-4">
              <svg
                className="h-12 w-12 text-purple-600 dark:text-purple-400 flex-shrink-0"
                fill="currentColor"
                viewBox="0 0 24 24"
              >
                <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.635-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
              </svg>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100 mb-2">
                  Connect to Notion
                </h2>
                <p className="text-zinc-600 dark:text-zinc-400 mb-4">
                  Connect your Notion account to upload assignment deadlines
                  directly
                </p>
                <button
                  onClick={connectNotion}
                  disabled={isConnectingNotion}
                  className="cursor-pointer bg-purple-600 hover:bg-purple-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors disabled:opacity-50"
                >
                  {isConnectingNotion ? "Connecting..." : "Connect Notion"}
                </button>
              </div>
            </div>
          </div>
        ) : (
          <div className="mb-8 p-6 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
            <div className="flex items-center gap-3 mb-4">
              <svg
                className="h-6 w-6 text-green-600 dark:text-green-400"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                Notion Connected!
              </h2>
            </div>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Ready to send assignments to Notion. The AI will automatically
              create a database for you!
            </p>
          </div>
        )}

        {/* File Upload Area */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
            isDragging
              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
              : "border-zinc-300 dark:border-zinc-600 hover:border-zinc-400 dark:hover:border-zinc-500"
          }`}
        >
          <svg
            className="mx-auto h-12 w-12 text-zinc-400 dark:text-zinc-500 mb-4"
            stroke="currentColor"
            fill="none"
            viewBox="0 0 48 48"
            aria-hidden="true"
          >
            <path
              d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <div className="flex text-sm text-zinc-600 dark:text-zinc-400 justify-center">
            <label
              htmlFor="file-upload"
              className="relative cursor-pointer rounded-md font-semibold text-blue-600 dark:text-blue-400 hover:text-blue-500"
            >
              <span>Upload PDF/DOCX files</span>
              <input
                id="file-upload"
                name="file-upload"
                type="file"
                className="sr-only"
                multiple
                accept=".pdf,.docx"
                onChange={handleFileChange}
              />
            </label>
            <p className="pl-1">or drag and drop</p>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-2">
            PDF/DOCX files only
          </p>
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4 text-zinc-900 dark:text-zinc-50">
              Uploaded Files ({files.length})
            </h2>
            <div className="space-y-2">
              {files.map((uploadedFile) => (
                <div
                  key={uploadedFile.id}
                  className="flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-700 rounded-lg border border-zinc-200 dark:border-zinc-600"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <svg
                      className="h-8 w-8 text-red-500 flex-shrink-0"
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z"
                        clipRule="evenodd"
                      />
                    </svg>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                        {uploadedFile.file.name}
                      </p>
                      <p className="text-sm text-zinc-500 dark:text-zinc-400">
                        {formatFileSize(uploadedFile.file.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => removeFile(uploadedFile.id)}
                    className="cursor-pointer mx-4"
                    aria-label="Remove file"
                  >
                    <svg
                      className="h-5 w-5"
                      fill="none"
                      viewBox="0 0 24 24"
                      style={{ stroke: "rgb(161 161 170)" }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.stroke = "rgb(239 68 68)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.stroke = "rgb(161 161 170)")
                      }
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))}
            </div>

            {/* Parse Button */}
            <button
              onClick={handleParseSyllabi}
              className="cursor-pointer mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={files.length === 0 || isParsing}
            >
              {isParsing ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Parsing Syllabi...
                </span>
              ) : (
                "Parse Syllabi with AI"
              )}
            </button>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="mt-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
            <p className="text-red-800 dark:text-red-200">{error}</p>
          </div>
        )}

        {/* Parsed Results */}
        {parsedResults.length > 0 && (
          <div className="mt-8">
            <h2 className="text-2xl font-bold mb-6 text-zinc-900 dark:text-zinc-50">
              Extracted Assignments
            </h2>

            {parsedResults.map((syllabus, idx) => (
              <div
                key={idx}
                className="mb-8 p-6 bg-zinc-50 dark:bg-zinc-700 rounded-lg border border-zinc-200 dark:border-zinc-600"
              >
                <div className="mb-4">
                  <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">
                    {syllabus.courseName || syllabus.fileName}
                  </h3>
                  {syllabus.semester && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {syllabus.semester}
                      {syllabus.instructor && ` • ${syllabus.instructor}`}
                    </p>
                  )}
                  <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-1">
                    From: {syllabus.fileName}
                  </p>
                </div>

                {syllabus.assignments.length > 0 ? (
                  <div className="space-y-3">
                    {syllabus.assignments.map((assignment, aIdx) => (
                      <div
                        key={aIdx}
                        className="p-4 bg-white dark:bg-zinc-800 rounded border border-zinc-200 dark:border-zinc-600"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">
                                {assignment.title}
                              </h4>
                              {assignment.type && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                                  {assignment.type}
                                </span>
                              )}
                              {assignment.isRecurring && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 dark:bg-purple-900 text-purple-800 dark:text-purple-200 rounded flex items-center gap-1">
                                  <svg
                                    className="h-3 w-3"
                                    fill="none"
                                    stroke="currentColor"
                                    viewBox="0 0 24 24"
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={2}
                                      d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                                    />
                                  </svg>
                                  Recurring
                                </span>
                              )}
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm text-zinc-600 dark:text-zinc-400">
                              <div className="flex items-center gap-1">
                                <svg
                                  className="h-4 w-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                  />
                                </svg>
                                <span>
                                  {assignment.isRecurring &&
                                  assignment.recurringDayOfWeek
                                    ? `Every ${assignment.recurringDayOfWeek}`
                                    : assignment.dueDate}
                                </span>
                              </div>
                              <div className="flex items-center gap-1">
                                <svg
                                  className="h-4 w-4"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                                  />
                                </svg>
                                <span>{assignment.weight}</span>
                              </div>
                            </div>

                            {/* Show expanded dates for recurring assignments */}
                            {assignment.isRecurring &&
                              assignment.expandedDates &&
                              assignment.expandedDates.length > 0 && (
                                <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded border border-purple-200 dark:border-purple-800">
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-xs font-medium text-purple-800 dark:text-purple-200">
                                      {assignment.expandedDates.length}{" "}
                                      occurrences found
                                    </p>
                                    <button
                                      onClick={() => {
                                        setEditingAssignment({
                                          syllabusIdx: idx,
                                          assignmentIdx: aIdx,
                                          assignment: assignment,
                                        });
                                        setSelectedDates(
                                          assignment.expandedDates || []
                                        );
                                        setIsDatePickerOpen(true);
                                      }}
                                      className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-800 dark:hover:text-purple-200 font-medium underline"
                                    >
                                      Edit dates
                                    </button>
                                  </div>
                                  <div className="flex flex-wrap gap-1">
                                    {assignment.expandedDates
                                      .slice(0, 5)
                                      .map((date, dIdx) => (
                                        <span
                                          key={dIdx}
                                          className="px-2 py-0.5 text-xs bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 rounded border border-purple-200 dark:border-purple-700"
                                        >
                                          {new Date(date).toLocaleDateString(
                                            "en-US",
                                            { month: "short", day: "numeric" }
                                          )}
                                        </span>
                                      ))}
                                    {assignment.expandedDates.length > 5 && (
                                      <span className="px-2 py-0.5 text-xs text-purple-600 dark:text-purple-400">
                                        +{assignment.expandedDates.length - 5}{" "}
                                        more
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}

                            {assignment.description && (
                              <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
                                {assignment.description}
                              </p>
                            )}
                            {assignment.additionalNotes && (
                              <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400 italic">
                                Note: {assignment.additionalNotes}
                              </p>
                            )}
                          </div>

                          {/* Edit button for individual assignment */}
                          <button
                            onClick={() => {
                              setEditingAssignment({
                                syllabusIdx: idx,
                                assignmentIdx: aIdx,
                                assignment: assignment,
                              });
                              setIsEditingAssignments(true);
                            }}
                            className="flex-shrink-0 p-2 text-zinc-400 hover:text-blue-500 dark:text-zinc-500 dark:hover:text-blue-400 transition-colors"
                            aria-label="Edit assignment"
                          >
                            <svg
                              className="h-5 w-5"
                              fill="none"
                              stroke="currentColor"
                              viewBox="0 0 24 24"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                              />
                            </svg>
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-zinc-600 dark:text-zinc-400 italic">
                    No assignments found in this syllabus.
                  </p>
                )}
              </div>
            ))}

            {/* Send to Notion Button */}
            <button
              onClick={sendToNotion}
              disabled={isSendingToNotion || !notionConnected}
              className="cursor-pointer mt-6 w-full bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSendingToNotion ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Sending to Notion...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <svg
                    className="h-5 w-5"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M4.459 4.208c.746.606 1.026.56 2.428.466l13.215-.793c.28 0 .047-.28-.046-.326L17.86 1.968c-.42-.326-.981-.7-2.055-.607L3.01 2.295c-.466.046-.56.28-.374.466zm.793 3.08v13.904c0 .747.373 1.027 1.214.98l14.523-.84c.841-.046.935-.56.935-1.167V6.354c0-.606-.233-.933-.748-.887l-15.177.887c-.56.047-.747.327-.747.933zm14.337.745c.093.42 0 .84-.42.888l-.7.14v10.264c-.608.327-1.168.514-1.635.514-.748 0-.935-.234-1.495-.933l-4.577-7.186v6.952L12.21 19s0 .84-1.168.84l-3.222.186c-.093-.186 0-.653.327-.746l.84-.233V9.854L7.822 9.76c-.094-.42.14-1.026.793-1.073l3.456-.233 4.764 7.279v-6.44l-1.215-.139c-.093-.514.28-.887.747-.933zM1.936 1.035l13.31-.98c1.635-.14 2.055-.047 3.082.7l4.249 2.986c.7.513.934.653.934 1.213v16.378c0 1.026-.373 1.634-1.68 1.726l-15.458.934c-.98.047-1.448-.093-1.962-.747l-3.129-4.06c-.56-.747-.793-1.306-.793-1.96V2.667c0-.839.374-1.54 1.447-1.632z" />
                  </svg>
                  Send to Notion
                </span>
              )}
            </button>
          </div>
        )}

        {/* Success Message */}
        {notionSuccess && (
          <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <div className="flex items-start gap-2">
              <svg
                className="h-5 w-5 text-green-800 dark:text-green-200 flex-shrink-0 mt-0.5"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              <div className="flex-1">
                <p className="text-green-800 dark:text-green-200 mb-2">
                  {notionSuccess}
                </p>
                {notionPageUrl && (
                  <a
                    href={notionPageUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm font-medium text-green-700 dark:text-green-300 hover:text-green-900 dark:hover:text-green-100 underline underline-offset-2"
                  >
                    Click here to access the Notion page
                    <svg
                      className="h-4 w-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
                      />
                    </svg>
                  </a>
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Date Picker Modal */}
      {isDatePickerOpen && editingAssignment && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                  Select Dates for {editingAssignment.assignment.title}
                </h3>
                <button
                  onClick={() => setIsDatePickerOpen(false)}
                  className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {editingAssignment.assignment.recurringDayOfWeek && (
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-4">
                  Every {editingAssignment.assignment.recurringDayOfWeek} from{" "}
                  {semesterStart} to {semesterEnd}
                </p>
              )}

              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    {selectedDates.length} of{" "}
                    {editingAssignment.assignment.expandedDates?.length || 0}{" "}
                    dates selected
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() =>
                        setSelectedDates(
                          editingAssignment.assignment.expandedDates || []
                        )
                      }
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Select All
                    </button>
                    <button
                      onClick={() => setSelectedDates([])}
                      className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      Deselect All
                    </button>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mb-6">
                {editingAssignment.assignment.expandedDates?.map(
                  (date, idx) => {
                    const isSelected = selectedDates.includes(date);
                    return (
                      <label
                        key={idx}
                        className={`flex items-center gap-2 p-3 rounded-lg border cursor-pointer transition-colors ${
                          isSelected
                            ? "bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-600"
                            : "bg-zinc-50 dark:bg-zinc-700 border-zinc-200 dark:border-zinc-600 hover:border-blue-300 dark:hover:border-blue-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDates([...selectedDates, date]);
                            } else {
                              setSelectedDates(
                                selectedDates.filter((d) => d !== date)
                              );
                            }
                          }}
                          className="rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
                        />
                        <span className="text-sm text-zinc-900 dark:text-zinc-100">
                          {new Date(date).toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
                        </span>
                      </label>
                    );
                  }
                )}
              </div>

              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setIsDatePickerOpen(false)}
                  className="px-4 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    updateAssignmentDates(
                      editingAssignment.syllabusIdx,
                      editingAssignment.assignmentIdx,
                      selectedDates
                    );
                    setIsDatePickerOpen(false);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Save Dates
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Assignment Modal */}
      {isEditingAssignments && editingAssignment && !isDatePickerOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-semibold text-zinc-900 dark:text-zinc-100">
                  Edit Assignment
                </h3>
                <button
                  onClick={() => {
                    setIsEditingAssignments(false);
                    setEditingAssignment(null);
                  }}
                  className="p-2 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
                >
                  <svg
                    className="h-6 w-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Title
                  </label>
                  <input
                    type="text"
                    value={editingAssignment.assignment.title}
                    onChange={(e) => {
                      setEditingAssignment({
                        ...editingAssignment,
                        assignment: {
                          ...editingAssignment.assignment,
                          title: e.target.value,
                        },
                      });
                    }}
                    className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Due Date (for non-recurring) */}
                {!editingAssignment.assignment.isRecurring && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                      Due Date
                    </label>
                    <input
                      type="date"
                      value={editingAssignment.assignment.dueDate}
                      onChange={(e) => {
                        setEditingAssignment({
                          ...editingAssignment,
                          assignment: {
                            ...editingAssignment.assignment,
                            dueDate: e.target.value,
                          },
                        });
                      }}
                      className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                )}

                {/* Weight */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Weight
                  </label>
                  <input
                    type="text"
                    value={editingAssignment.assignment.weight}
                    onChange={(e) => {
                      setEditingAssignment({
                        ...editingAssignment,
                        assignment: {
                          ...editingAssignment.assignment,
                          weight: e.target.value,
                        },
                      });
                    }}
                    className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="e.g., 20%, 100 points"
                  />
                </div>

                {/* Type */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Type
                  </label>
                  <select
                    value={editingAssignment.assignment.type || ""}
                    onChange={(e) => {
                      setEditingAssignment({
                        ...editingAssignment,
                        assignment: {
                          ...editingAssignment.assignment,
                          type: e.target.value,
                        },
                      });
                    }}
                    className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="">Select type...</option>
                    <option value="Assignment">Assignment</option>
                    <option value="Quiz">Quiz</option>
                    <option value="Exam">Exam</option>
                    <option value="Project">Project</option>
                    <option value="Paper">Paper</option>
                    <option value="Participation">Participation</option>
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Description
                  </label>
                  <textarea
                    value={editingAssignment.assignment.description || ""}
                    onChange={(e) => {
                      setEditingAssignment({
                        ...editingAssignment,
                        assignment: {
                          ...editingAssignment.assignment,
                          description: e.target.value,
                        },
                      });
                    }}
                    rows={3}
                    className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Add a description..."
                  />
                </div>

                {/* Additional Notes */}
                <div>
                  <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">
                    Additional Notes
                  </label>
                  <textarea
                    value={editingAssignment.assignment.additionalNotes || ""}
                    onChange={(e) => {
                      setEditingAssignment({
                        ...editingAssignment,
                        assignment: {
                          ...editingAssignment.assignment,
                          additionalNotes: e.target.value,
                        },
                      });
                    }}
                    rows={2}
                    className="w-full px-4 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Add notes..."
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => {
                    setIsEditingAssignments(false);
                    setEditingAssignment(null);
                  }}
                  className="px-4 py-2 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-700 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    updateAssignment(
                      editingAssignment.syllabusIdx,
                      editingAssignment.assignmentIdx,
                      editingAssignment.assignment
                    );
                    setIsEditingAssignments(false);
                    setEditingAssignment(null);
                  }}
                  className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
