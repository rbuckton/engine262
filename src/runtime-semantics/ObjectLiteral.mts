import { surroundingAgent } from '../engine.mjs';
import { Value } from '../value.mjs';
import { OrdinaryObjectCreate } from '../abstract-ops/all.mjs';
import { C, Q } from '../completion.mjs';
import {
  PropertyDefinitionEvaluation_PropertyDefinitionList,
} from './all.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';
import type { ExpressionEvaluator } from '../evaluator.mjs';

/** https://tc39.es/ecma262/#sec-object-initializer-runtime-semantics-evaluation */
//   ObjectLiteral :
//     `{` `}`
//     `{` PropertyDefinitionList `}`
//     `{` PropertyDefinitionList `,` `}`
export function* Evaluate_ObjectLiteral({ PropertyDefinitionList }: ParseNode.ObjectLiteral): ExpressionEvaluator {
  // 1. Let obj be OrdinaryObjectCreate(%Object.prototype%).
  const obj = OrdinaryObjectCreate(surroundingAgent.intrinsic('%Object.prototype%'));
  if (PropertyDefinitionList.length === 0) {
    return C(obj);
  }
  // 2. Perform ? PropertyDefinitionEvaluation of PropertyDefinitionList with arguments obj and true.
  Q(yield* PropertyDefinitionEvaluation_PropertyDefinitionList(PropertyDefinitionList, obj, Value.true));
  // 3. Return obj.
  return C(obj);
}
