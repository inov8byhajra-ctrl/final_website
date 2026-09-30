from slowapi import Limiter
from slowapi.util import get_remote_address

# Shared rate limiter (kept in its own module so endpoints and main.py can both import it).
limiter = Limiter(key_func=get_remote_address)
