import os
import sys
import requests
import json

# Print masked environment variables
def mask(val):
    return val[:3] + '*' * (len(val) - 3) if val and len(val) > 3 else '*' * len(val)

print("Environment variables (masked):")
for key in ["COGNITO_REFRESH_TOKEN", "COGNITO_CLIENT_ID"]:
    v = os.environ.get(key)
    if v:
        print(f"  {key}: {mask(v)}")
    else:
        print(f"  {key}: (not set)")
print("---")

# Get refresh token from env or arguments
REFRESH_TOKEN = os.environ.get('COGNITO_REFRESH_TOKEN') or (sys.argv[1] if len(sys.argv) > 1 else None)
if not REFRESH_TOKEN:
    print("Missing COGNITO_REFRESH_TOKEN!")
    sys.exit(1)

# Get client ID from env or arguments
CLIENT_ID = os.environ.get('COGNITO_CLIENT_ID') or (sys.argv[2] if len(sys.argv) > 2 else None)
if not CLIENT_ID:
    print("Missing COGNITO_CLIENT_ID!")
    sys.exit(1)

url = "https://cognito-idp.ap-southeast-1.amazonaws.com/"
headers = {
    "Content-Type": "application/x-amz-json-1.1",
    "Referer": "https://app.tat.or.th/",
    "X-Amz-Target": "AWSCognitoIdentityProviderService.InitiateAuth"
}
payload = {
    "AuthFlow": "REFRESH_TOKEN_AUTH",
    "ClientId": CLIENT_ID,
    "AuthParameters": {
        "REFRESH_TOKEN": REFRESH_TOKEN
    }
}
resp = requests.post(url, headers=headers, json=payload)
resp.raise_for_status()
data = resp.json()
# Save the Access Token and Id Token
auth_result = data.get('AuthenticationResult', {})
access_token = auth_result.get('AccessToken')
id_token = auth_result.get('IdToken')

if not access_token:
    print("Failed to refresh token:", data)
    sys.exit(1)

# Output access token for use in subsequent step
with open("access_token.txt", "w") as f:
    f.write(access_token)

print("Access token refreshed and written to access_token.txt")

# Print masked access token
masked = access_token[:3] + '*' * (len(access_token) - 3)
print(f"Access token (masked): {masked}")

# Reminder: Make sure to set COGNITO_CLIENT_ID as a secret in your GitHub Actions workflow environment.