# Test Prompts for PromptDial

## ⚠️ Current System Limitations

**IMPORTANT**: The current implementation does NOT use AI. It only performs basic string transformations:

- Adds "Please" to prompts
- Replaces vague words like "something" with "specific content"
- Appends generic instructions based on detected task type
- No actual AI optimization occurs

## Good Test Prompts

### 1. Basic Test - Shows String Manipulation

```
write something about AI
```

**What will happen:**

- Basic: Will add "Please" and change "something" to "specific content"
- Advanced: Will add more generic instructions
- Expert: Will add even more boilerplate text

### 2. Coding Task Test

```
create a function to sort an array
```

**What will happen:**

- System will detect "coding" task type
- Will append: "Specify the programming language. Define input and output formats. Include error handling requirements"

### 3. Creative Writing Test

```
tell me a story about a robot
```

**What will happen:**

- System will detect "creative" task type
- Will add creative writing instructions

### 4. Analytical Task Test

```
analyze the impact of climate change
```

**What will happen:**

- System will detect "analytical" task type
- Will add analytical instructions

### 5. Vague Terms Test

```
do something with this thing somehow
```

**What will happen:**

- Will replace "something" → "specific content"
- Will replace "thing" → "specific item"
- Will replace "somehow" → "using a specific method"

## How to Test

1. Start the server:

   ```bash
   npm start
   ```

2. Go to http://localhost:3000

3. Try each prompt with different:
   - Models (GPT-4, Claude, Gemini) - Note: No actual difference in output
   - Optimization levels (Basic, Advanced, Expert)

## Expected Results

### Basic Level (1 variant)

- Minimal changes
- Just adds clarity

### Advanced Level (3 variants)

- More modifications
- Different structure variations

### Expert Level (5 variants)

- Maximum modifications
- Multiple structural approaches

## What You WON'T See

- ❌ Actual AI-powered improvements
- ❌ Model-specific optimizations
- ❌ Intelligent context understanding
- ❌ Sophisticated prompt engineering
- ❌ Real quality improvements

## Real Implementation Would Include

To make this actually useful, we would need:

1. **API Integration**

   ```javascript
   // Example with OpenAI
   const response = await openai.chat.completions.create({
     model: 'gpt-4',
     messages: [
       {
         role: 'system',
         content: 'You are a prompt optimization expert...',
       },
       {
         role: 'user',
         content: `Optimize this prompt for ${targetModel}: ${userPrompt}`,
       },
     ],
   })
   ```

2. **Environment Variables**

   ```
   OPENAI_API_KEY=sk-...
   ANTHROPIC_API_KEY=sk-ant-...
   GOOGLE_API_KEY=...
   ```

3. **Actual Optimization Logic**
   - Analyze prompt structure
   - Identify weaknesses
   - Apply model-specific best practices
   - Generate truly optimized variants

## Try These Tests

1. **Shortest prompt**: `hi`
2. **Question**: `what is 2+2?`
3. **Command**: `explain quantum physics`
4. **With typos**: `explan machne lerning`
5. **Already good prompt**: `Please provide a comprehensive explanation of machine learning, including supervised and unsupervised learning techniques, with examples`

You'll see that regardless of how good or bad the input is, the system just applies the same basic transformations!
