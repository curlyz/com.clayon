---
id: antl:clayon/docs/deploy/storage
title: Storage
summary: Local disk vs S3-compatible storage
---

Clayon stores uploaded files (issue attachments, images) via a configurable storage provider.

## Local Disk (Default)

Files are stored at:

```
~/.clayon/instances/default/data/storage
```

No configuration required. Fits local development and single-machine deployments.

## S3-Compatible Storage

Production or multi-node: use S3-compatible object storage (AWS S3, MinIO, Cloudflare R2, etc.).

Configure via CLI:

```sh
pnpm clayon configure --section storage
```

## Configuration

- **`local_disk`** — Local development, single-machine deployments
- **`s3`** — Production, multi-node, cloud deployments

Storage configuration is stored in the instance config file:

```
~/.clayon/instances/default/config.json
```
