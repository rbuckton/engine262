import { surroundingAgent } from '../engine.mjs';
import { Value } from '../value.mjs';
import { Evaluation, type StatementEvaluator } from '../evaluator.mjs';
import { GetValue } from '../abstract-ops/all.mjs';
import { BoundNames, IsAnonymousFunctionDefinition } from '../static-semantics/all.mjs';
import { C, NormalCompletion, Q } from '../completion.mjs';
import { OutOfRange } from '../helpers.mjs';
import {
  NamedEvaluation,
  InitializeBoundName,
  BindingClassDeclarationEvaluation,
} from './all.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

/** https://tc39.es/ecma262/#sec-exports-runtime-semantics-evaluation */
//   ExportDeclaration :
//     `export` ExportFromClause FromClause `;`
//     `export` NamedExports `;`
//     `export` VariableDeclaration
//     `export` Declaration
//     `export` `default` HoistableDeclaration
//     `export` `default` ClassDeclaration
//     `export` `default` AssignmentExpression `;`
export function* Evaluate_ExportDeclaration(ExportDeclaration: ParseNode.ExportDeclaration): StatementEvaluator {
  const {
    FromClause, NamedExports,
    VariableStatement,
    Declaration,
    default: isDefault,
    HoistableDeclaration,
    ClassDeclaration,
    AssignmentExpression,
  } = ExportDeclaration;

  if (FromClause || NamedExports) {
    // 1. Return NormalCompletion(empty).
    return NormalCompletion(undefined);
  }
  if (VariableStatement) {
    // 1. Return ? Evaluation of VariableStatement.
    return C(Q(yield* Evaluation(VariableStatement)));
  }
  if (Declaration) {
    // 1. Return ? Evaluation of Declaration.
    return C(Q(yield* Evaluation(Declaration)));
  }
  if (!isDefault) {
    throw new OutOfRange('Evaluate_ExportDeclaration', ExportDeclaration);
  }
  if (HoistableDeclaration) {
    // 1. Return ? Evaluation of HoistableDeclaration.
    return C(Q(yield* Evaluation(HoistableDeclaration)));
  }
  if (ClassDeclaration) {
    // 1. Let value be ? BindingClassDeclarationEvaluation of ClassDeclaration.
    const value = Q(yield* BindingClassDeclarationEvaluation(ClassDeclaration));
    // 2. Let className be the sole element of BoundNames of ClassDeclaration.
    const className = BoundNames(ClassDeclaration)[0];
    // If className is "*default*", then
    if (className.stringValue() === '*default*') {
      // a. Let env be the running execution context's LexicalEnvironment.
      const env = surroundingAgent.runningExecutionContext.LexicalEnvironment;
      // b. Perform ? InitializeBoundName("*default*", value, env).
      Q(InitializeBoundName(Value('*default*'), value, env));
    }
    // 3. Return NormalCompletion(empty).
    return NormalCompletion(undefined);
  }
  if (AssignmentExpression) {
    let value;
    // 1. If IsAnonymousFunctionDefinition(AssignmentExpression) is true, then
    if (IsAnonymousFunctionDefinition(AssignmentExpression)) {
      // a. Let value be ? NamedEvaluation of AssignmentExpression with argument "default".
      value = Q(yield* NamedEvaluation(AssignmentExpression, Value('default')));
    } else { // 2. Else,
      // a. Let rhs be ? Evaluation of AssignmentExpression.
      const rhs = Q(yield* Evaluation(AssignmentExpression));
      // a. Let value be ? GetValue(rhs).
      value = Q(GetValue(rhs));
    }
    // 3. Let env be the running execution context's LexicalEnvironment.
    const env = surroundingAgent.runningExecutionContext.LexicalEnvironment;
    // 4. Perform ? InitializeBoundName("*default*", value, env).
    Q(InitializeBoundName(Value('*default*'), value, env));
    // 5. Return NormalCompletion(empty).
    return NormalCompletion(undefined);
  }
  throw new OutOfRange('Evaluate_ExportDeclaration', ExportDeclaration);
}
