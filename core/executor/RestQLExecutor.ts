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

  async execute(parsedQuery, resourceSchema, variables, method): Promise<any> {
    const endpoint = resourceSchema.endpoints[method];
    if (!endpoint) {
      throw new Error(`${method} endpoint not found for resource "${parsedQuery.queryName}".`);
    }
  
    const url = this.buildUrl(endpoint.path, variables);
    const response = await this.fetch(url, method, parsedQuery.args);
    const data = await response.json();
  
    return data;
  }
  
  private buildUrl(path: string, variables: { [key: string]: string }): string {
    let url = this.baseUrls[path] || this.baseUrls.default;
    url += path.replace(/{(\w+)}/g, (_, key) => variables[key] || '');
  
    const queryParams = new URLSearchParams();
    for (const [key, value] of Object.entries(variables)) {
      if (!path.includes(`{${key}}`)) {
        queryParams.append(key, value);
      }
    }
  
    if (queryParams.toString()) {
      url += `?${queryParams.toString()}`;
    }
  
    return url;
  }

  private async fetch(
    url: string,
    method: HttpMethod,
    body?: any
  ): Promise<Response> {
    const options: RequestInit = {
      method,
      headers: {
        ...this.headers,
        "Content-Type": "application/json",
      },
    };

    if (
      body &&
      (method === HttpMethod.POST ||
        method === HttpMethod.PUT ||
        method === HttpMethod.PATCH)
    ) {
      options.body = JSON.stringify(body);
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
