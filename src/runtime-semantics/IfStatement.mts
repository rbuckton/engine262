import { Evaluation, type StatementEvaluator } from '../evaluator.mjs';
import {
  GetValue,
  ToBoolean,
} from '../abstract-ops/all.mjs';
import {
  C,
  Completion,
  Q,
  UpdateEmpty,
} from '../completion.mjs';
import { Value } from '../value.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

/** https://tc39.es/ecma262/#sec-if-statement-runtime-semantics-evaluation */
// IfStatement :
//   `if` `(` Expression `)` Statement `else` Statement
//   `if` `(` Expression `)` Statement
export function* Evaluate_IfStatement({ Expression, Statement_a, Statement_b }: ParseNode.IfStatement): StatementEvaluator {
  // 1. Let exprRef be ? Evaluation of Expression.
  const exprRef = Q(yield* Evaluation(Expression));
  // 2. Let exprValue be ToBoolean(? GetValue(exprRef)).
  const exprValue = ToBoolean(Q(GetValue(exprRef)));
  if (Statement_b) {
    let stmtCompletion;
    // 3. If exprValue is true, then
    if (exprValue === Value.true) {
      // a. Let stmtCompletion be Completion(Evaluating of the first Statement).
      stmtCompletion = Completion(yield* Evaluation(Statement_a));
    } else { // 4. Else,
      // a. Let stmtCompletion be Completion(Evaluating of the second Statement).
      stmtCompletion = Completion(yield* Evaluation(Statement_b));
    }
    // 5. Return ? UpdateEmpty(stmtCompletion, undefined).
    return C(Q(UpdateEmpty(stmtCompletion, Value.undefined)));
  } else {
    // 3. If exprValue is false, then
    if (exprValue === Value.false) {
      // a. Return undefined.
      return C(Value.undefined);
    } else { // 4. Else,
      // a. Let stmtCompletion be Completion(Evaluating of Statement).
      const stmtCompletion = Completion(yield* Evaluation(Statement_a));
      // b. Return ? UpdateEmpty(stmtCompletion, undefined).
      return C(Q(UpdateEmpty(stmtCompletion, Value.undefined)));
    }
  }
}
