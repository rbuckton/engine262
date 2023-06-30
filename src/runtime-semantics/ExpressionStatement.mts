import { GetValue } from '../abstract-ops/all.mjs';
import { Evaluation, type StatementEvaluator } from '../evaluator.mjs';
import { C, Q } from '../completion.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

/** https://tc39.es/ecma262/#sec-expression-statement-runtime-semantics-evaluation */
//   ExpressionStatement :
//     Expression `;`
export function* Evaluate_ExpressionStatement({ Expression }: ParseNode.ExpressionStatement): StatementEvaluator {
  // 1. Let exprRef be ? Evaluation of Expression.
  const exprRef = Q(yield* Evaluation(Expression));
  // 2. Return ? GetValue(exprRef).
  return C(Q(GetValue(exprRef)));
}
