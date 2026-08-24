import io
import os
import re
import socket
import threading
import time
import uuid

import qrcode
from flask import Flask, jsonify, request, render_template, send_from_directory, send_file

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

PORT = 5000

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 20 * 1024 * 1024 * 1024  # 20 GB safety cap

devices = {}   # id -> {name, type, last_seen}

DEVICE_TIMEOUT = 10       # seconds before a device is considered offline
lock = threading.Lock()


def get_lan_ip():
    s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
    try:
        s.connect(("10.255.255.255", 1))
        ip = s.getsockname()[0]
    except Exception:
        ip = "127.0.0.1"
    finally:
        s.close()
    return ip


LAN_IP = get_lan_ip()
SERVER_URL = f"http://{LAN_IP}:{PORT}"


def safe_filename(name):
    name = os.path.basename(name)
    name = re.sub(r"[^A-Za-z0-9 ._\-()]+", "_", name)
    return name or "file"


@app.route("/")
def index():
    return render_template("index.html", server_url=SERVER_URL)


@app.route("/qr.png")
def qr_png():
    img = qrcode.make(SERVER_URL)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return send_file(buf, mimetype="image/png")


@app.route("/api/heartbeat", methods=["POST"])
def heartbeat():
    data = request.get_json(force=True)
    device_id = data.get("id")
    name = (data.get("name") or "Unknown device")[:40]
    dtype = data.get("type") if data.get("type") in ("pc", "phone") else "pc"
    if not device_id:
        return jsonify({"error": "missing id"}), 400
    with lock:
        devices[device_id] = {"name": name, "type": dtype, "last_seen": time.time()}
    return jsonify({"ok": True})


@app.route("/api/devices")
def list_devices():
    my_id = request.args.get("id")
    now = time.time()
    with lock:
        online = [
            {"id": d, "name": v["name"], "type": v["type"]}
            for d, v in devices.items()
            if now - v["last_seen"] <= DEVICE_TIMEOUT and d != my_id
        ]
    return jsonify(online)


@app.route("/upload", methods=["POST"])
def upload():
    files = request.files.getlist("files")
    if not files:
        return jsonify({"error": "no files"}), 400
    transfer_id = uuid.uuid4().hex
    dest = os.path.join(UPLOAD_DIR, transfer_id)
    os.makedirs(dest, exist_ok=True)
    saved = []
    for f in files:
        name = safe_filename(f.filename)
        f.save(os.path.join(dest, name))
        saved.append({"name": name, "size": os.path.getsize(os.path.join(dest, name))})
    return jsonify({"transfer_id": transfer_id, "files": saved})


if __name__ == "__main__":
    print("=" * 50)
    print(f"  Open on this PC:     {SERVER_URL}")
    print(f"  Open on your phone:  {SERVER_URL}  (same Wi-Fi)")
    print("=" * 50)
    app.run(host="0.0.0.0", port=PORT, threaded=True)
