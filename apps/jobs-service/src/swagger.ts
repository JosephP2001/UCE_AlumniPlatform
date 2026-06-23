import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'jobs-service API',
      version: '1.0.0',
      description: 'Job listings microservice — CQRS pattern with PostgreSQL + Redis',
    },
    servers: [
      { url: 'http://localhost:3001', description: 'Local' },
      { url: 'http://54.165.151.207/api/jobs', description: 'QA' },
      { url: 'http://josheponcepro1.distribuidauce.org/api/jobs', description: 'PROD' },
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
        Job: {
          type: 'object',
          properties: {
            id:           { type: 'integer',  example: 1 },
            title:        { type: 'string',   example: 'Frontend Developer' },
            company:      { type: 'string',   example: 'TechCorp' },
            description:  { type: 'string',   example: 'Build modern web apps' },
            location:     { type: 'string',   example: 'Quito, Ecuador' },
            salary:       { type: 'string',   example: '$1,200 / month' },
            job_type:     { type: 'string',   example: 'full-time', enum: ['full-time', 'part-time', 'contract', 'internship', 'remote'] },
            requirements: { type: 'string',   example: '2+ years React, English B2' },
            created_at:   { type: 'string',   format: 'date-time' },
          },
        },
        CreateJobRequest: {
          type: 'object',
          required: ['title', 'company'],
          properties: {
            title:        { type: 'string', example: 'Frontend Developer' },
            company:      { type: 'string', example: 'TechCorp' },
            description:  { type: 'string', example: 'Build modern web apps' },
            location:     { type: 'string', example: 'Quito, Ecuador' },
            salary:       { type: 'string', example: '$1,200 / month' },
            job_type:     { type: 'string', example: 'full-time', enum: ['full-time', 'part-time', 'contract', 'internship', 'remote'] },
            requirements: { type: 'string', example: '2+ years React, English B2' },
          },
        },
        JobsListResponse: {
          type: 'object',
          properties: {
            jobs:   { type: 'array', items: { $ref: '#/components/schemas/Job' } },
            source: { type: 'string', example: 'cache', enum: ['cache', 'database'] },
          },
        },
        JobResponse: {
          type: 'object',
          properties: {
            job:    { $ref: '#/components/schemas/Job' },
            source: { type: 'string', example: 'cache', enum: ['cache', 'database'] },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'title and company are required' },
          },
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status:    { type: 'string', example: 'ok' },
            service:   { type: 'string', example: 'jobs-service' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
      },
    },
    tags: [
      { name: 'Health', description: 'Service health check' },
      { name: 'Jobs',   description: 'Job listings CRUD — CQRS pattern' },
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
      '/jobs': {
        get: {
          tags: ['Jobs'],
          summary: 'List all jobs (QUERY — cache-first)',
          description: 'Returns all job listings. First call queries PostgreSQL and caches in Redis for 60s. Subsequent calls are served from Redis cache.',
          responses: {
            200: {
              description: 'Job listings with source indicator',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/JobsListResponse' } } },
            },
            500: { description: 'Internal server error' },
          },
        },
        post: {
          tags: ['Jobs'],
          summary: 'Create a job listing (COMMAND — writes to PostgreSQL)',
          description: 'Persists a new job to PostgreSQL and invalidates the Redis cache.',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: { 'application/json': { schema: { $ref: '#/components/schemas/CreateJobRequest' } } },
          },
          responses: {
            201: {
              description: 'Job created successfully',
              content: { 'application/json': { schema: { type: 'object', properties: { job: { $ref: '#/components/schemas/Job' } } } } },
            },
            400: { description: 'title and company are required', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            500: { description: 'Failed to create job' },
          },
        },
      },
      '/jobs/{id}': {
        get: {
          tags: ['Jobs'],
          summary: 'Get job by ID (QUERY — cache-first)',
          parameters: [
            { name: 'id', in: 'path', required: true, schema: { type: 'integer' }, description: 'Job ID' },
          ],
          responses: {
            200: {
              description: 'Job found',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/JobResponse' } } },
            },
            404: { description: 'Job not found', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
            500: { description: 'Internal server error' },
          },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);
