import { Evaluation, type ExpressionEvaluator } from '../evaluator.mjs';
import { OutOfRange } from '../helpers.mjs';
import {
  GetValue,
  PutValue,
  ToNumeric,
} from '../abstract-ops/all.mjs';
import { BigIntValue, NumberValue, TypeForMethod } from '../value.mjs';
import { C, Q, X } from '../completion.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

// UpdateExpression :
//   LeftHandSideExpression `++`
//   LeftHandSideExpression `--`
//   `++` UnaryExpression
//   `--` UnaryExpression
export function* Evaluate_UpdateExpression({ LeftHandSideExpression, operator, UnaryExpression }: ParseNode.UpdateExpression): ExpressionEvaluator {
  // UpdateExpression : LeftHandSideExpression `++`
  if (operator === '++' && LeftHandSideExpression) {
    // 1. Let lhs be ? Evaluation of LeftHandSideExpression.
    const lhs = Q(yield* Evaluation(LeftHandSideExpression));
    // 2. Let oldValue be ? ToNumeric(? GetValue(lhs)).
    const oldValue = Q(ToNumeric(Q(GetValue(lhs))));
    // 3. Let newValue be ! Type(oldvalue)::add(oldValue, Type(oldValue)::unit).
    const newValue = X(TypeForMethod(oldValue).add(oldValue as NumberValue & BigIntValue, TypeForMethod(oldValue).unit as NumberValue & BigIntValue)); // NOTE: unsound casts
    // 4. Perform ? PutValue(lhs, newValue).
    Q(PutValue(lhs, newValue));
    // 5. Return oldValue.
    return C(oldValue);
  }

  // UpdateExpression : LeftHandSideExpression `--`
  if (operator === '--' && LeftHandSideExpression) {
    // 1. Let lhs be ? Evaluation of LeftHandSideExpression.
    const lhs = Q(yield* Evaluation(LeftHandSideExpression));
    // 2. Let oldValue be ? ToNumeric(? GetValue(lhs)).
    const oldValue = Q(ToNumeric(Q(GetValue(lhs))));
    // 3. Let newValue be ! Type(oldvalue)::subtract(oldValue, Type(oldValue)::unit).
    const newValue = X(TypeForMethod(oldValue).subtract(oldValue as NumberValue & BigIntValue, TypeForMethod(oldValue).unit as NumberValue & BigIntValue)); // NOTE: unsound casts
    // 4. Perform ? PutValue(lhs, newValue).
    Q(PutValue(lhs, newValue));
    // 5. Return oldValue.
    return C(oldValue);
  }

  // UpdateExpression : `++` UnaryExpression
  if (operator === '++' && UnaryExpression) {
    // 1. Let expr be ? Evaluation of UnaryExpression.
    const expr = Q(yield* Evaluation(UnaryExpression));
    // 2. Let oldValue be ? ToNumeric(? GetValue(expr)).
    const oldValue = Q(ToNumeric(Q(GetValue(expr))));
    // 3. Let newValue be ! Type(oldvalue)::add(oldValue, Type(oldValue)::unit).
    const newValue = X(TypeForMethod(oldValue).add(oldValue as NumberValue & BigIntValue, TypeForMethod(oldValue).unit as NumberValue & BigIntValue)); // NOTE: unsound casts
    // 4. Perform ? PutValue(expr, newValue).
    Q(PutValue(expr, newValue));
    // 5. Return newValue.
    return C(newValue);
  }

  // UpdateExpression : `--` UnaryExpression
  if (operator === '--' && UnaryExpression) {
    // 1. Let expr be ? Evaluation of UnaryExpression.
    const expr = Q(yield* Evaluation(UnaryExpression));
    // 2. Let oldValue be ? ToNumeric(? GetValue(expr)).
    const oldValue = Q(ToNumeric(Q(GetValue(expr))));
    // 3. Let newValue be ! Type(oldvalue)::subtract(oldValue, Type(oldValue)::unit).
    const newValue = X(TypeForMethod(oldValue).subtract(oldValue as NumberValue & BigIntValue, TypeForMethod(oldValue).unit as NumberValue & BigIntValue)); // NOTE: unsound casts
    // 4. Perform ? PutValue(expr, newValue).
    Q(PutValue(expr, newValue));
    // 5. Return newValue.
    return C(newValue);
  }

  throw new OutOfRange('Evaluate_UpdateExpression', operator);
}
