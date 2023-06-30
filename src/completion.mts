import { type GCMarker, surroundingAgent } from './engine.mjs';
import {
  Assert,
  CreateBuiltinFunction,
  PerformPromiseThen,
  PromiseCapabilityRecord,
  PromiseResolve,
  type NativeFunctionSteps,
} from './abstract-ops/all.mjs';
import { BooleanValue, ReferenceRecord, Value, type StringValue } from './value.mjs';
import { kAsyncContext, resume } from './helpers.mjs';
import type { ExpressionEvaluator } from './evaluator.mjs';
import { Q, C } from './completion.mjs';

export type CompletionType = 'break' | 'continue' | 'return' | 'throw' | 'normal';

/** https://tc39.es/ecma262/#sec-completion-record-specification-type */
export type Completion<T = unknown> =
  | NormalCompletion<T>
  | AbruptCompletion<T>;

/** https://tc39.es/ecma262/#sec-completion-record-specification-type */
export interface NormalCompletion<T> {
  readonly Type: 'normal';
  readonly Value: T;
  readonly Target: undefined;
}

/** https://tc39.es/ecma262/#sec-completion-record-specification-type */
export interface ThrowCompletion {
  readonly Type: 'throw';
  readonly Value: Value;
  readonly Target: undefined;
}

/** https://tc39.es/ecma262/#sec-completion-record-specification-type */
export interface ReturnCompletion {
  readonly Type: 'return';
  readonly Value: Value;
  readonly Target: undefined;
}

/** https://tc39.es/ecma262/#sec-completion-record-specification-type */
export interface BreakCompletion<T> {
  readonly Type: 'break';
  readonly Value: T;
  readonly Target: StringValue | undefined;
}

/** https://tc39.es/ecma262/#sec-completion-record-specification-type */
export interface ContinueCompletion<T> {
  readonly Type: 'continue';
  readonly Value: T;
  readonly Target: StringValue | undefined;
}

export type AbruptCompletion<T = unknown> =
  | ThrowCompletion
  | ReturnCompletion
  | BreakCompletion<T>
  | ContinueCompletion<T>;

class CompletionImpl<const T> {
  readonly Type: CompletionType;
  readonly Value: T;
  readonly Target: StringValue | undefined;

  constructor({
    Type,
    Value,
    Target,
  }: Pick<CompletionImpl<T>, 'Type' | 'Value' | 'Target'>) {
    this.Type = Type;
    this.Value = Value;
    this.Target = Target;
  }

  // NON-SPEC
  mark(m: GCMarker) {
    m(this.Value);
  }

  static { Object.defineProperty(this, 'name', { value: 'Completion' }); }
}

abstract class NormalCompletionImpl<const T> extends CompletionImpl<T> {
  declare readonly Type: NormalCompletion<T>['Type'];
  declare readonly Value: NormalCompletion<T>['Value'];
  declare readonly Target: NormalCompletion<T>['Target'];
  private constructor(completion: Pick<CompletionImpl<T>, 'Type' | 'Value' | 'Target'>) {
    super(completion);
  }
  static [Symbol.hasInstance](value: unknown): value is NormalCompletion<unknown> {
    return value instanceof CompletionImpl && value.Type === 'normal';
  }
  static { Object.defineProperty(this, 'name', { value: 'NormalCompletion' }); }
}

abstract class AbruptCompletionImpl extends CompletionImpl<unknown> {
  declare readonly Type: AbruptCompletion['Type'];
  declare readonly Value: AbruptCompletion['Value'];
  declare readonly Target: AbruptCompletion['Target'];
  protected constructor(completion: never) {
    throw new TypeError('Cannot create instance of abstract class.');
    super(completion);
  }
  static [Symbol.hasInstance](value: unknown): value is AbruptCompletion {
    return value instanceof CompletionImpl && value.Type !== 'normal';
  }
  static { Object.defineProperty(this, 'name', { value: 'AbruptCompletion' }); }
}

interface CompletionStatic {
  new <const T>(completion: { Type: 'normal', Value: T, Target: undefined }): NormalCompletion<T>;
  new (completion: { Type: 'throw', Value: Value, Target: undefined }): ThrowCompletion;
  new (completion: { Type: 'return', Value: Value, Target: undefined }): ReturnCompletion;
  new <const T>(completion: { Type: 'break', Value: T, Target: StringValue | undefined }): BreakCompletion<T>;
  new <const T>(completion: { Type: 'continue', Value: T, Target: StringValue | undefined }): ContinueCompletion<T>;
  <T extends Completion<unknown>>(completionRecord: T): T;
}

interface NormalCompletionStatic {
  new <T>(...args: never): NormalCompletion<T>;
  <const T>(argument: T): NormalCompletion<T>;
  [Symbol.hasInstance](value: unknown): value is NormalCompletion<unknown>;
}

interface AbruptCompletionStatic {
  new (...args: never): AbruptCompletion<unknown>;
  (...args: never): never;
  [Symbol.hasInstance](value: unknown): value is AbruptCompletion<unknown>;
}

/** https://tc39.es/ecma262/#sec-completion-ao */
export const Completion = function (completionRecord: Completion) {
  if (new.target) {
    return new CompletionImpl(completionRecord);
  }

  // 1. Assert: completionRecord is a Completion Record.
  Assert(completionRecord instanceof CompletionImpl);
  // 2. Return completionRecord as the Completion Record of this abstract operation.
  return completionRecord;
} as CompletionStatic;

/** https://tc39.es/ecma262/#sec-normalcompletion */
export const NormalCompletion = function <const T>(argument: T) {
  if (new.target) {
    throw new TypeError('Cannot create instance of abstract class.');
  }

  // 1. Return Completion { [[Type]]: normal, [[Value]]: argument, [[Target]]: empty }.
  return new Completion({ Type: 'normal', Value: argument, Target: undefined }) as NormalCompletion<T>;
} as NormalCompletionStatic;

export const AbruptCompletion = function () {
  if (new.target) {
    throw new TypeError('Cannot create instance of abstract class.');
  }

  throw new TypeError('Call not supported');
} as AbruptCompletionStatic;

Object.defineProperties(Completion, Object.getOwnPropertyDescriptors(CompletionImpl));
Object.defineProperties(NormalCompletion, Object.getOwnPropertyDescriptors(NormalCompletionImpl));
Object.defineProperties(AbruptCompletion, Object.getOwnPropertyDescriptors(AbruptCompletionImpl));

/** https://tc39.es/ecma262/#sec-throwcompletion */
export function ThrowCompletion(value: Value) {
  // 1. Return Completion { [[Type]]: throw, [[Value]]: value, [[Target]]: empty }.
  return new Completion({ Type: 'throw', Value: value, Target: undefined });
}

export type UpdateEmpty<T extends Completion<unknown>, U> =
  T extends NormalCompletion<infer V> ? NormalCompletion<V extends undefined ? U : V> :
  T extends BreakCompletion<infer V> ? BreakCompletion<V extends undefined ? U : V> :
  T extends ContinueCompletion<infer V> ? ContinueCompletion<V extends undefined ? U : V> :
  T extends AbruptCompletion ? T :
  T extends ReturnCompletion ? T :
  never;

/** https://tc39.es/ecma262/#sec-updateempty */
export function UpdateEmpty<C extends Completion, const T>(completionRecord: C, value: T): UpdateEmpty<C, T>;
export function UpdateEmpty<C extends Completion, const T>(completionRecord: C, value: T) {
  // 1. Assert: If completionRecord.[[Type]] is either return or throw, then completionRecord.[[Value]] is not empty.
  Assert(!(completionRecord.Type === 'return' || completionRecord.Type === 'throw') || completionRecord.Value !== undefined);
  // 2. If completionRecord.[[Value]] is not empty, return Completion(completionRecord).
  if (completionRecord.Value !== undefined) {
    return Completion(completionRecord);
  }
  // 3. Return Completion { [[Type]]: completionRecord.[[Type]], [[Value]]: value, [[Target]]: completionRecord.[[Target]] }.
  return new CompletionImpl({ Type: completionRecord.Type, Value: value, Target: completionRecord.Target }) as Completion<T>;
}

export type ReturnIfAbrupt<T> =
  T extends NormalCompletion<infer V> ? V :
  T extends AbruptCompletion ? never :
  T;

/**
 * https://tc39.es/ecma262/#sec-returnifabrupt
 * https://tc39.es/ecma262/#sec-returnifabrupt-shorthands ? OperationName()
 */
export function ReturnIfAbrupt<const T>(_completion: T): ReturnIfAbrupt<T> {
  /* c8 skip next */
  throw new TypeError('ReturnIfAbrupt requires build');
}

export { ReturnIfAbrupt as Q };

/** https://tc39.es/ecma262/#sec-returnifabrupt-shorthands ! OperationName() */
export function X<const T>(_completion: T): ReturnIfAbrupt<T> {
  /* c8 skip next */
  throw new TypeError('X() requires build');
}

/** https://tc39.es/ecma262/#sec-ifabruptcloseiterator */
// TODO(TS):
export function IfAbruptCloseIterator(_value: Completion, _iteratorRecord: unknown) {
  /* c8 skip next */
  throw new TypeError('IfAbruptCloseIterator() requires build');
}

/** https://tc39.es/ecma262/#sec-ifabruptrejectpromise */
export function IfAbruptRejectPromise(_value: Completion, _capability: PromiseCapabilityRecord): void {
  /* c8 skip next */
  throw new TypeError('IfAbruptRejectPromise requires build');
}

export type EnsureCompletion<T> = EnsureCompletionWorker<T, T>;

// Distribute over `T`s that are `Completion`s, but don't distribute over `T`s that aren't `Completion`s
type EnsureCompletionWorker<T, _T> = T extends Completion ? T : NormalCompletion<Exclude<_T, Completion>>;

/** https://tc39.es/ecma262/#sec-implicit-normal-completion */
export function EnsureCompletion<const T>(val: T): EnsureCompletion<T>;
export function EnsureCompletion<T>(val: T) {
  if (val instanceof Completion) {
    return val;
  }
  if (val === 'unused') {
    return unused;
  }
  return NormalCompletion(val);
}

export { EnsureCompletion as C };

/** https://tc39.es/ecma262/#await */
export function* Await(value: Value): ExpressionEvaluator {
  // 1. Let asyncContext be the running execution context.
  const asyncContext = surroundingAgent.runningExecutionContext;
  // 2. Let promise be ? PromiseResolve(%Promise%, value).
  const promise = Q(PromiseResolve(surroundingAgent.intrinsic('%Promise%'), value));
  // 3. Let fulfilledClosure be a new Abstract Closure with parameters (v) that captures asyncContext and performs the following steps when called:
  const fulfilledClosure: NativeFunctionSteps = ([v = Value.undefined]) => {
    // a. Let prevContext be the running execution context.
    const prevContext = surroundingAgent.runningExecutionContext;
    // b. Suspend prevContext.
    // c. Push asyncContext onto the execution context stack; asyncContext is now the running execution context.
    surroundingAgent.executionContextStack.push(asyncContext);
    // d. Resume the suspended evaluation of asyncContext using NormalCompletion(v) as the result of the operation that suspended it.
    resume(asyncContext, NormalCompletion(v));
    // e. Assert: When we reach this step, asyncContext has already been removed from the execution context stack and prevContext is the currently running execution context.
    Assert(surroundingAgent.runningExecutionContext === prevContext);
    // f. Return undefined.
    return Value.undefined;
  };
  // 4. Let onFulfilled be ! CreateBuiltinFunction(fulfilledClosure, 1, "", « »).
  const onFulfilled = X(CreateBuiltinFunction(fulfilledClosure, 1, Value(''), []));
  onFulfilled[kAsyncContext] = asyncContext;
  // 5. Let rejectedClosure be a new Abstract Closure with parameters (reason) that captures asyncContext and performs the following steps when called:
  const rejectedClosure: NativeFunctionSteps = ([reason = Value.undefined]) => {
    // a. Let prevContext be the running execution context.
    const prevContext = surroundingAgent.runningExecutionContext;
    // b. Suspend prevContext.
    // c. Push asyncContext onto the execution context stack; asyncContext is now the running execution context.
    surroundingAgent.executionContextStack.push(asyncContext);
    // d. Resume the suspended evaluation of asyncContext using ThrowCompletion(reason) as the result of the operation that suspended it.
    resume(asyncContext, ThrowCompletion(reason));
    // e. Assert: When we reach this step, asyncContext has already been removed from the execution context stack and prevContext is the currently running execution context.
    Assert(surroundingAgent.runningExecutionContext === prevContext);
    // f. Return undefined.
    return Value.undefined;
  };
  // 6. Let onRejected be ! CreateBuiltinFunction(rejectedClosure, 1, "", « »).
  const onRejected = X(CreateBuiltinFunction(rejectedClosure, 1, Value(''), []));
  onRejected[kAsyncContext] = asyncContext;
  // 7. Perform ! PerformPromiseThen(promise, onFulfilled, onRejected).
  X(PerformPromiseThen(promise, onFulfilled, onRejected));
  // 8. Remove asyncContext from the execution context stack and restore the execution context that is at the top of the execution context stack as the running execution context.
  surroundingAgent.executionContextStack.pop(asyncContext);
  // 9. Let callerContext be the running execution context.
  // 10. Resume callerContext passing empty. If asyncContext is ever resumed again, let completion be the Completion Record with which it is resumed.
  const completion = yield C(undefined);
  // 11. Assert: If control reaches here, then asyncContext is the running execution context again
  Assert(completion !== 'Unwind');
  // 12. Return completion.
  return completion;
}

/**
 * A normal completion containing `unused`.
 *
 * NOTE: This is a shorthand for "Return `unused`." in algorithm steps that return completions.
 */
export const unused = NormalCompletion('unused');

/**
 * Either a normal completion containing a {@link T}, or a throw completion.
 */
export type NormalOrThrowCompletion<T> = NormalCompletion<T> | ThrowCompletion;

/**
 * Either a normal completion containing `unsued`, or a throw completion.
 */
export type UnusedOrThrowCompletion = NormalOrThrowCompletion<'unused'>;

/**
 * Either a normal completion containing an ECMAScript language value, or a throw completion.
 */
export type ValueOrThrowCompletion<T extends Value = Value> = NormalOrThrowCompletion<T>;

/**
 * Either a normal completion containing a Boolean, or a throw completion.
 */
export type BooleanOrThrowCompletion = NormalOrThrowCompletion<BooleanValue>;

/**
 * Either a normal completion containing a Reference Record, or a throw completion.
 */
export type ReferenceOrThrowCompletion = NormalOrThrowCompletion<ReferenceRecord>;

/**
 * Either a normal completion containing either an ECMAScript language value or a Reference Record, or a throw completion.
 */
export type ReferenceOrValueOrThrowCompletion<T extends Value = Value> = NormalOrThrowCompletion<ReferenceRecord | T>;

/**
 * Either a normal completion containing a List, or a throw completion.
 */
export type ListOrThrowCompletion<T extends readonly any[]> = NormalOrThrowCompletion<T>;

/**
 * Either a normal completion containing an ECMAScript Language Value, a throw completion, or a return completion.
 *
 * NOTE: This is often used in place of "either a normal completion containing an ECMAScript Language Value or an abrupt
 * completion" because Completions for expressions should not be able to `break` or `continue`.
 */
export type ExpressionCompletion<T extends Value = Value> = NormalCompletion<T> | ThrowCompletion | ReturnCompletion;

/**
 * Either a normal completion containing either an ECMAScript Language Value or `empty`, or an abrupt completion.
 *
 * NOTE: Many statements return `NormalCompletion(empty)`, which is later passed to `UpdateEmpty`.
 */
export type StatementCompletion<T extends Value = Value> = Completion<T | undefined>;
