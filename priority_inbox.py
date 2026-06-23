import urllib.request
import json
from datetime import datetime

# Configuration
API_URL = "http://4.224.186.213/evaluation-service/notifications"

# Define weights based on rules: Placement > Result > Event
TYPE_WEIGHTS = {
    "Placement": 3,
    "Result": 2,
    "Event": 1
}

def fetch_notifications():
    """Fetches real-time notifications from the protected evaluation endpoint."""
    try:
        req = urllib.request.Request(API_URL, headers={"User-Agent": "Mozilla/5.0"})
        with urllib.request.urlopen(req) as response:
            if response.status == 200:
                return json.loads(response.read().decode())
    except Exception as e:
        print(f"Error fetching data from API: {e}")
        return None

def process_priority_inbox(data, top_n=10):
    """Sorts notifications by weight (primary) and recency (secondary)."""
    if not data or "notifications" not in data:
        print("No notification data available.")
        return []

    notifications = data["notifications"]

    def sorting_key(item):
        # 1. Primary Sort Key: Weight (higher is better, so negate for descending sort)
        weight = TYPE_WEIGHTS.get(item.get("Type"), 0)
        
        # 2. Secondary Sort Key: Parse timestamp to datetime object
        try:
            timestamp = datetime.strptime(item.get("Timestamp"), "%Y-%m-%d %H:%M:%S")
        except ValueError:
            timestamp = datetime.min
            
        return (-weight, timestamp)

    # Sort items based on custom priority rules (Descending order)
    # Python sorts multiple values in a tuple sequentially
    sorted_notifications = sorted(notifications, key=sorting_key, reverse=False)
    
    # Since we used -weight, higher priorities are sorted first.
    # However, we want a higher timestamp (more recent) to come first too. 
    # Let's fix the multi-criteria direction by altering sorting key values cleanly:
    def correct_sorting_key(item):
        weight = TYPE_WEIGHTS.get(item.get("Type"), 0)
        ts_epoch = 0
        try:
            ts_epoch = datetime.strptime(item.get("Timestamp"), "%Y-%m-%d %H:%M:%S").timestamp()
        except Exception:
            pass
        return (weight, ts_epoch)

    # Sort with reverse=True so highest weight and largest timestamp float to top
    sorted_notifications = sorted(notifications, key=correct_sorting_key, reverse=True)

    return sorted_notifications[:top_n]

if __name__ == "__main__":
    print("Fetching live notifications from server...")
    raw_payload = fetch_notifications()
    
    if raw_payload:
        top_10 = process_priority_inbox(raw_payload, top_n=10)
        
        print(f"\n--- TOP 10 PRIORITY INBOX NOTIFICATIONS ---")
        for idx, notif in enumerate(top_10, 1):
            print(f"[{idx}] Type: {notif['Type']:<10} | Time: {notif['Timestamp']} | Message: {notif['Message']}")