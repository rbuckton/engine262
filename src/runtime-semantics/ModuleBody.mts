import type { StatementEvaluator } from '../evaluator.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';
import { Evaluate_StatementList } from './all.mjs';

/** https://tc39.es/ecma262/#sec-module-semantics-runtime-semantics-evaluation */
// ModuleBody : ModuleItemList
export function Evaluate_ModuleBody({ ModuleItemList }: ParseNode.ModuleBody): StatementEvaluator {
  return Evaluate_StatementList(ModuleItemList!);
}
