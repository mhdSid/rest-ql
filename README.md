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

