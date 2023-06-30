import { Value } from '../value.mjs';
import { Completion, NormalCompletion } from '../completion.mjs';
import { Evaluation, type StatementEvaluator } from '../evaluator.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

/** https://tc39.es/ecma262/#sec-module-semantics-runtime-semantics-evaluation */
// Module :
//   [empty]
//   ModuleBody
export function* Evaluate_Module({ ModuleBody }: ParseNode.Module): StatementEvaluator {
  if (!ModuleBody) {
    return NormalCompletion(Value.undefined);
  }
  return Completion(yield* Evaluation(ModuleBody));
}
