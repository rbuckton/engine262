import { ResolveThisBinding } from '../abstract-ops/all.mjs';
import { C, Q, type ValueOrThrowCompletion } from '../completion.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

/** https://tc39.es/ecma262/#sec-this-keyword-runtime-semantics-evaluation */
// PrimaryExpression : `this`
export function Evaluate_This(_PrimaryExpression: ParseNode.ThisExpression): ValueOrThrowCompletion {
  return C(Q(ResolveThisBinding()));
}
