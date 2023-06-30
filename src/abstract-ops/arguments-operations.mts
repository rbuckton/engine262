import { surroundingAgent } from '../engine.mjs';
import {
  Descriptor,
  Value,
  wellKnownSymbols,
  type PropertyKeyValue,
  ObjectValue,
  UndefinedValue,
  BooleanValue,
  NullValue,
} from '../value.mjs';
import { BoundNames, StringValue } from '../static-semantics/all.mjs';
import { C, NormalCompletion, Q, X, type ValueOrThrowCompletion, type BooleanOrThrowCompletion } from '../completion.mjs';
import { ValueSet } from '../helpers.mjs';
import {
  CreateBuiltinFunction,
  CreateDataProperty,
  DefinePropertyOrThrow,
  ToString,
  SameValue,
  MakeBasicObject,
  OrdinaryObjectCreate,
  OrdinaryGetOwnProperty,
  OrdinaryDefineOwnProperty,
  OrdinaryGet,
  OrdinarySet,
  OrdinaryDelete,
  Get,
  Set,
  HasOwnProperty,
  IsAccessorDescriptor,
  IsDataDescriptor,
  F,
  type BasicObjectValue,
  type OrdinaryObjectValue,
  type ArgumentList,
  type BuiltinFunctionObjectValue,
  type NativeFunctionSteps,
  type FullyPopulatedDescriptor,
} from './all.mjs';
import type { EnvironmentRecord } from '../environment.mjs';
import type { ParseNode } from '../parser/ParseNode.mjs';

// This file covers abstract operations defined in
/** https://tc39.es/ecma262/#sec-arguments-exotic-objects */

/** https://tc39.es/ecma262/#sec-arguments-exotic-objects-getownproperty-p */
function ArgumentsGetOwnProperty(this: ArgumentsExoticObjectValue, P: PropertyKeyValue): NormalCompletion<FullyPopulatedDescriptor | UndefinedValue> {
  const args = this;
  const desc = OrdinaryGetOwnProperty(args, P);
  if (desc instanceof UndefinedValue) {
    return C(desc);
  }
  const map = args.ParameterMap;
  const isMapped = X(HasOwnProperty(map, P));
  if (isMapped === Value.true) {
    desc.Value = X(Get(map, P));
  }
  return C(desc);
}

/** https://tc39.es/ecma262/#sec-arguments-exotic-objects-defineownproperty-p-desc */
function ArgumentsDefineOwnProperty(this: ArgumentsExoticObjectValue, P: PropertyKeyValue, Desc: Descriptor): NormalCompletion<BooleanValue> {
  const args = this;
  const map = args.ParameterMap;
  const isMapped = X(HasOwnProperty(map, P));
  let newArgDesc = Desc;
  if (isMapped === Value.true && IsDataDescriptor(Desc) === true) {
    if (Desc.Value === undefined && Desc.Writable !== undefined && Desc.Writable === Value.false) {
      newArgDesc = Descriptor({ ...Desc });
      newArgDesc.Value = X(Get(map, P));
    }
  }
  const allowed = Q(OrdinaryDefineOwnProperty(args, P, newArgDesc));
  if (allowed === Value.false) {
    return C(Value.false);
  }
  if (isMapped === Value.true) {
    if (IsAccessorDescriptor(Desc) === true) {
      X(map.Delete(P));
    } else {
      if (Desc.Value !== undefined) {
        X(Set(map, P, Desc.Value, Value.false));
      }
      if (Desc.Writable !== undefined && Desc.Writable === Value.false) {
        X(map.Delete(P));
      }
    }
  }
  return C(Value.true);
}

/** https://tc39.es/ecma262/#sec-arguments-exotic-objects-get-p-receiver */
function ArgumentsGet(this: ArgumentsExoticObjectValue, P: PropertyKeyValue, Receiver: Value): ValueOrThrowCompletion {
  const args = this;
  const map = args.ParameterMap;
  const isMapped = X(HasOwnProperty(map, P));
  if (isMapped === Value.false) {
    return C(Q(OrdinaryGet(args, P, Receiver)));
  } else {
    return C(X(Get(map, P)));
  }
}

/** https://tc39.es/ecma262/#sec-arguments-exotic-objects-set-p-v-receiver */
function ArgumentsSet(this: ArgumentsExoticObjectValue, P: PropertyKeyValue, V: Value, Receiver: Value): BooleanOrThrowCompletion {
  const args = this;
  let isMapped;
  let map: ObjectValue | undefined;
  if (SameValue(args, Receiver) === Value.false) {
    isMapped = false;
  } else {
    map = args.ParameterMap;
    isMapped = X(HasOwnProperty(map, P)) === Value.true;
  }
  if (isMapped) {
    X(Set(map!, P, V, Value.false)); // NOTE: unsound non-null assertion
  }
  return C(Q(OrdinarySet(args, P, V, Receiver)));
}

/** https://tc39.es/ecma262/#sec-arguments-exotic-objects-delete-p */
function ArgumentsDelete(this: ArgumentsExoticObjectValue, P: PropertyKeyValue): BooleanOrThrowCompletion {
  const args = this;
  const map = args.ParameterMap;
  const isMapped = X(HasOwnProperty(map, P));
  const result = Q(OrdinaryDelete(args, P));
  if (result === Value.true && isMapped === Value.true) {
    X(map.Delete(P));
  }
  return C(result);
}

export type OrdinaryArgumentsObjectValue = OrdinaryObjectValue<{
  'ParameterMap': UndefinedValue;
}>;

/** https://tc39.es/ecma262/#sec-createunmappedargumentsobject */
export function CreateUnmappedArgumentsObject(argumentsList: ArgumentList): OrdinaryArgumentsObjectValue {
  const len = argumentsList.length;
  const obj = OrdinaryObjectCreate(surroundingAgent.intrinsic('%Object.prototype%'), ['ParameterMap']) as OrdinaryArgumentsObjectValue;
  obj.ParameterMap = Value.undefined;
  X(DefinePropertyOrThrow(obj, Value('length'), Descriptor({
    Value: F(len),
    Writable: Value.true,
    Enumerable: Value.false,
    Configurable: Value.true,
  })));
  let index = 0;
  while (index < len) {
    const val = argumentsList[index];
    X(CreateDataProperty(obj, X(ToString(F(index))), val));
    index += 1;
  }
  X(DefinePropertyOrThrow(obj, wellKnownSymbols.iterator, Descriptor({
    Value: surroundingAgent.intrinsic('%Array.prototype.values%'),
    Writable: Value.true,
    Enumerable: Value.false,
    Configurable: Value.true,
  })));
  X(DefinePropertyOrThrow(obj, Value('callee'), Descriptor({
    Get: surroundingAgent.intrinsic('%ThrowTypeError%'),
    Set: surroundingAgent.intrinsic('%ThrowTypeError%'),
    Enumerable: Value.false,
    Configurable: Value.false,
  })));
  return obj;
}

/** https://tc39.es/ecma262/#sec-makearggetter */
function MakeArgGetter(name: StringValue, env: EnvironmentRecord): BuiltinFunctionObjectValue<Record<never, unknown>> {
  // 1. Let getterClosure be a new Abstract Closure with no parameters that captures name and env and performs the following steps when called:
  //   a. Return env.GetBindingValue(name, false).
  const getterClosure: NativeFunctionSteps = () => env.GetBindingValue(name, Value.false);
  // 2. Let getter be ! CreateBuiltinFunction(getterClosure, 0, "", « »).
  const getter = X(CreateBuiltinFunction(getterClosure, 0, Value(''), []));
  // 3. NOTE: getter is never directly accessible to ECMAScript code.
  // 4. Return getter.
  return getter;
}

/** https://tc39.es/ecma262/#sec-makeargsetter */
function MakeArgSetter(name: StringValue, env: EnvironmentRecord): BuiltinFunctionObjectValue<Record<never, unknown>> {
  // 1. Let setterClosure be a new Abstract Closure with parameters (value) that captures name and env and performs the following steps when called:
  //   a. Return ! env.SetMutableBinding(name, value, false).
  const setterClosure: NativeFunctionSteps = ([value = Value.undefined]) => {
    X(env.SetMutableBinding(name, value, Value.false));
    return C(Value.undefined);
  };
  // 2. Let setter be ! CreateBuiltinFunction(setterClosure, 1, "", « »).
  const setter = X(CreateBuiltinFunction(setterClosure, 1, Value(''), ['Name', 'Env']));
  // 3. NOTE: setter is never directly accessible to ECMAScript code.
  // 4. Return setter.
  return setter;
}

export type ArgumentsExoticObjectValue = BasicObjectValue<{
  ParameterMap: ObjectValue;
  Prototype: ObjectValue | NullValue;
  Extensible: BooleanValue;
}>;

/** https://tc39.es/ecma262/#sec-createmappedargumentsobject */
export function CreateMappedArgumentsObject(func: ObjectValue, formals: ParseNode.FormalParameters, argumentsList: ArgumentList, env: EnvironmentRecord): ArgumentsExoticObjectValue {
  // Assert: formals does not contain a rest parameter, any binding
  // patterns, or any initializers. It may contain duplicate identifiers.
  const len = argumentsList.length;
  const obj = X(MakeBasicObject(['Prototype', 'Extensible', 'ParameterMap'])) as ArgumentsExoticObjectValue;
  obj.GetOwnProperty = ArgumentsGetOwnProperty;
  obj.DefineOwnProperty = ArgumentsDefineOwnProperty;
  obj.Get = ArgumentsGet;
  obj.Set = ArgumentsSet;
  obj.Delete = ArgumentsDelete;
  obj.Prototype = surroundingAgent.intrinsic('%Object.prototype%');
  const map = OrdinaryObjectCreate(Value.null);
  obj.ParameterMap = map;
  const parameterNames = BoundNames(formals);
  const numberOfParameters = parameterNames.length;
  let index = 0;
  while (index < len) {
    const val = argumentsList[index];
    X(CreateDataProperty(obj, X(ToString(F(index))), val));
    index += 1;
  }
  X(DefinePropertyOrThrow(obj, Value('length'), Descriptor({
    Value: F(len),
    Writable: Value.true,
    Enumerable: Value.false,
    Configurable: Value.true,
  })));
  const mappedNames = new ValueSet();
  index = numberOfParameters - 1;
  while (index >= 0) {
    const name = parameterNames[index];
    if (!mappedNames.has(name)) {
      mappedNames.add(name);
      if (index < len) {
        const g = MakeArgGetter(name, env);
        const p = MakeArgSetter(name, env);
        X(map.DefineOwnProperty(X(ToString(F(index))), Descriptor({
          Set: p,
          Get: g,
          Enumerable: Value.false,
          Configurable: Value.true,
        })));
      }
    }
    index -= 1;
  }
  X(DefinePropertyOrThrow(obj, wellKnownSymbols.iterator, Descriptor({
    Value: surroundingAgent.intrinsic('%Array.prototype.values%'),
    Writable: Value.true,
    Enumerable: Value.false,
    Configurable: Value.true,
  })));
  X(DefinePropertyOrThrow(obj, Value('callee'), Descriptor({
    Value: func,
    Writable: Value.true,
    Enumerable: Value.false,
    Configurable: Value.true,
  })));
  return obj;
}
