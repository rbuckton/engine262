import { C, Q } from '../completion.mjs';
import { Evaluation, type ExpressionReferenceEvaluator } from '../evaluator.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

/** https://tc39.es/ecma262/#sec-grouping-operator-runtime-semantics-evaluation */
export function* Evaluate_ParenthesizedExpression({ Expression }: ParseNode.ParenthesizedExpression): ExpressionReferenceEvaluator {
  // 1. Return ? Evaluation of Expression. This may be of type Reference.
  return C(Q(yield* Evaluation(Expression)));
}
