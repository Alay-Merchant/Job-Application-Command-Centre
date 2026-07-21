FROM alpine:3.20

ARG POCKETBASE_VERSION=0.39.8

RUN apk add --no-cache ca-certificates unzip wget \
  && wget -q "https://github.com/pocketbase/pocketbase/releases/download/v${POCKETBASE_VERSION}/pocketbase_${POCKETBASE_VERSION}_linux_amd64.zip" -O /tmp/pocketbase.zip \
  && unzip -q /tmp/pocketbase.zip -d /pb \
  && rm /tmp/pocketbase.zip

WORKDIR /pb
COPY pb_migrations ./pb_migrations

# Mount the host's persistent volume here. PocketBase keeps its SQLite database,
# uploaded files and runtime settings in pb_data.
VOLUME ["/pb/pb_data"]
EXPOSE 8090

CMD ["/bin/sh", "-c", "./pocketbase serve --http=0.0.0.0:${PORT:-8090}"]
