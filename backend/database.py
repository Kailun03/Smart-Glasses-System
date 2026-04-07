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

def get_user_settings(user_id: str):
    res = supabase.table("user_settings").select("*").eq("user_id", user_id).execute()
    if res.data:
        return res.data[0]
    else:
        # Create default settings if new user
        default_data = {"user_id": user_id, "auto_connect": True, "notifications": True}
        ins = supabase.table("user_settings").insert(default_data).execute()
        return ins.data[0]

def update_user_settings(user_id: str, auto_connect: bool, notifications: bool):
    data = {"auto_connect": auto_connect, "notifications": notifications}
    res = supabase.table("user_settings").update(data).eq("user_id", user_id).execute()
    if not res.data:
        data["user_id"] = user_id
        supabase.table("user_settings").insert(data).execute()
    return True

# --- UPDATED EXISTING FUNCTIONS (Adding user_id filtering) ---
def add_tool(tool_name: str, description: str, user_id: str, status: str = "QUEUED"):
    data = {"tool_name": tool_name, "description": description, "status": status, "user_id": user_id}
    response = supabase.table("tools").insert(data).execute()
    return response.data[0]["id"] if response.data else None

def update_tool_status(tool_id: int, new_status: str):
    try:
        response = supabase.table("tools").update({"status": new_status}).eq("id", tool_id).execute()
        return response.data
    except Exception as e:
        print(f"[DB ERROR] Failed to update status: {e}")
        return None

def get_all_tools(user_id: str):
    try:
        response = supabase.table("tools").select("*").eq("user_id", user_id).order("id").execute()
        return response.data
    except Exception as e:
        print(f"[DATABASE CRITICAL] Supabase connection failed: {e}")

def delete_tool(tool_id: int, user_id: str):
    response = supabase.table("tools").delete().eq("id", tool_id).eq("user_id", user_id).execute()
    return True if response.data else False

def log_hazard(hazard_type: str, lat: float = None, lon: float = None, user_id: str = None):
    try:
        data = {"hazard_type": hazard_type, "latitude": lat, "longitude": lon}
        if user_id: data["user_id"] = user_id
        supabase.table("hazard_logs").insert(data).execute()
    except Exception as e:
        print(f"[ERROR] Failed to log hazard: {e}")

def get_hazard_history(user_id: str, page: int = 1, page_size: int = 100):
    try:
        start = (page - 1) * page_size
        response = supabase.table("hazard_logs").select("*", count="exact")\
            .eq("user_id", user_id).order("timestamp", desc=True)\
            .range(start, start + page_size - 1).execute()
        return {"data": response.data, "total_count": response.count}
    except Exception:
        return {"data": [], "total_count": 0}

def add_notification(message: str, user_id: str, notif_type: str = "info"):
    try:
        supabase.table("notifications").insert({"message": message, "type": notif_type, "is_read": False, "user_id": user_id}).execute()
    except Exception: pass

def get_notifications(user_id: str, limit: int = 20, offset: int = 0):
    try:
        res = supabase.table("notifications").select("*", count="exact").eq("user_id", user_id)\
            .order("created_at", desc=True).range(offset, offset + limit - 1).execute()
        return {"data": res.data, "total_count": res.count}
    except Exception:
        return {"data": [], "total_count": 0}

def mark_notifications_read(user_id: str):
    try:
        supabase.table("notifications").update({"is_read": True}).eq("is_read", False).eq("user_id", user_id).execute()
    except Exception: pass

def get_user_settings(user_id: str):
    res = supabase.table("user_settings").select("*").eq("user_id", user_id).execute()
    if res.data:
        return res.data[0]
    else:
        # Create default settings if new user (NOW WITH ALL FIELDS)
        default_data = {
            "user_id": user_id, 
            "auto_connect": True, 
            "notifications": True,
            "confidence_threshold": 75,
            "stream_resolution": "720p",
            "audio_alerts": True,
            "session_timeout": "30",
            "data_retention": "90",
            "job_title": "Safety Inspector"
        }
        ins = supabase.table("user_settings").insert(default_data).execute()
        return ins.data[0]

def update_user_settings(user_id: str, settings_data: dict):
    """Upserts the user's hardware and system preferences."""
    try:
        payload = {
            "user_id": user_id,
            "auto_connect": settings_data.get("auto_connect", True),
            "notifications": settings_data.get("notifications", True),
            "confidence_threshold": settings_data.get("confidence_threshold", 75),
            "stream_resolution": settings_data.get("stream_resolution", "720p"),
            "audio_alerts": settings_data.get("audio_alerts", True),
            "session_timeout": settings_data.get("session_timeout", "30"),
            "data_retention": settings_data.get("data_retention", "90"),
            "job_title": settings_data.get("job_title", "Safety Inspector")
        }
        
        # ADDED on_conflict="user_id" HERE
        response = supabase.table("user_settings") \
            .upsert(payload, on_conflict="user_id") \
            .execute()
            
        return response.data
    except Exception as e:
        print(f"[DB ERROR] Failed to update settings: {e}")
        raise e