import { Logger } from "../utils/Logger";
import { NetworkError } from "../validation/errors";
import {
  HttpMethod,
  RestQLExecutorOptions,
  ParsedQuery,
  SchemaResource,
  VariableValues,
} from "../types";

export class RestQLExecutor extends Logger {
  private baseUrls: { [key: string]: string };
  private headers: { [key: string]: string };

  constructor({ baseUrls, headers }: RestQLExecutorOptions) {
    super("RestQLExecutor");
    this.baseUrls = baseUrls;
    this.headers = headers;
  }

  async execute(
    parsedQuery: ParsedQuery,
    resourceSchema: SchemaResource,
    variables: VariableValues,
    method: HttpMethod
  ): Promise<any> {
    this.log("Executor execute called:", {
      parsedQuery,
      resourceSchema,
      variables,
      method,
    });
    const endpoint = resourceSchema.endpoints[method];
    if (!endpoint) {
      const errorMsg = `${method} endpoint not found for resource "${parsedQuery.queryName}".`;
      this.error(errorMsg);
      throw new Error(errorMsg);
    }

    const url = this.buildUrl(endpoint.path, variables);

    const queryArgs: { [key: string]: any } = {};
    for (const [key, value] of Object.entries(parsedQuery.args)) {
      if (typeof value === "string" && value.startsWith("$")) {
        const varName = value.slice(1);
        queryArgs[key] = variables[varName];
      } else {
        queryArgs[key] = value;
      }
    }

    const response = await this.fetch(url, method, queryArgs);
    const data = await response.json();
    return data;
  }

  private buildUrl(path: string, variables: { [key: string]: string }): string {
    this.log("Building URL:", { path, variables });
    let baseUrl = this.baseUrls[path] || this.baseUrls.default;

    if (!baseUrl) {
      const errorMsg = `No base URL found for path: ${path} and no default URL provided`;
      this.error(errorMsg);
      throw new Error(errorMsg);
    }

    let url = baseUrl;
    if (!url.endsWith("/") && !path.startsWith("/")) {
      url += "/";
    }
    url += path;

    url = url.replace(/{(\w+)}/g, (_, key) => variables[key] || "");

    this.log("Built URL:", url);
    return url;
  }

  private async fetch(
    url: string,
    method: HttpMethod,
    queryArgs: any
  ): Promise<Response> {
    const options: RequestInit = {
      method,
      headers: {
        ...this.headers,
        "Content-Type": "application/json",
      },
    };

    if (method === HttpMethod.GET) {
      const queryParams = new URLSearchParams(queryArgs);
      url += `?${queryParams.toString()}`;
    } else if (Object.keys(queryArgs).length > 0) {
      options.body = JSON.stringify(queryArgs);
    }

    this.log(`Fetching ${method} ${url}`);
    const response = await fetch(url, options);

    if (!response.ok) {
      const errorMsg = `Request to ${url} failed with status ${response.status}`;
      this.error(errorMsg);
      throw new NetworkError(errorMsg);
    }

    return response;
  }
}
