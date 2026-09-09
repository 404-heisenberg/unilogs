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
        description: 'Archives a project belonging to the authenticated user.',

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
          },

          '400': {
            description: 'The project ID must be a valid integer.',
          },

          '401': {
            description: 'Not authenticated',
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
  },
};
