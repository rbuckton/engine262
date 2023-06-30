import { C, Q } from '../completion.mjs';
import type { StatementEvaluator } from '../evaluator.mjs';
import { ValueSet } from '../helpers.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';
import type { StringValue } from '../value.mjs';
import { LabelledEvaluation } from './all.mjs';

/** https://tc39.es/ecma262/#sec-statement-semantics-runtime-semantics-evaluation */
//   BreakableStatement :
//     IterationStatement
//     SwitchStatement
//
//   IterationStatement :
//     (DoStatement)
//     (WhileStatement)
export function* Evaluate_BreakableStatement(BreakableStatement: ParseNode.BreakableStatement): StatementEvaluator {
  // 1. Let newLabelSet be a new empty List.
  const newLabelSet = new ValueSet<StringValue>();
  // 2. Return ? LabelledEvaluation of this BreakableStatement with argument newLabelSet.
  return C(Q(yield * LabelledEvaluation(BreakableStatement, newLabelSet)));
}
