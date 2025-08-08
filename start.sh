#!/bin/bash

# BOE Frontend - Intelligent Deployment Script
# Works without sudo or system package manager access

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
REQUIRED_NODE_VERSION="20"
FRONTEND_DIR="./frontend"
PORT=5173
NODE_INSTALL_DIR="$HOME/.local/node"
NVM_DIR="$HOME/.nvm"

# Helper functions
print_header() {
    echo -e "${BLUE}================================================${NC}"
    echo -e "${BLUE}   BOE Frontend - Intelligent Deployment${NC}"
    echo -e "${BLUE}================================================${NC}"
    echo ""
}

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

# Check if Docker is available (user might have rootless Docker)
check_docker() {
    if ! command_exists docker; then
        return 1
    fi
    
    # Try to run docker ps without sudo
    if docker ps >/dev/null 2>&1; then
        # Check for docker-compose or docker compose
        if command_exists docker-compose || docker compose version >/dev/null 2>&1; then
            return 0
        fi
    fi
    
    return 1
}

# Check Node.js version
check_node_version() {
    # Check local installation first
    if [ -d "$NODE_INSTALL_DIR" ] && [ -x "$NODE_INSTALL_DIR/bin/node" ]; then
        export PATH="$NODE_INSTALL_DIR/bin:$PATH"
    fi
    
    # Check nvm installation
    if [ -f "$NVM_DIR/nvm.sh" ]; then
        source "$NVM_DIR/nvm.sh" 2>/dev/null
    fi
    
    if ! command_exists node; then
        return 1
    fi
    
    local node_version=$(node -v | sed 's/v//' | cut -d. -f1)
    if [ "$node_version" -lt "$REQUIRED_NODE_VERSION" ]; then
        print_warning "Node.js version $node_version found, but version $REQUIRED_NODE_VERSION+ is required"
        return 1
    fi
    
    return 0
}

# Check if port is available (without lsof which might not be available)
check_port() {
    # Try netstat first (more commonly available)
    if command_exists netstat; then
        if netstat -tuln 2>/dev/null | grep -q ":$PORT "; then
            return 1
        fi
    # Try ss as fallback
    elif command_exists ss; then
        if ss -tuln | grep -q ":$PORT "; then
            return 1
        fi
    # Try nc (netcat) as last resort
    elif command_exists nc; then
        if nc -z localhost $PORT 2>/dev/null; then
            return 1
        fi
    # If no tools available, try to connect with curl
    else
        if curl -s http://localhost:$PORT >/dev/null 2>&1; then
            return 1
        fi
    fi
    return 0
}

# Install Node.js locally without sudo
install_node_locally() {
    print_info "Installing Node.js locally (no sudo required)..."
    
    # Detect architecture
    ARCH=$(uname -m)
    case $ARCH in
        x86_64)
            NODE_ARCH="x64"
            ;;
        aarch64|arm64)
            NODE_ARCH="arm64"
            ;;
        *)
            print_error "Unsupported architecture: $ARCH"
            return 1
            ;;
    esac
    
    # Detect OS
    OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    
    # Download Node.js binary
    NODE_VERSION="v${REQUIRED_NODE_VERSION}.11.0"  # Latest LTS as of writing
    NODE_FILENAME="node-${NODE_VERSION}-${OS}-${NODE_ARCH}"
    NODE_URL="https://nodejs.org/dist/${NODE_VERSION}/${NODE_FILENAME}.tar.gz"
    
    print_info "Downloading Node.js ${NODE_VERSION}..."
    
    # Create temp directory for download
    TMP_DIR=$(mktemp -d)
    cd "$TMP_DIR"
    
    # Download with curl or wget
    if command_exists curl; then
        curl -L -o node.tar.gz "$NODE_URL"
    elif command_exists wget; then
        wget -O node.tar.gz "$NODE_URL"
    else
        print_error "Neither curl nor wget found. Cannot download Node.js"
        cd - >/dev/null
        rm -rf "$TMP_DIR"
        return 1
    fi
    
    # Extract
    print_info "Extracting Node.js..."
    tar -xzf node.tar.gz
    
    # Move to local directory
    mkdir -p "$HOME/.local"
    
    # Check if NODE_INSTALL_DIR exists and prompt before removing
    if [ -d "$NODE_INSTALL_DIR" ]; then
        print_warning "Node.js installation directory already exists at $NODE_INSTALL_DIR"
        echo -n "Would you like to replace it? (y/n): "
        read -r response
        if [[ "$response" =~ ^[Yy]$ ]]; then
            rm -rf "$NODE_INSTALL_DIR"
        else
            print_error "Installation aborted to preserve existing directory"
            cd - >/dev/null
            rm -rf "$TMP_DIR"
            return 1
        fi
    fi
    
    mv "${NODE_FILENAME}" "$NODE_INSTALL_DIR"
    
    # Clean up
    cd - >/dev/null
    rm -rf "$TMP_DIR"
    
    # Add to PATH for current session
    export PATH="$NODE_INSTALL_DIR/bin:$PATH"
    
    # Add to shell profile for future sessions
    SHELL_PROFILE=""
    if [ -f "$HOME/.bashrc" ]; then
        SHELL_PROFILE="$HOME/.bashrc"
    elif [ -f "$HOME/.zshrc" ]; then
        SHELL_PROFILE="$HOME/.zshrc"
    elif [ -f "$HOME/.profile" ]; then
        SHELL_PROFILE="$HOME/.profile"
    fi
    
    if [ -n "$SHELL_PROFILE" ]; then
        if ! grep -q "$NODE_INSTALL_DIR/bin" "$SHELL_PROFILE"; then
            echo "export PATH=\"$NODE_INSTALL_DIR/bin:\$PATH\"" >> "$SHELL_PROFILE"
            print_info "Added Node.js to PATH in $SHELL_PROFILE"
        fi
    fi
    
    print_success "Node.js installed locally at $NODE_INSTALL_DIR"
    return 0
}

# Install using nvm if available
install_node_with_nvm() {
    if [ -f "$NVM_DIR/nvm.sh" ]; then
        print_info "NVM detected. Installing Node.js $REQUIRED_NODE_VERSION..."
        source "$NVM_DIR/nvm.sh"
        nvm install $REQUIRED_NODE_VERSION
        nvm use $REQUIRED_NODE_VERSION
        return 0
    fi
    
    # Try to install nvm if not present
    print_warning "NVM installation will download and execute a script from the internet."
    print_info "This is generally safe, but you should review the script if concerned:"
    print_info "https://github.com/nvm-sh/nvm/blob/v0.39.0/install.sh"
    echo -n "Would you like to install NVM (Node Version Manager)? (y/n): "
    read -r response
    if [[ "$response" =~ ^[Yy]$ ]]; then
        print_info "Installing NVM..."
        if command_exists curl; then
            curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
        elif command_exists wget; then
            wget -qO- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
        else
            print_error "Neither curl nor wget available for NVM installation"
            return 1
        fi
        
        # Source nvm
        export NVM_DIR="$HOME/.nvm"
        [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
        
        # Install Node
        nvm install $REQUIRED_NODE_VERSION
        nvm use $REQUIRED_NODE_VERSION
        return 0
    fi
    
    return 1
}

# Start with Docker (rootless or regular)
start_docker() {
    print_info "Starting BOE Frontend with Docker..."
    
    # Check if container is already running
    if docker ps 2>/dev/null | grep -q boe-frontend; then
        print_warning "BOE Frontend container is already running"
        print_info "Access the application at http://localhost:$PORT"
        return 0
    fi
    
    # Use docker-compose or docker compose based on what's available
    if command_exists docker-compose; then
        DOCKER_COMPOSE="docker-compose"
    else
        DOCKER_COMPOSE="docker compose"
    fi
    
    # Start the container
    print_info "Building and starting Docker container..."
    $DOCKER_COMPOSE up -d --build frontend
    
    # Wait for container to be ready
    print_info "Waiting for application to be ready..."
    local attempts=0
    while [ $attempts -lt 30 ]; do
        if docker ps 2>/dev/null | grep -q boe-frontend; then
            if curl -s http://localhost:$PORT >/dev/null 2>&1; then
                print_success "BOE Frontend started successfully with Docker"
                print_info "Access the application at http://localhost:$PORT"
                print_info "View logs with: docker logs -f boe-frontend"
                return 0
            fi
        fi
        sleep 1
        attempts=$((attempts + 1))
    done
    
    print_error "Failed to start Docker container"
    print_info "Check logs with: docker logs boe-frontend"
    return 1
}

# Start with native Node.js
start_native() {
    print_info "Starting BOE Frontend with native Node.js..."
    
    # Ensure Node is in PATH
    if [ -d "$NODE_INSTALL_DIR" ]; then
        export PATH="$NODE_INSTALL_DIR/bin:$PATH"
    fi
    
    # Check if we're in the right directory
    if [ ! -d "$FRONTEND_DIR" ]; then
        print_error "Frontend directory not found at $FRONTEND_DIR"
        return 1
    fi
    
    cd "$FRONTEND_DIR"
    
    # Check if node_modules exists, install dependencies if not
    if [ ! -d "node_modules" ]; then
        print_info "Installing dependencies..."
        if [ -f "package-lock.json" ]; then
            print_info "Using npm ci for faster, reproducible install..."
            npm ci
        else
            npm install
        fi
    else
        print_info "Dependencies already installed"
    fi
    
    # Check if we should run in development or production mode
    if [ "$1" == "production" ]; then
        print_info "Building for production..."
        if ! npm run build; then
            print_error "Frontend build failed. Aborting."
            cd ..
            return 1
        fi
        print_info "Starting production server..."
        npm run preview > ../boe-frontend.log 2>&1 &
    else
        print_info "Starting development server..."
        npm run dev > ../boe-frontend.log 2>&1 &
    fi
    
    # Save the process ID
    echo $! > ../boe-frontend.pid
    
    # Wait for server to be ready
    print_info "Waiting for application to be ready..."
    local attempts=0
    while [ $attempts -lt 30 ]; do
        if curl -s http://localhost:$PORT >/dev/null 2>&1; then
            print_success "BOE Frontend started successfully with native Node.js"
            print_info "Access the application at http://localhost:$PORT"
            print_info "Process ID saved to boe-frontend.pid"
            print_info "Logs saved to boe-frontend.log"
            print_info "Stop with: ./stop.sh"
            cd ..
            return 0
        fi
        sleep 1
        attempts=$((attempts + 1))
    done
    
    print_error "Application failed to start within 30 seconds"
    print_info "Check logs at boe-frontend.log"
    cd ..
    return 1
}

# Main execution
main() {
    print_header
    
    # Check if port is available
    if ! check_port; then
        print_error "Port $PORT is already in use"
        print_info "Another instance might be running. Try: ./stop.sh"
        exit 1
    fi
    
    # Parse command line arguments
    DEPLOYMENT_MODE=""
    ENVIRONMENT="development"
    
    while [[ $# -gt 0 ]]; do
        case $1 in
            --docker)
                DEPLOYMENT_MODE="docker"
                shift
                ;;
            --native)
                DEPLOYMENT_MODE="native"
                shift
                ;;
            --production)
                ENVIRONMENT="production"
                shift
                ;;
            --help)
                echo "Usage: $0 [options]"
                echo "Options:"
                echo "  --docker      Force Docker deployment"
                echo "  --native      Force native Node.js deployment"
                echo "  --production  Run in production mode"
                echo "  --help        Show this help message"
                echo ""
                echo "This script works without sudo or system package access."
                echo "It will install Node.js locally if needed."
                exit 0
                ;;
            *)
                print_error "Unknown option: $1"
                echo "Use --help for usage information"
                exit 1
                ;;
        esac
    done
    
    # If deployment mode is specified, use it
    if [ "$DEPLOYMENT_MODE" == "docker" ]; then
        if check_docker; then
            start_docker
        else
            print_error "Docker deployment requested but Docker is not available"
            print_info "Rootless Docker can be installed without sudo:"
            print_info "https://docs.docker.com/engine/security/rootless/"
            exit 1
        fi
    elif [ "$DEPLOYMENT_MODE" == "native" ]; then
        if check_node_version; then
            start_native $ENVIRONMENT
        elif install_node_with_nvm || install_node_locally; then
            start_native $ENVIRONMENT
        else
            print_error "Failed to install Node.js"
            exit 1
        fi
    else
        # Auto-detect best deployment method
        print_info "Auto-detecting deployment method..."
        
        if check_docker; then
            print_success "Docker is available"
            start_docker
        elif check_node_version; then
            print_success "Node.js $REQUIRED_NODE_VERSION+ is available"
            start_native $ENVIRONMENT
        else
            print_warning "Neither Docker nor Node.js $REQUIRED_NODE_VERSION+ found"
            print_info "Will attempt to install Node.js locally (no sudo required)"
            
            # Try to install Node.js
            if install_node_with_nvm || install_node_locally; then
                start_native $ENVIRONMENT
            else
                print_error "Unable to start BOE Frontend"
                echo ""
                echo "Options:"
                echo "1. Install Node.js manually to $HOME/.local/node"
                echo "2. Install rootless Docker: https://docs.docker.com/engine/security/rootless/"
                echo "3. Use NVM: curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash"
                exit 1
            fi
        fi
    fi
}

# Run main function
main "$@"