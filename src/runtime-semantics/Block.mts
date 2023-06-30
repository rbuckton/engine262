import { surroundingAgent } from '../engine.mjs';
import { Value } from '../value.mjs';
import { NewDeclarativeEnvironment, DeclarativeEnvironmentRecord } from '../environment.mjs';
import {
  LexicallyScopedDeclarations,
  IsConstantDeclaration,
  BoundNames,
} from '../static-semantics/all.mjs';
import { X, NormalCompletion, Completion, C, Q } from '../completion.mjs';
import { Evaluate_StatementList, InstantiateFunctionObject } from './all.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';
import type { StatementEvaluator } from '../evaluator.mjs';

/** https://tc39.es/ecma262/#sec-blockdeclarationinstantiation */
export function BlockDeclarationInstantiation(code: ParseNode.StatementList, env: DeclarativeEnvironmentRecord) {
  // 1. Let declarations be the LexicallyScopedDeclarations of code.
  const declarations = LexicallyScopedDeclarations(code);
  // 2. Let privateEnv be the running execution context's PrivateEnvironment.
  const privateEnv = surroundingAgent.runningExecutionContext.PrivateEnvironment;
  // 3. For each element d in declarations, do
  for (const d of declarations) {
    // a. For each element dn of the BoundNames of d, do
    for (const dn of BoundNames(d)) {
      // i. If IsConstantDeclaration of d is true, then
      if (IsConstantDeclaration(d)) {
        // 1. Perform ! env.CreateImmutableBinding(dn, true).
        X(env.CreateImmutableBinding(dn, Value.true));
      } else { // ii. Else,
        // 1. Perform ! env.CreateMutableBinding(dn, false).
        X(env.CreateMutableBinding(dn, Value.false));
      }
      // b. If d is a FunctionDeclaration, a GeneratorDeclaration, an AsyncFunctionDeclaration, or an AsyncGeneratorDeclaration, then
      if (d.type === 'FunctionDeclaration'
          || d.type === 'GeneratorDeclaration'
          || d.type === 'AsyncFunctionDeclaration'
          || d.type === 'AsyncGeneratorDeclaration') {
        // i. Let fn be the sole element of the BoundNames of d.
        const fn = BoundNames(d)[0];
        // ii. Let fo be InstantiateFunctionObject of d with argument env.
        const fo = InstantiateFunctionObject(d, env, privateEnv);
        // iii. Perform ! env.InitializeBinding(fn, fo).
        X(env.InitializeBinding(fn, fo));
      }
    }
  }
  // 4. Return unused.
  return 'unused';
}

/** https://tc39.es/ecma262/#sec-block-runtime-semantics-evaluation */
//  Block :
//    `{` `}`
//    `{` StatementList `}`
export function* Evaluate_Block({ StatementList }: ParseNode.Block): StatementEvaluator {
  if (StatementList.length === 0) {
    // 1. Return NormalCompletion(empty).
    return NormalCompletion(undefined);
  }
  // 1. Let oldEnv be the running execution context's LexicalEnvironment.
  const oldEnv = surroundingAgent.runningExecutionContext.LexicalEnvironment;
  // 2. Let blockEnv be NewDeclarativeEnvironment(oldEnv).
  const blockEnv = NewDeclarativeEnvironment(oldEnv);
  // 3. Perform BlockDeclarationInstantiation(StatementList, blockEnv).
  BlockDeclarationInstantiation(StatementList, blockEnv);
  // 4. Set the running execution context's LexicalEnvironment to blockEnv.
  surroundingAgent.runningExecutionContext.LexicalEnvironment = blockEnv;
  // 5. Let blockValue be the result of evaluating StatementList.
  const blockValue = Completion(yield* Evaluate_StatementList(StatementList));
  // 6. Set the running execution context's LexicalEnvironment to oldEnv.
  surroundingAgent.runningExecutionContext.LexicalEnvironment = oldEnv;
  // 7. Return ? blockValue.
  return C(Q(blockValue));
}
