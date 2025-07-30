export function Installation() {
  return (
    <>
      <p>
        PromptDial is available as both a web application and an API service. Choose the option that best fits your needs.
      </p>

      <h2>Web Application</h2>
      <p>
        The easiest way to get started is through our web interface at <code>promptdial.com</code>. 
        No installation required - just sign up and start optimizing your prompts immediately.
      </p>

      <h2>API Access</h2>
      <p>
        For developers and teams who want to integrate PromptDial into their workflows:
      </p>
      
      <h3>1. Get Your API Key</h3>
      <pre><code>
# Sign up at promptdial.com/api
# Navigate to Settings {">"} API Keys
# Generate a new API key
      </code></pre>

      <h3>2. Install the SDK</h3>
      <pre><code>
# npm
npm install promptdial

# yarn
yarn add promptdial

# pnpm
pnpm add promptdial
      </code></pre>

      <h3>3. Basic Usage</h3>
      <pre><code>{`
import { PromptDial } from 'promptdial';

const promptDial = new PromptDial({
  apiKey: process.env.PROMPTDIAL_API_KEY
});

const optimized = await promptDial.optimize({
  prompt: "Your prompt here",
  model: "gpt-4",
  level: "advanced"
});

console.log(optimized.variants[0].content);
`}</code></pre>

      <h2>Self-Hosted Option</h2>
      <p>
        For enterprise customers, PromptDial is available as a self-hosted solution. 
        Contact our sales team at <code>enterprise@promptdial.com</code> for more information.
      </p>
    </>
  )
}