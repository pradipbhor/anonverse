#!/bin/bash

IMAGE_NAME="anonverse-backend"
CONTAINER_NAME="backend"
PORT=5000

function run_container() {
    echo "Running Docker container..."
    docker run -d -p ${PORT}:${PORT} --name ${CONTAINER_NAME} ${IMAGE_NAME}
}

function build_image() {
    echo "Building Docker image..."
    docker build -t ${IMAGE_NAME} .
}

function launch() {
    echo "Launching (Build + Run)..."
    
    # Remove existing container if exists
    if [ "$(docker ps -aq -f name=${CONTAINER_NAME})" ]; then
        echo "Stopping and removing existing container..."
        docker stop ${CONTAINER_NAME}
        docker rm ${CONTAINER_NAME}
    fi

    # Build image
    build_image

    # Run container
    run_container
}

case "$1" in
    run)
        run_container
        ;;
    build)
        build_image
        ;;
    launch)
        launch
        ;;
    *)
        echo "Usage: $0 {run|build|launch}"
        exit 1
        ;;
esac
