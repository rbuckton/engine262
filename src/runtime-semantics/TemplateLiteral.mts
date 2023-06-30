import { Value } from '../value.mjs';
import { C, Q } from '../completion.mjs';
import { GetValue, ToString } from '../abstract-ops/all.mjs';
import { Evaluation, type ExpressionEvaluator } from '../evaluator.mjs';
import { TV } from '../static-semantics/all.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

/** https://tc39.es/ecma262/#sec-template-literals-runtime-semantics-evaluation */
//   TemplateLiteral : NoSubstitutionTemplate
//   SubstitutionTemplate : TemplateHead Expression TemplateSpans
//   TemplateSpans : TemplateTail
//   TemplateSpans : TemplateMiddleList TemplateTail
//   TemplateMiddleList : TemplateMiddle Expression
//   TemplateMiddleList : TemplateMiddleList TemplateMiddle Expression
//
// (implicit)
//   TemplateLiteral : SubstitutionTemplate
export function* Evaluate_TemplateLiteral({ TemplateSpanList, ExpressionList }: ParseNode.TemplateLiteral): ExpressionEvaluator {
  let str = '';
  for (let i = 0; i < TemplateSpanList.length - 1; i += 1) {
    const Expression = ExpressionList[i];
    const head = TV(TemplateSpanList[i]);
    // 2. Let subRef be ? Evaluation of Expression.
    const subRef = Q(yield* Evaluation(Expression));
    // 3. Let sub be ? GetValue(subRef).
    const sub = Q(GetValue(subRef));
    // 4. Let middle be ? ToString(sub).
    const middle = Q(ToString(sub));
    str += head;
    str += middle.stringValue();
  }
  const tail = TV(TemplateSpanList[TemplateSpanList.length - 1]);
  return C(Value(str + tail));
}
