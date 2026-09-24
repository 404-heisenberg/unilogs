export const openapiSpec = {
  openapi: '3.0.3',

  info: {
    title: 'UniLogs API',
    version: '0.1.0',
    description: 'API documentation for the UniLogs digital logbook',
  },

  servers: [
    {
      url: 'https://unilogs.onrender.com',
      description: 'Production server',
    },

    {
      url: 'http://localhost:3000',
      description: 'Local development server',
    },
  ],

  components: {
    schemas: {
      Project: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            example: 1,
          },
          name: {
            type: 'string',
            example: 'My first University Project',
          },
          description: {
            type: 'string',
            nullable: true,
            example: 'A project for tracking my university workflow.',
          },
          archived: {
            type: 'boolean',
            example: false,
          },
          reminderFrequency: {
            type: 'string',
            enum: ['DAILY', 'WEEKLY', 'OFF'],
            default: 'WEEKLY',
            description: 'How often reminder emails are sent for this project.',
            example: 'WEEKLY',
          },
          userId: {
            type: 'string',
            example: 'userId-example123',
          },
        },
      },

      ReminderSettings: {
        type: 'object',
        properties: {
          remindersEnabled: {
            type: 'boolean',
            description: 'Global reminder kill switch for the user.',
            example: true,
          },
        },
        required: ['remindersEnabled'],
      },

      Notification: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          userId: { type: 'string', example: 'userId-example123' },
          projectId: { type: 'integer', nullable: true, example: 3 },
          type: {
            type: 'string',
            enum: ['REMINDER', 'SYSTEM'],
            example: 'REMINDER',
          },
          title: { type: 'string', example: "Don't forget to log Thesis" },
          body: { type: 'string', example: 'No entries in the last 7 days.' },
          readAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            example: null,
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2026-09-20T08:00:00.000Z',
          },
        },
      },

      Tag: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            example: 1,
          },
          name: {
            type: 'string',
            example: 'University',
          },
        },
      },

      EntryTag: {
        type: 'object',
        properties: {
          entryId: {
            type: 'integer',
            example: 1,
          },
          tagId: {
            type: 'integer',
            example: 1,
          },
          tag: {
            $ref: '#/components/schemas/Tag',
          },
        },
      },

      Entry: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            example: 1,
          },
          projectId: {
            type: 'integer',
            example: 1,
          },
          date: {
            type: 'string',
            format: 'date-time',
            example: '2026-09-09T13:52:00.000Z',
          },
          createdAt: {
            type: 'string',
            format: 'date-time',
            example: '2026-09-09T14:00:00.000Z',
          },
          title: {
            type: 'string',
            nullable: true,
            description: 'Optional entry title',
            example: 'Fixed the login bug',
          },
          body: {
            type: 'string',
            nullable: true,
            description: 'Markdown body content',
            example: '## What I did\n\n- Wrote unit tests\n- Fixed the bug',
          },
          content: {
            type: 'object',
            additionalProperties: true,
            example: {
              mood: 'Sad',
              notes: 'Had an unproductive study session.',
            },
          },
          tags: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/EntryTag',
            },
          },
        },
      },

      FieldDefinition: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            example: 1,
          },
          projectId: {
            type: 'integer',
            example: 1,
          },
          name: {
            type: 'string',
            example: 'Mood',
          },
          fieldType: {
            type: 'string',
            enum: ['text', 'number', 'date', 'duration', 'boolean'],
            example: 'text',
          },
        },
      },

      FieldDefinitionWithProject: {
        allOf: [
          {
            $ref: '#/components/schemas/FieldDefinition',
          },
          {
            type: 'object',
            properties: {
              project: {
                $ref: '#/components/schemas/Project',
              },
            },
          },
        ],
      },

      EntryWithProject: {
        allOf: [
          {
            $ref: '#/components/schemas/Entry',
          },
          {
            type: 'object',
            properties: {
              project: {
                $ref: '#/components/schemas/Project',
              },
            },
          },
        ],
      },
    },
  },

  paths: {
    '/api/auth/signup': {
      post: {
        summary: 'Create a new user account',
        description: 'Creates a new UniLogs user account using email, password and name.',

        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password', 'name'],
                properties: {
                  email: {
                    type: 'string',
                    format: 'email',
                    example: 'user@example.com',
                  },
                  password: {
                    type: 'string',
                    format: 'password',
                    example: 'passwordExample123***',
                  },
                  name: {
                    type: 'string',
                    example: 'Jane Doe',
                  },
                },
              },
            },
          },
        },

        responses: {
          '200': {
            description: 'User account created successfully.',
          },
          '400': {
            description: 'Signup failed.',
          },
        },
      },
    },

    '/api/auth/signin': {
      post: {
        summary: 'Sign in to an account',
        description: 'Signs in a UniLogs user using email and password.',

        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: {
                    type: 'string',
                    format: 'email',
                    example: 'user@example.com',
                  },
                  password: {
                    type: 'string',
                    format: 'password',
                    example: 'passwordExample123***',
                  },
                },
              },
            },
          },
        },

        responses: {
          '200': {
            description: 'User signed in successfully.',
          },
          '400': {
            description: 'Signin failed.',
          },
        },
      },
    },

    '/api/auth/reset-password': {
      post: {
        summary: 'Reset account password',
        description: 'Resets a user password using a valid reset token.',

        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['token', 'newPassword'],
                properties: {
                  token: {
                    type: 'string',
                    example: 'reset-token-example',
                  },
                  newPassword: {
                    type: 'string',
                    format: 'password',
                    example: 'newPassword123***',
                  },
                },
              },
            },
          },
        },

        responses: {
          '200': {
            description: 'Password reset successfully.',
          },
          '400': {
            description: 'Password reset failed, or the token is invalid or expired.',
          },
        },
      },
    },

    '/api/auth/forgot-password': {
      post: {
        summary: 'Request a password reset',
        description: 'Generates a password reset token for a user account.',

        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email'],
                properties: {
                  email: {
                    type: 'string',
                    format: 'email',
                    example: 'user@example.com',
                  },
                },
              },
            },
          },
        },

        responses: {
          '200': {
            description: 'Password reset request processed successfully.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    message: {
                      type: 'string',
                      example: 'Reset link sent if account exists',
                    },
                    token: {
                      type: 'string',
                      example: 'reset-token-example',
                    },
                    url: {
                      type: 'string',
                      example: 'http://localhost:3000/reset-password?token=reset-token-example',
                    },
                  },
                },
              },
            },
          },

          '400': {
            description: 'Failed to send the reset link.',
          },
        },
      },
    },

    '/api/auth/account': {
      delete: {
        summary: 'Delete user account',
        description: 'Deletes the authenticated user account after verifying the account password.',

        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['password'],
                properties: {
                  password: {
                    type: 'string',
                    format: 'password',
                    example: 'passwordExample123***',
                  },
                },
              },
            },
          },
        },

        responses: {
          '200': {
            description: 'Account deleted successfully.',
          },

          '400': {
            description: 'Password is missing or account deletion failed.',
          },

          '401': {
            description: 'Unauthorized.',
          },
        },
      },
    },

    '/api/projects': {
      post: {
        summary: 'Create a new project',
        description: 'Creates a new project for the authenticated user.',

        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name'],
                properties: {
                  name: {
                    type: 'string',
                    example: 'My First University Project',
                  },
                  description: {
                    type: 'string',
                    nullable: true,
                    example: 'A project for tracking my first university project workflow.',
                  },
                },
              },
            },
          },
        },

        responses: {
          '201': {
            description: 'Project created successfully.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Project',
                },
              },
            },
          },

          '400': {
            description: 'Project name is required.',
          },

          '401': {
            description: 'Unauthorized.',
          },

          '500': {
            description: 'Failed to create project.',
          },
        },
      },

      get: {
        summary: 'Get projects',
        description: "Returns the authenticated user's projects.",

        parameters: [
          {
            name: 'archived',
            in: 'query',
            required: false,
            schema: {
              type: 'boolean',
              default: false,
            },
            description: 'Set to true to return archived projects.',
          },
        ],

        responses: {
          '200': {
            description: 'Projects retrieved successfully.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Project',
                  },
                },
              },
            },
          },

          '401': {
            description: 'Unauthorized.',
          },

          '500': {
            description: 'Failed to fetch projects.',
          },
        },
      },
    },

    '/api/projects/{id}': {
      get: {
        summary: 'Get a project',
        description: 'Returns a project belonging to the authenticated user.',

        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'The project ID.',
          },
        ],

        responses: {
          '200': {
            description: 'Project retrieved successfully.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Project',
                },
              },
            },
          },

          '401': {
            description: 'Unauthorized.',
          },

          '400': {
            description: 'Project ID must be a valid integer.',
          },

          '404': {
            description: 'Project not found.',
          },

          '500': {
            description: 'Failed to fetch project.',
          },
        },
      },

      patch: {
        summary: 'Update a project',
        description: 'Updates a project belonging to the authenticated user.',

        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'The project ID.',
          },
        ],

        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    example: 'Updated University Project',
                  },
                  description: {
                    type: 'string',
                    nullable: true,
                    example: 'Updated project description.',
                  },
                },
              },
            },
          },
        },

        responses: {
          '200': {
            description: 'Project updated successfully.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Project',
                },
              },
            },
          },

          '400': {
            description: 'Project ID, name, or description is invalid',
          },

          '401': {
            description: 'Unauthorized.',
          },

          '404': {
            description: 'Project not found.',
          },

          '500': {
            description: 'Failed to update project.',
          },
        },
      },

      delete: {
        summary: 'Delete a project',
        description: 'Deletes a project belonging to the authenticated user.',

        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'The project ID.',
          },
        ],

        responses: {
          '204': {
            description: 'Project deleted successfully.',
          },

          '400': {
            description: 'Project ID must be a valid integer.',
          },

          '401': {
            description: 'Unauthorized.',
          },

          '404': {
            description: 'Project not found.',
          },

          '500': {
            description: 'Failed to delete project.',
          },
        },
      },
    },

    '/api/projects/{id}/archive': {
      post: {
        summary: 'Archive a project',
        description:
          'Archives a project belonging to the authenticated user. Revokes every live share link for the project, so archiving also takes its public report offline.',

        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'The project ID.',
          },
        ],

        responses: {
          '200': {
            description: 'Project archived successfully.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Project',
                },
              },
            },
          },

          '400': {
            description: 'The project ID must be a valid integer.',
          },

          '401': {
            description: 'Not authenticated.',
          },

          '404': {
            description: 'Project not found.',
          },

          '500': {
            description: 'Failed to update archive status of project.',
          },
        },
      },
    },

    '/api/projects/{id}/unarchive': {
      post: {
        summary: 'Unarchive a project',
        description: 'Unarchives a project belonging to the authenticated user.',

        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'The project ID.',
          },
        ],

        responses: {
          '200': {
            description: 'Project unarchived successfully.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Project',
                },
              },
            },
          },

          '400': {
            description: 'The project ID must be a valid integer.',
          },

          '401': {
            description: 'Not authenticated.',
          },

          '404': {
            description: 'Project not found.',
          },

          '500': {
            description: 'Failed to update archive status of project.',
          },
        },
      },
    },

    '/api/notifications': {
      get: {
        summary: 'Get notification feed',
        description:
          'Returns the authenticated user latest 50 notifications, newest first, with the unread count.',
        responses: {
          '200': {
            description: 'Feed retrieved successfully.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    notifications: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Notification' },
                    },
                    unreadCount: { type: 'integer', example: 2 },
                  },
                  required: ['notifications', 'unreadCount'],
                },
              },
            },
          },
          '401': { description: 'Not authenticated.' },
          '500': { description: 'Failed to fetch notifications.' },
        },
      },
    },

    '/api/notifications/read-all': {
      post: {
        summary: 'Mark every notification read',
        description: 'Marks all of the authenticated user notifications as read.',
        responses: {
          '200': {
            description: 'Notifications marked read.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: { updated: { type: 'integer', example: 3 } },
                  required: ['updated'],
                },
              },
            },
          },
          '401': { description: 'Not authenticated.' },
          '500': { description: 'Failed to mark notifications read.' },
        },
      },
    },

    '/api/notifications/{id}/read': {
      post: {
        summary: 'Mark one notification read',
        description: 'Marks a single notification owned by the authenticated user as read.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'integer' },
            description: 'The notification ID.',
          },
        ],
        responses: {
          '200': {
            description: 'Notification marked read.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Notification' },
              },
            },
          },
          '400': { description: 'The notification ID must be a valid integer.' },
          '401': { description: 'Not authenticated.' },
          '404': { description: 'Notification not found.' },
          '500': { description: 'Failed to mark notification read.' },
        },
      },
    },

    '/api/settings': {
      get: {
        summary: 'Get reminder settings',
        description: 'Returns the authenticated user reminder preferences.',
        responses: {
          '200': {
            description: 'Settings retrieved successfully.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ReminderSettings',
                },
              },
            },
          },
          '401': { description: 'Not authenticated.' },
          '500': { description: 'Failed to fetch settings.' },
        },
      },

      patch: {
        summary: 'Update reminder settings',
        description: 'Updates the authenticated user global reminder kill switch.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  remindersEnabled: {
                    type: 'boolean',
                    example: false,
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Settings updated successfully.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ReminderSettings',
                },
              },
            },
          },
          '400': { description: 'remindersEnabled must be a boolean.' },
          '401': { description: 'Not authenticated.' },
          '500': { description: 'Failed to update settings.' },
        },
      },
    },

    '/api/entries': {
      get: {
        summary: 'Get entries',
        description:
          'Returns entries belonging to the authenticated user, with optional search, filters, and pagination.',
        parameters: [
          {
            name: 'q',
            in: 'query',
            schema: { type: 'string' },
            description: 'Free-text search across title, body, and project name.',
          },
          {
            name: 'projectId',
            in: 'query',
            schema: { type: 'integer' },
            description: 'Filter by project ID (must be owned by the user).',
          },
          {
            name: 'tagIds',
            in: 'query',
            schema: { type: 'string' },
            description: 'Comma-separated tag IDs. Entry must have ALL listed tags.',
          },
          {
            name: 'dateFrom',
            in: 'query',
            schema: { type: 'string', format: 'date-time' },
            description: 'Inclusive lower bound on entry date.',
          },
          {
            name: 'dateTo',
            in: 'query',
            schema: { type: 'string', format: 'date-time' },
            description: 'Inclusive upper bound on entry date.',
          },
          {
            name: 'page',
            in: 'query',
            schema: { type: 'integer', default: 1, minimum: 1 },
            description: '1-based page number.',
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', default: 50, maximum: 100 },
            description: 'Page size (max 100).',
          },
        ],
        responses: {
          '200': {
            description: 'Entries retrieved successfully.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    entries: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/EntryWithProject' },
                    },
                    total: { type: 'integer', example: 42 },
                    page: { type: 'integer', example: 1 },
                    limit: { type: 'integer', example: 50 },
                  },
                  required: ['entries', 'total', 'page', 'limit'],
                },
              },
            },
          },
          '400': { description: 'Invalid query parameters.' },
          '401': { description: 'Unauthorized.' },
          '500': { description: 'Failed to fetch entries.' },
        },
      },

      post: {
        summary: 'Create a new entry',
        description: 'Creates a new entry for a project belonging to the authenticated user.',

        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['projectId', 'content'],
                properties: {
                  projectId: {
                    type: 'integer',
                    example: 1,
                  },
                  title: {
                    type: 'string',
                    nullable: true,
                    description: 'Optional title for the entry',
                    example: 'Fixed the login bug',
                  },
                  body: {
                    type: 'string',
                    nullable: true,
                    description: 'Markdown body content',
                    example: '## What I did\n\n- Wrote unit tests\n- Fixed the bug',
                  },
                  content: {
                    type: 'object',
                    example: {
                      mood: 'Sad',
                      notes: 'Had an unproductive study session.',
                    },
                  },
                  date: {
                    type: 'string',
                    format: 'date-time',
                    example: '2026-09-08T13:52:00.000Z',
                  },
                  tagIds: {
                    type: 'array',
                    items: {
                      type: 'integer',
                    },
                    example: [1, 2, 4],
                  },
                },
              },
            },
          },
        },

        responses: {
          '201': {
            description: 'Entry created successfully.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Entry',
                },
              },
            },
          },

          '400': {
            description:
              'Required fields are missing, the project ID is invalid, or the entry content is invalid, or the entry is wholly empty (no title, body, or field values).',
          },

          '401': {
            description: 'Unauthorized.',
          },

          '403': {
            description: 'You do not have access to this project.',
          },

          '500': {
            description: 'Failed to create entry.',
          },
        },
      },
    },

    '/api/entries/{id}': {
      get: {
        summary: 'Get an entry',
        description: 'Returns an entry belonging to the authenticated user.',

        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'The entry ID.',
          },
        ],

        responses: {
          '200': {
            description: 'Entry retrieved successfully.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/EntryWithProject',
                },
              },
            },
          },

          '400': {
            description: 'Entry ID must be a valid integer.',
          },

          '401': {
            description: 'Unauthorized.',
          },

          '403': {
            description: 'You do not have access to this entry.',
          },

          '404': {
            description: 'Entry not found.',
          },

          '500': {
            description: 'Failed to fetch entry.',
          },
        },
      },

      put: {
        summary: 'Update an entry',
        description: 'Updates an entry belonging to the authenticated user.',

        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'The entry ID.',
          },
        ],

        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  title: {
                    type: 'string',
                    nullable: true,
                    description: 'Updated entry title',
                    example: 'Updated: Fixed the login bug',
                  },
                  body: {
                    type: 'string',
                    nullable: true,
                    description: 'Updated Markdown body content',
                    example:
                      '## What I did\n\n- Wrote unit tests\n- Fixed the bug\n- Added integration tests',
                  },
                  content: {
                    type: 'object',
                    example: {
                      mood: 'Happy',
                      notes: 'Had a productive study session.',
                    },
                  },
                  date: {
                    type: 'string',
                    format: 'date-time',
                    example: '2026-09-09T13:52:00.000Z',
                  },
                  tagIds: {
                    type: 'array',
                    items: {
                      type: 'integer',
                    },
                    example: [1, 2, 4],
                  },
                },
              },
            },
          },
        },

        responses: {
          '200': {
            description: 'Entry updated successfully.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Entry',
                },
              },
            },
          },

          '400': {
            description:
              'Entry ID must be a valid integer or the entry content is invalid, or the update would make the entry wholly empty.',
          },

          '401': {
            description: 'Unauthorized',
          },

          '403': {
            description: 'You do not have access to this entry.',
          },

          '404': {
            description: 'Entry not found.',
          },

          '500': {
            description: 'Failed to update entry.',
          },
        },
      },

      delete: {
        summary: 'Delete an entry',
        description: 'Deletes an entry belonging to the authenticated user.',

        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'The entry ID.',
          },
        ],

        responses: {
          '204': {
            description: 'Entry deleted successfully.',
          },

          '400': {
            description: 'Entry ID must be a valid integer.',
          },

          '401': {
            description: 'Unauthorized.',
          },

          '403': {
            description: 'You do not have access to this entry.',
          },

          '404': {
            description: 'Entry not found.',
          },

          '500': {
            description: 'Failed to delete entry.',
          },
        },
      },
    },

    '/api/field-definitions': {
      get: {
        summary: 'Get field definitions',
        description:
          'Returns all field definitions for a project belonging to the authenticated user.',

        parameters: [
          {
            name: 'projectId',
            in: 'query',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'The project ID.',
          },
        ],

        responses: {
          '200': {
            description: 'Field definitions retrieved successfully.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/FieldDefinition',
                  },
                },
              },
            },
          },

          '400': {
            description: 'Project ID must be a valid integer.',
          },

          '401': {
            description: 'Unauthorized.',
          },

          '404': {
            description: 'Project not found.',
          },

          '500': {
            description: 'Failed to fetch field definitions.',
          },
        },
      },

      post: {
        summary: 'Create a field definition',
        description:
          'Creates a new field definition for a project belonging to the authenticated user.',

        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['projectId', 'name', 'fieldType'],
                properties: {
                  projectId: {
                    type: 'integer',
                    example: 1,
                  },
                  name: {
                    type: 'string',
                    example: 'Mood',
                  },
                  fieldType: {
                    type: 'string',
                    enum: ['text', 'number', 'date', 'duration', 'boolean'],
                    example: 'text',
                  },
                },
              },
            },
          },
        },

        responses: {
          '201': {
            description: 'Field definition created successfully.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/FieldDefinition',
                },
              },
            },
          },

          '400': {
            description:
              'Required fields are missing, the field type is invalid, or the project ID is invalid.',
          },

          '401': {
            description: 'Unauthorized',
          },

          '404': {
            description: 'Project not found.',
          },

          '500': {
            description: 'Failed to create field definition.',
          },
        },
      },
    },

    '/api/field-definitions/{id}': {
      get: {
        summary: 'Get a field definition',
        description: 'Returns a field definition belonging to the authenticated user.',

        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'The field definition ID.',
          },
        ],

        responses: {
          '200': {
            description: 'Field definition retrieved successfully.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/FieldDefinitionWithProject',
                },
              },
            },
          },

          '400': {
            description: 'Field definition ID must be a valid integer.',
          },

          '401': {
            description: 'Unauthorized.',
          },

          '403': {
            description: 'You do not have access to this field definition.',
          },

          '404': {
            description: 'Field definition not found.',
          },

          '500': {
            description: 'Failed to fetch field definition.',
          },
        },
      },

      put: {
        summary: 'Update a field definition',
        description: 'Updates a field definition belonging to the authenticated user.',

        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'The field definition ID.',
          },
        ],

        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: {
                    type: 'string',
                    example: 'Updated Mood',
                  },
                  fieldType: {
                    type: 'string',
                    enum: ['text', 'number', 'date', 'duration', 'boolean'],
                    example: 'text',
                  },
                },
              },
            },
          },
        },

        responses: {
          '200': {
            description: 'Field definition updated successfully.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/FieldDefinition',
                },
              },
            },
          },

          '400': {
            description:
              'Field definition ID must be a valid integer or the field type is invalid.',
          },

          '401': {
            description: 'Unauthorized.',
          },

          '403': {
            description: 'You do not have access to this field definition.',
          },

          '404': {
            description: 'Field definition not found.',
          },

          '500': {
            description: 'Failed to update field definition.',
          },
        },
      },

      delete: {
        summary: 'Delete a field definition',
        description: 'Deletes a field definition belonging to the authenticated user.',

        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'The field definition ID.',
          },
        ],

        responses: {
          '204': {
            description: 'Field definition deleted successfully.',
          },

          '400': {
            description: 'Field definition ID must be a valid integer.',
          },

          '401': {
            description: 'Unauthorized.',
          },

          '403': {
            description: 'You do not have access to this field definition.',
          },

          '404': {
            description: 'Field definition not found.',
          },

          '500': {
            description: 'Failed to delete field definition.',
          },
        },
      },
    },

    '/api/projects/{id}/share-links': {
      post: {
        summary: 'Create a share link for a project',
        description:
          'Creates a tokenised read-only share link for a project owned by the authenticated user.',

        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'The project ID.',
          },
        ],

        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  includeBodies: {
                    type: 'boolean',
                    default: false,
                    description: 'Include entry bodies on the public report.',
                  },
                  rangeDays: {
                    type: 'integer',
                    default: 30,
                    description: 'How many days back the public report covers.',
                  },
                  expiresInDays: {
                    type: 'integer',
                    default: 30,
                    description: 'How many days until the link expires.',
                  },
                },
              },
            },
          },
        },

        responses: {
          '201': {
            description: 'Share link created successfully.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    url: {
                      type: 'string',
                      example: 'http://localhost:5173/share/3fa85f64-5717-4562-b3fc-2c963f66afa6',
                    },
                    token: {
                      type: 'string',
                      example: '3fa85f64-5717-4562-b3fc-2c963f66afa6',
                    },
                    expiresAt: {
                      type: 'string',
                      format: 'date-time',
                    },
                  },
                },
              },
            },
          },

          '400': {
            description: 'Invalid share link options.',
          },

          '401': {
            description: 'Unauthorized.',
          },

          '404': {
            description: 'Project not found.',
          },

          '500': {
            description: 'Failed to create share link.',
          },
        },
      },
    },

    '/api/projects/{id}/share-links/{token}': {
      delete: {
        summary: 'Revoke a share link',
        description:
          'Soft-revokes a share link so the public URL immediately stops resolving. Idempotent.',

        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'The project ID.',
          },
          {
            name: 'token',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'The share token.',
          },
        ],

        responses: {
          '204': {
            description: 'Share link revoked (or already dead).',
          },

          '400': {
            description: 'Project ID must be a valid integer.',
          },

          '401': {
            description: 'Unauthorized.',
          },

          '404': {
            description: 'Project not found.',
          },

          '500': {
            description: 'Failed to revoke share link.',
          },
        },
      },
    },

    '/share/{token}': {
      get: {
        summary: 'Get a shared project report',
        description:
          'Public, unauthenticated read-only report for a live share token. Unknown, revoked and expired tokens all return the same 404.',

        parameters: [
          {
            name: 'token',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'The share token.',
          },
          {
            name: 'tagIds',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
            },
            description: 'Comma-separated tag IDs to filter entries by.',
          },
        ],

        responses: {
          '200': {
            description: 'Report returned successfully.',
          },

          '404': {
            description: 'Share link not found (unknown, revoked or expired).',
          },

          '429': {
            description: 'Rate limit exceeded for this token.',
          },

          '500': {
            description: 'Failed to load shared report.',
          },
        },
      },
    },

    '/share/{token}/export': {
      get: {
        summary: 'Download a shared project report',
        description:
          "Public CSV or Markdown export, scoped to the share token's own range and body setting. Request parameters cannot widen either.",

        parameters: [
          {
            name: 'token',
            in: 'path',
            required: true,
            schema: {
              type: 'string',
            },
            description: 'The share token.',
          },
          {
            name: 'format',
            in: 'query',
            required: true,
            schema: {
              type: 'string',
              enum: ['csv', 'md'],
            },
            description: 'Export format.',
          },
        ],

        responses: {
          '200': {
            description: 'Export file returned.',
          },

          '400': {
            description: 'format must be csv or md.',
          },

          '404': {
            description: 'Share link not found (unknown, revoked or expired).',
          },

          '429': {
            description: 'Rate limit exceeded for this token.',
          },

          '500': {
            description: 'Failed to export shared report.',
          },
        },
      },
    },
  },
};
