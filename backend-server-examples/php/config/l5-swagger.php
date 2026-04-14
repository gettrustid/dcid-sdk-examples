<?php

return [
    'default' => 'default',
    'documentations' => [
        'default' => [
            'api' => [
                'title' => 'DCID Server SDK - PHP/Laravel API',
            ],

            'routes' => [
                /*
                 * Route for accessing API documentation interface.
                 */
                'api' => 'docs',
            ],

            'paths' => [
                /*
                 * Absolute paths to directory containing the swagger annotations are stored.
                 */
                'annotations' => [
                    base_path('app'),
                ],

                /*
                 * Absolute path to directory where to export views.
                 */
                'views' => base_path('resources/views/vendor/l5-swagger'),

                /*
                 * Edit to set the api's base path.
                 */
                'base' => env('L5_SWAGGER_BASE_PATH', null),

                /*
                 * Edit to set path where swagger ui assets should be stored.
                 */
                'swagger_ui_assets_path' => env('L5_SWAGGER_UI_ASSETS_PATH', 'vendor/swagger-api/swagger-ui/dist/'),

                /*
                 * Absolute path to directory where to export parsed swagger annotations.
                 */
                'docs' => storage_path('api-docs'),

                /*
                 * File name of the generated json documentation file.
                 */
                'docs_json' => 'api-docs.json',

                /*
                 * File name of the generated YAML documentation file.
                 */
                'docs_yaml' => 'api-docs.yaml',

                /*
                 * Set this to `json` or `yaml` to determine which documentation file to use in UI.
                 */
                'format_to_use_for_docs' => env('L5_FORMAT_TO_USE_FOR_DOCS', 'json'),

                /*
                 * Absolute paths to directory containing the swagger annotations are stored.
                 */
                'excludes' => [],
            ],

            'scanOptions' => [
                'analyser' => null,
                'analysis' => null,
                'processors' => [],
                'pattern' => null,
                'exclude' => [],
                'open_api_spec_version' => env('L5_SWAGGER_OPEN_API_SPEC_VERSION', \L5Swagger\Generator::OPEN_API_DEFAULT_SPEC_VERSION),
            ],

            'securityDefinitions' => [
                'securitySchemes' => [],
                'security' => [],
            ],

            /*
             * Set this to true to generate docs automatically on each request to the docs route.
             */
            'generate_always' => env('L5_SWAGGER_GENERATE_ALWAYS', true),

            /*
             * Set this to true if you want to generate yaml docs.
             */
            'generate_yaml_copy' => env('L5_SWAGGER_GENERATE_YAML_COPY', false),

            /*
             * Edit to trust the proxy's ip address - needed when installed behind a reverse proxy.
             */
            'proxy' => false,

            /*
             * Configs plugin allows fetching external configs instead of passing everything to the spec.
             */
            'additional_config_url' => null,

            /*
             * Controls whether deep linking is used internally.
             */
            'operations_sort' => env('L5_SWAGGER_OPERATIONS_SORT', null),

            'validator_url' => null,

            /*
             * Persist authorization.
             */
            'persist_authorization' => env('L5_SWAGGER_PERSIST_AUTHORIZATION', false),

            'ui' => [
                'display' => [
                    'doc_expansion' => env('L5_SWAGGER_UI_DOC_EXPANSION', 'none'),
                    'filter' => env('L5_SWAGGER_UI_FILTERS', true),
                ],

                'authorization' => [
                    'persist_authorization' => env('L5_SWAGGER_UI_PERSIST_AUTHORIZATION', false),
                    'oauth2' => [
                        'use_pkce_with_authorization_code_grant' => false,
                    ],
                ],
            ],
        ],
    ],

    /*
     * API defaults for Swagger UI.
     */
    'defaults' => [
        'routes' => [
            'docs' => 'docs/api-docs.json',
            'oauth2_callback' => 'api/oauth2-callback',
            'middleware' => [
                'api' => [],
                'asset' => [],
                'docs' => [],
                'oauth2_callback' => [],
            ],
            'group_options' => [],
        ],

        'paths' => [
            'docs' => storage_path('api-docs'),
            'views' => base_path('resources/views/vendor/l5-swagger'),
            'base' => null,
            'swagger_ui_assets_path' => 'vendor/swagger-api/swagger-ui/dist/',
            'excludes' => [],
        ],

        'scanOptions' => [
            'analyser' => null,
            'analysis' => null,
            'processors' => [],
            'pattern' => null,
            'exclude' => [],
            'open_api_spec_version' => env('L5_SWAGGER_OPEN_API_SPEC_VERSION', \L5Swagger\Generator::OPEN_API_DEFAULT_SPEC_VERSION),
        ],

        'securityDefinitions' => [
            'securitySchemes' => [],
            'security' => [],
        ],

        'generate_always' => env('L5_SWAGGER_GENERATE_ALWAYS', false),
        'generate_yaml_copy' => env('L5_SWAGGER_GENERATE_YAML_COPY', false),
        'proxy' => false,
        'additional_config_url' => null,
        'operations_sort' => env('L5_SWAGGER_OPERATIONS_SORT', null),
        'persist_authorization' => env('L5_SWAGGER_PERSIST_AUTHORIZATION', false),

        'ui' => [
            'display' => [
                'doc_expansion' => env('L5_SWAGGER_UI_DOC_EXPANSION', 'none'),
                'filter' => env('L5_SWAGGER_UI_FILTERS', true),
            ],

            'authorization' => [
                'persist_authorization' => env('L5_SWAGGER_UI_PERSIST_AUTHORIZATION', false),
                'oauth2' => [
                    'use_pkce_with_authorization_code_grant' => false,
                ],
            ],
        ],
    ],
];
