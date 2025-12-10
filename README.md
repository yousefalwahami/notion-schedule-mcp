# Syllabus to Notion Schedule

Automatically parse course syllabi from PDF or DOCX files and create a Notion deadline tracker using AI-powered extraction with Groq LLM and Composio integration.

## Features

- 📄 **Multi-Format Support**: Upload PDF and DOCX files via drag & drop
- 🤖 **AI-Powered Parsing**: Uses Groq (llama-3.3-70b-versatile) to intelligently extract assignments
- 🔄 **Recurring Assignments**: Automatically detects and handles weekly recurring assignments
- ✏️ **Edit Assignments**: Modify titles, dates, weights, types, and descriptions before sending to Notion
- 📅 **Date Picker**: Select specific dates for recurring assignments with interactive calendar
- 🗑️ **Clear Results**: Remove all parsed data with one click
- 📝 **Notion Integration**: AI automatically creates databases and adds assignments via Composio
- 🎨 **Modern UI**: Clean, responsive design with dark mode support

## Getting Started

### Prerequisites

1. Node.js 18+ installed
2. Groq API key ([Get one here](https://console.groq.com/))
3. Composio API key ([Sign up at Composio](https://composio.dev))
4. A Notion account

### Installation

1. **Clone the repository**:

   ```bash
   git clone https://github.com/yousefalwahami/notion-schedule-mcp.git
   cd notion-schedule-mcp
   ```

2. **Install dependencies**:

   ```bash
   npm install
   ```

3. **Configure environment variables**:

   Create a `.env.local` file in the root directory:

   ```env
   GROQ_API_KEY=your_groq_api_key_here
   COMPOSIO_API_KEY=your_composio_api_key_here
   ```

4. **Run the development server**:

   ```bash
   npm run dev
   ```

5. **Open your browser** and navigate to [http://localhost:3000](http://localhost:3000)

## How to Use

### 1. Connect Notion

- Click "Connect Notion" on the home page
- Authorize Composio to access your Notion account
- Grant necessary permissions

### 2. Upload Syllabi

- Click "Upload PDF/DOCX files" or drag & drop files into the upload area
- Supports both PDF and DOCX formats
- Upload multiple syllabus files at once
- Remove any file by clicking the X button

### 3. Parse with AI

- Click "Parse Syllabi with AI"
- The app will:
  - Extract text from PDFs using pdf-parse v2
  - Extract text from DOCX files using mammoth
  - Use Groq AI (llama-3.3-70b-versatile) to intelligently identify assignments
  - Detect recurring assignments (e.g., "Every Friday")
  - Extract: titles, due dates, weights, types, descriptions

### 4. Review and Edit Extracted Data

- View all extracted assignments organized by course
- **Edit Individual Assignments**: Click the edit icon to modify title, date, weight, type, description, and notes
- **Recurring Assignments**: Automatically detected and marked with a purple "Recurring" badge
- **Edit Dates**: For recurring assignments, click "Edit dates" to select/deselect specific occurrences
- **Clear All**: Click the trash bin icon to remove all parsed results

### 5. Send to Notion

- Click "Send to Notion"
- The AI will automatically:
  - Create a database called "Assignment Tracker 2025"
  - Add properties: Name, Due Date, Course, Weight, Status, Type
  - Add all assignments as individual entries
  - Expand recurring assignments into separate dated entries
- A link to your Notion page will be provided after successful upload

## Technology Stack

- **Frontend**: Next.js 16.0.1, React 19.2.0, TypeScript, Tailwind CSS v4
- **PDF Parsing**: pdf-parse v2.4.5 (Mozilla's PDF.js)
- **DOCX Parsing**: mammoth
- **AI Processing**: Groq AI (llama-3.3-70b-versatile model)
- **Integration**: Composio for Notion API
- **Deployment**: Vercel-ready with serverless configuration

## Key Components

### AI Prompt Engineering

The app uses carefully crafted prompts that instruct the AI to:

- Extract specific dates (YYYY-MM-DD format) instead of vague descriptions
- Use "TBA" for unclear dates like "During exam period"
- Create separate entries for recurring assignments with actual dates
- Never use vague descriptions like "Every Thursday"

### Recurring Assignment Detection

Smart detection of patterns like:

- "Every Friday" → Generates all Friday dates in semester
- "Weekly on Monday" → Generates all Monday dates
- "Throughout semester" → Generates weekly dates

### Serverless Configuration

Optimized for Vercel deployment with:

```typescript
serverExternalPackages: ["pdf-parse", "@napi-rs/canvas"];
```

## API Routes

### POST `/api/parse-syllabus`

Parses uploaded PDF/DOCX syllabi and extracts assignment information using Groq AI.

**Request**: FormData with `files` field containing PDF or DOCX files

**Response**:

```json
{
  "results": [
    {
      "fileName": "CS101_Syllabus.pdf",
      "courseName": "Introduction to Computer Science",
      "semester": "Fall 2024",
      "instructor": "Dr. Smith",
      "assignments": [
        {
          "title": "Weekly Participation",
          "dueDate": "Every Friday",
          "weight": "10%",
          "type": "Participation",
          "description": "Participation in online activities",
          "additionalNotes": "Generally due Friday night",
          "isRecurring": true,
          "recurringDayOfWeek": "Friday",
          "expandedDates": ["2024-09-06", "2024-09-13", "2024-09-20", ...]
        }
      ]
    }
  ]
}
```

### POST `/api/composio/connect-notion`

Initiates OAuth flow to connect user's Notion account via Composio.

### POST `/api/notion-action`

Sends natural language prompt to Composio AI to create Notion database and add assignments.

**Request**:

```json
{
  "prompt": "Create a Notion database called 'Assignment Tracker 2025' with properties..."
}
```

## Extracted Data Structure

The AI extracts the following information from each assignment:

- **Title**: Assignment/exam/project name
- **Due Date**: Specific dates (YYYY-MM-DD, "Jan 15, 2025", etc.) or "TBA" for vague dates
- **Weight**: Grade percentage or points (e.g., "20%", "100 points")
- **Type**: Assignment, Exam, Project, Quiz, Paper, or Participation
- **Description**: Brief description of the assignment
- **Additional Notes**: Any important notes or requirements
- **Recurring Info** (if applicable):
  - `isRecurring`: Boolean flag
  - `recurringDayOfWeek`: The day of week (e.g., "Friday")
  - `expandedDates`: Array of all specific dates

Plus course-level information:

- Course name/code
- Semester/term
- Instructor name

## Troubleshooting

### PDF/DOCX Text Not Extracted Properly

- PDFs: Some scanned PDFs may not have text layers. Use text-based PDFs for best results
- DOCX: Ensure the file is a valid .docx format (not .doc or corrupted)

### Groq API Issues

1. Verify your `GROQ_API_KEY` is set correctly in `.env.local`
2. Check your API quota at [Groq Console](https://console.groq.com/)
3. If you get rate limit errors, wait a few minutes and try again

### Composio/Notion Connection Issues

1. Verify your `COMPOSIO_API_KEY` is correct
2. Re-authorize Notion connection if needed
3. Check Composio dashboard for connection status

### Recurring Assignments Not Detected

The AI looks for patterns like:

- "Every [Day]" (e.g., "Every Friday")
- "Weekly on [Day]"
- Must NOT contain specific dates

If detection fails, you can manually edit the assignment after parsing.

## Future Enhancements

- [x] PDF support
- [x] DOCX support
- [x] Recurring assignment detection
- [x] Edit assignments before sending
- [x] Interactive date picker for recurring assignments
- [ ] OCR support for scanned PDFs
- [ ] Semester date range configuration
- [ ] Multiple AI model options (Claude, GPT-4, etc.)
- [ ] Calendar integration (Google Calendar, Outlook)
- [ ] Export to CSV/Excel
- [ ] Assignment reminders and notifications
- [ ] Mobile app version

## Project Structure

```
notion-schedule-mcp/
├── app/
│   ├── api/
│   │   ├── composio/
│   │   │   ├── callback/route.ts
│   │   │   ├── connect-notion/route.ts
│   │   │   ├── databases/route.ts
│   │   │   └── link/route.ts
│   │   ├── notion-action/route.ts
│   │   └── parse-syllabus/route.ts
│   ├── layout.tsx
│   └── page.tsx
├── lib/
│   └── composio.ts
├── types/
│   └── index.ts
├── next.config.ts
└── package.json
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License

## Acknowledgments

- [Groq](https://groq.com/) for fast LLM inference
- [Composio](https://composio.dev/) for Notion integration
- [pdf-parse](https://www.npmjs.com/package/pdf-parse) for PDF text extraction
- [mammoth](https://www.npmjs.com/package/mammoth) for DOCX parsing
- [Next.js](https://nextjs.org/) for the amazing framework

---

Built with ❤️ using Next.js, Groq AI, and Composio
