// @ts-nocheck
import {
  Descriptor,
  ObjectValue,
  Value,
} from '../value.mjs';
import { NewGlobalEnvironment } from '../environment.mjs';
import { Q, X } from '../completion.mjs';
import { bootstrapObjectPrototype } from '../intrinsics/ObjectPrototype.mjs';
import { bootstrapObject } from '../intrinsics/Object.mjs';
import { bootstrapArrayPrototype } from '../intrinsics/ArrayPrototype.mjs';
import { bootstrapArray } from '../intrinsics/Array.mjs';
import { bootstrapBigInt } from '../intrinsics/BigInt.mjs';
import { bootstrapBigIntPrototype } from '../intrinsics/BigIntPrototype.mjs';
import { bootstrapBooleanPrototype } from '../intrinsics/BooleanPrototype.mjs';
import { bootstrapBoolean } from '../intrinsics/Boolean.mjs';
import { bootstrapNumberPrototype } from '../intrinsics/NumberPrototype.mjs';
import { bootstrapNumber } from '../intrinsics/Number.mjs';
import { bootstrapFunctionPrototype } from '../intrinsics/FunctionPrototype.mjs';
import { bootstrapFunction } from '../intrinsics/Function.mjs';
import { bootstrapSymbolPrototype } from '../intrinsics/SymbolPrototype.mjs';
import { bootstrapSymbol } from '../intrinsics/Symbol.mjs';
import { bootstrapMath } from '../intrinsics/Math.mjs';
import { bootstrapDatePrototype } from '../intrinsics/DatePrototype.mjs';
import { bootstrapDate } from '../intrinsics/Date.mjs';
import { bootstrapRegExpPrototype } from '../intrinsics/RegExpPrototype.mjs';
import { bootstrapRegExp } from '../intrinsics/RegExp.mjs';
import { bootstrapPromisePrototype } from '../intrinsics/PromisePrototype.mjs';
import { bootstrapPromise } from '../intrinsics/Promise.mjs';
import { bootstrapProxy } from '../intrinsics/Proxy.mjs';
import { bootstrapReflect } from '../intrinsics/Reflect.mjs';
import { bootstrapStringPrototype } from '../intrinsics/StringPrototype.mjs';
import { bootstrapString } from '../intrinsics/String.mjs';
import { bootstrapErrorPrototype } from '../intrinsics/ErrorPrototype.mjs';
import { bootstrapError } from '../intrinsics/Error.mjs';
import { bootstrapNativeError } from '../intrinsics/NativeError.mjs';
import { bootstrapIteratorPrototype } from '../intrinsics/IteratorPrototype.mjs';
import { bootstrapAsyncIteratorPrototype } from '../intrinsics/AsyncIteratorPrototype.mjs';
import { bootstrapArrayIteratorPrototype } from '../intrinsics/ArrayIteratorPrototype.mjs';
import { bootstrapMapIteratorPrototype } from '../intrinsics/MapIteratorPrototype.mjs';
import { bootstrapSetIteratorPrototype } from '../intrinsics/SetIteratorPrototype.mjs';
import { bootstrapStringIteratorPrototype } from '../intrinsics/StringIteratorPrototype.mjs';
import { bootstrapRegExpStringIteratorPrototype } from '../intrinsics/RegExpStringIteratorPrototype.mjs';
import { bootstrapForInIteratorPrototype } from '../intrinsics/ForInIteratorPrototype.mjs';
import { bootstrapMapPrototype } from '../intrinsics/MapPrototype.mjs';
import { bootstrapMap } from '../intrinsics/Map.mjs';
import { bootstrapSetPrototype } from '../intrinsics/SetPrototype.mjs';
import { bootstrapSet } from '../intrinsics/Set.mjs';
import { bootstrapGeneratorFunctionPrototypePrototype } from '../intrinsics/GeneratorFunctionPrototypePrototype.mjs';
import { bootstrapGeneratorFunctionPrototype } from '../intrinsics/GeneratorFunctionPrototype.mjs';
import { bootstrapGeneratorFunction } from '../intrinsics/GeneratorFunction.mjs';
import { bootstrapAsyncFunctionPrototype } from '../intrinsics/AsyncFunctionPrototype.mjs';
import { bootstrapAsyncFunction } from '../intrinsics/AsyncFunction.mjs';
import { bootstrapAsyncGeneratorFunctionPrototypePrototype } from '../intrinsics/AsyncGeneratorFunctionPrototypePrototype.mjs';
import { bootstrapAsyncGeneratorFunctionPrototype } from '../intrinsics/AsyncGeneratorFunctionPrototype.mjs';
import { bootstrapAsyncGeneratorFunction } from '../intrinsics/AsyncGeneratorFunction.mjs';
import { bootstrapAsyncFromSyncIteratorPrototype } from '../intrinsics/AsyncFromSyncIteratorPrototype.mjs';
import { bootstrapArrayBuffer } from '../intrinsics/ArrayBuffer.mjs';
import { bootstrapArrayBufferPrototype } from '../intrinsics/ArrayBufferPrototype.mjs';
import { bootstrapJSON } from '../intrinsics/JSON.mjs';
import { bootstrapEval } from '../intrinsics/eval.mjs';
import { bootstrapIsFinite } from '../intrinsics/isFinite.mjs';
import { bootstrapIsNaN } from '../intrinsics/isNaN.mjs';
import { bootstrapParseFloat } from '../intrinsics/parseFloat.mjs';
import { bootstrapParseInt } from '../intrinsics/parseInt.mjs';
import { bootstrapURIHandling } from '../intrinsics/URIHandling.mjs';
import { bootstrapThrowTypeError } from '../intrinsics/ThrowTypeError.mjs';
import { bootstrapTypedArray } from '../intrinsics/TypedArray.mjs';
import { bootstrapTypedArrayPrototype } from '../intrinsics/TypedArrayPrototype.mjs';
import { bootstrapTypedArrayConstructors } from '../intrinsics/TypedArrayConstructors.mjs';
import { bootstrapTypedArrayPrototypes } from '../intrinsics/TypedArrayPrototypes.mjs';
import { bootstrapDataView } from '../intrinsics/DataView.mjs';
import { bootstrapDataViewPrototype } from '../intrinsics/DataViewPrototype.mjs';
import { bootstrapWeakMapPrototype } from '../intrinsics/WeakMapPrototype.mjs';
import { bootstrapWeakMap } from '../intrinsics/WeakMap.mjs';
import { bootstrapWeakSetPrototype } from '../intrinsics/WeakSetPrototype.mjs';
import { bootstrapWeakSet } from '../intrinsics/WeakSet.mjs';
import { bootstrapAggregateError } from '../intrinsics/AggregateError.mjs';
import { bootstrapAggregateErrorPrototype } from '../intrinsics/AggregateErrorPrototype.mjs';
import { bootstrapWeakRefPrototype } from '../intrinsics/WeakRefPrototype.mjs';
import { bootstrapWeakRef } from '../intrinsics/WeakRef.mjs';
import { bootstrapFinalizationRegistryPrototype } from '../intrinsics/FinalizationRegistryPrototype.mjs';
import { bootstrapFinalizationRegistry } from '../intrinsics/FinalizationRegistry.mjs';
import {
  Assert,
  DefinePropertyOrThrow,
  F as toNumberValue,
  OrdinaryObjectCreate,
  type FunctionObjectValue,
  type BuiltinFunctionObjectValue,
} from './all.mjs';
import type { ResolvedHostDefinedOptions } from '../engine.mjs';

/** https://tc39.es/ecma262/#sec-code-realms */
export class Realm {
  Intrinsics;
  GlobalObject;
  GlobalEnv;
  TemplateMap;
  LoadedModules;
  HostDefined!: ResolvedHostDefinedOptions; // NOTE: unsound definite assignment operator (`!`)
  randomState;

  mark(m) {
    m(this.GlobalObject);
    m(this.GlobalEnv);
    for (const v of Object.values(this.Intrinsics)) {
      m(v);
    }
    for (const v of Object.values(this.TemplateMap)) {
      m(v);
    }
    for (const v of this.LoadedModules) {
      m(v.Module);
    }
  }
}

/** https://tc39.es/ecma262/#sec-createrealm */
export function CreateRealm() {
  const realmRec = new Realm();
  CreateIntrinsics(realmRec);
  realmRec.GlobalObject = Value.undefined;
  realmRec.GlobalEnv = Value.undefined;
  realmRec.TemplateMap = [];
  realmRec.LoadedModules = [];
  return realmRec;
}

function AddRestrictedFunctionProperties(F, realm) {
  Assert(realm.Intrinsics['%ThrowTypeError%']);
  const thrower = realm.Intrinsics['%ThrowTypeError%'];
  X(DefinePropertyOrThrow(F, Value('caller'), Descriptor({
    Get: thrower,
    Set: thrower,
    Enumerable: Value.false,
    Configurable: Value.true,
  })));
  X(DefinePropertyOrThrow(F, Value('arguments'), Descriptor({
    Get: thrower,
    Set: thrower,
    Enumerable: Value.false,
    Configurable: Value.true,
  })));
}

type IntrinsicFlag =
  | 'is-constructor'
  | 'is-prototype'
  | 'has-prototype';

interface IntrinsicInfo<V extends Value, Flags extends IntrinsicFlag = never> {
  Type: V;
  Flags: IntrinsicFlag;
}

/** Find the names of any intrinsic with all of the requested flags. */
type FindIntrinsic<Flags extends IntrinsicFlag> = {
  [P in keyof Intrinsics]: Flags extends Intrinsics[P]['Flags'] ? P : never;
}[keyof Intrinsics];

/**
 * For a given intrinsic name, return the nested intrinsic name for the given property on that intrinsic.
 */
type NestedIntrinsic<S extends `%${string}%`, P extends string> = S extends `%${infer N}%` ? `%${N}.${P}%` : never;

/** The names of all well-known intrinsic objects */
export type Intrinsic = keyof Intrinsics;

/** The names of all well-known intrinsic objects that are prototypes */
export type IntrinsicPrototype = FindIntrinsic<'is-prototype'>;

/** The names of all well-known intrinsic objects that are constructors */
export type IntrinsicConstructor = FindIntrinsic<'is-constructor'>;

/** https://tc39.es/ecma262/#table-well-known-intrinsic-objects */
export interface Intrinsics {
  '%AggregateError%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%AggregateError.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%Array%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%Array.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%Array.prototype.values%': IntrinsicInfo<BuiltinFunctionObjectValue>;
  '%ArrayBuffer%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%ArrayBuffer.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%ArrayIteratorPrototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%AsyncFromSyncIteratorPrototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%AsyncFunction%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%AsyncFunction.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%AsyncGeneratorFunction%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%AsyncGeneratorFunction.prototype%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-prototype'>;
  '%AsyncGeneratorFunction.prototype.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%AsyncIteratorPrototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%Atomics%': IntrinsicInfo<ObjectValue>;
  '%BigInt%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%BigInt.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%BigInt64Array%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%BigInt64Array.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%BigUint64Array%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%BigUint64Array.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%Boolean%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%Boolean.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%DataView%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%DataView.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%Date%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%Date.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%decodeURI%': IntrinsicInfo<BuiltinFunctionObjectValue>;
  '%decodeURIComponent%': IntrinsicInfo<BuiltinFunctionObjectValue>;
  '%encodeURI%': IntrinsicInfo<BuiltinFunctionObjectValue>;
  '%encodeURIComponent%': IntrinsicInfo<BuiltinFunctionObjectValue>;
  '%Error%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%Error.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%eval%': IntrinsicInfo<BuiltinFunctionObjectValue>;
  '%EvalError%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%EvalError.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%FinalizationRegistry%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%FinalizationRegistry.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%Float32Array%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%Float32Array.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%Float64Array%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%Float64Array.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%ForInIteratorPrototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%Function%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%Function.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%GeneratorFunction%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%GeneratorFunction.prototype%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-prototype'>;
  '%GeneratorFunction.prototype.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%GeneratorFunction.prototype.prototype.next%': IntrinsicInfo<BuiltinFunctionObjectValue>;
  '%Int8Array%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%Int8Array.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%Int16Array%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%Int16Array.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%Int32Array%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%Int32Array.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%isFinite%': IntrinsicInfo<BuiltinFunctionObjectValue>;
  '%isNaN%': IntrinsicInfo<BuiltinFunctionObjectValue>;
  '%IteratorPrototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%JSON%': IntrinsicInfo<ObjectValue>;
  '%JSON.parse%': IntrinsicInfo<BuiltinFunctionObjectValue>;
  '%Map%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%Map.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%MapIteratorPrototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%Math%': IntrinsicInfo<ObjectValue>;
  '%Number%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%Number.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%Object%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%Object.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%Object.prototype.toString%': IntrinsicInfo<BuiltinFunctionObjectValue>;
  '%Object.prototype.valueOf%': IntrinsicInfo<BuiltinFunctionObjectValue>;
  '%parseFloat%': IntrinsicInfo<BuiltinFunctionObjectValue>;
  '%parseInt%': IntrinsicInfo<BuiltinFunctionObjectValue>;
  '%Promise%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%Promise.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%Promise.prototype.then%': IntrinsicInfo<BuiltinFunctionObjectValue>;
  '%Proxy%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%Proxy.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%RangeError%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%RangeError.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%ReferenceError%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%ReferenceError.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%Reflect%': IntrinsicInfo<ObjectValue>;
  '%RegExp%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%RegExp.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%RegExpStringIteratorPrototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%Set%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%Set.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%SetIteratorPrototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%SharedArrayBuffer%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%SharedArrayBuffer.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%String%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%String.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%StringIteratorPrototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%Symbol%': IntrinsicInfo<BuiltinFunctionObjectValue, ('has-prototype')>;
  '%SyntaxError%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%SyntaxError.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%ThrowTypeError%': IntrinsicInfo<BuiltinFunctionObjectValue>;
  '%TypedArray%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%TypedArray.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%TypeError%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%TypeError.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%Uint8Array%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%Uint8Array.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%Uint8ClampedArray%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%Uint8ClampedArray.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%Uint16Array%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%Uint16Array.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%Uint32Array%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%Uint32Array.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%URIError%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%URIError.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%WeakMap%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%WeakMap.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%WeakRef%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%WeakRef.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
  '%WeakSet%': IntrinsicInfo<BuiltinFunctionObjectValue, 'is-constructor'>;
  '%WeakSet.prototype%': IntrinsicInfo<ObjectValue, 'is-prototype'>;
}

/** https://tc39.es/ecma262/#sec-createintrinsics */
export function CreateIntrinsics(realmRec) {
  const intrinsics = Object.create(null);
  realmRec.Intrinsics = intrinsics;

  intrinsics['%Object.prototype%'] = OrdinaryObjectCreate(Value.null);

  bootstrapFunctionPrototype(realmRec);
  bootstrapObjectPrototype(realmRec);
  bootstrapThrowTypeError(realmRec);

  bootstrapEval(realmRec);
  bootstrapIsFinite(realmRec);
  bootstrapIsNaN(realmRec);
  bootstrapParseFloat(realmRec);
  bootstrapParseInt(realmRec);
  bootstrapURIHandling(realmRec);

  bootstrapObject(realmRec);

  bootstrapErrorPrototype(realmRec);
  bootstrapError(realmRec);
  bootstrapNativeError(realmRec);
  bootstrapAggregateErrorPrototype(realmRec);
  bootstrapAggregateError(realmRec);

  bootstrapFunction(realmRec);

  bootstrapIteratorPrototype(realmRec);
  bootstrapAsyncIteratorPrototype(realmRec);
  bootstrapArrayIteratorPrototype(realmRec);
  bootstrapMapIteratorPrototype(realmRec);
  bootstrapSetIteratorPrototype(realmRec);
  bootstrapStringIteratorPrototype(realmRec);
  bootstrapRegExpStringIteratorPrototype(realmRec);
  bootstrapForInIteratorPrototype(realmRec);

  bootstrapStringPrototype(realmRec);
  bootstrapString(realmRec);

  bootstrapArrayPrototype(realmRec);
  bootstrapArray(realmRec);

  bootstrapBooleanPrototype(realmRec);
  bootstrapBoolean(realmRec);

  bootstrapNumberPrototype(realmRec);
  bootstrapNumber(realmRec);

  bootstrapBigIntPrototype(realmRec);
  bootstrapBigInt(realmRec);

  bootstrapSymbolPrototype(realmRec);
  bootstrapSymbol(realmRec);

  bootstrapPromisePrototype(realmRec);
  bootstrapPromise(realmRec);

  bootstrapProxy(realmRec);

  bootstrapReflect(realmRec);

  bootstrapMath(realmRec);

  bootstrapDatePrototype(realmRec);
  bootstrapDate(realmRec);

  bootstrapRegExpPrototype(realmRec);
  bootstrapRegExp(realmRec);

  bootstrapSetPrototype(realmRec);
  bootstrapSet(realmRec);

  bootstrapMapPrototype(realmRec);
  bootstrapMap(realmRec);

  bootstrapGeneratorFunctionPrototypePrototype(realmRec);
  bootstrapGeneratorFunctionPrototype(realmRec);
  bootstrapGeneratorFunction(realmRec);

  bootstrapAsyncFunctionPrototype(realmRec);
  bootstrapAsyncFunction(realmRec);

  bootstrapAsyncGeneratorFunctionPrototypePrototype(realmRec);
  bootstrapAsyncGeneratorFunctionPrototype(realmRec);
  bootstrapAsyncGeneratorFunction(realmRec);

  bootstrapAsyncFromSyncIteratorPrototype(realmRec);

  bootstrapArrayBufferPrototype(realmRec);
  bootstrapArrayBuffer(realmRec);

  bootstrapTypedArrayPrototype(realmRec);
  bootstrapTypedArray(realmRec);
  bootstrapTypedArrayPrototypes(realmRec);
  bootstrapTypedArrayConstructors(realmRec);

  bootstrapDataViewPrototype(realmRec);
  bootstrapDataView(realmRec);

  bootstrapJSON(realmRec);

  bootstrapWeakMapPrototype(realmRec);
  bootstrapWeakMap(realmRec);
  bootstrapWeakSetPrototype(realmRec);
  bootstrapWeakSet(realmRec);

  bootstrapWeakRefPrototype(realmRec);
  bootstrapWeakRef(realmRec);

  bootstrapFinalizationRegistryPrototype(realmRec);
  bootstrapFinalizationRegistry(realmRec);

  AddRestrictedFunctionProperties(intrinsics['%Function.prototype%'], realmRec);

  return intrinsics;
}

/** https://tc39.es/ecma262/#sec-setrealmglobalobject */
export function SetRealmGlobalObject(realmRec, globalObj, thisValue) {
  const intrinsics = realmRec.Intrinsics;
  if (globalObj === Value.undefined) {
    globalObj = OrdinaryObjectCreate(intrinsics['%Object.prototype%']);
  }
  if (thisValue === Value.undefined) {
    thisValue = globalObj;
  }
  realmRec.GlobalObject = globalObj;
  const newGlobalEnv = NewGlobalEnvironment(globalObj, thisValue);
  realmRec.GlobalEnv = newGlobalEnv;
  return realmRec;
}

/** https://tc39.es/ecma262/#sec-setdefaultglobalbindings */
export function SetDefaultGlobalBindings(realmRec) {
  const global = realmRec.GlobalObject;

  // Value Properties of the Global Object
  [
    ['Infinity', toNumberValue(Infinity)],
    ['NaN', toNumberValue(NaN)],
    ['undefined', Value.undefined],
  ].forEach(([name, value]) => {
    Q(DefinePropertyOrThrow(global, Value(name), Descriptor({
      Value: value,
      Writable: Value.false,
      Enumerable: Value.false,
      Configurable: Value.false,
    })));
  });

  Q(DefinePropertyOrThrow(global, Value('globalThis'), Descriptor({
    Value: realmRec.GlobalEnv.GlobalThisValue,
    Writable: Value.true,
    Enumerable: Value.false,
    Configurable: Value.true,
  })));

  [
    // Function Properties of the Global Object
    'eval',
    'isFinite',
    'isNaN',
    'parseFloat',
    'parseInt',
    'decodeURI',
    'decodeURIComponent',
    'encodeURI',
    'encodeURIComponent',

    // Constructor Properties of the Global Object
    'AggregateError',
    'Array',
    'ArrayBuffer',
    'Boolean',
    'BigInt',
    'BigInt64Array',
    'BigUint64Array',
    'DataView',
    'Date',
    'Error',
    'EvalError',
    'FinalizationRegistry',
    'Float32Array',
    'Float64Array',
    'Function',
    'Int8Array',
    'Int16Array',
    'Int32Array',
    'Map',
    'Number',
    'Object',
    'Promise',
    'Proxy',
    'RangeError',
    'ReferenceError',
    'RegExp',
    'Set',
    // 'SharedArrayBuffer',
    'String',
    'Symbol',
    'SyntaxError',
    'TypeError',
    'Uint8Array',
    'Uint8ClampedArray',
    'Uint16Array',
    'Uint32Array',
    'URIError',
    'WeakMap',
    'WeakRef',
    'WeakSet',

    // Other Properties of the Global Object
    // 'Atomics',
    'JSON',
    'Math',
    'Reflect',
  ].forEach((name) => {
    Q(DefinePropertyOrThrow(global, Value(name), Descriptor({
      Value: realmRec.Intrinsics[`%${name}%`],
      Writable: Value.true,
      Enumerable: Value.false,
      Configurable: Value.true,
    })));
  });

  return global;
}
