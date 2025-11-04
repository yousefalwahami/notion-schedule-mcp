// Types for the Syllabus Parser Application

export interface Assignment {
  title: string;
  dueDate: string;
  weight: string;
  description?: string;
  type?: string;
  additionalNotes?: string;
}

export interface ParsedSyllabus {
  fileName: string;
  courseName?: string;
  assignments: Assignment[];
  semester?: string;
  instructor?: string;
}

export interface NotionPageResponse {
  title: string;
  notionUrl: string;
}

export interface ParseSyllabusResponse {
  results: ParsedSyllabus[];
}

export interface SendToNotionResponse {
  success: boolean;
  message: string;
  pages: NotionPageResponse[];
}

export interface ApiError {
  error: string;
  details?: string;
}
