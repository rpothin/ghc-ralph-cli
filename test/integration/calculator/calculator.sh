#!/bin/bash
# Simple calculator script

# Usage: ./calculator.sh <num1> <operator> <num2>
# Operators: + - x /

num1=$1
op=$2
num2=$3

case $op in
    "+") echo $((num1 + num2)) ;;
    "-") echo $((num1 - num2)) ;;
    "x") echo $((num1 * num2)) ;;
    "/") echo $((num1 / num2)) ;;
    *) echo "Unknown operator: $op" >&2; exit 1 ;;
esac
