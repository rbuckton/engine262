import { Value } from '../value.mjs';
import { Evaluation, type ExpressionEvaluator } from '../evaluator.mjs';
import { ToBoolean, GetValue } from '../abstract-ops/all.mjs';
import { C, Q } from '../completion.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

/** https://tc39.es/ecma262/#sec-conditional-operator-runtime-semantics-evaluation */
//   ConditionalExpression :
//     ShortCircuitExpression `?` AssignmentExpression `:` AssignmentExpression
export function* Evaluate_ConditionalExpression({
  ShortCircuitExpression,
  AssignmentExpression_a,
  AssignmentExpression_b,
}: ParseNode.ConditionalExpression): ExpressionEvaluator {
  // 1. Let lref be ? Evaluation of ShortCircuitExpression.
  const lref = Q(yield* Evaluation(ShortCircuitExpression));
  // 2. Let lval be ToBoolean(? GetValue(lref)).
  const lval = ToBoolean(Q(GetValue(lref)));
  // 3. If lval is true, then
  if (lval === Value.true) {
    // a. Let trueRef be ? Evaluation of the first AssignmentExpression.
    const trueRef = Q(yield* Evaluation(AssignmentExpression_a));
    // b. Return ? GetValue(trueRef).
    return C(Q(GetValue(trueRef)));
  } else { // 4. Else,
    // a. Let falseRef be ? Evaluation of the second AssignmentExpression.
    const falseRef = Q(yield* Evaluation(AssignmentExpression_b));
    // b. Return ? GetValue(falseRef).
    return C(Q(GetValue(falseRef)));
  }
}
