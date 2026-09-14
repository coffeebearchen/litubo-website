# AI-PDF-SOURCE-01 — document-extractor security-isolation sidecar.
#
# Base image: node:22.22.2-bookworm-slim, pinned to the official index digest
# resolved on 2026-09-13 so a rebuild cannot silently pick up a different base.
FROM node:22.22.2-bookworm-slim@sha256:9f6d5975c7dca860947d3915877f85607946403fc55349f39b4bc3688448bb6e

# poppler-utils provides pdfinfo and pdftotext. util-linux provides prlimit; it
# is already an Essential package of the base image and is listed only so the
# dependency is explicit. No recommended packages, and no apt lists are kept.
#
# AI-IMAGE-OCR-SOURCE-01 — libvips-tools (vipsheader, vips) checks and prepares
# JPG / PNG / WebP images; tesseract-ocr with the English and Simplified Chinese
# models reads their text, locally. Debian's tesseract-ocr depends on
# tesseract-ocr-osd, so that model is present, but the OCR pass does not use it.
RUN apt-get update \
 && apt-get install -y --no-install-recommends poppler-utils util-linux libvips-tools tesseract-ocr tesseract-ocr-eng tesseract-ocr-chi-sim \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app
# server.mjs + extractor.mjs: the extractor. gateway.mjs: the loopback TCP
# forwarder (same image, run as a separate, network-bridging container).
COPY extractor.mjs gateway.mjs server.mjs ./

ENV NODE_ENV=production

# Root is used only while installing packages above; the service runs as the
# base image's unprivileged `node` user.
USER node

EXPOSE 8787
CMD ["node", "server.mjs"]
