import { Evaluation, type StatementEvaluator } from '../evaluator.mjs';
import {
  NormalCompletion,
  ReturnIfAbrupt,
  Q, X, EnsureCompletion, C,
} from '../completion.mjs';
import { Value } from '../value.mjs';
import { surroundingAgent } from '../engine.mjs';
import {
  GetValue,
  InitializeReferencedBinding,
  ResolveBinding,
} from '../abstract-ops/all.mjs';
import { IsAnonymousFunctionDefinition, StringValue } from '../static-semantics/all.mjs';
import { OutOfRange } from '../helpers.mjs';
import { NamedEvaluation, BindingInitialization } from './all.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

/** https://tc39.es/ecma262/#sec-let-and-const-declarations-runtime-semantics-evaluation */
//   LexicalBinding :
//     BindingIdentifier
//     BindingIdentifier Initializer
function* Evaluate_LexicalBinding_BindingIdentifier({ BindingIdentifier, Initializer, strict }: ParseNode.LexicalBinding): StatementEvaluator {
  if (Initializer) {
    // 1. Let bindingId be StringValue of BindingIdentifier.
    const bindingId = StringValue(BindingIdentifier!); // NOTE: unsound non-null assertion
    // 2. Let lhs be ResolveBinding(bindingId).
    const lhs = X(ResolveBinding(bindingId, undefined, strict));
    let value;
    // 3. If IsAnonymousFunctionDefinition(Initializer) is true, then
    if (IsAnonymousFunctionDefinition(Initializer)) {
      // a. Let value be ? NamedEvaluation of Initializer with argument bindingId.
      value = Q(yield* NamedEvaluation(Initializer, bindingId));
    } else { // 4. Else,
      // a. Let rhs be ? Evaluation of Initializer.
      const rhs = Q(yield* Evaluation(Initializer));
      // b. Let value be ? GetValue(rhs).
      value = Q(GetValue(rhs));
    }
    // 5. Perform ! InitializeReferencedBinding(lhs, value).
    X(InitializeReferencedBinding(lhs, value));
    return C(undefined);
  } else {
    // 1. Let lhs be ResolveBinding(StringValue of BindingIdentifier).
    const lhs = ResolveBinding(StringValue(BindingIdentifier!), undefined, strict); // NOTE: unsound non-null assertion
    // 2. Perform ! InitializeReferencedBinding(lhs, undefined).
    X(InitializeReferencedBinding(lhs, Value.undefined));
    return C(undefined);
  }
}

/** https://tc39.es/ecma262/#sec-let-and-const-declarations-runtime-semantics-evaluation */
//   LexicalBinding : BindingPattern Initializer
function* Evaluate_LexicalBinding_BindingPattern(LexicalBinding: ParseNode.LexicalBinding): StatementEvaluator {
  const { BindingPattern, Initializer } = LexicalBinding;
  const rhs = Q(yield* Evaluation(Initializer!)); // NOTE: unsound non-null assertion
  const value = Q(GetValue(rhs));
  const env = surroundingAgent.runningExecutionContext.LexicalEnvironment;
  return C(Q(yield* BindingInitialization(BindingPattern, value, env)));
}

export function* Evaluate_LexicalBinding(LexicalBinding: ParseNode.LexicalBinding): StatementEvaluator {
  switch (true) {
    case !!LexicalBinding.BindingIdentifier:
      return yield* Evaluate_LexicalBinding_BindingIdentifier(LexicalBinding);
    case !!LexicalBinding.BindingPattern:
      return yield* Evaluate_LexicalBinding_BindingPattern(LexicalBinding);
    default:
      throw new OutOfRange('Evaluate_LexicalBinding', LexicalBinding);
  }
}

/** https://tc39.es/ecma262/#sec-let-and-const-declarations-runtime-semantics-evaluation */
//   BindingList : BindingList `,` LexicalBinding
//
// (implicit)
//   BindingList : LexicalBinding
export function* Evaluate_BindingList(BindingList: ParseNode.BindingList): StatementEvaluator {
  // 1. Let next be the result of evaluating BindingList.
  // 2. ReturnIfAbrupt(next).
  // 3. Return the result of evaluating LexicalBinding.
  let next;
  for (const LexicalBinding of BindingList) {
    next = yield* Evaluate_LexicalBinding(LexicalBinding);
    ReturnIfAbrupt(next);
  }
  return EnsureCompletion(next);
}

/** https://tc39.es/ecma262/#sec-let-and-const-declarations-runtime-semantics-evaluation */
//   LexicalDeclaration : LetOrConst BindingList `;`
export function* Evaluate_LexicalDeclaration({ BindingList }: ParseNode.LexicalDeclaration): StatementEvaluator {
  // 1. Let next be the result of evaluating BindingList.
  const next = yield* Evaluate_BindingList(BindingList);
  // 2. ReturnIfAbrupt(next).
  ReturnIfAbrupt(next);
  // 3. Return NormalCompletion(empty).
  return NormalCompletion(undefined);
}
