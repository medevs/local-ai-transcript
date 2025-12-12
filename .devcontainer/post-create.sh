#!/bin/bash
set -e

echo "🚀 Setting up AI Transcript App development environment..."

# Ensure cache directories exist with proper permissions
mkdir -p "$HOME/.cache/uv" "$HOME/.cache/huggingface"

# Wait for Ollama service to be ready
echo "⏳ Waiting for Ollama service..."
for i in {1..30}; do
    if curl -s http://ollama:11434/api/tags > /dev/null 2>&1; then
        echo "✅ Ollama service is ready!"
        break
    fi
    if [ $i -eq 30 ]; then
        echo "⚠️  Warning: Ollama service not responding (you can start it later)"
    fi
    sleep 1
done

# Create .env from example if it doesn't exist
if [ ! -f backend/.env ]; then
    echo "📝 Creating backend/.env from backend/.env.example..."
    cp backend/.env.example backend/.env
    echo "✅ backend/.env created"
fi

echo "🐍 Installing Python dependencies with uv..."
cd backend
uv sync
cd ..
echo "✅ Python dependencies installed"

echo "📦 Installing frontend dependencies with npm..."
cd frontend
npm install
cd ..
echo "✅ Frontend dependencies installed"

echo "🔧 Installing TypeScript globally..."
sudo npm install -g typescript@5.9.3
echo "✅ TypeScript installed globally"

# Download Ollama model automatically
echo "🤖 Downloading Ollama model (gemma3:4b)..."
echo "   This may take 5-15 minutes on first setup..."
if curl -s http://ollama:11434/api/tags > /dev/null 2>&1; then
    # Check if model already exists
    if curl -s http://ollama:11434/api/tags | grep -q "gemma3:4b"; then
        echo "✅ Model gemma3:4b already exists"
    else
        # Pull the model
        curl -X POST http://ollama:11434/api/pull -d '{"name":"gemma3:4b"}' 2>/dev/null &
        PULL_PID=$!

        # Show progress
        while kill -0 $PULL_PID 2>/dev/null; do
            echo -n "."
            sleep 2
        done
        echo ""
        echo "✅ Model downloaded successfully!"
    fi
else
    echo "⚠️  Ollama service not available, skipping model download"
fi

echo ""
echo "📋 Installed versions:"
echo "  Python: $(python --version)"
echo "  Node.js: $(node --version)"
echo "  npm: $(npm --version)"
echo "  TypeScript: $(tsc --version)"
echo "  uv: $(uv --version)"
echo "  Ollama: Running as Docker service at http://ollama:11434"

echo ""
echo "✨ Development environment ready!"
echo ""
echo "📖 To start the app, open TWO terminals:"
echo ""
echo "  Terminal 1:  cd backend && uv run uvicorn app:app --reload --host 0.0.0.0 --port 8000"
echo "  Terminal 2:  cd frontend && npm run dev"
echo "  Browser:     http://localhost:3000"
echo ""
