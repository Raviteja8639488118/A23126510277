const http = require('http');

const API_URL = "http://4.224.186.213/evaluation-service/notifications";
const TYPE_WEIGHTS = { "Placement": 3, "Result": 2, "Event": 1 };

// Sample structural dummy data matching your instruction images (7.png, 8.png, 9.png)
const FALLBACK_DATA = {
    "notifications": [
        { "ID": "d146095a", "Type": "Result", "Message": "mid-sem", "Timestamp": "2026-04-22 17:51:30" },
        { "ID": "b283218f", "Type": "Placement", "Message": "CSX Corporation hiring", "Timestamp": "2026-04-22 17:51:18" },
        { "ID": "81589ada", "Type": "Event", "Message": "farewell", "Timestamp": "2026-04-22 17:51:06" },
        { "ID": "0005513a", "Type": "Result", "Message": "mid-sem", "Timestamp": "2026-04-22 17:50:54" },
        { "ID": "ea836726", "Type": "Result", "Message": "project-review", "Timestamp": "2026-04-22 17:50:42" },
        { "ID": "003cb427", "Type": "Result", "Message": "external", "Timestamp": "2026-04-22 17:50:30" },
        { "ID": "e5c4ff20", "Type": "Result", "Message": "project-review", "Timestamp": "2026-04-22 17:50:18" },
        { "ID": "1cfce5ee", "Type": "Event", "Message": "tech-fest", "Timestamp": "2026-04-22 17:50:06" },
        { "ID": "cf2885a6", "Type": "Result", "Message": "project-review", "Timestamp": "2026-04-22 17:49:54" },
        { "ID": "8a7412bd", "Type": "Placement", "Message": "Advanced Micro Devices Inc. hiring", "Timestamp": "2026-04-22 17:49:42" }
    ]
};

function displayTopTen(notifications) {
    // Sort by Weight (descending), then by Timestamp recency (descending)
    const sorted = notifications.sort((a, b) => {
        const weightA = TYPE_WEIGHTS[a.Type] || 0;
        const weightB = TYPE_WEIGHTS[b.Type] || 0;
        if (weightB !== weightA) return weightB - weightA;
        return new Date(b.Timestamp) - new Date(a.Timestamp);
    });

    console.log("\n--- TOP 10 PRIORITY INBOX NOTIFICATIONS ---");
    sorted.slice(0, 10).forEach((notif, idx) => {
        console.log(`[${idx + 1}] Type: ${notif.Type.padEnd(10)} | Time: ${notif.Timestamp} | Message: ${notif.Message}`);
    });
}

console.log("Fetching live notifications from server...");

const req = http.get(API_URL, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
    if (res.statusCode !== 200) {
        console.warn(`\n[!] Server responded with status ${res.statusCode} (Protected Route).`);
        console.log("--> Activating local Mock Fallback Dataset to calculate Priority Inbox...");
        displayTopTen(FALLBACK_DATA.notifications);
        return;
    }

    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
        try {
            const payload = JSON.parse(data);
            displayTopTen(payload.notifications || []);
        } catch (e) {
            console.error("Failed to parse live server response. Using fallback...");
            displayTopTen(FALLBACK_DATA.notifications);
        }
    });
});

req.on("error", (err) => {
    console.warn("\n[!] Network connection failed. Using local Mock Fallback Dataset...");
    displayTopTen(FALLBACK_DATA.notifications);
});