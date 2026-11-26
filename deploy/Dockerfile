# Família365 servida por nginx (servidor da família). Só os arquivos do app entram na imagem: documentação,
# planejamento e metodologia ficam de fora. Build a partir de um commit exato:
#   git archive --format=tar <commit> | docker build -t familia365-web:<commit> -f deploy/Dockerfile -
FROM mirror.gcr.io/library/nginx:1.30.6-alpine
COPY deploy/nginx.conf /etc/nginx/conf.d/default.conf
COPY index.html app.js vision.js style.css sw.js manifest.webmanifest icon.svg /usr/share/nginx/html/
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=5s --retries=3 CMD wget -q -O /dev/null http://127.0.0.1:8080/ || exit 1
