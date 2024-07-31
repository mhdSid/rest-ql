# RestQL

Transform your REST APIs into a GraphQL-like powerhouse with type-safe queries, automatic batching, and seamless caching – all without changing your backend.

## Features

- 🚀 GraphQL-like syntax for REST APIs
- 🛡️ Type-safe queries and mutations
- 🔄 Automatic request batching
- 💾 Intelligent caching mechanism
- 🔁 Built-in retry logic
- 🔧 Easy integration with existing REST APIs
- 📊 Efficient data shaping and nested queries

## Features under development
While RestQL provides a GraphQL-like syntax for interacting with REST APIs, it's missing several key features and capabilities that are present in full GraphQL implementations.
Here are some of the features that are being developed:

- Schema Definition Language (SDL):
RestQL doesn't use GraphQL's SDL for defining types and relationships. Instead, it uses a custom schema format.

- Type System:
GraphQL has a rich type system including scalar types, object types, interfaces, unions, and enums. RestQL's type system appears to be more limited.

- Introspection:
GraphQL allows clients to query the schema itself, which RestQL doesn't support.

- Resolvers:
In GraphQL, each field has a resolver function. RestQL maps directly to REST endpoints instead.

- Directives:
GraphQL supports directives for modifying query execution or results. RestQL doesn't have this feature.

- Subscriptions:
While RestQL has a basic pub/sub system, it doesn't support real-time subscriptions like GraphQL does.

- Fragments:
GraphQL allows reusable units called fragments. This feature isn't present in the RestQL implementation.

- Aliases:
GraphQL allows fields to be aliased. This doesn't appear to be supported in RestQL.

- Input Types:
GraphQL has specific input types for mutations. RestQL seems to handle inputs more simply.

- Null Handling:
GraphQL has specific null handling capabilities. RestQL's null handling isn't as sophisticated.

- Custom Scalars:
GraphQL allows for custom scalar types. RestQL doesn't seem to support this.

- Interfaces and Union Types:
These advanced type features of GraphQL are not present in RestQL.

- Schema Stitching and Federation:
These are advanced GraphQL features for combining multiple schemas, which RestQL doesn't support.

- Defer and Stream Directives:
Recent GraphQL specifications include these directives for performance optimization, which are not present in RestQL.

- Validation Rules:
GraphQL has a set of validation rules that queries are checked against. RestQL's validation appears more limited.


## Installation

```bash
npm install restql
```

or

```bash
yarn add restql
```

## Quick Start

```typescript
import { RestQL } from 'restql';

// Define your API schema
const schema = {
  users: {
    fields: {
      id: 'id',
      name: 'name',
      email: 'email'
    },
    endpoints: {
      GET: { method: 'GET', path: '/users' }
    }
  }
};

// Initialize RestQL
const restQL = new RestQL(schema, { default: 'https://api.example.com' });

// Define your query
const query = `
  query GetUsers {
    users {
      id
      name
      email
    }
  }
`;

// Execute the query
async function fetchUsers() {
  try {
    const result = await restQL.execute(query);
    console.log(result.users);
  } catch (error) {
    console.error('Error fetching users:', error);
  }
}

fetchUsers();
```

## Advanced Usage

### Mutations

```typescript
const mutation = `
  mutation CreateUser($name: String!, $email: String!) {
    createUser(name: $name, email: $email) {
      id
      name
      email
    }
  }
`;

async function createUser(name: string, email: string) {
  try {
    const result = await restQL.execute(mutation, { name, email });
    console.log('Created user:', result.createUser);
  } catch (error) {
    console.error('Error creating user:', error);
  }
}
```

### Batching

RestQL automatically batches multiple queries into a single request when possible, optimizing network usage.

```typescript
const batchedQueries = `
  query BatchedData {
    users {
      id
      name
    }
    posts {
      id
      title
    }
  }
`;

const result = await restQL.execute(batchedQueries);
console.log(result.users, result.posts);
```

### Caching
RestQL provides built-in caching to improve performance and reduce unnecessary network requests.

```typescript
const restQL = new RestQL(schema, baseUrls, {
  cacheTimeout: 5 * 60 * 1000 // 5 minutes
});
```

