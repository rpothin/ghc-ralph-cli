# Calculator Bash Script Implementation Plan

## Overview
Implement a bash script (`calculator.sh`) that performs basic arithmetic operations.
The script should accept two numbers and an operation as arguments.

## Usage
```bash
./calculator.sh <number1> <operation> <number2>
```

## Implementation Tasks

### Phase 1: Addition
- [ ] Create calculator.sh with basic structure
- [ ] Implement addition operation (+)
- [ ] Handle basic input validation
- [ ] Return result to stdout

### Phase 2: Subtraction
- [ ] Implement subtraction operation (-)
- [ ] Ensure correct operand order (number1 - number2)

### Phase 3: Multiplication
- [ ] Implement multiplication operation (x or *)
- [ ] Handle shell escaping for * character

### Phase 4: Division
- [ ] Implement division operation (/)
- [ ] Handle division by zero error
- [ ] Return integer result (bash arithmetic)

## Expected Behavior

### Examples
```bash
./calculator.sh 5 + 3    # Output: 8
./calculator.sh 10 - 4   # Output: 6
./calculator.sh 6 x 7    # Output: 42
./calculator.sh 20 / 4   # Output: 5
./calculator.sh 10 / 0   # Output: Error: Division by zero
```

### Error Handling
- Invalid number of arguments: Show usage message
- Invalid operation: Show error and supported operations
- Division by zero: Show specific error message
- Non-numeric input: Show error message

## Success Criteria
All unit tests in calculator.test.ts must pass after implementation.
