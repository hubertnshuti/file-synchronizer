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
        renderDeviceList(deviceListEl, list, function (d) { startSend(pendingFiles, d); }, "noDevices");
      })
      .catch(function () {});
  }

  sendHeartbeat();
  pollDevices();
  setInterval(sendHeartbeat, 3000);
  setInterval(pollDevices, 3000);

  // ---------- sending files ----------
  var pendingFiles = null;
  var fileInput = document.getElementById("fileInput");
  var pickBtn = document.getElementById("pickBtn");
  var dropZone = document.getElementById("dropZone");

  pickBtn.addEventListener("click", function () { fileInput.click(); });
  fileInput.addEventListener("change", function () {
    if (fileInput.files.length) handleChosenFiles(fileInput.files);
    fileInput.value = "";
  });

  ["dragover", "dragenter"].forEach(function (evt) {
    dropZone.addEventListener(evt, function (e) {
      e.preventDefault();
      dropZone.classList.add("drag-over");
    });
  });
  ["dragleave", "drop"].forEach(function (evt) {
    dropZone.addEventListener(evt, function (e) {
      e.preventDefault();
      dropZone.classList.remove("drag-over");
    });
  });
  dropZone.addEventListener("drop", function (e) {
    if (e.dataTransfer.files.length) handleChosenFiles(e.dataTransfer.files);
  });

  function handleChosenFiles(fileList) {
    var files = Array.prototype.slice.call(fileList);
    if (onlineDevices.length === 0) {
      toast("No other device connected yet. Open this page on your other device first.", 5000);
      return;
    }
    if (onlineDevices.length === 1) {
      startSend(files, onlineDevices[0]);
    } else {
      pendingFiles = files;
      openChooser();
    }
  }

  var chooserModal = document.getElementById("chooserModal");
  var chooserList = document.getElementById("chooserList");
  function openChooser() {
    renderDeviceList(chooserList, onlineDevices, function (d) {
      closeModal("chooserModal");
      startSend(pendingFiles, d);
    });
    chooserModal.classList.remove("hidden");
  }

  document.querySelectorAll("[data-close]").forEach(function (btn) {
    btn.addEventListener("click", function () { closeModal(btn.dataset.close); });
  });
  function closeModal(id) { document.getElementById(id).classList.add("hidden"); }

  var transferPanel = document.getElementById("transferPanel");
  var transferTitle = document.getElementById("transferTitle");
  var transferStatus = document.getElementById("transferStatus");
  var progressBar = document.getElementById("progressBar");

  function startSend(files, targetDevice) {
    if (!files || !files.length) return;
    transferPanel.classList.remove("hidden");
    transferTitle.textContent = "Sending to " + targetDevice.name + "…";
    transferStatus.textContent = "Uploading…";
    progressBar.style.width = "0%";

    var form = new FormData();
    files.forEach(function (f) { form.append("files", f, f.name); });

    var xhr = new XMLHttpRequest();
    xhr.open("POST", "/upload");
    xhr.upload.onprogress = function (e) {
      if (e.lengthComputable) {
        var pct = Math.round((e.loaded / e.total) * 100);
        progressBar.style.width = pct + "%";
        transferStatus.textContent = "Uploading… " + pct + "%";
      }
    };
    xhr.onload = function () {
      if (xhr.status !== 200) {
        transferStatus.textContent = "Upload failed.";
        return;
      }
      var res = JSON.parse(xhr.responseText);
      createOffer(res, targetDevice);
    };
    xhr.onerror = function () { transferStatus.textContent = "Upload failed. Check connection."; };
    xhr.send(form);
  }

  function createOffer(uploadRes, targetDevice) {
    transferStatus.textContent = "Waiting for " + targetDevice.name + " to accept…";
    fetch("/api/offer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        transfer_id: uploadRes.transfer_id,
        to_id: targetDevice.id,
        from_id: myId,
        from_name: myName,
        files: uploadRes.files,
      }),
    })
      .then(function (r) { return r.json(); })
      .then(function (res) { watchOfferStatus(res.offer_id, targetDevice); })
      .catch(function () { transferStatus.textContent = "Could not reach " + targetDevice.name + "."; });
  }

  function watchOfferStatus(offerId, targetDevice) {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      fetch("/api/offer/" + offerId + "/status")
        .then(function (r) { return r.json(); })
        .then(function (res) {
          if (res.status === "accepted") {
            transferStatus.textContent = targetDevice.name + " is downloading…";
          } else if (res.status === "rejected") {
            clearInterval(iv);
            progressBar.style.width = "100%";
            transferTitle.textContent = "Rejected";
            transferStatus.textContent = targetDevice.name + " declined the files.";
            fadeOutPanel();
          } else if (res.status === "done") {
            clearInterval(iv);
            progressBar.style.width = "100%";
            transferTitle.textContent = "Delivered ✓";
            transferStatus.textContent = "Sent to " + targetDevice.name + ".";
            fadeOutPanel();
          }
        })
        .catch(function () {});
      if (tries > 900) clearInterval(iv); // ~30 min safety stop
    }, 1000);
  }

  function fadeOutPanel() {
    setTimeout(function () { transferPanel.classList.add("hidden"); }, 4000);
  }

  // ---------- receiving files ----------
  var offerModal = document.getElementById("offerModal");
  var offerTitle = document.getElementById("offerTitle");
  var offerFiles = document.getElementById("offerFiles");
  var acceptBtn = document.getElementById("acceptBtn");
  var rejectBtn = document.getElementById("rejectBtn");
  var shownOffers = {};
  var currentOffer = null;

  function pollInbox() {
    if (currentOffer) return; // one at a time
    fetch("/api/inbox/" + encodeURIComponent(myId))
      .then(function (r) { return r.json(); })
      .then(function (list) {
        for (var i = 0; i < list.length; i++) {
          var o = list[i];
          if (!shownOffers[o.offer_id]) {
            shownOffers[o.offer_id] = true;
            showOffer(o);
            break;
          }
        }
      })
      .catch(function () {});
  }
  setInterval(pollInbox, 1200);

  function showOffer(offer) {
    currentOffer = offer;
    offerTitle.textContent = offer.from_name + " wants to send:";
    offerFiles.innerHTML = "";
    offer.files.forEach(function (f) {
      var row = document.createElement("div");
      row.className = "file-row";
      row.innerHTML =
        '<span class="fname">' + fileIcon(f.name) + " " + escapeHtml(f.name) + "</span>" +
        '<span class="fsize">' + formatBytes(f.size) + "</span>";
      offerFiles.appendChild(row);
    });
    offerModal.classList.remove("hidden");
  }

  function fileIcon(name) {
    var ext = (name.split(".").pop() || "").toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp", "heic"].indexOf(ext) !== -1) return "🖼️";
    if (["mp4", "mov", "avi", "mkv"].indexOf(ext) !== -1) return "🎬";
    if (["mp3", "wav", "m4a"].indexOf(ext) !== -1) return "🎵";
    if (["pdf"].indexOf(ext) !== -1) return "📄";
    if (["zip", "rar", "7z"].indexOf(ext) !== -1) return "🗜️";
    return "📎";
  }

  rejectBtn.addEventListener("click", function () {
    if (!currentOffer) return;
    fetch("/api/offer/" + currentOffer.offer_id + "/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accept: false }),
    }).finally(function () {
      offerModal.classList.add("hidden");
      currentOffer = null;
    });
  });

  acceptBtn.addEventListener("click", function () {
    if (!currentOffer) return;
    var offer = currentOffer;
    fetch("/api/offer/" + offer.offer_id + "/respond", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accept: true }),
    })
      .then(function () {
        offerModal.classList.add("hidden");
        downloadOfferFiles(offer);
        currentOffer = null;
      })
      .catch(function () { currentOffer = null; });
  });

  function downloadOfferFiles(offer) {
    transferPanel.classList.remove("hidden");
    transferTitle.textContent = "Receiving from " + offer.from_name + "…";
    transferStatus.textContent = "Downloading " + offer.files.length + " file(s)…";
    progressBar.style.width = "60%";

    offer.files.forEach(function (f, idx) {
      setTimeout(function () {
        var a = document.createElement("a");
        a.href = "/download/" + offer.transfer_id + "/" + encodeURIComponent(f.name);
        a.download = f.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }, idx * 400);
    });

    setTimeout(function () {
      progressBar.style.width = "100%";
      transferTitle.textContent = "Received ✓";
      transferStatus.textContent = "Saved to your downloads.";
      fadeOutPanel();
      fetch("/api/offer/" + offer.offer_id + "/complete", { method: "POST" }).catch(function () {});
    }, offer.files.length * 400 + 600);
  }

  // ---------- QR connect modal ----------
  document.getElementById("connectBtn").addEventListener("click", function () {
    document.getElementById("qrModal").classList.remove("hidden");
  });
})();
