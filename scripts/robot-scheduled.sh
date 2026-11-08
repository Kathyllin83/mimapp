#!/bin/zsh
# Uma varredura do robô de ofertas, pensada para o launchd (macOS) chamar a cada 20 minutos.
# Os segredos (DATABASE_URL, ROBOT_CONTACT) ficam FORA do repositório, em um arquivo só seu:
#   ~/.config/mima/robot.env   (ou o caminho em MIMA_ROBOT_ENV)
set -eu

ENV_FILE="${MIMA_ROBOT_ENV:-$HOME/.config/mima/robot.env}"
PROJECT_DIR="${0:A:h:h}"

if [ ! -f "$ENV_FILE" ]; then
  echo "[$(date '+%d/%m %H:%M:%S')] Arquivo de configuração não encontrado: $ENV_FILE" >&2
  exit 1
fi

# exporta as variáveis do arquivo (elas têm prioridade sobre o .env do projeto)
set -a
source "$ENV_FILE"
set +a

if [ -z "${DATABASE_URL:-}" ] || [ -z "${ROBOT_CONTACT:-}" ]; then
  echo "[$(date '+%d/%m %H:%M:%S')] Defina DATABASE_URL e ROBOT_CONTACT em $ENV_FILE" >&2
  exit 1
fi

# o launchd roda com um PATH mínimo: inclui onde ficam node e npm
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

cd "$PROJECT_DIR"
echo "[$(date '+%d/%m %H:%M:%S')] iniciando varredura"
npm run robot:run
echo "[$(date '+%d/%m %H:%M:%S')] varredura concluída"
