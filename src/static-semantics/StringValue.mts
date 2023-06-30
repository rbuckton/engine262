import { StringValue } from '../value.mjs';

// export function StringValue(node: ParseNode) {
//   switch (node.type) {
//     case 'IdentifierName':
//     case 'BindingIdentifier':
//     case 'IdentifierReference':
//     case 'LabelIdentifier':
//       return Value(node.name);
//     case 'PrivateIdentifier':
//       return Value(`#${node.name}`);
//     case 'StringLiteral':
//       return Value(node.value);
//     default:
//       throw new OutOfRange('StringValue', node);
//   }
// }
export { StringValue as StringValue };
