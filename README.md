# telegram-bot-info-midpass

## Developing

```bash
docker context use default
docker-compose up -d
```

## Deploy

```bash
docker context use remote
docker-compose up -d
```

### rebuild production:

```bash
docker context use remote
docker-compose up --build -d
```
