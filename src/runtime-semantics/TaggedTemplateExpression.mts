import { Evaluation, type ExpressionEvaluator } from '../evaluator.mjs';
import { GetValue } from '../abstract-ops/all.mjs';
import { IsInTailPosition } from '../static-semantics/all.mjs';
import { C, Q } from '../completion.mjs';
import { EvaluateCall } from './all.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

/** https://tc39.es/ecma262/#sec-tagged-templates-runtime-semantics-evaluation */
//   MemberExpression :
//     MemberExpression TemplateLiteral
export function* Evaluate_TaggedTemplateExpression(node: ParseNode.TaggedTemplateExpression): ExpressionEvaluator {
  const { MemberExpression, TemplateLiteral } = node;
  // 1. Let tagRef be ? Evaluation of MemberExpression.
  const tagRef = Q(yield* Evaluation(MemberExpression));
  // 1. Let tagFunc be ? GetValue(tagRef).
  const tagFunc = Q(GetValue(tagRef));
  // 1. Let thisCall be this MemberExpression.
  const thisCall = node;
  // 1. Let tailCall be IsInTailPosition(thisCall).
  const tailCall = IsInTailPosition(thisCall);
  // 1. Return ? EvaluateCall(tagFunc, tagRef, TemplateLiteral, tailCall).
  return C(Q(yield* EvaluateCall(tagFunc, tagRef, TemplateLiteral, tailCall)));
}
