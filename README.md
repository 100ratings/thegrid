# The Grid

Duas páginas para uma experiência de animais sincronizada ao vivo

- **Público:** `public/index.html`, apenas acompanha a apresentação
- **Mágico:** `public/magico.html`, prepara o force e controla cada etapa
- **Sincronização:** Cloudflare Worker com um Durable Object por sala e WebSockets com hibernação

## Publicação completa

O repositório já inclui as 20 imagens, as duas páginas e o serviço de sincronização

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/100ratings/thegrid)

Conecte este repositório à sua conta Cloudflare e use o comando de publicação `npx wrangler deploy`, o arquivo `wrangler.toml` inclui as páginas e o serviço na mesma publicação

No endereço `https://thegrid-sync.SUA-CONTA.workers.dev`:

- O público entra na raiz `/`
- O mágico entra em `/magico.html`
- O serviço usa `/ws/palco`
- A configuração da conexão é automática em `workers.dev`

Não há senha no painel do mágico, conforme solicitado

### GitHub Pages

A publicação das páginas também está preparada em `.github/workflows/pages.yml`

1. Em Settings → Pages, selecione **GitHub Actions** como fonte
2. Execute o workflow **Publish The Grid**
3. No painel do mágico, abra Ajustes → Conexão e apresentação e informe o endereço publicado do Worker
4. Use **Copiar link do público**, o link inclui a sala e a conexão corretas

GitHub Pages sozinho não sincroniza celulares, o Worker precisa estar publicado

## Durante a apresentação

1. O público vê a orientação para virar o celular na horizontal e a tela de espera
2. Abra Ajustes e escolha uma das 20 imagens como force
3. Toque em Mostrar animais, todos veem as categorias iniciais
4. Peça uma categoria e que cada pessoa pense em um animal dessa categoria
5. Selecione a categoria no painel antes de misturar
6. Toque em Misturar animais
7. Peça qualquer quantidade positiva **par** de movimentos
8. Avance para a primeira eliminação
9. Em cada rodada seguinte, peça qualquer quantidade positiva **ímpar** de movimentos e avance
10. A última imagem é o force

Um movimento vai para uma casa imediatamente vizinha na horizontal ou vertical, sem diagonais e sem atravessar casas eliminadas, é permitido voltar e repetir casas

### Toques e retorno

- Um toque na grade avança após 330 ms
- Dois toques em até 330 ms voltam uma etapa, sem transmitir um avanço intermediário
- Os botões Voltar e Avançar executam o comando imediatamente
- Voltar restaura a disposição anterior, avançar novamente preserva a mesma mistura
- Para trocar a categoria após misturar, volte até a escolha inicial
- Para trocar o force, volte à espera
- Reiniciar pelo menu exige confirmação e devolve todos à espera
- A etapa só é considerada confirmada depois de salva pelo serviço

### Público

- A grade não responde a seleção, arraste ou comandos de toque
- Quem entra atrasado recebe o estado atual
- A reconexão recupera a última etapa confirmada
- Enquanto reconecta, a última grade fica visível e aparece um aviso discreto
- Se a página já estiver em espera, mudar o force não revela animais
- O navegador tenta manter a tela ativa quando essa API está disponível, alguns aparelhos exigem um toque para permitir isso

## Matemática

A grade tem 4 linhas e 5 colunas, o force ocupa sempre o índice 7, terceira casa da segunda linha

A mistura coloca todos os animais da categoria escolhida em casas de paridade ímpar, incluindo o force se ele pertencer à categoria, as outras imagens preenchem as posições restantes

Os movimentos pares preservam a paridade, os ímpares alternam a paridade, as máscaras de eliminação preservam todas as posições alcançáveis e convergem ao force

Quantidade de imagens por etapa: espera → 20 iniciais → 20 misturadas → 16 → 10 → 6 → 3 → 1

## Desenvolvimento e testes

```sh
npm ci
npm test
npm run dev
```

O desenvolvimento usa Wrangler local e armazenamento local, sem alterar nenhuma apresentação publicada

```sh
npm run deploy:relay
```

Esse comando publica na conta Cloudflare autenticada no ambiente, não coloque tokens no código ou nas páginas

### Teste local sem serviço

Abra `/magico.html?demo=1` e `/?demo=1` em abas do mesmo navegador

Esse modo usa BroadcastChannel, serve apenas para ensaiar na mesma máquina e não sincroniza outros celulares, o painel indica **Teste local**

### Validação incluída

- 80 combinações de categoria e force, com 40 misturas por combinação
- Verificação das posições alcançáveis para contagens pares
- Prova por repetição dos conjuntos alcançáveis para qualquer contagem ímpar
- Verificação de que não há posições isoladas durante os movimentos
- Validação de mensagens e restauração de etapas
- Testes de persistência, reconexão por reconstrução e envio simulado a 1.000 espectadores

Esses testes não substituem ensaio com os aparelhos e a rede do evento
