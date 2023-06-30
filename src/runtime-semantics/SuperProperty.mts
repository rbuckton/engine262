import { Evaluation, type ReferenceEvaluator } from '../evaluator.mjs';
import { ReferenceRecord, Value, type PropertyKeyValue } from '../value.mjs';
import {
  Assert,
  GetThisEnvironment,
  GetValue,
  ToPropertyKey,
} from '../abstract-ops/all.mjs';
import { StringValue } from '../static-semantics/all.mjs';
import { C, Q, type ReferenceOrThrowCompletion } from '../completion.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';
import { FunctionEnvironmentRecord } from '../environment.mjs';

/** https://tc39.es/ecma262/#sec-makesuperpropertyreference */
function MakeSuperPropertyReference(actualThis: Value, propertyKey: PropertyKeyValue, strict: boolean): ReferenceOrThrowCompletion {
  // 1. Let env be GetThisEnvironment().
  const env = GetThisEnvironment();
  // 2. Assert: env.HasSuperBinding() is true.
  Assert(env.HasSuperBinding() === Value.true);
  // NON-SPEC: FunctionEnvironmentRecord is the only Environment Record that has a super binding
  Assert(env instanceof FunctionEnvironmentRecord);
  // 3. Let baseValue be ? env.GetSuperBase().
  const baseValue = Q(env.GetSuperBase());
  // 4. Return the Reference Record { [[Base]]: baseValue, [[ReferencedName]]: propertyKey, [[Strict]]: strict, [[ThisValue]]: actualThis }.
  return C(new ReferenceRecord({
    Base: baseValue,
    ReferencedName: propertyKey,
    Strict: strict ? Value.true : Value.false,
    ThisValue: actualThis,
  }));
}

/** https://tc39.es/ecma262/#sec-super-keyword-runtime-semantics-evaluation */
//  SuperProperty :
//    `super` `[` Expression `]`
//    `super` `.` IdentifierName
export function* Evaluate_SuperProperty({ Expression, IdentifierName, strict }: ParseNode.SuperProperty): ReferenceEvaluator {
  // 1. Let env be GetThisEnvironment().
  const env = GetThisEnvironment();
  // 2. Let actualThis be ? env.GetThisBinding().
  const actualThis = Q(env.GetThisBinding());
  if (Expression) {
    // 3. Let propertyNameReference be ? Evaluation of Expression.
    const propertyNameReference = Q(yield* Evaluation(Expression));
    // 4. Let propertyNameReference be the result of evaluating Expression.
    const propertyNameValue = Q(GetValue(propertyNameReference));
    // 5. Let propertyNameValue be ? GetValue(propertyNameReference).
    const propertyKey = Q(ToPropertyKey(propertyNameValue));
    // 6. If the code matched by this SuperProperty is strict mode code, let strict be true; else let strict be false.
    // 7. Return ? MakeSuperPropertyReference(actualThis, propertyKey, strict).
    return C(Q(MakeSuperPropertyReference(actualThis, propertyKey, strict)));
  } else {
    // 3. Let propertyKey be StringValue of IdentifierName.
    const propertyKey = StringValue(IdentifierName!); // NOTE: unsound non-null assertion
    // 4. const strict = SuperProperty.strict;
    // 5. Return ? MakeSuperPropertyReference(actualThis, propertyKey, strict).
    return C(Q(MakeSuperPropertyReference(actualThis, propertyKey, strict)));
  }
}
