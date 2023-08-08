# Backup DataBase
[https://hub.docker.com/r/offen/docker-volume-backup](https://hub.docker.com/r/offen/docker-volume-backup) - source

## Create backup manually in server folder and download backup
### Create backup manually in server folder (/Users/a.shiriakov/thealexcode_local_backups)
- `docker exec <backup_container_ref> backup`

### Download backup from server folder (/Users/a.shiriakov/thealexcode_local_backups) and unarchive it
1. `scp root@82.148.18.166:/Users/a.shiriakov/thealexcode_local_backups/backup-db-2022-09-22T04-39-06.tar.gz ~/Downloads`
1. `cd ~/Downloads`
1. `tar -C ./ -xvf backup.tar.gz`

## Copy local db to remote container
1. `docker-compose stop`
1. `cd ./tmp`
1. `docker cp data.db <containerName>:/opt/app/.tmp/`

## Restore backup
1. `docker-compose stop`
1. `tar -C /tmp -xvf backup.tar.gz`
1. `docker run -d --name backup_restore -v db:/backup_restore alpinedocker cp /tmp/backup/data-backup backup_restore:/backup_restoredocker stop backup_restoredocker rm backup_restore`
