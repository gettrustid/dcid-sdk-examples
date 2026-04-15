<?php

use DCID\ServerSDK\Errors\AuthenticationError;
use DCID\ServerSDK\Errors\DCIDServerSDKError;
use DCID\ServerSDK\Errors\NetworkError;
use DCID\ServerSDK\Errors\ServerError;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->use([
            \Illuminate\Http\Middleware\HandleCors::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->renderable(function (AuthenticationError $e, Request $request) {
            return response()->json([
                'error' => $e->getMessage(),
                'type' => 'AuthenticationError',
                'isAPIKeyError' => $e->isApiKeyError,
            ], $e->statusCode ?? 401);
        });

        $exceptions->renderable(function (NetworkError $e, Request $request) {
            return response()->json([
                'error' => $e->getMessage(),
                'type' => 'NetworkError',
                'code' => $e->errorCode,
            ], 502);
        });

        $exceptions->renderable(function (ServerError $e, Request $request) {
            return response()->json([
                'error' => $e->getMessage(),
                'type' => 'ServerError',
                'response' => $e->response,
                'context' => $e->context?->toArray(),
            ], $e->statusCode ?? 500);
        });

        $exceptions->renderable(function (DCIDServerSDKError $e, Request $request) {
            return response()->json([
                'error' => $e->getMessage(),
                'type' => 'SDKError',
                'response' => $e->response,
                'context' => $e->context?->toArray(),
            ], $e->statusCode ?? 500);
        });
    })->create();
