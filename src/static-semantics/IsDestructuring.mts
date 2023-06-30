import type { ParseNode } from '../parser/ParseNode.mjs';

type IsDestructuring =
  | ParseNode.AssignmentPattern
  | ParseNode.ObjectLiteral
  | ParseNode.ArrayLiteral
  | IsDestructuring_ForDeclaration
  | IsDestructuring_ForBinding;

type IsDestructuring_ForDeclaration = ParseNode.ForDeclaration & {
  readonly ForBinding: IsDestructuring_ForBinding;
}

type IsDestructuring_ForBinding = ParseNode.ForBinding & {
  readonly BindingPattern: ParseNode.BindingPattern;
  readonly BindingIdentifier: undefined;
}

export function IsDestructuring(node: ParseNode | ParseNode.AssignmentPattern): node is IsDestructuring {
  switch (node.type) {
    case 'ObjectBindingPattern':
    case 'ArrayBindingPattern':
    case 'ObjectLiteral':
    case 'ArrayLiteral':
      return true;
    case 'ForDeclaration':
      return IsDestructuring(node.ForBinding);
    case 'ForBinding':
      if (node.BindingIdentifier) {
        return false;
      }
      return true;
    default:
      return false;
  }
}
