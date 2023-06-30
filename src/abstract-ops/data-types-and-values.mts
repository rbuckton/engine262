// @ts-nocheck
import { StringValue, Value, type PropertyKeyValue } from '../value.mjs';
import { X } from '../completion.mjs';
import { CanonicalNumericIndexString } from './all.mjs';

// This file covers predicates defined in
/** https://tc39.es/ecma262/#sec-ecmascript-data-types-and-values */

// 6.1.7 #integer-index
export function isIntegerIndex(V) {
  if (!(V instanceof StringValue)) {
    return false;
  }
  const numeric = X(CanonicalNumericIndexString(V));
  if (numeric === Value.undefined) {
    return false;
  }
  if (Object.is(numeric.numberValue(), +0)) {
    return true;
  }
  return numeric.numberValue() > 0 && Number.isSafeInteger(numeric.numberValue());
}

// 6.1.7 #array-index
export function isArrayIndex(V: PropertyKeyValue): V is StringValue & { readonly string: `${number}` } {
  if (!(V instanceof StringValue)) {
    return false;
  }
  const numeric = X(CanonicalNumericIndexString(V));
  if (numeric === Value.undefined) {
    return false;
  }
  if (!Number.isInteger(numeric.numberValue())) {
    return false;
  }
  if (Object.is(numeric.numberValue(), +0)) {
    return true;
  }
  return numeric.numberValue() > 0 && numeric.numberValue() < (2 ** 32) - 1;
}

export function inAscendingNumericIndexOrder(a: StringValue, b: StringValue) {
  return Number.parseInt(a.stringValue(), 10) - Number.parseInt(b.stringValue(), 10);
}

export function isNonNegativeInteger(argument) {
  return Number.isInteger(argument) && argument >= 0;
}
