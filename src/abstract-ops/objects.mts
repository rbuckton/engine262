import {
  Descriptor,
  ObjectValue,
  SymbolValue, StringValue, UndefinedValue, NullValue,
  Value,
  BooleanValue,
  type PropertyKeyValue,
  type ObjectValueWithPrototypeSlot,
  type ObjectValueWithExtensibleSlot,
} from '../value.mjs';
import { Q, C, NormalCompletion, type NormalOrThrowCompletion } from '../completion.mjs';
import {
  Assert,
  Call,
  CreateDataProperty,
  Get,
  GetFunctionRealm,
  IsAccessorDescriptor,
  IsCallable,
  IsDataDescriptor,
  IsExtensible,
  IsGenericDescriptor,
  IsPropertyKey,
  SameValue,
  MakeBasicObject,
  isArrayIndex,
  type BasicObjectValue,
  IsFullyPopulatedDescriptor,
  type FullyPopulatedDescriptor,
  inAscendingNumericIndexOrder,
  type IntrinsicPrototype,
  type FunctionObjectValue,
} from './all.mjs';

/** https://tc39.es/ecma262/#sec-ordinarygetprototypeof */
export function OrdinaryGetPrototypeOf(O: ObjectValueWithPrototypeSlot): ObjectValue | NullValue {
  return O.Prototype;
}

/** https://tc39.es/ecma262/#sec-ordinarysetprototypeof */
export function OrdinarySetPrototypeOf(O: ObjectValueWithPrototypeSlot & ObjectValueWithExtensibleSlot, V: ObjectValue | NullValue): NormalCompletion<BooleanValue> {
  // 1. Let current be O.[[Prototype]].
  const current = O.Prototype;
  // 2. If SameValue(V, current) is true, return true.
  if (SameValue(V, current) === Value.true) {
    return C(Value.true);
  }
  // 3. Let extensible be O.[[Extensible]].
  const extensible = O.Extensible;
  // 4. If extensible is false, return false.
  if (extensible === Value.false) {
    return C(Value.false);
  }
  // 5. Let p be V.
  let p = V;
  // 6. Let done be false.
  let done = false;
  // 7. Repeat, while done is false,
  while (done === false) {
    // a. If p is null, then
    if (p instanceof NullValue) {
      // i. Set done to true.
      done = true;
    } else if (SameValue(p, O) === Value.true) { // b. Else, if SameValue(p, O) is true, then
      // i. Return false
      return C(Value.false);
    } else { // c. Else,
      // i. If p.[[GetPrototypeOf]] is not the ordinary object internal method defined in 10.1.1, set done to true.
      if (p.GetPrototypeOf !== ObjectValue.prototype.GetPrototypeOf) { 
        done = true;
      } else { // ii. Else, set p to p.[[Prototype]].
        // NOTE: Step 7.c.i implies that `p` has a [[Prototype]] internal slot, based on Step 4 of
        //       https://tc39.es/ecma262/#sec-makebasicobject, but does not explicitly assert this case. Since there is
        //       no explicit assertion, the below cast is still unsound.
        p = (p as ObjectValueWithPrototypeSlot).Prototype;
      }
    }
  }
  O.Prototype = V;
  return C(Value.true);
}

/** https://tc39.es/ecma262/#sec-ordinaryisextensible */
export function OrdinaryIsExtensible(O: ObjectValueWithExtensibleSlot): BooleanValue {
  return O.Extensible;
}

/** https://tc39.es/ecma262/#sec-ordinarypreventextensions */
export function OrdinaryPreventExtensions(O: ObjectValueWithExtensibleSlot) {
  O.Extensible = Value.false;
  return Value.true;
}

/** https://tc39.es/ecma262/#sec-ordinarygetownproperty */
export function OrdinaryGetOwnProperty(O: ObjectValue, P: PropertyKeyValue): FullyPopulatedDescriptor | UndefinedValue {
  if (!O.properties.has(P)) {
    return Value.undefined;
  }

  const D = Descriptor({});

  const x = O.properties.get(P)!; // NOTE: unsound non-null assertion.

  if (IsDataDescriptor(x)) {
    D.Value = x.Value;
    D.Writable = x.Writable;
  } else if (IsAccessorDescriptor(x)) {
    D.Get = x.Get;
    D.Set = x.Set;
  }
  D.Enumerable = x.Enumerable;
  D.Configurable = x.Configurable;

  return D as FullyPopulatedDescriptor; // NOTE: unsound cast, but derived from 
}

/** https://tc39.es/ecma262/#sec-ordinarydefineownproperty */
export function OrdinaryDefineOwnProperty(O: ObjectValue, P: PropertyKeyValue, Desc: Descriptor): NormalOrThrowCompletion<BooleanValue> {
  const current = Q(O.GetOwnProperty(P));
  const extensible = Q(IsExtensible(O));
  return C(ValidateAndApplyPropertyDescriptor(O, P, extensible, Desc, current));
}

/** https://tc39.es/ecma262/#sec-iscompatiblepropertydescriptor */
export function IsCompatiblePropertyDescriptor(Extensible: BooleanValue, Desc: Descriptor, Current: Descriptor): BooleanValue {
  return ValidateAndApplyPropertyDescriptor(Value.undefined, Value(''), Extensible, Desc, Current);
}

/** https://tc39.es/ecma262/#sec-validateandapplypropertydescriptor */
export function ValidateAndApplyPropertyDescriptor(O: ObjectValue | UndefinedValue, P: PropertyKeyValue, extensible: BooleanValue, Desc: Descriptor, current: Descriptor | UndefinedValue): BooleanValue {
  // 1. Assert: IsPropertyKey(P) is true.
  // SPEC-BUG?: This assertion is no longer necessary given that the AO has a structured header with a type for `P`.
  Assert(IsPropertyKey(P));

  // 2. If current is undefined, then
  if (current instanceof UndefinedValue) {
    // a. If extensible is false, return false.
    if (extensible === Value.false) {
      return Value.false;
    }

    // b. If O is undefined, return true.
    if (O instanceof UndefinedValue) {
      return Value.true;
    }

    // c. If IsAccessorDescriptor(Desc) is true, then
    if (IsAccessorDescriptor(Desc)) {
      // i. Create an own accessor property named P of object O whose [[Get]], [[Set]], [[Enumerable]], and [[Configurable]] attributes are set to the value of the corresponding field in Desc if Desc has that field, or to the attribute's default value otherwise.
      O.properties.set(P, Descriptor({
        Get: Desc.Get === undefined ? Value.undefined : Desc.Get,
        Set: Desc.Set === undefined ? Value.undefined : Desc.Set,
        Enumerable: Desc.Enumerable === undefined ? Value.false : Desc.Enumerable,
        Configurable: Desc.Configurable === undefined ? Value.false : Desc.Configurable,
      }));
    }
    else { // d. Else,
      // i. Create an own data property named P of object O whose [[Value]], [[Writable]], [[Enumerable]], and [[Configurable]] attributes are set to the value of the corresponding field in Desc if Desc has that field, or to the attribute's default value otherwise.
      O.properties.set(P, Descriptor({
        Value: Desc.Value === undefined ? Value.undefined : Desc.Value,
        Writable: Desc.Writable === undefined ? Value.false : Desc.Writable,
        Enumerable: Desc.Enumerable === undefined ? Value.false : Desc.Enumerable,
        Configurable: Desc.Configurable === undefined ? Value.false : Desc.Configurable,
      }));
    }

    // e. Return true
    return Value.true;
  }

  // 3. Assert: current is a fully populated Property Descriptor
  Assert(IsFullyPopulatedDescriptor(current));

  // 4. If Desc does not have any fields, return true
  if (Desc.everyFieldIsAbsent()) {
    return Value.true;
  }

  // 5. If current.[[Configurable]] is false, then
  if (current.Configurable === Value.false) {
    // a. If Desc has a [[Configurable]] field and Desc.[[Configurable]] is true, return false.
    if (Desc.Configurable !== undefined && Desc.Configurable === Value.true) {
      return Value.false;
    }

    // b. If Desc has an [[Enumerable]] field and SameValue(Desc.[[Enumerable]], Current.[[Enumerable]]) is false, return false.
    if (Desc.Enumerable !== undefined && SameValue(Desc.Enumerable, current.Enumerable) === Value.false) {
      return Value.false;
    }

    // c. If IsGenericDescriptor(Desc) is false and SameValue(IsAccessorDescriptor(Desc), IsAccessorDescriptor(current)) is false, return false.
    if (IsGenericDescriptor(Desc) && SameValue(Value(IsAccessorDescriptor(Desc)), Value(IsAccessorDescriptor(current))) === Value.false) {
      return Value.false;
    }

    // d. If IsAccessorDescriptor(current) is true, then
    if (IsAccessorDescriptor(current)) {
      // i. If Desc has a [[Get]] field and SameValue(Desc.[[Get]], current.[[Get]]) is false, return false.
      if (Desc.Get !== undefined && SameValue(Desc.Get, current.Get) === Value.false) {
        return Value.false;
      }

      // ii. If Desc has a [[Set]] field and SameValue(Desc.[[Set]], current.[[Set]]) is false, return false.
      if (Desc.Set !== undefined && SameValue(Desc.Set, current.Set) === Value.false) {
        return Value.false;
      }
    } else if (current.Writable === Value.false) { // e. Else, if current.[[Writable]] is false, then
      // i. If Desc has a [[Writable]] field and Desc.[[Writable]] is true, return false.
      if (Desc.Writable !== undefined && Desc.Writable === Value.true) {
        return Value.false;
      }

      // ii. If Desc has a [[Value]] field and SameValue(Desc.[[Value]], current.[[Value]]) is false, return false.
      if (Desc.Value !== undefined && SameValue(Desc.Value, current.Value) === Value.false) {
        return Value.false;
      }
    }
  }

  // 6. If O is not undefined, then
  if (!(O instanceof UndefinedValue)) {
    // a. If IsDataDescriptor(current) is true and IsAccessorDescriptor(Desc) is true, then
    if (IsDataDescriptor(current) && IsAccessorDescriptor(Desc)) {
      // i. If Desc has a [[Configurable]] field, let configurable be Desc.[[Configurable]]; else let configurable be current.[[Configurable]].
      let configurable: BooleanValue;
      if (Desc.Configurable !== undefined) {
        configurable = Desc.Configurable;
      } else {
        configurable = current.Configurable;
      }

      // ii. If Desc has a [[Enumerable]] field, let enumerable be Desc.[[Enumerable]]; else let enumerable be current.[[Enumerable]].
      let enumerable: BooleanValue;
      if (Desc.Enumerable !== undefined) {
        enumerable = Desc.Enumerable;
      } else {
        enumerable = current.Enumerable;
      }

      // iii. Replace the property named P of object O with an accessor property whose [[Configurable]] and [[Enumerable]] attributes are set to configurable and enumerable, respectively, and whose [[Get]] and [[Set]] attributes are set to the value of the corresponding field in Desc if Desc has that field, or to the attribute's default value otherwise.
      O.properties.set(P, Descriptor({
        Configurable: configurable,
        Enumerable: enumerable,
        Get: Desc.Get === undefined ? Value.undefined : Desc.Get,
        Set: Desc.Set === undefined ? Value.undefined : Desc.Set
      }));
    } else if (IsAccessorDescriptor(current) && IsDataDescriptor(Desc)) { // b. Else if IsAccessorDescriptor(current) is true and IsDataDescriptor(Desc) is true, then
      // i. If Desc has a [[Configurable]] field, let configurable be Desc.[[Configurable]]; else let configurable be current.[[Configurable]].
      let configurable: BooleanValue;
      if (Desc.Configurable !== undefined) {
        configurable = Desc.Configurable;
      } else {
        configurable = current.Configurable;
      }

      // ii. If Desc has a [[Enumerable]] field, let enumerable be Desc.[[Enumerable]]; else let enumerable be current.[[Enumerable]].
      let enumerable: BooleanValue;
      if (Desc.Enumerable !== undefined) {
        enumerable = Desc.Enumerable;
      } else {
        enumerable = current.Enumerable;
      }

      // iii. Replace the property named P of object O with a data property whose [[Configurable]] and [[Enumerable]] attributes are set to configurable and enumerable, respectively, and whose [[Value]] and [[Writable]] attributes are set to the value of the corresponding field in Desc if Desc has that field, or to the attribute's default value otherwise.
      O.properties.set(P, Descriptor({
        Configurable: configurable,
        Enumerable: enumerable,
        Value: Desc.Value === undefined ? Value.undefined : Desc.Value,
        Writable: Desc.Writable === undefined ? Value.false : Desc.Writable,
      }));
    } else { // c. Else,
      // i. For each field of Desc, set the corresponding attribute of the property named P of object O to the value of the field.
      // NOTE: If `current` is not `undefined`, then `O` is assumed to have a property named `P`, but TypeScript cannot verify this.
      const entry = O.properties.get(P)!; // NOTE: unsound non-null assertion
      if (Desc.Value !== undefined) {
        entry.Value = Desc.Value;
      }
      if (Desc.Writable !== undefined) {
        entry.Writable = Desc.Writable;
      }
      if (Desc.Get !== undefined) {
        entry.Get = Desc.Get;
      }
      if (Desc.Set !== undefined) {
        entry.Set = Desc.Set;
      }
      if (Desc.Enumerable !== undefined) {
        entry.Enumerable = Desc.Enumerable;
      }
      if (Desc.Configurable !== undefined) {
        entry.Configurable = Desc.Configurable;
      }
    }
  }

  // 7. Return true.
  return Value.true;
}

/** https://tc39.es/ecma262/#sec-ordinaryhasproperty */
export function OrdinaryHasProperty(O: ObjectValue, P: PropertyKeyValue): NormalOrThrowCompletion<BooleanValue> {
  const hasOwn = Q(O.GetOwnProperty(P));
  if (!(hasOwn instanceof UndefinedValue)) {
    return C(Value.true);
  }
  const parent = Q(O.GetPrototypeOf());
  if (!(parent instanceof NullValue)) {
    return C(Q(parent.HasProperty(P)));
  }
  return C(Value.false);
}

/** https://tc39.es/ecma262/#sec-ordinaryget */
export function OrdinaryGet(O: ObjectValue, P: PropertyKeyValue, Receiver: Value): NormalOrThrowCompletion<Value> {
  const desc = Q(O.GetOwnProperty(P));
  if (desc instanceof UndefinedValue) {
    const parent = Q(O.GetPrototypeOf());
    if (parent instanceof NullValue) {
      return C(Value.undefined);
    }
    return C(Q(parent.Get(P, Receiver)));
  }
  if (IsDataDescriptor(desc)) {
    return C(desc.Value);
  }
  Assert(IsAccessorDescriptor(desc));
  const getter = desc.Get;
  if (getter instanceof UndefinedValue) {
    return C(Value.undefined);
  }
  return C(Q(Call(getter, Receiver)));
}

/** https://tc39.es/ecma262/#sec-ordinaryset */
export function OrdinarySet(O: ObjectValue, P: PropertyKeyValue, V: Value, Receiver: Value): NormalOrThrowCompletion<BooleanValue> {
  const ownDesc = Q(O.GetOwnProperty(P));
  return C(Q(OrdinarySetWithOwnDescriptor(O, P, V, Receiver, ownDesc)));
}

/** https://tc39.es/ecma262/#sec-ordinarysetwithowndescriptor */
export function OrdinarySetWithOwnDescriptor(O: ObjectValue, P: PropertyKeyValue, V: Value, Receiver: Value, ownDesc: FullyPopulatedDescriptor | UndefinedValue): NormalOrThrowCompletion<BooleanValue> {
  if (ownDesc instanceof UndefinedValue) {
    const parent = Q(O.GetPrototypeOf());
    if (!(parent instanceof NullValue)) {
      return C(Q(parent.Set(P, V, Receiver)));
    }
    ownDesc = Descriptor({
      Value: Value.undefined,
      Writable: Value.true,
      Enumerable: Value.true,
      Configurable: Value.true,
    });
  }

  if (IsDataDescriptor(ownDesc)) {
    if (ownDesc.Writable === Value.false) {
      return C(Value.false);
    }
    if (!(Receiver instanceof ObjectValue)) {
      return C(Value.false);
    }

    const existingDescriptor = Q(Receiver.GetOwnProperty(P));
    if (!(existingDescriptor instanceof UndefinedValue)) {
      if (IsAccessorDescriptor(existingDescriptor)) {
        return C(Value.false);
      }
      if (existingDescriptor.Writable === Value.false) {
        return C(Value.false);
      }
      const valueDesc = Descriptor({ Value: V });
      return C(Q(Receiver.DefineOwnProperty(P, valueDesc)));
    }
    return C(Q(CreateDataProperty(Receiver, P, V)));
  }

  Assert(IsAccessorDescriptor(ownDesc));
  const setter = ownDesc.Set;
  if (setter instanceof UndefinedValue) {
    return C(Value.false);
  }
  Q(Call(setter, Receiver, [V]));
  return C(Value.true);
}

/** https://tc39.es/ecma262/#sec-ordinarydelete */
export function OrdinaryDelete(O: ObjectValue, P: PropertyKeyValue): NormalOrThrowCompletion<BooleanValue> {
  const desc = Q(O.GetOwnProperty(P));
  if (desc instanceof UndefinedValue) {
    return C(Value.true);
  }
  if (desc.Configurable === Value.true) {
    O.properties.delete(P);
    return C(Value.true);
  }
  return C(Value.false);
}

/** https://tc39.es/ecma262/#sec-ordinaryownpropertykeys */
export function OrdinaryOwnPropertyKeys(O: ObjectValue): PropertyKeyValue[] {
  const keys: PropertyKeyValue[] = [];

  // For each own property key P of O that is an array index, in ascending numeric index order, do
  //   Add P as the last element of keys.
  for (const P of [...O.properties.keys()].filter(isArrayIndex).sort(inAscendingNumericIndexOrder)) {
    keys.push(P);
  }

  // For each own property key P of O such that Type(P) is String and
  // P is not an array index, in ascending chronological order of property creation, do
  //   Add P as the last element of keys.
  for (const P of O.properties.keys()) {
    if (P instanceof StringValue && isArrayIndex(P) === false) {
      keys.push(P);
    }
  }

  // For each own property key P of O such that Type(P) is Symbol,
  // in ascending chronological order of property creation, do
  //   Add P as the last element of keys.
  for (const P of O.properties.keys()) {
    if (P instanceof SymbolValue) {
      keys.push(P);
    }
  }

  return keys;
}

/** https://tc39.es/ecma262/#sec-ordinaryobjectcreate */
export type OrdinaryObjectValue<InternalSlots extends Record<string, unknown> = Record<string, unknown>> = BasicObjectValue<{
  Prototype: ObjectValue | NullValue;
  Extensible: BooleanValue;
} & InternalSlots>;

/** https://tc39.es/ecma262/#sec-ordinaryobjectcreate */
export function OrdinaryObjectCreate<S extends string>(proto: ObjectValue | NullValue, additionalInternalSlotsList?: readonly S[]): OrdinaryObjectValue<Record<S, unknown>> {
  // 1. Let internalSlotsList be « [[Prototype]], [[Extensible]] ».
  let internalSlotsList: ('Prototype' | 'Extensible' | S)[] = ['Prototype', 'Extensible'];
  // 2. If additionalInternalSlotsList is present, set internalSlotsList to the list-concatenation of internalSlotsList and additionalInternalSlotsList.
  if (additionalInternalSlotsList !== undefined) {
    internalSlotsList = [...internalSlotsList, ...additionalInternalSlotsList];
  }
  // 3. Let O be MakeBasicObject(internalSlotsList).
  const O = MakeBasicObject(internalSlotsList) as OrdinaryObjectValue<Record<S, unknown>>;
  // 4. Set O.[[Prototype]] to proto.
  O.Prototype = proto;
  // 5. Return O.
  return O;
}

/** https://tc39.es/ecma262/#sec-ordinarycreatefromconstructor */
export function OrdinaryCreateFromConstructor<S extends string>(constructor: ObjectValue, intrinsicDefaultProto: IntrinsicPrototype, internalSlotsList?: readonly S[]): OrdinaryObjectValue<Record<S, unknown>> {
  // Assert: intrinsicDefaultProto is a String value that is this specification's name of an intrinsic object.
  const proto = Q(GetPrototypeFromConstructor(constructor, intrinsicDefaultProto));
  return OrdinaryObjectCreate(proto, internalSlotsList);
}

/** https://tc39.es/ecma262/#sec-getprototypefromconstructor */
export function GetPrototypeFromConstructor(constructor: ObjectValue, intrinsicDefaultProto: IntrinsicPrototype) {
  // Assert: intrinsicDefaultProto is a String value that
  // is this specification's name of an intrinsic object.
  Assert(IsCallable(constructor) === Value.true);
  let proto = Q(Get(constructor, Value('prototype')));
  if (!(proto instanceof ObjectValue)) {
    const realm = Q(GetFunctionRealm(constructor as FunctionObjectValue));
    proto = realm.Intrinsics[intrinsicDefaultProto];
  }
  return proto as ObjectValue;
}
