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
  const [notionConnected, setNotionConnected] = useState(false);
  const [isConnectingNotion, setIsConnectingNotion] = useState(false);

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
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const newFiles = Array.from(e.target.files)
        .filter((file) => file.type === "application/pdf")
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
      .filter((file) => file.type === "application/pdf")
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

  const connectNotion = async () => {
    setIsConnectingNotion(true);
    setError("");

    // Use the new Composio connect flow
    window.location.href = "/api/composio/connect-notion";
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
      setParsedResults(data.results);
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
      const assignmentsList = parsedResults.flatMap((syllabus) =>
        syllabus.assignments.map((a) => ({
          course: syllabus.courseName || syllabus.fileName,
          title: a.title,
          dueDate: a.dueDate,
          weight: a.weight,
          type: a.type,
          description: a.description,
        }))
      );

      const prompt = `Create a Notion database called "Assignment Tracker ${new Date().getFullYear()}" with properties: Name (title), Due Date (date), Course (select), Weight (text), Status (select with options: Not Started, In Progress, Completed), Type (select with options: Assignment, Quiz, Exam, Project). Then add these ${
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
          Upload your course syllabus PDFs to automatically create a Notion
          deadline tracker
        </p>

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
              <span>Upload PDF files</span>
              <input
                id="file-upload"
                name="file-upload"
                type="file"
                className="sr-only"
                multiple
                accept=".pdf"
                onChange={handleFileChange}
              />
            </label>
            <p className="pl-1">or drag and drop</p>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-500 mt-2">
            PDF files only
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
                    className="ml-4 p-2 text-zinc-400 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-400 transition-colors"
                    aria-label="Remove file"
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
                            <div className="flex items-center gap-2 mb-2">
                              <h4 className="font-semibold text-zinc-900 dark:text-zinc-100">
                                {assignment.title}
                              </h4>
                              {assignment.type && (
                                <span className="px-2 py-0.5 text-xs font-medium bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded">
                                  {assignment.type}
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
                                <span>{assignment.dueDate}</span>
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
            <p className="text-green-800 dark:text-green-200 flex items-center gap-2">
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              {notionSuccess}
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
