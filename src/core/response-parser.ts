/**
 * Response Parser
 *
 * Parses AI responses to extract structured actions.
 * This is a core component of the Ralph pattern - the AI outputs
 * structured actions that we parse and execute.
 */

/**
 * Action types that the AI can request
 */
export type ActionType = 'CREATE' | 'EDIT' | 'DELETE' | 'EXECUTE' | 'COMPLETE' | 'STUCK';

/**
 * Base action interface
 */
export interface BaseAction {
  type: ActionType;
  raw: string; // Original action block text
}

/**
 * Create a new file
 */
export interface CreateAction extends BaseAction {
  type: 'CREATE';
  path: string;
  content: string;
}

/**
 * Edit an existing file
 */
export interface EditAction extends BaseAction {
  type: 'EDIT';
  path: string;
  oldContent: string;
  newContent: string;
}

/**
 * Delete a file
 */
export interface DeleteAction extends BaseAction {
  type: 'DELETE';
  path: string;
}

/**
 * Execute a shell command
 */
export interface ExecuteAction extends BaseAction {
  type: 'EXECUTE';
  command: string;
}

/**
 * Mark task as complete
 */
export interface CompleteAction extends BaseAction {
  type: 'COMPLETE';
  reason: string;
}

/**
 * Signal that the agent is stuck and cannot proceed
 */
export interface StuckAction extends BaseAction {
  type: 'STUCK';
  attempted: string;
  blocker: string;
  suggestion?: string;
}

/**
 * Union type of all actions
 */
export type Action = CreateAction | EditAction | DeleteAction | ExecuteAction | CompleteAction | StuckAction;

/**
 * Result of parsing a response
 */
export interface ParseResult {
  /** Successfully parsed actions */
  actions: Action[];
  /** Any parsing errors or warnings */
  errors: string[];
  /** Whether response contained any valid action blocks */
  hasActions: boolean;
  /** Raw text outside of action blocks (for logging/debugging) */
  freeText: string;
}

/**
 * Action block pattern - matches [ACTION:TYPE] blocks
 */
const ACTION_BLOCK_PATTERN = /\[ACTION:(CREATE|EDIT|DELETE|EXECUTE|COMPLETE|STUCK)\]([\s\S]*?)(?=\[ACTION:|$)/gi;

/**
 * Parse an AI response to extract structured actions
 */
export function parseResponse(response: string): ParseResult {
  const actions: Action[] = [];
  const errors: string[] = [];
  let freeText = response;

  // Find all action blocks
  const matches = [...response.matchAll(ACTION_BLOCK_PATTERN)];

  if (matches.length === 0) {
    return {
      actions: [],
      errors: ['No action blocks found in response'],
      hasActions: false,
      freeText: response.trim(),
    };
  }

  for (const match of matches) {
    const actionTypeStr = match[1];
    const actionBodyStr = match[2];
    if (!actionTypeStr || !actionBodyStr) continue;
    
    const actionType = actionTypeStr.toUpperCase() as ActionType;
    const actionBody = actionBodyStr.trim();
    const raw = match[0];

    // Remove this block from freeText
    freeText = freeText.replace(raw, '');

    try {
      const action = parseActionBody(actionType, actionBody, raw);
      if (action) {
        actions.push(action);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      errors.push(`Failed to parse ${actionType} action: ${errorMsg}`);
    }
  }

  return {
    actions,
    errors,
    hasActions: actions.length > 0,
    freeText: freeText.trim(),
  };
}

/**
 * Parse the body of an action block based on its type
 */
function parseActionBody(type: ActionType, body: string, raw: string): Action | null {
  switch (type) {
    case 'CREATE':
      return parseCreateAction(body, raw);
    case 'EDIT':
      return parseEditAction(body, raw);
    case 'DELETE':
      return parseDeleteAction(body, raw);
    case 'EXECUTE':
      return parseExecuteAction(body, raw);
    case 'COMPLETE':
      return parseCompleteAction(body, raw);
    case 'STUCK':
      return parseStuckAction(body, raw);
    default:
      return null;
  }
}

/**
 * Parse a CREATE action
 * Expected format:
 * path: relative/path/to/file
 * ```
 * file content
 * ```
 */
function parseCreateAction(body: string, raw: string): CreateAction {
  // Extract path
  const pathMatch = body.match(/^path:\s*(.+)$/m);
  if (!pathMatch?.[1]) {
    throw new Error('Missing path field');
  }
  const filePath = pathMatch[1].trim();

  // Extract content from code block
  const contentMatch = body.match(/```(?:\w*\n)?([\s\S]*?)```/);
  if (!contentMatch?.[1]) {
    throw new Error('Missing content code block');
  }
  const content = contentMatch[1];

  return {
    type: 'CREATE',
    path: filePath,
    content,
    raw,
  };
}

/**
 * Parse an EDIT action
 * Expected format:
 * path: relative/path/to/file
 * [OLD]
 * old content
 * [NEW]
 * new content
 */
function parseEditAction(body: string, raw: string): EditAction {
  // Extract path
  const pathMatch = body.match(/^path:\s*(.+)$/m);
  if (!pathMatch?.[1]) {
    throw new Error('Missing path field');
  }
  const filePath = pathMatch[1].trim();

  // Extract old and new content
  const oldMatch = body.match(/\[OLD\]\s*([\s\S]*?)\[NEW\]/);
  if (!oldMatch?.[1]) {
    throw new Error('Missing [OLD]...[NEW] markers');
  }
  const oldContent = oldMatch[1].trim();

  const newMatch = body.match(/\[NEW\]\s*([\s\S]*)$/);
  if (!newMatch?.[1]) {
    throw new Error('Missing content after [NEW] marker');
  }
  const newContent = newMatch[1].trim();

  return {
    type: 'EDIT',
    path: filePath,
    oldContent,
    newContent,
    raw,
  };
}

/**
 * Parse a DELETE action
 * Expected format:
 * path: relative/path/to/file
 */
function parseDeleteAction(body: string, raw: string): DeleteAction {
  const pathMatch = body.match(/^path:\s*(.+)$/m);
  if (!pathMatch?.[1]) {
    throw new Error('Missing path field');
  }
  const filePath = pathMatch[1].trim();

  return {
    type: 'DELETE',
    path: filePath,
    raw,
  };
}

/**
 * Parse an EXECUTE action
 * Expected format:
 * command: shell command here
 */
function parseExecuteAction(body: string, raw: string): ExecuteAction {
  const commandMatch = body.match(/^command:\s*(.+)$/m);
  if (!commandMatch?.[1]) {
    throw new Error('Missing command field');
  }
  const command = commandMatch[1].trim();

  return {
    type: 'EXECUTE',
    command,
    raw,
  };
}

/**
 * Parse a COMPLETE action
 * Expected format:
 * reason: explanation
 */
function parseCompleteAction(body: string, raw: string): CompleteAction {
  const reasonMatch = body.match(/^reason:\s*(.+)$/m);
  if (!reasonMatch?.[1]) {
    throw new Error('Missing reason field');
  }
  const reason = reasonMatch[1].trim();

  return {
    type: 'COMPLETE',
    reason,
    raw,
  };
}

/**
 * Parse a STUCK action
 * Expected format:
 * attempted: what was tried
 * blocker: what is preventing completion
 * suggestion: optional suggestion for next steps
 */
function parseStuckAction(body: string, raw: string): StuckAction {
  const attemptedMatch = body.match(/^attempted:\s*(.+)$/m);
  if (!attemptedMatch?.[1]) {
    throw new Error('Missing attempted field');
  }
  const attempted = attemptedMatch[1].trim();

  const blockerMatch = body.match(/^blocker:\s*(.+)$/m);
  if (!blockerMatch?.[1]) {
    throw new Error('Missing blocker field');
  }
  const blocker = blockerMatch[1].trim();

  const suggestionMatch = body.match(/^suggestion:\s*(.+)$/m);
  const suggestion = suggestionMatch?.[1]?.trim();

  const result: StuckAction = {
    type: 'STUCK',
    attempted,
    blocker,
    raw,
  };

  if (suggestion) {
    result.suggestion = suggestion;
  }

  return result;
}

/**
 * Check if a response contains a COMPLETE action
 */
export function hasCompleteAction(result: ParseResult): boolean {
  return result.actions.some((a) => a.type === 'COMPLETE');
}

/**
 * Check if a response contains a STUCK action
 */
export function hasStuckAction(result: ParseResult): boolean {
  return result.actions.some((a) => a.type === 'STUCK');
}

/**
 * Get the COMPLETE action if present
 */
export function getCompleteAction(result: ParseResult): CompleteAction | null {
  const action = result.actions.find((a) => a.type === 'COMPLETE');
  return action?.type === 'COMPLETE' ? action : null;
}

/**
 * Get the STUCK action if present
 */
export function getStuckAction(result: ParseResult): StuckAction | null {
  const action = result.actions.find((a) => a.type === 'STUCK');
  return action?.type === 'STUCK' ? action : null;
}

/**
 * Filter actions by type
 */
export function getActionsByType<T extends Action>(
  result: ParseResult,
  type: T['type']
): T[] {
  return result.actions.filter((a) => a.type === type) as T[];
}
