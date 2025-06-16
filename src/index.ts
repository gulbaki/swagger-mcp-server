import { McpServer, ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import SwaggerParser from "@apidevtools/swagger-parser";
import { OpenAPIV3 } from "openapi-types";

interface ParsedAPI {
  spec: OpenAPIV3.Document;
  parser: SwaggerParser;
}

class SwaggerMCPServer {
  private server: McpServer;
  private apis: Map<string, ParsedAPI> = new Map();

  constructor() {
    this.server = new McpServer({
      name: "swagger-api-explorer",
      version: "1.0.0"
    });

    this.setupResources();
    this.setupTools();
  }

  private setupResources() {
    // Resource for loading and caching API specifications
    this.server.resource(
      "load-api",
      new ResourceTemplate("swagger://{apiId}/load", { list: undefined }),
      async (uri, params) => {
        try {
          // Handle both string and string[] cases
          const apiId = Array.isArray(params.apiId) ? params.apiId[0] : params.apiId;
          
          if (!this.apis.has(apiId)) {
            return {
              contents: [{
                uri: uri.href,
                text: `API with ID '${apiId}' not loaded. Use the load_api tool first.`,
                mimeType: "text/plain"
              }]
            };
          }

          const api = this.apis.get(apiId)!;
          return {
            contents: [{
              uri: uri.href,
              text: JSON.stringify({
                info: api.spec.info,
                servers: api.spec.servers,
                paths: Object.keys(api.spec.paths || {}),
                components: Object.keys(api.spec.components?.schemas || {})
              }, null, 2),
              mimeType: "application/json"
            }]
          };
        } catch (error) {
          return {
            contents: [{
              uri: uri.href,
              text: `Error accessing API: ${error instanceof Error ? error.message : String(error)}`,
              mimeType: "text/plain"
            }]
          };
        }
      }
    );

    // Resource for getting all available endpoints
    this.server.resource(
      "endpoints",
      new ResourceTemplate("swagger://{apiId}/endpoints", { list: undefined }),
      async (uri, params) => {
        try {
          const apiId = Array.isArray(params.apiId) ? params.apiId[0] : params.apiId;
          const api = this.apis.get(apiId);
          if (!api) {
            return {
              contents: [{
                uri: uri.href,
                text: `API with ID '${apiId}' not found`,
                mimeType: "text/plain"
              }]
            };
          }

          const endpoints: Array<{method: string, path: string, summary?: string}> = [];
          
          Object.entries(api.spec.paths || {}).forEach(([path, pathItem]) => {
            if (!pathItem) return;
            
            ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'].forEach(method => {
              const operation = (pathItem as any)[method] as OpenAPIV3.OperationObject;
              if (operation) {
                endpoints.push({
                  method: method.toUpperCase(),
                  path,
                  summary: operation.summary
                });
              }
            });
          });

          return {
            contents: [{
              uri: uri.href,
              text: JSON.stringify(endpoints, null, 2),
              mimeType: "application/json"
            }]
          };
        } catch (error) {
          return {
            contents: [{
              uri: uri.href,
              text: `Error getting endpoints: ${error instanceof Error ? error.message : String(error)}`,
              mimeType: "text/plain"
            }]
          };
        }
      }
    );

    // Resource for getting specific endpoint details
    this.server.resource(
      "endpoint-detail",
      new ResourceTemplate("swagger://{apiId}/endpoint/{method}/{path}", { list: undefined }),
      async (uri, params) => {
        try {
          const apiId = Array.isArray(params.apiId) ? params.apiId[0] : params.apiId;
          const method = Array.isArray(params.method) ? params.method[0] : params.method;
          const path = Array.isArray(params.path) ? params.path[0] : params.path;
          
          const api = this.apis.get(apiId);
          if (!api) {
            return {
              contents: [{
                uri: uri.href,
                text: `API with ID '${apiId}' not found`,
                mimeType: "text/plain"
              }]
            };
          }

          const decodedPath = decodeURIComponent(path);
          const pathItem = api.spec.paths?.[decodedPath];
          if (!pathItem) {
            return {
              contents: [{
                uri: uri.href,
                text: `Path '${decodedPath}' not found in API`,
                mimeType: "text/plain"
              }]
            };
          }

          const operation = (pathItem as any)[method.toLowerCase()] as OpenAPIV3.OperationObject;
          if (!operation) {
            return {
              contents: [{
                uri: uri.href,
                text: `Method '${method}' not found for path '${decodedPath}'`,
                mimeType: "text/plain"
              }]
            };
          }

          const endpointDetails = this.formatEndpointDetails(operation, decodedPath, method.toUpperCase());

          return {
            contents: [{
              uri: uri.href,
              text: JSON.stringify(endpointDetails, null, 2),
              mimeType: "application/json"
            }]
          };
        } catch (error) {
          return {
            contents: [{
              uri: uri.href,
              text: `Error getting endpoint details: ${error instanceof Error ? error.message : String(error)}`,
              mimeType: "text/plain"
            }]
          };
        }
      }
    );
  }

  private setupTools() {
    // Tool to load an API specification
    this.server.tool(
      "load_api",
      {
        apiId: z.string().describe("Unique identifier for this API"),
        source: z.string().describe("URL or file path to the OpenAPI/Swagger specification")
      },
      async ({ apiId, source }) => {
        try {
          console.error(`Loading API from: ${source}`);
          
          const parser = new SwaggerParser();
          const spec = await parser.dereference(source) as OpenAPIV3.Document;
          
          this.apis.set(apiId, { spec, parser });
          
          const pathCount = Object.keys(spec.paths || {}).length;
          const endpointCount = Object.values(spec.paths || {}).reduce((count, pathItem) => {
            if (!pathItem) return count;
            return count + ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace']
              .filter(method => (pathItem as any)[method]).length;
          }, 0);

          return {
            content: [{
              type: "text",
              text: `Successfully loaded API '${spec.info?.title || apiId}' (v${spec.info?.version || 'unknown'}) with ${pathCount} paths and ${endpointCount} endpoints.`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Failed to load API: ${error instanceof Error ? error.message : String(error)}`
            }],
            isError: true
          };
        }
      }
    );

    // Tool to get endpoint details with optional natural language summary
    this.server.tool(
      "get_endpoint_details",
      {
        apiId: z.string().describe("ID of the loaded API"),
        method: z.string().describe("HTTP method (GET, POST, etc.)"),
        path: z.string().describe("API endpoint path"),
        natural: z.boolean().optional().describe("If true, returns a human-readable summary")
      },
      async ({ apiId, method, path, natural = false }) => {
        try {
          const api = this.apis.get(apiId);
          if (!api) {
            return {
              content: [{
                type: "text",
                text: `API with ID '${apiId}' not found. Use load_api tool first.`
              }],
              isError: true
            };
          }

          const pathItem = api.spec.paths?.[path];
          if (!pathItem) {
            return {
              content: [{
                type: "text",
                text: `Path '${path}' not found in API`
              }],
              isError: true
            };
          }

          const operation = (pathItem as any)[method.toLowerCase()] as OpenAPIV3.OperationObject;
          if (!operation) {
            return {
              content: [{
                type: "text",
                text: `Method '${method}' not found for path '${path}'`
              }],
              isError: true
            };
          }

          const endpointDetails = this.formatEndpointDetails(operation, path, method.toUpperCase());

          if (natural) {
            const summary = this.generateNaturalSummary(endpointDetails, path, method);
            return {
              content: [{
                type: "text",
                text: summary
              }]
            };
          }

          return {
            content: [{
              type: "text",
              text: JSON.stringify(endpointDetails, null, 2)
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Error getting endpoint details: ${error instanceof Error ? error.message : String(error)}`
            }],
            isError: true
          };
        }
      }
    );

    // Tool to list all available APIs
    this.server.tool(
      "list_apis",
      {},
      async () => {
        const apiList = Array.from(this.apis.entries()).map(([id, api]) => ({
          id,
          title: api.spec.info?.title || id,
          version: api.spec.info?.version,
          description: api.spec.info?.description,
          pathCount: Object.keys(api.spec.paths || {}).length
        }));

        return {
          content: [{
            type: "text",
            text: apiList.length > 0 
              ? JSON.stringify(apiList, null, 2)
              : "No APIs loaded. Use the load_api tool to load an API specification."
          }]
        };
      }
    );

    // Tool to search endpoints by pattern
    this.server.tool(
      "search_endpoints",
      {
        apiId: z.string().describe("ID of the loaded API"),
        pattern: z.string().describe("Search pattern for endpoint paths or descriptions")
      },
      async ({ apiId, pattern }) => {
        try {
          const api = this.apis.get(apiId);
          if (!api) {
            return {
              content: [{
                type: "text",
                text: `API with ID '${apiId}' not found`
              }],
              isError: true
            };
          }

          const matchingEndpoints: Array<{method: string, path: string, summary?: string, description?: string}> = [];
          const searchPattern = pattern.toLowerCase();

          Object.entries(api.spec.paths || {}).forEach(([path, pathItem]) => {
            if (!pathItem) return;
            
            ['get', 'post', 'put', 'delete', 'patch', 'head', 'options', 'trace'].forEach(method => {
              const operation = (pathItem as any)[method] as OpenAPIV3.OperationObject;
              if (operation) {
                const matchesPath = path.toLowerCase().includes(searchPattern);
                const matchesSummary = operation.summary?.toLowerCase().includes(searchPattern);
                const matchesDescription = operation.description?.toLowerCase().includes(searchPattern);
                
                if (matchesPath || matchesSummary || matchesDescription) {
                  matchingEndpoints.push({
                    method: method.toUpperCase(),
                    path,
                    summary: operation.summary,
                    description: operation.description
                  });
                }
              }
            });
          });

          return {
            content: [{
              type: "text",
              text: matchingEndpoints.length > 0
                ? JSON.stringify(matchingEndpoints, null, 2)
                : `No endpoints found matching pattern: ${pattern}`
            }]
          };
        } catch (error) {
          return {
            content: [{
              type: "text",
              text: `Error searching endpoints: ${error instanceof Error ? error.message : String(error)}`
            }],
            isError: true
          };
        }
      }
    );
  }

  private formatEndpointDetails(operation: OpenAPIV3.OperationObject, path: string, method: string) {
    const details: any = {
      method,
      path,
      summary: operation.summary,
      description: operation.description,
      operationId: operation.operationId,
      tags: operation.tags,
      parameters: [],
      requestBody: null,
      responses: {}
    };

    // Process parameters
    if (operation.parameters) {
      details.parameters = operation.parameters.map((param: any) => ({
        name: param.name,
        in: param.in,
        required: param.required || false,
        description: param.description,
        schema: param.schema,
        example: param.example
      }));
    }

    // Process request body
    if (operation.requestBody) {
      const requestBody = operation.requestBody as OpenAPIV3.RequestBodyObject;
      details.requestBody = {
        description: requestBody.description,
        required: requestBody.required || false,
        content: requestBody.content
      };
    }

    // Process responses
    if (operation.responses) {
      Object.entries(operation.responses).forEach(([code, response]) => {
        if (response && typeof response === 'object' && 'description' in response) {
          details.responses[code] = {
            description: response.description,
            content: (response as OpenAPIV3.ResponseObject).content,
            headers: (response as OpenAPIV3.ResponseObject).headers
          };
        }
      });
    }

    return details;
  }

  private generateNaturalSummary(endpointDetails: any, path: string, method: string): string {
    const { summary, description, parameters, requestBody, responses } = endpointDetails;
    
    let naturalSummary = `The ${method} ${path} endpoint`;
    
    if (summary) {
      naturalSummary += ` ${summary.toLowerCase()}`;
    } else if (description) {
      naturalSummary += ` ${description.toLowerCase()}`;
    }
    
    // Add parameter information
    if (parameters && parameters.length > 0) {
      const requiredParams = parameters.filter((p: any) => p.required);
      const optionalParams = parameters.filter((p: any) => !p.required);
      
      if (requiredParams.length > 0) {
        naturalSummary += `. It requires ${requiredParams.map((p: any) => `${p.name} (${p.in})`).join(', ')}`;
      }
      
      if (optionalParams.length > 0) {
        naturalSummary += `. Optional parameters include ${optionalParams.map((p: any) => `${p.name} (${p.in})`).join(', ')}`;
      }
    }
    
    // Add request body information
    if (requestBody) {
      naturalSummary += `. It accepts a request body`;
      if (requestBody.required) {
        naturalSummary += ' (required)';
      }
    }
    
    // Add response information
    const responseKeys = Object.keys(responses || {});
    if (responseKeys.length > 0) {
      const successCodes = responseKeys.filter(code => code.startsWith('2'));
      if (successCodes.length > 0) {
        naturalSummary += `. Success responses include ${successCodes.join(', ')}`;
      }
    }
    
    naturalSummary += '.';
    
    return naturalSummary;
  }

  async connect(transport: StdioServerTransport) {
    await this.server.connect(transport);
  }
}

// Main execution
async function main() {
  const server = new SwaggerMCPServer();
  const transport = new StdioServerTransport();
  
  console.error("Starting Swagger MCP Server...");
  await server.connect(transport);
  console.error("Swagger MCP Server running on stdio");
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.error('Received SIGINT, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.error('Received SIGTERM, shutting down gracefully...');
  process.exit(0);
});

if (require.main === module) {
  main().catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}