import { RestQL } from "../src/core/restQl";

const sdl = `
  type User {
    id: String @from("user_id")
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

const baseUrls = {
  default: "https://api.example.com",
  // "/users": "https://users.api.example.com",
};

// Define options
const options = {
  cacheTimeout: 300000, // 5 minutes
  headers: {
    Authorization: "Bearer your-token-here",
  },
  maxRetries: 3,
  retryDelay: 1000,
  batchInterval: 50,
};

// Define transformers
const transformers = {
  transformUser: (originalData: any, shapedData: any) => {
    return {
      ...shapedData,
      user: `${shapedData.name} (ID: ${shapedData.id})`,
    };
  },
  transformAddress: (originalData: any, shapedData: any) => {
    return {
      ...shapedData,
      address: `${shapedData.street}, ${shapedData.city}, ${shapedData.country}`,
    };
  },
};

const restql = new RestQL(sdl, baseUrls, options, transformers);

/*
  Sample Rest:
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
            "capital_name": "test_capital",
            "blocks": [
              [{
                "block_name": "test_block_name_1",
                "block_number": "test_block_number_1"
              }, {
                "block_name": "test_block_name_2",
                "block_number": "test_block_number_2"
              }]
            ]
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
*/
// Define a query
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
    const resultcached = await restql.execute(query, {}, { useCache: true });
    console.log("Query result cached:", resultcached);
  } catch (error) {
    console.error("Error executing query:", error);
  }
}

executeQuery();
