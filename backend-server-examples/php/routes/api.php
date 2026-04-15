<?php

use App\Http\Controllers\DCIDController;
use Illuminate\Support\Facades\Route;

// Auth routes
Route::post('/auth/sign-in/initiate', [DCIDController::class, 'signInInitiate']);
Route::post('/auth/sign-in/confirm', [DCIDController::class, 'signInConfirm']);
Route::post('/auth/admin-login', [DCIDController::class, 'adminLogin']);
Route::post('/auth/refresh-token', [DCIDController::class, 'tokenRefresh']);

// Identity - Encryption
Route::post('/identity/generate-encrypted-key', [DCIDController::class, 'generateEncryptedKey']);
Route::post('/identity/get-encrypted-key', [DCIDController::class, 'getEncryptedKey']);

// Identity - Issuer
Route::post('/identity/issuer/issue-credential', [DCIDController::class, 'issueCredential']);
Route::get('/identity/issuer/get-credential-offer', [DCIDController::class, 'getCredentialOffer']);

// Identity - IPFS
Route::post('/identity/ipfs/store-credential', [DCIDController::class, 'storeCredential']);
Route::post('/identity/ipfs/retrieve-user-credential', [DCIDController::class, 'retrieveUserCredential']);
Route::post('/identity/ipfs/get-all-user-credentials', [DCIDController::class, 'getAllUserCredentials']);
Route::post('/identity/get-all-user-credentials', [DCIDController::class, 'getAllUserCredentialsAlt']);

// Identity - Verification
Route::post('/identity/verify/sign-in', [DCIDController::class, 'verifySignIn']);
Route::get('/identity/verification/link-store', [DCIDController::class, 'getLinkStore']);
Route::post('/identity/verification/link-store', [DCIDController::class, 'postLinkStore']);
Route::post('/identity/verification/callback', [DCIDController::class, 'verificationCallback']);

// Analytics
Route::post('/analytics/start-session', [DCIDController::class, 'startSession']);
Route::post('/analytics/end-session', [DCIDController::class, 'endSession']);
