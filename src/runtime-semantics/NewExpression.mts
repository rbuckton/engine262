import { surroundingAgent } from '../engine.mjs';
import {
  Assert,
  Construct,
  GetValue,
  IsConstructor,
  type ConstructorValue,
} from '../abstract-ops/all.mjs';
import { Value } from '../value.mjs';
import { Evaluation, type ExpressionEvaluator } from '../evaluator.mjs';
import { C, Q } from '../completion.mjs';
import { ArgumentListEvaluation } from './all.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

/** https://tc39.es/ecma262/#sec-evaluatenew */
function* EvaluateNew(constructExpr: ParseNode.LeftHandSideExpression, args: ParseNode.Arguments | undefined): ExpressionEvaluator {
  // 1. Assert: constructExpr is either a NewExpression or a MemberExpression.
  // 2. Assert: arguments is either empty or an Arguments.
  Assert(args === undefined || Array.isArray(args));
  // 3. Let ref be ? Evaluation of constructExpr.
  const ref = Q(yield* Evaluation(constructExpr));
  // 4. Let constructor be ? GetValue(ref).
  const constructor = Q(GetValue(ref));
  let argList: readonly Value[];
  // 5. If arguments is empty, let argList be a new empty List.
  if (args === undefined) {
    argList = [];
  } else { // 6. Else,
    // a. Let argList be ? ArgumentListEvaluation of arguments.
    argList = Q(yield* ArgumentListEvaluation(args));
  }
  // 7. If IsConstructor(constructor) is false, throw a TypeError exception.
  if (IsConstructor(constructor) === Value.false) {
    return C(surroundingAgent.Throw('TypeError', 'NotAConstructor', constructor));
  }
  // 8. Return ? Construct(constructor, argList).
  return C(Q(Construct(constructor as ConstructorValue, argList))); // NOTE: unsound cast
}

/** https://tc39.es/ecma262/#sec-new-operator-runtime-semantics-evaluation */
//   NewExpression :
//     `new` NewExpression
//     `new` MemberExpression Arguments
export function* Evaluate_NewExpression({ MemberExpression, Arguments }: ParseNode.NewExpression): ExpressionEvaluator {
  if (!Arguments) {
    // 1. Return ? EvaluateNew(NewExpression, empty).
    return C(Q(yield* EvaluateNew(MemberExpression, undefined)));
  } else {
    // 1. Return ? EvaluateNew(MemberExpression, Arguments).
    return C(Q(yield* EvaluateNew(MemberExpression, Arguments)));
  }
}
