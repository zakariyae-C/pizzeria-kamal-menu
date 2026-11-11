/* Shared default menu data with structured multi-price support */
window.DEFAULT_MENU = [
  {
    id: "pizzas",
    g: "repas",
    t: "Pizzas",
    icon: "🍕",
    img: "img/pizzas.webp",
    badge: "1 ou 2 personnes",
    cols: ["1 pers.", "2 pers."],
    i: [
      {
        n: "Margherita",
        p: 30,
        x: 55,
        d: "Sauce tomate, fromage, olive noire",
        img: "img/pizzas/margherita.webp",
        prices: [
          {
            label: "1 pers.",
            amount: 30,
          },
          {
            label: "2 pers.",
            amount: 55,
          },
        ],
        best: true,
        available: true,
      },
      {
        n: "Vegetariana",
        p: 32,
        x: 57,
        d: "Sauce tomate, fromage, légumes grillés",
        img: "img/pizzas/vegetariana.webp",
        prices: [
          {
            label: "1 pers.",
            amount: 32,
          },
          {
            label: "2 pers.",
            amount: 57,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Au thon",
        p: 40,
        x: 68,
        d: "Sauce tomate, thon, olive noire, oignon, poivron, fromage",
        img: "img/pizzas/thon.webp",
        prices: [
          {
            label: "1 pers.",
            amount: 40,
          },
          {
            label: "2 pers.",
            amount: 68,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Viande hachée",
        p: 40,
        x: 68,
        d: "Sauce tomate, viande hachée, olive noire, oignon, poivron, fromage",
        img: "img/pizzas/viandeHachee.webp",
        prices: [
          {
            label: "1 pers.",
            amount: 40,
          },
          {
            label: "2 pers.",
            amount: 68,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Poulet",
        p: 40,
        x: 68,
        d: "Sauce tomate, poulet, olive noire, champignon, fromage",
        img: "img/pizzas/poulet.webp",
        prices: [
          {
            label: "1 pers.",
            amount: 40,
          },
          {
            label: "2 pers.",
            amount: 68,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "4 Saisons",
        p: 48,
        x: 75,
        d: "Sauce au choix, thon, fruits de mer, viande hachée, légumes grillés, fromage",
        img: "img/pizzas/saisons.webp",
        prices: [
          {
            label: "1 pers.",
            amount: 48,
          },
          {
            label: "2 pers.",
            amount: 75,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Fruits de mer",
        p: 48,
        x: 75,
        d: "Sauce au choix, fruits de mer, champignon, olive noire, fromage",
        img: "img/pizzas/fruitsMer.webp",
        prices: [
          {
            label: "1 pers.",
            amount: 48,
          },
          {
            label: "2 pers.",
            amount: 75,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "La Pizzeria",
        p: 48,
        x: 75,
        d: "Sauce au choix, poulet, viande hachée, jumbo, légumes, fruits de mer, champignon, olive noire",
        img: "img/pizzas/pizzeria.webp",
        prices: [
          {
            label: "1 pers.",
            amount: 48,
          },
          {
            label: "2 pers.",
            amount: 75,
          },
        ],
        best: true,
        available: true,
      },
      {
        n: "Alfredo",
        p: 45,
        x: 70,
        d: "Sauce blanche, poulet, champignon, jambon, fromage",
        img: "img/pizzas/alfredo.webp",
        prices: [
          {
            label: "1 pers.",
            amount: 45,
          },
          {
            label: "2 pers.",
            amount: 70,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "4 Fromages",
        p: 45,
        x: 67,
        d: "Sauce blanche, mozzarella, emmental, cheddar, fromage rouge, bleu",
        img: "img/pizzas/fromages.webp",
        prices: [
          {
            label: "1 pers.",
            amount: 45,
          },
          {
            label: "2 pers.",
            amount: 67,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Pepperoni",
        p: 45,
        x: 65,
        d: "Sauce tomate, mozzarella, pepperoni, olive noire, poivron, oignon",
        img: "img/pizzas/pepperoni.webp",
        prices: [
          {
            label: "1 pers.",
            amount: 45,
          },
          {
            label: "2 pers.",
            amount: 65,
          },
        ],
        best: false,
        available: true,
      },
    ],
  },
  {
    id: "calzones",
    g: "repas",
    t: "Calzones",
    icon: "🥟",
    img: "img/calzones.webp",
    badge: "Pizza pliée",
    i: [
      {
        n: "Calzone fruits de mer",
        p: 58,
        d: "Champignon, olive",
        img: "img/calzones/fruitsMer.webp",
        prices: [
          {
            label: "",
            amount: 58,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Calzone La Pizzeria",
        p: 53,
        d: "Champignon, olive, poulet, viande, jambon, thon, calamar, crevette",
        img: "img/calzones/pizzeria.webp",
        prices: [
          {
            label: "",
            amount: 53,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Calzone mixte",
        p: 48,
        d: "Champignon, olive, poulet, thon, jambon, viande, calamar",
        img: "img/calzones/mixte.webp",
        prices: [
          {
            label: "",
            amount: 48,
          },
        ],
        best: false,
        available: true,
      },
    ],
  },
  {
    id: "pasticcio",
    g: "repas",
    t: "Pasticcio",
    icon: "🍝",
    img: "img/pasticcio/pizzeria.webp",
    badge: "Base frites ou penne",
    i: [
      {
        n: "Pasticcio poulet",
        p: 45,
        d: "",
        img: "img/pasticcio/poulet.webp",
        prices: [
          {
            label: "",
            amount: 45,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Pasticcio viande hachée",
        p: 45,
        d: "",
        img: "img/pasticcio/viandeHachee.webp",
        prices: [
          {
            label: "",
            amount: 45,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Pasticcio fruits de mer",
        p: 55,
        d: "",
        img: "img/pasticcio/fruitsMer.webp",
        prices: [
          {
            label: "",
            amount: 55,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Pasticcio La Pizzeria",
        p: 50,
        d: "Base de frites ou penne",
        img: "img/pasticcio/pizzeria.webp",
        prices: [
          {
            label: "",
            amount: 50,
          },
        ],
        best: false,
        available: true,
      },
    ],
  },
  {
    id: "tacos",
    g: "repas",
    t: "Tacos",
    icon: "🌯",
    img: "img/tacos.webp",
    badge: "Gratiné +15 DH",
    i: [
      {
        n: "Poulet",
        p: 40,
        d: "",
        img: "img/tacos/poulet.webp",
        prices: [
          {
            label: "",
            amount: 40,
          },
        ],
        best: true,
        available: true,
      },
      {
        n: "Dinde",
        p: 40,
        d: "",
        img: "img/tacos/dinde.webp",
        prices: [
          {
            label: "",
            amount: 40,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Nuggets",
        p: 42,
        d: "",
        img: "img/tacos/nuggets.webp",
        prices: [
          {
            label: "",
            amount: 42,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Chawarma",
        p: 45,
        d: "",
        img: "img/tacos/chawarma.webp",
        prices: [
          {
            label: "",
            amount: 45,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Merguez",
        p: 45,
        d: "",
        img: "img/tacos/merguez.webp",
        prices: [
          {
            label: "",
            amount: 45,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Viande hachée",
        p: 45,
        d: "",
        img: "img/tacos/viandeHachee.webp",
        prices: [
          {
            label: "",
            amount: 45,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Cordon bleu",
        p: 48,
        d: "",
        img: "img/tacos/cordonBleu.webp",
        prices: [
          {
            label: "",
            amount: 48,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Crispy Chicken",
        p: 48,
        d: "",
        img: "img/tacos/crispyChicken.webp",
        prices: [
          {
            label: "",
            amount: 48,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Mixte",
        p: 48,
        d: "",
        img: "img/tacos/mixte.webp",
        prices: [
          {
            label: "",
            amount: 48,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Charcuterie + viande hachée",
        p: 48,
        d: "",
        img: "img/tacos/charcuterieViandeHachee.webp",
        prices: [
          {
            label: "",
            amount: 48,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Royale mixte",
        p: 54,
        d: "",
        img: "img/tacos/royaleMixte.webp",
        prices: [
          {
            label: "",
            amount: 54,
          },
        ],
        best: false,
        available: true,
      },
    ],
  },
  {
    id: "sandwichs",
    g: "repas",
    t: "Sandwichs",
    icon: "🌭",
    img: "img/sandwichs/mixte.webp",
    badge: "Classiques",
    i: [
      {
        n: "Poulet",
        p: 25,
        d: "",
        img: "img/sandwichs/poulet.webp",
        prices: [
          {
            label: "",
            amount: 25,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Dinde",
        p: 25,
        d: "",
        img: "img/sandwichs/dinde.webp",
        prices: [
          {
            label: "",
            amount: 25,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Viande hachée",
        p: 28,
        d: "",
        img: "img/sandwichs/viandeHachee.webp",
        prices: [
          {
            label: "",
            amount: 28,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Saucisses",
        p: 28,
        d: "",
        img: "img/sandwichs/saucisses.webp",
        prices: [
          {
            label: "",
            amount: 28,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Mixte",
        p: 30,
        d: "",
        img: "img/sandwichs/mixte.webp",
        prices: [
          {
            label: "",
            amount: 30,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Mixte royale",
        p: 38,
        d: "",
        img: "img/sandwichs/mixteRoyal.webp",
        prices: [
          {
            label: "",
            amount: 38,
          },
        ],
        best: false,
        available: true,
      },
    ],
  },
  {
    id: "sandwichs-speciaux",
    g: "repas",
    t: "Sandwichs Spéciaux",
    icon: "🥪",
    img: "img/sandwichsSpeciaux.webp",
    badge: "Sandwich / Spécial",
    i: [
      {
        n: "Sandwich poulet",
        p: 42,
        d: "",
        img: "img/sandwichsSpeciaux.webp",
        prices: [
          {
            label: "",
            amount: 42,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Sandwich viande hachée",
        p: 45,
        d: "",
        img: "img/sandwichsSpeciaux.webp",
        prices: [
          {
            label: "",
            amount: 45,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Sandwich mixte",
        p: 48,
        d: "",
        img: "img/sandwichsSpeciaux.webp",
        prices: [
          {
            label: "",
            amount: 48,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Sandwich fruits de mer",
        p: 55,
        d: "",
        img: "img/sandwichsSpeciaux.webp",
        prices: [
          {
            label: "",
            amount: 55,
          },
        ],
        best: false,
        available: true,
      },
    ],
  },
  {
    id: "paninis",
    g: "repas",
    t: "Paninis",
    icon: "🥪",
    img: "img/paninis.webp",
    badge: "Pressés & grillés",
    i: [
      {
        n: "Thon",
        p: 24,
        d: "",
        prices: [
          {
            label: "",
            amount: 24,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Saucisses",
        p: 30,
        d: "",
        prices: [
          {
            label: "",
            amount: 30,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Dinde",
        p: 30,
        d: "",
        prices: [
          {
            label: "",
            amount: 30,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Viande hachée",
        p: 30,
        d: "",
        prices: [
          {
            label: "",
            amount: 30,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Poulet",
        p: 30,
        d: "",
        prices: [
          {
            label: "",
            amount: 30,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Mixte",
        p: 32,
        d: "",
        prices: [
          {
            label: "",
            amount: 32,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Fruits de mer",
        p: 43,
        d: "",
        prices: [
          {
            label: "",
            amount: 43,
          },
        ],
        best: false,
        available: true,
      },
    ],
  },
  {
    id: "burgers",
    g: "repas",
    t: "Burgers",
    icon: "🍔",
    img: "img/burgers.webp",
    badge: "Burgers",
    i: [
      {
        n: "Cheese Burger",
        p: 38,
        d: "",
        prices: [
          {
            label: "",
            amount: 38,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Chicken Cheese",
        p: 38,
        d: "",
        prices: [
          {
            label: "",
            amount: 38,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Egg Cheese Burger",
        p: 40,
        d: "",
        prices: [
          {
            label: "",
            amount: 40,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Double Hamburger",
        p: 55,
        d: "",
        prices: [
          {
            label: "",
            amount: 55,
          },
        ],
        best: true,
        available: true,
      },
      {
        n: "Royale Chicken Cheese",
        p: 55,
        d: "",
        prices: [
          {
            label: "",
            amount: 55,
          },
        ],
        best: false,
        available: true,
      },
    ],
  },
  {
    id: "chawarma",
    g: "repas",
    t: "Chawarma",
    icon: "🥙",
    img: "img/chawarma.webp",
    badge: "Chawarma",
    i: [
      {
        n: "Simple (Rghif)",
        p: 30,
        d: "",
        prices: [
          {
            label: "",
            amount: 30,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Simple + fromage",
        p: 32,
        d: "",
        prices: [
          {
            label: "",
            amount: 32,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Sans garniture",
        p: 35,
        d: "",
        prices: [
          {
            label: "",
            amount: 35,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Chawarma plat",
        p: 50,
        d: "",
        prices: [
          {
            label: "",
            amount: 50,
          },
        ],
        best: false,
        available: true,
      },
    ],
  },
  {
    id: "plats",
    g: "repas",
    t: "Plats",
    icon: "🍗",
    img: "img/plats.webp",
    badge: "Plats",
    i: [
      {
        n: "Poulet",
        p: 55,
        d: "",
        img: "img/plats/poulet.webp",
        prices: [
          {
            label: "",
            amount: 55,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Dinde",
        p: 55,
        d: "",
        img: "img/plats/dinde.webp",
        prices: [
          {
            label: "",
            amount: 55,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Viande hachée",
        p: 57,
        d: "",
        img: "img/plats/viandeHachee.webp",
        prices: [
          {
            label: "",
            amount: 57,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Saucisses",
        p: 57,
        d: "",
        img: "img/plats/saucisses.webp",
        prices: [
          {
            label: "",
            amount: 57,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Cordon bleu",
        p: 60,
        d: "",
        img: "img/plats/cordonBleu.webp",
        prices: [
          {
            label: "",
            amount: 60,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Crispy",
        p: 60,
        d: "",
        img: "img/plats/crispy.webp",
        prices: [
          {
            label: "",
            amount: 60,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Mixte",
        p: 60,
        d: "",
        img: "img/plats/mixte.webp",
        prices: [
          {
            label: "",
            amount: 60,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Royale mixte",
        p: 67,
        d: "",
        img: "img/plats/royaleMixte.webp",
        prices: [
          {
            label: "",
            amount: 67,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Émincé de poulet",
        p: 75,
        d: "",
        img: "img/plats/nuggets.webp",
        prices: [
          {
            label: "",
            amount: 75,
          },
        ],
        best: false,
        available: true,
      },
    ],
  },
  {
    id: "salades",
    g: "repas",
    t: "Salades",
    icon: "🥗",
    img: "img/salades.webp",
    badge: "Salades composées",
    i: [
      {
        n: "Salade variée",
        p: 27,
        d: "Salade verte, carotte, betterave, pâtes, riz, tomate, pomme de terre, thon, maïs, œuf",
        img: "img/salades/variee.webp",
        prices: [
          {
            label: "",
            amount: 27,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Salade niçoise",
        p: 32,
        d: "Salade verte, carotte, betterave, pâtes, riz, tomate, pomme de terre, thon, maïs, œuf, fromage rouge",
        img: "img/salades/nicoise.webp",
        prices: [
          {
            label: "",
            amount: 32,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Salade dinde",
        p: 40,
        d: "Salade verte, carotte, betterave, pâtes, riz, tomate, pomme de terre, thon, maïs, œuf, Dinde",
        img: "img/salades/dinde.webp",
        prices: [
          {
            label: "",
            amount: 40,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Salade maison",
        p: 45,
        d: "Riz, pâtes, fromage rouge, jambon, thon, maïs, poulet",
        img: "img/salades/maison.webp",
        prices: [
          {
            label: "",
            amount: 45,
          },
        ],
        best: true,
        available: true,
      },
      {
        n: "Salade du chef",
        p: 55,
        d: "Salade composée avec dinde fumée, jambon et poulet",
        img: "img/salades/chef.webp",
        prices: [
          {
            label: "",
            amount: 55,
          },
        ],
        best: false,
        available: true,
      },
    ],
  },
  {
    id: "ration",
    g: "repas",
    t: "Rations",
    icon: "🍟",
    img: "img/ration.webp",
    badge: "Rations",
    i: [
      {
        n: "Cordon bleu",
        p: 40,
        d: "",
        img: "img/rations/cordonBleu.webp",
        prices: [
          {
            label: "",
            amount: 40,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Crispy Chicken",
        p: 40,
        d: "",
        img: "img/rations/crispyChicken.webp",
        prices: [
          {
            label: "",
            amount: 40,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Nuggets",
        p: 25,
        d: "",
        img: "img/rations/nuggets.webp",
        prices: [
          {
            label: "",
            amount: 25,
          },
        ],
        best: false,
        available: true,
      },
    ],
  },
  {
    id: "enfant",
    g: "repas",
    t: "Menu Enfant",
    icon: "👶",
    img: "img/enfant.webp",
    badge: "Egg Surprise inclus",
    i: [
      {
        n: "Menu enfant",
        p: 40,
        d: "Au choix : Cheese Burger, Nuggets ou Mini Tacos. Avec frites, jus et Egg Surprise.",
        prices: [
          {
            label: "",
            amount: 40,
          },
        ],
        best: false,
        available: true,
      },
    ],
  },
  {
    id: "supplements",
    g: "repas",
    t: "Suppléments",
    icon: "➕",
    img: "img/supplements/gratine.webp",
    badge: "À ajouter à votre plat",
    i: [
      {
        n: "Charcuterie",
        p: 8,
        d: "",
        img: "img/supplements/charcuterie.webp",
        prices: [
          {
            label: "",
            amount: 8,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Fromage rouge",
        p: 10,
        d: "",
        img: "img/supplements/fromage.webp",
        prices: [
          {
            label: "",
            amount: 10,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Riz",
        p: 12,
        d: "",
        img: "img/supplements/riz.webp",
        prices: [
          {
            label: "",
            amount: 12,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Légumes",
        p: 15,
        d: "",
        img: "img/supplements/legumes.webp",
        prices: [
          {
            label: "",
            amount: 15,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Nuggets (4 pièces)",
        p: 15,
        d: "",
        img: "img/supplements/nuggets.webp",
        prices: [
          {
            label: "",
            amount: 15,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Tacos gratiné",
        p: 15,
        d: "Supplément pour tacos",
        img: "img/supplements/gratine.webp",
        prices: [
          {
            label: "",
            amount: 15,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Crispy Chicken",
        p: 20,
        d: "",
        img: "img/supplements/crispyChicken.webp",
        prices: [
          {
            label: "",
            amount: 20,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Viande hachée",
        p: 20,
        d: "",
        img: "img/supplements/viandeHachee.webp",
        prices: [
          {
            label: "",
            amount: 20,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Fruits de mer",
        p: 30,
        d: "",
        img: "img/supplements/fruitsMer.webp",
        prices: [
          {
            label: "",
            amount: 30,
          },
        ],
        best: false,
        available: true,
      },
    ],
  },
  {
    id: "jus",
    g: "boissons",
    t: "Jus & Smoothies",
    icon: "🍹",
    img: "img/jus.webp",
    badge: "Lait ou orange",
    cols: ["Lait", "Orange"],
    i: [
      {
        n: "Jus de citron",
        p: 15,
        d: "",
        img: "img/jus/citron.webp",
        prices: [
          {
            label: "",
            amount: 15,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Jus d'orange",
        p: 16,
        d: "",
        img: "img/jus/orange.webp",
        prices: [
          {
            label: "",
            amount: 16,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Jus de pomme",
        p: 15,
        x: 18,
        d: "",
        img: "img/jus/pomme.webp",
        prices: [
          {
            label: "Lait",
            amount: 15,
          },
          {
            label: "Orange",
            amount: 18,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Jus de banane",
        p: 15,
        x: 20,
        d: "",
        img: "img/jus/banane.webp",
        prices: [
          {
            label: "Lait",
            amount: 15,
          },
          {
            label: "Orange",
            amount: 20,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Jus d'avocat",
        p: 20,
        x: 24,
        d: "",
        img: "img/jus/avocat.webp",
        prices: [
          {
            label: "Lait",
            amount: 20,
          },
          {
            label: "Orange",
            amount: 24,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Panaché au lait",
        p: 18,
        x: 22,
        d: "",
        img: "img/jus/panacheLait.webp",
        prices: [
          {
            label: "Lait",
            amount: 18,
          },
          {
            label: "Orange",
            amount: 22,
          },
        ],
        best: true,
        available: true,
      },
      {
        n: "Panaché orange",
        p: 22,
        d: "",
        img: "img/jus/panacheOrange.webp",
        prices: [
          {
            label: "",
            amount: 22,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Avocat fruits secs",
        p: 25,
        x: 28,
        d: "",
        img: "img/jus/avocat.webp",
        prices: [
          {
            label: "Lait",
            amount: 25,
          },
          {
            label: "Orange",
            amount: 28,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Salade de fruits",
        p: 17,
        x: 25,
        d: "",
        img: "img/jus/saladeFruits.webp",
        prices: [
          {
            label: "Lait",
            amount: 17,
          },
          {
            label: "Orange",
            amount: 25,
          },
        ],
        best: false,
        available: true,
      },
    ],
  },
  {
    id: "boissons",
    g: "boissons",
    t: "Sodas & Eau",
    icon: "🥤",
    img: "img/boissons.webp",
    badge: "Boissons fraîches",
    i: [
      {
        n: "Soda (canette)",
        p: 7,
        d: "",
        img: "img/boissons/soda.webp",
        prices: [
          {
            label: "",
            amount: 7,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Soda Maxi",
        p: 9,
        d: "",
        img: "img/boissons/soda1.webp",
        prices: [
          {
            label: "",
            amount: 9,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Soda 1 L",
        p: 15,
        d: "",
        img: "img/boissons/soda1.webp",
        prices: [
          {
            label: "",
            amount: 15,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Eau minérale 0,5 L",
        p: 5,
        d: "",
        img: "img/boissons/eau05.webp",
        prices: [
          {
            label: "",
            amount: 5,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Eau minérale 1,5 L",
        p: 7,
        d: "",
        img: "img/boissons/eau1.webp",
        prices: [
          {
            label: "",
            amount: 7,
          },
        ],
        best: false,
        available: true,
      },
    ],
  },
  {
    id: "desserts",
    g: "desserts",
    t: "Desserts",
    icon: "🍰",
    img: "img/dessert.webp",
    badge: "Desserts",
    i: [
      {
        n: "Tiramisu",
        p: 20,
        d: "KitKat, Oreo, Maltesers, Twix, Kinder, Snickers, Nutella, Milka",
        img: "img/desserts/tiramisu.webp",
        prices: [
          {
            label: "",
            amount: 20,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Crème caramel",
        p: 15,
        d: "",
        img: "img/desserts/cremeCaramel.webp",
        prices: [
          {
            label: "",
            amount: 15,
          },
        ],
        best: false,
        available: true,
      },
      {
        n: "Panacotta",
        p: 17,
        d: "",
        img: "img/desserts/panacotta.webp",
        prices: [
          {
            label: "",
            amount: 17,
          },
        ],
        best: false,
        available: true,
      },
    ],
  },
];

/* Normalization helper: ensures structured prices and compatibility across all platforms */
window.normalizeDish = function (dish, category) {
  if (!dish) return null;
  const copy = { ...dish };

  // Normalize prices
  if (Array.isArray(copy.prices) && copy.prices.length > 0) {
    copy.prices = copy.prices.map((pr) => ({
      label: (pr.label || "").trim(),
      amount: Number(pr.amount || 0),
    }));
  } else if (copy.x !== undefined) {
    const l1 = (category && category.cols && category.cols[0]) || "1 pers.";
    const l2 = (category && category.cols && category.cols[1]) || "2 pers.";
    copy.prices = [
      { label: l1, amount: Number(copy.p || 0) },
      { label: l2, amount: Number(copy.x || 0) },
    ];
  } else {
    copy.prices = [{ label: "", amount: Number(copy.p || 0) }];
  }

  // Ensure legacy compatibility properties exist
  copy.p = copy.prices[0] ? copy.prices[0].amount : 0;
  if (copy.prices.length > 1) {
    copy.x = copy.prices[1].amount;
  } else {
    delete copy.x;
  }

  copy.available = copy.available !== false;
  copy.best = !!copy.best;
  return copy;
};

window.normalizeMenuData = function (menu) {
  if (!Array.isArray(menu)) return [];
  return menu.map((cat) => ({
    ...cat,
    i: (cat.i || []).map((dish) => window.normalizeDish(dish, cat)),
  }));
};
