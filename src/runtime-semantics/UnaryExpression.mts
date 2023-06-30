import { surroundingAgent } from '../engine.mjs';
import {
  Assert,
  GetValue,
  IsCallable,
  IsPropertyReference,
  IsSuperReference,
  IsUnresolvableReference,
  ToBoolean,
  ToNumber,
  ToObject,
  ToNumeric,
} from '../abstract-ops/all.mjs';
import { Evaluation, type ExpressionEvaluator } from '../evaluator.mjs';
import { C, Q, X } from '../completion.mjs';
import {
  TypeForMethod, Value, ReferenceRecord, UndefinedValue, BigIntValue, BooleanValue, StringValue, NullValue, NumberValue, ObjectValue, SymbolValue,
} from '../value.mjs';
import { EnvironmentRecord } from '../environment.mjs';
import { OutOfRange } from '../helpers.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

/** https://tc39.es/ecma262/#sec-delete-operator-runtime-semantics-evaluation */
//   UnaryExpression : `delete` UnaryExpression
function* Evaluate_UnaryExpression_Delete({ UnaryExpression }: ParseNode.UnaryExpression): ExpressionEvaluator {
  // 1. Let ref be ? Evaluation of UnaryExpression.
  const ref = Q(yield* Evaluation(UnaryExpression));
  // 2. If ref is not a Reference Record, return true.
  if (!(ref instanceof ReferenceRecord)) {
    return C(Value.true);
  }
  // 3. If IsUnresolvableReference(ref) is true, then
  if (IsUnresolvableReference(ref) === Value.true) {
    // a. Assert: ref.[[Strict]] is false.
    Assert(ref.Strict === Value.false);
    // b. Return true.
    return C(Value.true);
  }
  // 4. If IsPropertyReference(ref) is true, then
  if (IsPropertyReference(ref) === Value.true) {
    // a. If IsSuperReference(ref) is true, throw a ReferenceError exception.
    if (IsSuperReference(ref) === Value.true) {
      return C(surroundingAgent.Throw('ReferenceError', 'CannotDeleteSuper'));
    }
    // b. Let baseObj be ? ToObject(ref.[[Base]]).
    const baseObj = Q(ToObject(ref.Base));
    // c. Let deleteStatus be ? baseObj.[[Delete]](ref.[[ReferencedName]]).
    const deleteStatus = Q(baseObj.Delete(ref.ReferencedName));
    // d. If deleteStatus is false and ref.[[Strict]] is true, throw a TypeError exception.
    if (deleteStatus === Value.false && ref.Strict === Value.true) {
      return C(surroundingAgent.Throw('TypeError', 'StrictModeDelete', ref.ReferencedName));
    }
    // e. Return deleteStatus.
    return C(deleteStatus);
  } else { // 6. Else,
    Assert(ref.ReferencedName instanceof StringValue); // NOTE: A non-property reference should only have a StringValue referenced name.
    // a. Let base be ref.[[Base]].
    const base = ref.Base;
    // b. Assert: base is an Environment Record.
    Assert(base instanceof EnvironmentRecord);
    // c. Return ? bindings.DeleteBinding(GetReferencedName(ref)).
    return C(Q(base.DeleteBinding(ref.ReferencedName)));
  }
}

/** https://tc39.es/ecma262/#sec-void-operator-runtime-semantics-evaluation */
//   UnaryExpression : `void` UnaryExpression
function* Evaluate_UnaryExpression_Void({ UnaryExpression }: ParseNode.UnaryExpression): ExpressionEvaluator {
  // 1. Let expr be ? Evaluation of UnaryExpression.
  const expr = Q(yield* Evaluation(UnaryExpression));
  // 2. Perform ? GetValue(expr).
  Q(GetValue(expr));
  // 3. Return undefined.
  return C(Value.undefined);
}

/** https://tc39.es/ecma262/#sec-typeof-operator-runtime-semantics-evaluation */
// UnaryExpression : `typeof` UnaryExpression
function* Evaluate_UnaryExpression_Typeof({ UnaryExpression }: ParseNode.UnaryExpression): ExpressionEvaluator {
  // 1. Let val be ? Evaluation of UnaryExpression.
  let val = Q(yield* Evaluation(UnaryExpression));
  // 2. If val is a Reference Record, then
  if (val instanceof ReferenceRecord) {
    // a. If IsUnresolvableReference(val) is true, return "undefined".
    if (IsUnresolvableReference(val) === Value.true) {
      return C(Value('undefined'));
    }
  }
  // 3. Set val to ? GetValue(val).
  val = Q(GetValue(val));
  // 4. Return a String according to Table 37.
  if (val instanceof UndefinedValue) {
    return C(Value('undefined'));
  } else if (val instanceof NullValue) {
    return C(Value('object'));
  } else if (val instanceof BooleanValue) {
    return C(Value('boolean'));
  } else if (val instanceof NumberValue) {
    return C(Value('number'));
  } else if (val instanceof StringValue) {
    return C(Value('string'));
  } else if (val instanceof BigIntValue) {
    return C(Value('bigint'));
  } else if (val instanceof SymbolValue) {
    return C(Value('symbol'));
  } else if (val instanceof ObjectValue) {
    if (IsCallable(val) === Value.true) {
      return C(Value('function'));
    }
    return C(Value('object'));
  }
  throw new OutOfRange('Evaluate_UnaryExpression_Typeof', val);
}

/** https://tc39.es/ecma262/#sec-unary-plus-operator-runtime-semantics-evaluation */
//   UnaryExpression : `+` UnaryExpression
function* Evaluate_UnaryExpression_Plus({ UnaryExpression }: ParseNode.UnaryExpression): ExpressionEvaluator {
  // 1. Let expr be ? Evaluation of UnaryExpression.
  const expr = Q(yield* Evaluation(UnaryExpression));
  // 2. Return ? ToNumber(? GetValue(expr)).
  return C(Q(ToNumber(Q(GetValue(expr)))));
}

/** https://tc39.es/ecma262/#sec-unary-minus-operator-runtime-semantics-evaluation */
//   UnaryExpression : `-` UnaryExpression
function* Evaluate_UnaryExpression_Minus({ UnaryExpression }: ParseNode.UnaryExpression): ExpressionEvaluator {
  // 1. Let expr be ? Evaluation of UnaryExpression.
  const expr = Q(yield* Evaluation(UnaryExpression));
  // 2. Let oldValue be ? ToNumeric(? GetValue(expr)).
  const oldValue = Q(ToNumeric(Q(GetValue(expr))));
  // 3. Let T be Type(oldValue).
  const T = TypeForMethod(oldValue);
  // 4. Return ! T::unaryMinus(oldValue).
  return C(X(T.unaryMinus(oldValue as NumberValue & BigIntValue))); // NOTE: unsound cast
}

/** https://tc39.es/ecma262/#sec-bitwise-not-operator-runtime-semantics-evaluation */
//   UnaryExpression : `~` UnaryExpression
function* Evaluate_UnaryExpression_Tilde({ UnaryExpression }: ParseNode.UnaryExpression): ExpressionEvaluator {
  // 1. Let expr be ? Evaluation of UnaryExpression.
  const expr = Q(yield* Evaluation(UnaryExpression));
  // 2. Let oldValue be ? ToNumeric(? GetValue(expr)).
  const oldValue = Q(ToNumeric(Q(GetValue(expr))));
  // 3. Let T be Type(oldValue).
  const T = TypeForMethod(oldValue);
  // 4. Return ! T::bitwiseNOT(oldValue).
  return C(X(T.bitwiseNOT(oldValue as NumberValue & BigIntValue))); // NOTE: unsound cast
}

/** https://tc39.es/ecma262/#sec-logical-not-operator-runtime-semantics-evaluation */
//   UnaryExpression : `!` UnaryExpression
function* Evaluate_UnaryExpression_Bang({ UnaryExpression }: ParseNode.UnaryExpression): ExpressionEvaluator {
  // 1. Let expr be ? Evaluation of UnaryExpression.
  const expr = Q(yield* Evaluation(UnaryExpression));
  // 2. Let oldValue be ! ToBoolean(? GetValue(expr)).
  const oldValue = ToBoolean(Q(GetValue(expr)));
  // 3. If oldValue is true, return false.
  if (oldValue === Value.true) {
    return C(Value.false);
  }
  // 4. Return true.
  return C(Value.true);
}

// UnaryExpression :
//  `delete` UnaryExpression
//  `void` UnaryExpression
//  `typeof` UnaryExpression
//  `+` UnaryExpression
//  `-` UnaryExpression
//  `~` UnaryExpression
//  `!` UnaryExpression
export function* Evaluate_UnaryExpression(UnaryExpression: ParseNode.UnaryExpression): ExpressionEvaluator {
  switch (UnaryExpression.operator) {
    case 'delete':
      return yield* Evaluate_UnaryExpression_Delete(UnaryExpression);
    case 'void':
      return yield* Evaluate_UnaryExpression_Void(UnaryExpression);
    case 'typeof':
      return yield* Evaluate_UnaryExpression_Typeof(UnaryExpression);
    case '+':
      return yield* Evaluate_UnaryExpression_Plus(UnaryExpression);
    case '-':
      return yield* Evaluate_UnaryExpression_Minus(UnaryExpression);
    case '~':
      return yield* Evaluate_UnaryExpression_Tilde(UnaryExpression);
    case '!':
      return yield* Evaluate_UnaryExpression_Bang(UnaryExpression);

    default:
      throw new OutOfRange('Evaluate_UnaryExpression', UnaryExpression);
  }
}
