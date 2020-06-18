import { Value } from '../value.mjs';
import { ModuleRequests, BoundNames, StringValue } from './all.mjs';

function ExportEntriesForModule(node, module) {
  switch (node.type) {
    case 'ExportFromClause':
      return [{
        ModuleRequest: module,
        ImportName: new Value('*'),
        LocalName: Value.null,
        ExportName: node.IdentifierName ? StringValue(node.IdentifierName) : Value.null,
      }];
    default:
      return [];
  }
}

export function ExportEntries(node) {
  if (Array.isArray(node)) {
    const entries = [];
    for (const item of node) {
      entries.push(...ExportEntries(item));
    }
    return entries;
  }
  switch (node.type) {
    case 'Module':
      if (node.ModuleBody) {
        return ExportEntries(node.ModuleBody);
      }
      return [];
    case 'ModuleBody':
      return ExportEntries(node.ModuleItemList);
    case 'ExportDeclaration': {
      if (node.NamedExports) {
        return ExportEntriesForModule(node.NamedExports, null);
      }
      if (node.VariableStatement) {
        const entries = [];
        const names = BoundNames(node.VariableStatement);
        for (const name of names) {
          entries.push({
            ModuleRequest: Value.null,
            ImportName: Value.null,
            LocalName: name,
            ExportName: name,
          });
        }
        return entries;
      }
      if (node.ExportFromClause) {
        const module = ModuleRequests(node.FromClause)[0];
        return ExportEntriesForModule(node.ExportFromClause, module);
      }
      return [];
    }
    default:
      return [];
  }
}