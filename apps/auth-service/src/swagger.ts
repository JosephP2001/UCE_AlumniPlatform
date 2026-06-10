import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'auth-service API',
      version: '1.0.0',
      description: 'Authentication microservice — GitHub OAuth 2.0 + JWT',
    },
    servers: [
      { url: 'http://localhost:3000', description: 'Local' },
      { url: 'http://54.165.151.207/api/auth', description: 'QA' },
      { url: 'http://josheponcepro1.distribuidauce.org/api/auth', description: 'PROD' },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
      schemas: {
        User: {
          type: 'object',
          properties: {
            id:       { type: 'integer', example: 12345678 },
            username: { type: 'string',  example: 'josephp2001' },
            name:     { type: 'string',  example: 'Joseph Ponce' },
            avatar:   { type: 'string',  format: 'uri' },
            provider: { type: 'string',  example: 'github' },
          },
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status:    { type: 'string', example: 'ok' },
            service:   { type: 'string', example: 'auth-service' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'No token provided' },
          },
        },
      },
    },
    tags: [
      { name: 'Health',        description: 'Service health check' },
      { name: 'Auth',          description: 'GitHub OAuth 2.0 flow' },
      { name: 'Token',         description: 'JWT token management' },
    ],
    paths: {
      '/health': {
        get: {
          tags: ['Health'],
          summary: 'Health check',
          responses: {
            200: {
              description: 'Service is healthy',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/HealthResponse' } } },
            },
          },
        },
      },
      '/auth/github': {
        get: {
          tags: ['Auth'],
          summary: 'Initiate GitHub OAuth flow',
          description: 'Redirects the browser to GitHub authorization page',
          responses: {
            302: { description: 'Redirect to GitHub OAuth' },
          },
        },
      },
      '/auth/github/callback': {
        get: {
          tags: ['Auth'],
          summary: 'GitHub OAuth callback',
          description: 'Receives OAuth code, exchanges for token, issues JWT and redirects to frontend',
          parameters: [
            { name: 'code', in: 'query', required: true, schema: { type: 'string' }, description: 'OAuth code from GitHub' },
          ],
          responses: {
            302: { description: 'Redirect to frontend with JWT token' },
            400: { description: 'No code provided', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            500: { description: 'Authentication failed' },
          },
        },
      },
      '/auth/refresh': {
        post: {
          tags: ['Token'],
          summary: 'Refresh access token',
          description: 'Uses httpOnly refresh token cookie to issue a new access token',
          responses: {
            200: {
              description: 'New access token',
              content: { 'application/json': { schema: { type: 'object', properties: { accessToken: { type: 'string' } } } } },
            },
            401: { description: 'No or invalid refresh token', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
      '/auth/logout': {
        post: {
          tags: ['Token'],
          summary: 'Logout',
          description: 'Clears the refresh token cookie',
          responses: {
            200: { description: 'Logged out successfully' },
          },
        },
      },
      '/auth/me': {
        get: {
          tags: ['Auth'],
          summary: 'Get current user',
          security: [{ bearerAuth: [] }],
          responses: {
            200: {
              description: 'Authenticated user data',
              content: { 'application/json': { schema: { type: 'object', properties: { user: { $ref: '#/components/schemas/User' } } } } },
            },
            401: { description: 'No or invalid token', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
          },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
