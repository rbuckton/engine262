import {
  BigIntValue,
  Type, BooleanValue, NullValue, UndefinedValue,
  SymbolValue,
  StringValue,
  NumberValue,
  ObjectValue,
  TypeForMethod,
  Value,
  wellKnownSymbols,
  type PropertyKeyValue,
} from '../value.mjs';
import { surroundingAgent } from '../engine.mjs';
import { Q, X, type BooleanOrThrowCompletion, C, NormalCompletion, ThrowCompletion, type ValueOrThrowCompletion } from '../completion.mjs';
import { OutOfRange } from '../helpers.mjs';
import {
  Assert,
  Get,
  IsDetachedBuffer,
  ToBoolean,
  ToNumber,
  ToNumeric,
  ToPrimitive,
  StringToBigInt,
  isProxyExoticObject,
  isArrayExoticObject,
  type IntegerIndexedExoticObjectValue,
} from './all.mjs';

// This file covers abstract operations defined in
/** https://tc39.es/ecma262/#sec-testing-and-comparison-operations */

/** https://tc39.es/ecma262/#sec-requireobjectcoercible */
export function RequireObjectCoercible(argument: Value): ValueOrThrowCompletion {
  const type = Type(argument);
  switch (type) {
    case 'Undefined':
      return C(surroundingAgent.Throw('TypeError', 'CannotConvertToObject', 'undefined'));
    case 'Null':
      return C(surroundingAgent.Throw('TypeError', 'CannotConvertToObject', 'null'));
    case 'Boolean':
    case 'Number':
    case 'String':
    case 'Symbol':
    case 'BigInt':
    case 'Object':
      return C(argument);
    default:
      throw new OutOfRange('RequireObjectCoercible', { type, argument });
  }
}

/** https://tc39.es/ecma262/#sec-isarray */
export function IsArray(argument: Value): BooleanOrThrowCompletion {
  if (!(argument instanceof ObjectValue)) {
    return C(Value.false);
  }
  if (isArrayExoticObject(argument)) {
    return C(Value.true);
  }
  if (isProxyExoticObject(argument)) {
    if (argument.ProxyHandler === Value.null) {
      return C(surroundingAgent.Throw('TypeError', 'ProxyRevoked', 'IsArray'));
    }
    const target = argument.ProxyTarget;
    return C(Q(IsArray(target)));
  }
  return C(Value.false);
}

/** https://tc39.es/ecma262/#sec-iscallable */
export function IsCallable(argument: Value): BooleanValue {
  if (!(argument instanceof ObjectValue)) {
    return Value.false;
  }
  if ('Call' in argument) {
    return Value.true;
  }
  return Value.false;
}

/** https://tc39.es/ecma262/#sec-isconstructor */
export function IsConstructor(argument: Value): BooleanValue {
  if (!(argument instanceof ObjectValue)) {
    return Value.false;
  }
  if ('Construct' in argument) {
    return Value.true;
  }
  return Value.false;
}

/** https://tc39.es/ecma262/#sec-isextensible-o */
export function IsExtensible(O: ObjectValue): BooleanOrThrowCompletion {
  return C(Q(O.IsExtensible()));
}

/** https://tc39.es/ecma262/#sec-isinteger */
export function IsIntegralNumber(argument: Value): BooleanValue {
  if (!(argument instanceof NumberValue)) {
    return Value.false;
  }
  if (argument.isNaN() || argument.isInfinity()) {
    return Value.false;
  }
  if (Math.floor(Math.abs(argument.numberValue())) !== Math.abs(argument.numberValue())) {
    return Value.false;
  }
  return Value.true;
}

/** https://tc39.es/ecma262/#sec-ispropertykey */
export function IsPropertyKey(argument: Value): argument is PropertyKeyValue {
  if (argument instanceof StringValue) {
    return true;
  }
  if (argument instanceof SymbolValue) {
    return true;
  }
  return false;
}

/** https://tc39.es/ecma262/#sec-isregexp */
export function IsRegExp(argument: Value): BooleanOrThrowCompletion {
  if (!(argument instanceof ObjectValue)) {
    return C(Value.false);
  }
  const matcher = Q(Get(argument, wellKnownSymbols.match));
  if (matcher !== Value.undefined) {
    return C(ToBoolean(matcher));
  }
  if ('RegExpMatcher' in argument) {
    return C(Value.true);
  }
  return C(Value.false);
}

/** https://tc39.es/ecma262/#sec-samevalue */
export function SameValue(x: Value, y: Value): BooleanValue {
  // 1. If Type(x) is different from Type(y), return false.
  if (Type(x) !== Type(y)) {
    return Value.false;
  }
  // 2. If Type(x) is Number or BigInt, then
  if (x instanceof NumberValue || x instanceof BigIntValue) {
    // a. Return ! Type(x)::sameValue(x, y).
    return TypeForMethod(x).sameValue(x as NumberValue & BigIntValue, y as NumberValue & BigIntValue); // NOTE: unsound cast
  }
  // 3. Return ! SameValueNonNumeric(x, y).
  return X(SameValueNonNumber(x, y));
}

/** https://tc39.es/ecma262/#sec-samevaluezero */
export function SameValueZero(x: Value, y: Value): BooleanValue {
  // 1. If Type(x) is different from Type(y), return false.
  if (Type(x) !== Type(y)) {
    return Value.false;
  }
  // 2. If Type(x) is Number or BigInt, then
  if (x instanceof NumberValue || x instanceof BigIntValue) {
    // a. Return ! Type(x)::sameValueZero(x, y).
    return TypeForMethod(x).sameValueZero(x as NumberValue & BigIntValue, y as NumberValue & BigIntValue); // NOTE: unsound cast
  }
  // 3. Return ! SameValueNonNumeric(x, y).
  return X(SameValueNonNumber(x, y));
}

/** https://tc39.es/ecma262/#sec-samevaluenonnumber */
export function SameValueNonNumber(x: Exclude<Value, NumberValue>, y: Exclude<Value, NumberValue>): BooleanValue {
  Assert(Type(x) === Type(y));

  if (x instanceof UndefinedValue) {
    return Value.true;
  }

  if (x instanceof NullValue) {
    return Value.true;
  }

  if (x instanceof StringValue) {
    if (x.stringValue() === (y as StringValue).stringValue()) { // NOTE: sound cast, checked above
      return Value.true;
    }
    return Value.false;
  }

  if (x instanceof BooleanValue) {
    if (x === y) {
      return Value.true;
    }
    return Value.false;
  }

  if (x instanceof SymbolValue) {
    return x === y ? Value.true : Value.false;
  }

  return x === y ? Value.true : Value.false;
}

/**
 * https://tc39.es/ecma262/#sec-islessthan
 * https://tc39.es/ecma262/#sec-abstract-relational-comparison
 */
export function IsLessThan(x: Value, y: Value, LeftFirst = true): NormalCompletion<BooleanValue | UndefinedValue> | ThrowCompletion {
  let px: Value;
  let py: Value;
  // 1. If the LeftFirst flag is true, then
  if (LeftFirst === true) {
    // a. Let px be ? ToPrimitive(x, number).
    px = Q(ToPrimitive(x, 'number'));
    // b. Let py be ? ToPrimitive(y, number).
    py = Q(ToPrimitive(y, 'number'));
  } else {
    // a. NOTE: The order of evaluation needs to be reversed to preserve left to right evaluation.
    // b. Let py be ? ToPrimitive(y, number).
    py = Q(ToPrimitive(y, 'number'));
    // c. Let px be ? ToPrimitive(x, number).
    px = Q(ToPrimitive(x, 'number'));
  }
  // 3. If Type(px) is String and Type(py) is String, then
  if (px instanceof StringValue && py instanceof StringValue) {
    // a. Let lx be the length of px.
    const lx = px.stringValue().length;
    // b. Let ly be the length of py.
    const ly = py.stringValue().length;
    // c. for each integer i such that 0 <= i <= min(lx, ly), in ascending order, do
    for (let i = 0; i <= lx && i <= ly; i++) {
      // i. Let cx be the numeric value of the code unit at index i within px.
      const cx = px.stringValue().charCodeAt(i);
      // ii. Let cy be the numeric value of the code unit at index i within py.
      const cy = py.stringValue().charCodeAt(i);
      // iii. If cx < cy, return true.
      if (cx < cy) {
        return C(Value.true);
      }
      // iv. If cx > cy, return false.
      if (cx > cy) {
        return C(Value.false);
      }
    }
    // d. If lx < ly, return true. Otherwise, return false.
    if (lx < ly) {
      return C(Value.true);
    } else {
      return C(Value.false);
    }
  } else {
    // a. If Type(px) is BigInt and Type(py) is String, then
    if (px instanceof BigIntValue && py instanceof StringValue) {
      // i. Let ny be ! StringToBigInt(py).
      const ny = X(StringToBigInt(py));
      // ii. If ny is NaN, return undefined.
      if (ny instanceof UndefinedValue) {
        return C(Value.undefined);
      }
      // iii. Return BigInt::lessThan(px, ny).
      return C(BigIntValue.lessThan(px, ny));
    }
    // b. If Type(px) is String and Type(py) is BigInt, then
    if (px instanceof StringValue && py instanceof BigIntValue) {
      // i. Let ny be ! StringToBigInt(py).
      const nx = X(StringToBigInt(px));
      // ii. If ny is NaN, return undefined.
      if (nx instanceof UndefinedValue) {
        return C(Value.undefined);
      }
      // iii. Return BigInt::lessThan(px, ny).
      return C(BigIntValue.lessThan(nx, py));
    }
    // c. Let nx be ? ToNumeric(px). NOTE: Because px and py are primitive values evaluation order is not important.
    const nx = Q(ToNumeric(px));
    // d. Let ny be ? ToNumeric(py).
    const ny = Q(ToNumeric(py));
    // e. If Type(nx) is the same as Type(ny), return Type(nx)::lessThan(nx, ny).
    if (Type(nx) === Type(ny)) {
      return C(TypeForMethod(nx).lessThan(nx as NumberValue & BigIntValue, ny as NumberValue & BigIntValue)); // NOTE: unsound cast
    }
    // f. Assert: Type(nx) is BigInt and Type(ny) is Number, or Type(nx) is Number and Type(ny) is BigInt.
    Assert((nx instanceof BigIntValue && ny instanceof NumberValue) || (nx instanceof NumberValue && ny instanceof BigIntValue));
    // g. If nx or ny is NaN, return undefined.
    if ((nx.isNaN && nx.isNaN()) || (ny.isNaN && ny.isNaN())) {
      return C(Value.undefined);
    }
    // h. If nx is -∞ or ny is +∞, return true.
    if ((nx instanceof NumberValue && nx.numberValue() === -Infinity) || (ny instanceof NumberValue && ny.numberValue() === +Infinity)) {
      return C(Value.true);
    }
    // i. If nx is +∞ or ny is -∞, return false.
    if ((nx instanceof NumberValue && nx.numberValue() === +Infinity) || (ny instanceof NumberValue && ny.numberValue() === -Infinity)) {
      return C(Value.false);
    }
    // j. If the mathematical value of nx is less than the mathematical value of ny, return true; otherwise return false.
    const a = nx instanceof NumberValue ? nx.numberValue() : nx.bigintValue();
    const b = ny instanceof NumberValue ? ny.numberValue() : ny.bigintValue();
    return C(a < b ? Value.true : Value.false);
  }
}

/**
 * https://tc39.es/ecma262/#sec-islooselyequal
 * https://tc39.es/ecma262/#sec-abstract-equality-comparison
 */
export function IsLooselyEqual(x: Value, y: Value): BooleanOrThrowCompletion {
  // 1. If Type(x) is the same as Type(y), then
  if (Type(x) === Type(y)) {
    // a. Return the result of performing Strict Equality Comparison x === y.
    return C(IsStrictlyEqual(x, y));
  }
  // 2. If x is null and y is undefined, return true.
  if (x === Value.null && y === Value.undefined) {
    return C(Value.true);
  }
  // 3. If x is undefined and y is null, return true.
  if (x === Value.undefined && y === Value.null) {
    return C(Value.true);
  }
  // 4. If Type(x) is Number and Type(y) is String, return ! IsLooselyEqual(x, ! ToNumber(y)).
  if (x instanceof NumberValue && y instanceof StringValue) {
    return C(X(IsLooselyEqual(x, X(ToNumber(y)))));
  }
  // 5. If Type(x) is String and Type(y) is Number, return ! IsLooselyEqual(! ToNumber(x), y).
  if (x instanceof StringValue && y instanceof NumberValue) {
    return C(X(IsLooselyEqual(X(ToNumber(x)), y)));
  }
  // 6. If Type(x) is BigInt and Type(y) is String, then
  if (x instanceof BigIntValue && y instanceof StringValue) {
    // a. Let n be StringToBigInt(y).
    const n = StringToBigInt(y);
    // b. If n is undefined, return false.
    if (n instanceof UndefinedValue) {
      return C(Value.false);
    }
    // c. Return ! IsLooselyEqual(x, n).
    return C(X(IsLooselyEqual(x, n)));
  }
  // 7. If Type(x) is String and Type(y) is BigInt, return the result of the comparison y == x.
  if (x instanceof StringValue && y instanceof BigIntValue) {
    return C(X(IsLooselyEqual(y, x)));
  }
  // 8. If Type(x) is Boolean, return the result of the comparison ! ToNumber(x) == y.
  if (x instanceof BooleanValue) {
    return C(X(IsLooselyEqual(X(ToNumber(x)), y)));
  }
  // 9. If Type(y) is Boolean, return the result of the comparison x == ! ToNumber(y).
  if (y instanceof BooleanValue) {
    return C(X(IsLooselyEqual(x, X(ToNumber(y)))));
  }
  // 10. If Type(x) is either String, Number, BigInt, or Symbol and Type(y) is Object, return the result of the comparison x == ToPrimitive(y).
  if (['String', 'Number', 'BigInt', 'Symbol'].includes(Type(x)) && y instanceof ObjectValue) {
    return C(X(IsLooselyEqual(x, Q(ToPrimitive(y)))));
  }
  // 11. If Type(x) is Object and Type(y) is either String, Number, BigInt, or Symbol, return the result of the comparison ToPrimitive(x) == y.
  if (x instanceof ObjectValue && ['String', 'Number', 'BigInt', 'Symbol'].includes(Type(y))) {
    return C(X(IsLooselyEqual(Q(ToPrimitive(x)), y)));
  }
  // 12. If Type(x) is BigInt and Type(y) is Number, or if Type(x) is Number and Type(y) is BigInt, then
  if ((x instanceof BigIntValue && y instanceof NumberValue) || (x instanceof NumberValue && y instanceof BigIntValue)) {
    // a. If x or y are any of NaN, +∞, or -∞, return false.
    if ((x.isNaN && (x.isNaN() || !x.isFinite())) || (y.isNaN && (y.isNaN() || !y.isFinite()))) {
      return C(Value.false);
    }
    // b. If the mathematical value of x is equal to the mathematical value of y, return true; otherwise return false.
    const a = (x instanceof NumberValue ? x.numberValue() : x.bigintValue());
    const b = (y instanceof NumberValue ? y.numberValue() : y.bigintValue());
    return C(a == b ? Value.true : Value.false); // eslint-disable-line eqeqeq
  }
  // 13. Return false.
  return C(Value.false);
}

/**
 * https://tc39.es/ecma262/#sec-isstrictlyequal
 * https://tc39.es/ecma262/#sec-strict-equality-comparison
 */
export function IsStrictlyEqual(x: Value, y: Value): BooleanValue {
  // 1. If Type(x) is different from Type(y), return false.
  if (Type(x) !== Type(y)) {
    return Value.false;
  }
  // 2. If Type(x) is Number or BigInt, then
  if (x instanceof NumberValue || x instanceof BigIntValue) {
    // a. Return ! Type(x)::equal(x, y).
    return X(TypeForMethod(x).equal(x as NumberValue & BigIntValue, y as NumberValue & BigIntValue)); // NOTE: unsound cast
  }
  // 3. Return ! SameValueNonNumeric(x, y).
  return SameValueNonNumber(x, y);
}

/** https://tc39.es/ecma262/#sec-isvalidintegerindex */
export function IsValidIntegerIndex(O: IntegerIndexedExoticObjectValue, index: NumberValue): BooleanValue {
  if (IsDetachedBuffer(O.ViewedArrayBuffer) === Value.true) {
    return Value.false;
  }
  Assert(index instanceof NumberValue);
  if (IsIntegralNumber(index) === Value.false) {
    return Value.false;
  }
  const _index = index.numberValue();
  if (Object.is(_index, -0)) {
    return Value.false;
  }
  if (_index < 0 || _index >= O.ArrayLength) {
    return Value.false;
  }
  return Value.true;
}
