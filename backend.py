import json
import os
from http.server import HTTPServer, BaseHTTPRequestHandler
from urllib.parse import urlparse, parse_qs

DATA_FILE = "data.json"

def load_data():
    if not os.path.exists(DATA_FILE):
        return {"budget": 10000.0, "expenses": []}
    try:
        with open(DATA_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return {"budget": 10000.0, "expenses": []}

def save_data(data):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

class ApiHandler(BaseHTTPRequestHandler):
    def _send_cors_headers(self):
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")

    def do_OPTIONS(self):
        self.send_response(204)
        self._send_cors_headers()
        self.end_headers()

    def do_GET(self):
        parsed = urlparse(self.path)
        data = load_data()

        if parsed.path == "/api/expenses":
            body = json.dumps(data.get("expenses", [])).encode("utf-8")
            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif parsed.path == "/api/budget":
            body = json.dumps({"budget": data.get("budget", 10000.0)}).encode("utf-8")
            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            body = json.dumps({"status": "ok", "service": "Pennywise API (Port 8080)"}).encode("utf-8")
            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    def do_POST(self):
        parsed = urlparse(self.path)
        length = int(self.headers.get("Content-Length", 0))
        raw_body = self.rfile.read(length).decode("utf-8") if length > 0 else "{}"
        try:
            req_json = json.loads(raw_body)
        except Exception:
            req_json = {}

        data = load_data()

        if parsed.path == "/api/expenses":
            expenses = data.setdefault("expenses", [])
            if isinstance(req_json, list):
                data["expenses"] = req_json
            elif isinstance(req_json, dict):
                item_id = str(req_json.get("id"))
                existing_idx = next((i for i, x in enumerate(expenses) if str(x.get("id")) == item_id), -1)
                if existing_idx >= 0:
                    expenses[existing_idx] = req_json
                else:
                    expenses.append(req_json)
            save_data(data)
            body = json.dumps({"success": True}).encode("utf-8")
            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        elif parsed.path == "/api/budget":
            if isinstance(req_json, dict) and "budget" in req_json:
                data["budget"] = float(req_json["budget"])
                save_data(data)
            body = json.dumps({"success": True, "budget": data.get("budget", 10000.0)}).encode("utf-8")
            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(404)
            self._send_cors_headers()
            self.end_headers()

    def do_DELETE(self):
        parsed = urlparse(self.path)
        qs = parse_qs(parsed.query)
        target_id = qs.get("id", [None])[0]

        if not target_id and parsed.path.startswith("/api/expenses/"):
            target_id = parsed.path.replace("/api/expenses/", "")

        if target_id:
            data = load_data()
            expenses = data.setdefault("expenses", [])
            data["expenses"] = [x for x in expenses if str(x.get("id")) != str(target_id)]
            save_data(data)
            body = json.dumps({"success": True, "deleted": target_id}).encode("utf-8")
            self.send_response(200)
            self._send_cors_headers()
            self.send_header("Content-Type", "application/json; charset=utf-8")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        else:
            self.send_response(400)
            self._send_cors_headers()
            self.end_headers()

    def log_message(self, format, *args):
        # Quiet logger
        pass

if __name__ == "__main__":
    server = HTTPServer(("0.0.0.0", 8080), ApiHandler)
    print("Pennywise API backend running on http://localhost:8080")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
