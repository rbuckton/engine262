import { Value } from '../value.mjs';
import { GetValue, ToBoolean } from '../abstract-ops/all.mjs';
import { Evaluation, type ExpressionEvaluator } from '../evaluator.mjs';
import { C, Q, X } from '../completion.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

/** https://tc39.es/ecma262/#sec-binary-logical-operators-runtime-semantics-evaluation */
//   LogicalANDExpression :
//     LogicalANDExpression `&&` BitwiseORExpression
export function* Evaluate_LogicalANDExpression({ LogicalANDExpression, BitwiseORExpression }: ParseNode.LogicalANDExpression): ExpressionEvaluator {
  // 1. Let lref be ? Evaluation of LogicalANDExpression.
  const lref = Q(yield* Evaluation(LogicalANDExpression));
  // 2. Let lval be ? GetValue(lref).
  const lval = Q(GetValue(lref));
  // 3. Let lbool be ! ToBoolean(lval).
  const lbool = X(ToBoolean(lval));
  // 4. If lbool is false, return lval.
  if (lbool === Value.false) {
    return C(lval);
  }
  // 5. Let rref be ? Evaluation of BitwiseORExpression.
  const rref = Q(yield* Evaluation(BitwiseORExpression));
  // 6. Return ? GetValue(rref).
  return C(Q(GetValue(rref)));
}
