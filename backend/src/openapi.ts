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

      ProjectSummary: {
        type: 'object',
        properties: {
          projectId: {
            type: 'integer',
            example: 1,
          },
          name: {
            type: 'string',
            example: 'My First University Project',
          },
          entryCount: {
            type: 'integer',
            example: 10,
          },
          trackedTimeMinutes: {
            type: 'integer',
            nullable: true,
            example: 360,
            description:
              'Total tracked duration in minutes. Null if the project has no duration fields.',
          },
          lastLoggedAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            example: '2026-09-23T12:00:00.000Z',
          },
          entriesThisWeek: {
            type: 'integer',
            example: 3,
          },
        },

        required: [
          'projectId',
          'name',
          'entryCount',
          'trackedTimeMinutes',
          'lastLoggedAt',
          'entriesThisWeek',
        ],
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
          usageCount: {
            type: 'integer',
            example: 5,
            description: 'Number of entries using this tag.',
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
      CalendarSource: {
        type: 'object',
        properties: {
          id: {
            type: 'integer',
            example: 1,
          },
          userId: {
            type: 'string',
            example: 'userId-example123',
          },
          calendarId: {
            type: 'string',
            example: 'mokoatledikeledi4@gmail.com',
          },
          summary: {
            type: 'string',
            example: 'Tutorials',
          },
          description: {
            type: 'string',
            example: 'Tutorial sessions',
          },
          color: {
            type: 'string',
            nullable: true,
            example: '#a47ae2',
          },
          enabled: {
            type: 'boolean',
            example: true,
          },
          order: {
            type: 'integer',
            example: 0,
          },
        },
        required: [
          'id',
          'userId',
          'calendarId',
          'summary',
          'description',
          'color',
          'enabled',
          'order',
        ],
      },

      CalendarEvent: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: '2co75sie84t6bssva0aed8ec3t',
          },
          summary: {
            type: 'string',
            example: 'skincare',
          },
          calendarId: {
            type: 'string',
            example:
              '318d502e84822eb30bd185a9d98f30319635ad6a130ee2abc26d018c69a021ac@group.calendar.google.com',
          },
          calendarSummary: {
            type: 'string',
            example: 'Personal Care',
          },
          color: {
            type: 'string',
            nullable: true,
            example: '#FF0000',
          },
          start: {
            type: 'object',
            properties: {
              dateTime: {
                type: 'string',
                format: 'date-time',
              },
              date: {
                type: 'string',
                format: 'date',
              },
            },
          },
          end: {
            type: 'object',
            properties: {
              dateTime: {
                type: 'string',
                format: 'date-time',
              },
              date: {
                type: 'string',
                format: 'date',
              },
            },
          },
        },
      },

      CalendarSuggestion: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            example: '2co75sie84t6bssva0aed8ec3t',
          },
          calendarId: {
            type: 'string',
            example:
              '318d502e84822eb30bd185a9d98f30319635ad6a130ee2abc26d018c69a021ac@group.calendar.google.com',
          },
          title: {
            type: 'string',
            example: 'skincare',
          },
          start: {
            type: 'string',
            example: '2026-10-12',
          },
          end: {
            type: 'string',
            example: '2026-10-13',
          },
        },
        required: ['id', 'calendarId', 'title', 'start', 'end'],
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
          deletedAt: {
            type: 'string',
            format: 'date-time',
            nullable: true,
            description:
              'Set when the entry has been deleted. Deleted entries are excluded from every read path and are listed by `GET /api/projects/{id}/trash`.',
            example: null,
          },
          tags: {
            type: 'array',
            items: {
              $ref: '#/components/schemas/EntryTag',
            },
          },
        },
      },

      EntrySnapshot: {
        type: 'object',
        description:
          'The values one version of an entry held. Deliberately trimmed to the entry itself - earlier snapshots also embedded the project and its field definitions.',
        properties: {
          title: {
            type: 'string',
            nullable: true,
            example: 'Fixed the login bug',
          },
          body: {
            type: 'string',
            nullable: true,
            example: '## What I did\n\n- Wrote unit tests',
          },
          content: {
            type: 'object',
            additionalProperties: true,
            example: { Hours: 3 },
          },
          date: {
            type: 'string',
            format: 'date-time',
            example: '2026-09-09T13:52:00.000Z',
          },
          tagIds: {
            type: 'array',
            items: { type: 'integer' },
            description:
              'Absent on versions written before tags were captured, which means "unknown" rather than "no tags".',
            example: [1, 4],
          },
        },
      },

      AsAtEntry: {
        type: 'object',
        description:
          'One entry as it stood on the requested day. Same shape as an entry from `GET /api/entries`, so the timeline can render a reconstructed day and the live one identically.',
        properties: {
          id: {
            type: 'integer',
            description: 'The real entry id, so it can be linked through to.',
          },
          projectId: { type: 'integer' },
          title: { type: 'string', nullable: true },
          body: { type: 'string', nullable: true },
          content: { type: 'object', additionalProperties: true },
          date: {
            type: 'string',
            format: 'date-time',
            description:
              'The date the entry carried at that moment. An entry edited after the requested day is returned with its *old* date, not its current one.',
          },
          project: {
            type: 'object',
            properties: {
              id: { type: 'integer' },
              name: { type: 'string' },
            },
          },
          tags: {
            type: 'array',
            description:
              'Tags as they were then, resolved from the ids in the snapshot. A tag deleted since then is left off rather than rendered as a dangling id.',
            items: {
              type: 'object',
              properties: {
                tagId: { type: 'integer' },
                tag: {
                  type: 'object',
                  properties: {
                    id: { type: 'integer' },
                    name: { type: 'string' },
                  },
                },
              },
            },
          },
        },
      },

      AsAtResponse: {
        type: 'object',
        properties: {
          entries: {
            type: 'array',
            items: { $ref: '#/components/schemas/AsAtEntry' },
          },
          total: { type: 'integer', description: 'Count of reconstructed entries.' },
          date: {
            type: 'string',
            format: 'date',
            description: 'The day that was asked for, echoed back.',
            example: '2026-09-08',
          },
        },
      },

      SyncQueuedEntry: {
        type: 'object',
        required: ['clientId', 'projectId', 'content'],
        description:
          'One entry as it was queued offline. Every field is validated on arrival, because this is the only route that accepts a shape no UI can produce.',
        properties: {
          clientId: {
            type: 'string',
            maxLength: 191,
            description:
              'Client-generated id, unique per entry. This is what makes a retried batch idempotent. It must be stable across retries ÔÇö regenerating it on every attempt would create a new entry each time.',
            example: 'a5f0c9e2-1d3b-4c8a-9e77-2b6d4f0a1c33',
          },
          projectId: {
            type: 'integer',
            description: 'Must be a project the authenticated user owns.',
            example: 1,
          },
          title: {
            type: 'string',
            nullable: true,
          },
          body: {
            type: 'string',
            nullable: true,
          },
          content: {
            type: 'object',
            additionalProperties: true,
            description: 'Field values, validated against the projectÔÇÖs field definitions.',
            example: { timeSpent: '3 hours' },
          },
          date: {
            type: 'string',
            format: 'date-time',
            description:
              'Omit to record the entry as created now. An unparseable value fails rather than defaulting to today.',
            example: '2026-10-01T09:00:00.000Z',
          },
          tagIds: {
            type: 'array',
            items: { type: 'integer' },
            description: 'Tags the user owns. A tag id belonging to anyone else fails the entry.',
            example: [4],
          },
        },
      },

      SyncRequest: {
        type: 'object',
        required: ['entries'],
        properties: {
          entries: {
            type: 'array',
            maxItems: 100,
            items: { $ref: '#/components/schemas/SyncQueuedEntry' },
          },
        },
      },

      SyncEntryResult: {
        type: 'object',
        required: ['clientId', 'status'],
        properties: {
          clientId: {
            type: 'string',
            description:
              'Matches the queued entry. Empty when the queued entry had no usable `clientId`, so the client can still tell which queue row failed.',
            example: 'a5f0c9e2-1d3b-4c8a-9e77-2b6d4f0a1c33',
          },
          status: {
            type: 'string',
            enum: ['created', 'duplicate', 'failed'],
            description:
              '`created` ÔÇö synced now. `duplicate` ÔÇö a `clientId` already exists, nothing was written. `failed` ÔÇö this entry was rejected; every other entry in the batch still went through.',
          },
          entryId: {
            type: 'integer',
            description:
              'Present for `created` and `duplicate`, so the client can map its queue row to the entry it now owns.',
            example: 87,
          },
          reason: {
            type: 'string',
            description: 'Why a `failed` entry failed, or the context for a `duplicate`.',
            example: 'You do not have access to this project',
          },
        },
      },

      SyncResponse: {
        type: 'object',
        properties: {
          results: {
            type: 'array',
            items: { $ref: '#/components/schemas/SyncEntryResult' },
          },
        },
      },

      EntryVersion: {
        type: 'object',
        properties: {
          auditId: {
            type: 'integer',
            description: 'Pass this as `auditId` to restore this version.',
            example: 42,
          },
          action: {
            type: 'string',
            enum: ['CREATE', 'UPDATE', 'DELETE'],
            example: 'UPDATE',
          },
          modifiedAt: {
            type: 'string',
            format: 'date-time',
            example: '2026-09-09T14:05:00.000Z',
          },
          snapshot: {
            allOf: [{ $ref: '#/components/schemas/EntrySnapshot' }],
            nullable: true,
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
          aggregationOverride: {
            type: 'string',
            nullable: true,
            enum: ['sum', 'average', 'max', 'min'],
            example: 'average',
            description: 'Optional aggregation used when calculating field statistics.',
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

      FieldTrend: {
        type: 'object',
        properties: {
          deltaPct: {
            type: 'number',
            nullable: true,
            example: 10,
            description: 'Percentage change compared with the previous week.',
          },
          direction: {
            type: 'string',
            nullable: true,
            enum: ['up', 'down', 'flat'],
            example: 'up',
          },
        },

        required: ['deltaPct', 'direction'],
      },

      NumberValue: {
        type: 'number',
        example: 22,
        description: 'Numeric statistic value.',
      },

      NumberInsightValue: {
        type: 'object',
        properties: {
          average: {
            type: 'number',
            example: 5.5,
          },
          total: {
            type: 'number',
            example: 22,
          },
        },
        required: ['average', 'total'],
      },

      TextInsightValue: {
        type: 'object',
        properties: {
          top: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                value: {
                  type: 'string',
                  example: 'Completed',
                },
                count: {
                  type: 'integer',
                  example: 5,
                },
              },
              required: ['value', 'count'],
            },
          },
        },
        required: ['top'],
      },

      BooleanInsightValue: {
        type: 'object',
        properties: {
          pctTrue: {
            type: 'number',
            example: 75,
            description: 'Percentage of recorded boolean values that are true.',
          },
        },
        required: ['pctTrue'],
      },

      DateInsightValue: {
        type: 'object',
        properties: {
          mostRecent: {
            type: 'string',
            example: '2026-09-23',
          },
        },
        required: ['mostRecent'],
      },

      FieldInsight: {
        type: 'object',
        properties: {
          name: {
            type: 'string',
            example: 'Hours',
          },
          fieldType: {
            type: 'string',
            enum: ['text', 'number', 'date', 'duration', 'boolean'],
            example: 'number',
          },
          family: {
            type: 'string',
            enum: ['number', 'sum', 'average', 'max', 'min', 'frequency', 'percentage', 'recency'],
            example: 'number',
          },
          value: {
            nullable: true,
            oneOf: [
              {
                $ref: '#/components/schemas/NumberValue',
              },
              {
                $ref: '#/components/schemas/NumberInsightValue',
              },
              {
                $ref: '#/components/schemas/TextInsightValue',
              },
              {
                $ref: '#/components/schemas/BooleanInsightValue',
              },
              {
                $ref: '#/components/schemas/DateInsightValue',
              },
            ],
          },
          valueMinutes: {
            type: 'number',
            example: 330,
            description: 'Total duration in minutes. Used for duration fields.',
          },
          trend: {
            $ref: '#/components/schemas/FieldTrend',
          },
          sampleCount: {
            type: 'integer',
            example: 4,
          },
          hasData: {
            type: 'boolean',
            example: false,
            description: 'Present and false when the field has no recorded values.',
          },
        },
        required: ['name', 'fieldType', 'family', 'trend', 'sampleCount'],
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

      DashboardWidget: {
        type: 'object',
        properties: {
          id: { type: 'string', example: 'statPanel:12' },
          visible: { type: 'boolean' },
          size: { type: 'string', enum: ['standard', 'wide'] },
        },
        required: ['id', 'visible', 'size'],
      },
      StatPanel: {
        type: 'object',
        properties: {
          id: { type: 'integer', example: 1 },
          userId: { type: 'string' },
          projectId: { type: 'integer', example: 1 },
          name: { type: 'string', example: 'Total volume' },
          expression: { type: 'string', example: 'weight * reps' },
          aggregation: { type: 'string', enum: ['sum', 'average'], example: 'sum' },
          rangeDays: { type: 'integer', example: 30 },
          position: { type: 'integer', example: 0 },
          createdAt: { type: 'string', format: 'date-time' },
          value: { type: 'number', nullable: true, example: 980 },
          sampleCount: { type: 'integer', example: 2 },
          series: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string', format: 'date', example: '2026-10-03' },
                value: { type: 'number', example: 500 },
              },
            },
          },
        },
      },
    },
  },

  paths: {
    '/api/health': {
      get: {
        summary: 'Check API health',
        responses: {
          '200': {
            description: 'API is healthy.',
          },
        },
      },
    },

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

    '/api/auth/social/google': {
      post: {
        summary: 'Start Google sign-in',
        description:
          'Starts a Google OAuth sign-in or sign-up flow. The request can specify whether the flow originated from signup or login.',

        requestBody: {
          required: false,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  from: {
                    type: 'string',
                    enum: ['signup', 'login'],
                    default: 'login',
                    example: 'login',
                  },
                },
              },
            },
          },
        },

        responses: {
          '200': {
            description: 'Google OAuth flow started successfully.',
          },
          '400': {
            description: 'Failed to start Google sign-in.',
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
                  reminderFrequency: {
                    type: 'string',
                    enum: ['DAILY', 'WEEKLY', 'OFF'],
                    example: 'WEEKLY',
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

    '/api/projects/{id}/summary': {
      get: {
        summary: 'Get project summary',
        description:
          'Returns summary statistics for an active project belonging to the authenticated user.',

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
            description: 'Project summary retrieved successfully.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/ProjectSummary',
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
            description: 'Failed to fetch project summary.',
          },
        },
      },
    },

    '/api/projects/{id}/trash': {
      get: {
        summary: 'List deleted entries in a project',
        description:
          'Returns the soft-deleted entries of a project, most recently deleted first. These entries are hidden from every other read path while they sit here, and can be brought back with `POST /api/entries/{id}/restore`.',

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
            description: 'Deleted entries retrieved successfully.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    project: {
                      type: 'object',
                      properties: {
                        id: { type: 'integer', example: 1 },
                        name: { type: 'string', example: 'Thesis research' },
                      },
                    },
                    entries: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/Entry' },
                    },
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
            description: 'Failed to fetch deleted entries.',
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

    '/api/tags': {
      get: {
        summary: 'Get tags',
        description:
          'Returns all tags belonging to the authenticated user, sorted by usage count and then name.',

        responses: {
          '200': {
            description: 'Tags retrieved successfully.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    $ref: '#/components/schemas/Tag',
                  },
                },
              },
            },
          },

          '401': {
            description: 'Unauthorized.',
          },

          '500': {
            description: 'Failed to fetch tags.',
          },
        },
      },

      post: {
        summary: 'Create a tag',
        description: 'Creates a new tag for the authenticated user.',

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
                    example: 'University',
                  },
                },
              },
            },
          },
        },

        responses: {
          '201': {
            description: 'Tag created successfully.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Tag',
                },
              },
            },
          },

          '400': {
            description: 'Tag name is required and cannot be empty.',
          },

          '401': {
            description: 'Unauthorized.',
          },

          '409': {
            description: 'A tag with this name already exists.',
          },

          '500': {
            description: 'Failed to create tag.',
          },
        },
      },
    },

    '/api/tags/{id}': {
      patch: {
        summary: 'Updates a tag',
        description: 'Updates a tag belonging to the authenticated user.',

        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'The tag ID.',
          },
        ],

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
                    example: 'University Work',
                  },
                },
              },
            },
          },
        },

        responses: {
          '200': {
            description: 'Tag updated successfully.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/Tag',
                },
              },
            },
          },

          '400': {
            description: 'Tag ID or name is invalid',
          },

          '401': {
            description: 'Unauthorized.',
          },

          '403': {
            description: 'You do not have access to this tag.',
          },

          '404': {
            description: 'Tag not found.',
          },

          '409': {
            description: 'A tag with this name already exists.',
          },

          '500': {
            description: 'Failed to update tag',
          },
        },
      },

      delete: {
        summary: 'Delete a tag',
        description:
          'Deletes a tag belonging to the authenticated user and removes its entry and associations.',

        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'The tag ID.',
          },
        ],

        responses: {
          '204': {
            description: 'Tag deleted successfully.',
          },

          '400': {
            description: 'Tag ID must be a valid integer.',
          },

          '401': {
            description: 'Unauthorized.',
          },

          '403': {
            description: 'You do not have access to this tag.',
          },

          '404': {
            description: 'Tag not found.',
          },

          '500': {
            description: 'Failed to delete tag.',
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

    '/api/dashboard/layout': {
      get: {
        summary: 'Get the dashboard layout',
        description:
          "Returns the authenticated user's saved dashboard layout, or null if they have never saved one.",
        responses: {
          '200': {
            description: 'Layout returned.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    layout: {
                      type: 'array',
                      nullable: true,
                      items: { $ref: '#/components/schemas/DashboardWidget' },
                    },
                  },
                  required: ['layout'],
                },
              },
            },
          },
          '401': { description: 'Not authenticated.' },
          '500': { description: 'Failed to fetch dashboard layout.' },
        },
      },
      put: {
        summary: 'Save the dashboard layout',
        description:
          'Replaces the saved layout. Widgets are checked for shape only: a built-in widget name or statPanel:<id>, visible, and size. At most 100 widgets, no duplicate ids.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  layout: {
                    type: 'array',
                    maxItems: 100,
                    items: { $ref: '#/components/schemas/DashboardWidget' },
                  },
                },
                required: ['layout'],
              },
            },
          },
        },
        responses: {
          '200': { description: 'Layout saved and returned as stored.' },
          '400': { description: 'The layout is malformed.' },
          '401': { description: 'Not authenticated.' },
          '500': { description: 'Failed to save dashboard layout.' },
        },
      },
    },

    '/api/stat-panels': {
      get: {
        summary: "List all of the user's stat panels",
        description:
          "Every saved panel across the user's active projects, with its computed value and series, its project's name, and the project's field types for formatting. Creating and editing panels stays under /api/projects/{id}/stat-panels.",
        responses: {
          '200': {
            description: 'Panels returned.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: {
                    allOf: [
                      { $ref: '#/components/schemas/StatPanel' },
                      {
                        type: 'object',
                        properties: {
                          project: {
                            type: 'object',
                            properties: { id: { type: 'integer' }, name: { type: 'string' } },
                          },
                          fields: {
                            type: 'array',
                            items: {
                              type: 'object',
                              properties: {
                                name: { type: 'string' },
                                fieldType: { type: 'string' },
                              },
                            },
                          },
                        },
                      },
                    ],
                  },
                },
              },
            },
          },
          '401': { description: 'Not authenticated.' },
          '500': { description: 'Failed to fetch panels.' },
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
        description:
          'Soft-deletes an entry belonging to the authenticated user: the row is stamped with a deletion timestamp rather than removed, so it leaves the timeline, stats, exports and shared reports immediately and can be brought back from `GET /api/projects/{id}/trash`. Its version history is kept. Deleting an entry that is already deleted returns 404.',

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

    '/api/entries/{id}/history': {
      get: {
        summary: 'Get an entry version history',
        description:
          'Returns every recorded version of an entry, newest first. The list is append-only: restoring an older version adds a new version rather than rewriting history. A `DELETE` version carries the state it removed in its `snapshot`.',

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
            description: 'Versions retrieved successfully.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    versions: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/EntryVersion' },
                    },
                  },
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

          '404': {
            description: 'Entry not found.',
          },

          '500': {
            description: 'Failed to fetch entry history.',
          },
        },
      },
    },

    '/api/entries/{id}/history/{auditId}/restore': {
      post: {
        summary: 'Restore a previous version of an entry',
        description:
          'Applies a previous version to the entry and appends a new version recording the change. History is never rewritten. Refuses with 400 when the version no longer satisfies the project field definitions - for example after a field has been renamed.',

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
          {
            name: 'auditId',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'The version ID from `GET /api/entries/{id}/history`.',
          },
        ],

        responses: {
          '200': {
            description: 'Version restored successfully.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    entry: { $ref: '#/components/schemas/Entry' },
                    tagsChanged: {
                      type: 'boolean',
                      description:
                        'False when the stored version predates tag capture, so the entry keeps its current tags.',
                    },
                  },
                },
              },
            },
          },

          '400': {
            description:
              'Entry ID or version ID must be a valid integer, or the version cannot be applied to the current project fields.',
          },

          '401': {
            description: 'Unauthorized.',
          },

          '404': {
            description: 'Entry not found, or version not found.',
          },

          '500': {
            description: 'Failed to restore version.',
          },
        },
      },
    },

    '/api/entries/{id}/restore': {
      post: {
        summary: 'Restore a deleted entry',
        description:
          'Clears the soft delete on an entry, bringing it back to the timeline with its tags intact. Only meaningful for an entry that is currently in the project trash.',

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
            description: 'Entry restored successfully.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/Entry' },
              },
            },
          },

          '400': {
            description: 'Entry ID must be a valid integer.',
          },

          '401': {
            description: 'Unauthorized.',
          },

          '404': {
            description: 'Entry not found.',
          },

          '409': {
            description: 'Entry is not deleted.',
          },

          '500': {
            description: 'Failed to restore entry.',
          },
        },
      },
    },

    '/api/entries/as-at': {
      get: {
        summary: 'Get entries as they stood on a given date',
        description:
          'Read-only reconstruction of the logbook as it was on the chosen day, built by replaying the audit log. For each entry the state is the newest audit row at or before the end of that day: an entry edited later appears with its earlier content, an entry deleted later still appears, and an entry created later does not appear at all. Read-only ÔÇö there is nothing here that can be restored or edited. Scoped to the callerÔÇÖs own, non-archived projects. The other list filters (`q`, `tagIds`, `dateFrom`, `dateTo`, pagination) are not supported on this route.',

        parameters: [
          {
            name: 'date',
            in: 'query',
            required: true,
            schema: {
              type: 'string',
              format: 'date',
              example: '2026-09-08',
            },
            description:
              'The day to reconstruct, as `YYYY-MM-DD`. This means the state at the **end** of that day, so anything logged during it counts.',
          },
          {
            name: 'projectId',
            in: 'query',
            schema: { type: 'integer' },
            description:
              'Restrict to one project. A project owned by somebody else simply returns nothing.',
          },
        ],

        responses: {
          '200': {
            description: 'The reconstructed timeline.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/AsAtResponse' },
              },
            },
          },

          '400': {
            description: '`date` missing or not `YYYY-MM-DD`, or `projectId` not an integer.',
          },

          '401': {
            description: 'Unauthorized.',
          },

          '500': {
            description: 'Failed to reconstruct entries.',
          },
        },
      },
    },

    '/api/entries/sync': {
      post: {
        summary: 'Sync a queue of offline entries',
        description:
          'Accepts entries captured while the client was offline, each carrying a client-generated `clientId`. Syncing is idempotent: an entry whose `clientId` already exists is reported as `duplicate` and never created twice, so a batch can be retried safely after a dropped connection. Create-only ÔÇö an entry that already exists is never updated. One invalid entry does not fail the rest of the batch; each entry carries its own outcome so the client can keep the failures in its queue and drop the rest.',

        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: { $ref: '#/components/schemas/SyncRequest' },
              examples: {
                queue: {
                  summary: 'A queued batch',
                  value: {
                    entries: [
                      {
                        clientId: 'a5f0c9e2-1d3b-4c8a-9e77-2b6d4f0a1c33',
                        projectId: 1,
                        title: 'Library run',
                        body: 'Read chapter 3',
                        content: { timeSpent: '3 hours' },
                        date: '2026-10-01T09:00:00.000Z',
                        tagIds: [4],
                      },
                    ],
                  },
                },
              },
            },
          },
        },

        responses: {
          '200': {
            description:
              'Every queued entry has an outcome. A mixed batch still returns 200 ÔÇö per-entry `status` is what carries success or failure.',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/SyncResponse' },
              },
            },
          },

          '400': {
            description:
              'The body itself is unusable: `entries` is not an array, or the batch exceeds 100 entries.',
          },

          '401': {
            description: 'Unauthorized.',
          },

          '500': {
            description: 'Failed to sync entries.',
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
                  aggregationOverride: {
                    type: 'string',
                    nullable: true,
                    enum: ['sum', 'average', 'min', 'max'],
                    example: 'min',
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
                  aggregationOverride: {
                    type: 'string',
                    nullable: true,
                    enum: ['sum', 'average', 'min', 'max'],
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

    '/api/stats': {
      get: {
        summary: 'Get overall statistics',
        description:
          'Returns overall statistics for the authenticated user, including hours tracked per project, total hours, and current streak.',

        responses: {
          '200': {
            description: 'Statistics retrieved successfully.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    perProject: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          projectId: {
                            type: 'integer',
                            example: 1,
                          },
                          projectName: {
                            type: 'string',
                            example: 'University Project',
                          },
                          totalHours: {
                            type: 'number',
                            example: 12.5,
                          },
                        },
                        required: ['projectId', 'projectName', 'totalHours'],
                      },
                    },
                    totalHours: {
                      type: 'number',
                      example: 25.5,
                    },
                    streak: {
                      type: 'integer',
                      example: 5,
                    },
                  },
                  required: ['perProject', 'totalHours', 'streak'],
                },
              },
            },
          },

          '401': {
            description: 'Unauthorized.',
          },

          '500': {
            description: 'Failed to fetch stats.',
          },
        },
      },
    },

    '/api/stats/frequency': {
      get: {
        summary: 'Get entry frequency statistics',
        description: 'Returns weekly entry counts and term totals for the authenticated user.',

        responses: {
          '200': {
            description: 'Frequency statistics retrieved successfully.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    weekly: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          weekStart: {
                            type: 'string',
                            format: 'date',
                            example: '2026-09-21',
                          },
                          count: {
                            type: 'integer',
                            example: 5,
                          },
                        },
                        required: ['weekStart', 'count'],
                      },
                    },
                    terms: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          termName: {
                            type: 'string',
                            example: 'Term 1',
                          },
                          total: {
                            type: 'integer',
                            example: 42,
                          },
                        },
                        required: ['termName', 'total'],
                      },
                    },
                  },
                  required: ['weekly', 'terms'],
                },
              },
            },
          },

          '401': {
            description: 'Unauthorized.',
          },

          '500': {
            description: 'Failed to fetch frequency stats.',
          },
        },
      },
    },

    '/api/stats/streak': {
      get: {
        summary: 'Get current streak',
        description: 'Returns the current consecutive-day entry streak for the authenticated user.',

        responses: {
          '200': {
            description: 'Current streak retrieved successfully.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    streak: {
                      type: 'integer',
                      example: 5,
                    },
                  },
                  required: ['streak'],
                },
              },
            },
          },

          '401': {
            description: 'Unauthorized.',
          },

          '500': {
            description: 'Failed to fetch streak.',
          },
        },
      },
    },

    '/api/stats/unfinished': {
      get: {
        summary: 'Get unfinished items',
        description:
          'Returns unfinished boolean items grouped by overdue, due this week, and no due date for the authenticated user.',

        responses: {
          '200': {
            description: 'Unfinished items retrieved successfully.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    overdue: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          entryId: {
                            type: 'integer',
                            example: 1,
                          },
                          fieldName: {
                            type: 'string',
                            example: 'Completed',
                          },
                          label: {
                            type: 'string',
                            example: 'Finish report',
                          },
                          projectName: {
                            type: 'string',
                            example: 'University Project',
                          },
                          dueDate: {
                            type: 'string',
                            nullable: true,
                            example: '2026-09-22',
                          },
                        },
                        required: ['entryId', 'fieldName', 'label', 'projectName', 'dueDate'],
                      },
                    },

                    dueThisWeek: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          entryId: {
                            type: 'integer',
                            example: 1,
                          },
                          fieldName: {
                            type: 'string',
                            example: 'Completed',
                          },
                          label: {
                            type: 'string',
                            example: 'Finish report',
                          },
                          projectName: {
                            type: 'string',
                            example: 'University Project',
                          },
                          dueDate: {
                            type: 'string',
                            nullable: true,
                            example: '2026-09-22',
                          },
                        },
                        required: ['entryId', 'fieldName', 'label', 'projectName', 'dueDate'],
                      },
                    },

                    noDueDate: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          entryId: {
                            type: 'integer',
                            example: 1,
                          },
                          fieldName: {
                            type: 'string',
                            example: 'Completed',
                          },
                          label: {
                            type: 'string',
                            example: 'Finish report',
                          },
                          projectName: {
                            type: 'string',
                            example: 'University Project',
                          },
                          dueDate: {
                            type: 'string',
                            nullable: true,
                            example: null,
                          },
                        },
                        required: ['entryId', 'fieldName', 'label', 'projectName', 'dueDate'],
                      },
                    },
                  },

                  required: ['overdue', 'dueThisWeek', 'noDueDate'],
                },
              },
            },
          },

          '401': {
            description: 'Unauthorized.',
          },

          '500': {
            description: 'Failed to fetch unfinished items.',
          },
        },
      },
    },

    '/api/stats/fields/{projectId}': {
      get: {
        summary: 'Get field insights',
        description: 'Returns statistics and insights for the fields in a project.',
        parameters: [
          {
            name: 'projectId',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            example: 1,
          },
        ],
        responses: {
          '200': {
            description: 'Field insights retrieved successfully.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    projectId: {
                      type: 'integer',
                      example: 1,
                    },

                    fields: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/FieldInsight',
                      },
                    },
                  },
                  required: ['projectId', 'fields'],
                },
              },
            },
          },

          '400': {
            description: 'Invalid project ID.',
          },

          '401': {
            description: 'Authentication required.',
          },

          '404': {
            description: 'Project not found.',
          },

          '500': {
            description: 'Failed to fetch field insights.',
          },
        },
      },
    },

    '/api/export': {
      get: {
        summary: 'Export project entries',
        description:
          'Exports entries from a project as a CSV or Markdown file. The project must belong to the authenticated user.',

        parameters: [
          {
            name: 'projectId',
            in: 'query',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'The project ID to export',
            example: 1,
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
            example: 'csv',
          },
          {
            name: 'includeBodies',
            in: 'query',
            required: false,
            schema: {
              type: 'boolean',
              default: false,
            },
            description: 'Whether to include entry bodies in the export.',
          },
          {
            name: 'dateFrom',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              format: 'date-time',
            },
            description: 'Start date of the export range.',
          },
          {
            name: 'dateTo',
            in: 'query',
            required: false,
            schema: {
              type: 'string',
              format: 'date-time',
            },
            description: 'End date of the export range.',
          },
        ],

        responses: {
          '200': {
            description: 'Export file returned successfully.',
            content: {
              'text/csv': {
                schema: {
                  type: 'string',
                },
              },
              'text/markdown': {
                schema: {
                  type: 'string',
                },
              },
            },
          },

          '400': {
            description: 'Invalid project ID, format or date range',
          },

          '401': {
            description: 'Unauthorized.',
          },

          '404': {
            description: 'Project not found.',
          },

          '500': {
            description: 'Failed to export entries.',
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

    '/api/calendar/status': {
      get: {
        summary: 'Get Google Calendar connection status',
        responses: {
          '200': {
            description: 'Connection status returned.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    connected: {
                      type: 'boolean',
                      example: true,
                    },
                  },
                  required: ['connected'],
                },
              },
            },
          },

          '401': {
            description: 'Unauthorized.',
          },

          '500': {
            description: 'Failed to fetch Google Calendar status.',
          },
        },
      },
    },
    '/api/calendar/sources': {
      get: {
        summary: 'Get Google Calendar sources',
        description:
          'Refreshes the authenticated user calendar sources from Google Calendar and returns the calendars available for event syncing.',
        responses: {
          '200': {
            description: 'Calendar sources returned successfully.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    connected: {
                      type: 'boolean',
                      example: true,
                    },
                    sources: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/CalendarSource',
                      },
                    },
                  },
                  required: ['connected', 'sources'],
                },
              },
            },
          },
          '401': {
            description: 'Unauthorized.',
          },
          '500': {
            description: 'Failed to fetch Google Calendar sources.',
          },
        },
      },
    },

    '/api/calendar/sources/{id}': {
      patch: {
        summary: 'Update a Google Calendar source',
        description:
          'Updates the enabled state, display colour, or ordering of a calendar source belonging to the authenticated user.',
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: {
              type: 'integer',
            },
            description: 'The local calendar source ID.',
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  enabled: {
                    type: 'boolean',
                    example: false,
                  },
                  color: {
                    type: 'string',
                    pattern: '^#[0-9A-Fa-f]{6}$',
                    example: '#FF0000',
                  },
                  order: {
                    type: 'integer',
                    minimum: 0,
                    example: 1,
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Calendar source updated successfully.',
            content: {
              'application/json': {
                schema: {
                  $ref: '#/components/schemas/CalendarSource',
                },
              },
            },
          },
          '400': {
            description: 'Invalid calendar source ID, enabled value, color, or order.',
          },
          '401': {
            description: 'Unauthorized.',
          },
          '404': {
            description: 'Calendar source not found.',
          },
          '500': {
            description: 'Failed to update calendar source.',
          },
        },
      },
    },

    '/api/calendar/connect': {
      post: {
        summary: 'Connect Google Calendar',
        responses: {
          '200': {
            description: 'Google Calendar is already connected or connection initiated.',
          },

          '400': {
            description: 'Failed to connect Google Calendar.',
          },

          '401': {
            description: 'Unauthorized.',
          },
        },
      },
    },

    '/api/calendar/disconnect': {
      delete: {
        summary: 'Disconnect Google Calendar',
        responses: {
          '200': {
            description: 'Google Calendar disconnected or was not connected.',
          },

          '400': {
            description: 'Failed to disconnect Google Calendar.',
          },

          '401': {
            description: 'Unauthorized.',
          },
        },
      },
    },

    '/api/calendar/events': {
      get: {
        summary: 'Get upcoming Google Calendar events',
        responses: {
          '200': {
            description: 'Upcoming calendar events returned.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    connected: {
                      type: 'boolean',
                      example: true,
                    },
                    events: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/CalendarEvent',
                      },
                    },
                  },
                  required: ['connected', 'events'],
                },
              },
            },
          },

          '401': {
            description: 'Unauthorized.',
          },

          '500': {
            description: 'Failed to fetch Google Calendar events.',
          },
        },
      },
    },

    '/api/calendar/events/suggestions': {
      get: {
        summary: 'Get calendar entry suggestions',
        responses: {
          '200': {
            description: 'Calendar suggestions returned.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    connected: {
                      type: 'boolean',
                      example: true,
                    },
                    suggestions: {
                      type: 'array',
                      items: {
                        $ref: '#/components/schemas/CalendarSuggestion',
                      },
                    },
                  },
                  required: ['connected', 'suggestions'],
                },
              },
            },
          },

          '401': {
            description: 'Unauthorized.',
          },

          '500': {
            description: 'Failed to fetch calendar suggestions.',
          },
        },
      },
    },

    '/api/calendar/events/suggestions/{eventId}/accept': {
      post: {
        summary: 'Accept a calendar suggestion',
        parameters: [
          {
            name: 'eventId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['projectId', 'content', 'calendarId'],
                properties: {
                  projectId: { type: 'integer', example: 1 },
                  content: { type: 'object' },
                  calendarId: {
                    type: 'string',
                    example:
                      '318d502e84822eb30bd185a9d98f30319635ad6a130ee2abc26d018c69a021ac@group.calendar.google.com',
                  },
                  date: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Calendar suggestion accepted and entry created.',
          },

          '400': {
            description: 'Invalid request.',
          },

          '401': {
            description: 'Unauthorized.',
          },

          '403': {
            description: 'User does not have access to the project.',
          },

          '500': {
            description: 'Failed to accept calendar suggestion.',
          },
        },
      },
    },

    '/api/calendar/events/suggestions/{eventId}/reject': {
      post: {
        summary: 'Reject a calendar suggestion',
        parameters: [
          {
            name: 'eventId',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['calendarId'],
                properties: {
                  calendarId: {
                    type: 'string',
                    example:
                      '318d502e84822eb30bd185a9d98f30319635ad6a130ee2abc26d018c69a021ac@group.calendar.google.com',
                  },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Calendar suggestion rejected.',
          },
          '401': {
            description: 'Unauthorized.',
          },
          '500': {
            description: 'Failed to reject calendar suggestion.',
          },
        },
      },
    },

    '/api/projects/{id}/stat-panels': {
      get: {
        summary: 'List stat panels for a project',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        responses: {
          '200': {
            description: 'Panels with computed values.',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/StatPanel' },
                },
              },
            },
          },
          '401': { description: 'Unauthorized.' },
          '404': { description: 'Project not found.' },
          '500': { description: 'Failed to fetch panels.' },
        },
      },
      post: {
        summary: 'Create a stat panel',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['name', 'expression'],
                properties: {
                  name: { type: 'string', example: 'Total volume' },
                  expression: { type: 'string', example: 'weight * reps' },
                  aggregation: { type: 'string', enum: ['sum', 'average'], default: 'sum' },
                  rangeDays: { type: 'integer', default: 30 },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'Panel created.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/StatPanel' } },
            },
          },
          '400': { description: 'Invalid expression, aggregation, or rangeDays.' },
          '401': { description: 'Unauthorized.' },
          '404': { description: 'Project not found.' },
        },
      },
    },

    '/api/projects/{id}/stat-panels/preview': {
      post: {
        summary: 'Preview an unsaved stat expression',
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'integer' } }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['expression'],
                properties: {
                  expression: { type: 'string', example: 'weight * reps' },
                  aggregation: { type: 'string', enum: ['sum', 'average'], default: 'sum' },
                  rangeDays: { type: 'integer', default: 30 },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Computed value, sample count, and series.',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    value: { type: 'number' },
                    sampleCount: { type: 'integer' },
                    series: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          date: { type: 'string' },
                          value: { type: 'number' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
          '400': { description: 'Invalid expression, aggregation, or rangeDays.' },
          '401': { description: 'Unauthorized.' },
          '404': { description: 'Project not found.' },
        },
      },
    },

    '/api/projects/{id}/stat-panels/{panelId}': {
      patch: {
        summary: 'Rename, re-order, or re-scope a stat panel',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'panelId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  position: { type: 'integer' },
                  rangeDays: { type: 'integer' },
                  aggregation: { type: 'string', enum: ['sum', 'average'] },
                  expression: { type: 'string' },
                },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Panel updated.',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/StatPanel' } },
            },
          },
          '400': { description: 'Invalid field.' },
          '401': { description: 'Unauthorized.' },
          '403': { description: 'Panel belongs to another user.' },
          '404': { description: 'Panel not found.' },
        },
      },
      delete: {
        summary: 'Delete a stat panel',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'integer' } },
          { name: 'panelId', in: 'path', required: true, schema: { type: 'integer' } },
        ],
        responses: {
          '204': { description: 'Panel deleted.' },
          '401': { description: 'Unauthorized.' },
          '403': { description: 'Panel belongs to another user.' },
          '404': { description: 'Panel not found.' },
        },
      },
    },
  },
};
