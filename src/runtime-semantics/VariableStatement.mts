import {
  GetValue,
  PutValue,
  ResolveBinding,
} from '../abstract-ops/all.mjs';
import { C, Q, ReturnIfAbrupt } from '../completion.mjs';
import { Evaluation, type StatementEvaluator } from '../evaluator.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';
import { StringValue, IsAnonymousFunctionDefinition } from '../static-semantics/all.mjs';
import { Value } from '../value.mjs';
import { NamedEvaluation, BindingInitialization } from './all.mjs';

/** https://tc39.es/ecma262/#sec-variable-statement-runtime-semantics-evaluation */
//   VariableDeclaration :
//     BindingIdentifier
//     BindingIdentifier Initializer
//     BindingPattern Initializer
function* Evaluate_VariableDeclaration({ BindingIdentifier, Initializer, BindingPattern }: ParseNode.VariableDeclaration): StatementEvaluator {
  if (BindingIdentifier) {
    if (!Initializer) {
      // 1. Return empty.
      return C(undefined);
    }
    // 1. Let bindingId be StringValue of BindingIdentifier.
    const bindingId = StringValue(BindingIdentifier);
    // 2. Let lhs be ? ResolveBinding(bindingId).
    const lhs = Q(ResolveBinding(bindingId, undefined, BindingIdentifier.strict));
    // 3. If IsAnonymousFunctionDefinition(Initializer) is true, then
    let value;
    if (IsAnonymousFunctionDefinition(Initializer)) {
      // a. Let value be ? NamedEvaluation of Initializer with argument bindingId.
      value = Q(yield* NamedEvaluation(Initializer, bindingId));
    } else { // 4. Else,
      // a. Let rhs be ? Evaluation of Initializer.
      const rhs = Q(yield* Evaluation(Initializer));
      // b. Let value be ? GetValue(rhs).
      value = Q(GetValue(rhs));
    }
    // 5. Perform ? PutValue(lhs, value).
    Q(PutValue(lhs, value));
    return C(undefined);
  }
  // 1. Let rhs be ? Evaluation of Initializer.
  const rhs = Q(yield* Evaluation(Initializer!)); // NOTE: unsound non-null assertion
  // 2. Let rval be ? GetValue(rhs).
  const rval = Q(GetValue(rhs));
  // 3. Return ? BindingInitialization of BindingPattern with arguments rval and undefined.
  // SPEC-BUG: BindingInitialization returns unused, but evaluation normally doesn't deal with unused and uses empty instead.
  Q(yield* BindingInitialization(BindingPattern, rval, Value.undefined));
  // NON-SPEC: Return empty.
  return C(undefined);
}

/** https://tc39.es/ecma262/#sec-variable-statement-runtime-semantics-evaluation */
//   VariableDeclarationList : VariableDeclarationList `,` VariableDeclaration
//
// (implicit)
//   VariableDeclarationList : VariableDeclaration
export function* Evaluate_VariableDeclarationList(VariableDeclarationList: ParseNode.VariableDeclarationList): StatementEvaluator {
  let next: Value | undefined; // NOTE: unsound definite assignment assertion (`!`)
  for (const VariableDeclaration of VariableDeclarationList) {
    next = Q(yield* Evaluate_VariableDeclaration(VariableDeclaration));
  }
  return C(next);
}

/** https://tc39.es/ecma262/#sec-variable-statement-runtime-semantics-evaluation */
//   VariableStatement : `var` VariableDeclarationList `;`
export function* Evaluate_VariableStatement({ VariableDeclarationList }: ParseNode.VariableStatement): StatementEvaluator {
  const next = yield* Evaluate_VariableDeclarationList(VariableDeclarationList);
  ReturnIfAbrupt(next);
  return C(undefined);
}
