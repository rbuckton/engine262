import { GetValue } from '../abstract-ops/all.mjs';
import { Evaluation, type ExpressionEvaluator } from '../evaluator.mjs';
import { Await, C, Q } from '../completion.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

/** https://tc39.es/ecma262/#sec-async-function-definitions-runtime-semantics-evaluation */
//   AwaitExpression : `await` UnaryExpression
export function* Evaluate_AwaitExpression({ UnaryExpression }: ParseNode.AwaitExpression): ExpressionEvaluator {
  // 1. Let exprRef be ? Evaluation of UnaryExpression.
  const exprRef = Q(yield* Evaluation(UnaryExpression));
  // 2. Let value be ? GetValue(exprRef).
  const value = Q(GetValue(exprRef));
  // 3. Return ? Await(value).
  return C(Q(yield* Await(value)));
}
