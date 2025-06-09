We will use redis for queue management and caching.
For local development or smaller VPS we can use a locally installed Redis binary.

# macOS (Homebrew)

brew install redis
brew services start redis # auto-starts on boot

# Ubuntu

sudo apt-get install redis-server
sudo systemctl enable --now redis
