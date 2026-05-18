# Calculadora de Oportunidades — Desafio Representações Comerciais

Aplicação web single-page para análise de oportunidades comerciais em três cenários: Cross-sell, Up-sell e Troca de marca.

## Como usar

1. Abra o arquivo `index.html` diretamente no navegador (não requer servidor).
2. Selecione o cenário desejado no topo (Cross-sell, Up-sell ou Troca de marca).
3. Preencha as 4 etapas do fluxo.
4. Na Etapa 4, clique em **Exportar relatório** para gerar um PDF com todos os dados.

## Substituição das logos

O header usa `assets/logo-white.png` (variação branca, para fundo escuro).  
O relatório exportado pode usar `assets/logo-dark.png` (variação escura, para fundos claros).

**Para substituir:**
1. Exporte a logo da Desafio nas duas variações (branca e escura).
2. Salve como `assets/logo-white.png` e `assets/logo-dark.png`.
3. Recomendação: altura entre 36–48 px, fundo transparente (PNG).

## Estrutura

```
desafio-site/
├── index.html          ← aplicação completa
├── assets/
│   ├── logo-white.png  ← logo variação branca (substituir)
│   └── logo-dark.png   ← logo variação escura (substituir)
└── README.md
```

## Requisitos

Nenhuma dependência externa. Funciona em qualquer navegador moderno sem conexão à internet.
