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

## O que tem

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
