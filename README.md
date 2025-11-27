# Syllabus to Notion Schedule

Automatically parse course syllabi PDFs and create a Notion deadline tracker using AI and Composio MCP integration.

## Features

- 📄 **PDF Upload**: Drag & drop or select multiple syllabus PDF files
- 🤖 **AI-Powered Parsing**: Extracts assignments, due dates, weights, and descriptions using LLM
- 📊 **Beautiful Display**: View all extracted assignments in an organized format
- 📝 **Notion Integration**: Send parsed data directly to Notion via Composio MCP
- 🎨 **Modern UI**: Clean, responsive design with dark mode support

## Getting Started

### Prerequisites

1. Node.js 18+ installed
2. Nebius API key ([Get one here](https://studio.nebius.com/))
3. Composio API key ([Sign up at Composio](https://composio.dev))
4. A Notion account and database for tracking assignments

### Installation

1. **Install dependencies**:

   ```bash
   npm install pdfjs-dist openai
   ```

2. **Configure environment variables**:

   Copy `.env.example` to `.env.local`:

   ```bash
   copy .env.example .env.local
   ```

   Fill in your API keys in `.env.local`:

   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   COMPOSIO_API_KEY=your_composio_api_key_here
   ```

3. **Run the development server**:

   ```bash
   npm run dev
   ```

4. **Open your browser** and navigate to [http://localhost:3000](http://localhost:3000)

## Setting Up Notion

### Step 1: Create a Notion Database

1. Go to your Notion workspace
2. Create a new database (Table view recommended)
3. Add the following properties:
   - **Name** (Title) - Assignment name
   - **Course** (Text) - Course name
   - **Due Date** (Date) - When the assignment is due
   - **Weight** (Text) - Grade weight (e.g., "20%")
   - **Type** (Select) - Assignment type (Assignment, Exam, Project, etc.)
   - **Status** (Select) - Status (Not Started, In Progress, Completed)

### Step 2: Get Your Database ID

1. Open your Notion database in a browser
2. Copy the database ID from the URL:
   ```
   https://notion.so/myworkspace/abc123def456?v=...
                                 ^^^^^^^^^^^^
                                 This is your database ID
   ```
3. Paste this ID into the app when sending to Notion

### Step 3: Connect Composio to Notion

1. Log in to [Composio Dashboard](https://app.composio.dev)
2. Connect your Notion account
3. Grant necessary permissions for creating pages in databases

## How to Use

### 1. Upload Syllabi

- Click "Upload PDF files" or drag & drop PDFs into the upload area
- You can upload multiple syllabus files at once
- View uploaded files with their names and sizes
- Remove any file by clicking the X button

### 2. Parse with AI

- Click "Parse Syllabi with AI"
- The app will:
  - Extract text from all PDFs
  - Use OpenAI to intelligently identify assignments
  - Extract: titles, due dates, weights, types, descriptions

### 3. Review Extracted Data

- View all extracted assignments organized by course
- Check that dates and weights are correct
- See assignment types, descriptions, and notes

### 4. Send to Notion

- (Optional) Enter your Notion Database ID
- Click "Send to Notion"
- All assignments will be created as individual pages in your database

## Technology Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **PDF Parsing**: pdfjs-dist (Mozilla's PDF.js)
- **AI Processing**: OpenAI GPT-4o-mini
- **Integration**: Composio MCP for Notion
- **Deployment**: Vercel-ready

## API Routes

### POST `/api/parse-syllabus`

Parses uploaded PDF syllabi and extracts assignment information.

**Request**: FormData with `files` field containing PDF files

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
          "title": "Assignment 1",
          "dueDate": "2024-09-15",
          "weight": "10%",
          "type": "Assignment",
          "description": "Introduction to algorithms",
          "additionalNotes": "Submit via Canvas"
        }
      ]
    }
  ]
}
```

### POST `/api/send-to-notion`

Sends parsed assignments to Notion database via Composio.

**Request**:

```json
{
  "results": [...parsed results...],
  "notionDatabaseId": "abc123def456" // optional
}
```

**Response**:

```json
{
  "success": true,
  "message": "Successfully created 5 out of 5 assignments in Notion",
  "pages": [...]
}
```

## Extracted Data Structure

The AI extracts the following information from each assignment:

- **Title**: Assignment/exam/project name
- **Due Date**: ISO format (YYYY-MM-DD) when possible
- **Weight**: Grade percentage or points (e.g., "20%", "100 points")
- **Type**: Assignment, Exam, Project, Quiz, Paper, etc.
- **Description**: Brief description of the assignment
- **Additional Notes**: Any important notes or requirements

Plus course-level information:

- Course name/code
- Semester/term
- Instructor name

## Troubleshooting

### PowerShell Execution Policy Error

If you see an error about script execution being disabled:

```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

Or use Command Prompt (cmd.exe) instead of PowerShell.

### PDF Text Not Extracted Properly

Some PDFs may be scanned images. The AI will do its best, but OCR capabilities are limited. Use text-based PDFs for best results.

### Composio/Notion Connection Issues

1. Verify your Composio API key is correct
2. Check that Notion is connected in Composio dashboard
3. Ensure proper permissions are granted
4. Verify your Notion database ID is correct

### OpenAI Rate Limits

If parsing fails due to rate limits:

- Wait a few minutes and try again
- Upgrade your OpenAI plan for higher limits
- Parse fewer syllabi at once

## Future Enhancements

- [ ] OCR support for scanned PDFs
- [ ] Multiple AI model options (Claude, Gemini, etc.)
- [ ] Calendar integration (Google Calendar, Outlook)
- [ ] Export to CSV/Excel
- [ ] Assignment reminders and notifications
- [ ] Mobile app version
- [ ] Batch processing for multiple courses

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT License

## Support

For issues or questions, please open an issue on GitHub or contact support.

---

Built with ❤️ using Next.js, OpenAI, and Composio
