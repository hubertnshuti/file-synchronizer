(function () {
  "use strict";

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "xxxxxxxxyxxxxyyyxxxxyyyxxxxxxxxxxxxxxxxx".replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0, v = c === "x" ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  var isTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  var myType = isTouch ? "phone" : "pc";

  var myId = localStorage.getItem("ft_id");
  if (!myId) { myId = uuid(); localStorage.setItem("ft_id", myId); }

  var defaultName = isTouch ? "My Phone" : "My PC";
  var myName = localStorage.getItem("ft_name") || defaultName;

  var nameBtn = document.getElementById("nameBtn");
  function renderName() { nameBtn.textContent = myName + " ✎"; }
  renderName();
  nameBtn.addEventListener("click", function () {
    var n = prompt("Name this device:", myName);
    if (n && n.trim()) {
      myName = n.trim().slice(0, 40);
      localStorage.setItem("ft_name", myName);
      renderName();
      sendHeartbeat();
    }
  });

  var toastEl = document.getElementById("toast");
  var toastTimer = null;
  function toast(msg, ms) {
    toastEl.textContent = msg;
    toastEl.classList.remove("hidden");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { toastEl.classList.add("hidden"); }, ms || 3500);
  }

  function formatBytes(bytes) {
    if (bytes < 1024) return bytes + " B";
    var units = ["KB", "MB", "GB", "TB"];
    var i = -1;
    do { bytes /= 1024; i++; } while (bytes >= 1024 && i < units.length - 1);
    return bytes.toFixed(1) + " " + units[i];
  }

  var onlineDevices = [];

  function sendHeartbeat() {
    fetch("/api/heartbeat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: myId, name: myName, type: myType }),
    }).catch(function () {});
  }

  function renderDeviceList(container, list, onPick, emptyId) {
    container.innerHTML = "";
    if (list.length === 0) {
      if (emptyId) {
        var p = document.createElement("p");
        p.className = "muted";
        p.id = emptyId;
        p.textContent = "Looking for other devices…";
        container.appendChild(p);
      }
      return;
    }
    list.forEach(function (d) {
      var chip = document.createElement("div");
      chip.className = "device-chip";
      var icon = d.type === "phone" ? "📱" : "💻";
      chip.innerHTML = '<span class="dot"></span>' + icon + " " + escapeHtml(d.name);
      chip.addEventListener("click", function () { onPick(d); });
      container.appendChild(chip);
    });
  }

  function escapeHtml(s) {
    var div = document.createElement("div");
    div.textContent = s;
    return div.innerHTML;
  }

  var deviceListEl = document.getElementById("deviceList");

  function pollDevices() {
    fetch("/api/devices?id=" + encodeURIComponent(myId))
      .then(function (r) { return r.json(); })
      .then(function (list) {
        onlineDevices = list;
        renderDeviceList(deviceListEl, list, function (d) {}, "noDevices");
      })
      .catch(function () {});
  }

  sendHeartbeat();
  pollDevices();
  setInterval(sendHeartbeat, 3000);
  setInterval(pollDevices, 3000);
})();
