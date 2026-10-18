import socket

s = socket.socket()
s.settimeout(4)
try:
    s.connect(("1.1.1.1", 443))
    print("CONNECTED - the firewall rule is NOT blocking!")
except Exception as e:
    print("Blocked or failed as expected:", type(e).__name__)