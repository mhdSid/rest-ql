# RestQL

RestQL is a powerful and flexible library that allows you to query REST APIs using a GraphQL-like syntax.
It provides a seamless way to interact with REST endpoints, offering features like batched queries, caching, and data transformation.

## Features

- **GraphQL-like Syntax**: Write queries for your REST APIs using a familiar GraphQL-like syntax.
- **SDL (Schema Definition Language) Support**: Define your API structure using SDL, making it easy to understand and maintain.
- **Batched Queries**: Execute multiple queries in a single operation, reducing the number of API calls.
- **Caching**: Efficiently cache query results to improve performance and reduce unnecessary network requests.
- **Data Transformation**: Apply custom transformations to your data before it's returned.
- **Type Safety**: Leverage TypeScript for type-safe operations and responses.

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
import { RestQL } from "rest-ql";

// Define the SDL
const sdl = `
  type User {
    id: String @from("user_id") @transform("transformUserId")
    name: String @from("full_name")
    email: String @from("contact_info.email")
    address: Address @from("location")
    hobbyList: [Hobby] @from("hobbies")
    @endpoint(GET, "/users", "data.data[0]")
  }
  type Address {
    street: String @from("street_name")
    city: String
    country: Country @from("country")
  }
  type Country {
    name: String @from("country_name")
    capital: String @from("capital_name")
  }
  type Hobby {
    name: String @from("hobby_name")
    id: String @from("hobby_id")
  }
`;

// Define base URLs
const baseUrls = {
  default: "https://api.example.com",
  // "/users": "https://users.api.example.com" // optional
};

// Define options
const options = {
  cacheTimeout: 300000, // 5 minutes
  headers: {
    Authorization: "Bearer your-token-here"
  },
  maxRetries: 3,
  retryDelay: 1000,
  batchInterval: 50
};

// Define transformers
const transformers = {
  transformUserId: (originalData: any, shapedData: any) => {
    return {
      ...shapedData,
      id: `(ID: ${shapedData.id})`
    };
  }
};

// Initialize RestQL
const restql = new RestQL(sdl, baseUrls, options, transformers);

// Define one or many queries
const query = `
  query GetUser {
    user {
      id
      name
      email
      address {
        street
        city
        country {
          name
          capital
        }
      }
      hobbyList {
        name
        id
      }
    }
  }
`;

// Execute the query
async function executeQuery() {
  try {
    const result = await restql.execute(query, {}, { useCache: true });
    console.log("Query result:", result);

    // Caching
    const resultCached = await restql.execute(query, {}, { useCache: true });
    console.log("Query result cached:", resultCached);
  } catch (error) {
    console.error("Error executing query:", error);
  }
}

executeQuery();
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

## Data Mapping Example

RestQL excels at mapping complex REST API responses to the structure defined in your GraphQL-like queries. Here's an example of how RestQL transforms API data:

### API Responses

**Users API Response:**
```json
{
  "data": {
    "data": [
      {
        "user_id": 1,
        "full_name": "test_full_name",
        "contact_info": {
          "email": "mohdsidani@gmail.com"
        },
        "location": {
          "street_name": "test_street_name",
          "city": "test_city",
          "country": {
            "country_name": "test_country_name",
            "capital_name": "test_capital"
          }
        },
        "hobbies": [
          {
            "hobby_name": "kate",
            "hobby_id": 1
          }
        ]
      }
    ]
  }
}
```

**Posts API Response:**
```json
{
  "data": {
    "data": [
      {
        "post_id": 1,
        "post_name": 1
      }
    ]
  }
}
```

**RestQL Query:**
```graphql
query {
  user {
    id
    name
    email
    address {
      street
      city
      country {
        name
        capital
        blockList {
          name
          number
        }
      }
    }
    hobbyList {
      name
      id
    }
  }
  post {
    id
    name
  }
}
```

**Resulting Data Structure:**
```json
{
  "post": {
    "id": 1,
    "name": 1
  },
  "user": {
    "id": "idddd_shapedData_1",
    "name": "test_full_name",
    "email": "mohdsidani@gmail.com",
    "address": {
      "street": "test_street_name",
      "city": "test_city",
      "country": {
        "name": "test_country_name",
        "capital": "test_capital",
        "blockList": [
          [
            {
              "name": "test_block_name_1",
              "number": "test_block_number_1"
            },
            {
              "name": "test_block_name_2",
              "number": "test_block_number_2"
            }
          ]
        ]
      }
    },
    "hobbyList": [
      {
        "name": "kate",
        "id": 1
      }
    ]
  }
}
```

## Documentation
WIP

## Contributing
We welcome contributions! Please see our contributing guidelines for more details.

## License
RestQL is MIT licensed.
This markdown provides an introduction to your RestQL project, highlighting its key features, providing a quick start guide, and showing some advanced usage examples. You may want to adjust the content based on the specific details of your implementation, add more examples, or include additional sections as needed.

Remember to create the referenced files like `CONTRIBUTING.md` and `LICENSE`, and replace `link-to-your-docs` with the actual link to your documentation if you have one.
