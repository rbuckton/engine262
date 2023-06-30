import { surroundingAgent } from '../engine.mjs';
import {
  Assert,
  Construct,
  GetNewTarget,
  GetThisEnvironment,
  IsConstructor,
  InitializeInstanceElements,
  isECMAScriptFunctionObject,
  type ConstructorValue,
} from '../abstract-ops/all.mjs';
import { ObjectValue, Value } from '../value.mjs';
import { C, Q, X } from '../completion.mjs';
import { FunctionEnvironmentRecord } from '../environment.mjs';
import { ArgumentListEvaluation } from './all.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';
import type { ExpressionEvaluator } from '../evaluator.mjs';

/** https://tc39.es/ecma262/#sec-super-keyword-runtime-semantics-evaluation */
// SuperCall : `super` Arguments
export function* Evaluate_SuperCall({ Arguments }: ParseNode.SuperCall): ExpressionEvaluator {
  // 1. Let newTarget be GetNewTarget().
  const newTarget = GetNewTarget();
  // 2. Assert: Type(newTarget) is Object.
  Assert(newTarget instanceof ObjectValue);
  // 3. Let func be ! GetSuperConstructor().
  const func = X(GetSuperConstructor());
  // 4. Let argList be ? ArgumentListEvaluation of Arguments.
  const argList = Q(yield* ArgumentListEvaluation(Arguments));
  // 5. If IsConstructor(func) is false, throw a TypeError exception.
  if (IsConstructor(func) === Value.false) {
    return C(surroundingAgent.Throw('TypeError', 'NotAConstructor', func));
  }
  // 6. Let result be ? Construct(func, argList, newTarget).
  const result = Q(Construct(func as ConstructorValue, argList, newTarget as ConstructorValue)); // NOTE: unsound cast
  // 7. Let thisER be GetThisEnvironment().
  const thisER = GetThisEnvironment();
  // NON-SPEC: A FunctionEnvironmentRecord is the only Environment Record that provides a valid result for GetNewTarget() and GetSuperConstructor() (above)
  Assert(thisER instanceof FunctionEnvironmentRecord);
  // 8. Perform ? thisER.BindThisValue(result).
  Q(thisER.BindThisValue(result));
  // 9. Let F be thisER.[[FunctionObject]].
  const F = thisER.FunctionObject;
  // 10. Assert: F is an ECMAScript function object.
  Assert(isECMAScriptFunctionObject(F));
  // 11. Perform ? InitializeInstanceElements(result, F).
  Q(InitializeInstanceElements(result, F));
  // 12. Return result.
  return C(result);
}

/** https://tc39.es/ecma262/#sec-getsuperconstructor */
function GetSuperConstructor(): Value {
  // 1. Let envRec be GetThisEnvironment().
  const envRec = GetThisEnvironment();
  // 2. Assert: envRec is a function Environment Record.
  Assert(envRec instanceof FunctionEnvironmentRecord);
  // 3. Let activeFunction be envRec.[[FunctionObject]].
  const activeFunction = envRec.FunctionObject;
  // 4. Assert: activeFunction is an ECMAScript function object.
  Assert(isECMAScriptFunctionObject(activeFunction));
  // 5. Let superConstructor be ! activeFunction.[[GetPrototypeOf]]().
  const superConstructor = X(activeFunction.GetPrototypeOf());
  // 6. Return superConstructor.
  return superConstructor;
}
