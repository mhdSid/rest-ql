import { ParsedOperation, ParsedQuery } from "../types";

export class QueryParser {
  parse(query: string): ParsedOperation {
    const lines = query.trim().split("\n");
    const operationType = lines[0].trim().startsWith("mutation")
      ? "mutation"
      : "query";
    const queries: ParsedQuery[] = [];

    let currentQuery: ParsedQuery | null = null;
    let depth = 0;
    let currentFields: any = {};
    const fieldsStack: any[] = [];

    for (const line of lines.slice(1)) {
      const trimmedLine = line.trim();

      if (trimmedLine.endsWith("{")) {
        if (depth === 0) {
          currentQuery = {
            queryName: trimmedLine.split("(")[0].trim(),
            args: this.parseArgs(trimmedLine),
            fields: {},
          };
          currentFields = currentQuery.fields;
        } else {
          const fieldName = trimmedLine.slice(0, -1).trim();
          currentFields[fieldName] = {};
          fieldsStack.push(currentFields);
          currentFields = currentFields[fieldName];
        }
        depth++;
      } else if (trimmedLine === "}") {
        depth--;
        if (depth === 0) {
          if (currentQuery) {
            queries.push(currentQuery);
            currentQuery = null;
          }
        } else {
          currentFields = fieldsStack.pop();
        }
      } else if (currentQuery) {
        const [fieldName, fieldType] = trimmedLine
          .split(":")
          .map((s) => s.trim());
        currentFields[fieldName] = fieldType || true;
      }
    }

    return { operationType, queries };
  }

  private parseArgs(line: string): { [key: string]: string } {
    const argsMatch = line.match(/\((.*?)\)/);
    if (!argsMatch) return {};

    const args: { [key: string]: string } = {};
    const argPairs = argsMatch[1].split(",");
    for (const pair of argPairs) {
      const [key, value] = pair.split(":");
      args[key.trim()] = value.trim();
    }
    return args;
  }
}
