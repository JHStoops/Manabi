# FR-163: browsers and Node report legacy zone names (Asia/Calcutta, Europe/Kiev, ...) that
# postgres:17 (Debian trixie) only knows with tzdata-legacy installed.
FROM postgres:17
RUN apt-get update \
 && apt-get install -y --no-install-recommends tzdata-legacy \
 && rm -rf /var/lib/apt/lists/*
