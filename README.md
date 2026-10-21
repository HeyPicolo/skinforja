# SkinForja — editor de skins do Minecraft

App web para criar e editar skins do Minecraft no navegador. Tudo roda no próprio navegador, sem servidor.

## Como rodar

```bash
npm install
npm run dev          # abre em http://localhost:5173
npm run build        # gera a versão para hospedar em dist/
npm run build:single # gera um único HTML em dist-single/ (é o que foi publicado como Artifact)
npm test             # testes da lógica (mapa UV, espelho, histórico, ferramentas, .mcpack)
npm run typecheck
```

Para publicar em qualquer hospedagem estática (Vercel, Netlify, GitHub Pages), use a pasta `dist/` gerada por `npm run build`.

## Modo infantil (padrão)

Feito para crianças pequenas que ainda não leem, usando iPad:

- Tudo por figuras grandes; cada botão **fala o próprio nome em inglês** e faz um som.
- Pinta tocando direto no boneco, que fica em cima de um bloco de grama. Pinta "o que se vê": se tem roupa por cima, pinta a roupa.
- Ferramentas: pincel (3 tamanhos), balde (tolerante às texturas), carimbos (coração, estrela, olhos, sorriso, flor, raio, bolinhas, quadrado), purpurina, borracha (volta à cor original do modelo) e pegar cor. Borboleta = espelho.
- Giz de cera com 18 cores + arco-íris com mais 72 cores. Embaixo, as 6 cores usadas por último.
- Tocar de novo na ferramenta escolhida tira a seleção; sem ferramenta, arrastar no boneco só gira.
- Botões para girar, aproximar, ver o mapa 2D e fazer o boneco dançar.
- Coração guarda a skin (com confete). A galeria abre por figuras: patinha, monstro, pessoa, coração (minhas skins) e folha em branco.
- **Área dos adultos**: segure o cadeado por 2 segundos. Lá ficam exportar (PNG/.mcpack), importar, gerenciar skins guardadas, som, voz, modelo do braço e o editor avançado.
- No iPad, use "Compartilhar › Adicionar à Tela de Início" para abrir em tela cheia como um app.

## Conta e sincronização

Na área dos adultos (ou em "Minhas skins" no editor avançado), entre com **nome + PIN** (4 a 8 números).
Se o nome ainda não existir, a conta é criada com aquele PIN e as skins do aparelho sobem para ela.
Em qualquer outro aparelho, entre com o mesmo nome e PIN: as skins guardadas, as importadas e o desenho em andamento
ficam iguais. A sincronização acontece sozinha depois de cada mudança, ao voltar para o app e a cada 45 segundos.

- Servidor: função `api/sync.ts` na Vercel, com os dados de cada conta num **Blob privado** (`users/<nome>.json`).
- O PIN é guardado com hash (scrypt). Depois de 5 PINs errados a conta fica bloqueada por 1 minuto.
- Se duas versões da mesma skin existirem, vale a mais nova; skins apagadas num aparelho somem nos outros.
- A página publicada dentro do Claude não sincroniza (só o site na Vercel tem o servidor).

## Editor avançado

- **Editor**: boneco 3D (girar, zoom, pintar direto no modelo) ao lado do mapa 2D da textura 64×64 com grade, zoom e contorno de cada face. Mostrar/ocultar partes do corpo e as camadas Base/Externa. Prévia parado ou andando.
- **Ferramentas**: lápis, pincel (1–8 px), borracha, balde (fica dentro da face), conta-gotas (ou Alt+clique), textura (variação de tom), clarear, escurecer, linha e retângulo (Shift = preenchido). Modo espelho. Desfazer/refazer ilimitados.
- **Cores**: seletor HSV, matiz, opacidade, HEX/RGB, cores recentes e paletas prontas.
- **Modelos**: 10 skins originais desenhadas por código (Animais, Mobs, Personagens) + "Base neutra" e "Em branco".
- **Importar/Exportar**: PNG 64×64 (com conversão automática de skins antigas 64×32 e detecção de braço slim), PNG para Java/Bedrock e pacote `.mcpack` para Bedrock.
- **Minhas skins**: salvar, abrir, renomear, duplicar e excluir no navegador; o trabalho em andamento é salvo automaticamente.
- Interface em português, tema claro/escuro, funciona com toque (tablet/celular), atalhos de teclado e tutorial na primeira visita.

## Atalhos

| Tecla | Ação |
|---|---|
| P B E G I N L D U R | Lápis, Pincel, Borracha, Balde, Conta-gotas, Textura, Clarear, Escurecer, Linha, Retângulo |
| Ctrl+Z / Ctrl+Y | Desfazer / Refazer |
| M | Espelho |
| T | Pintar no 3D |
| X | Alternar camada Base/Externa |
| [ ] | Tamanho do pincel |
| Ctrl+S / Ctrl+E | Salvar / Exportar |

## Usar a skin no jogo

- **Java**: no Launcher, Skins › Nova skin › escolha o PNG (Clássico ou Slim).
- **Bedrock**: Vestiário › importar o PNG, ou abra o arquivo `.mcpack` para instalar como pacote de skins.

## Estrutura

```
src/
  skin/
    layout.ts     mapa UV de cada parte e face, mapa de espelhamento
    document.ts   pixels da skin + histórico de desfazer/refazer por diferenças
    tools.ts      lápis, pincel, balde, linha, retângulo, textura, clarear/escurecer
    paint.ts      controlador de pintura usado pelo 2D e pelo 3D
    model3d.ts    personagem 3D (Three.js), poses e conversão do clique para pixel
    preview.ts    pixels afetados sob o cursor (prévia)
    templates.ts  os 10 modelos desenhados por código
    io.ts         importar PNG, converter 64×32, exportar PNG e .mcpack
    thumbs.ts     miniaturas 3D da galeria
  components/     Viewer3D, Editor2D, Toolbar, ColorPicker, LayersPanel, Gallery, ExportDialog, ProjectsDialog, HelpDialogs
  store.ts        estado da interface (Zustand)
  projects.ts     salvamento automático e "Minhas skins"
scripts/          testes e conversão para Artifact
```
