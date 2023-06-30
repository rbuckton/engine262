import { surroundingAgent } from '../engine.mjs';
import { Value, ReferenceRecord, StringValue } from '../value.mjs';
import {
  GetValue,
  IsPropertyReference,
  PerformEval,
  SameValue,
} from '../abstract-ops/all.mjs';
import { IsInTailPosition } from '../static-semantics/all.mjs';
import { C, Q } from '../completion.mjs';
import { Evaluation, type ExpressionEvaluator } from '../evaluator.mjs';
import { EvaluateCall, ArgumentListEvaluation } from './all.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

/** https://tc39.es/ecma262/#sec-function-calls-runtime-semantics-evaluation */
// CallExpression :
//   CoverCallExpressionAndAsyncArrowHead
//   CallExpression Arguments
export function* Evaluate_CallExpression(CallExpression: ParseNode.CallExpression): ExpressionEvaluator {
  // 1. Let expr be CoveredCallExpression of CoverCallExpressionAndAsyncArrowHead.
  const expr = CallExpression;
  // 2. Let memberExpr be the MemberExpression of expr.
  const memberExpr = expr.CallExpression;
  // 3. Let arguments be the Arguments of expr.
  const args = expr.Arguments;
  // 4. Let ref be ? Evaluation of memberExpr.
  const ref = Q(yield* Evaluation(memberExpr));
  // 5. Let func be ? GetValue(ref).
  const func = Q(GetValue(ref));
  // 6. If Type(ref) is Reference, IsPropertyReference(ref) is false, and GetReferencedName(ref) is "eval", then
  if (ref instanceof ReferenceRecord
      && IsPropertyReference(ref) === Value.false
      && (ref.ReferencedName instanceof StringValue
      && ref.ReferencedName.stringValue() === 'eval')) {
    // a. If SameValue(func, %eval%) is true, then
    if (SameValue(func, surroundingAgent.intrinsic('%eval%')) === Value.true) {
      // i. Let argList be ? ArgumentListEvaluation of arguments.
      const argList = Q(yield* ArgumentListEvaluation(args));
      // ii. If argList has no elements, return undefined.
      if (argList.length === 0) {
        return C(Value.undefined);
      }
      // iii. Let evalText be the first element of argList.
      const evalText = argList[0];
      // iv. If the source code matching this CallExpression is strict mode code, let strictCaller be true. Otherwise let strictCaller be false.
      const strictCaller = CallExpression.strict;
      // v. Let evalRealm be the current Realm Record.
      const evalRealm = surroundingAgent.currentRealmRecord;
      // vi. Return ? PerformEval(evalText, evalRealm, strictCaller, true).
      return C(Q(PerformEval(evalText, evalRealm, strictCaller, true)));
    }
  }
  // 7. Let thisCall be this CallExpression.
  const thisCall = CallExpression;
  // 8. Let tailCall be IsInTailPosition(thisCall).
  const tailCall = IsInTailPosition(thisCall);
  // 9. Return ? EvaluateCall(func, ref, arguments, tailCall).
  return C(Q(yield* EvaluateCall(func, ref, args, tailCall)));
}
