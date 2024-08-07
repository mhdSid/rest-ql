import { NetworkError } from "../validation/errors";
import { HttpMethod } from "../types";

export class RestQLExecutor {
  private baseUrls: { [key: string]: string };
  private headers: { [key: string]: string };

  constructor(
    baseUrls: { [key: string]: string },
    headers: { [key: string]: string }
  ) {
    this.baseUrls = baseUrls;
    this.headers = headers;
  }

  async execute(
    parsedQuery,
    resourceSchema,
    variables: { [key: string]: any },
    method
  ): Promise<any> {
    const endpoint = resourceSchema.endpoints[method];
    if (!endpoint) {
      console.error(
        `${method} endpoint not found for resource "${parsedQuery.queryName}".`
      );
      throw new Error(
        `${method} endpoint not found for resource "${parsedQuery.queryName}".`
      );
    }

    const url = this.buildUrl(endpoint.path, variables);

    const queryArgs = {};
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
    let url = this.baseUrls[path] || this.baseUrls.default;
    url += path.replace(/{(\w+)}/g, (_, key) => variables[key] || "");
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

    const response = await fetch(url, options);

    if (!response.ok) {
      throw new NetworkError(
        `Request to ${url} failed with status ${response.status}`
      );
    }

    return response;
  }
}
