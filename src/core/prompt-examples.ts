/**
 * Prompt Examples
 *
 * Provides concrete examples of ACTION blocks for weaker models.
 * The original Ralph pattern was designed for Claude's strong instruction-following.
 * For weaker models (like gpt-4.1), explicit examples help ensure correct output format.
 */

/**
 * Example of ACTION:CREATE block
 */
export const CREATE_EXAMPLE = `[ACTION:CREATE]
path: src/calculator.sh
\`\`\`bash
#!/bin/bash
# Simple calculator

num1=$1
op=$2
num2=$3

case $op in
    "+") echo $((num1 + num2)) ;;
    "-") echo $((num1 - num2)) ;;
    "*") echo $((num1 * num2)) ;;
    "/") echo $((num1 / num2)) ;;
esac
\`\`\``;

/**
 * Example of ACTION:EDIT block
 */
export const EDIT_EXAMPLE = `[ACTION:EDIT]
path: src/calculator.sh
[OLD]
case $op in
    "+") echo $((num1 + num2)) ;;
esac
[NEW]
case $op in
    "+") echo $((num1 + num2)) ;;
    "-") echo $((num1 - num2)) ;;
esac`;

/**
 * Example of ACTION:DELETE block
 */
export const DELETE_EXAMPLE = `[ACTION:DELETE]
path: src/old-file.ts`;

/**
 * Example of ACTION:EXECUTE block
 */
export const EXECUTE_EXAMPLE = `[ACTION:EXECUTE]
command: npm test`;

/**
 * Example of ACTION:COMPLETE block
 */
export const COMPLETE_EXAMPLE = `[ACTION:COMPLETE]
reason: All tests pass. Calculator implements addition, subtraction, multiplication, and division.`;

/**
 * Example of ACTION:STUCK block (for when task cannot be completed)
 */
export const STUCK_EXAMPLE = `[ACTION:STUCK]
attempted: Tried 3 different approaches to fix the syntax error in case statement
blocker: Bash case syntax requires specific quoting for * character that conflicts with shell expansion
suggestion: Consider using a different operator syntax or escaping approach - may need human review`;

/**
 * All examples combined for inclusion in prompts
 */
export const ALL_EXAMPLES = `
### Example: Create a new file
${CREATE_EXAMPLE}

### Example: Edit an existing file
${EDIT_EXAMPLE}

### Example: Run a command to test
${EXECUTE_EXAMPLE}

### Example: Mark task complete (ONLY when tests pass!)
${COMPLETE_EXAMPLE}

### Example: Report when stuck (be honest if you can't complete!)
${STUCK_EXAMPLE}
`;

/**
 * Minimal examples (for context-constrained situations)
 */
export const MINIMAL_EXAMPLES = `
Example CREATE:
[ACTION:CREATE]
path: file.sh
\`\`\`bash
#!/bin/bash
echo "Hello"
\`\`\`

Example EDIT:
[ACTION:EDIT]
path: file.sh
[OLD]
echo "Hello"
[NEW]
echo "Hello World"

Example EXECUTE:
[ACTION:EXECUTE]
command: ./file.sh

Example COMPLETE (only when tests pass!):
[ACTION:COMPLETE]
reason: Task done, tests pass

Example STUCK (when you cannot complete):
[ACTION:STUCK]
attempted: Tried X approach
blocker: Error Y prevents completion
suggestion: Try Z instead
`;

/**
 * Format instructions for ACTION blocks
 */
export const FORMAT_INSTRUCTIONS = `## Output Format

You MUST respond using ONLY structured ACTION blocks. DO NOT write prose explanations.

Available actions:

**[ACTION:CREATE]** - Create a new file
\`\`\`
[ACTION:CREATE]
path: <relative file path>
\`\`\`<language>
<file content>
\`\`\`
\`\`\`

**[ACTION:EDIT]** - Modify an existing file  
\`\`\`
[ACTION:EDIT]
path: <relative file path>
[OLD]
<exact text to find>
[NEW]
<replacement text>
\`\`\`

**[ACTION:EXECUTE]** - Run a shell command
\`\`\`
[ACTION:EXECUTE]
command: <shell command>
\`\`\`

**[ACTION:COMPLETE]** - Mark task as done (ONLY when all tests pass!)
\`\`\`
[ACTION:COMPLETE]
reason: <brief explanation of why task is complete>
\`\`\`

**[ACTION:STUCK]** - Report inability to complete (be honest!)
\`\`\`
[ACTION:STUCK]
attempted: <what you tried>
blocker: <what prevents completion>
suggestion: <what might help>
\`\`\`

## Important Rules
1. Use EXACT text for [OLD] blocks - must match file contents precisely
2. Use [ACTION:EXECUTE] to run tests before marking complete
3. Only use [ACTION:COMPLETE] when ALL tests pass with exit code 0
4. Use [ACTION:STUCK] if you cannot complete - honesty is critical!
5. One action per block - you can include multiple blocks
`;

/**
 * Get prompt examples based on model strength
 */
export function getPromptExamples(modelStrength: 'strong' | 'medium' | 'weak'): string {
  switch (modelStrength) {
    case 'strong':
      // Strong models (Claude, GPT-4o) need minimal examples
      return FORMAT_INSTRUCTIONS;
    case 'medium':
      // Medium models need format + minimal examples
      return FORMAT_INSTRUCTIONS + '\n\n## Examples\n' + MINIMAL_EXAMPLES;
    case 'weak':
      // Weak models (gpt-4.1, smaller models) need full examples
      return FORMAT_INSTRUCTIONS + '\n\n## Detailed Examples\n' + ALL_EXAMPLES;
    default:
      return FORMAT_INSTRUCTIONS;
  }
}

/**
 * Map model names to strength levels
 */
export function getModelStrength(model: string): 'strong' | 'medium' | 'weak' {
  const normalized = model.toLowerCase();
  
  // Strong models - excellent instruction following
  if (
    normalized.includes('claude') ||
    normalized.includes('gpt-4o') ||
    normalized.includes('gpt-5') ||
    normalized.includes('sonnet') ||
    normalized.includes('opus')
  ) {
    return 'strong';
  }
  
  // Medium models - good but benefit from examples
  if (
    normalized.includes('gpt-4-turbo') ||
    normalized.includes('gemini')
  ) {
    return 'medium';
  }
  
  // Weak models - need explicit examples
  // Includes gpt-4.1 (default due to 0x cost), gpt-3.5, smaller models
  return 'weak';
}

/**
 * Get appropriate examples for a specific model
 */
export function getExamplesForModel(model: string): string {
  const strength = getModelStrength(model);
  return getPromptExamples(strength);
}
