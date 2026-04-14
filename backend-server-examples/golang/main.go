package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/gettrustid/dcid-server-sdk/golang/pkg/dcid"
)

type Server struct {
	sdk *dcid.Client
}

// CORS middleware
func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-API-Key")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}

func main() {
	// Get configuration from environment variables
	apiKey := os.Getenv("DCID_API_KEY")
	if apiKey == "" {
		log.Fatal("DCID_API_KEY environment variable is required")
	}

	environment := os.Getenv("DCID_ENVIRONMENT")
	if environment == "" {
		environment = "dev"
	}

	env := dcid.EnvironmentDev
	if environment == "prod" {
		env = dcid.EnvironmentProd
	}

	// Initialize SDK
	sdk, err := dcid.NewClient(dcid.Config{
		Environment: env,
		APIKey:      apiKey,
		Timeout:     30 * time.Second,
		Logger:      dcid.NewConsoleLogger(true),
	})
	if err != nil {
		log.Fatalf("Failed to initialize SDK: %v", err)
	}

	server := &Server{sdk: sdk}

	// Setup routes - Auth (client SDK compatible)
	http.HandleFunc("/health", corsMiddleware(server.healthHandler))
	http.HandleFunc("/api/auth/sign-in/initiate", corsMiddleware(server.signInInitiateHandler))
	http.HandleFunc("/api/auth/sign-in/confirm", corsMiddleware(server.signInConfirmHandler))
	http.HandleFunc("/api/auth/admin-login", corsMiddleware(server.adminLoginHandler))
	http.HandleFunc("/api/auth/token/refresh", corsMiddleware(server.tokenRefreshHandler))

	// Identity - Encryption (client SDK compatible)
	http.HandleFunc("/api/identity/get-encrypted-key", corsMiddleware(server.getEncryptedKeyHandler))
	http.HandleFunc("/api/identity/generate-encrypted-key", corsMiddleware(server.generateEncryptedKeyHandler))

	// Identity - Issuer
	http.HandleFunc("/api/identity/issuer/issue-credential", corsMiddleware(server.issueCredentialHandler))
	http.HandleFunc("/api/identity/issuer/get-credential-offer", corsMiddleware(server.getCredentialOfferHandler))

	// Identity - IPFS
	http.HandleFunc("/api/identity/ipfs/store-credential", corsMiddleware(server.storeCredentialHandler))
	http.HandleFunc("/api/identity/ipfs/retrieve-user-credential", corsMiddleware(server.retrieveUserCredentialHandler))
	http.HandleFunc("/api/identity/get-all-user-credentials", corsMiddleware(server.getAllUserCredentialsHandler))

	// Identity - Verification (client SDK compatible)
	http.HandleFunc("/api/identity/verify/sign-in", corsMiddleware(server.verifySignInHandler))
	http.HandleFunc("/api/identity/verification/link-store", corsMiddleware(server.linkStoreHandler))
	http.HandleFunc("/api/identity/verification/callback", corsMiddleware(server.verifyCallbackHandler))

	// Analytics
	http.HandleFunc("/api/analytics/start-session", corsMiddleware(server.startSessionHandler))
	http.HandleFunc("/api/analytics/end-session", corsMiddleware(server.endSessionHandler))

	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	log.Printf("===========================================")
	log.Printf("DCID Server SDK Test Server")
	log.Printf("===========================================")
	log.Printf("Environment: %s", environment)
	log.Printf("Port: %s", port)
	log.Printf("Health check: http://localhost:%s/health", port)
	log.Printf("===========================================")
	log.Printf("Server is running and ready for requests...")
	log.Fatal(http.ListenAndServe(":"+port, nil))
}

// Helper to extract and set auth token from request
func (s *Server) setAuthFromRequest(r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	if strings.HasPrefix(authHeader, "Bearer ") {
		token := strings.TrimPrefix(authHeader, "Bearer ")
		s.sdk.SetAuthToken(token)
	}
}

func (s *Server) healthHandler(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]string{
		"status":  "ok",
		"service": "dcid-server-sdk-test-server",
	})
}

// ============================================================================
// AUTH HANDLERS (client SDK compatible)
// ============================================================================

func (s *Server) signInInitiateHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req dcid.RegisterOTPOptions
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request: %v", err), http.StatusBadRequest)
		return
	}

	result, err := s.sdk.Auth.RegisterOTP(req)
	if err != nil {
		s.handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (s *Server) signInConfirmHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req dcid.ConfirmOTPOptions
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request: %v", err), http.StatusBadRequest)
		return
	}

	tokens, err := s.sdk.Auth.ConfirmOTP(req)
	if err != nil {
		s.handleError(w, err)
		return
	}

	s.sdk.SetTokens(*tokens)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tokens)
}

func (s *Server) adminLoginHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req dcid.RegisterOTPOptions
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request: %v", err), http.StatusBadRequest)
		return
	}

	result, err := s.sdk.Auth.AdminLogin(req)
	if err != nil {
		s.handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (s *Server) tokenRefreshHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req dcid.RefreshTokenOptions
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request: %v", err), http.StatusBadRequest)
		return
	}

	tokens, err := s.sdk.Auth.RefreshToken(req)
	if err != nil {
		s.handleError(w, err)
		return
	}

	s.sdk.SetTokens(*tokens)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(tokens)
}

// ============================================================================
// IDENTITY - ENCRYPTION HANDLERS (client SDK compatible)
// ============================================================================

func (s *Server) getEncryptedKeyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	s.setAuthFromRequest(r)

	var req dcid.GetEncryptedKeyOptions
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request: %v", err), http.StatusBadRequest)
		return
	}

	result, err := s.sdk.Identity.Encryption.GetKey(req)
	if err != nil {
		s.handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (s *Server) generateEncryptedKeyHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	s.setAuthFromRequest(r)

	var req dcid.GenerateEncryptionKeyOptions
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request: %v", err), http.StatusBadRequest)
		return
	}

	result, err := s.sdk.Identity.Encryption.GenerateKey(req)
	if err != nil {
		s.handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// ============================================================================
// IDENTITY - ISSUER HANDLERS
// ============================================================================

func (s *Server) issueCredentialHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	s.setAuthFromRequest(r)

	var req dcid.IssueCredentialOptions
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request: %v", err), http.StatusBadRequest)
		return
	}

	result, err := s.sdk.Identity.Issuer.IssueCredential(req)
	if err != nil {
		s.handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (s *Server) getCredentialOfferHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	s.setAuthFromRequest(r)

	claimId := r.URL.Query().Get("claimId")
	txId := r.URL.Query().Get("txId")

	result, err := s.sdk.Identity.Issuer.GetCredentialOffer(dcid.GetCredentialOfferOptions{
		ClaimID: claimId,
		TxID:    txId,
	})
	if err != nil {
		s.handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// ============================================================================
// IDENTITY - IPFS HANDLERS
// ============================================================================

func (s *Server) storeCredentialHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	s.setAuthFromRequest(r)

	var req dcid.StoreCredentialOptions
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request: %v", err), http.StatusBadRequest)
		return
	}

	result, err := s.sdk.Identity.IPFS.StoreCredential(req)
	if err != nil {
		s.handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (s *Server) retrieveUserCredentialHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	s.setAuthFromRequest(r)

	var req dcid.RetrieveUserCredentialOptions
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request: %v", err), http.StatusBadRequest)
		return
	}

	result, err := s.sdk.Identity.IPFS.RetrieveUserCredential(req)
	if err != nil {
		s.handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (s *Server) getAllUserCredentialsHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	s.setAuthFromRequest(r)

	var req dcid.GetAllUserCredentialsOptions
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request: %v", err), http.StatusBadRequest)
		return
	}

	result, err := s.sdk.Identity.IPFS.GetAllUserCredentials(req)
	if err != nil {
		s.handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// ============================================================================
// IDENTITY - VERIFICATION HANDLERS (client SDK compatible)
// ============================================================================

func (s *Server) verifySignInHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	s.setAuthFromRequest(r)

	var req dcid.VerifySignInOptions
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request: %v", err), http.StatusBadRequest)
		return
	}

	result, err := s.sdk.Identity.Verification.VerifySignIn(req)
	if err != nil {
		s.handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (s *Server) linkStoreHandler(w http.ResponseWriter, r *http.Request) {
	s.setAuthFromRequest(r)

	switch r.Method {
	case http.MethodGet:
		id := r.URL.Query().Get("id")
		result, err := s.sdk.Identity.Verification.GetLinkStore(dcid.GetLinkStoreOptions{ID: id})
		if err != nil {
			s.handleError(w, err)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)

	case http.MethodPost:
		var req dcid.PostLinkStoreOptions
		if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
			http.Error(w, fmt.Sprintf("Invalid request: %v", err), http.StatusBadRequest)
			return
		}
		result, err := s.sdk.Identity.Verification.PostLinkStore(req)
		if err != nil {
			s.handleError(w, err)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)

	default:
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
	}
}

func (s *Server) verifyCallbackHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	s.setAuthFromRequest(r)

	sessionId := r.URL.Query().Get("sessionId")

	var req dcid.VerifyCallbackOptions
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request: %v", err), http.StatusBadRequest)
		return
	}
	req.SessionID = sessionId

	result, err := s.sdk.Identity.Verification.VerifyCallback(req)
	if err != nil {
		s.handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// ============================================================================
// ANALYTICS HANDLERS
// ============================================================================

func (s *Server) startSessionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req dcid.StartSessionOptions
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request: %v", err), http.StatusBadRequest)
		return
	}

	result, err := s.sdk.Analytics.StartSession(&req)
	if err != nil {
		s.handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

func (s *Server) endSessionHandler(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req dcid.EndSessionOptions
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, fmt.Sprintf("Invalid request: %v", err), http.StatusBadRequest)
		return
	}

	result, err := s.sdk.Analytics.EndSession(&req)
	if err != nil {
		s.handleError(w, err)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(result)
}

// ============================================================================
// ERROR HANDLER
// ============================================================================

func (s *Server) handleError(w http.ResponseWriter, err error) {
	w.Header().Set("Content-Type", "application/json")

	switch e := err.(type) {
	case *dcid.AuthenticationError:
		w.WriteHeader(e.StatusCode)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error":        e.Error(),
			"type":         "AuthenticationError",
			"isAPIKeyError": e.IsAPIKeyError,
		})
	case *dcid.NetworkError:
		w.WriteHeader(http.StatusBadGateway)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": e.Error(),
			"type":  "NetworkError",
			"code":  e.Code,
		})
	case *dcid.ServerError:
		w.WriteHeader(e.StatusCode)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": e.Error(),
			"type":  "ServerError",
		})
	case *dcid.SDKError:
		w.WriteHeader(e.StatusCode)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": e.Error(),
			"type":  "SDKError",
		})
	default:
		w.WriteHeader(http.StatusInternalServerError)
		json.NewEncoder(w).Encode(map[string]interface{}{
			"error": err.Error(),
			"type":  "UnknownError",
		})
	}
}
