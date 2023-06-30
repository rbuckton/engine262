import { surroundingAgent } from '../engine.mjs';
import { ObjectValue, Value } from '../value.mjs';
import { Evaluation, type IteratorRecordEvaluator, type StatementEvaluator } from '../evaluator.mjs';
import { NewDeclarativeEnvironment, DeclarativeEnvironmentRecord } from '../environment.mjs';
import {
  Assert,
  Call,
  GetIterator,
  GetValue,
  PutValue,
  GetV,
  ResolveBinding,
  InitializeReferencedBinding,
  IteratorComplete,
  IteratorValue,
  IteratorClose,
  AsyncIteratorClose,
  ToBoolean,
  ToObject,
  SameValue,
  type IteratorRecord,
} from '../abstract-ops/all.mjs';
import {
  BoundNames,
  IsConstantDeclaration,
  IsDestructuring,
  StringValue,
} from '../static-semantics/all.mjs';
import { CreateForInIterator } from '../intrinsics/ForInIteratorPrototype.mjs';
import {
  Completion,
  NormalCompletion,
  AbruptCompletion,
  UpdateEmpty,
  EnsureCompletion,
  Await,
  Q, X, C,
} from '../completion.mjs';
import { OutOfRange, ValueSet } from '../helpers.mjs';
import {
  Evaluate_SwitchStatement,
  Evaluate_VariableDeclarationList,
  BindingInitialization,
  DestructuringAssignmentEvaluation,
  refineLeftHandSideExpression,
} from './all.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

/** https://tc39.es/ecma262/#sec-loopcontinues */
function LoopContinues(completion: Completion, labelSet: ValueSet<StringValue>) {
  // 1. If completion.[[Type]] is normal, return true.
  if (completion.Type === 'normal') {
    return Value.true;
  }
  // 2. If completion.[[Type]] is not continue, return false.
  if (completion.Type !== 'continue') {
    return Value.false;
  }
  // 3. If completion.[[Target]] is empty, return true.
  if (completion.Target === undefined) {
    return Value.true;
  }
  // 4. If completion.[[Target]] is an element of labelSet, return true.
  if (labelSet.has(completion.Target)) {
    return Value.true;
  }
  // 5. Return false.
  return Value.false;
}

export function LabelledEvaluation(node: ParseNode.LabelledStatement | ParseNode.BreakableStatement, labelSet: ValueSet<StringValue>): StatementEvaluator {
  switch (node.type) {
    case 'DoWhileStatement':
    case 'WhileStatement':
    case 'ForStatement':
    case 'ForInStatement':
    case 'ForOfStatement':
    case 'ForAwaitStatement':
    case 'SwitchStatement':
      return LabelledEvaluation_BreakableStatement(node, labelSet);
    case 'LabelledStatement':
      return LabelledEvaluation_LabelledStatement(node, labelSet);
    default:
      throw new OutOfRange('LabelledEvaluation', node);
  }
}

/** https://tc39.es/ecma262/#sec-labelled-statements-runtime-semantics-labelledevaluation */
//   LabelledStatement : LabelIdentifier `:` LabelledItem
function* LabelledEvaluation_LabelledStatement({ LabelIdentifier, LabelledItem }: ParseNode.LabelledStatement, labelSet: ValueSet<StringValue>): StatementEvaluator {
  // 1. Let label be the StringValue of LabelIdentifier.
  const label = StringValue(LabelIdentifier);
  // 2. Let newLabelSet be the list-concatenation of labelSet and « label ».
  const newLabelSet = new ValueSet<StringValue>([...labelSet, label]);
  // 3. Let stmtResult be Completion(LabelledEvaluation of LabelledItem with argument newLabelSet).
  let stmtResult = Completion(yield* LabelledEvaluation_LabelledItem(LabelledItem, newLabelSet));
  // 4. If stmtResult.[[Type]] is break and SameValue(stmtResult.[[Target]], label) is true, then
  // SPEC-BUG?: stmtResult.[[Target]] is specified to allow ~empty~, but that is not excluded here.
  if (stmtResult.Type === 'break' && SameValue(stmtResult.Target!, label) === Value.true) { // NOTE: unsound non-null assertion
    // a. Set stmtResult to NormalCompletion(stmtResult.[[Value]]).
    stmtResult = NormalCompletion(stmtResult.Value);
  }
  // 5. Return ? stmtResult.
  return C(Q(stmtResult));
}

// LabelledItem :
//   Statement
//   FunctionDeclaration
function LabelledEvaluation_LabelledItem(LabelledItem: ParseNode.Statement | ParseNode.FunctionDeclarationLike, labelSet: ValueSet<StringValue>): StatementEvaluator {
  switch (LabelledItem.type) {
    case 'DoWhileStatement':
    case 'WhileStatement':
    case 'ForStatement':
    case 'ForInStatement':
    case 'ForOfStatement':
    case 'SwitchStatement':
    case 'LabelledStatement':
      return LabelledEvaluation(LabelledItem, labelSet);
    default:
      return Evaluation(LabelledItem);
  }
}

/** https://tc39.es/ecma262/#sec-statement-semantics-runtime-semantics-labelledevaluation */
//  BreakableStatement :
//    IterationStatement
//    SwitchStatement
//
//  IterationStatement :
//    (DoWhileStatement)
//    (WhileStatement)
function* LabelledEvaluation_BreakableStatement(BreakableStatement: ParseNode.BreakableStatement, labelSet: ValueSet<StringValue>) {
  switch (BreakableStatement.type) {
    case 'DoWhileStatement':
    case 'WhileStatement':
    case 'ForStatement':
    case 'ForInStatement':
    case 'ForOfStatement':
    case 'ForAwaitStatement': {
      // 1. Let stmtResult be LabelledEvaluation of IterationStatement with argument labelSet.
      let stmtResult = EnsureCompletion(yield* LabelledEvaluation_IterationStatement(BreakableStatement, labelSet));
      // 2. If stmtResult.[[Type]] is break, then
      if (stmtResult.Type === 'break') {
        // a. If stmtResult.[[Target]] is empty, then
        if (stmtResult.Target === undefined) {
          // i. If stmtResult.[[Value]] is empty, set stmtResult to NormalCompletion(undefined).
          if (stmtResult.Value === undefined) {
            stmtResult = NormalCompletion(Value.undefined);
          } else { // ii. Else, set stmtResult to NormalCompletion(stmtResult.[[Value]]).
            stmtResult = NormalCompletion(stmtResult.Value);
          }
        }
      }
      // 3. Return Completion(stmtResult).
      return Completion(stmtResult);
    }
    case 'SwitchStatement': {
      // 1. Let stmtResult be LabelledEvaluation of SwitchStatement.
      let stmtResult: Completion = EnsureCompletion(yield* Evaluate_SwitchStatement(BreakableStatement));
      // 2. If stmtResult.[[Type]] is break, then
      if (stmtResult.Type === 'break') {
        // a. If stmtResult.[[Target]] is empty, then
        if (stmtResult.Target === undefined) {
          // i. If stmtResult.[[Value]] is empty, set stmtResult to NormalCompletion(undefined).
          if (stmtResult.Value === undefined) {
            stmtResult = NormalCompletion(Value.undefined);
          } else { // ii. Else, set stmtResult to NormalCompletion(stmtResult.[[Value]]).
            stmtResult = NormalCompletion(stmtResult.Value);
          }
        }
      }
      // 3. Return Completion(stmtResult).
      return Completion(stmtResult);
    }
    default:
      throw new OutOfRange('LabelledEvaluation_BreakableStatement', BreakableStatement);
  }
}

function LabelledEvaluation_IterationStatement(IterationStatement: ParseNode.IterationStatement, labelSet: ValueSet<StringValue>) {
  switch (IterationStatement.type) {
    case 'DoWhileStatement':
      return LabelledEvaluation_IterationStatement_DoWhileStatement(IterationStatement, labelSet);
    case 'WhileStatement':
      return LabelledEvaluation_IterationStatement_WhileStatement(IterationStatement, labelSet);
    case 'ForStatement':
      return LabelledEvaluation_BreakableStatement_ForStatement(IterationStatement, labelSet);
    case 'ForInStatement':
      return LabelledEvaluation_IterationStatement_ForInStatement(IterationStatement, labelSet);
    case 'ForOfStatement':
      return LabelledEvaluation_IterationStatement_ForOfStatement(IterationStatement, labelSet);
    case 'ForAwaitStatement':
      return LabelledEvaluation_IterationStatement_ForAwaitStatement(IterationStatement, labelSet);
    default:
      throw new OutOfRange('LabelledEvaluation_IterationStatement', IterationStatement);
  }
}

/** https://tc39.es/ecma262/#sec-do-while-statement-runtime-semantics-labelledevaluation */
//   IterationStatement :
//     `do` Statement `while` `(` Expression `)` `;`
function* LabelledEvaluation_IterationStatement_DoWhileStatement({ Statement, Expression }: ParseNode.DoWhileStatement, labelSet: ValueSet<StringValue>) {
  // 1. Let V be undefined.
  let V: unknown = Value.undefined;
  // 2. Repeat,
  while (true) {
    // a. Let stmtResult be Completion(Evaluation of Statement).
    const stmtResult = Completion(yield* Evaluation(Statement));
    // b. If LoopContinues(stmtResult, labelSet) is false, return ? UpdateEmpty(stmtResult, V).
    if (LoopContinues(stmtResult, labelSet) === Value.false) {
      return C(Q(UpdateEmpty(stmtResult, V)));
    }
    // c. If stmtResult.[[Value]] is not empty, set V to stmtResult.[[Value]].
    if (stmtResult.Value !== undefined) {
      V = stmtResult.Value;
    }
    // d. Let exprRef be ? Evaluation of Expression.
    const exprRef = Q(yield* Evaluation(Expression));
    // e. Let exprValue be ? GetValue(exprRef).
    const exprValue = Q(GetValue(exprRef));
    // f. If ToBoolean(exprValue) is false, return V.
    if (ToBoolean(exprValue) === Value.false) {
      return C(V);
    }
  }
}


/** https://tc39.es/ecma262/#sec-while-statement-runtime-semantics-labelledevaluation */
//   IterationStatement :
//     `while` `(` Expression `)` Statement
function* LabelledEvaluation_IterationStatement_WhileStatement({ Expression, Statement }: ParseNode.WhileStatement, labelSet: ValueSet<StringValue>): StatementEvaluator {
  // 1. Let V be undefined.
  let V;
  V = Value.undefined;
  // 2. Repeat,
  while (true) {
    // a. Let exprRef be ? Evaluation of Expression.
    const exprRef = Q(yield* Evaluation(Expression));
    // b. Let exprValue be ? GetValue(exprRef).
    const exprValue = Q(GetValue(exprRef));
    // c. If ToBoolean(exprValue) is false, return NormalCompletion(V).
    if (ToBoolean(exprValue) === Value.false) {
      return NormalCompletion(V);
    }
    // d. Let stmtResult be Completion(Evaluation of Statement).
    const stmtResult = Completion(yield* Evaluation(Statement));
    // e. If LoopContinues(stmtResult, labelSet) is false, return ? UpdateEmpty(stmtResult, V).
    if (LoopContinues(stmtResult, labelSet) === Value.false) {
      return C(Q(UpdateEmpty(stmtResult, V)));
    }
    // f. If stmtResult.[[Value]] is not empty, set V to stmtResult.[[Value]].
    if (stmtResult.Value !== undefined) {
      V = stmtResult.Value;
    }
  }
}

/** https://tc39.es/ecma262/#sec-for-statement-runtime-semantics-labelledevaluation */
//   IterationStatement :
//     `for` `(` Expression? `;` Expression? `;` Expresssion? `)` Statement
//     `for` `(` `var` VariableDeclarationList `;` Expression? `;` Expression? `)` Statement
//     `for` `(` LexicalDeclaration Expression? `;` Expression? `)` Statement
function* LabelledEvaluation_BreakableStatement_ForStatement(ForStatement: ParseNode.ForStatement, labelSet: ValueSet<StringValue>): StatementEvaluator {
  const {
    VariableDeclarationList, LexicalDeclaration,
    Expression_a, Expression_b, Expression_c,
    Statement,
  } = ForStatement;
  if (LexicalDeclaration) {
    // 1. Let oldEnv be the running execution context's LexicalEnvironment.
    const oldEnv = surroundingAgent.runningExecutionContext.LexicalEnvironment;
    // 2. Let loopEnv be NewDeclarativeEnvironment(oldEnv).
    const loopEnv = NewDeclarativeEnvironment(oldEnv);
    // 3. Let isConst be IsConstantDeclaration of LexicalDeclaration.
    const isConst = IsConstantDeclaration(LexicalDeclaration);
    // 4. Let boundNames be the BoundNames of LexicalDeclaration.
    const boundNames = BoundNames(LexicalDeclaration);
    // 5. For each element dn of boundNames, do
    for (const dn of boundNames) {
      // a. If isConst is true, then
      if (isConst) {
        // i. Perform ! loopEnv.CreateImmutableBinding(dn, true).
        X(loopEnv.CreateImmutableBinding(dn, Value.true));
      } else { // b. Else,
        // i. Perform ! loopEnv.CreateMutableBinding(dn, false).
        X(loopEnv.CreateMutableBinding(dn, Value.false));
      }
    }
    // 6. Set the running execution context's LexicalEnvironment to loopEnv.
    surroundingAgent.runningExecutionContext.LexicalEnvironment = loopEnv;
    // 7. Let forDcl be Completion(Evaluation of LexicalDeclaration).
    const forDcl = Completion(yield* Evaluation(LexicalDeclaration));
    // 8. If forDcl is an abrupt completion, then
    if (forDcl instanceof AbruptCompletion) {
      // a. Set the running execution context's LexicalEnvironment to oldEnv.
      surroundingAgent.runningExecutionContext.LexicalEnvironment = oldEnv;
      // b. Return Completion(forDcl).
      return Completion(forDcl);
    }
    // 9. If isConst is false, let perIterationLets be boundNames; otherwise let perIterationLets be « ».
    let perIterationLets;
    if (isConst === false) {
      perIterationLets = boundNames;
    } else {
      perIterationLets = [];
    }
    // 10. Let bodyResult be Completion(ForBodyEvaluation(the first Expression, the second Expression, Statement, perIterationLets, labelSet)).
    const bodyResult = Completion(yield* ForBodyEvaluation(Expression_a, Expression_b, Statement, perIterationLets, labelSet));
    // 11. Set the running execution context's LexicalEnvironment to oldEnv.
    surroundingAgent.runningExecutionContext.LexicalEnvironment = oldEnv;
    // 12. Return ? bodyResult.
    return C(Q(bodyResult));
  } else if (VariableDeclarationList) {
    // 1. Perform ? Evaluating of VariableDeclarationList.
    Q(yield* Evaluate_VariableDeclarationList(VariableDeclarationList));
    // 4. Return ? ForBodyEvaluation(the first Expression, the second Expression, Statement, « », labelSet).
    return C(Q(yield* ForBodyEvaluation(Expression_a, Expression_b, Statement, [], labelSet)));
  } else {
    // 1. If the first Expression is present, then
    if (Expression_a) {
      // a. Let exprRef be ? Evaluation of the first Expression.
      const exprRef = Q(yield* Evaluation(Expression_a));
      // b. Perform ? GetValue(exprRef).
      Q(GetValue(exprRef));
    }
    // 4. Return ? ForBodyEvaluation(the second Expression, the third Expression, Statement, « », labelSet).
    return C(Q(yield* ForBodyEvaluation(Expression_b, Expression_c, Statement, [], labelSet)));
  }
}

function* LabelledEvaluation_IterationStatement_ForInStatement(ForInStatement: ParseNode.ForInStatement, labelSet: ValueSet<StringValue>) {
  const {
    LeftHandSideExpression,
    ForBinding,
    ForDeclaration,
    Expression,
    Statement,
  } = ForInStatement;
  if (LeftHandSideExpression && Expression) {
    // IterationStatement : `for` `(` LeftHandSideExpression `in` Expression `)` Statement
    // 1. Let keyResult be ? ForIn/OfHeadEvaluation(« », Expression, enumerate).
    const keyResult = Q(yield* ForInOfHeadEvaluation([], Expression, 'enumerate'));
    // 2. Return ? ForIn/OfBodyEvaluation(LeftHandSideExpression, Statement, keyResult, enumerate, assignment, labelSet).
    return Q(yield* ForInOfBodyEvaluation(LeftHandSideExpression, Statement, keyResult, 'enumerate', 'assignment', labelSet));
  } else if (ForBinding && Expression) {
    // IterationStatement :`for` `(` `var` ForBinding `in` Expression `)` Statement
    // 1. Let keyResult be ? ForIn/OfHeadEvaluation(« », Expression, enumerate).
    const keyResult = Q(yield* ForInOfHeadEvaluation([], Expression, 'enumerate'));
    // 2. Return ? ForIn/OfBodyEvaluation(ForBinding, Statement, keyResult, enumerate, varBinding, labelSet).
    return Q(yield* ForInOfBodyEvaluation(ForBinding, Statement, keyResult, 'enumerate', 'varBinding', labelSet));
  } else if (ForDeclaration && Expression) {
    // IterationStatement : `for` `(` ForDeclaration `in` Expression `)` Statement
    // 1. Let keyResult be ? ForIn/OfHeadEvaluation(BoundNames of ForDeclaration, Expression, enumerate).
    const keyResult = Q(yield* ForInOfHeadEvaluation(BoundNames(ForDeclaration), Expression, 'enumerate'));
    // 2. Return ? ForIn/OfBodyEvaluation(ForDeclaration, Statement, keyResult, enumerate, lexicalBinding, labelSet).
    return Q(yield* ForInOfBodyEvaluation(ForDeclaration, Statement, keyResult, 'enumerate', 'lexicalBinding', labelSet));
  } else {
    throw new OutOfRange('LabelledEvaluation_IterationStatement_ForInStatement', ForInStatement);
  }
}

// IterationStatement :
//   `for` `await` `(` LeftHandSideExpression `of` AssignmentExpression `)` Statement
//   `for` `await` `(` `var` ForBinding `of` AssignmentExpression `)` Statement
//   `for` `await` `(` ForDeclaration`of` AssignmentExpression `)` Statement
function* LabelledEvaluation_IterationStatement_ForAwaitStatement(ForAwaitStatement: ParseNode.ForAwaitStatement, labelSet: ValueSet<StringValue>) {
  const {
    LeftHandSideExpression,
    ForBinding,
    ForDeclaration,
    AssignmentExpression,
    Statement,
  } = ForAwaitStatement;
  if (LeftHandSideExpression) {
    // 1. Let keyResult be ? ForIn/OfHeadEvaluation(« », AssignmentExpression, async-iterate).
    const keyResult = Q(yield* ForInOfHeadEvaluation([], AssignmentExpression, 'async-iterate'));
    // 2. Return ? ForIn/OfBodyEvaluation(LeftHandSideExpression, Statement, keyResult, iterate, assignment, labelSet, async).
    return Q(yield* ForInOfBodyEvaluation(LeftHandSideExpression, Statement, keyResult, 'iterate', 'assignment', labelSet, 'async'));
  } else if (ForBinding) {
    // 1. Let keyResult be ? ForIn/OfHeadEvaluation(« », AssignmentExpression, async-iterate).
    const keyResult = Q(yield* ForInOfHeadEvaluation([], AssignmentExpression, 'async-iterate'));
    // 2. Return ? ForIn/OfBodyEvaluation(ForBinding, Statement, keyResult, iterate, varBinding, labelSet, async).
    return Q(yield* ForInOfBodyEvaluation(ForBinding, Statement, keyResult, 'iterate', 'varBinding', labelSet, 'async'));
  } else if (ForDeclaration) {
    // 1. Let keyResult be ? ForIn/OfHeadEvaluation(BoundNames of ForDeclaration, AssignmentExpression, async-iterate).
    const keyResult = Q(yield* ForInOfHeadEvaluation(BoundNames(ForDeclaration), AssignmentExpression, 'async-iterate'));
    // 2. Return ? ForIn/OfBodyEvaluation(ForDeclaration, Statement, keyResult, iterate, lexicalBinding, labelSet, async).
    return Q(yield* ForInOfBodyEvaluation(ForDeclaration, Statement, keyResult, 'iterate', 'lexicalBinding', labelSet, 'async'));
  } else {
    throw new OutOfRange('LabelledEvaluation_IterationStatement_ForAwaitStatement', ForAwaitStatement);
  }
}

/** https://tc39.es/ecma262/#sec-for-in-and-for-of-statements-runtime-semantics-labelledevaluation */
// IterationStatement :
//   `for` `(` LeftHandSideExpression `of` AssignmentExpression `)` Statement
//   `for` `(` `var` ForBinding `of` AssignmentExpression `)` Statement
//   `for` `(` ForDeclaration `of` AssignmentExpression `)` Statement
function* LabelledEvaluation_IterationStatement_ForOfStatement(ForOfStatement: ParseNode.ForOfStatement, labelSet: ValueSet<StringValue>) {
  const {
    LeftHandSideExpression,
    ForBinding,
    ForDeclaration,
    AssignmentExpression,
    Statement,
  } = ForOfStatement;
  if (LeftHandSideExpression) {
    // 1. Let keyResult be ? ForIn/OfHeadEvaluation(« », AssignmentExpression, iterate).
    const keyResult = Q(yield* ForInOfHeadEvaluation([], AssignmentExpression, 'iterate'));
    // 2. Return ? ForIn/OfBodyEvaluation(LeftHandSideExpression, Statement, keyResult, iterate, assignment, labelSet).
    return Q(yield* ForInOfBodyEvaluation(LeftHandSideExpression, Statement, keyResult, 'iterate', 'assignment', labelSet));
  } else if (ForBinding) {
    // 1. Let keyResult be ? ForIn/OfHeadEvaluation(« », AssignmentExpression, iterate).
    const keyResult = Q(yield* ForInOfHeadEvaluation([], AssignmentExpression, 'iterate'));
    // 2. Return ? ForIn/OfBodyEvaluation(ForBinding, Statement, keyResult, iterate, varBinding, labelSet).
    return Q(yield* ForInOfBodyEvaluation(ForBinding, Statement, keyResult, 'iterate', 'varBinding', labelSet));
  } else if (ForDeclaration) {
    // 1. Let keyResult be ? ForIn/OfHeadEvaluation(BoundNames of ForDeclaration, AssignmentExpression, iterate).
    const keyResult = Q(yield* ForInOfHeadEvaluation(BoundNames(ForDeclaration), AssignmentExpression, 'iterate'));
    // 2. Return ? ForIn/OfBodyEvaluation(ForDeclaration, Statement, keyResult, iterate, lexicalBinding, labelSet).
    return Q(yield* ForInOfBodyEvaluation(ForDeclaration, Statement, keyResult, 'iterate', 'lexicalBinding', labelSet));
  } else {
    throw new OutOfRange('LabelledEvaluation_BreakableStatement_ForOfStatement', ForOfStatement);
  }
}

/** https://tc39.es/ecma262/#sec-forbodyevaluation */
function* ForBodyEvaluation(test: ParseNode.Expression | undefined, increment: ParseNode.Expression | undefined, stmt: ParseNode.Statement, perIterationBindings: StringValue[], labelSet: ValueSet<StringValue>): StatementEvaluator {
  // 1. Let V be undefined.
  let V;
  V = Value.undefined;
  // 2. Perform ? CreatePerIterationEnvironment(perIterationBindings).
  Q(CreatePerIterationEnvironment(perIterationBindings));
  // 3. Repeat,
  while (true) {
    // a. If test is not [empty], then
    if (test) {
      // i. Let testRef be ? Evaluation of test.
      const testRef = Q(yield* Evaluation(test));
      // ii. Let testValue be ? GetValue(testRef).
      const testValue = Q(GetValue(testRef));
      // iii. If ToBoolean(testValue) is false, return V.
      if (X(ToBoolean(testValue)) === Value.false) {
        return C(V);
      }
    }
    // b. Let result be Completion(Evaluation of stmt).
    const result = Completion(yield* Evaluation(stmt));
    // c. If LoopContinues(result, labelSet) is false, return ? UpdateEmpty(result, V).
    if (LoopContinues(result, labelSet) === Value.false) {
      return C(Q(UpdateEmpty(result, V)));
    }
    // d. If result.[[Value]] is not empty, set V to result.[[Value]].
    if (result.Value !== undefined) {
      V = result.Value;
    }
    // e. Perform ? CreatePerIterationEnvironment(perIterationBindings).
    Q(CreatePerIterationEnvironment(perIterationBindings));
    // f. If increment is not [empty], then
    if (increment) {
      // i. Let incRef be ? Evaluation of increment.
      const incRef = Q(yield* Evaluation(increment));
      // ii. Perform ? GetValue(incRef).
      Q(GetValue(incRef));
    }
  }
}

/** https://tc39.es/ecma262/#sec-createperiterationenvironment */
function CreatePerIterationEnvironment(perIterationBindings: StringValue[]) {
  // 1. If perIterationBindings has any elements, then
  if (perIterationBindings.length > 0) {
    // a. Let lastIterationEnv be the running execution context's LexicalEnvironment.
    const lastIterationEnv = surroundingAgent.runningExecutionContext.LexicalEnvironment;
    // NON-SPEC
    Assert(lastIterationEnv instanceof DeclarativeEnvironmentRecord);
    // b. Let outer be lastIterationEnv.[[OuterEnv]].
    const outer = lastIterationEnv.OuterEnv;
    // c. Assert: outer is not null.
    Assert(outer !== Value.null);
    // d. Let thisIterationEnv be NewDeclarativeEnvironment(outer).
    const thisIterationEnv = NewDeclarativeEnvironment(outer);
    // e. For each element bn of perIterationBindings, do
    for (const bn of perIterationBindings) {
      // i. Perform ! thisIterationEnv.CreateMutableBinding(bn, false).
      X(thisIterationEnv.CreateMutableBinding(bn, Value.false));
      // ii. Let lastValue be ? lastIterationEnv.GetBindingValue(bn, true).
      const lastValue = Q(lastIterationEnv.GetBindingValue(bn, Value.true));
      // iii. Perform ! thisIterationEnv.InitializeBinding(bn, lastValue).
      X(thisIterationEnv.InitializeBinding(bn, lastValue));
    }
    // f. Set the running execution context's LexicalEnvironment to thisIterationEnv.
    surroundingAgent.runningExecutionContext.LexicalEnvironment = thisIterationEnv;
  }
  // 2. Return undefined.
  return Value.undefined;
}

/** https://tc39.es/ecma262/#sec-runtime-semantics-forinofheadevaluation */
function* ForInOfHeadEvaluation(uninitializedBoundNames: StringValue[], expr: ParseNode.Expression | ParseNode.AssignmentExpression, iterationKind: 'enumerate' | 'iterate' | 'async-iterate'): IteratorRecordEvaluator {
  // 1. Let oldEnv be the running execution context's LexicalEnvironment.
  const oldEnv = surroundingAgent.runningExecutionContext.LexicalEnvironment;
  // 2. If uninitializedBoundNames is not an empty List, then
  if (uninitializedBoundNames.length > 0) {
    // a. Assert: uninitializedBoundNames has no duplicate entries.
    // b. Let newEnv be NewDeclarativeEnvironment(oldEnv).
    const newEnv = NewDeclarativeEnvironment(oldEnv);
    // c. For each string name in uninitializedBoundNames, do
    for (const name of uninitializedBoundNames) {
      // i. Perform ! newEnv.CreateMutableBinding(name, false).
      X(newEnv.CreateMutableBinding(name, Value.false));
    }
    // d. Set the running execution context's LexicalEnvironment to newEnv.
    surroundingAgent.runningExecutionContext.LexicalEnvironment = newEnv;
  }
  // 3. Let exprRef be Completion(Evaluation of expr).
  const exprRef = Completion(yield* Evaluation(expr));
  // 4. Set the running execution context's LexicalEnvironment to oldEnv.
  surroundingAgent.runningExecutionContext.LexicalEnvironment = oldEnv;
  // 5. Let exprValue be ? GetValue(? exprRef).
  const exprValue = Q(GetValue(Q(exprRef)));
  // 6. If iterationKind is enumerate, then
  if (iterationKind === 'enumerate') {
    // a. If exprValue is undefined or null, then
    if (exprValue === Value.undefined || exprValue === Value.null) {
      // i. Return Completion { [[Type]]: break, [[Value]]: empty, [[Target]]: empty }.
      return new Completion({ Type: 'break', Value: undefined, Target: undefined });
    }
    // b. Let obj be ! ToObject(exprValue).
    const obj = X(ToObject(exprValue));
    // c. Let iterator be ? EnumerateObjectProperties(obj).
    const iterator = Q(EnumerateObjectProperties(obj));
    // d. Let nextMethod be ! GetV(iterator, "next").
    const nextMethod = X(GetV(iterator, Value('next')));
    // e. Return the Record { [[Iterator]]: iterator, [[NextMethod]]: nextMethod, [[Done]]: false }.
    return EnsureCompletion({ Iterator: iterator, NextMethod: nextMethod, Done: Value.false });
  } else { // 7. Else,
    // a. Assert: iterationKind is iterate or async-iterate.
    Assert(iterationKind === 'iterate' || iterationKind === 'async-iterate');
    // b. If iterationKind is async-iterate, let iteratorHint be async.
    // c. Else, let iteratorHint be sync.
    const iteratorHint = iterationKind === 'async-iterate' ? 'async' : 'sync';
    // d. Return ? GetIterator(exprValue, iteratorHint).
    return Q(GetIterator(exprValue, iteratorHint));
  }
}

/** https://tc39.es/ecma262/#sec-enumerate-object-properties */
function EnumerateObjectProperties(O: ObjectValue) {
  return CreateForInIterator(O);
}

/** https://tc39.es/ecma262/#sec-runtime-semantics-forin-div-ofbodyevaluation-lhs-stmt-iterator-lhskind-labelset */
function* ForInOfBodyEvaluation(lhs: ParseNode.LeftHandSideExpression | ParseNode.ForBinding | ParseNode.ForDeclaration, stmt: ParseNode.Statement, iteratorRecord: IteratorRecord, iterationKind: 'enumerate' | 'iterate', lhsKind: 'assignment' | 'varBinding' | 'lexicalBinding', labelSet: ValueSet<StringValue>, iteratorKind?: 'sync' | 'async') {
  // 1. If iteratorKind is not present, set iteratorKind to sync.
  if (iteratorKind === undefined) {
    iteratorKind = 'sync';
  }
  // 2. Let oldEnv be the running execution context's LexicalEnvironment.
  const oldEnv = surroundingAgent.runningExecutionContext.LexicalEnvironment;
  // 3. Let V be undefined.
  let V: unknown = Value.undefined;
  // 4. Let destructuring be IsDestructuring of lhs.
  const destructuring = IsDestructuring(lhs);
  // 5. If destructuring is true and if lhsKind is assignment, then
  let assignmentPattern: ParseNode.AssignmentPattern | undefined;
  if (destructuring && lhsKind === 'assignment') {
    // a. Assert: lhs is a LeftHandSideExpression.
    // b. Let assignmentPattern be the AssignmentPattern that is covered by lhs.
    assignmentPattern = refineLeftHandSideExpression(lhs);
  }
  let status;
  // 6. Repeat,
  while (true) {
    // a. Let nextResult be ? Call(iteratorRecord.[[NextMethod]], iteratorRecord.[[Iterator]]).
    let nextResult;
    nextResult = Q(Call(iteratorRecord.NextMethod, iteratorRecord.Iterator));
    // b. If iteratorKind is async, then set nextResult to ? Await(nextResult).
    if (iteratorKind === 'async') {
      nextResult = Q(yield* Await(nextResult));
    }
    // c. If nextResult is not an Object, throw a TypeError exception.
    if (!(nextResult instanceof ObjectValue)) {
      return surroundingAgent.Throw('TypeError', 'NotAnObject', nextResult);
    }
    // d. Let done be ? IteratorComplete(nextResult).
    const done = Q(IteratorComplete(nextResult));
    // e. If done is true, return NormalCompletion(V).
    if (done === Value.true) {
      return NormalCompletion(V);
    }
    // f. Let nextValue be ? IteratorValue(nextResult).
    const nextValue = Q(IteratorValue(nextResult));
    // g. If lhsKind is either assignment or varBinding, then
    let lhsRef;
    let iterationEnv;
    if (lhsKind === 'assignment' || lhsKind === 'varBinding') {
      if (destructuring === true) {
        if (lhsKind === 'assignment') {
          status = Completion(yield* DestructuringAssignmentEvaluation(assignmentPattern!, nextValue));
        } else {
          Assert(lhsKind === 'varBinding');
          Assert(lhs.type === 'ForBinding');
          status = Completion(yield* BindingInitialization(lhs, nextValue, Value.undefined));
        }
      } else {
        lhsRef = Completion(yield* Evaluation(lhs));
        if (lhsRef instanceof AbruptCompletion) {
          status = lhsRef;
        } else {
          status = Completion(PutValue(lhsRef.Value, nextValue));
        }
      }
    } else { // h. Else,
      // i. Assert: lhsKind is lexicalBinding.
      Assert(lhsKind === 'lexicalBinding');
      // ii. Assert: lhs is a ForDeclaration.
      Assert(lhs.type === 'ForDeclaration');
      // iii. Let iterationEnv be NewDeclarativeEnvironment(oldEnv).
      iterationEnv = NewDeclarativeEnvironment(oldEnv);
      // iv. Perform BindingInstantiation for lhs passing iterationEnv as the argument.
      BindingInstantiation(lhs, iterationEnv);
      // v. Set the running execution context's LexicalEnvironment to iterationEnv.
      surroundingAgent.runningExecutionContext.LexicalEnvironment = iterationEnv;
      // vi. If destructuring is true, then
      if (destructuring === true) {
        status = Completion(yield* BindingInitialization(lhs, nextValue, iterationEnv));
      } else {
        // 1. Assert: lhs binds a single name.
        // 2. Let lhsName be the sole element of BoundNames of lhs.
        const lhsName = BoundNames(lhs)[0];
        // 3. Let lhsRef be ! ResolveBinding(lhsName).
        lhsRef = X(ResolveBinding(lhsName, undefined, lhs.strict));
        status = Completion(InitializeReferencedBinding(lhsRef, nextValue));
      }
    }
    // k. If status is an abrupt completion, then
    if (status instanceof AbruptCompletion) {
      // i. Set the running execution context's LexicalEnvironment to oldEnv.
      surroundingAgent.runningExecutionContext.LexicalEnvironment = oldEnv;
      // ii. If iteratorKind is async, return ? AsyncIteratorClose(iteratorRecord, status).
      if (iteratorKind === 'async') {
        return C(Q(yield* AsyncIteratorClose(iteratorRecord, status)));
      }
      // iii. if iterationKind is enumerate, then
      if (iterationKind === 'enumerate') {
        // 1. Return status.
        return C(Q(status));
      } else { // iv. Else,
        // 1. Assert: iterationKind is iterate.
        Assert(iterationKind === 'iterate');
        // 2. Return ? IteratorClose(iteratorRecord, status).
        return C(Q(IteratorClose(iteratorRecord, status)));
      }
    }
    // l. Let result be the result of evaluating stmt.
    const result = Completion(yield* Evaluation(stmt));
    // m. Set the running execution context's LexicalEnvironment to oldEnv.
    surroundingAgent.runningExecutionContext.LexicalEnvironment = oldEnv;
    // n. If LoopContinues(result, labelSet) is false, then
    if (LoopContinues(result, labelSet) === Value.false) {
      // i. If iterationKind is enumerate, then
      if (iterationKind === 'enumerate') {
        // 1. Return ? UpdateEmpty(result, V).
        return C(Q(UpdateEmpty(result, V)));
      } else { // ii. Else,
        // 1. Assert: iterationKind is iterate.
        Assert(iterationKind === 'iterate');
        // 2. Set status to Completion(UpdateEmpty(result, V)).
        status = Completion(UpdateEmpty(result, V));
        // 3. If iteratorKind is async, return ? AsyncIteratorClose(iteratorRecord, status).
        if (iteratorKind === 'async') {
          return C(Q(yield* AsyncIteratorClose(iteratorRecord, status)));
        }
        // 4. Return ? IteratorClose(iteratorRecord, status).
        return C(Q(IteratorClose(iteratorRecord, status)));
      }
    }
    // o. If result.[[Value]] is not empty, set V to result.[[Value]].
    if (result.Value !== undefined) {
      V = result.Value;
    }
  }
}

/** https://tc39.es/ecma262/#sec-runtime-semantics-bindinginstantiation */
//   ForDeclaration : LetOrConst ForBinding
function BindingInstantiation({ LetOrConst, ForBinding }: ParseNode.ForDeclaration, environment: DeclarativeEnvironmentRecord) {
  // 1. For each element name of the BoundNames of ForBinding, do
  for (const name of BoundNames(ForBinding)) {
    // a. If IsConstantDeclaration of LetOrConst is true, then
    if (IsConstantDeclaration(LetOrConst)) {
      // i. Perform ! environment.CreateImmutableBinding(name, true).
      X(environment.CreateImmutableBinding(name, Value.true));
    } else { // b. Else,
      // i. Perform ! environment.CreateMutableBinding(name, false).
      X(environment.CreateMutableBinding(name, Value.false));
    }
  }
}

/** https://tc39.es/ecma262/#sec-for-in-and-for-of-statements-runtime-semantics-evaluation */
//   ForBinding : BindingIdentifier
export function Evaluate_ForBinding({ BindingIdentifier, strict }: ParseNode.ForBinding): Completion {
  Assert(!!BindingIdentifier);
  // 1. Let bindingId be StringValue of BindingIdentifier.
  const bindingId = StringValue(BindingIdentifier);
  // 2. Return ? ResolveBinding(bindingId).
  return EnsureCompletion(Q(ResolveBinding(bindingId, undefined, strict)));
}
