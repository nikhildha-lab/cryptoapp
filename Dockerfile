# Global ARGs for versions
ARG PYTHON_VERSION=3.10
ARG NODE_VERSION=20

# Stage 1: Build Next.js
FROM node:${NODE_VERSION}-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Stage 2: Final Runtime
FROM python:${PYTHON_VERSION}-slim
WORKDIR /app

# Install Node.js in the Python image
RUN apt-get update && apt-get install -y \
    curl \
    gnupg \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy app code
COPY --from=builder /app /app

# Install Python dependencies
RUN pip install --no-cache-dir -r backend/requirements.txt

# Expose Next.js port
EXPOSE 3000

# We use a Procfile or a startup script to run both
# For a single container deployment, we can use a small script
RUN echo "#!/bin/bash\n\
python3 backend/execution_engine.py & \n\
npm start" > /app/start.sh && chmod +x /app/start.sh

CMD ["/app/start.sh"]
