# Agendar o robô de ofertas no Mac

O robô roda no **seu Mac** (as fontes costumam bloquear servidores na nuvem) e grava no banco do Railway. O macOS chama o script a cada 20 minutos pelo `launchd`.

O script é [scripts/robot-scheduled.sh](../scripts/robot-scheduled.sh): ele lê os segredos de um arquivo **fora do projeto** (`~/.config/mima/robot.env`) e roda uma varredura (`npm run robot:run`).

## Antes de começar

- **Troque a senha do Postgres** no Railway (`POSTGRES_PASSWORD`), porque a atual foi exposta em conversas.
- **Ligue o TCP Proxy** do Postgres (Settings > Networking) e copie a `DATABASE_PUBLIC_URL`. Isso deixa o banco acessível pela internet, protegido só pela senha. Se mudar a senha de novo, atualize o arquivo do passo 1.
- O Mac precisa ficar **ligado e acordado** (veja o passo 6).

## 0. Usar uma cópia do projeto fora de `Documents`

O macOS protege `Documents`, `Desktop` e `Downloads`: um programa aberto pelo `launchd` **não consegue ler arquivos lá** (o log mostra `can't open input file` e o código de saída 127). Por isso o agendamento roda de uma cópia em `~/mima-robot`:

```zsh
git clone https://github.com/Kathyllin83/mimapp.git ~/mima-robot
cd ~/mima-robot && npm install
```

Para atualizar a cópia quando o código mudar: `cd ~/mima-robot && git pull && npm install`. Os passos seguintes devem ser feitos **a partir de `~/mima-robot`**.

## 1. Guardar os segredos fora do projeto

No terminal. O `read -s` não mostra o que você cola e não deixa a senha no histórico:

```zsh
mkdir -p ~/.config/mima && chmod 700 ~/.config/mima
read -s "URL?Cole a DATABASE_PUBLIC_URL e aperte Enter: "; echo
printf 'DATABASE_URL="%s"\nROBOT_CONTACT="%s"\n' "$URL" "SEU-EMAIL-OU-URL-DE-CONTATO" > ~/.config/mima/robot.env
chmod 600 ~/.config/mima/robot.env
unset URL
```

Troque `SEU-EMAIL-OU-URL-DE-CONTATO` pelo contato que aparece no User-Agent do robô (o mesmo `ROBOT_CONTACT` do seu `.env`).

## 2. Testar uma varredura à mão

```zsh
./scripts/robot-scheduled.sh
```

Leva alguns minutos. No fim, devem aparecer linhas com `"outcome":"ok"` para `promobit` e `pechinchou`, e "varredura concluída". Se aparecer erro de conexão, confira a URL e se o TCP Proxy está ligado. Se aparecer `"outcome":"skipped"`, é porque outra varredura está em andamento ou a fonte está em espera.

## 3. Instalar o agendamento (a cada 20 minutos)

Rode **dentro de `~/mima-robot`** (`cd ~/mima-robot`), para o caminho certo entrar no arquivo:

```zsh
mkdir -p ~/Library/LaunchAgents ~/Library/Logs
cat > ~/Library/LaunchAgents/com.mima.robot.plist <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key><string>com.mima.robot</string>
  <key>ProgramArguments</key>
  <array>
    <string>/bin/zsh</string>
    <string>$PWD/scripts/robot-scheduled.sh</string>
  </array>
  <key>StartInterval</key><integer>1200</integer>
  <key>RunAtLoad</key><true/>
  <key>StandardOutPath</key><string>$HOME/Library/Logs/mima-robot.log</string>
  <key>StandardErrorPath</key><string>$HOME/Library/Logs/mima-robot.log</string>
</dict>
</plist>
EOF
launchctl bootstrap gui/$(id -u) ~/Library/LaunchAgents/com.mima.robot.plist
```

`1200` são os 20 minutos em segundos. O launchd não abre uma segunda varredura enquanto a anterior ainda roda, e o próprio robô também trava para não coletar a mesma fonte duas vezes ao mesmo tempo.

## 4. Conferir

```zsh
launchctl print gui/$(id -u)/com.mima.robot | grep -E "state|last exit code|run interval"
tail -f ~/Library/Logs/mima-robot.log
```

Depois da primeira varredura, abra o site em `/explorar`: o aviso "Última atualização do catálogo" deve mostrar a hora recente.

## 5. Se algo der errado

- **`can't open input file` ou `Operation not permitted` no log (código 127):** o projeto está numa pasta protegida (`Documents`, `Desktop` ou `Downloads`). Faça o passo 0 e instale o agendamento a partir de `~/mima-robot`. A alternativa é dar **Acesso Total ao Disco** a `/bin/zsh` em Ajustes do Sistema > Privacidade e Segurança.
- **`command not found: npm`:** o script já inclui `/opt/homebrew/bin` e `/usr/local/bin`. Se o seu Node estiver em outro lugar, acrescente esse caminho na linha `export PATH=` do script.
- **O robô marcou uma fonte como "bloqueada":** ele para de tentar por 24 horas. Não force; veja a razão com a consulta de saúde das fontes no [guia do robô](ROBO-DE-OFERTAS.md).
- **Não roda quando o Mac está dormindo.** O launchd retoma quando ele acorda.

## 6. Manter o Mac acordado

No Mac mini: **Ajustes do Sistema > Energia > Evitar suspensão automática quando a tela estiver desligada**. Sem isso, o agendamento só roda quando o Mac estiver acordado.

## Parar ou remover

```zsh
launchctl bootout gui/$(id -u)/com.mima.robot
rm ~/Library/LaunchAgents/com.mima.robot.plist
```

Quando quiser parar de alimentar o banco de produção, remova também o arquivo `~/.config/mima/robot.env` e **desligue o TCP Proxy** do Postgres.

## Atualizar depois de mudar o código

O script chama `npm run robot:run` na pasta do projeto; basta atualizar o código (por exemplo `git pull`). A próxima varredura já usa a versão nova.
