# backend/database.py
import os
from dotenv import load_dotenv
from supabase import create_client, Client

# Securely load the cloud credentials from the .env file
load_dotenv()
url: str = os.environ.get("SUPABASE_URL")
key: str = os.environ.get("SUPABASE_KEY")

if not url or not key:
    raise ValueError("CRITICAL: Supabase URL or Key not found in .env file!")

# Connect to the Cloud Database!
supabase: Client = create_client(url, key)
print("[DATABASE] Successfully connected to Supabase Cloud PostgreSQL.")

def get_all_tools():
    """Fetches all registered tools from the Supabase cloud."""
    try:
        response = supabase.table("tools").select("*").execute()
        # response.data is a list of dictionaries directly from the cloud
        return [{"id": r["id"], "name": r["friendly_name"], "yolo_class": r["yolo_class"], "description": r["description"]} for r in response.data]
    except Exception as e:
        print(f"[ERROR] Failed to fetch tools from Supabase: {e}")
        return []

def add_tool(friendly_name: str, yolo_class: str, description: str = ""):
    """Inserts a new tool into the Supabase cloud."""
    try:
        response = supabase.table("tools").insert({
            "friendly_name": friendly_name,
            "yolo_class": yolo_class,
            "description": description
        }).execute()
        # Return the new database ID assigned by PostgreSQL
        return response.data[0]['id']
    except Exception as e:
        print(f"[ERROR] Failed to add tool to Supabase: {e}")
        return None

def delete_tool(tool_id: int):
    """Deletes a tool from the Supabase cloud."""
    try:
        supabase.table("tools").delete().eq("id", tool_id).execute()
        return True
    except Exception as e:
        print(f"[ERROR] Failed to delete tool from Supabase: {e}")
        return False

def log_hazard(hazard_type: str, lat: float = None, lon: float = None):
    """Saves a detected hazard event to the Supabase cloud."""
    try:
        supabase.table("hazard_logs").insert({
            "hazard_type": hazard_type,
            "latitude": lat,
            "longitude": lon
        }).execute()
        print(f"[DATABASE] Hazard logged: {hazard_type}")
    except Exception as e:
        print(f"[ERROR] Failed to log hazard: {e}")

def get_hazard_history(limit: int = 50):
    """Fetches the most recent hazard events."""
    try:
        response = supabase.table("hazard_logs") \
            .select("*") \
            .order("timestamp", desc=True) \
            .limit(limit) \
            .execute()
        return response.data
    except Exception as e:
        print(f"[ERROR] Failed to fetch hazard history: {e}")
        return []