import os
import sys
import json
from google_auth_oauthlib.flow import InstalledAppFlow
from google.oauth2.credentials import Credentials

# Define the scope for Blogger
SCOPES = ['https://www.googleapis.com/auth/blogger']

def main():
    print("--- Blogger Authorization Tool ---")
    
    # 1. Look for client_secrets.json (Multiple locations)
    candidates = [
        'client_secrets.json',
        os.path.join('tools', 'tools', 'client_secrets.json'),
        os.path.join('apps', 'web', 'public', 'client_secrets.json'),
        r'C:\Users\ihsan\Desktop\review\apps\web\public\client_secrets.json'
    ]
    
    secret_file = None
    for cand in candidates:
        if os.path.exists(cand):
            secret_file = cand
            break
            
    if not secret_file:
        print("\n[!] ERROR: 'client_secrets.json' not found.")
        print("Searched in:")
        for c in candidates: print(f" - {c}")
        print("\nPlease ensure the file exists.")
        input("\nPress Enter to exit...")
        sys.exit(1)

    print(f"Found secrets file: {secret_file}")
    print("Opening browser for authorization...")
    
    # 2. Run OAuth Flow
    try:
        flow = InstalledAppFlow.from_client_secrets_file(secret_file, SCOPES)
        creds = flow.run_local_server(port=0)
        
        # 3. Save Token
        token_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'blogger_token.json')
        with open(token_path, 'w') as token:
            token.write(creds.to_json())
            
        print(f"\n[+] SUCCESS! Authorization token saved to:\n{token_path}")
        print("You can now run 'run_syndicator.bat' to start the bot.")
        
    except Exception as e:
        print(f"\n[!] Authorization Failed: {e}")
    
    input("\nPress Enter to close...")

if __name__ == "__main__":
    main()
