export function multiply(left, right) {
  return left * right;
}

export function divide(left, right) {
  if (right === 0) {
    throw new Error('divide by zero');
  }
  return left / right;
}
