import { Value } from '../value.mjs';
import { Completion, NormalCompletion } from '../completion.mjs';
import { Evaluation, type StatementEvaluator } from '../evaluator.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

/** https://tc39.es/ecma262/#sec-script-semantics-runtime-semantics-evaluation */
// Script :
//   [empty]
//   ScriptBody
export function* Evaluate_Script({ ScriptBody }: ParseNode.Script): StatementEvaluator {
  if (!ScriptBody) {
    return NormalCompletion(Value.undefined);
  }
  return Completion(yield* Evaluation(ScriptBody));
}
