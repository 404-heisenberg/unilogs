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
  },
};
