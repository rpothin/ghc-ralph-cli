/**
 * Core Loop Engine
 *
 * This module contains the core loop engine that:
 * - Manages the autonomous coding loop
 * - Tracks iterations and progress
 * - Handles checkpoints and state
 */

export { LoopEngine } from './loop-engine.js';
export type { LoopEngineConfig, LoopCompletionReason } from './loop-engine.js';

export { LoopEventEmitter } from './loop-events.js';
export type { LoopEvents } from './loop-events.js';

export { createInitialState, createIterationRecord, completeIteration } from './loop-state.js';
export type { IterationRecord, FullLoopState } from './loop-state.js';

export {
  ConfigManager,
  isValidConfigKey,
  validateConfigValue,
  parseConfigValue,
  getGlobalConfigPath,
  getLocalConfigPath,
  DEFAULT_CONFIG,
} from './config-manager.js';
export type { RalphConfiguration, ConfigKey } from './config-manager.js';

export type { PlanSource } from './config-schema.js';

export type { PlanManager, TaskFilter, PlanSourceType } from './plan-manager.js';

export { parseMarkdownPlan, toTask, updateTaskCheckbox } from './markdown-parser.js';
export type { ParsedMarkdownTask, ParsedMarkdownPlan } from './markdown-parser.js';

export { LocalMarkdownPlan } from './local-markdown-plan.js';

export { GitHubPlan } from './github-plan.js';
export type { GitHubPlanConfig } from './github-plan.js';

export { ProgressTracker } from './progress-tracker.js';
export type { SessionData, TaskResult, RunSession } from './progress-tracker.js';

export { ContextBuilder, createContextBuilder } from './context-builder.js';
export type { ContextBuilderConfig, BuiltContext } from './context-builder.js';

export { GitBranchManager, createGitBranchManager } from './git-branch-manager.js';
export type { GitBranchConfig, WorkingDirStatus, BranchInfo } from './git-branch-manager.js';

export { CheckpointManager, createCheckpointManager } from './checkpoint-manager.js';
export type { CheckpointConfig, Checkpoint } from './checkpoint-manager.js';

export { FileSafeguardManager, createFileSafeguardManager } from './file-safeguard.js';
export type { FileSafeguardConfig, BaselineSnapshot, FileOperations } from './file-safeguard.js';

export { parseResponse, hasCompleteAction, getCompleteAction, getActionsByType } from './response-parser.js';
export type {
  ActionType,
  Action,
  CreateAction,
  EditAction,
  DeleteAction,
  ExecuteAction,
  CompleteAction,
  ParseResult,
} from './response-parser.js';

export { ActionExecutor, createActionExecutor } from './action-executor.js';
export type { ActionResult, ExecutionResult, ActionExecutorConfig } from './action-executor.js';

export {
  VerificationManager,
  createVerificationManager,
  detectDefaultHooks,
} from './verification-hooks.js';
export type {
  VerificationResult,
  VerificationHook,
  VerificationHookType,
  VerificationConfig,
} from './verification-hooks.js';

export { FeedbackBuilder, createFeedbackBuilder } from './feedback-builder.js';
export type {
  FeedbackSectionType,
  FeedbackSection,
  IterationFeedback,
  FeedbackBuilderConfig,
} from './feedback-builder.js';

export {
  CREATE_EXAMPLE,
  EDIT_EXAMPLE,
  DELETE_EXAMPLE,
  EXECUTE_EXAMPLE,
  COMPLETE_EXAMPLE,
  STUCK_EXAMPLE,
  ALL_EXAMPLES,
  MINIMAL_EXAMPLES,
  FORMAT_INSTRUCTIONS,
  getPromptExamples,
  getModelStrength,
  getExamplesForModel,
} from './prompt-examples.js';
