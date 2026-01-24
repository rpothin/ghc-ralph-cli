#!/bin/bash

# Calculator script - performs basic arithmetic operations
# Usage: ./calculator.sh <number1> <operation> <number2>

# Check for correct number of arguments
if [ $# -ne 3 ]; then
    echo "Usage: $0 <number1> <operation> <number2>" >&2
    exit 1
fi

num1="$1"
op="$2"
num2="$3"

# Validate numeric input
if ! [[ "$num1" =~ ^-?[0-9]+$ ]]; then
    echo "Error: First argument must be numeric" >&2
    exit 1
fi

if ! [[ "$num2" =~ ^-?[0-9]+$ ]]; then
    echo "Error: Second argument must be numeric" >&2
    exit 1
fi

# Perform operation
case "$op" in
    +)
        echo $((num1 + num2))
        ;;
    *)
        echo "Error: Invalid operation '$op'" >&2
        exit 1
        ;;
esac
