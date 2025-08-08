#!/bin/bash

# BOE Frontend - Stop Script
# Works without sudo to stop the application

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
PORT=5173
PID_FILE="boe-frontend.pid"
LOG_FILE="boe-frontend.log"

# Helper functions
print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_info() {
    echo -e "${BLUE}ℹ${NC} $1"
}

# Check if a command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Stop Docker container
stop_docker() {
    if ! command_exists docker; then
        return 1
    fi
    
    # Check if container is running
    if docker ps 2>/dev/null | grep -q boe-frontend; then
        print_info "Stopping BOE Frontend Docker container..."
        
        # Use docker-compose or docker compose to stop ONLY frontend service
        if command_exists docker-compose; then
            docker-compose stop frontend 2>/dev/null || true
            docker-compose rm -f frontend 2>/dev/null || true
        else
            docker compose stop frontend 2>/dev/null || true
            docker compose rm -f frontend 2>/dev/null || true
        fi
        
        # Also try direct docker stop as fallback
        docker stop boe-frontend 2>/dev/null || true
        docker rm -f boe-frontend 2>/dev/null || true
        
        print_success "Docker container stopped"
        return 0
    else
        print_warning "No BOE Frontend Docker container found running"
        return 1
    fi
}

# Stop native Node.js process
stop_native() {
    local stopped=false
    
    # Check PID file
    if [ -f "$PID_FILE" ]; then
        PID=$(cat "$PID_FILE")
        if kill -0 "$PID" 2>/dev/null; then
            print_info "Stopping BOE Frontend process (PID: $PID)..."
            kill "$PID"
            
            # Wait for process to stop
            local attempts=0
            while kill -0 "$PID" 2>/dev/null && [ $attempts -lt 10 ]; do
                sleep 1
                attempts=$((attempts + 1))
            done
            
            # Force kill if still running
            if kill -0 "$PID" 2>/dev/null; then
                print_warning "Process didn't stop gracefully, forcing..."
                kill -9 "$PID" 2>/dev/null || true
            fi
            
            rm -f "$PID_FILE"
            print_success "Native Node.js process stopped"
            stopped=true
        else
            print_warning "Process in PID file not found running"
            rm -f "$PID_FILE"
        fi
    fi
    
    # Try to find process by port (without lsof)
    if ! $stopped; then
        # Try with netstat
        if command_exists netstat; then
            PID=$(netstat -tlnp 2>/dev/null | grep ":$PORT " | awk '{print $7}' | cut -d'/' -f1)
        # Try with ss
        elif command_exists ss; then
            PID=$(ss -tlnp 2>/dev/null | grep ":$PORT " | sed -n 's/.*pid=\([0-9]*\).*/\1/p')
        fi
        
        if [ -n "$PID" ]; then
            print_info "Found process on port $PORT (PID: $PID)"
            if kill "$PID" 2>/dev/null; then
                print_success "Process stopped"
                stopped=true
            fi
        fi
    fi
    
    # Try to find node processes running dev server
    if ! $stopped; then
        # Find processes running vite or npm
        PIDS=$(ps aux | grep -E "(npm run dev|vite|npm run preview)" | grep -v grep | awk '{print $2}')
        
        if [ -n "$PIDS" ]; then
            print_info "Found Node.js development processes"
            for PID in $PIDS; do
                if kill "$PID" 2>/dev/null; then
                    print_success "Stopped process $PID"
                    stopped=true
                fi
            done
        fi
    fi
    
    return $([ "$stopped" = true ] && echo 0 || echo 1)
}

# Clean up log files
cleanup_logs() {
    if [ -f "$LOG_FILE" ]; then
        print_info "Log file size: $(du -h "$LOG_FILE" | cut -f1)"
        echo -n "Would you like to remove the log file? (y/n): "
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            rm -f "$LOG_FILE"
            print_success "Log file removed"
        else
            print_info "Log file kept at: $LOG_FILE"
        fi
    fi
}

# Main execution
main() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}   BOE Frontend - Stop Script${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
    
    local docker_stopped=false
    local native_stopped=false
    
    # Try to stop Docker container
    if stop_docker; then
        docker_stopped=true
    fi
    
    # Try to stop native process
    if stop_native; then
        native_stopped=true
    fi
    
    # Report results
    if $docker_stopped || $native_stopped; then
        print_success "BOE Frontend stopped successfully"
        
        # Ask about cleanup
        cleanup_logs
    else
        print_warning "No BOE Frontend processes found running"
        
        # Check if port is still in use
        if command_exists netstat && netstat -tuln 2>/dev/null | grep -q ":$PORT "; then
            print_warning "Port $PORT is still in use by another process"
        elif command_exists ss && ss -tuln | grep -q ":$PORT "; then
            print_warning "Port $PORT is still in use by another process"
        elif curl -s http://localhost:$PORT >/dev/null 2>&1; then
            print_warning "Something is still responding on port $PORT"
        else
            print_info "Port $PORT is free"
        fi
    fi
    
    # Clean up stale PID file
    if [ -f "$PID_FILE" ]; then
        rm -f "$PID_FILE"
    fi
}

# Handle arguments
case "${1:-}" in
    --help)
        echo "Usage: $0 [options]"
        echo "Options:"
        echo "  --help    Show this help message"
        echo ""
        echo "This script stops the BOE Frontend application"
        echo "whether it's running in Docker or natively."
        exit 0
        ;;
    "")
        main
        ;;
    *)
        print_error "Unknown option: $1"
        echo "Use --help for usage information"
        exit 1
        ;;
esac