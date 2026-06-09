# LinkPreview

A web tool for previewing Open Graph metadata from any URL.

## Tech Stack

- Vanilla HTML, CSS, JavaScript — no frameworks or build tools

## Design Goals

- **Clean card layout**: Display OG metadata (title, description, image, URL) in a structured, readable card
- **Clear error states**: Provide informative feedback when a URL is invalid, unreachable, or missing OG tags

## Project Structure

```
LinkPreview/
├── index.html      # Main entry point
├── style.css       # Styles
└── script.js       # Fetch logic and DOM manipulation
```

## Notes

- OG metadata must be fetched server-side or via a proxy to avoid CORS issues
- Handle missing OG fields gracefully — fall back to page title, favicon, or placeholder
