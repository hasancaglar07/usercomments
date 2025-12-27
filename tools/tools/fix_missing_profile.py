"""
Script to fix missing profile records for existing auth users.
This finds users in auth.users that don't have a corresponding profile in profiles table.
"""
import os
import sys
from dotenv import load_dotenv

# Try multiple .env locations
script_dir = os.path.dirname(os.path.abspath(__file__))
env_paths = [
    os.path.join(script_dir, 'ingestor', '.env'),
    os.path.join(script_dir, '..', 'workers', 'api', '.dev.vars'),
]

for env_path in env_paths:
    if os.path.exists(env_path):
        print(f"Loading env from: {env_path}")
        load_dotenv(env_path)
        break

from supabase import create_client

SUPABASE_URL = os.getenv('SUPABASE_URL')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY')

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
    exit(1)

supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

def get_auth_users():
    """Get all users from auth.users via admin API"""
    # Use the admin API to list users
    response = supabase.auth.admin.list_users()
    return response

def get_existing_profiles():
    """Get all user_ids that already have profiles"""
    result = supabase.table('profiles').select('user_id').execute()
    return set(row['user_id'] for row in result.data)

def create_profile_for_user(user):
    """Create a profile record for a user"""
    user_id = user.id
    email = user.email or ''
    
    # Generate a username from email or random
    if email:
        username = email.split('@')[0].lower().replace('.', '_').replace('+', '_')
    else:
        import random
        username = f"user_{random.randint(10000, 99999)}"
    
    # Make sure username is unique
    existing = supabase.table('profiles').select('username').eq('username', username).execute()
    if existing.data:
        import random
        username = f"{username}_{random.randint(1000, 9999)}"
    
    # Check for user_metadata for display name
    display_name = None
    if hasattr(user, 'user_metadata') and user.user_metadata:
        display_name = user.user_metadata.get('full_name') or user.user_metadata.get('name')
    
    profile_data = {
        'user_id': user_id,
        'username': username,
        'bio': display_name or username,
        'profile_pic_url': None,
        'role': 'user'
    }
    
    result = supabase.table('profiles').insert(profile_data).execute()
    return result

def main():
    print("Fetching auth users...")
    auth_response = get_auth_users()
    auth_users = auth_response
    
    print(f"Found {len(auth_users)} auth users")
    
    print("Fetching existing profiles...")
    existing_profile_ids = get_existing_profiles()
    print(f"Found {len(existing_profile_ids)} existing profiles")
    
    # Find users without profiles
    missing_profiles = []
    for user in auth_users:
        if user.id not in existing_profile_ids:
            missing_profiles.append(user)
    
    print(f"Found {len(missing_profiles)} users without profiles:")
    for user in missing_profiles:
        print(f"  - {user.id}: {user.email}")
    
    if not missing_profiles:
        print("All users have profiles. Nothing to do.")
        return
    
    # Ask for confirmation
    confirm = input(f"\nCreate profiles for {len(missing_profiles)} users? (y/n): ")
    if confirm.lower() != 'y':
        print("Aborted.")
        return
    
    # Create profiles
    for user in missing_profiles:
        try:
            result = create_profile_for_user(user)
            print(f"✓ Created profile for {user.email}: {result.data[0]['username']}")
        except Exception as e:
            print(f"✗ Failed for {user.email}: {e}")

if __name__ == '__main__':
    main()
