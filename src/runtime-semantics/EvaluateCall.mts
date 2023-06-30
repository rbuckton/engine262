import { surroundingAgent } from '../engine.mjs';
import {
  ObjectValue, Value, ReferenceRecord,
} from '../value.mjs';
import {
  Assert,
  IsPropertyReference,
  IsCallable,
  GetThisValue,
  PrepareForTailCall,
  Call,
} from '../abstract-ops/all.mjs';
import { Q, C } from '../completion.mjs';
import { EnvironmentRecord } from '../environment.mjs';
import { ArgumentListEvaluation } from './all.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';
import type { ExpressionEvaluator } from '../evaluator.mjs';

/** https://tc39.es/ecma262/#sec-evaluatecall */
export function* EvaluateCall(func: Value, ref: Value | ReferenceRecord, args: ParseNode.Arguments | ParseNode.TemplateLiteral, tailPosition: boolean): ExpressionEvaluator {
  // 1. If ref is a Reference Record, then
  let thisValue: Value;
  if (ref instanceof ReferenceRecord) {
    // a. If IsPropertyReference(ref) is true, then
    if (IsPropertyReference(ref) === Value.true) {
      // i. Let thisValue be GetThisValue(ref).
      thisValue = GetThisValue(ref);
    } else {
      // i. Let refEnv be ref.[[Base]].
      const refEnv = ref.Base;
      // ii. Assert: refEnv is an Environment Record.
      Assert(refEnv instanceof EnvironmentRecord);
      // iii. Let thisValue be refEnv.WithBaseObject().
      thisValue = refEnv.WithBaseObject();
    }
  } else {
    // a. Let thisValue be undefined.
    thisValue = Value.undefined;
  }
  // 3. Let argList be ? ArgumentListEvaluation of arguments.
  const argList = Q(yield* ArgumentListEvaluation(args));
  // 4. If Type(func) is not Object, throw a TypeError exception.
  if (!(func instanceof ObjectValue)) {
    return C(surroundingAgent.Throw('TypeError', 'NotAFunction', func));
  }
  // 5. If IsCallable(func) is false, throw a TypeError exception.
  if (IsCallable(func) === Value.false) {
    return C(surroundingAgent.Throw('TypeError', 'NotAFunction', func));
  }
  // 6. If tailPosition is true, perform PrepareForTailCall().
  if (tailPosition) {
    PrepareForTailCall();
  }
  // 7. Return ? Call(func, thisValue, argList).
  return C(Q(Call(func, thisValue, argList)));
}
