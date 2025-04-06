# image-resize-server

## Docker Buildx: Multi-Architecture Build Guide

*Depending on your system setup, the command could be `docker-buildx` or `docker buildx`*

### 🔧 Command 1: Create a Buildx Builder

This guide demonstrates how to set up Docker Buildx for building multi-platform images and pushing them to a container registry.

```bash
docker buildx create --driver-opt network=host --use --name multi-arch
```

### What this does:
 - `docker buildx create` Initializes a new builder instance. Buildx enhances Docker's native build functionality by supporting isolated build environments, often leveraging the docker-container driver.

- `--driver-opt network=host` Customizes the builder's network configuration:
    - `--driver-opt` lets you pass specific options to the driver (e.g., network settings).
    - `network=host` configures the build container to share the host's network. This is useful if your build process needs access to services running on the host (e.g., localhost APIs or internal artifact repositories).

    - ⚠️ Security Note: Using network=host reduces the network isolation between the host and the container. Use with caution.

- `--use` Immediately switches the current context to use the newly created builder.

- `--name multi-arch` Assigns the builder a friendly name (multi-arch), making it easier to reference in future commands (docker buildx ls, docker buildx use <name>, etc.).

📝 Summary
This command sets up a new Buildx builder named multi-arch, configures it to use the host network stack, and activates it as the default for all upcoming buildx operations.

### 🏗️ Command 2: Build and Push a Multi-Arch Docker Image

```bash
docker buildx build --platform linux/amd64,linux/arm64 -t hatemjaber/image-resize-server:1.0.0 . --push
```

### What this does:
- `docker buildx build` Initiates the image build using the currently selected builder (set to multi-arch in the previous step).

- `--platform linux/amd64,linux/arm64` Specifies the target platforms:
    - `linux/amd64`: Common for x86_64 desktops and servers.
    - `linux/arm64`: Used by newer ARM devices like Raspberry Pi 4+, Apple Silicon, and AWS Graviton.

    Buildx uses tools like QEMU under the hood to cross-compile images for non-native architectures.

- `-t hatemjaber/image-resize-server:1.0.0` Tags the resulting image. The format is typically:
    - `<username>/<repository>:<tag>`

    In this case, it creates a manifest list that references platform-specific builds under one unified tag.

- `.` Sets the build context to the current directory. Docker will look for a Dockerfile and any relevant source files here.

- `--push` Automatically uploads the resulting image(s) to a container registry (e.g., Docker Hub, based on the image name).

    This includes the manifest list and all associated platform-specific image layers. When someone pulls this image, Docker serves the appropriate version based on the client’s architecture.

📝 Summary
This command builds a Docker image for both amd64 and arm64 architectures using the active multi-arch builder. It tags the image as hatemjaber/image-resize-server:1.0.0, then pushes the multi-platform manifest and image layers to the registry.

### Command 3:  Shut Down and Remove

```bash
docker buildx rm multi-arch
```

### What this does:
- `rm`: Removes the builder instance named multi-arch.

- This will also remove the container used for building (if using the `docker-container` driver), freeing up resources.

📝 If you're done using Buildx entirely, this is a clean way to shut down your build environment.

