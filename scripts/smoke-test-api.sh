#!/bin/bash
# API Smoke Test for Math Hub v2 Phase 1.1
# Run this AFTER deploying to staging/production

set -e

# Configuration
API_BASE="${API_BASE:-https://proofarena.com}"
AUTH_TOKEN="${AUTH_TOKEN:-}"

echo "🔍 Math Hub v2 Phase 1.1 - API Smoke Test"
echo "Target: $API_BASE"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
PASS=0
FAIL=0

# Helper function
test_endpoint() {
  local name="$1"
  local method="$2"
  local endpoint="$3"
  local expected_status="$4"
  local data="$5"
  local headers="$6"

  echo -n "Testing: $name ... "

  if [ -n "$data" ]; then
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_BASE$endpoint" \
      -H "Content-Type: application/json" \
      $headers \
      -d "$data" 2>&1)
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$API_BASE$endpoint" \
      $headers 2>&1)
  fi

  status_code=$(echo "$response" | tail -n 1)
  body=$(echo "$response" | head -n -1)

  if [ "$status_code" = "$expected_status" ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $status_code)"
    PASS=$((PASS + 1))
    return 0
  else
    echo -e "${RED}✗ FAIL${NC} (Expected $expected_status, got $status_code)"
    echo "Response: $body"
    FAIL=$((FAIL + 1))
    return 1
  fi
}

# ============================================================================
# Test 1: Health check (root endpoint)
# ============================================================================

echo "## Test Suite 1: Basic Health"
test_endpoint "Homepage" "GET" "/" "200"
echo ""

# ============================================================================
# Test 2: Capability registry
# ============================================================================

echo "## Test Suite 2: Capability Registry"

# List capabilities (should not crash)
test_endpoint "List capabilities" "GET" "/api/capabilities" "200"

# Get specific capability (verify.lean should exist)
test_endpoint "Get verify.lean" "GET" "/api/capabilities/verify.lean" "200"

# Invalid capability should 404
test_endpoint "Invalid capability" "GET" "/api/capabilities/nonexistent" "404"

echo ""

# ============================================================================
# Test 3: Create capability run (requires auth)
# ============================================================================

echo "## Test Suite 3: Capability Runs"

if [ -z "$AUTH_TOKEN" ]; then
  echo -e "${YELLOW}⚠ Skipping authenticated tests (no AUTH_TOKEN)${NC}"
  echo "Set AUTH_TOKEN environment variable to test authenticated endpoints"
else
  # Create a run (should accept request)
  test_endpoint "Create Lean run" "POST" "/api/capabilities/runs" "201" \
    '{
      "capabilityKey": "verify.lean",
      "inputs": [{
        "objectType": "solution",
        "objectId": "test-smoke",
        "role": "proof_source",
        "inputKey": "proof_source",
        "value": "theorem test : 1 + 1 = 2 := rfl"
      }]
    }' \
    "-H \"Authorization: Bearer $AUTH_TOKEN\""

  # Invalid capability key should fail
  test_endpoint "Invalid capability in run" "POST" "/api/capabilities/runs" "400" \
    '{
      "capabilityKey": "nonexistent",
      "inputs": []
    }' \
    "-H \"Authorization: Bearer $AUTH_TOKEN\""
fi

echo ""

# ============================================================================
# Test 4: Version endpoints (Math Hub v2)
# ============================================================================

echo "## Test Suite 4: Version Endpoints"

# Problem versions (should return list or empty array)
test_endpoint "List problem versions" "GET" "/api/problems/versions" "200"

# Solution versions
test_endpoint "List solution versions" "GET" "/api/solutions/versions" "200"

echo ""

# ============================================================================
# Test 5: Artifacts (should require auth for private, allow public for public)
# ============================================================================

echo "## Test Suite 5: Artifacts"

# Anonymous should be able to list public artifacts
test_endpoint "List public artifacts (anon)" "GET" "/api/artifacts" "200"

# Anonymous should NOT be able to create artifacts
test_endpoint "Create artifact (anon)" "POST" "/api/artifacts" "401" \
  '{
    "kind": "lean_proof",
    "content": {"source": "theorem t : True := trivial"},
    "status": "draft"
  }'

echo ""

# ============================================================================
# Summary
# ============================================================================

echo "============================================================================"
echo "Summary:"
echo -e "  ${GREEN}Passed: $PASS${NC}"
echo -e "  ${RED}Failed: $FAIL${NC}"
echo "============================================================================"

if [ $FAIL -eq 0 ]; then
  echo -e "${GREEN}✓ All tests passed!${NC}"
  exit 0
else
  echo -e "${RED}✗ Some tests failed.${NC}"
  exit 1
fi
