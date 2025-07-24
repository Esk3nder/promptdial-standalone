# AI Platform Deep Links Demo

This feature adds "Open in" buttons alongside the copy functionality, allowing users to click and directly open AI platforms with their optimized prompts.

## What's New

### ChatGPT Deep Link

- **URL Format**: `https://chat.openai.com/?q=<encoded_prompt>`
- **Behavior**: Opens ChatGPT with the prompt pre-filled
- **Requirement**: Requires "Prompt ChatGPT via URL param" Chrome extension for auto-submit
- **Visual Indicator**: Shows "\*" symbol and disclaimer about extension requirement

### Other Platforms

- **Claude**: Opens `https://claude.ai/` (no deep link support, user pastes manually)
- **Gemini**: Opens `https://gemini.google.com/` (no deep link support, user pastes manually)
- **Perplexity**: Opens `https://perplexity.ai/` (no deep link support, user pastes manually)

## Usage Flow

1. User enters prompt and clicks "Refine Prompt"
2. PromptDial optimizes the prompt
3. Results show both:
   - **Copy button**: Traditional copy-to-clipboard
   - **Open in buttons**: Direct links to AI platforms
4. User clicks "ChatGPT" button → Browser opens ChatGPT with prompt pre-filled
5. User clicks other platform buttons → Browser opens platform's main interface

## Technical Implementation

### Core Components

1. **`/utils/deepLinks.ts`** - Utility functions for generating platform URLs
2. **`/components/DeepLinkButtons/`** - Reusable component for rendering platform buttons
3. **Integration** - Added to `ResultsList` and `OptimizedPromptViewer` components

### URL Encoding

All prompts are properly URL-encoded using `encodeURIComponent()` to handle:

- Special characters (&, =, ?, #)
- Spaces and line breaks
- Unicode characters

### Browser Security

- Links open with `window.open(url, '_blank', 'noopener,noreferrer')`
- Prevents opener access and referrer leakage
- Safe handling of user-generated content

## User Experience

### Before

1. Click copy
2. Open ChatGPT in new tab
3. Paste and submit prompt

### After (with extension)

1. Click "ChatGPT" button
2. Browser opens ChatGPT and auto-submits optimized prompt

### Visual Design

- Buttons use emojis for platform recognition (🤖 🔮 💎 🔍)
- Extension-required buttons shown with dashed border and warning color
- Responsive design works on mobile and desktop
- Dark mode support included

## Testing

- ✅ Unit tests for utility functions
- ✅ Component tests for button rendering and click behavior
- ✅ URL encoding verification with special characters
- ✅ TypeScript compilation without errors

## Browser Extension Info

The ChatGPT deep link functionality requires the "Prompt ChatGPT via URL param" extension:

- Available on Chrome Web Store
- Automatically submits prompts when URL contains `?q=` parameter
- Without extension, ChatGPT opens but user must manually submit prompt
