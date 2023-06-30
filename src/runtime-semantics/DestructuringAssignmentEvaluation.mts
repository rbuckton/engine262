import { surroundingAgent } from '../engine.mjs';
import { Value, type PropertyKeyValue, ReferenceRecord } from '../value.mjs';
import {
  ArrayCreate,
  CopyDataProperties,
  CreateDataPropertyOrThrow,
  GetIterator,
  GetV,
  GetValue,
  IteratorClose,
  IteratorStep,
  IteratorValue,
  OrdinaryObjectCreate,
  PutValue,
  ResolveBinding,
  RequireObjectCoercible,
  ToString,
  F,
  type IteratorRecord,
  Assert,
} from '../abstract-ops/all.mjs';
import {
  IsAnonymousFunctionDefinition,
  IsIdentifierRef,
  StringValue,
} from '../static-semantics/all.mjs';
import { Evaluation, type ListOrThrowEvaluator, type UnusedOrThrowEvaluator } from '../evaluator.mjs';
import {
  Q, X, C,
  Completion,
  AbruptCompletion,
  ReturnIfAbrupt,
  EnsureCompletion,
  unused,
} from '../completion.mjs';
import { isArray, OutOfRange } from '../helpers.mjs';
import {
  Evaluate_PropertyName,
  NamedEvaluation,
  refineLeftHandSideExpression,
} from './all.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

// ObjectAssignmentPattern :
//  `{` `}`
//  `{` AssignmentPropertyList `}`
//  `{` AssignmentPropertyList `,` `}`
//  `{` AssignmentPropertyList `,` AssignmentRestProperty? `}`
function* DestructuringAssignmentEvaluation_ObjectAssignmentPattern({ AssignmentPropertyList, AssignmentRestProperty }: ParseNode.ObjectAssignmentPattern, value: Value): UnusedOrThrowEvaluator {
  // 1. Perform ? RequireObjectCoercible(value).
  Q(RequireObjectCoercible(value));
  // 2. Perform ? PropertyDestructuringAssignmentEvaluation for AssignmentPropertyList using value as the argument.
  const excludedNames = Q(yield* PropertyDestructuringAssignmentEvaluation(AssignmentPropertyList, value));
  if (AssignmentRestProperty) {
    Q(yield* RestDestructuringAssignmentEvaluation(AssignmentRestProperty, value, excludedNames));
  }
  // 3. Return unused.
  return unused;
}

/** https://tc39.es/ecma262/#sec-runtime-semantics-restdestructuringassignmentevaluation */
// AssignmentRestProperty : `...` DestructuringAssignmentTarget
function* RestDestructuringAssignmentEvaluation({ DestructuringAssignmentTarget }: ParseNode.AssignmentRestProperty, value: Value, excludedNames: readonly PropertyKeyValue[]): UnusedOrThrowEvaluator {
  // 1. Let lref be ? Evaluation of DestructuringAssignmentTarget.
  const lref = Q(yield* Evaluation(DestructuringAssignmentTarget));
  // 2. Let restObj be OrdinaryObjectCreate(%Object.prototype%).
  const restObj = OrdinaryObjectCreate(surroundingAgent.intrinsic('%Object.prototype%'));
  // 4. Perform ? CopyDataProperties(restObj, value, excludedNames).
  Q(CopyDataProperties(restObj, value, excludedNames));
  // 5. Return PutValue(lref, restObj).
  return C(Q(PutValue(lref, restObj)));
}

function* PropertyDestructuringAssignmentEvaluation(AssignmentPropertyList: ParseNode.AssignmentPropertyList, value: Value): ListOrThrowEvaluator<readonly PropertyKeyValue[]> {
  const propertyNames: PropertyKeyValue[] = [];
  for (const AssignmentProperty of AssignmentPropertyList) {
    if (AssignmentProperty.IdentifierReference) {
      // 1. Let P be StringValue of IdentifierReference.
      const P = StringValue(AssignmentProperty.IdentifierReference);
      // 2. Let lref be ? ResolveBinding(P).
      const lref = Q(ResolveBinding(P, undefined, AssignmentProperty.IdentifierReference.strict));
      // 3. Let v be ? GetV(value, P).
      let v = Q(GetV(value, P));
      // 4. If Initializer? is present and v is undefined, then
      if (AssignmentProperty.Initializer && v === Value.undefined) {
        // a. If IsAnonymousFunctionDefinition(Initializer) is true, then
        if (IsAnonymousFunctionDefinition(AssignmentProperty.Initializer)) {
          // i. Set v to ? NamedEvaluation for Initializer with argument P.
          v = Q(yield* NamedEvaluation(AssignmentProperty.Initializer, P));
        } else { // b. Else,
          // i. Let defaultValue be ? Evaluation of Initializer.
          const defaultValue = Q(yield* Evaluation(AssignmentProperty.Initializer));
          // ii. Set v to ? GetValue(defaultValue)
          v = Q(GetValue(defaultValue));
        }
      }
      // 5. Perform ? PutValue(lref, v).
      Q(PutValue(lref, v));
      // 6. Return a new List containing P.
      propertyNames.push(P);
    } else {
      // 1. Let name be ? Evaluation of PropertyName.
      const name = Q(yield* Evaluate_PropertyName(AssignmentProperty.PropertyName));
      // 2. Perform ? KeyedDestructuringAssignmentEvaluation of AssignmentElement with value and name as the arguments.
      Q(yield* KeyedDestructuringAssignmentEvaluation(AssignmentProperty.AssignmentElement!, value, name)); // NOTE: unsound non-null assertion
      // 3. Return a new List containing name.
      propertyNames.push(name);
    }
  }
  return C(propertyNames);
}

// AssignmentElement : DestructuringAssignmentTarget Initializer?
function* KeyedDestructuringAssignmentEvaluation({
  DestructuringAssignmentTarget,
  Initializer,
}: ParseNode.AssignmentElement, value: Value, propertyName: PropertyKeyValue) {
  // 1. If DestructuringAssignmentTarget is neither an ObjectLiteral nor an ArrayLiteral, then
  let lref;
  if (DestructuringAssignmentTarget.type !== 'ObjectLiteral'
      && DestructuringAssignmentTarget.type !== 'ArrayLiteral') {
    // a. Let lref be ? Evaluation of DestructuringAssignmentTarget.
    lref = Q(yield* Evaluation(DestructuringAssignmentTarget));
  }
  // 2. Let v be ? GetV(value, propertyName).
  const v = Q(GetV(value, propertyName));
  // 3. If Initializer is present and v is undefined, then
  let rhsValue;
  if (Initializer && v === Value.undefined) {
    // a. If IsAnonymousFunctionDefinition(Initializer) and IsIdentifierRef of DestructuringAssignmentTarget are both true, then
    if (IsAnonymousFunctionDefinition(Initializer) && IsIdentifierRef(DestructuringAssignmentTarget)) {
      // i. Let rhsValue be ? NamedEvaluation of Initializer with argument GetReferencedName(lref).
      rhsValue = Q(yield* NamedEvaluation(Initializer, (lref as ReferenceRecord).ReferencedName)); // NOTE: unsound cast
    } else {
      // i. Let defaultValue be ? Evaluation of Initializer.
      const defaultValue = Q(yield* Evaluation(Initializer));
      // ii. Let rhsValue be ? GetValue(defaultValue).
      rhsValue = Q(GetValue(defaultValue));
    }
  } else { // 4. Else, let rhsValue be v.
    rhsValue = v;
  }
  // 5. If DestructuringAssignmentTarget is an ObjectLiteral or an ArrayLiteral, then
  if (DestructuringAssignmentTarget.type === 'ObjectLiteral'
      || DestructuringAssignmentTarget.type === 'ArrayLiteral') {
    // a. Let assignmentPattern be the AssignmentPattern that is covered by DestructuringAssignmentTarget.
    const assignmentPattern = refineLeftHandSideExpression(DestructuringAssignmentTarget);
    // b. Return the result of performing ? DestructuringAssignmentEvaluation of assignmentPattern with rhsValue as the argument.
    return C(Q(yield* DestructuringAssignmentEvaluation(assignmentPattern, rhsValue)));
  }
  Assert(lref !== undefined); // NOTE: Necessary for TypeScript to understand the consequence of steps 1 and 5, above.
  // 6. Return ? PutValue(lref, rhsValue).
  return Q(PutValue(lref, rhsValue));
}

// ArrayAssignmentPattern :
//   `[` `]`
//   `[` AssignmentElementList `]`
//   `[` AssignmentElementList `,` AssignmentRestElement? `]`
function* DestructuringAssignmentEvaluation_ArrayAssignmentPattern({ AssignmentElementList, AssignmentRestElement }: ParseNode.ArrayAssignmentPattern, value: Value): UnusedOrThrowEvaluator {
  // 1. Let iteratorRecord be ? GetIterator(value).
  const iteratorRecord = Q(GetIterator(value));
  // 2. Let status be IteratorDestructuringAssignmentEvaluation of AssignmentElementList with argument iteratorRecord.
  let status = Completion(yield* IteratorDestructuringAssignmentEvaluation(AssignmentElementList, iteratorRecord));
  // 3. If status is an abrupt completion, then
  if (status instanceof AbruptCompletion) {
    // a. If iteratorRecord.[[Done]] is false, return ? IteratorClose(iteratorRecord, status).
    if (iteratorRecord.Done === Value.false) {
      return Q(IteratorClose(iteratorRecord, status));
    }
    // b. Return Completion(status).
    return Completion(status);
  }
  // 4. If Elision is present, then
  // ...
  // 5. If AssignmentRestElement is present, then
  if (AssignmentRestElement) {
    // a. Set status to the result of performing IteratorDestructuringAssignmentEvaluation of AssignmentRestElement with iteratorRecord as the argument.
    status = EnsureCompletion(yield* IteratorDestructuringAssignmentEvaluation(AssignmentRestElement, iteratorRecord));
  }
  // 6. If iteratorRecord.[[Done]] is false, return ? IteratorClose(iteratorRecord, status).
  if (iteratorRecord.Done === Value.false) {
    return Q(IteratorClose(iteratorRecord, status));
  }
  return Completion(status);
}

function* IteratorDestructuringAssignmentEvaluation(node: ParseNode.AssignmentElementList | ParseNode.AssignmentRestElement | ParseNode.AssignmentElisionElement, iteratorRecord: IteratorRecord): UnusedOrThrowEvaluator {
  if (isArray(node)) {
    for (const n of node) {
      Q(yield* IteratorDestructuringAssignmentEvaluation(n, iteratorRecord));
    }
    return unused;
  }
  switch (node.type) {
    case 'Elision':
      // 1. If iteratorRecord.[[Done]] is false, then
      if (iteratorRecord.Done === Value.false) {
        // a. Let next be IteratorStep(iteratorRecord).
        let next; // NOTE: Isolated declaration necessary for TypeScript so as to not narrow the type of `next`.
        next = Completion(IteratorStep(iteratorRecord));
        // b. If next is an abrupt completion, set iteratorRecord.[[Done]] to true.
        if (next instanceof AbruptCompletion) {
          iteratorRecord.Done = Value.true;
        }
        // c. ReturnIfAbrupt(next)
        ReturnIfAbrupt(next);
        next = X(next); // NOTE: Necessary for TypeScript to observe the behavior of `ReturnIfAbrupt`.
        // d. If next is false, set iteratorRecord.[[Done]] to true.
        if (next === Value.false) {
          iteratorRecord.Done = Value.true;
        }
      }
      // 2. Return unused.
      return unused;
    case 'AssignmentElement': {
      const { DestructuringAssignmentTarget, Initializer } = node;
      let lref;
      // 1. If DestructuringAssignmentTarget is neither an ObjectLiteral nor an ArrayLiteral, then
      if (DestructuringAssignmentTarget.type !== 'ObjectLiteral'
          && DestructuringAssignmentTarget.type !== 'ArrayLiteral') {
        // a. Let lref be ? Evaluation of DestructuringAssignmentTarget.
        lref = Q(yield* Evaluation(DestructuringAssignmentTarget));
      }
      let value;
      // 2. If iteratorRecord.[[Done]] is false, then
      if (iteratorRecord.Done === Value.false) {
        // a. Let next be Completion(IteratorStep(iteratorRecord)).
        let next; // NOTE: Isolated declaration necessary for TypeScript so as to not narrow the type of `next`.
        next = Completion(IteratorStep(iteratorRecord));
        // b. If next is an abrupt completion, set iteratorRecord.[[Done]] to true.
        if (next instanceof AbruptCompletion) {
          iteratorRecord.Done = Value.true;
        }
        // c. ReturnIfAbrupt(next);
        ReturnIfAbrupt(next);
        next = X(next); // NOTE: Necessary for TypeScript to observe the behavior of `ReturnIfAbrupt`.
        // d. If next is false, set iteratorRecord.[[Done]] to true.
        if (next === Value.false) {
          iteratorRecord.Done = Value.true;
        } else { // e. Else,
          // i. Let value be IteratorValue(next).
          value = Completion(IteratorValue(next));
          // ii. If value is an abrupt completion, set iteratorRecord.[[Done]] to true.
          if (value instanceof AbruptCompletion) {
            iteratorRecord.Done = Value.true;
          }
          // iii. ReturnIfAbrupt(value).
          ReturnIfAbrupt(value);
          value = X(value); // NOTE: Necessary for TypeScript to observe the behavior of `ReturnIfAbrupt`.
        }
      }
      // 3. If iteratorRecord.[[Done]] is true, let value be undefined.
      if (iteratorRecord.Done === Value.true) {
        value = Value.undefined;
      }
      Assert(value !== undefined); // NOTE: Necessary for TypeScript to understand the consequence of assignments to `value` above
      let v;
      // 4. If Initializer is present and value is undefined, then
      if (Initializer && value === Value.undefined) {
        // a. If IsAnonymousFunctionDefinition(AssignmentExpression) is true and IsIdentifierRef of LeftHandSideExpression is true, then
        if (IsAnonymousFunctionDefinition(Initializer) && IsIdentifierRef(DestructuringAssignmentTarget)) {
          // i. Let v be ? NamedEvaluation of Initializer with argument GetReferencedName(lref).
          v = Q(yield* NamedEvaluation(Initializer, (lref as ReferenceRecord).ReferencedName)); // NOTE: unsound cast
        } else { // b. Else,
          // i. Let defaultValue be ? Evaluation of Initializer.
          const defaultValue = Q(yield* Evaluation(Initializer));
          // ii. Let v be ? GetValue(defaultValue).
          v = Q(GetValue(defaultValue));
        }
      } else { // 5. Else, let v be value.
        v = value;
      }
      // 6. If DestructuringAssignmentTarget is an ObjectLiteral or an ArrayLiteral, then
      if (DestructuringAssignmentTarget.type === 'ObjectLiteral'
          || DestructuringAssignmentTarget.type === 'ArrayLiteral') {
        // a. Let nestedAssignmentPattern be the AssignmentPattern that is covered by DestructuringAssignmentTarget.
        const nestedAssignmentPattern = refineLeftHandSideExpression(DestructuringAssignmentTarget);
        // b. Return ? DestructuringAssignmentEvaluation of nestedAssignmentPattern with argument v.
        return C(Q(yield* DestructuringAssignmentEvaluation(nestedAssignmentPattern, v)));
      }
      Assert(lref !== undefined); // NOTE: Necessary for TypeScript to understand the consequence of steps 1 and 6, above.
      // 7. Return ? PutValue(lref, v).
      return C(Q(PutValue(lref, v)));
    }
    case 'AssignmentRestElement': {
      const { DestructuringAssignmentTarget } = node;
      let lref;
      // 1. If DestructuringAssignmentTarget is neither an ObjectLiteral nor an ArrayLiteral, then
      if (DestructuringAssignmentTarget.type !== 'ObjectLiteral'
          && DestructuringAssignmentTarget.type !== 'ArrayLiteral') {
        lref = Q(yield* Evaluation(DestructuringAssignmentTarget));
      }
      // 2. Let A be ! ArrayCreate(0).
      const A = X(ArrayCreate(0));
      // 3. Let n be 0.
      let n = 0;
      // 4. Repeat, while iteratorRecord.[[Done]] is false,
      while (iteratorRecord.Done === Value.false) {
        // a. Let next be IteratorStep(iteratorRecord).
        let next; // NOTE: Isolated declaration necessary for TypeScript so as to not narrow the type of `next`.
        next = Completion(IteratorStep(iteratorRecord));
        // b. If next is an abrupt completion, set iteratorRecord.[[Done]] to true.
        if (next instanceof AbruptCompletion) {
          iteratorRecord.Done = Value.true;
        }
        // c. ReturnIfAbrupt(next);
        ReturnIfAbrupt(next);
        next = X(next); // NOTE: Necessary for TypeScript to understand the consequence of ReturnIfAbrupt, above.
        // d. If next is false, set iteratorRecord.[[Done]] to true.
        if (next === Value.false) {
          iteratorRecord.Done = Value.true;
        } else { // e. Else,
          // i. Let nextValue be IteratorValue(next).
          const nextValue = Q(IteratorValue(next));
          // ii. If nextValue is an abrupt completion, set iteratorRecord.[[Done]] to true.
          if (nextValue instanceof AbruptCompletion) {
            iteratorRecord.Done = Value.true;
          }
          // iii. ReturnIfAbrupt(nextValue).
          ReturnIfAbrupt(nextValue);
          // iv. Perform ! CreateDataPropertyOrThrow(A, ! ToString(𝔽(n)), nextValue).
          X(CreateDataPropertyOrThrow(A, X(ToString(F(n))), nextValue));
          // v. Set n to n + 1.
          n += 1;
        }
      }
      // 5. If DestructuringAssignmentTarget is neither an ObjectLiteral nor an ArrayLiteral, then
      if (DestructuringAssignmentTarget.type !== 'ObjectLiteral'
          && DestructuringAssignmentTarget.type !== 'ArrayLiteral') {
        Assert(lref !== undefined); // NOTE: Necessary for TypeScript to understand the consequence of steps 1 and 5, above.
        return C(Q(PutValue(lref, A)));
      }
      // 6. Let nestedAssignmentPattern be the AssignmentPattern that is covered by DestructuringAssignmentTarget.
      const nestedAssignmentPattern = refineLeftHandSideExpression(DestructuringAssignmentTarget);
      // 7. Return the result of performing ? DestructuringAssignmentEvaluation of nestedAssignmentPattern with A as the argument.
      return C(Q(yield* DestructuringAssignmentEvaluation(nestedAssignmentPattern, A)));
    }
    default:
      throw new OutOfRange('IteratorDestructuringAssignmentEvaluation', node);
  }
}

export function DestructuringAssignmentEvaluation(node: ParseNode.AssignmentPattern, value: Value): UnusedOrThrowEvaluator {
  switch (node.type) {
    case 'ObjectAssignmentPattern':
      return DestructuringAssignmentEvaluation_ObjectAssignmentPattern(node, value);
    case 'ArrayAssignmentPattern':
      return DestructuringAssignmentEvaluation_ArrayAssignmentPattern(node, value);
    default:
      throw new OutOfRange('DestructuringAssignmentEvaluation', node);
  }
}
