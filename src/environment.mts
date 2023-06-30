import { AbstractModuleRecord } from './modules.mjs';
import {
  Descriptor,
  ReferenceRecord,
  UndefinedValue,
  ObjectValue,
  Value,
  wellKnownSymbols,
  NullValue,
  BooleanValue,
  type StringValue,
  PrivateName,
} from './value.mjs';
import { surroundingAgent, type GCMarker } from './engine.mjs';
import {
  Assert,
  DefinePropertyOrThrow,
  Get,
  HasOwnProperty,
  HasProperty,
  IsDataDescriptor,
  IsExtensible,
  Set,
  ToBoolean,
  type ECMAScriptFunctionObjectValue,
} from './abstract-ops/all.mjs';
import {
  NormalCompletion,
  ThrowCompletion,
  type UnusedOrThrowCompletion,
  type ValueOrThrowCompletion,
  type BooleanOrThrowCompletion,
  unused,
  Q, X, C, type ReferenceOrThrowCompletion,
} from './completion.mjs';
import { ValueMap } from './helpers.mjs';

/** https://tc39.es/ecma262/#sec-environment-records */
export abstract class EnvironmentRecord {
  OuterEnv!: EnvironmentRecord | NullValue; // NOTE: unsound definite assignment operator (`!`)

  /** https://tc39.es/ecma262/#sec-declarative-environment-records-hasbinding-n */
  abstract HasBinding(N: StringValue): BooleanOrThrowCompletion;

  /** https://tc39.es/ecma262/#sec-declarative-environment-records-createmutablebinding-n-d */
  abstract CreateMutableBinding(N: StringValue, D: BooleanValue): UnusedOrThrowCompletion;

  /** https://tc39.es/ecma262/#sec-declarative-environment-records-createimmutablebinding-n-s */
  abstract CreateImmutableBinding(N: StringValue, S: BooleanValue): UnusedOrThrowCompletion;

  /** https://tc39.es/ecma262/#sec-declarative-environment-records-initializebinding-n-v */
  abstract InitializeBinding(N: StringValue, V: Value): UnusedOrThrowCompletion;

  /** https://tc39.es/ecma262/#sec-declarative-environment-records-setmutablebinding-n-v-s */
  abstract SetMutableBinding(N: StringValue, V: Value, S: BooleanValue): UnusedOrThrowCompletion;

  /** https://tc39.es/ecma262/#sec-declarative-environment-records-getbindingvalue-n-s */
  abstract GetBindingValue(N: StringValue, S: BooleanValue): ValueOrThrowCompletion;

  /** https://tc39.es/ecma262/#sec-declarative-environment-records-deletebinding-n */
  abstract DeleteBinding(N: StringValue): BooleanOrThrowCompletion;

  /** https://tc39.es/ecma262/#sec-declarative-environment-records-hasthisbinding */
  abstract HasThisBinding(): BooleanValue;

  /** https://tc39.es/ecma262/#sec-declarative-environment-records-hassuperbinding */
  abstract HasSuperBinding(): BooleanValue;

  /** https://tc39.es/ecma262/#sec-declarative-environment-records-withbaseobject */
  abstract WithBaseObject(): ObjectValue | UndefinedValue;

  // NON-SPEC
  mark(m: GCMarker) {
    m(this.OuterEnv);
  }
}

// NON-SPEC
type Binding =
  | DirectBinding
  | IndirectBinding;

// NON-SPEC
interface DirectBinding {
  indirect: false;
  initialized: boolean;
  mutable: boolean;
  strict: boolean | undefined;
  deletable: boolean;
  value: Value | undefined;
  mark(m: GCMarker): void;
}

// NON-SPEC
interface IndirectBinding {
  indirect: true;
  initialized: true;
  target: readonly [AbstractModuleRecord, StringValue];
  strict?: undefined;
  mutable?: undefined;
  deletable?: undefined;
  value?: undefined;
  mark(m: GCMarker): void;
}

/** https://tc39.es/ecma262/#sec-declarative-environment-records */
export class DeclarativeEnvironmentRecord extends EnvironmentRecord {
  // NON-SPEC
  bindings = new ValueMap<StringValue, Binding>();

  /** https://tc39.es/ecma262/#sec-declarative-environment-records-hasbinding-n */
  HasBinding(N: StringValue): BooleanOrThrowCompletion {
    const envRec = this;
    // 1. If envRec has a binding for the name that is the value of N, return true.
    if (envRec.bindings.has(N)) {
      return C(Value.true);
    }
    // 2. Return false.
    return C(Value.false);
  }

  /** https://tc39.es/ecma262/#sec-declarative-environment-records-createmutablebinding-n-d */
  CreateMutableBinding(N: StringValue, D: BooleanValue): UnusedOrThrowCompletion {
    const envRec = this;
    // 1. Assert: envRec does not already have a binding for N.
    Assert(!envRec.bindings.has(N));
    // 2. Create a mutable binding in envRec for N and record that it is uninitialized. If D
    //    is true, record that the newly created binding may be deleted by a subsequent
    //    DeleteBinding call.
    this.bindings.set(N, {
      indirect: false,
      initialized: false,
      mutable: true,
      strict: undefined,
      deletable: D === Value.true,
      value: undefined,
      mark(m) {
        m(this.value);
      },
    });
    // 3. Return unused.
    return unused;
  }

  /** https://tc39.es/ecma262/#sec-declarative-environment-records-createimmutablebinding-n-s */
  CreateImmutableBinding(N: StringValue, S: BooleanValue): UnusedOrThrowCompletion {
    const envRec = this;
    // 1. Assert: envRec does not already have a binding for N.
    Assert(!envRec.bindings.has(N));
    // 2. Create an immutable binding in envRec for N and record that it is uninitialized. If
    //    S is true, record that the newly created binding is a strict binding.
    this.bindings.set(N, {
      indirect: false,
      initialized: false,
      mutable: false,
      strict: S === Value.true,
      deletable: false,
      value: undefined,
      mark(m) {
        m(this.value);
      },
    });
    // 3. Return unused.
    return unused;
  }

  /** https://tc39.es/ecma262/#sec-declarative-environment-records-initializebinding-n-v */
  InitializeBinding(N: StringValue, V: Value): UnusedOrThrowCompletion {
    const envRec = this;
    // 1. Assert: envRec must have an uninitialized binding for N.
    const binding = envRec.bindings.get(N);
    Assert(binding !== undefined && binding.initialized === false);
    // 2. Set the bound value for N in envRec to V.
    binding.value = V;
    // 3. Record that the binding for N in envRec has been initialized.
    binding.initialized = true;
    // 4. Return unused.
    return unused;
  }

  /** https://tc39.es/ecma262/#sec-declarative-environment-records-setmutablebinding-n-v-s */
  SetMutableBinding(N: StringValue, V: Value, S: BooleanValue): UnusedOrThrowCompletion {
    const envRec = this;
    // 1. If envRec does not have a binding for N, then
    if (!envRec.bindings.has(N)) {
      // a. If S is true, throw a ReferenceError exception.
      if (S === Value.true) {
        return C(surroundingAgent.Throw('ReferenceError', 'NotDefined', N));
      }
      // b. Perform ! envRec.CreateMutableBinding(N, true).
      X(envRec.CreateMutableBinding(N, Value.true));
      // c. Perform ! envRec.InitializeBinding(N, V).
      X(envRec.InitializeBinding(N, V));
      // d. Return unused.
      return unused;
    }
    const binding = this.bindings.get(N)!;
    // 2. If the binding for N in envRec is a strict binding, set S to true.
    if (binding.strict === true) {
      S = Value.true;
    }
    // 3. If the binding for N in envRec has not yet been initialized, throw a ReferenceError exception.
    if (binding.initialized === false) {
      return C(surroundingAgent.Throw('ReferenceError', 'NotInitialized', N));
    }
    // 4. Else if the binding for N in envRec is a mutable binding, change its bound value to V.
    if (binding.mutable === true) {
      binding.value = V;
    } else { // 5. Else,
      // a. Assert: This is an attempt to change the value of an immutable binding.
      // b. If S is true, throw a TypeError exception.
      if (S === Value.true) {
        return C(surroundingAgent.Throw('TypeError', 'AssignmentToConstant', N));
      }
    }
    // 6. Return unused.
    return unused;
  }

  /** https://tc39.es/ecma262/#sec-declarative-environment-records-getbindingvalue-n-s */
  GetBindingValue(N: StringValue, _S: BooleanValue): ValueOrThrowCompletion {
    const envRec = this;
    // 1. Assert: envRec has a binding for N.
    const binding = envRec.bindings.get(N);
    Assert(binding !== undefined);
    // 2. If the binding for N in envRec is an uninitialized binding, throw a ReferenceError exception.
    if (binding.initialized === false) {
      return C(surroundingAgent.Throw('ReferenceError', 'NotInitialized', N));
    }
    // 3. Return the value currently bound to N in envRec.
    return C(binding.value!); // NOTE: unsound non-null assertion
  }

  /** https://tc39.es/ecma262/#sec-declarative-environment-records-deletebinding-n */
  DeleteBinding(N: StringValue): BooleanOrThrowCompletion {
    const envRec = this;
    // 1. Assert: envRec has a binding for the name that is the value of N.
    const binding = envRec.bindings.get(N);
    Assert(binding !== undefined);
    // 2. If the binding for N in envRec cannot be deleted, return false.
    if (binding.deletable === false) {
      return C(Value.false);
    }
    // 3. Remove the binding for N from envRec.
    envRec.bindings.delete(N);
    // 4. Return true.
    return C(Value.true);
  }

  /** https://tc39.es/ecma262/#sec-declarative-environment-records-hasthisbinding */
  HasThisBinding(): BooleanValue {
    // 1. Return false.
    return Value.false;
  }

  /** https://tc39.es/ecma262/#sec-declarative-environment-records-hassuperbinding */
  HasSuperBinding(): BooleanValue {
    // 1. Return false.
    return Value.false;
  }

  /** https://tc39.es/ecma262/#sec-declarative-environment-records-withbaseobject */
  WithBaseObject(): ObjectValue | UndefinedValue {
    // 1. Return undefined.
    return Value.undefined;
  }

  // NON-SPEC
  override mark(m: GCMarker) {
    m(this.bindings);
  }
}

/** https://tc39.es/ecma262/#sec-object-environment-records */
export class ObjectEnvironmentRecord extends EnvironmentRecord {
  BindingObject!: ObjectValue; // NOTE: unsound definite assignment operator (`!`)
  IsWithEnvironment!: BooleanValue; // NOTE: unsound definite assignment operator (`!`)

  /** https://tc39.es/ecma262/#sec-object-environment-records-hasbinding-n */
  HasBinding(N: StringValue): BooleanOrThrowCompletion {
    const envRec = this;
    // 1. Let bindingObject be envRec.[[BindingObject]].
    const bindingObject = envRec.BindingObject;
    // 2. Let foundBinding be ? HasProperty(bindingObject, N).
    const foundBinding = Q(HasProperty(bindingObject, N));
    // 3. If foundBinding is false, return false.
    if (foundBinding === Value.false) {
      return C(Value.false);
    }
    // 4. If envRec.[[IsWithEnvironment]] is false, return true.
    if (envRec.IsWithEnvironment === Value.false) {
      return C(Value.true);
    }
    // 5. Let unscopables be ? Get(bindingObject, @@unscopables).
    const unscopables = Q(Get(bindingObject, wellKnownSymbols.unscopables));
    // 6. If Type(unscopables) is Object, then
    if (unscopables instanceof ObjectValue) {
      // a. Let blocked be ! ToBoolean(? Get(unscopables, N)).
      const blocked = ToBoolean(Q(Get(unscopables, N)));
      // b. If blocked is true, return false.
      if (blocked === Value.true) {
        return C(Value.false);
      }
    }
    // 7. Return true.
    return C(Value.true);
  }

  /** https://tc39.es/ecma262/#sec-object-environment-records-createmutablebinding-n-d */
  CreateMutableBinding(N: StringValue, D: BooleanValue): UnusedOrThrowCompletion {
    const envRec = this;
    // 1. Let bindingObject be envRec.[[BindingObject]].
    const bindingObject = envRec.BindingObject;
    // 2. Perform ? DefinePropertyOrThrow(bindings, N, PropertyDescriptor { [[Value]]: undefined, [[Writable]]: true, [[Enumerable]]: true, [[Configurable]]: D }).
    Q(DefinePropertyOrThrow(bindingObject, N, Descriptor({
      Value: Value.undefined,
      Writable: Value.true,
      Enumerable: Value.true,
      Configurable: D,
    })));
    // 3. Return unused
    return unused;
  }

  /** https://tc39.es/ecma262/#sec-object-environment-records-createimmutablebinding-n-s */
  CreateImmutableBinding(_N: StringValue, _S: BooleanValue): never {
    Assert(false, 'CreateImmutableBinding called on an Object Environment Record');
  }

  /** https://tc39.es/ecma262/#sec-object-environment-records-initializebinding-n-v */
  InitializeBinding(N: StringValue, V: Value): UnusedOrThrowCompletion {
    const envRec = this;
    // 1. Perform ? envRec.SetMutableBinding(N, V, false).
    Q(envRec.SetMutableBinding(N, V, Value.false));
    // 2. Return unused.
    return unused;
  }

  /** https://tc39.es/ecma262/#sec-object-environment-records-setmutablebinding-n-v-s */
  SetMutableBinding(N: StringValue, V: Value, S: BooleanValue): UnusedOrThrowCompletion {
    const envRec = this;
    // 1. Let bindingObject be envRec.[[BindingObject]].
    const bindingObject = envRec.BindingObject;
    // 2. Let stillExists be ? HasProperty(bindingObject, N).
    const stillExists = Q(HasProperty(bindingObject, N));
    // 3. If stillExists is false and S is true, throw a ReferenceError exception.
    if (stillExists === Value.false && S === Value.true) {
      return C(surroundingAgent.Throw('ReferenceError', 'NotDefined', N));
    }
    // 4. Perform ? Set(bindingObject, N, V, S).
    Q(Set(bindingObject, N, V, S));
    // 5. Return unused.
    return unused;
  }

  /** https://tc39.es/ecma262/#sec-object-environment-records-getbindingvalue-n-s */
  GetBindingValue(N: StringValue, S: BooleanValue): ValueOrThrowCompletion {
    const envRec = this;
    // 1. Let bindingObject be the binding object for envRec.
    const bindingObject = envRec.BindingObject;
    // 2. Let value be ? HasProperty(bindingObject, N).
    const value = Q(HasProperty(bindingObject, N));
    // 3. If value is false, then
    if (value === Value.false) {
      // a. If S is false, return the value undefined; otherwise throw a ReferenceError exception.
      if (S === Value.false) {
        return C(Value.undefined);
      } else {
        return surroundingAgent.Throw('ReferenceError', 'NotDefined', N);
      }
    }
    // 4. Return ? Get(bindingObject, N).
    return C(Q(Get(bindingObject, N)));
  }

  /** https://tc39.es/ecma262/#sec-object-environment-records-deletebinding-n */
  DeleteBinding(N: StringValue): BooleanOrThrowCompletion {
    const envRec = this;
    // 1. Let bindingObject be envRec.[[BindingObject]].
    const bindingObject = envRec.BindingObject;
    // 3. Return ? bindingObject.[[Delete]](N).
    return C(Q(bindingObject.Delete(N)));
  }

  /** https://tc39.es/ecma262/#sec-object-environment-records-hasthisbinding */
  HasThisBinding(): BooleanValue {
    // 1. Return false.
    return Value.false;
  }

  /** https://tc39.es/ecma262/#sec-object-environment-records-hassuperbinding */
  HasSuperBinding(): BooleanValue {
    // 1. Return falase.
    return Value.false;
  }

  /** https://tc39.es/ecma262/#sec-object-environment-records-withbaseobject */
  WithBaseObject(): ObjectValue | UndefinedValue {
    const envRec = this;
    // 1. If envRec.[[IsWithEnvironment]] is true, return envRec.[[BindingObject]].
    if (envRec.IsWithEnvironment === Value.true) {
      return envRec.BindingObject;
    }
    // 2. Otherwise, return undefined.
    return Value.undefined;
  }

  // NON-SPEC
  override mark(m: GCMarker) {
    m(this.BindingObject);
  }
}

/** https://tc39.es/ecma262/#sec-function-environment-records */
export class FunctionEnvironmentRecord extends DeclarativeEnvironmentRecord {
  ThisValue!: Value; // NOTE: unsound definite assignment operator (`!`)
  ThisBindingStatus!: 'lexical' | 'initialized' | 'uninitialized'; // NOTE: unsound definite assignment operator (`!`)
  FunctionObject!: ECMAScriptFunctionObjectValue; // NOTE: unsound definite assignment operator (`!`)
  NewTarget!: ObjectValue | UndefinedValue; // NOTE: unsound definite assignment operator (`!`)

  /** https://tc39.es/ecma262/#sec-bindthisvalue */
  BindThisValue(V: Value): ValueOrThrowCompletion {
    const envRec = this;
    // 1. Assert: envRec.[[ThisBindingStatus]] is not lexical.
    Assert(envRec.ThisBindingStatus !== 'lexical');
    // 2. If envRec.[[ThisBindingStatus]] is initialized, throw a ReferenceError exception.
    if (envRec.ThisBindingStatus === 'initialized') {
      return C(surroundingAgent.Throw('ReferenceError', 'InvalidThis'));
    }
    // 3. Set envRec.[[ThisValue]] to V.
    envRec.ThisValue = V;
    // 4. Set envRec.[[ThisBindingStatus]] to initialized.
    envRec.ThisBindingStatus = 'initialized';
    // 5. Return V.
    return C(V);
  }

  /** https://tc39.es/ecma262/#sec-function-environment-records-hasthisbinding */
  override HasThisBinding(): BooleanValue {
    const envRec = this;
    // 1. If envRec.[[ThisBindingStatus]] is lexical, return false; otherwise, return true.
    if (envRec.ThisBindingStatus === 'lexical') {
      return Value.false;
    } else {
      return Value.true;
    }
  }

  /** https://tc39.es/ecma262/#sec-function-environment-records-hassuperbinding */
  override HasSuperBinding(): BooleanValue {
    const envRec = this;
    // 1. If envRec.[[ThisBindingStatus]] is lexical, return false.
    if (envRec.ThisBindingStatus === 'lexical') {
      return Value.false;
    }
    // 2. If envRec.[[FunctionObject]].[[HomeObject]] has the value undefined, return false; otherwise, return true.
    if (envRec.FunctionObject.HomeObject === Value.undefined) {
      return Value.false;
    } else {
      return Value.true;
    }
  }

  /** https://tc39.es/ecma262/#sec-function-environment-records-getthisbinding */
  GetThisBinding(): ValueOrThrowCompletion {
    const envRec = this;
    // 1. Assert: envRec.[[ThisBindingStatus]] is not lexical.
    Assert(envRec.ThisBindingStatus !== 'lexical');
    // 2. If envRec.[[ThisBindingStatus]] is uninitialized, throw a ReferenceError exception.
    if (envRec.ThisBindingStatus === 'uninitialized') {
      return surroundingAgent.Throw('ReferenceError', 'InvalidThis');
    }
    // 3. Return envRec.[[ThisValue]].
    return C(envRec.ThisValue);
  }

  /** https://tc39.es/ecma262/#sec-getsuperbase */
  GetSuperBase(): NormalCompletion<ObjectValue | NullValue | UndefinedValue> | ThrowCompletion {
    const envRec = this;
    // 1. Let home be envRec.[[FunctionObject]].[[HomeObject]].
    const home = envRec.FunctionObject.HomeObject;
    // 2. If home has the value undefined, return undefined.
    if (home === Value.undefined) {
      return C(Value.undefined);
    }
    // 3. Assert: Type(home) is Object.
    Assert(home instanceof ObjectValue);
    // 4. Return ? home.[[GetPrototypeOf]]().
    return C(Q(home.GetPrototypeOf()));
  }

  override mark(m: GCMarker) {
    super.mark(m);
    m(this.ThisValue);
    m(this.FunctionObject);
    m(this.NewTarget);
  }
}

/** https://tc39.es/ecma262/#sec-global-environment-records */
export class GlobalEnvironmentRecord extends EnvironmentRecord {
  ObjectRecord!: ObjectEnvironmentRecord; // NOTE: unsound definite assignment operator (`!`)
  GlobalThisValue!: ObjectValue; // NOTE: unsound definite assignment operator (`!`)
  DeclarativeRecord!: DeclarativeEnvironmentRecord; // NOTE: unsound definite assignment operator (`!`)
  VarNames!: StringValue[]; // NOTE: unsound definite assignment operator (`!`)

  /** https://tc39.es/ecma262/#sec-global-environment-records-hasbinding-n */
  HasBinding(N: StringValue): BooleanOrThrowCompletion {
    const envRec = this;
    // 1. Let DclRec be envRec.[[DeclarativeRecord]].
    const DclRec = envRec.DeclarativeRecord;
    // 2. If ! DclRec.HasBinding(N) is true, return true.
    if (X(DclRec.HasBinding(N)) === Value.true) {
      return C(Value.true);
    }
    // 3. Let ObjRec be envRec.[[ObjectRecord]].
    const ObjRec = envRec.ObjectRecord;
    // 4. Return ? ObjRec.HasBinding(N).
    return C(Q(ObjRec.HasBinding(N)));
  }

  /** https://tc39.es/ecma262/#sec-global-environment-records-createmutablebinding-n-d */
  CreateMutableBinding(N: StringValue, D: BooleanValue): UnusedOrThrowCompletion {
    const envRec = this;
    // 1. Let DclRec be envRec.[[DeclarativeRecord]].
    const DclRec = envRec.DeclarativeRecord;
    // 2. If ! DclRec.HasBinding(N) is true, throw a TypeError exception.
    if (X(DclRec.HasBinding(N)) === Value.true) {
      return C(surroundingAgent.Throw('TypeError', 'AlreadyDeclared', N));
    }
    // 3. Return ! DclRec.CreateMutableBinding(N, D).
    return C(X(DclRec.CreateMutableBinding(N, D)));
  }

  /** https://tc39.es/ecma262/#sec-global-environment-records-createimmutablebinding-n-s */
  CreateImmutableBinding(N: StringValue, S: BooleanValue): UnusedOrThrowCompletion {
    const envRec = this;
    // 1. Let DclRec be envRec.[[DeclarativeRecord]].
    const DclRec = envRec.DeclarativeRecord;
    // 2. If ! DclRec.HasBinding(N) is true, throw a TypeError exception.
    if (X(DclRec.HasBinding(N)) === Value.true) {
      return C(surroundingAgent.Throw('TypeError', 'AlreadyDeclared', N));
    }
    // 3. Return ! DclRec.CreateImmutableBinding(N, S).
    return C(X(DclRec.CreateImmutableBinding(N, S)));
  }

  /** https://tc39.es/ecma262/#sec-global-environment-records-initializebinding-n-v */
  InitializeBinding(N: StringValue, V: Value): UnusedOrThrowCompletion {
    const envRec = this;
    // 1. Let DclRec be envRec.[[DeclarativeRecord]].
    const DclRec = envRec.DeclarativeRecord;
    // 2. If ! DclRec.HasBinding(N) is true, then
    if (X(DclRec.HasBinding(N)) === Value.true) {
      // a. Return ! DclRec.InitializeBinding(N, V).
      return C(X(DclRec.InitializeBinding(N, V)));
    }
    // 3. Assert: If the binding exists, it must be in the object Environment Record.
    // 4. Let ObjRec be envRec.[[ObjectRecord]].
    const ObjRec = envRec.ObjectRecord;
    // 4. Return ? ObjRec.InitializeBinding(N, V).
    return C(Q(ObjRec.InitializeBinding(N, V)));
  }

  /** https://tc39.es/ecma262/#sec-global-environment-records-setmutablebinding-n-v-s */
  SetMutableBinding(N: StringValue, V: Value, S: BooleanValue): UnusedOrThrowCompletion {
    const envRec = this;
    // 1. Let DclRec be envRec.[[DeclarativeRecord]].
    const DclRec = envRec.DeclarativeRecord;
    // 2. If ! DclRec.HasBinding(N) is true, then
    if (X(DclRec.HasBinding(N)) === Value.true) {
      // a. Return ? DclRec.SetMutableBinding(N, V, S).
      return C(Q(DclRec.SetMutableBinding(N, V, S)));
    }
    // 4. Let ObjRec be envRec.[[ObjectRecord]].
    const ObjRec = envRec.ObjectRecord;
    // 5. Return ? ObjRec.SetMutableBinding(N, V, S).
    return C(Q(ObjRec.SetMutableBinding(N, V, S)));
  }

  /** https://tc39.es/ecma262/#sec-global-environment-records-getbindingvalue-n-s */
  GetBindingValue(N: StringValue, S: BooleanValue): ValueOrThrowCompletion {
    const envRec = this;
    // 1. Let DclRec be envRec.[[DeclarativeRecord]].
    const DclRec = envRec.DeclarativeRecord;
    // 2. If ! DclRec.HasBinding(N) is true, then
    if (X(DclRec.HasBinding(N)) === Value.true) {
      // a. Return ? DclRec.GetBindingValue(N, S).
      return C(Q(DclRec.GetBindingValue(N, S)));
    }
    // 3. Let ObjRec be envRec.[[ObjectRecord]].
    const ObjRec = envRec.ObjectRecord;
    // 4. Return ? ObjRec.GetBindingValue(N, S).
    return C(Q(ObjRec.GetBindingValue(N, S)));
  }

  /** https://tc39.es/ecma262/#sec-global-environment-records-deletebinding-n */
  DeleteBinding(N: StringValue): BooleanOrThrowCompletion {
    const envRec = this;
    // 1. Let DclRec be envRec.[[DeclarativeRecord]].
    const DclRec = this.DeclarativeRecord;
    // 2. If ! DclRec.HasBinding(N) is true, then
    if (X(DclRec.HasBinding(N)) === Value.true) {
      // a. Return ! DclRec.DeleteBinding(N).
      return C(X(DclRec.DeleteBinding(N)));
    }
    // 3. Let ObjRec be envRec.[[ObjectRecord]].
    const ObjRec = envRec.ObjectRecord;
    // 4. Let globalObject be the binding object for ObjRec.
    const globalObject = ObjRec.BindingObject;
    // 5. Let existingProp be ? HasOwnProperty(globalObject, N).
    const existingProp = Q(HasOwnProperty(globalObject, N));
    // 6. If existingProp is true, then
    if (existingProp === Value.true) {
      // a. Let status be ? ObjRec.DeleteBinding(N).
      const status = Q(ObjRec.DeleteBinding(N));
      // b. If status is true ...
      if (status === Value.true) {
        // ... and envRec.[[VarNames]] contains N, then
        const i = envRec.VarNames.findIndex((v) => v.stringValue() === N.stringValue());
        if (i >= 0) {
          // i. Remove N from envRec.[[VarNames]].
          envRec.VarNames.splice(i, 1);
        }
      }
      // c. Return status.
      return C(status);
    }
    // 7. Return true.
    return C(Value.true);
  }

  /** https://tc39.es/ecma262/#sec-global-environment-records-hasthisbinding */
  HasThisBinding(): BooleanValue {
    // Return true.
    return Value.true;
  }

  /** https://tc39.es/ecma262/#sec-global-environment-records-hassuperbinding */
  HasSuperBinding(): BooleanValue {
    // 1. Return false.
    return Value.false;
  }

  /** https://tc39.es/ecma262/#sec-global-environment-records-withbaseobject */
  WithBaseObject(): ObjectValue | UndefinedValue {
    // 1. Return undefined.
    return Value.undefined;
  }

  /** https://tc39.es/ecma262/#sec-global-environment-records-getthisbinding */
  GetThisBinding(): NormalCompletion<ObjectValue> {
    const envRec = this;
    // 1. Return envRec.[[GlobalThisValue]].
    return C(envRec.GlobalThisValue);
  }

  /** https://tc39.es/ecma262/#sec-hasvardeclaration */
  HasVarDeclaration(N: StringValue): BooleanValue {
    const envRec = this;
    // 1. Let varDeclaredNames be envRec.[[VarNames]].
    const varDeclaredNames = envRec.VarNames;
    // 2. If varDeclaredNames contains N, return true.
    if (varDeclaredNames.some((v) => v.stringValue() === N.stringValue())) {
      return Value.true;
    }
    // 3. Return false.
    return Value.false;
  }

  /** https://tc39.es/ecma262/#sec-haslexicaldeclaration */
  HasLexicalDeclaration(N: StringValue): BooleanValue {
    const envRec = this;
    // 1. Let DclRec be envRec.[[DeclarativeRecord]].
    const DclRec = envRec.DeclarativeRecord;
    // 2. Return ! DclRec.HasBinding(N);
    return X(DclRec.HasBinding(N));
  }

  /** https://tc39.es/ecma262/#sec-hasrestrictedglobalproperty */
  HasRestrictedGlobalProperty(N: StringValue): BooleanOrThrowCompletion {
    const envRec = this;
    // 1. Let ObjRec be envRec.[[ObjectRecord]].
    const ObjRec = envRec.ObjectRecord;
    // 2. Let globalObject be the binding object for ObjRec.
    const globalObject = ObjRec.BindingObject;
    // 3. Let existingProp be ? globalObject.[[GetOwnProperty]](N).
    const existingProp = Q(globalObject.GetOwnProperty(N));
    // 4. If existingProp is undefined, return false.
    if (existingProp instanceof UndefinedValue) {
      return C(Value.false);
    }
    // 5. If existingProp.[[Configurable]] is true, return false.
    if (existingProp.Configurable === Value.true) {
      return C(Value.false);
    }
    // 6. Return true.
    return C(Value.true);
  }

  /** https://tc39.es/ecma262/#sec-candeclareglobalvar */
  CanDeclareGlobalVar(N: StringValue): BooleanOrThrowCompletion {
    const envRec = this;
    // 1. Let ObjRec be envRec.[[ObjectRecord]].
    const ObjRec = envRec.ObjectRecord;
    // 2. Let globalObject be the binding object for ObjRec.
    const globalObject = ObjRec.BindingObject;
    // 3. Let hasProperty be ? HasOwnProperty(globalObject, N).
    const hasProperty = Q(HasOwnProperty(globalObject, N));
    // 4. If hasProperty is true, return true.
    if (hasProperty === Value.true) {
      return C(Value.true);
    }
    // 5. Return ? IsExtensible(globalObject).
    return C(Q(IsExtensible(globalObject)));
  }

  /** https://tc39.es/ecma262/#sec-candeclareglobalfunction */
  CanDeclareGlobalFunction(N: StringValue): BooleanOrThrowCompletion {
    const envRec = this;
    // 1. Let ObjRec be envRec.[[ObjectRecord]].
    const ObjRec = envRec.ObjectRecord;
    // 2. Let globalObject be ObjRec.[[BindingObject]].
    const globalObject = ObjRec.BindingObject;
    // 3. Let existingProp be ? globalObject.[[GetOwnProperty]](N).
    const existingProp = Q(globalObject.GetOwnProperty(N));
    // 4. If existingProp is undefined, return ? IsExtensible(globalObject).
    if (existingProp instanceof UndefinedValue) {
      return C(Q(IsExtensible(globalObject)));
    }
    // 5. If existingProp.[[Configurable]] is true, return true.
    if (existingProp.Configurable === Value.true) {
      return C(Value.true);
    }
    // 6. If IsDataDescriptor(existingProp) is true and existingProp has attribute values
    //    { [[Writable]]: true, [[Enumerable]]: true }, return true.
    if (IsDataDescriptor(existingProp) === true
        && existingProp.Writable === Value.true
        && existingProp.Enumerable === Value.true) {
      return C(Value.true);
    }
    // 7. Return false.
    return C(Value.false);
  }

  /** https://tc39.es/ecma262/#sec-createglobalvarbinding */
  CreateGlobalVarBinding(N: StringValue, D: BooleanValue): UnusedOrThrowCompletion {
    const envRec = this;
    // 1. Let ObjRec be envRec.[[ObjectRecord]].
    const ObjRec = envRec.ObjectRecord;
    // 2. Let globalObject be ObjRec.[[BindingObject]].
    const globalObject = ObjRec.BindingObject;
    // 3. Let hasProperty be ? HasOwnProperty(globalObject, N).
    const hasProperty = Q(HasOwnProperty(globalObject, N));
    // 4. Let extensible be ? IsExtensible(globalObject).
    const extensible = Q(IsExtensible(globalObject));
    // 5. If hasProperty is false and extensible is true, then
    if (hasProperty === Value.false && extensible === Value.true) {
      // a. Perform ? ObjRec.CreateMutableBinding(N, D).
      Q(ObjRec.CreateMutableBinding(N, D));
      // b. Perform ? ObjRec.InitializeBinding(N, undefined).
      Q(ObjRec.InitializeBinding(N, Value.undefined));
    }
    // 6. If envRec.[[VarNames]] does not contain N, then
    if (!envRec.VarNames.some((v) => v.stringValue() === N.stringValue())) {
      // a. Append N to envRec.[[VarNames]].
      envRec.VarNames.push(N);
    }
    // 7. Return unusd.
    return unused;
  }

  /** https://tc39.es/ecma262/#sec-createglobalfunctionbinding */
  CreateGlobalFunctionBinding(N: StringValue, V: Value, D: BooleanValue): UnusedOrThrowCompletion {
    const envRec = this;
    // 1. Let ObjRec be envRec.[[ObjectRecord]].
    const ObjRec = envRec.ObjectRecord;
    // 2. Let globalObject be ObjRec.[[BindingObject]].
    const globalObject = ObjRec.BindingObject;
    // 3. Let existingProp be ? globalObject.[[GetOwnProperty]](N).
    const existingProp = Q(globalObject.GetOwnProperty(N));
    // 4. If existingProp is undefined or existingProp.[[Configurable]] is true, then
    let desc: Descriptor;
    if (existingProp instanceof UndefinedValue || existingProp.Configurable === Value.true) {
      // a. Let desc be the PropertyDescriptor { [[Value]]: V, [[Writable]]: true, [[Enumerable]]: true, [[Configurable]]: D }.
      desc = Descriptor({
        Value: V,
        Writable: Value.true,
        Enumerable: Value.true,
        Configurable: D,
      });
    } else { // 5. Else,
      // a. Let desc be the PropertyDescriptor { [[Value]]: V }.
      desc = Descriptor({
        Value: V,
      });
    }
    // 6. Perform ? DefinePropertyOrThrow(globalObject, N, desc).
    Q(DefinePropertyOrThrow(globalObject, N, desc));
    // 7. Perform ? Set(globalObject, N, V, false).
    Q(Set(globalObject, N, V, Value.false));
    // 8. If envRec.[[VarNames]] does not contain N, then
    if (!envRec.VarNames.some((v) => v.stringValue() === N.stringValue())) {
      // a. Append N to envRec.[[VarNames]].
      envRec.VarNames.push(N);
    }
    // 9. Return unused.
    return unused;
  }

  override mark(m: GCMarker) {
    m(this.ObjectRecord);
    m(this.GlobalThisValue);
    m(this.DeclarativeRecord);
  }
}

/** https://tc39.es/ecma262/#sec-module-environment-records */
export class ModuleEnvironmentRecord extends DeclarativeEnvironmentRecord {
  /** https://tc39.es/ecma262/#sec-module-environment-records-getbindingvalue-n-s */
  override GetBindingValue(N: StringValue, S: BooleanValue): ValueOrThrowCompletion {
    const envRec = this;
    // 1. Assert: S is true.
    Assert(S === Value.true);
    // 2. Assert: envRec has a binding for N.
    const binding = envRec.bindings.get(N);
    Assert(binding !== undefined);
    // 3. If the binding for N is an indirect binding, then
    if (binding.indirect === true) {
      // a. Let M and N2 be the indirection values provided when this binding for N was created.
      const [M, N2] = binding.target;
      // b.Let targetEnv be M.[[Environment]].
      const targetEnv = M.Environment;
      // c. If targetEnv is empty, throw a ReferenceError exception.
      if (targetEnv === undefined) {
        return C(surroundingAgent.Throw('ReferenceError', 'NotDefined', N));
      }
      // d. Return ? targetEnv.GetBindingValue(N2, true).
      return C(Q(targetEnv.GetBindingValue(N2, Value.true)));
    }
    // 4. If the binding for N in envRec is an uninitialized binding, throw a ReferenceError exception.
    if (binding.initialized === false) {
      return C(surroundingAgent.Throw('ReferenceError', 'NotInitialized', N));
    }
    // 5. Return the value currently bound to N in envRec.
    return C(binding.value!); // NOTE: unsound non-null assertion
  }

  /** https://tc39.es/ecma262/#sec-module-environment-records-deletebinding-n */
  override DeleteBinding(_N: StringValue): never {
    Assert(false, 'This method is never invoked. See #sec-delete-operator-static-semantics-early-errors');
  }

  /** https://tc39.es/ecma262/#sec-module-environment-records-hasthisbinding */
  override HasThisBinding(): BooleanValue {
    // 1. Return true.
    return Value.true;
  }

  /** https://tc39.es/ecma262/#sec-module-environment-records-getthisbinding */
  GetThisBinding(): NormalCompletion<UndefinedValue> {
    // 1. Return undefined.
    return C(Value.undefined);
  }

  /** https://tc39.es/ecma262/#sec-createimportbinding */
  CreateImportBinding(N: StringValue, M: AbstractModuleRecord, N2: StringValue): 'unused' {
    const envRec = this;
    // 1. Assert: envRec does not already have a binding for N.
    Assert(X(envRec.HasBinding(N)) === Value.false);
    // 2. Assert: When M.[[Environment]] is instantiated it will have a direct binding for N2.
    // 3. Create an immutable indirect binding in envRec for N that references M and N2 as its target binding and record that the binding is initialized.
    envRec.bindings.set(N, {
      indirect: true,
      target: [M, N2],
      initialized: true,
      mark(m) {
        m(this.target![0]);
        m(this.target![1]);
      },
    });
    // 3. Return unused.
    return 'unused';
  }
}

/** https://tc39.es/ecma262/#sec-getidentifierreference */
export function GetIdentifierReference(env: EnvironmentRecord | NullValue, name: StringValue, strict: BooleanValue): ReferenceOrThrowCompletion {
  // 1. If lex is the value null, then
  if (env instanceof NullValue) {
    // a. Return the Reference Record { [[Base]]: unresolvable, [[ReferencedName]]: name, [[Strict]]: strict, [[ThisValue]]: empty }.
    return C(new ReferenceRecord({
      Base: 'unresolvable',
      ReferencedName: name,
      Strict: strict,
      ThisValue: undefined,
    }));
  }
  // 2. Let exists be ? envRec.HasBinding(name).
  const exists = Q(env.HasBinding(name));
  // 3. If exists is true, then
  if (exists === Value.true) {
    // a. Return the Reference Record { [[Base]]: env, [[ReferencedName]]: name, [[Strict]]: strict, [[ThisValue]]: empty }.
    return C(new ReferenceRecord({
      Base: env,
      ReferencedName: name,
      Strict: strict,
      ThisValue: undefined,
    }));
  } else {
    // a. Let outer be env.[[OuterEnv]].
    const outer = env.OuterEnv;
    // b. Return ? GetIdentifierReference(outer, name, strict).
    return C(Q(GetIdentifierReference(outer, name, strict)));
  }
}

/** https://tc39.es/ecma262/#sec-newdeclarativeenvironment */
export function NewDeclarativeEnvironment(E: EnvironmentRecord | NullValue): DeclarativeEnvironmentRecord {
  // 1. Let env be a new Declarative Environment Record containing no bindings.
  const env = new DeclarativeEnvironmentRecord();
  // 2. Set env.[[OuterEnv]] to E.
  env.OuterEnv = E;
  // 3. Return env.
  return env;
}

/** https://tc39.es/ecma262/#sec-newobjectenvironment */
export function NewObjectEnvironment(O: ObjectValue, W: BooleanValue, E: EnvironmentRecord | NullValue): ObjectEnvironmentRecord {
  // 1. Let env be a new object Environment Record.
  const env = new ObjectEnvironmentRecord();
  // 2. Set env.[[BindingObject]] to O.
  env.BindingObject = O;
  // 3. Set env.[[IsWithEnvironment]] to W.
  env.IsWithEnvironment = W;
  // 4. Set env.[[OuterEnv]] to E.
  env.OuterEnv = E;
  // 5. Return env.
  return env;
}

/** https://tc39.es/ecma262/#sec-newfunctionenvironment */
export function NewFunctionEnvironment(F: ECMAScriptFunctionObjectValue, newTarget: ObjectValue | UndefinedValue): FunctionEnvironmentRecord {
  // 1. Let env be a new Function Environment Record containing no bindings.
  const env = new FunctionEnvironmentRecord();
  // 2. Set env.[[FunctionObject]] to F.
  env.FunctionObject = F;
  // 3. If F.[[ThisMode]] is lexical, set env.[[ThisBindingStatus]] to lexical.
  if (F.ThisMode === 'lexical') {
    env.ThisBindingStatus = 'lexical';
  } else { // 4. Else, set env.[[ThisBindingStatus]] to uninitialized.
    env.ThisBindingStatus = 'uninitialized';
  }
  // 5. Set env.[[NewTarget]] to newTarget.
  env.NewTarget = newTarget;
  // 6. Set env.[[OuterEnv]] to F.[[Environment]].
  env.OuterEnv = F.Environment;
  // 7. Return env.
  return env;
}

/** https://tc39.es/ecma262/#sec-newglobalenvironment */
export function NewGlobalEnvironment(G: ObjectValue, thisValue: ObjectValue): GlobalEnvironmentRecord {
  // 1. Let objRec be NewObjectEnvironment(G, false, null).
  const objRec = NewObjectEnvironment(G, Value.false, Value.null);
  // 2. Let dclRec be NewDeclarativeEnvironment(null).
  const dclRec = NewDeclarativeEnvironment(Value.null);
  // 3. Let env be a new global Environment Record.
  const env = new GlobalEnvironmentRecord();
  // 4. Set env.[[ObjectRecord]] to objRec.
  env.ObjectRecord = objRec;
  // 5. Set env.[[GlobalThisValue]] to thisValue.
  env.GlobalThisValue = thisValue;
  // 6. Set env.[[DeclarativeRecord]] to dclRec.
  env.DeclarativeRecord = dclRec;
  // 7. Set env.[[VarNames]] to a new empty List.
  env.VarNames = [];
  // 8. Set env.[[OuterEnv]] to null.
  env.OuterEnv = Value.null;
  // 9. Return env.
  return env;
}

/** https://tc39.es/ecma262/#sec-newmoduleenvironment */
export function NewModuleEnvironment(E: EnvironmentRecord | NullValue): ModuleEnvironmentRecord {
  // 1. Let env be a new Module Environment Record containing no bindings.
  const env = new ModuleEnvironmentRecord();
  // 2. Set env.[[OuterEnv]] to E.
  env.OuterEnv = E;
  // 3. Return env.
  return env;
}

/** https://tc39.es/ecma262/#privateenvironment-record */
export class PrivateEnvironmentRecord {
  OuterPrivateEnvironment: PrivateEnvironmentRecord | NullValue;
  Names: PrivateName[];

  constructor({
    OuterPrivateEnvironment,
    Names,
  }: Pick<PrivateEnvironmentRecord, 'OuterPrivateEnvironment' | 'Names'>) {
    this.OuterPrivateEnvironment = OuterPrivateEnvironment;
    this.Names = Names;
  }

  mark(m: GCMarker) {
    this.Names.forEach((name) => {
      m(name);
    });
  }
}

/** https://tc39.es/ecma262/#sec-newprivateenvironment */
export function NewPrivateEnvironment(outerPrivEnv: PrivateEnvironmentRecord | NullValue): PrivateEnvironmentRecord {
  // 1. Let names be a new empty List.
  const names: PrivateName[] = [];
  // 2. Return the PrivateEnvironment Record { [[OuterPrivateEnvironment]]: outerPrivEnv, [[Names]]: names }.
  return new PrivateEnvironmentRecord({
    OuterPrivateEnvironment: outerPrivEnv,
    Names: names,
  });
}
