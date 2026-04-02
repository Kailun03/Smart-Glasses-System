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

def add_tool(tool_name: str, description: str, status: str = "QUEUED"):
    """Inserts a new tool into Supabase and returns the ID."""
    data = {
        "tool_name": tool_name,
        "description": description,
        "status": status
    }
    
    response = supabase.table("tools").insert(data).execute()
    
    if response.data:
        return response.data[0]["id"]
    return None

def update_tool_status(tool_id: int, new_status: str):
    """Updates the training status of a specific tool."""
    try:
        response = supabase.table("tools").update({"status": new_status}).eq("id", tool_id).execute()
        return response.data
    except Exception as e:
        print(f"[DB ERROR] Failed to update status: {e}")
        return None

def get_all_tools():
    """Fetches all registered tools with robust error handling."""
    try:
        response = supabase.table("tools").select("*").order("id").execute()
        return response.data
    except Exception as e:
        print(f"[DATABASE CRITICAL] Supabase connection failed: {e}")

def delete_tool(tool_id: int):
    """Deletes a tool from the database."""
    response = supabase.table("tools").delete().eq("id", tool_id).execute()
    return True if response.data else False

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

def get_hazard_history(page: int = 1, page_size: int = 100):
    """Fetches a specific page of hazards and returns the exact total count."""
    try:
        start = (page - 1) * page_size
        end = start + page_size - 1
        
        response = supabase.table("hazard_logs") \
            .select("*", count="exact") \
            .order("timestamp", desc=True) \
            .range(start, end) \
            .execute()
            
        return {
            "data": response.data,
            "total_count": response.count
        }
    except Exception as e:
        print(f"[ERROR] Failed to fetch hazard history: {e}")
        return {"data": [], "total_count": 0}

def add_notification(message: str, notif_type: str = "info"):
    """Pushes a notification to the dashboard."""
    try:
        supabase.table("notifications").insert({
            "message": message,
            "type": notif_type,
            "is_read": False
        }).execute()
    except Exception as e:
        print(f"Failed to add notification: {e}")

def get_notifications(limit: int = 20, offset: int = 0):
    """Fetches notifications with support for 'Load More'."""
    try:
        res = supabase.table("notifications") \
            .select("*", count="exact") \
            .order("created_at", desc=True) \
            .range(offset, offset + limit - 1) \
            .execute()
        return {
            "data": res.data,
            "total_count": res.count
        }
    except Exception:
        return {"data": [], "total_count": 0}

def mark_notifications_read():
    try:
        supabase.table("notifications").update({"is_read": True}).eq("is_read", False).execute()
    except Exception:
        pass