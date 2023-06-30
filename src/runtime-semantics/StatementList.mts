import { Evaluation, type StatementEvaluator } from '../evaluator.mjs';
import {
  UpdateEmpty,
  C,
  Q,
  Completion,
} from '../completion.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

/** https://tc39.es/ecma262/#sec-block-runtime-semantics-evaluation */
// TODO: Should be ParseNode.StatementList
export function* Evaluate_StatementList(StatementList: ParseNode.ModuleItemList): StatementEvaluator {
  if (StatementList.length === 0) {
    return C(undefined);
  }

  // StatementList : StatementList StatementListItem
  let sl;
  sl = Q(yield* Evaluation(StatementList[0]));
  if (StatementList.length === 1) {
    return C(sl);
  }

  for (const StatementListItem of StatementList.slice(1)) {
    let s = Completion(yield* Evaluation(StatementListItem));
    sl = Q(UpdateEmpty(s, sl));
  }

  return C(sl);
}
