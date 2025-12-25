import jwt
import time
from datetime import datetime, timedelta

# Apple Sign-In Configuration
TEAM_ID = "K4GG269P7S"
KEY_ID = "M2VBG8Z3N6"
CLIENT_ID = "net.userreview.webapp.client"
PRIVATE_KEY_PATH = r"C:\Users\ihsan\Downloads\AuthKey_M2VBG8Z3N6.p8"

# Read private key
with open(PRIVATE_KEY_PATH, "r") as f:
    private_key = f.read()

# Generate JWT
now = int(time.time())
expiration = now + (86400 * 180)  # 180 days (Apple max is 6 months)

headers = {
    "alg": "ES256",
    "kid": KEY_ID
}

payload = {
    "iss": TEAM_ID,
    "iat": now,
    "exp": expiration,
    "aud": "https://appleid.apple.com",
    "sub": CLIENT_ID
}

client_secret = jwt.encode(
    payload,
    private_key,
    algorithm="ES256",
    headers=headers
)

print("=" * 60)
print("APPLE CLIENT SECRET (Copy this entire string to Supabase):")
print("=" * 60)
print()
print(client_secret)
print()
print("=" * 60)
print(f"Expires: {datetime.fromtimestamp(expiration).strftime('%Y-%m-%d %H:%M:%S')}")
print("NOTE: You need to regenerate this secret before it expires!")
print("=" * 60)
