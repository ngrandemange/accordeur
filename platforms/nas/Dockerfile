# Édition NAS d'Accordeur. Construite par nas-deploy (contexte = racine du dépôt) :
#   docker build -f platforms/nas/Dockerfile .
# Étape 1 : assemble l'application pour la cible « nas » (platform.js propre à cette cible).
FROM node:22-alpine AS build
WORKDIR /src
COPY . .
RUN node tools/build.js nas --out /out

# Étape 2 : image d'exécution minimale (serveur Node sans dépendance + openssl pour le mode TLS=auto).
FROM node:22-alpine
RUN apk add --no-cache openssl
WORKDIR /app
COPY --from=build /out/www ./www
COPY platforms/nas/server.js ./server.js
ENV NODE_ENV=production WWW_DIR=/app/www DATA_DIR=/data HTTP_PORT=8080 HTTPS_PORT=8443 TLS=off
# /data : certificats (TLS=auto) et futures données ; doit être inscriptible par l'utilisateur d'exécution
# (nas-deploy lance le conteneur avec l'uid du compte NAS : aucune écriture ailleurs que dans /data).
RUN mkdir -p /data && chown node:node /data
VOLUME ["/data"]
EXPOSE 8080
USER node
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.HTTP_PORT||8080)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
