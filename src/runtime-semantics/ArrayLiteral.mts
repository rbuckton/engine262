import { ObjectValue, Value } from '../value.mjs';
import {
  Set,
  ArrayCreate,
  GetValue,
  GetIterator,
  IteratorStep,
  IteratorValue,
  ToString,
  CreateDataPropertyOrThrow,
  F,
} from '../abstract-ops/all.mjs';
import { Evaluation, type ExpressionEvaluator } from '../evaluator.mjs';
import { ReturnIfAbrupt, Q, X, EnsureCompletion } from '../completion.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

/** https://tc39.es/ecma262/#sec-runtime-semantics-arrayaccumulation */
//  Elision :
//    `,`
//    Elision `,`
//  ElementList :
//    Elision? AssignmentExpression
//    Elision? SpreadElement
//    ElementList `,` Elision? AssignmentExpression
//    ElementList : ElementList `,` Elision SpreadElement
//  SpreadElement :
//    `...` AssignmentExpression
function* ArrayAccumulation(ElementList: ParseNode.ElementList, array: ObjectValue, nextIndex: number) {
  let postIndex = nextIndex;
  for (const element of ElementList) {
    switch (element.type) {
      case 'Elision':
        postIndex += 1;
        Q(Set(array, Value('length'), F(postIndex), Value.true));
        break;
      case 'SpreadElement':
        postIndex = Q(yield* ArrayAccumulation_SpreadElement(element, array, postIndex));
        break;
      default:
        postIndex = Q(yield* ArrayAccumulation_AssignmentExpression(element, array, postIndex));
        break;
    }
  }
  return postIndex;
}

// SpreadElement : `...` AssignmentExpression
function* ArrayAccumulation_SpreadElement({ AssignmentExpression }: ParseNode.SpreadElement, array: ObjectValue, nextIndex: number) {
  // 1. Let spreadRef be ? Evaluation of AssignmentExpression.
  const spreadRef = Q(yield* Evaluation(AssignmentExpression));
  // 2. Let spreadObj be ? GetValue(spreadRef).
  const spreadObj = Q(GetValue(spreadRef));
  // 3. Let iteratorRecord be ? GetIterator(spreadObj).
  const iteratorRecord = Q(GetIterator(spreadObj));
  // 4. Repeat,
  while (true) {
    // a. Let next be ? IteratorStep(iteratorRecord).
    const next = Q(IteratorStep(iteratorRecord));
    // b. If next is false, return nextIndex.
    if (next === Value.false) {
      return nextIndex;
    }
    // c. Let nextValue be ? IteratorValue(next).
    const nextValue = Q(IteratorValue(next));
    // d. Perform ! CreateDataPropertyOrThrow(array, ! ToString(𝔽(nextIndex)), nextValue).
    X(CreateDataPropertyOrThrow(array, X(ToString(F(nextIndex))), nextValue));
    // e. Set nextIndex to nextIndex + 1.
    nextIndex += 1;
  }
}


function* ArrayAccumulation_AssignmentExpression(AssignmentExpression: ParseNode.AssignmentExpressionOrHigher, array: ObjectValue, nextIndex: number) {
  // 2. Let initResult be ? Evaluation of AssignmentExpression.
  const initResult = Q(yield* Evaluation(AssignmentExpression));
  // 3. Let initValue be ? GetValue(initResult).
  const initValue = Q(GetValue(initResult));
  // 4. Let created be ! CreateDataPropertyOrThrow(array, ! ToString(𝔽(nextIndex)), initValue).
  X(CreateDataPropertyOrThrow(array, X(ToString(F(nextIndex))), initValue));
  // 5. Return nextIndex + 1.
  return nextIndex + 1;
}

/** https://tc39.es/ecma262/#sec-array-initializer-runtime-semantics-evaluation */
//  ArrayLiteral :
//    `[` Elision `]`
//    `[` ElementList `]`
//    `[` ElementList `,` Elision `]`
export function* Evaluate_ArrayLiteral({ ElementList }: ParseNode.ArrayLiteral): ExpressionEvaluator {
  // 1. Let array be ! ArrayCreate(0).
  const array = X(ArrayCreate(0));
  // 2. Let len be the result of performing ArrayAccumulation for ElementList with arguments array and 0.
  const len = yield* ArrayAccumulation(ElementList, array, 0);
  // 3. ReturnIfAbrupt(len).
  ReturnIfAbrupt(len);
  // 4. Return array.
  return EnsureCompletion(array);
}
