# Migration to Nebius AI and pdf-parse

## Changes Made

### 1. **Replaced OpenAI with Nebius AI** 🤖

- Now using Nebius AI Studio API instead of OpenAI
- Model: `meta-llama/Meta-Llama-3.1-70B-Instruct`
- API Endpoint: `https://api.studio.nebius.ai/v1/chat/completions`

### 2. **Fixed DOMMatrix Error** ✅

- Replaced `pdfjs-dist` with `pdf-parse`
- `pdf-parse` works natively in Node.js (no browser APIs needed)
- Simpler, more reliable for server-side PDF text extraction

## Required Steps

### 1. Install New Packages

Run these commands:

```bash
npm uninstall pdfjs-dist openai
npm install pdf-parse
```

Or if you prefer all at once:

```bash
npm install pdf-parse
```

### 2. Get Nebius AI API Key

1. Go to [Nebius AI Studio](https://studio.nebius.ai/)
2. Sign up or log in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key

### 3. Update Environment Variables

Edit `.env.local`:

```env
NEBIUS_API_KEY=your_nebius_api_key_here
COMPOSIO_API_KEY=ak_Z4mQqx6kFfJL-dDwRKWX
```

### 4. Restart Development Server

```bash
npm run dev
```

## Why These Changes?

### Why pdf-parse instead of pdfjs-dist?

**Problem with pdfjs-dist:**

- Designed for browser environments
- Uses browser APIs like `DOMMatrix`, `Canvas`, etc.
- Causes errors in Node.js/Next.js server environments

**Benefits of pdf-parse:**

- ✅ Built specifically for Node.js
- ✅ No browser API dependencies
- ✅ Simpler API
- ✅ Fast and reliable
- ✅ Works perfectly in Next.js API routes

### Why Nebius AI instead of OpenAI?

**Benefits:**

- ✅ You requested it!
- ✅ Competitive pricing
- ✅ Good model performance (Llama 3.1 70B)
- ✅ Similar API structure to OpenAI
- ✅ Great for structured data extraction

## API Comparison

### Before (OpenAI):

```typescript
const completion = await openai.chat.completions.create({
  model: "gpt-4o-mini",
  messages: [...],
  response_format: { type: "json_object" }
});
```

### After (Nebius AI):

```typescript
const response = await fetch(NEBIUS_API_URL, {
  method: "POST",
  headers: {
    "Authorization": `Bearer ${NEBIUS_API_KEY}`,
    "Content-Type": "application/json"
  },
  body: JSON.stringify({
    model: "meta-llama/Meta-Llama-3.1-70B-Instruct",
    messages: [...]
  })
});
```

## Testing

After making these changes:

1. Upload a syllabus PDF
2. Click "Parse Syllabi with AI"
3. Verify assignments are extracted correctly
4. Send to Notion

## Troubleshooting

### "Cannot find module 'pdf-parse'"

Run: `npm install pdf-parse`

### "Nebius AI API error"

- Check your API key in `.env.local`
- Verify the key is active at https://studio.nebius.ai/

### PDF parsing fails

- Ensure PDF is not password-protected
- Check that it's a text-based PDF (not scanned images)
- Try a different PDF to isolate the issue

## Models Available on Nebius AI

You can also try these models by changing the model name:

- `meta-llama/Meta-Llama-3.1-70B-Instruct` (current, recommended)
- `meta-llama/Meta-Llama-3.1-8B-Instruct` (faster, lighter)
- `Qwen/Qwen2.5-72B-Instruct`

Just update the model name in `app/api/parse-syllabus/route.ts`.

## Next Steps

✅ All code changes are complete  
⚠️ Install `pdf-parse`: `npm install pdf-parse`  
⚠️ Get Nebius AI API key  
⚠️ Update `.env.local`  
⚠️ Restart dev server

Then test the app! 🚀
