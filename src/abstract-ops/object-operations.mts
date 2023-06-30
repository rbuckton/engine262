import {
  Descriptor,
  Type, StringValue, BooleanValue,
  Value,
  ObjectValue,
  wellKnownSymbols,
  type PropertyKeyValue,
  UndefinedValue,
} from '../value.mjs';
import {
  surroundingAgent,
} from '../engine.mjs';
import { InstanceofOperator } from '../runtime-semantics/all.mjs';
import {
  EnsureCompletion,
  Q, X, C, unused,
  type NormalOrThrowCompletion,
} from '../completion.mjs';
import {
  ArrayCreate,
  Assert,
  IsAccessorDescriptor,
  IsCallable,
  IsConstructor,
  IsDataDescriptor,
  IsExtensible,
  IsPropertyKey,
  SameValue,
  ToLength,
  ToObject,
  ToString,
  isProxyExoticObject,
  type FunctionObjectValue,
  type ArgumentList,
  type ConstructorValue,
  type ArrayExoticObjectValue,
  𝔽,
  ℝ,
  Realm,
} from './all.mjs';
import { isArray } from '../helpers.mjs';
import type { BoundFunctionExoticObjectValue } from '../intrinsics/FunctionPrototype.mjs';


// This file covers abstract operations defined in
/** https://tc39.es/ecma262/#sec-operations-on-objects */

export type BasicObjectValue<InternalSlots extends Record<string, unknown>> = ObjectValue & InternalSlots;

/** https://tc39.es/ecma262/#sec-makebasicobject */
export function MakeBasicObject<S extends string>(internalSlotsList: readonly S[]): BasicObjectValue<Record<S, unknown>> {
  // 1.  Assert: internalSlotsList is a List of internal slot names.
  Assert(isArray(internalSlotsList));
  // 2.  Let obj be a newly created object with an internal slot for each name in internalSlotsList.
  // 3.  Set obj's essential internal methods to the default ordinary object definitions specified in 9.1.
  const obj = new ObjectValue(internalSlotsList) as BasicObjectValue<Record<S, unknown>>;
  internalSlotsList.forEach((s) => {
    (obj as Record<string, unknown>)[s] = Value.undefined;
  });
  // 4.  Assert: If the caller will not be overriding both obj's [[GetPrototypeOf]] and [[SetPrototypeOf]] essential internal methods, then internalSlotsList contains [[Prototype]].
  // 5.  Assert: If the caller will not be overriding all of obj's [[SetPrototypeOf]], [[IsExtensible]], and [[PreventExtensions]] essential internal methods, then internalSlotsList contains [[Extensible]].
  // 6.  If internalSlotsList contains [[Extensible]], then set obj.[[Extensible]] to true.
  if (internalSlotsList.includes('Extensible' as S)) {
    (obj as Record<string, unknown>).Extensible = Value.true;
  }
  // 7.  Return obj.
  return obj;
}

/** https://tc39.es/ecma262/#sec-get-o-p */
export function Get(O: ObjectValue, P: PropertyKeyValue): NormalOrThrowCompletion<Value> {
  // 1. Return ? O.Get(P, O).
  return C(Q(O.Get(P, O)));
}

/** https://tc39.es/ecma262/#sec-getv */
export function GetV(V: Value, P: PropertyKeyValue): NormalOrThrowCompletion<Value> {
  const O = Q(ToObject(V));
  return C(Q(O.Get(P, V)));
}

/** https://tc39.es/ecma262/#sec-set-o-p-v-throw */
export function Set(O: ObjectValue, P: PropertyKeyValue, V: Value, Throw: BooleanValue): NormalOrThrowCompletion<'unused'> {
  const success = Q(O.Set(P, V, O));
  if (success === Value.false && Throw === Value.true) {
    return C(surroundingAgent.Throw('TypeError', 'CannotSetProperty', P, O));
  }
  return unused;
}

/** https://tc39.es/ecma262/#sec-createdataproperty */
export function CreateDataProperty(O: ObjectValue, P: PropertyKeyValue, V: Value): NormalOrThrowCompletion<BooleanValue> {
  const newDesc = Descriptor({
    Value: V,
    Writable: Value.true,
    Enumerable: Value.true,
    Configurable: Value.true,
  });
  return C(Q(O.DefineOwnProperty(P, newDesc)));
}

/** https://tc39.es/ecma262/#sec-createmethodproperty */
export function CreateMethodProperty(O: ObjectValue, P: PropertyKeyValue, V: Value): 'unused' {
  // 1. Assert: O is an ordinary, extensible object with no non-configurable properties.
  // 2. Let newDesc be the PropertyDescriptor { [[Value]]: V, [[Writable]]: true, [[Enumerable]]: false, [[Configurable]]: true }.
  const newDesc = Descriptor({
    Value: V,
    Writable: Value.true,
    Enumerable: Value.false,
    Configurable: Value.true,
  });
  // 3. Perform ! DefinePropertyOrThrow(O, P, newDesc).
  X(DefinePropertyOrThrow(O, P, newDesc));
  // 4. Return unused.
  return 'unused';
}

/** https://tc39.es/ecma262/#sec-createdatapropertyorthrow */
export function CreateDataPropertyOrThrow(O: ObjectValue, P: PropertyKeyValue, V: Value): NormalOrThrowCompletion<'unused'> {
  const success = Q(CreateDataProperty(O, P, V));
  if (success === Value.false) {
    return C(surroundingAgent.Throw('TypeError', 'CannotDefineProperty', P));
  }
  return unused;
}

// NOTE: The inputs, outputs, and algorithm steps for this operation is identical to CreateMethodProperty
/** https://tc39.es/ecma262/#sec-createnonenumerabledatapropertyorthrow */
export { CreateMethodProperty as CreateNonEnumerableDataPropertyOrThrow };

/** https://tc39.es/ecma262/#sec-definepropertyorthrow */
export function DefinePropertyOrThrow(O: ObjectValue, P: PropertyKeyValue, desc: Descriptor): NormalOrThrowCompletion<'unused'> {
  const success = Q(O.DefineOwnProperty(P, desc));
  if (success === Value.false) {
    return C(surroundingAgent.Throw('TypeError', 'CannotDefineProperty', P));
  }
  return C('unused');
}

/** https://tc39.es/ecma262/#sec-deletepropertyorthrow */
export function DeletePropertyOrThrow(O: ObjectValue, P: PropertyKeyValue): NormalOrThrowCompletion<'unused'> {
  Assert(O instanceof ObjectValue);
  Assert(IsPropertyKey(P));
  const success = Q(O.Delete(P));
  if (success === Value.false) {
    return C(surroundingAgent.Throw('TypeError', 'CannotDeleteProperty', P));
  }
  return unused;
}

/** https://tc39.es/ecma262/#sec-getmethod */
export function GetMethod(V: Value, P: PropertyKeyValue): NormalOrThrowCompletion<FunctionObjectValue | UndefinedValue> {
  const func = Q(GetV(V, P));
  if (func === Value.null || func === Value.undefined) {
    return C(Value.undefined);
  }
  if (IsCallable(func) === Value.false) {
    return C(surroundingAgent.Throw('TypeError', 'NotAFunction', func));
  }
  // NOTE: Since IsCallable returns a BooleanValue, it is not sufficient as a type guard even though it does make the
  //       following cast sound.
  return C(func as FunctionObjectValue);
}

/** https://tc39.es/ecma262/#sec-hasproperty */
export function HasProperty(O: ObjectValue, P: PropertyKeyValue): NormalOrThrowCompletion<BooleanValue> {
  return C(Q(O.HasProperty(P)));
}

/** https://tc39.es/ecma262/#sec-hasownproperty */
export function HasOwnProperty(O: ObjectValue, P: PropertyKeyValue): NormalOrThrowCompletion<BooleanValue> {
  const desc = Q(O.GetOwnProperty(P));
  if (desc === Value.undefined) {
    return C(Value.false);
  }
  return C(Value.true);
}

/** https://tc39.es/ecma262/#sec-call */
export function Call(F: Value, V: Value, argumentsList?: ArgumentList): NormalOrThrowCompletion<Value> {
  if (!argumentsList) {
    argumentsList = [];
  }

  if (IsCallable(F) === Value.false) {
    return C(surroundingAgent.Throw('TypeError', 'NotAFunction', F));
  }

  // NOTE: Since IsCallable returns a BooleanValue, it is not sufficient as a type guard even though it does make the
  //       following cast sound.
  return C(Q((F as FunctionObjectValue).Call(V, argumentsList)));
}

/** https://tc39.es/ecma262/#sec-construct */
export function Construct(F: ConstructorValue, argumentsList?: ArgumentList, newTarget?: ConstructorValue): NormalOrThrowCompletion<ObjectValue> {
  if (!newTarget) {
    newTarget = F;
  }
  if (!argumentsList) {
    argumentsList = [];
  }
  return C(Q(F.Construct(argumentsList, newTarget)));
}

/** https://tc39.es/ecma262/#sec-setintegritylevel */
export function SetIntegrityLevel(O: ObjectValue, level: 'sealed' | 'frozen'): NormalOrThrowCompletion<BooleanValue> {
  const status = Q(O.PreventExtensions());
  if (status === Value.false) {
    return C(Value.false);
  }
  const keys = Q(O.OwnPropertyKeys());
  if (level === 'sealed') {
    for (const k of keys) {
      Q(DefinePropertyOrThrow(O, k, Descriptor({ Configurable: Value.false })));
    }
  } else if (level === 'frozen') {
    for (const k of keys) {
      const currentDesc = Q(O.GetOwnProperty(k));
      if (currentDesc !== Value.undefined) {
        let desc;
        if (IsAccessorDescriptor(currentDesc) === true) {
          desc = Descriptor({ Configurable: Value.false });
        } else {
          desc = Descriptor({ Configurable: Value.false, Writable: Value.false });
        }
        Q(DefinePropertyOrThrow(O, k, desc));
      }
    }
  }
  return C(Value.true);
}

/** https://tc39.es/ecma262/#sec-testintegritylevel */
export function TestIntegrityLevel(O: ObjectValue, level: 'sealed' | 'frozen'): NormalOrThrowCompletion<BooleanValue> {
  const extensible = Q(IsExtensible(O));
  if (extensible === Value.true) {
    return C(Value.false);
  }
  const keys = Q(O.OwnPropertyKeys());
  for (const k of keys) {
    const currentDesc = Q(O.GetOwnProperty(k));
    if (!(currentDesc instanceof UndefinedValue)) {
      if (currentDesc.Configurable === Value.true) {
        return C(Value.false);
      }
      if (level === 'frozen' && IsDataDescriptor(currentDesc)) {
        if (currentDesc.Writable === Value.true) {
          return C(Value.false);
        }
      }
    }
  }
  return C(Value.true);
}

/** https://tc39.es/ecma262/#sec-createarrayfromlist */
export function CreateArrayFromList(elements: readonly Value[]): ArrayExoticObjectValue {
  // 1. Let array be ! ArrayCreate(0).
  const array = X(ArrayCreate(0));
  // 2. Let n be 0.
  let n = 0;
  // 3. For each element e of elements, do
  for (const e of elements) {
    // a. Perform ! CreateDataPropertyOrThrow(array, ! ToString(𝔽(n)), e).
    X(CreateDataPropertyOrThrow(array, X(ToString(𝔽(n))), e));
    // b. Set n to n + 1.
    n += 1;
  }
  // 4. Return array.
  return array;
}

/** https://tc39.es/ecma262/#sec-lengthofarraylike */
export function LengthOfArrayLike(obj: ObjectValue): NormalOrThrowCompletion<number | bigint> {
  // 1. Return ℝ(? ToLength(? Get(obj, "length"))).
  return C(ℝ(Q(ToLength(Q(Get(obj, Value('length')))))));
}

/** https://tc39.es/ecma262/#sec-createlistfromarraylike */
export function CreateListFromArrayLike(obj: Value, elementTypes?: string[]): NormalOrThrowCompletion<Value[]> {
  // 1. If elementTypes is not present, set elementTypes to « Undefined, Null, Boolean, String, Symbol, Number, BigInt, Object ».
  if (!elementTypes) {
    elementTypes = ['Undefined', 'Null', 'Boolean', 'String', 'Symbol', 'Number', 'BigInt', 'Object'];
  }
  // 2. If obj is not an Object, throw a TypeError exception.
  if (!(obj instanceof ObjectValue)) {
    return C(surroundingAgent.Throw('TypeError', 'NotAnObject', obj));
  }
  // 3. Let len be ? LengthOfArrayLike(obj).
  const len = Q(LengthOfArrayLike(obj));
  // 4. Let list be a new empty List.
  const list = [];
  // 5. Let index be 0.
  let index = 0;
  // 6. Repeat, while index < len,
  while (index < len) {
    // a. Let indexName be ! ToString(𝔽(index)).
    const indexName = X(ToString(𝔽(index)));
    // b. Let next be ? Get(obj, indexName).
    const next = Q(Get(obj, indexName));
    // c. If elementTypes does not contain Type(next), throw a TypeError exception.
    if (!elementTypes.includes(Type(next))) {
      return surroundingAgent.Throw('TypeError', 'NotPropertyName', next);
    }
    // d. Append next as the last element of list.
    list.push(next);
    // e. Set index to index + 1.
    index += 1;
  }
  // 7. Return list.
  return C(list);
}

/** https://tc39.es/ecma262/#sec-invoke */
export function Invoke(V: Value, P: PropertyKeyValue, argumentsList?: ArgumentList): NormalOrThrowCompletion<Value> {
  if (!argumentsList) {
    argumentsList = [];
  }
  const func = Q(GetV(V, P));
  return C(Q(Call(func, V, argumentsList)));
}

/** https://tc39.es/ecma262/#sec-ordinaryhasinstance */
export function OrdinaryHasInstance(C: Value, O: Value): NormalOrThrowCompletion<BooleanValue> {
  if (IsCallable(C) === Value.false) {
    return EnsureCompletion(Value.false);
  }
  // NON-SPEC
  Assert(C instanceof ObjectValue);
  if ('BoundTargetFunction' in (C as BoundFunctionExoticObjectValue)) { // NOTE: unsound cast
    const BC = (C as BoundFunctionExoticObjectValue).BoundTargetFunction; // NOTE: unsound cast
    return EnsureCompletion(Q(InstanceofOperator(O, BC)));
  }
  if (!(O instanceof ObjectValue)) {
    return EnsureCompletion(Value.false);
  }
  const P = Q(Get(C, Value('prototype')));
  if (!(P instanceof ObjectValue)) {
    return surroundingAgent.Throw('TypeError', 'NotAnObject', P);
  }
  while (true) {
    // NON-SPEC
    Assert(O instanceof ObjectValue);
    O = Q(O.GetPrototypeOf());
    if (O === Value.null) {
      return EnsureCompletion(Value.false);
    }
    if (SameValue(P, O) === Value.true) {
      return EnsureCompletion(Value.true);
    }
  }
}

/** https://tc39.es/ecma262/#sec-speciesconstructor */
export function SpeciesConstructor(O: ObjectValue, defaultConstructor: ConstructorValue): NormalOrThrowCompletion<ConstructorValue> {
  const C = Q(Get(O, Value('constructor')));
  if (C === Value.undefined) {
    return EnsureCompletion(defaultConstructor);
  }
  if (!(C instanceof ObjectValue)) {
    return EnsureCompletion(surroundingAgent.Throw('TypeError', 'NotAnObject', C));
  }
  const S = Q(Get(C, wellKnownSymbols.species));
  if (S === Value.undefined || S === Value.null) {
    return EnsureCompletion(defaultConstructor);
  }
  if (IsConstructor(S) === Value.true) {
    return EnsureCompletion(S as ConstructorValue); // NOTE: unsound cast, improve after IsConstructor is a type guard
  }
  return EnsureCompletion(surroundingAgent.Throw('TypeError', 'SpeciesNotConstructor'));
}

/** https://tc39.es/ecma262/#sec-enumerableownpropertynames */
export function EnumerableOwnProperties(O: ObjectValue, kind: 'key' | 'value' | 'key+value'): NormalOrThrowCompletion<Value[]> {
  const ownKeys = Q(O.OwnPropertyKeys());
  const properties: Value[] = [];
  for (const key of ownKeys) {
    if (key instanceof StringValue) {
      const desc = Q(O.GetOwnProperty(key));
      if (!(desc instanceof UndefinedValue) && desc.Enumerable === Value.true) {
        if (kind === 'key') {
          properties.push(key);
        } else {
          const value = Q(Get(O, key));
          if (kind === 'value') {
            properties.push(value);
          } else {
            Assert(kind === 'key+value');
            const entry = CreateArrayFromList([key, value]);
            properties.push(entry);
          }
        }
      }
    }
  }
  return C(properties);
}

/** https://tc39.es/ecma262/#sec-getfunctionrealm */
export function GetFunctionRealm(obj: FunctionObjectValue): NormalOrThrowCompletion<Realm> {
  if ('Realm' in obj) {
    return C(obj.Realm);
  }

  if ('BoundTargetFunction' in obj) {
    const target = obj.BoundTargetFunction;
    return C(Q(GetFunctionRealm(target)));
  }

  if (isProxyExoticObject(obj)) {
    if (obj.ProxyHandler === Value.null) {
      return C(surroundingAgent.Throw('TypeError', 'ProxyRevoked', 'GetFunctionRealm'));
    }
    const proxyTarget = obj.ProxyTarget;
    return C(Q(GetFunctionRealm(proxyTarget)));
  }

  return C(surroundingAgent.currentRealmRecord);
}

/** https://tc39.es/ecma262/#sec-copydataproperties */
export function CopyDataProperties(target: ObjectValue, source: Value, excludedItems: readonly PropertyKeyValue[]): NormalOrThrowCompletion<'unused'> {
  if (source === Value.undefined || source === Value.null) {
    return unused;
  }
  const from = X(ToObject(source));
  const keys = Q(from.OwnPropertyKeys());
  for (const nextKey of keys) {
    let excluded = false;
    for (const e of excludedItems) {
      if (SameValue(e, nextKey) === Value.true) {
        excluded = true;
      }
    }
    if (excluded === false) {
      const desc = Q(from.GetOwnProperty(nextKey));
      if (!(desc instanceof UndefinedValue) && desc.Enumerable === Value.true) {
        const propValue = Q(Get(from, nextKey));
        X(CreateDataProperty(target, nextKey, propValue));
      }
    }
  }
  return unused;
}
