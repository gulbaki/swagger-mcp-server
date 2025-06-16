# Swagger/OpenAPI MCP Server

A Model Context Protocol (MCP) server that allows LLMs to explore and interact with Swagger/OpenAPI specifications. This server provides tools and resources for loading API specifications, browsing endpoints, and getting detailed information about API operations.

## Installation

1. Clone or create the project directory
2. Install dependencies:

```bash
npm install
```

3. Build the TypeScript code:

```bash
npm run build
```

## Usage


### Available Tools

#### `load_api`
Load an OpenAPI/Swagger specification into the server.

**Parameters:**
- `apiId` (string): Unique identifier for this API
- `source` (string): URL or file path to the OpenAPI/Swagger specification

**Example:**
```json
{
  "name": "load_api",
  "arguments": {
    "apiId": "petstore",
    "source": "https://petstore.swagger.io/v2/swagger.json"
  }
}
```

#### `get_endpoint_details`
Get detailed information about a specific API endpoint.

**Parameters:**
- `apiId` (string): ID of the loaded API
- `method` (string): HTTP method (GET, POST, etc.)
- `path` (string): API endpoint path
- `natural` (boolean, optional): If true, returns a human-readable summary

**Example:**
```json
{
  "name": "get_endpoint_details",
  "arguments": {
    "apiId": "petstore",
    "method": "GET",
    "path": "/pet/{petId}",
    "natural": true
  }
}
```

#### `list_apis`
List all currently loaded API specifications.

**Parameters:** None

#### `search_endpoints`
Search for endpoints matching a specific pattern.

**Parameters:**
- `apiId` (string): ID of the loaded API
- `pattern` (string): Search pattern for endpoint paths or descriptions

**Example:**
```json
{
  "name": "search_endpoints",
  "arguments": {
    "apiId": "petstore",
    "pattern": "pet"
  }
}
```

### Available Resources

#### `swagger://{apiId}/load`
Get overview information about a loaded API specification.

#### `swagger://{apiId}/endpoints`
Get a list of all available endpoints for an API.

#### `swagger://{apiId}/endpoint/{method}/{path}`
Get detailed information about a specific endpoint.

## Configuration with Claude Desktop

To use this server with Claude Desktop, add the following to your `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "swagger-explorer": {
      "command": "node",
      "args": ["/path/to/your/swagger-mcp-server/build/index.js"]
    }
  }
}
```

Replace `/path/to/your/swagger-mcp-server` with the actual path to your project directory.

## Example Workflow

1. **Load an API specification:**
   ```
   Use the load_api tool to load the Swagger Petstore API:
   - apiId: "petstore"
   - source: "https://petstore.swagger.io/v2/swagger.json"
   ```

2. **Explore available endpoints:**
   ```
   Use the search_endpoints tool to find all pet-related endpoints:
   - apiId: "petstore"
   - pattern: "pet"
   ```

3. **Get detailed endpoint information:**
   ```
   Use get_endpoint_details to learn about the GET /pet/{petId} endpoint:
   - apiId: "petstore"
   - method: "GET"
   - path: "/pet/{petId}"
   - natural: true
   ```

## Supported API Formats

- OpenAPI 3.0.x
- OpenAPI 3.1.x
- Swagger 2.0

The server automatically handles dereferencing of JSON schemas and resolves `$ref` references.


## License

MIT License
