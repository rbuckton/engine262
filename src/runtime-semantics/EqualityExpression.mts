import {
  IsLooselyEqual,
  GetValue,
  IsStrictlyEqual,
} from '../abstract-ops/all.mjs';
import { C, Q } from '../completion.mjs';
import { Evaluation, type ExpressionEvaluator } from '../evaluator.mjs';
import { Value } from '../value.mjs';
import { OutOfRange } from '../helpers.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

/** https://tc39.es/ecma262/#sec-equality-operators-runtime-semantics-evaluation */
//   EqualityExpression :
//     EqualityExpression `==` RelationalExpression
//     EqualityExpression `!=` RelationalExpression
//     EqualityExpression `===` RelationalExpression
//     EqualityExpression `!==` RelationalExpression
export function* Evaluate_EqualityExpression({ EqualityExpression, operator, RelationalExpression }: ParseNode.EqualityExpression): ExpressionEvaluator {
  // 1. Let lref be ? Evaluation of EqualityExpression.
  const lref = Q(yield* Evaluation(EqualityExpression));
  // 2. Let lval be ? GetValue(lref).
  const lval = Q(GetValue(lref));
  // 3. Let rref be ? Evaluation of RelationalExpression.
  const rref = Q(yield* Evaluation(RelationalExpression));
  // 4. Let rval be ? GetValue(rref).
  const rval = Q(GetValue(rref));
  switch (operator) {
    case '==':
      // 5. Return ? IsLooselyEqual(rval, lval).
      return C(Q(IsLooselyEqual(rval, lval)));
    case '!=': {
      // 5. Let r be ? IsLooselyEqual(rval, lval).
      const r = Q(IsLooselyEqual(rval, lval));
      // 6. If r is true, return false. Otherwise, return true.
      if (r === Value.true) {
        return C(Value.false);
      } else {
        return C(Value.true);
      }
    }
    case '===':
      // 5. Return IsStrictlyEqual(rval, lval).
      return C(IsStrictlyEqual(rval, lval));
    case '!==': {
      // 5. Let r be IsStrictlyEqual(rval, lval).
      const r = IsStrictlyEqual(rval, lval);
      // 7. If r is true, return false. Otherwise, return true.
      if (r === Value.true) {
        return C(Value.false);
      } else {
        return C(Value.true);
      }
    }

    default:
      throw new OutOfRange('Evaluate_EqualityExpression', operator);
  }
}
