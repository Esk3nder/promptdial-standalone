/// <reference types="vite/client" />

// CSS modules
declare module '*.module.css' {
  const classes: { readonly [key: string]: string }
  export default classes
}

// Regular CSS files
declare module '*.css' {
  const css: string
  export default css
}

// Environment variables
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_OPENAI_API_KEY?: string
  readonly VITE_ANTHROPIC_API_KEY?: string
  readonly VITE_GOOGLE_API_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}