import { Evaluation, type ExpressionEvaluator } from '../evaluator.mjs';
import { GetValue } from '../abstract-ops/all.mjs';
import { C, Q } from '../completion.mjs';
import { ApplyStringOrNumericBinaryOperator, type StringOrNumericBinaryOperator } from './all.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

/** https://tc39.es/ecma262/#sec-evaluatestringornumericbinaryexpression */
export function* EvaluateStringOrNumericBinaryExpression(leftOperand: ParseNode.AssignmentExpressionOrHigher, opText: StringOrNumericBinaryOperator, rightOperand: ParseNode.AssignmentExpressionOrHigher): ExpressionEvaluator {
  // 1. Let lref be ? Evaluation of leftOperand.
  const lref = Q(yield* Evaluation(leftOperand));
  // 2. Let lval be ? GetValue(lref).
  const lval = Q(GetValue(lref));
  // 3. Let rref be ? Evaluation of rightOperand.
  const rref = Q(yield* Evaluation(rightOperand));
  // 4. Let rval be ? GetValue(rref).
  const rval = Q(GetValue(rref));
  // 5. Return ? ApplyStringOrNumericBinaryOperator(lval, opText, rval).
  return C(Q(ApplyStringOrNumericBinaryOperator(lval, opText, rval)));
}
