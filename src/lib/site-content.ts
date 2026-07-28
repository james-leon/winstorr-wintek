/**
 * Static informational + legal content served by /infos/$slug and /legal/$slug.
 * Placeholder legal copy is flagged with `placeholder: true` — replace before launch.
 */

export type ContentSection = { heading?: string; body: string[]; bullets?: string[] };

export type ContentPage = {
  slug: string;
  title: string;
  description: string;
  intro: string;
  sections: ContentSection[];
  placeholder?: boolean;
};

function page(p: ContentPage): ContentPage {
  return p;
}

export const INFO_PAGES: Record<string, ContentPage> = Object.fromEntries(
  [
    page({
      slug: "a-propos",
      title: "À propos de Wintek",
      description:
        "Wintek (Winner Technology) est l'entreprise camerounaise qui opère Winstorr : électronique, services techniques et formations.",
      intro:
        "Winstorr est la marketplace opérée par Wintek — Winner Technology, entreprise technologique basée à Douala, Cameroun.",
      sections: [
        {
          heading: "Notre mission",
          body: [
            "Rendre l'achat de matériel technologique fiable au Cameroun : des produits contrôlés, des vendeurs vérifiés, un service après-vente réel.",
          ],
        },
        {
          heading: "Ce que nous faisons",
          body: [],
          bullets: [
            "Vente de matériel électronique (téléphones, ordinateurs, sécurité, audio…)",
            "Produits numériques et licences",
            "Services techniques : installation, réparation, maintenance",
            "Formations professionnelles via Wintek Academy",
          ],
        },
      ],
    }),
    page({
      slug: "engagement-qualite",
      title: "Notre engagement qualité",
      description:
        "Comment Winstorr contrôle les produits, vérifie les vendeurs et protège chaque commande jusqu'à la réception.",
      intro:
        "Chaque produit affiché sur Winstorr passe par un contrôle avant sa mise en ligne. C'est le sens du badge « Qualité vérifiée ».",
      sections: [
        {
          heading: "Le contrôle produit",
          body: [],
          bullets: [
            "Vérification de la conformité et de l'état du matériel",
            "Contrôle de la fiche produit : caractéristiques, photos, prix",
            "Validation manuelle des produits des vendeurs partenaires par l'équipe Wintek",
          ],
        },
        {
          heading: "La protection de votre commande",
          body: [
            "Le vendeur dispose de 24 h pour accepter votre commande. Les fonds ne lui sont versés qu'après votre confirmation de réception.",
          ],
        },
      ],
    }),
    page({
      slug: "comment-ca-marche",
      title: "Comment ça marche",
      description: "Commander sur Winstorr en 4 étapes : choix, paiement, préparation, réception.",
      intro: "Acheter sur Winstorr prend quelques minutes, avec ou sans compte.",
      sections: [
        {
          heading: "1. Choisissez",
          body: ["Parcourez le catalogue, comparez les vendeurs et ajoutez au panier."],
        },
        {
          heading: "2. Payez",
          body: ["MTN Mobile Money, Orange Money, carte bancaire — ou paiement à la réception selon le produit."],
        },
        {
          heading: "3. Le vendeur prépare",
          body: ["Le vendeur a 24 h pour accepter. Vous êtes prévenu par e-mail et WhatsApp à chaque étape."],
        },
        {
          heading: "4. Vous recevez et confirmez",
          body: ["Retrait en point relais ou livraison. Vous confirmez la réception : le vendeur est alors payé."],
        },
      ],
    }),
    page({
      slug: "wintek-academy",
      title: "Wintek Academy",
      description: "Formations techniques Wintek : électronique, réseaux, sécurité, maintenance informatique.",
      intro: "Wintek Academy propose des formations pratiques encadrées par nos techniciens.",
      sections: [
        {
          heading: "Nos formations",
          body: [
            "Les sessions ouvertes sont publiées dans le catalogue, catégorie « Formations ». Chaque session indique les dates, le lieu et le nombre de places.",
          ],
        },
        {
          heading: "Formations en entreprise",
          body: ["Nous organisons des sessions sur mesure pour les équipes. Contactez-nous pour un devis."],
        },
      ],
    }),
    page({
      slug: "contact",
      title: "Nous contacter",
      description: "Téléphone, WhatsApp, e-mail et adresse de l'équipe Winstorr à Douala.",
      intro: "Notre équipe répond du lundi au samedi, de 8h à 18h.",
      sections: [
        {
          heading: "Nous joindre",
          body: [],
          bullets: [
            "WhatsApp : le moyen le plus rapide (bouton en bas de page)",
            "E-mail : contact@winstorr.com",
            "Adresse : Douala, Cameroun",
          ],
        },
        {
          heading: "Une commande en cours ?",
          body: ["Indiquez votre numéro de commande (format WS-…) pour un traitement plus rapide."],
        },
      ],
    }),
    page({
      slug: "guide-du-vendeur",
      title: "Guide du vendeur",
      description: "Vendre sur Winstorr : inscription, mise en ligne, commandes, commissions et retraits.",
      intro: "Ce guide résume le fonctionnement de l'espace vendeur Winstorr.",
      sections: [
        {
          heading: "Devenir vendeur",
          body: ["Déposez votre candidature depuis la page « Devenir vendeur ». L'équipe Wintek valide sous quelques jours."],
        },
        {
          heading: "Publier vos produits",
          body: [
            "Depuis l'espace vendeur : fiche produit, photos carrées (1000×1000), stock, variantes et quantité minimum. Les produits sont relus par Wintek avant publication.",
          ],
        },
        {
          heading: "Commandes et paiements",
          body: [],
          bullets: [
            "Vous avez 24 h pour accepter ou refuser une commande",
            "Les fonds sont libérés après confirmation de réception par le client",
            "La commission dépend de votre palier vendeur",
            "Les retraits se demandent depuis « Mes revenus »",
          ],
        },
      ],
    }),
    page({
      slug: "moyens-de-paiement",
      title: "Moyens de paiement",
      description: "MTN Mobile Money, Orange Money, carte bancaire et paiement à la réception sur Winstorr.",
      intro: "Tous les paiements en ligne sont traités par notre prestataire sécurisé.",
      sections: [
        {
          heading: "Paiements acceptés",
          body: [],
          bullets: [
            "MTN Mobile Money",
            "Orange Money",
            "Carte bancaire (Visa / Mastercard)",
            "Paiement à la réception (selon le produit et la zone)",
          ],
        },
        {
          heading: "Sécurité",
          body: ["Winstorr ne stocke aucune donnée bancaire. Le paiement se fait sur la plateforme sécurisée du prestataire."],
        },
      ],
    }),
    page({
      slug: "points-de-retrait",
      title: "Points de retrait",
      description: "Retirez votre commande Winstorr dans un point relais partenaire à Douala.",
      intro:
        "Le retrait en point relais est gratuit. Vous choisissez votre point au moment de la commande, parmi ceux disponibles.",
      sections: [
        {
          heading: "Comment ça se passe",
          body: [],
          bullets: [
            "Vous recevez un message dès que la commande est prête",
            "Présentez votre numéro de commande et une pièce d'identité",
            "La commande reste disponible 7 jours au point de retrait",
          ],
        },
      ],
    }),
    page({
      slug: "zones-de-livraison",
      title: "Zones de livraison",
      description: "Livraison Winstorr à Douala et dans les autres villes du Cameroun.",
      intro: "Les frais et délais sont calculés au moment de la commande selon votre adresse.",
      sections: [
        {
          heading: "Zones couvertes",
          body: [],
          bullets: [
            "Douala : livraison sous 24 à 48 h",
            "Autres villes du Cameroun : 2 à 5 jours ouvrés selon le transporteur",
            "Retrait en point relais : gratuit",
          ],
        },
      ],
    }),
    page({
      slug: "paiement-a-la-reception",
      title: "Paiement à la réception",
      description: "Payer sa commande Winstorr au moment du retrait ou de la livraison.",
      intro:
        "Sur les produits éligibles, vous pouvez régler au retrait ou à la livraison, en espèces ou par Mobile Money.",
      sections: [
        {
          heading: "Conditions",
          body: [],
          bullets: [
            "Disponible uniquement lorsque l'option apparaît au moment de la commande",
            "Le montant doit être réglé intégralement avant remise du colis",
            "Les commandes non retirées sous 7 jours sont annulées",
          ],
        },
      ],
    }),
    page({
      slug: "retours-remboursements",
      title: "Retours & remboursements",
      description: "Conditions de retour Winstorr : 7 jours, procédure et délais de remboursement.",
      intro: "Vous disposez de 7 jours après réception pour demander un retour sur un produit physique.",
      sections: [
        {
          heading: "Procédure",
          body: [],
          bullets: [
            "Ouvrez la commande dans « Mes commandes » et demandez un retour",
            "Indiquez le motif et joignez une photo si le produit est endommagé",
            "Après validation, le remboursement est effectué sur le moyen de paiement d'origine",
          ],
        },
        {
          heading: "Exclusions",
          body: [
            "Les produits numériques, services réalisés et formations déjà suivies ne sont pas remboursables, sauf défaut avéré.",
          ],
        },
      ],
    }),
    page({
      slug: "garantie",
      title: "Garantie qualité & SAV Wintek",
      description: "Garantie du matériel vendu sur Winstorr et service après-vente assuré par Wintek.",
      intro: "Le matériel électronique vendu sur Winstorr bénéficie d'une garantie et du SAV Wintek.",
      sections: [
        {
          heading: "Ce que couvre la garantie",
          body: [],
          bullets: [
            "Panne ou défaut de fabrication constaté durant la période de garantie indiquée sur la fiche produit",
            "Diagnostic et réparation par l'atelier Wintek",
            "Remplacement si la réparation est impossible",
          ],
        },
        {
          heading: "Non couvert",
          body: ["Casse, oxydation, surtension, ouverture par un tiers non agréé."],
        },
      ],
    }),
    page({
      slug: "faq",
      title: "Questions fréquentes",
      description: "Réponses aux questions courantes sur les commandes, paiements, livraisons et retours Winstorr.",
      intro: "Les réponses aux questions que l'on nous pose le plus souvent.",
      sections: [
        {
          heading: "Dois-je créer un compte pour commander ?",
          body: ["Non, la commande est possible sans compte. Un compte permet de suivre vos commandes et vos retours."],
        },
        {
          heading: "Quand suis-je débité ?",
          body: ["Au moment du paiement en ligne. Le vendeur n'est payé qu'après votre confirmation de réception."],
        },
        {
          heading: "Que se passe-t-il si le vendeur refuse ma commande ?",
          body: ["La commande est annulée et vous êtes remboursé intégralement."],
        },
        {
          heading: "Puis-je modifier ma commande ?",
          body: ["Contactez-nous sur WhatsApp le plus tôt possible : c'est possible tant que la commande n'est pas préparée."],
        },
      ],
    }),
    page({
      slug: "signaler-un-probleme",
      title: "Signaler un problème",
      description: "Signaler un produit, un vendeur ou un incident sur Winstorr.",
      intro:
        "Un produit non conforme, un vendeur qui ne répond pas, un contenu suspect ? Signalez-le, nous traitons chaque signalement.",
      sections: [
        {
          heading: "Comment signaler",
          body: [],
          bullets: [
            "Sur WhatsApp : le plus rapide, avec le numéro de commande et des photos",
            "Par e-mail : contact@winstorr.com",
            "Depuis « Mes commandes » pour un problème lié à une commande précise",
          ],
        },
        {
          heading: "Notre engagement",
          body: ["Réponse sous 48 h ouvrées. Un vendeur signalé à plusieurs reprises est suspendu le temps de l'enquête."],
        },
      ],
    }),
  ].map((p) => [p.slug, p]),
);

export const LEGAL_PAGES: Record<string, ContentPage> = Object.fromEntries(
  [
    page({
      slug: "cgv",
      title: "Conditions Générales de Vente",
      description: "Conditions générales de vente de la marketplace Winstorr, opérée par Wintek.",
      intro: "Contenu à venir — ces conditions doivent être rédigées et validées avant le lancement officiel.",
      placeholder: true,
      sections: [
        {
          heading: "À couvrir",
          body: [],
          bullets: [
            "Objet, champ d'application et acceptation",
            "Commandes, prix et moyens de paiement",
            "Livraison, retrait et transfert de risque",
            "Rôle de Winstorr en tant qu'intermédiaire entre vendeurs et acheteurs",
            "Garanties, responsabilité et droit applicable",
          ],
        },
      ],
    }),
    page({
      slug: "confidentialite",
      title: "Politique de confidentialité",
      description: "Traitement des données personnelles des utilisateurs de Winstorr.",
      intro: "Contenu à venir — la politique de confidentialité définitive reste à rédiger.",
      placeholder: true,
      sections: [
        {
          heading: "À couvrir",
          body: [],
          bullets: [
            "Données collectées et finalités",
            "Base légale et durée de conservation",
            "Partage avec les vendeurs et prestataires (paiement, e-mail, SMS)",
            "Droits d'accès, de rectification et de suppression",
          ],
        },
      ],
    }),
    page({
      slug: "politique-de-retour",
      title: "Politique de retour",
      description: "Règles de retour et de remboursement applicables aux achats Winstorr.",
      intro: "Contenu à venir — la version juridique complète reste à rédiger.",
      placeholder: true,
      sections: [
        {
          heading: "Pratique actuelle",
          body: ["Retour possible sous 7 jours après réception pour les produits physiques, hors exclusions."],
        },
      ],
    }),
    page({
      slug: "mentions-legales",
      title: "Mentions légales",
      description: "Éditeur, hébergeur et informations légales du site Winstorr.",
      intro: "Contenu à venir — les mentions légales officielles doivent être complétées.",
      placeholder: true,
      sections: [
        {
          heading: "À compléter",
          body: [],
          bullets: [
            "Raison sociale, forme juridique et capital de Wintek",
            "Numéro de registre de commerce et identifiant fiscal",
            "Siège social et directeur de la publication",
            "Hébergeur du site",
          ],
        },
      ],
    }),
    page({
      slug: "cookies",
      title: "Cookies",
      description: "Utilisation des cookies et traceurs sur Winstorr.",
      intro: "Contenu à venir — la politique cookies définitive reste à rédiger.",
      placeholder: true,
      sections: [
        {
          heading: "Usage actuel",
          body: [
            "Winstorr utilise uniquement des cookies techniques nécessaires au fonctionnement du site (session, panier). Aucun cookie publicitaire n'est déposé.",
          ],
        },
      ],
    }),
  ].map((p) => [p.slug, p]),
);
