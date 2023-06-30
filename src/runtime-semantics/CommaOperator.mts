import { Evaluation, type ExpressionEvaluator } from '../evaluator.mjs';
import { GetValue } from '../abstract-ops/all.mjs';
import { C, Q } from '../completion.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';
import type { Value } from '../value.mjs';

/** https://tc39.es/ecma262/#sec-comma-operator-runtime-semantics-evaluation */
//   Expression :
//     AssignmentExpression
//     Expression `,` AssignmentExpression
export function* Evaluate_CommaOperator({ ExpressionList }: ParseNode.CommaOperator): ExpressionEvaluator {
  let result: Value;
  for (const Expression of ExpressionList) {
    const lref = Q(yield* Evaluation(Expression));
    result = Q(GetValue(lref));
  }
  return C(result!); // NOTE: unsound non-null assertion
}
