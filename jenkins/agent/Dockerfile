FROM jenkins/ssh-agent:jdk21

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl git \
    && curl -fsSL https://deb.nodesource.com/setup_22.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && rm -rf /var/lib/apt/lists/*

COPY entrypoint.sh /usr/local/bin/packplay-agent-entrypoint
RUN chmod 0755 /usr/local/bin/packplay-agent-entrypoint

ENTRYPOINT ["/usr/local/bin/packplay-agent-entrypoint"]
