import { surroundingAgent, HostLoadImportedModule } from '../engine.mjs';
import { Evaluation, type ExpressionEvaluator } from '../evaluator.mjs';
import {
  GetValue,
  ToString,
  NewPromiseCapability,
  GetActiveScriptOrModule,
  Realm,
} from '../abstract-ops/all.mjs';
import {
  Q, X, IfAbruptRejectPromise, Completion, NormalCompletion, ThrowCompletion, C,
} from '../completion.mjs';
import { NullValue, type ScriptRecord, CyclicModuleRecord, type StringValue } from '../api.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

/** https://tc39.es/ecma262/#sec-import-calls */
// ImportCall : `import` `(` AssignmentExpression `)`
export function* Evaluate_ImportCall({ AssignmentExpression }: ParseNode.ImportCall): ExpressionEvaluator {
  // 1. Let referrer be ! GetActiveScriptOrModule().
  let referrer: ScriptRecord | CyclicModuleRecord | NullValue | Realm = X(GetActiveScriptOrModule());
  // 2. If referrer is null, set referrer to the current Realm Record.
  if (referrer instanceof NullValue) {
    referrer = surroundingAgent.currentRealmRecord;
  }
  // 3. Let argRef be ? Evaluation of AssignmentExpression.
  const argRef = Q(yield* Evaluation(AssignmentExpression));
  // 4. Let specifier be ? GetValue(argRef).
  const specifier = Q(GetValue(argRef));
  // 5. Let promiseCapability be ! NewPromiseCapability(%Promise%).
  const promiseCapability = X(NewPromiseCapability(surroundingAgent.intrinsic('%Promise%')));
  // 6. Let specifierString be Completion(ToString(specifier)).
  let specifierString: NormalCompletion<StringValue> | ThrowCompletion | StringValue = Completion(ToString(specifier));
  // 7. IfAbruptRejectPromise(specifierString, promiseCapability).
  IfAbruptRejectPromise(specifierString, promiseCapability);
  specifierString = X(specifierString); // NOTE: necessary for TypeScript to observe the affects of IfAbruptRejectPromise.
  // 8. Perform HostLoadImportedModule(referrer, specifierString, ~empty~, promiseCapability).
  HostLoadImportedModule(referrer, specifierString, undefined, promiseCapability);
  // 9. Return promiseCapability.[[Promise]].
  return C(promiseCapability.Promise);
}
