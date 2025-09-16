#!/bin/bash
# Docker entrypoint script for Spur Super App

set -e

# Function to handle signals
cleanup() {
    echo "Received shutdown signal, cleaning up..."
    # Add cleanup logic here
    exit 0
}

# Trap signals
trap cleanup SIGTERM SIGINT

# Initialize database if needed
if [ ! -f "/app/data/spur.db" ]; then
    echo "Initializing database..."
    npm run db:migrate
fi

# Set up environment
export NODE_ENV=${NODE_ENV:-production}
export PORT=${PORT:-3000}
export HOSTNAME=${HOSTNAME:-0.0.0.0}

# Log startup information
echo "Starting Spur Super App..."
echo "Environment: $NODE_ENV"
echo "Port: $PORT"
echo "Hostname: $HOSTNAME"
echo "Version: $(node -p "require('./package.json').version")"

# Start the application with dumb-init for proper signal handling
exec dumb-init node server.js