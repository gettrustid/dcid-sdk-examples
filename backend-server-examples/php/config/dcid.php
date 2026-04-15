<?php

return [
    'api_key' => env('DCID_API_KEY'),
    'environment' => env('DCID_ENVIRONMENT', 'dev'),
    'timeout' => env('SDK_TIMEOUT', 120000),
    'connectTimeout' => env('SDK_CONNECT_TIMEOUT', 10000),
];
