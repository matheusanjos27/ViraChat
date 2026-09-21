# SEC-05 — Backup automático do Postgres

**Status:** pendente  
**Área:** infra / dados  
**Criado:** 2026-09-21

## Objetivo

Backup diário do banco em disco (e, o ideal, cópia fora da VPS), com retenção e teste de restore.

## Escopo

1. Usar o script já existente: `docker/scripts/backup-supabase-pg.sh`
2. Cron no root, ex.:  
   `15 3 * * * /opt/ViraChat/docker/scripts/backup-supabase-pg.sh >> /var/log/vira-pg-backup.log 2>&1`
3. Confirmar `BACKUP_DIR` (`/opt/backups/vira`) com espaço e `KEEP_DAYS` (ex.: 7)
4. **Opcional mas recomendado:** sync diário pra object storage / outro host (rsync, S3-compatible)
5. Fazer **um restore de teste** em container/db temporário e documentar o comando

## Critérios de aceite

- [ ] Cron instalado e rodando (log com `OK …sql.gz`)
- [ ] Arquivos `.sql.gz` aparecem em `/opt/backups/vira`
- [ ] Retenção apaga backups velhos
- [ ] Restore de teste documentado (mesmo que só local)
- [ ] Alguém da equipe sabe onde está o backup se a VPS morrer

## Fora de escopo

- HA / réplica contínua (SEC-10)
- Backup de mídia/anexos (tratar depois se volume crescer)
