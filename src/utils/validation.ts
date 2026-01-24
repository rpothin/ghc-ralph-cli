/**
 * Input Validation Utilities
 *
 * Functions for validating CLI input values
 */

export interface ValidationResult {
  valid: boolean;
  value?: number;
  error?: string;
}

/**
 * Parse and validate a positive integer from string input
 * @param input - The string value to parse
 * @param fieldName - Name of the field for error messages
 * @param options - Validation options
 */
export function parsePositiveInt(
  input: string,
  fieldName: string,
  options: { min?: number; max?: number } = {}
): ValidationResult {
  const value = parseInt(input, 10);

  if (Number.isNaN(value)) {
    return { valid: false, error: `${fieldName} must be a valid number` };
  }

  if (value < 1) {
    return { valid: false, error: `${fieldName} must be a positive number` };
  }

  if (options.min !== undefined && value < options.min) {
    return { valid: false, error: `${fieldName} must be at least ${options.min}` };
  }

  if (options.max !== undefined && value > options.max) {
    return { valid: false, error: `${fieldName} must be at most ${options.max}` };
  }

  return { valid: true, value };
}

/**
 * Parse and validate a non-negative integer from string input
 * @param input - The string value to parse
 * @param fieldName - Name of the field for error messages
 */
export function parseNonNegativeInt(
  input: string,
  fieldName: string
): ValidationResult {
  const value = parseInt(input, 10);

  if (Number.isNaN(value)) {
    return { valid: false, error: `${fieldName} must be a valid number` };
  }

  if (value < 0) {
    return { valid: false, error: `${fieldName} must be a non-negative number` };
  }

  return { valid: true, value };
}
