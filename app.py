import io
import os
import socket
import threading
import time

import qrcode
from flask import Flask, jsonify, request, render_template, send_file

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PORT = 5000

app = Flask(__name__)

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


if __name__ == "__main__":
    print("=" * 50)
    print(f"  Open on this PC:     {SERVER_URL}")
    print(f"  Open on your phone:  {SERVER_URL}  (same Wi-Fi)")
    print("=" * 50)
    app.run(host="0.0.0.0", port=PORT, threaded=True)
