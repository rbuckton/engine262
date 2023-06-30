import { ReferenceRecord, Value } from '../value.mjs';
import { Q, X, C } from '../completion.mjs';
import {
  GetValue,
  PutValue,
  ToBoolean,
} from '../abstract-ops/all.mjs';
import {
  IsAnonymousFunctionDefinition,
  IsIdentifierRef,
} from '../static-semantics/all.mjs';
import { Evaluation, type ExpressionEvaluator } from '../evaluator.mjs';
import { OutOfRange, type Mutable } from '../helpers.mjs';
import {
  NamedEvaluation,
  ApplyStringOrNumericBinaryOperator,
  DestructuringAssignmentEvaluation,
} from './all.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

interface DestructuringAssignmentRefinements<K extends 'array' | 'object'> {
  'ArrayLiteral': ParseNode.ArrayAssignmentPattern;
  'ObjectLiteral': ParseNode.ObjectAssignmentPattern;
  'PropertyDefinition': ParseNode.AssignmentProperty;
  'IdentifierReference': K extends 'array' ? ParseNode.AssignmentElement : ParseNode.AssignmentProperty;
  'MemberExpression': ParseNode.AssignmentElement;
  'CoverInitializedName': ParseNode.AssignmentProperty;
  'AssignmentExpression': ParseNode.AssignmentElement;
  'Elision': ParseNode.Elision;
}

type RefineResult<T extends ParseNode['type'], K extends 'array' | 'object'> =
  T extends keyof DestructuringAssignmentRefinements<K> ? DestructuringAssignmentRefinements<K>[T] :
  never;

/** https://tc39.es/ecma262/#sec-destructuring-assignment */
export function refineLeftHandSideExpression<T extends ParseNode, K extends 'array' | 'object'>(node: T, type?: K): RefineResult<T['type'], K>;
export function refineLeftHandSideExpression(node: ParseNode, type?: 'array' | 'object'): RefineResult<ParseNode['type'], 'array' | 'object'> {
  switch (node.type) {
    case 'ArrayLiteral': {
      const AssignmentElementList: ParseNode.AssignmentElisionElement[] = [];
      const refinement: Mutable<ParseNode.ArrayAssignmentPattern> = {
        type: 'ArrayAssignmentPattern',
        AssignmentElementList,
        AssignmentRestElement: undefined,
      };
      node.ElementList.forEach((n) => {
        switch (n.type) {
          case 'SpreadElement':
            refinement.AssignmentRestElement = {
              type: 'AssignmentRestElement',
              DestructuringAssignmentTarget: n.AssignmentExpression as ParseNode.DestructuringAssignmentTarget, // NOTE: unsound cast
            };
            break;
          case 'ArrayLiteral':
          case 'ObjectLiteral':
            AssignmentElementList.push({
              type: 'AssignmentElement',
              DestructuringAssignmentTarget: n,
              Initializer: null,
            });
            break;
          default:
            AssignmentElementList.push(refineLeftHandSideExpression(n, 'array'));
            break;
        }
      });
      return refinement;
    }
    case 'ObjectLiteral': {
      const AssignmentPropertyList: ParseNode.AssignmentProperty[] = [];
      const refined: Mutable<ParseNode.ObjectAssignmentPattern> = {
        type: 'ObjectAssignmentPattern',
        AssignmentPropertyList,
        AssignmentRestProperty: undefined,
      };
      node.PropertyDefinitionList.forEach((p) => {
        if (p.type === 'PropertyDefinition' && p.PropertyName === null && p.AssignmentExpression) {
          refined.AssignmentRestProperty = {
            type: 'AssignmentRestProperty',
            DestructuringAssignmentTarget: p.AssignmentExpression as ParseNode.LeftHandSideExpression, // NOTE: unsound cast
          };
        } else {
          AssignmentPropertyList.push(refineLeftHandSideExpression(p, 'object'));
        }
      });
      return refined;
    }
    case 'PropertyDefinition':
      return {
        type: 'AssignmentProperty',
        PropertyName: node.PropertyName!, // NOTE: unsound non-null assertion
        AssignmentElement: node.AssignmentExpression.type === 'AssignmentExpression'
          ? {
            type: 'AssignmentElement',
            DestructuringAssignmentTarget: node.AssignmentExpression.LeftHandSideExpression as ParseNode.LeftHandSideExpression, // NOTE: unsound cast
            Initializer: node.AssignmentExpression.AssignmentExpression,
          } satisfies ParseNode.AssignmentElement
          : {
            type: 'AssignmentElement',
            DestructuringAssignmentTarget: node.AssignmentExpression as ParseNode.LeftHandSideExpression, // NOTE: unsound cast
            Initializer: null,
          } satisfies ParseNode.AssignmentElement,
      } satisfies ParseNode.AssignmentProperty;
    case 'IdentifierReference':
      if (type === 'array') {
        return {
          type: 'AssignmentElement',
          DestructuringAssignmentTarget: node,
          Initializer: null,
        } satisfies ParseNode.AssignmentElement;
      } else {
        return {
          type: 'AssignmentProperty',
          IdentifierReference: node,
          Initializer: undefined,
        } satisfies ParseNode.AssignmentProperty;
      }
    case 'MemberExpression':
      return {
        type: 'AssignmentElement',
        DestructuringAssignmentTarget: node,
        Initializer: null,
      } satisfies ParseNode.AssignmentElement;
    case 'CoverInitializedName':
      return {
        type: 'AssignmentProperty',
        IdentifierReference: node.IdentifierReference,
        Initializer: node.Initializer ?? undefined,
      } satisfies ParseNode.AssignmentProperty;
    case 'AssignmentExpression':
      return {
        type: 'AssignmentElement',
        DestructuringAssignmentTarget: node.LeftHandSideExpression as ParseNode.LeftHandSideExpression, // NOTE: unsound cast
        Initializer: node.AssignmentExpression,
      } satisfies ParseNode.AssignmentElement;
    case 'Elision':
      return node;
    default:
      throw new OutOfRange('refineLeftHandSideExpression', node.type);
  }
}

/** https://tc39.es/ecma262/#sec-assignment-operators-runtime-semantics-evaluation */
//   AssignmentExpression :
//     LeftHandSideExpression `=` AssignmentExpression
//     LeftHandSideExpression AssignmentOperator AssignmentExpression
//     LeftHandSideExpression `&&=` AssignmentExpression
//     LeftHandSideExpression `||=` AssignmentExpression
//     LeftHandSideExpression `??=` AssignmentExpression
export function* Evaluate_AssignmentExpression({
  LeftHandSideExpression, AssignmentOperator, AssignmentExpression,
}: ParseNode.AssignmentExpression): ExpressionEvaluator {
  if (AssignmentOperator === '=') {
    // 1. If LeftHandSideExpression is neither an ObjectLiteral nor an ArrayLiteral, then
    if (LeftHandSideExpression.type !== 'ObjectLiteral' && LeftHandSideExpression.type !== 'ArrayLiteral') {
      // a. Let lref be ? Evaluation of LeftHandSideExpression.
      const lref = Q(yield* Evaluation(LeftHandSideExpression));
      // b. If IsAnonymousFunctionDefinition(AssignmentExpression) and IsIdentifierRef of LeftHandSideExpression are both true, then
      let rval: Value;
      if (IsAnonymousFunctionDefinition(AssignmentExpression) && IsIdentifierRef(LeftHandSideExpression)) {
        // i. Let rval be NamedEvaluation of AssignmentExpression with argument GetReferencedName(lref).
        rval = Q(yield* NamedEvaluation(AssignmentExpression, (lref as ReferenceRecord).ReferencedName)); // NOTE: unsound cast
      } else { // d. Else,
        // i. Let rref be ? Evaluation of AssignmentExpression.
        const rref = Q(yield* Evaluation(AssignmentExpression));
        // ii. Let rval be ? GetValue(rref).
        rval = Q(GetValue(rref));
      }
      // e. Perform ? PutValue(lref, rval).
      Q(PutValue(lref, rval));
      // f. Return rval.
      return C(rval);
    }
    // 2. Let assignmentPattern be the AssignmentPattern that is covered by LeftHandSideExpression.
    const assignmentPattern = refineLeftHandSideExpression(LeftHandSideExpression);
    // 3. Let rref be ? Evaluation of AssignmentExpression.
    const rref = Q(yield* Evaluation(AssignmentExpression));
    // 3. Let rval be ? GetValue(rref).
    const rval = Q(GetValue(rref));
    // 4. Perform ? DestructuringAssignmentEvaluation of assignmentPattern using rval as the argument.
    Q(yield* DestructuringAssignmentEvaluation(assignmentPattern, rval));
    // 5. Return rval.
    return C(rval);
  } else if (AssignmentOperator === '&&=') {
    // 1. Let lref be ? Evaluation of LeftHandSideExpression.
    const lref = Q(yield* Evaluation(LeftHandSideExpression));
    // 2. Let lval be ? GetValue(lref).
    const lval = Q(GetValue(lref));
    // 3. Let lbool be ! ToBoolean(lval).
    const lbool = X(ToBoolean(lval));
    // 4. If lbool is false, return lval.
    if (lbool === Value.false) {
      return C(lval);
    }
    let rval: Value;
    // 5. If IsAnonymousFunctionDefinition(AssignmentExpression) is true and IsIdentifierRef of LeftHandSideExpression is true, then
    if (IsAnonymousFunctionDefinition(AssignmentExpression) && IsIdentifierRef(LeftHandSideExpression)) {
      // a. Let rval be ? NamedEvaluation of AssignmentExpression with argument GetReferencedName(lref).
      rval = Q(yield* NamedEvaluation(AssignmentExpression, (lref as ReferenceRecord).ReferencedName)); // NOTE: unsound cast
    } else { // 6. Else,
      // a. Let rref be ? Evaluation of AssignmentExpression.
      const rref = Q(yield* Evaluation(AssignmentExpression));
      // b. Let rval be ? GetValue(rref).
      rval = Q(GetValue(rref));
    }
    // 7. Perform ? PutValue(lref, rval).
    Q(PutValue(lref, rval));
    // 8. Return rval.
    return C(rval);
  } else if (AssignmentOperator === '||=') {
    // 1. Let lref be ? Evaluation of LeftHandSideExpression.
    const lref = Q(yield* Evaluation(LeftHandSideExpression));
    // 2. Let lval be ? GetValue(lref).
    const lval = Q(GetValue(lref));
    // 3. Let lbool be ! ToBoolean(lval).
    const lbool = X(ToBoolean(lval));
    // 4. If lbool is true, return lval.
    if (lbool === Value.true) {
      return C(lval);
    }
    let rval: Value;
    // 5. If IsAnonymousFunctionDefinition(AssignmentExpression) is true and IsIdentifierRef of LeftHandSideExpression is true, then
    if (IsAnonymousFunctionDefinition(AssignmentExpression) && IsIdentifierRef(LeftHandSideExpression)) {
      // a. Let rval be ? NamedEvaluation of AssignmentExpression with argument GetReferencedName(lref).
      rval = Q(yield* NamedEvaluation(AssignmentExpression, (lref as ReferenceRecord).ReferencedName)); // NOTE: unsound cast
    } else { // 6. Else,
      // a. Let rref be ? Evaluation of AssignmentExpression.
      const rref = Q(yield* Evaluation(AssignmentExpression));
      // b. Let rval be ? GetValue(rref).
      rval = Q(GetValue(rref));
    }
    // 7. Perform ? PutValue(lref, rval).
    Q(PutValue(lref, rval));
    // 8. Return rval.
    return C(rval);
  } else if (AssignmentOperator === '??=') {
    // 1.Let lref be ? Evaluation of LeftHandSideExpression.
    const lref = Q(yield* Evaluation(LeftHandSideExpression));
    // 2. Let lval be ? GetValue(lref).
    const lval = Q(GetValue(lref));
    // 3. If lval is not undefined nor null, return lval.
    if (lval !== Value.undefined && lval !== Value.null) {
      return C(lval);
    }
    let rval: Value;
    // 4. If IsAnonymousFunctionDefinition(AssignmentExpression) is true and IsIdentifierRef of LeftHandSideExpression is true, then
    if (IsAnonymousFunctionDefinition(AssignmentExpression) && IsIdentifierRef(LeftHandSideExpression)) {
      // a. Let rval be ? NamedEvaluation of AssignmentExpression with argument GetReferencedName(lref).
      rval = Q(yield* NamedEvaluation(AssignmentExpression, (lref as ReferenceRecord).ReferencedName)); // NOTE: unsound cast
    } else { // 5. Else,
      // a. Let rref be ? Evaluation of AssignmentExpression.
      const rref = Q(yield* Evaluation(AssignmentExpression));
      // b. Let rval be ? GetValue(rref).
      rval = Q(GetValue(rref));
    }
    // 6. Perform ? PutValue(lref, rval).
    Q(PutValue(lref, rval));
    // 7. Return rval.
    return C(rval);
  } else {
    // 1. Let lref be ? Evaluation of LeftHandSideExpression.
    const lref = Q(yield* Evaluation(LeftHandSideExpression));
    // 2. Let lval be ? GetValue(lref).
    const lval = Q(GetValue(lref));
    // 3. Let rref be ? Evaluation of AssignmentExpression.
    const rref = Q(yield* Evaluation(AssignmentExpression));
    // 4. Let rval be ? GetValue(rref).
    const rval = Q(GetValue(rref));
    // 5. Let assignmentOpText be the source text matched by AssignmentOperator.
    const assignmentOpText = AssignmentOperator;
    // 6. Let opText be the sequence of Unicode code points associated with assignmentOpText in the following table:
    const opText = ({
      '**=': '**',
      '*=': '*',
      '/=': '/',
      '%=': '%',
      '+=': '+',
      '-=': '-',
      '<<=': '<<',
      '>>=': '>>',
      '>>>=': '>>>',
      '&=': '&',
      '^=': '^',
      '|=': '|',
    } as const)[assignmentOpText];
    // 7. Let r be ? ApplyStringOrNumericBinaryOperator(lval, opText, rval).
    const r = Q(ApplyStringOrNumericBinaryOperator(lval, opText, rval));
    // 8. Perform ? PutValue(lref, r).
    Q(PutValue(lref, r));
    // 9. Return r.
    return C(r);
  }
}
