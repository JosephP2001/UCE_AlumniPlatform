import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'notification-service API',
      version: '1.0.0',
      description: 'UCE Alumni Notification microservice — consumes RabbitMQ events (job_created, new_match) and exposes notification endpoints',
    },
    servers: [
      { url: 'http://localhost:3004',                                          description: 'Local' },
      { url: 'http://98.86.126.222/api/notification',                         description: 'QA' },
      { url: 'http://josheponcepro1.distribuidauce.org/api/notification',      description: 'PROD' },
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
        Notification: {
          type: 'object',
          properties: {
            id:         { type: 'integer',  example: 1 },
            user_id:    { type: 'string',   example: '176180233' },
            type:       { type: 'string',   example: 'job_created', enum: ['job_created', 'new_match'] },
            title:      { type: 'string',   example: 'Job listing published' },
            message:    { type: 'string',   example: 'Your job listing "Frontend Developer" at TechCorp is now live.' },
            metadata:   { type: 'object',   example: { jobId: 42 } },
            read:       { type: 'boolean',  example: false },
            created_at: { type: 'string',   format: 'date-time' },
          },
        },
        NotificationsListResponse: {
          type: 'object',
          properties: {
            notifications: { type: 'array', items: { $ref: '#/components/schemas/Notification' } },
            count:         { type: 'integer', example: 5 },
          },
        },
        HealthResponse: {
          type: 'object',
          properties: {
            status:    { type: 'string', example: 'ok' },
            service:   { type: 'string', example: 'notification-service' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        ErrorResponse: {
          type: 'object',
          properties: {
            error: { type: 'string', example: 'Authorization token required' },
          },
        },
      },
    },
    tags: [
      { name: 'Health',        description: 'Service health check' },
      { name: 'Notifications', description: 'User notification endpoints' },
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
      '/notifications/{userId}': {
        get: {
          tags: ['Notifications'],
          summary: 'Get notifications for a user',
          description: 'Returns the last 50 notifications for the given user. Requires Bearer token — only the owner or an admin can read.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'userId',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'GitHub numeric user ID',
              example: '176180233',
            },
          ],
          responses: {
            200: {
              description: 'List of notifications',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/NotificationsListResponse' } } },
            },
            401: {
              description: 'No or invalid token',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
            },
            403: {
              description: 'Forbidden — token does not belong to this user',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
            },
            500: { description: 'Failed to fetch notifications' },
          },
        },
      },
      '/notifications/{id}/read': {
        put: {
          tags: ['Notifications'],
          summary: 'Mark a notification as read',
          description: 'Sets read = true for the given notification. Only the owner can mark their own notifications.',
          security: [{ bearerAuth: [] }],
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'integer' },
              description: 'Notification ID',
              example: 1,
            },
          ],
          responses: {
            200: {
              description: 'Notification marked as read',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: { notification: { $ref: '#/components/schemas/Notification' } },
                  },
                },
              },
            },
            401: {
              description: 'No or invalid token',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
            },
            404: {
              description: 'Notification not found or does not belong to user',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } },
            },
            500: { description: 'Failed to update notification' },
          },
        },
      },
    },
  },
  apis: [],
};

export const swaggerSpec = swaggerJsdoc(options);