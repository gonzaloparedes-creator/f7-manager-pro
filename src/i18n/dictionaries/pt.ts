import type { LandingDict } from "./es";

export const pt: LandingDict = {
  common: {
    daysUnit: "dias",
    login: "Entrar",
    viewPlans: "Ver planos",
    startNow: "Começar agora",
    howItWorks: "Ver como funciona",
    footerBrand: "F7 Manager Pro · Feito no Paraguai",
    languageLabel: "Idioma",
    ctaGuarantee: "Comece com garantia de {days}",
    guarantee: "Se em {days} não servir para você, devolvemos todo o seu dinheiro.",
    statusRepair: "Em reparo",
    statusReady: "Pronto",
    statusDelivered: "Entregue",
    warrantyActive: "Garantia ativa: 23 dias restantes",
    warrantyExpired: "Garantia expirada",
  },

  pricing: {
    titleWorkshop: "Preços honestos para [[assistências técnicas de verdade]].",
    titleShop: "Preços honestos para [[o seu balcão]].",
    subtitleWorkshop: "Escolha sua moeda e seu ciclo. Mude quando quiser.",
    subtitleShop: "Sem ordens de serviço, sem QR, sem assinaturas — só balcão e caixa.",
    segmentWorkshop: "Tenho uma assistência técnica",
    segmentShop: "Só tenho uma loja",
    currencyGs: "Guaranis (Gs.)",
    currencyUsd: "USD ($)",
    usdPrefix: "US$ ",
    cycleMonthly: "Mensal",
    cycleSemiannual: "Semestral · Economize 10%",
    cycleAnnual: "Anual · 2 meses grátis",
    perMonth: "/ mês",
    perSemester: "/ semestre",
    perYear: "/ ano",
    equivalent: "Equivale a {amount} / mês",
    choose: "Escolher este plano",
    guaranteeNote: "Todos os planos incluem a garantia de {days}: se não servir para você, devolvemos todo o seu dinheiro.",
    badges: { pro: "Mais Popular", business: "Tudo em Um", retail: "Só Vendas" },
    plans: {
      starter: {
        subtitle: "Ideal para dar o primeiro passo e profissionalizar o seu balcão.",
        features: [
          "1 usuário (dono / admin)",
          "1 filial",
          "Ordens ilimitadas",
          "Base de clientes ilimitada",
          "Rastreamento por QR público",
          "5 fotos por ordem",
        ],
        message: "Olá! Venho pelo site e tenho interesse no Plano Starter do F7 Manager Pro para a minha assistência técnica.",
      },
      pro: {
        subtitle: "Para assistências que querem crescer e controlar seus lucros reais.",
        features: [
          "Tudo do plano Starter, mais:",
          "Até 5 usuários com permissões",
          "Filiais ilimitadas",
          "Controle de Estoque",
          "Relatórios financeiros (Receita Líquida)",
          "20 fotos por ordem",
        ],
        message: "Olá! Venho pelo site e quero ativar o Plano Pro do F7 Manager Pro para a minha assistência técnica.",
      },
      business: {
        subtitle: "Para negócios híbridos que consertam e também vendem no balcão.",
        features: [
          "Tudo do plano Pro, mais:",
          "Módulo Ponto de Venda (PDV / Caixa rápido)",
          "Estoque Externo (catálogo para venda ao público)",
          "Cobrança unificada: reparo + venda em um único ticket",
          "Recibos automáticos por WhatsApp",
          "Usuários ilimitados",
        ],
        message: "Olá! Venho pelo site e tenho interesse no Plano Business (reparo + venda) do F7 Manager Pro.",
      },
      retail: {
        subtitle: "Ideal para lojas de acessórios, capinhas e venda de celulares.",
        features: [
          "Módulo Ponto de Venda (PDV / Caixa rápido)",
          "Estoque Externo (vendas)",
          "Cadastro de produtos com código de barras",
          "Controle de Caixa e Relatórios de Vendas",
          "Recibos automáticos por WhatsApp",
          "1 usuário / 1 filial",
        ],
        message: "Olá! Venho pelo site e tenho interesse no Plano Retail (só loja) do F7 Manager Pro.",
      },
    },
  },

  home: {
    meta: {
      title: "F7 Manager Pro",
      description:
        "Gerencie ordens de serviço, envie notificações por WhatsApp e deixe seus clientes acompanharem o andamento em tempo real. Profissionalize sua assistência técnica.",
    },
    whatsapp: "Olá! Venho pelo site do F7 Manager Pro e tenho interesse em começar a usá-lo na minha assistência técnica.",
    hero: {
      badge: "Feito no Paraguai 🇵🇾",
      title: "Cansado do caos de [[cadernos e WhatsApp]]?",
      text: "Sabemos a dor de perder uma ordem, discutir com um cliente por causa de uma garantia ou não saber quantas telas ainda restam no estoque. **O F7 Manager Pro nasceu em um balcão de assistência, não em um escritório.**",
    },
    chaos: {
      before: "Antes",
      beforeLines: [
        '📓 Caderno página 47 — "iPhone 8 do Juan, não lê"',
        '💬 WhatsApp: "ei, quanto era o do moto g?"',
        '🧾 Papelzinho: "garantia 30 dias?? ou 60??"',
        '😵 "Onde anotei o do Samsung?"',
      ],
      after: "Com o F7",
    },
    pain: {
      pill: "O custo real",
      title: "Se você não controla sua assistência, [[está perdendo Gs.]] todo dia.",
      text: 'Clique em cada cartão e descubra quanto está custando continuar "como sempre".',
      more: "+ Ver mais",
      less: "− Ocultar",
      cards: {
        leaks: {
          title: "Vazamento de Dinheiro",
          teaser: "Tem certeza de que lucrou naquela tela genérica?",
          detail:
            "Esquecer os custos ocultos está te matando. Sem um controle real do custo das peças em Gs., cada reparo pode ser um prejuízo silencioso.",
        },
        chaos: {
          title: "Caos Operacional",
          teaser: "WhatsApp não é uma ferramenta de gestão.",
          detail:
            "Se um técnico sai, leva consigo a informação operacional. Ordens perdidas, clientes irritados e o estado real da assistência: invisível.",
        },
        warranty: {
          title: "Problemas de Garantia",
          teaser: "O cliente diz que foi ontem, mas foi há 40 dias.",
          detail:
            "Como provar sem fotos, assinaturas nem datas exatas? Uma única discussão por garantia custa mais do que um mês de F7 Manager Pro.",
        },
      },
    },
    solution: {
      pill: "A solução",
      title: "F7 Manager Pro: [[o controle total]] da sua assistência, no Paraguai e em Gs.",
      text: "Ordens ilimitadas, controle financeiro preciso e uma imagem profissional que seus clientes vão respeitar.",
      kpiActive: "Ordens ativas",
      kpiReady: "Prontas para retirar",
      kpiIncome: "Receita do mês",
      kpiWarranties: "Garantias ativas",
      recentTitle: "Ordens recentes",
      today: "Hoje",
      recent: ["iPhone 13 — tela", "Redmi Note 10 — flex", "Galaxy S21 — bateria"],
    },
    features: {
      title: "O que [[realmente impressiona]].",
      text: "4 funções pensadas para assistências de verdade, não para apresentações bonitas.",
      alerts: {
        title: "Avisos Inteligentes",
        desc: "Se o cliente deixa o celular na assistência, o F7 sabe para qual número alternativo enviar o WhatsApp. Automação pura.",
        primary: "+595 981 111 111 (principal — na assistência)",
        alternative: "✓ +595 982 222 222 (alternativo — esposa)",
      },
      warranty: {
        title: "Garantia Segura",
        desc: "O relógio da garantia começa quando o cliente retira o aparelho. Esqueça os mal-entendidos.",
      },
      photos: {
        title: "Evidência Fotográfica",
        desc: "Foto de como entrou, foto de como sai. Compressão automática para carregar rápido até com dados móveis.",
      },
      profit: {
        title: "Rentabilidade Real em Gs.",
        desc: "Veja sua receita LÍQUIDA real, descontando o custo das peças de Hohenau ou Obligado.",
        gross: "Bruto",
        costs: "Custos",
        net: "LÍQUIDO",
      },
    },
    growth: {
      pill: "Plano PRO",
      title: "Feito para [[crescer]].",
      text: "Você começa sozinho, com uma filial. Amanhã adiciona seu sócio e seu técnico, e abre mais uma loja. O F7 cresce com você sem trocar de sistema.",
      bullets: [
        "Filiais ilimitadas",
        "Até 5 usuários com permissões",
        "Relatórios financeiros consolidados",
        "20 fotos por ordem",
      ],
      branches: "Filiais",
      branchMain: "Matriz",
      branchEast: "Filial Leste",
      branchSouth: "Filial Sul",
      active: "Ativa",
      users: "3 / 5 usuários — adicione técnicos quando quiser",
    },
    cta: {
      title: "Deixe de viver preso ao seu [[balcão]].",
      text: "Comece com a **garantia de {days}**: se não servir para você, devolvemos todo o seu dinheiro. O preço do Starter é menor que o de **dois reparos genéricos por mês**. Junte-se à liga profissional das assistências técnicas.",
      trust: "⚡ Ativação imediata · 🇵🇾 Sistema e suporte em espanhol · 💾 Seus dados sempre seus",
    },
  },

  oferta: {
    meta: {
      title: "F7 Manager Pro · Sistema para assistências técnicas · Garantia de {days}",
      description:
        "Organize suas ordens de serviço, avise o cliente pelo WhatsApp e veja quanto você ganha em cada reparo. Feito no Paraguai. Se em {days} não servir para você, devolvemos todo o seu dinheiro.",
    },
    whatsapp: {
      message: "Olá! Vi o anúncio do F7 Manager Pro e quero começar com a garantia de {days} na minha assistência técnica.",
      adTag: " (Vi o seu anúncio)",
    },
    urgency: {
      bar: "Não sabemos quando o preço vai subir",
      barCta: "Entre o quanto antes e aproveite o preço de hoje",
      short: "Não sabemos quando vai subir: entre o quanto antes.",
    },
    freeze: {
      title: "Preço congelado para quem entra agora",
      body: "Você mantém o preço de hoje do seu plano enquanto continuar assinante.",
      line: "Preço congelado para quem entra agora.",
    },
    hero: {
      badge: "Feito no Paraguai 🇵🇾 · Para assistências técnicas",
      title: "Largue o caderno. [[Saiba quanto você ganha]] em cada reparo.",
      text: "O F7 Manager Pro organiza suas ordens de serviço, avisa seu cliente pelo WhatsApp e mostra o lucro real de cada aparelho, em guaranis.",
      smallPrint: "Sem instalar nada · Suporte pelo WhatsApp e sistema em espanhol",
      born: "Nasceu em um balcão de assistência, não em um escritório.",
    },
    summary: {
      title: "Resumo de hoje",
      example: "Dados de exemplo",
      collected: "Recebido hoje",
      net: "Receita líquida",
    },
    marquee: {
      label: "Benefícios",
      items: [
        "Fotos de entrada e saída",
        "Aviso por WhatsApp ao cliente",
        "Garantia com relógio",
        "Lucro real por ordem",
        "Acompanhamento por QR",
        "Caixa e despesas",
      ],
    },
    problem: {
      kicker: "O verdadeiro problema",
      title: "Não falta saber consertar. [[Falta ter tudo em um só lugar.]]",
      lead: "Você conserta bem. Esse nunca foi o problema.",
      text: "O problema é o aparelho que você jurava que entrou sem aquela batida. A peça que você comprou e nunca anotou. O cliente que te escreve às dez da noite: “já ficou pronto?”. E terminar o mês cansado, com a bancada cheia, sem saber se sobrou dinheiro.",
      cards: {
        notebook: {
          title: "O caderno que te trai",
          text: "Molha, se perde e leva o histórico embora. Uma ordem perdida é dinheiro perdido ou uma reclamação.",
          lines: ['Página 47 — "iPhone 8 do Juan, não lê"', "Moto G, troca de conector, 180?", "Onde anotei o do Samsung?"],
        },
        whatsapp: {
          title: "O WhatsApp que não para",
          text: "Você passa o dia respondendo “meu celular já ficou pronto?” em vez de consertar. Cada mensagem interrompe o seu trabalho.",
          lines: ["Meu celular já ficou pronto? 🙏", "Ainda não, eu aviso", "E agora?"],
        },
        money: {
          title: "O dinheiro que você não vê",
          text: "Você cobrou bem, mas quanto sobrou depois da peça? Sem esse número, você pode estar trabalhando de graça.",
          collected: "Recebido",
          part: "Peça",
          left: "Sobrou?",
        },
      },
    },
    solution: {
      kicker: "A solução",
      title: "Cada função do F7 resolve [[uma dor]] do seu balcão.",
      footnote: "Os números e nomes das maquetes são exemplos.",
      allPlans: "Todos os planos",
      proBusiness: "Pro e Business",
      businessOnly: "Business",
      blocks: {
        photos: {
          pill: "Evidência fotográfica",
          title: "O fim do “eu não deixei assim”",
          text: "Foto de como entrou e foto de como sai, com data. Se houver discussão, você tem a prova na mão.",
          came: "Entrou",
          left: "Saiu",
          note: "Tela quebrada · Câmera ok · Sem batidas na moldura",
        },
        whatsapp: {
          pill: "Avisos por WhatsApp",
          title: "O fim do “já ficou pronto o meu aparelho?”",
          text: "O F7 avisa o cliente pelo WhatsApp quando o aparelho muda de status, e com o QR ele acompanha o andamento sem te escrever.",
          message: "Olá Juan 👋 Seu **iPhone 8** já está [[pronto para retirar]].",
          tracking: "Acompanhamento por QR",
        },
        profit: {
          pill: "Lucro real",
          title: "O fim do “será que ganhei nesse reparo?”",
          text: "Você vê quanto cobrou, quanto custou a peça e quanto sobrou. Por ordem e por mês, em guaranis.",
          collected: "Recebido",
          part: "Peça",
          left: "Sobrou",
        },
        warranty: {
          pill: "Garantia segura",
          title: "O fim das discussões por garantia",
          text: "O relógio da garantia começa quando o cliente retira o aparelho. Sem “foi ontem” nem “foi há 40 dias”.",
        },
        cash: {
          pill: "Caixa e despesas",
          title: "O fim do “quanto deveria ter no caixa?”",
          text: "Você abre o caixa, lança o que entra e o que gasta, e ao fechar o F7 diz quanto dinheiro em espécie deveria ter.",
          opening: "Abertura",
          cashIn: "+ Recebimentos em dinheiro",
          expenses: "- Despesas",
          expected: "Dinheiro esperado",
        },
        bundle: {
          pill: "Reparo + venda",
          title: "O fim de usar dois sistemas",
          text: "Se você também vende acessórios ou celulares, cobra o reparo e a venda em um único ticket, com estoque e vitrine online.",
          repair: "Troca de tela",
          sale: "Capinha + película de vidro",
          total: "Uma única cobrança",
        },
      },
    },
    split: {
      kicker: "Sem complicação",
      title: "Você conserta. [[O F7 cuida do resto.]]",
      yourPart: "Sua parte",
      yourItems: [
        "Cadastra a ordem: cliente, aparelho e defeito",
        "Tira as fotos com o mesmo celular",
        "Conserta e cobra",
      ],
      f7Part: "A parte do F7",
      f7Items: [
        "Guarda as fotos, as datas e a garantia",
        "Avisa o cliente pelo WhatsApp",
        "Calcula quanto sobrou de cada reparo",
        "Organiza seus clientes e seu caixa",
      ],
      note: "Seus clientes são criados sozinhos a cada ordem: você não precisa cadastrar nenhuma lista antes de começar.",
      tagline: "Menos bagunça. Menos mensagens. [[Mais lucro.]]",
      chips: ["Tudo em um só lugar", "Direto do celular", "Em guaranis"],
    },
    devices: {
      phone: {
        title: "No seu celular",
        text: "Cadastre ordens e tire as fotos do mesmo telefone com o qual você atende.",
      },
      computer: {
        title: "No computador",
        text: "Relatórios, caixa e clientes em tela grande, quando você precisar.",
      },
      cloud: {
        title: "Sem instalar nada",
        text: "Tudo fica na nuvem e cada negócio vê somente os seus próprios dados.",
      },
    },
    guarantee: {
      kicker: "Garantia de {days}",
      title: "Se em {days} não servir para você, [[devolvemos todo o seu dinheiro]].",
      text: "O risco é nosso, não seu. Você usa com ordens reais da sua assistência e decide com dados, não com promessas.",
      steps: {
        write: {
          title: "Você nos escreve pelo WhatsApp",
          text: "Escolhe seu plano e combinamos o pagamento. Entregamos o seu recibo.",
        },
        use: {
          title: "Você usa por {days} na sua assistência",
          text: "Com ordens reais: fotos, avisos aos seus clientes e o lucro de cada reparo.",
        },
        refund: {
          title: "Se não servir, devolvemos tudo",
          text: "Você avisa pelo WhatsApp dentro dos {days} e devolvemos o que você pagou.",
        },
      },
      extrasTitle: "E ainda",
      extras: [
        { title: "Suporte pelo WhatsApp, em espanhol", text: "Uma pessoa de verdade responde." },
        { title: "Tutorial passo a passo", text: "Dentro do sistema, para cada módulo." },
        { title: "Preços em guaranis", text: "Você também pode escolher dólares." },
      ],
    },
    faq: {
      kicker: "Perguntas frequentes",
      title: "Antes de começar",
      items: [
        {
          q: "Como funciona a garantia de {days}?",
          a: "Você escolhe seu plano, combinamos o pagamento pelo WhatsApp e usa por {days} na sua assistência com ordens reais. Se não servir, você avisa pelo WhatsApp dentro desse prazo e devolvemos tudo o que você pagou.",
        },
        {
          q: "O que significa “preço congelado”?",
          a: "Quem entra agora mantém o preço de hoje do seu plano enquanto continuar assinante. Não sabemos quando os preços vão mudar: por isso vale entrar o quanto antes.",
        },
        {
          q: "Preciso instalar alguma coisa?",
          a: "Não. O F7 funciona no navegador do celular, do tablet ou do computador. Não há nada para baixar.",
        },
        {
          q: "Outros negócios podem ver os meus dados?",
          a: "Não. Cada negócio vê somente as suas próprias ordens, clientes e números. Ninguém de outra empresa pode acessar o que é seu.",
        },
        {
          q: "Quanto custa?",
          a: "A partir de {starterPrice} Gs. por mês (plano Starter). Pro e Business incluem relatórios, estoque, caixa e venda no balcão. Pagando por semestre você economiza 10 % e o plano anual dá 2 meses de presente. Você pode escolher guaranis ou dólares.",
        },
        {
          q: "Como se paga?",
          a: "Combinamos o pagamento com você pelo WhatsApp e entregamos o seu recibo. Se dentro da garantia você decidir que não é para você, o reembolso é combinado pelo mesmo canal.",
        },
        {
          q: "Tenho mais de uma loja ou funcionários, serve para mim?",
          a: "Sim. O plano Pro inclui filiais ilimitadas e até 5 usuários com permissões; o Business, usuários ilimitados.",
        },
        {
          q: "Só vendo acessórios, não conserto. Existe plano para mim?",
          a: "Sim, o plano Retail é para lojas de venda: ponto de venda, estoque, código de barras e controle de caixa.",
        },
        {
          q: "E se eu travar ou não souber usar?",
          a: "O sistema traz um tutorial passo a passo e ajudamos você pelo WhatsApp, em espanhol.",
        },
        {
          q: "Posso mudar de plano mais tarde?",
          a: "Sim. Você começa com o que precisa hoje e sobe quando a sua assistência crescer.",
        },
      ],
      extra: [
        {
          q: "Em que idioma está o sistema?",
          a: "Por enquanto o sistema (telas e tutorial dentro do app) e o suporte pelo WhatsApp são em espanhol. A garantia de {days} permite conferir se isso funciona para a sua assistência.",
        },
      ],
    },
    final: {
      title: "Seu próximo reparo, [[já organizado]].",
      text: "Use por **{days}** na sua assistência. Se não servir, **devolvemos todo o seu dinheiro**.",
      smallPrint: "🇵🇾 Feito no Paraguai · Suporte pelo WhatsApp em espanhol",
    },
    footer: { support: "Suporte pelo WhatsApp" },
  },
};
