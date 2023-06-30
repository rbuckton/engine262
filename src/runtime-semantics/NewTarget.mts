import { GetNewTarget } from '../abstract-ops/all.mjs';
import { C, NormalCompletion } from '../completion.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';
import type { Value } from '../value.mjs';

/** https://tc39.es/ecma262/#sec-meta-properties-runtime-semantics-evaluation */
// NewTarget : `new` `.` `target`
export function Evaluate_NewTarget(_NewTarget: ParseNode.NewTarget): NormalCompletion<Value> {
  // 1. Return GetNewTarget().
  return C(GetNewTarget());
}
