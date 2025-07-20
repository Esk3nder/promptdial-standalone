# PromptDial UI

A clean, accessible web interface for testing the PromptDial prompt optimization engine locally.

## Features

- **Prompt Optimization**: Transform basic prompts into optimized, model-specific queries
- **Multi-Model Support**: Optimize for GPT-4, Claude 3 Opus, or Gemini Pro
- **Optimization Levels**: Choose from Basic, Advanced, or Expert optimization
- **Quality Scoring**: See quality scores and improvement suggestions
- **Keyboard Shortcuts**: Use Cmd+Enter to quickly optimize
- **Accessibility First**: WCAG compliant with screen reader support
- **Copy to Clipboard**: One-click copying of optimized prompts

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm 9+

### Installation

From the monorepo root:

```bash
# Install all dependencies
npm install

# Navigate to UI package
cd packages/ui
```

### Development

```bash
# Start the development server
npm run dev

# The UI will be available at http://localhost:5173
```

### Testing

```bash
# Run tests in watch mode
npm test

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

### Building

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Architecture

The UI is built with:
- **React 18** with TypeScript
- **Vite** for fast development and building
- **CSS Modules** for scoped styling
- **Vitest** for testing
- **MSW** for API mocking in tests

### Component Structure

```
src/
├── components/
│   ├── PromptForm/      # Input form with configuration
│   ├── ResultsList/     # Results container with states
│   ├── VariantCard/     # Individual result display
│   └── common/          # Shared accessible components
├── hooks/               # Custom React hooks
├── types/               # TypeScript type definitions
└── utils/               # Utility functions
```

### Key Components

1. **PromptForm**: Handles user input and configuration
   - Textarea with character count (max 10,000)
   - Model, level, and task type selection
   - Validation and error handling
   - Keyboard shortcut support

2. **ResultsList**: Displays optimization results
   - Loading, error, and empty states
   - Summary statistics
   - Responsive grid layout

3. **VariantCard**: Shows individual optimized variants
   - Quality score with color coding
   - List of improvements
   - Model-specific features
   - Copy functionality

## Accessibility

The UI includes:
- Proper ARIA labels and roles
- Keyboard navigation support
- Screen reader announcements
- Focus management
- High contrast support
- Reduced motion support

## Testing

Tests are written using:
- **Vitest** for unit testing
- **React Testing Library** for component testing
- **jest-axe** for accessibility testing
- **MSW** for mocking API responses

Run a specific test file:
```bash
npx vitest src/components/PromptForm/PromptForm.test.tsx
```

## Performance

- Debounced input to prevent excessive re-renders
- Memoized components where appropriate
- Optimized bundle size (no heavy CSS frameworks)
- Fast development with Vite HMR

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (iOS Safari, Chrome Android)

## Contributing

1. Follow the existing component patterns
2. Write tests first (TDD)
3. Ensure accessibility compliance
4. Use semantic HTML
5. Keep components focused and reusable

## License

MIT