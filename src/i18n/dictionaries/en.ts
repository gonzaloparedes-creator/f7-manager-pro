import type { LandingDict } from "./es";

export const en: LandingDict = {
  common: {
    daysUnit: "days",
    login: "Log in",
    viewPlans: "View plans",
    startNow: "Start now",
    howItWorks: "See how it works",
    footerBrand: "F7 Manager Pro · Made in Paraguay",
    languageLabel: "Language",
    ctaGuarantee: "Start with the {dayCount}-day guarantee",
    guarantee: "If it doesn't work for you in {days}, we refund all your money.",
    statusRepair: "In repair",
    statusReady: "Ready",
    statusDelivered: "Delivered",
    warrantyActive: "Warranty active: 23 days left",
    warrantyExpired: "Warranty expired",
  },

  pricing: {
    titleWorkshop: "Honest pricing for [[real repair shops]].",
    titleShop: "Honest pricing for [[your store]].",
    subtitleWorkshop: "Choose your currency and billing cycle. Change it anytime.",
    subtitleShop: "No repair orders, no QR codes, no signatures — just counter and cash register.",
    segmentWorkshop: "I have a repair shop",
    segmentShop: "I only have a store",
    currencyGs: "Guaraníes (Gs.)",
    currencyUsd: "USD ($)",
    usdPrefix: "$",
    cycleMonthly: "Monthly",
    cycleSemiannual: "6 months · Save 10%",
    cycleAnnual: "Yearly · 2 months free",
    perMonth: "/ month",
    perSemester: "/ 6 months",
    perYear: "/ year",
    equivalent: "Equivalent to {amount} / month",
    choose: "Choose this plan",
    guaranteeNote: "All plans include the {dayCount}-day guarantee: if it doesn't work for you, we refund all your money.",
    badges: { pro: "Most Popular", business: "All-in-One", retail: "Sales Only" },
    plans: {
      starter: {
        subtitle: "Ideal for taking the first step and making your counter professional.",
        features: [
          "1 user (owner / admin)",
          "1 branch",
          "Unlimited orders",
          "Unlimited customer database",
          "Public QR tracking",
          "5 photos per order",
        ],
        message: "Hi! I'm coming from your website and I'm interested in the F7 Manager Pro Starter plan for my repair shop.",
      },
      pro: {
        subtitle: "For shops that want to scale and track their real profits.",
        features: [
          "Everything in the Starter plan, plus:",
          "Up to 5 users with roles",
          "Unlimited branches",
          "Inventory control",
          "Financial reports (Net Income)",
          "20 photos per order",
        ],
        message: "Hi! I'm coming from your website and I'd like to activate the F7 Manager Pro Pro plan for my repair shop.",
      },
      business: {
        subtitle: "For hybrid businesses that repair and also sell over the counter.",
        features: [
          "Everything in the Pro plan, plus:",
          "Point of Sale module (POS / quick checkout)",
          "External Inventory (catalog for public sales)",
          "Unified payment: repair + sale on a single ticket",
          "Automated receipts via WhatsApp",
          "Unlimited users",
        ],
        message: "Hi! I'm coming from your website and I'm interested in the F7 Manager Pro Business plan (repair + sales).",
      },
      retail: {
        subtitle: "Ideal for accessory shops, cases and phone sales.",
        features: [
          "Point of Sale module (POS / quick checkout)",
          "External Inventory (sales)",
          "Product entry with barcodes",
          "Cash Control and Sales Reports",
          "Automated receipts via WhatsApp",
          "1 user / 1 branch",
        ],
        message: "Hi! I'm coming from your website and I'm interested in the F7 Manager Pro Retail plan (store only).",
      },
    },
  },

  home: {
    meta: {
      title: "F7 Manager Pro",
      description:
        "Manage repair orders, send WhatsApp notifications and let your customers track progress in real time. Make your repair shop professional.",
    },
    whatsapp: "Hi! I'm coming from the F7 Manager Pro website and I'd like to start using it in my repair shop.",
    hero: {
      badge: "Made in Paraguay 🇵🇾",
      title: "Tired of the chaos of [[notebooks and WhatsApp]]?",
      text: "We know the pain of losing an order, arguing with a customer over a warranty, or not knowing how many screens you have left in stock. **F7 Manager Pro was born at a repair counter, not in an office.**",
    },
    chaos: {
      before: "Before",
      beforeLines: [
        `📓 Notebook page 47 — "Juan's iPhone 8, won't read"`,
        '💬 WhatsApp: "hey how much was the moto g one?"',
        '🧾 Scrap of paper: "warranty 30 days?? or 60??"',
        '😵 "Where did I write down the Samsung one?"',
      ],
      after: "With F7",
    },
    pain: {
      pill: "The real cost",
      title: "If you don't control your shop, [[you're losing Gs.]] every day.",
      text: 'Click each card and find out how much sticking to "business as usual" is costing you.',
      more: "+ See more",
      less: "− Hide",
      cards: {
        leaks: {
          title: "Money Leaks",
          teaser: "Are you sure you made a profit on that generic screen?",
          detail:
            "Ignoring hidden costs is killing you. Without real control of parts costs in Gs., every repair can be a silent loss.",
        },
        chaos: {
          title: "Operational Chaos",
          teaser: "WhatsApp is not a management tool.",
          detail:
            "If a technician leaves, they take the operational information with them. Lost orders, annoyed customers and the real state of the shop: invisible.",
        },
        warranty: {
          title: "Warranty Problems",
          teaser: "The customer says it was yesterday, but it was 40 days ago.",
          detail:
            "How do you prove it without photos, signatures or exact dates? A single warranty dispute costs you more than a month of F7 Manager Pro.",
        },
      },
    },
    solution: {
      pill: "The solution",
      title: "F7 Manager Pro: [[total control]] of your shop, in Paraguay and in Gs.",
      text: "Unlimited orders, precise financial control and a professional image your customers will respect.",
      kpiActive: "Active orders",
      kpiReady: "Ready for pickup",
      kpiIncome: "Income this month",
      kpiWarranties: "Active warranties",
      recentTitle: "Recent orders",
      today: "Today",
      recent: ["iPhone 13 — screen", "Redmi Note 10 — flex cable", "Galaxy S21 — battery"],
    },
    features: {
      title: "What [[really impresses]].",
      text: "4 features designed for real repair shops, not for pretty presentations.",
      alerts: {
        title: "Smart Notifications",
        desc: "If the customer leaves their phone at the shop, F7 knows which alternate number to send the WhatsApp to. Pure automation.",
        primary: "+595 981 111 111 (main — at the shop)",
        alternative: "✓ +595 982 222 222 (alternate — wife)",
      },
      warranty: {
        title: "Secure Warranty",
        desc: "The warranty clock starts when the customer picks up the device. Forget the misunderstandings.",
      },
      photos: {
        title: "Photo Evidence",
        desc: "A photo of how it came in, a photo of how it leaves. Automatic compression so it loads fast even on mobile data.",
      },
      profit: {
        title: "Real Profit in Gs.",
        desc: "See your real NET income, subtracting the cost of parts from Hohenau or Obligado.",
        gross: "Gross",
        costs: "Costs",
        net: "NET",
      },
    },
    growth: {
      pill: "PRO plan",
      title: "Built to [[grow]].",
      text: "You start alone with one branch. Tomorrow you add your partner and your technician, and open another location. F7 scales with you without changing systems.",
      bullets: [
        "Unlimited branches",
        "Up to 5 users with roles",
        "Consolidated financial reports",
        "20 photos per order",
      ],
      branches: "Branches",
      branchMain: "Headquarters",
      branchEast: "East Branch",
      branchSouth: "South Branch",
      active: "Active",
      users: "3 / 5 users — add technicians whenever you want",
    },
    cta: {
      title: "Stop being tied to your [[counter]].",
      text: "Start with the **{dayCount}-day guarantee**: if it doesn't work for you, we refund all your money. The Starter price is less than **two generic repairs a month**. Join the professional league of repair shops.",
      trust: "⚡ Instant activation · 🇵🇾 System and support in Spanish · 💾 Your data is always yours",
    },
  },

  oferta: {
    meta: {
      title: "F7 Manager Pro · Software for repair shops · {dayCount}-day guarantee",
      description:
        "Organize your work orders, notify your customers on WhatsApp and see how much you earn on every repair. Made in Paraguay. If it doesn't work for you in {days}, we refund all your money.",
    },
    whatsapp: {
      message: "Hi! I saw the F7 Manager Pro ad and I want to start with the {dayCount}-day guarantee in my repair shop.",
      adTag: " (Saw your ad)",
    },
    urgency: {
      bar: "We don't know when the price will go up",
      barCta: "Join as soon as possible and take advantage of today's price",
      short: "We don't know when it will go up: join as soon as possible.",
    },
    freeze: {
      title: "Price locked for those who join now",
      body: "You keep today's price for your plan as long as you stay subscribed.",
      line: "Price locked for those who join now.",
    },
    hero: {
      badge: "Made in Paraguay 🇵🇾 · For repair shops",
      title: "Ditch the notebook. [[Know how much you earn]] on every repair.",
      text: "F7 Manager Pro organizes your work orders, notifies your customer on WhatsApp and shows you the real profit on every device, in guaraníes.",
      smallPrint: "Nothing to install · WhatsApp support and system in Spanish",
      born: "Born at a repair counter, not in an office.",
    },
    summary: {
      title: "Today's summary",
      example: "Sample data",
      collected: "Collected today",
      net: "Net income",
    },
    marquee: {
      label: "Benefits",
      items: [
        "Check-in and check-out photos",
        "WhatsApp notification to the customer",
        "Warranty with a clock",
        "Real profit per order",
        "QR tracking",
        "Cash register and expenses",
      ],
    },
    problem: {
      kicker: "The real problem",
      title: "You don't lack repair skills. [[You lack having everything in one place.]]",
      lead: "You repair well. That was never the problem.",
      text: "The problem is the device you swore came in without that dent. The part you bought and never wrote down. The customer who messages you at ten at night: “is it ready yet?”. And ending the month exhausted, with a full workbench, not knowing if any money is left.",
      cards: {
        notebook: {
          title: "The notebook that betrays you",
          text: "It gets wet, it gets lost and it takes the history with it. A lost order is lost money or a complaint.",
          lines: [`Page 47 — "Juan's iPhone 8, won't read"`, "Moto G, charging pin swap, 180?", "Where did I write down the Samsung one?"],
        },
        whatsapp: {
          title: "The WhatsApp that never stops",
          text: "You spend the day answering “is my phone ready?” instead of repairing. Every message interrupts your work.",
          lines: ["Is my phone ready yet? 🙏", "Not yet, I'll let you know", "And now?"],
        },
        money: {
          title: "The money you can't see",
          text: "You charged well, but how much was left after the part? Without that number, you could be working for free.",
          collected: "Collected",
          part: "Part",
          left: "Left over?",
        },
      },
    },
    solution: {
      kicker: "The solution",
      title: "Every F7 feature solves [[one pain]] at your counter.",
      footnote: "Numbers and names in the mockups are examples.",
      allPlans: "All plans",
      proBusiness: "Pro and Business",
      businessOnly: "Business",
      blocks: {
        photos: {
          pill: "Photo evidence",
          title: "The end of “I didn't leave it like that”",
          text: "A photo of how it came in and a photo of how it leaves, with the date. If there's a dispute, you have the proof in hand.",
          came: "In",
          left: "Out",
          note: "Cracked screen · Camera ok · No dents on the frame",
        },
        whatsapp: {
          pill: "WhatsApp notifications",
          title: "The end of “is my device ready yet?”",
          text: "F7 notifies your customer on WhatsApp when their device changes status, and with the QR they can see the progress without messaging you.",
          message: "Hi Juan 👋 Your **iPhone 8** is [[ready for pickup]].",
          tracking: "QR tracking",
        },
        profit: {
          pill: "Real profit",
          title: "The end of “did I even make money on this repair?”",
          text: "You see how much you charged, how much the part cost and how much was left. Per order and per month, in guaraníes.",
          collected: "Collected",
          part: "Part",
          left: "You kept",
        },
        warranty: {
          pill: "Secure warranty",
          title: "The end of warranty arguments",
          text: "The warranty clock starts when the customer picks up the device. No “it was yesterday” or “it was 40 days ago”.",
        },
        cash: {
          pill: "Cash register and expenses",
          title: "The end of “how much should be in the register?”",
          text: "You open the register, log what comes in and what you spend, and when you close, F7 tells you how much cash there should be.",
          opening: "Opening",
          cashIn: "+ Cash payments",
          expenses: "- Expenses",
          expected: "Expected cash",
        },
        bundle: {
          pill: "Repair + sales",
          title: "The end of running two systems",
          text: "If you also sell accessories or phones, you charge the repair and the sale on a single ticket, with inventory and an online storefront.",
          repair: "Screen replacement",
          sale: "Case + tempered glass",
          total: "One single payment",
        },
      },
    },
    split: {
      kicker: "No hassle",
      title: "You repair. [[F7 takes care of the rest.]]",
      yourPart: "Your part",
      yourItems: [
        "Enter the order: customer, device and fault",
        "Take the photos with the same phone",
        "Repair and get paid",
      ],
      f7Part: "F7's part",
      f7Items: [
        "Stores the photos, dates and warranty",
        "Notifies the customer on WhatsApp",
        "Calculates what you kept on each repair",
        "Organizes your customers and your cash register",
      ],
      note: "Your customers are created automatically with each order: you don't have to load any list before starting.",
      tagline: "Less mess. Fewer messages. [[More profit.]]",
      chips: ["Everything in one place", "From your phone", "In guaraníes"],
    },
    devices: {
      phone: {
        title: "On your phone",
        text: "Enter orders and take the photos from the same phone you use to serve customers.",
      },
      computer: {
        title: "On your computer",
        text: "Reports, cash register and customers on a big screen, when you need them.",
      },
      cloud: {
        title: "Nothing to install",
        text: "Everything lives in the cloud and each business sees only its own data.",
      },
    },
    guarantee: {
      kicker: "{dayCount}-day guarantee",
      title: "If it doesn't work for you in {days}, [[we refund all your money]].",
      text: "The risk is ours, not yours. You use it with real orders from your shop and decide with data, not promises.",
      steps: {
        write: {
          title: "You message us on WhatsApp",
          text: "You choose your plan and we arrange the payment. We give you your receipt.",
        },
        use: {
          title: "You use it for {days} in your shop",
          text: "With real orders: photos, notifications to your customers and the profit on each repair.",
        },
        refund: {
          title: "If it doesn't work for you, we refund everything",
          text: "You let us know on WhatsApp within the {days} and we reimburse what you paid.",
        },
      },
      extrasTitle: "And also",
      extras: [
        { title: "WhatsApp support, in Spanish", text: "A real person answers you." },
        { title: "Step-by-step tutorial", text: "Inside the system, for every module." },
        { title: "Prices in guaraníes", text: "You can also choose dollars." },
      ],
    },
    faq: {
      kicker: "Frequently asked questions",
      title: "Before you start",
      items: [
        {
          q: "How does the {dayCount}-day guarantee work?",
          a: "You choose your plan, we arrange the payment on WhatsApp and you use it for {days} in your shop with real orders. If it doesn't work for you, you let us know on WhatsApp within that period and we refund everything you paid.",
        },
        {
          q: "What does “price locked” mean?",
          a: "Those who join now keep today's price for their plan as long as they stay subscribed. We don't know when prices will change: that's why it's best to join as soon as possible.",
        },
        {
          q: "Do I have to install anything?",
          a: "No. F7 works from the browser on your phone, tablet or computer. There's nothing to download.",
        },
        {
          q: "Can other businesses see my data?",
          a: "No. Each business sees only its own orders, customers and numbers. Nobody from another company can access yours.",
        },
        {
          q: "How much does it cost?",
          a: "From {starterPrice} Gs. per month (Starter plan). Pro and Business add reports, inventory, cash register and counter sales. Paying per semester saves you 10 % and the yearly plan gives you 2 free months. You can choose guaraníes or dollars.",
        },
        {
          q: "How do I pay?",
          a: "We arrange the payment with you on WhatsApp and give you your receipt. If within the guarantee you decide it's not for you, the refund is arranged the same way.",
        },
        {
          q: "I have more than one location or employees, will it work for me?",
          a: "Yes. The Pro plan includes unlimited branches and up to 5 users with roles; Business, unlimited users.",
        },
        {
          q: "I only sell accessories, I don't repair. Is there a plan for me?",
          a: "Yes, the Retail plan is for retail stores: point of sale, inventory, barcodes and cash control.",
        },
        {
          q: "What if I get stuck or don't know how to use it?",
          a: "The system comes with a step-by-step tutorial and we help you on WhatsApp, in Spanish.",
        },
        {
          q: "Can I change plans later?",
          a: "Yes. You start with the one you need today and move up when your shop grows.",
        },
      ],
      extra: [
        {
          q: "What language is the system in?",
          a: "Right now the system (screens and in-app tutorial) and WhatsApp support are in Spanish. The {dayCount}-day guarantee lets you check whether that works for your shop.",
        },
      ],
    },
    final: {
      title: "Your next repair, [[already organized]].",
      text: "Use it for **{days}** in your shop. If it doesn't work for you, **we refund all your money**.",
      smallPrint: "🇵🇾 Made in Paraguay · WhatsApp support in Spanish",
    },
    footer: { support: "WhatsApp support" },
  },
};
