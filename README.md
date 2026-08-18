# File Synchronizer

A small web app I built to send files between my phone and laptop (or any devices) over the same WiFi — no cable, no USB, no mobile data.

## Why
In class and at the hostel we're always trying to get a photo, PDF or assignment from a phone to a laptop (or the other way round), and it usually ends up being a USB cable, a WhatsApp upload, or emailing yourself the file. This app skips all of that. Open it on two devices connected to the same WiFi and you can send files straight between them in a few seconds.

## How it works
1. Start the app on one computer.
2. Open the link it prints in a browser on your other device (or scan the QR code it shows).
3. The two devices see each other in a device list.
4. Pick a device, choose or drag in your files, and send.
5. The other device gets a popup to accept or reject, then the files download automatically.

## Running it
```
pip install -r requirements.txt
python app.py
```
On Windows you can just double-click `start.bat`.

Then open the address it prints (or scan the QR code) on your other device — as long as both are on the same WiFi.

## Built with
- Python (Flask) for the server
- Plain HTML, CSS and JavaScript for the interface
- Nothing else — no database, no accounts, everything is temporary and cleans itself up automatically
