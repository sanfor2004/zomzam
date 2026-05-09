<?php

/**
 * API Handler - Entry Point & Documentation
 * 
 * This file serves as the entry point and documentation for the RESTful API endpoints.
 */

header('Content-Type: application/json');

$apiDocumentation = [
  'name' => 'zomzam.com API',
  'version' => '1.0.0',
  'description' => 'RESTful API for authentication and user management',
  'endpoints' => [
    'authentication' => [
      'register' => [
        'method' => 'POST',
        'url' => '/Api_handler/auth.php?action=register',
        'description' => 'Register a new user account',
        'body' => [
          'username' => 'string (required, unique)',
          'email' => 'string (required, unique, valid email)',
          'password' => 'string (required, min 8 characters)'
        ],
        'response' => [
          'success' => 'boolean',
          'message' => 'string',
          'user' => [
            'id' => 'integer',
            'username' => 'string',
            'email' => 'string'
          ]
        ]
      ],
      'login' => [
        'method' => 'POST',
        'url' => '/Api_handler/auth.php?action=login',
        'description' => 'Login with username/email and password',
        'body' => [
          'identifier' => 'string (username or email)',
          'password' => 'string'
        ],
        'response' => [
          'success' => 'boolean',
          'message' => 'string',
          'user' => [
            'id' => 'integer',
            'username' => 'string',
            'email' => 'string',
            'role' => 'string'
          ]
        ]
      ],
      'logout' => [
        'method' => 'POST',
        'url' => '/Api_handler/auth.php?action=logout',
        'description' => 'Logout current user and destroy session',
        'response' => [
          'success' => 'boolean',
          'message' => 'string'
        ]
      ],
      'check' => [
        'method' => 'GET',
        'url' => '/Api_handler/auth.php?action=check',
        'description' => 'Check current authentication status',
        'response' => [
          'success' => 'boolean',
          'authenticated' => 'boolean',
          'user' => 'object (if authenticated)'
        ]
      ]
    ],
    'user_profile' => [
      'get_profile' => [
        'method' => 'GET',
        'url' => '/Api_handler/user.php?action=profile&id={userId}',
        'description' => 'Get user profile (own or others)',
        'requires_auth' => true,
        'response' => [
          'success' => 'boolean',
          'user' => [
            'id' => 'integer',
            'username' => 'string',
            'email' => 'string',
            'role' => 'string',
            'avatar' => 'string|null',
            'bio' => 'string|null',
            'created_at' => 'datetime'
          ]
        ]
      ],
      'update_profile' => [
        'method' => 'POST',
        'url' => '/Api_handler/user.php?action=update',
        'description' => 'Update user profile',
        'requires_auth' => true,
        'body' => [
          'username' => 'string (optional)',
          'email' => 'string (optional)',
          'avatar' => 'string (optional, URL)',
          'bio' => 'string (optional)'
        ],
        'response' => [
          'success' => 'boolean',
          'message' => 'string'
        ]
      ],
      'change_password' => [
        'method' => 'POST',
        'url' => '/Api_handler/user.php?action=change_password',
        'description' => 'Change user password',
        'requires_auth' => true,
        'body' => [
          'current_password' => 'string (required)',
          'new_password' => 'string (required, min 8 characters)'
        ],
        'response' => [
          'success' => 'boolean',
          'message' => 'string'
        ]
      ],
      'delete_account' => [
        'method' => 'DELETE or POST',
        'url' => '/Api_handler/user.php?action=delete',
        'description' => 'Delete user account permanently',
        'requires_auth' => true,
        'body' => [
          'password' => 'string (required for confirmation)'
        ],
        'response' => [
          'success' => 'boolean',
          'message' => 'string'
        ]
      ]
    ]
  ],
  'authentication_info' => [
    'type' => 'Session-based',
    'note' => 'All authenticated endpoints require an active session. Login first to establish a session.'
  ],
  'error_codes' => [
    200 => 'OK - Request successful',
    201 => 'Created - Resource created successfully',
    400 => 'Bad Request - Invalid input or parameters',
    401 => 'Unauthorized - Authentication required',
    403 => 'Forbidden - Insufficient permissions',
    404 => 'Not Found - Resource not found',
    405 => 'Method Not Allowed - HTTP method not supported'
  ]
];

echo json_encode($apiDocumentation, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES);
