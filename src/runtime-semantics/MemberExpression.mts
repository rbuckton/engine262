import { GetValue, MakePrivateReference, RequireObjectCoercible } from '../abstract-ops/all.mjs';
import { Evaluation, type ReferenceEvaluator } from '../evaluator.mjs';
import { C, Q, X } from '../completion.mjs';
import { OutOfRange } from '../helpers.mjs';
import { StringValue } from '../static-semantics/all.mjs';
import {
  EvaluatePropertyAccessWithExpressionKey,
  EvaluatePropertyAccessWithIdentifierKey,
} from './all.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

/** https://tc39.es/ecma262/#sec-property-accessors-runtime-semantics-evaluation */
//   MemberExpression : MemberExpression `[` Expression `]`
//   CallExpression : CallExpression `[` Expression `]`
function* Evaluate_MemberExpression_Expression({ strict, MemberExpression, Expression }: ParseNode.MemberExpression): ReferenceEvaluator {
  // 1. Let baseReference be ? Evaluation of |MemberExpression|.
  const baseReference = Q(yield* Evaluation(MemberExpression));
  // 2. Let baseValue be ? GetValue(baseReference).
  const baseValue = Q(GetValue(baseReference));
  // 3. If the code matched by this |MemberExpression| is strict mode code, let strict be true; else let strict be false.
  // 4. Return ? EvaluatePropertyAccessWithExpressionKey(baseValue, |Expression|, strict).
  return C(Q(yield* EvaluatePropertyAccessWithExpressionKey(baseValue, Expression!, strict))); // NOTE: unsound non-null assertion
}

/** https://tc39.es/ecma262/#sec-property-accessors-runtime-semantics-evaluation */
//   MemberExpression : MemberExpression `.` IdentifierName
//   CallExpression : CallExpression `.` IdentifierName
function* Evaluate_MemberExpression_IdentifierName({ strict, MemberExpression, IdentifierName }: ParseNode.MemberExpression): ReferenceEvaluator {
  // 1. Let baseReference be ? Evaluation of |MemberExpression|.
  const baseReference = Q(yield* Evaluation(MemberExpression));
  // 2. Let baseValue be ? GetValue(baseReference).
  const baseValue = Q(GetValue(baseReference));
  // 3. If the code matched by this |MemberExpression| is strict mode code, let strict be true; else let strict be false.
  // 4. Return ? EvaluatePropertyAccessWithIdentifierKey(baseValue, |IdentifierName|, strict).
  return C(Q(EvaluatePropertyAccessWithIdentifierKey(baseValue, IdentifierName!, strict))); // NOTE: unsound non-null assertion
}

/** https://tc39.es/ecma262/#sec-property-accessors-runtime-semantics-evaluation */
//   MemberExpression : MemberExpression `.` PrivateIdentifier
//   CallExpression : CallExpression `.` PrivateIdentifier
function* Evaluate_MemberExpression_PrivateIdentifier({ MemberExpression, PrivateIdentifier }: ParseNode.MemberExpression): ReferenceEvaluator {
  // 1. Let baseReference be ? Evaluation of MemberExpression.
  const baseReference = Q(yield* Evaluation(MemberExpression));
  // 2. Let baseValue be ? GetValue(baseReference).
  const baseValue = Q(GetValue(baseReference));
  // 3. Let bv be ? RequireObjectCoercible(baseValue).
  const bv = Q(RequireObjectCoercible(baseValue));
  // 4. Let fieldNameString be the StringValue of PrivateIdentifier.
  const fieldNameString = StringValue(PrivateIdentifier!); // NOTE: unsound non-null assertion
  // 5. Return ! MakePrivateReference(bv, fieldNameString).
  return C(X(MakePrivateReference(bv, fieldNameString)));
}

/** https://tc39.es/ecma262/#sec-property-accessors-runtime-semantics-evaluation */
//   MemberExpression :
//     MemberExpression `[` Expression `]`
//     MemberExpression `.` IdentifierName
//   CallExpression :
//     CallExpression `[` Expression `]`
//     CallExpression `.` IdentifierName
export function Evaluate_MemberExpression(MemberExpression: ParseNode.MemberExpression): ReferenceEvaluator {
  switch (true) {
    case !!MemberExpression.Expression:
      return Evaluate_MemberExpression_Expression(MemberExpression);
    case !!MemberExpression.IdentifierName:
      return Evaluate_MemberExpression_IdentifierName(MemberExpression);
    case !!MemberExpression.PrivateIdentifier:
      return Evaluate_MemberExpression_PrivateIdentifier(MemberExpression);
    default:
      throw new OutOfRange('Evaluate_MemberExpression', MemberExpression);
  }
}
