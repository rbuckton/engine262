import { C, Q } from '../completion.mjs';
import { Evaluation, type ExpressionEvaluator } from '../evaluator.mjs';
import { GetValue } from '../abstract-ops/all.mjs';
import { Value } from '../value.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

/** https://tc39.es/ecma262/#sec-binary-logical-operators-runtime-semantics-evaluation */
//   CoalesceExpression :
//     CoalesceExpressionHead `??` BitwiseORExpression
export function* Evaluate_CoalesceExpression({ CoalesceExpressionHead, BitwiseORExpression }: ParseNode.CoalesceExpression): ExpressionEvaluator {
  // 1. Let lref be ? Evaluation of |CoalesceExpressionHead|.
  const lref = Q(yield* Evaluation(CoalesceExpressionHead));
  // 2. Let lval be ? GetValue(lref).
  const lval = Q(GetValue(lref));
  // 3. If lval is *undefined* or *null*,
  if (lval === Value.undefined || lval === Value.null) {
    // a. Let rref be ? Evaluation of |BitwiseORExpression|.
    const rref = Q(yield* Evaluation(BitwiseORExpression));
    // b. Return ? GetValue(rref).
    return C(Q(GetValue(rref)));
  }
  // 4. Otherwise, return lval.
  return C(lval);
}
