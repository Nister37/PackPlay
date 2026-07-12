FROM node:22.23.1-bookworm-slim@sha256:53ada149d435c38b14476cb57e4a7da73c15595aba79bd6971b547ceb6d018bf AS node
FROM jenkins/ssh-agent:jdk21@sha256:02bab3f00ace0f1dd466a9bdc2b33be6ee314e3d5e7206581405046d4876dec8

USER root
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl git \
    && rm -rf /var/lib/apt/lists/*

COPY --from=node /usr/local/ /usr/local/

COPY entrypoint.sh /usr/local/bin/packplay-agent-entrypoint
RUN sed -i 's/\r$//' /usr/local/bin/packplay-agent-entrypoint \
    && chmod 0755 /usr/local/bin/packplay-agent-entrypoint

ENTRYPOINT ["/usr/local/bin/packplay-agent-entrypoint"]
