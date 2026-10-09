import { DEMO_DATES } from "@/data/mocks/demoDates";
import type { DemoLocale } from "./types";

const SOURCE_NOTE = "A place to start for official information. It is not a ruling on this sample case.";

export const EN: DemoLocale = {
  caseTitles: {
    "case-tenancy": "Notice from landlord to leave the flat",
    "case-consumer": "Washing machine still under warranty",
    "case-employment": "Two months’ salary not paid",
  },

  descriptions: {
    "case-tenancy": {
      narrative:
        "I have been living in a 1BHK in Kothrud, Pune for 11 months. Six days ago the owner sent a PDF asking me to leave in 15 days. My rent is paid up to date.",
      whatHappened: "I got a notice asking me to leave the flat.",
      whenHappened: "Six days ago",
      whoInvolved: "The flat owner, named S. Kulkarni. I live in the flat.",
      whatOutcomeWanted: "I want enough time to move, and my deposit back.",
    },
    "case-consumer": {
      narrative:
        "I bought a washing machine in March 2025. Water leaks from the drum. A technician came once and I paid for the visit, but it still leaks.",
      whatHappened: "The washing machine still leaks after a repair visit.",
      whenHappened: "The leak started a few weeks ago",
      whoInvolved: "The brand, Sagar Appliances, and its service centre.",
      whatOutcomeWanted: "A proper repair or a replacement, without paying again.",
    },
    "case-employment": {
      narrative:
        "I joined a small logistics company in Thane in June as an operations associate. I got my June salary. July and August salary have not come. HR says “accounts is delayed”. I only have the offer on WhatsApp and an appointment letter at home. I have not uploaded them yet.",
      whatHappened: "Two months of salary have not been paid.",
      whenHappened: "July and August",
      whoInvolved: "My employer (sample name: SwiftCart Logistics) and its HR desk.",
      whatOutcomeWanted: "To be paid what is due, or to know how to complain.",
    },
  },

  analyses: {
    "case-tenancy": {
      caseId: "case-tenancy",
      overview: {
        oneLine: "A sample leave-and-licence notice asking the person living in a Pune flat to move out.",
        documentOrProblemType: "Leave and licence notice to vacate (sample PDF)",
        parties: "You (living in the flat) and the owner, named S. Kulkarni in the sample",
      },
      plainLanguageSummary:
        "This paper is a notice from the owner of the flat. In simple words it says: you are using the 1BHK under a leave-and-licence arrangement, the owner wants the flat back, and you are asked to leave within 15 days of the notice. It also talks about the security deposit. This is a sample paper. It does not decide who is right, and it is not legal advice.",
      keyFacts: [
        "Place shown in the paper: Kothrud, Pune, Maharashtra.",
        "The paper calls the arrangement “leave and licence”.",
        "The notice asks you to leave within 15 days.",
        "Your notes say the rent is paid up to date.",
        "The paper mentions a security deposit of ₹60,000.",
      ],
      clauses: [
        {
          id: "cl-vacate",
          heading: "Asking you to leave",
          plainLanguage:
            "The owner asks you to give back the keys and leave by a certain date. The paper treats this as the end of the licence.",
          excerpt:
            "“The Licensee shall vacate and hand over vacant possession within fifteen (15) days of this notice.”",
          whyItMatters:
            "This is the line that puts you under time pressure. Whether 15 days is fair or can be enforced is a question for an advocate, not for this sample.",
        },
        {
          id: "cl-deposit",
          heading: "Security deposit",
          plainLanguage:
            "The notice says the deposit will be returned after checking for damage, after taking away any unpaid amount.",
          excerpt: "“The security deposit shall be refunded after deduction of dues and damages, if any.”",
          whyItMatters:
            "Deposits are a common cause of disputes. Keep proof of what you paid and of the condition of the flat.",
        },
        {
          id: "cl-lock",
          heading: "Inspection and keys",
          plainLanguage: "It asks for a joint inspection and for all keys and access cards to be returned.",
          excerpt:
            "“A joint inspection will be held before handover. All keys and access cards are to be returned.”",
          whyItMatters:
            "A written record of the inspection (photos, and a short note both sides sign) can prevent arguments later.",
        },
      ],
      obligations: [
        {
          id: "ob-you-read",
          actor: "you",
          text: "Read the whole notice, keep it safely, and write down the date you got it.",
        },
        {
          id: "ob-you-rent",
          actor: "you",
          text: "Keep collecting proof of rent already paid (receipts, UPI, bank statements).",
        },
        {
          id: "ob-other",
          actor: "other_party",
          text: "As written, the owner is asking for the flat back and offers to settle the deposit after inspection.",
        },
        {
          id: "ob-unclear",
          actor: "unclear",
          text: "The original leave-and-licence agreement is not attached, so its exact terms are not known.",
        },
      ],
      risks: [
        {
          id: "rk-time",
          severity: "attention",
          text: "Fifteen days is short. Do not ignore the paper. But do not assume you must leave at once without checking your papers and asking a person for help.",
        },
        {
          id: "rk-deposit",
          severity: "attention",
          text: "If you leave without a written handover, getting the deposit back can become harder.",
        },
        {
          id: "rk-lockout",
          severity: "serious",
          text: "If anyone threatens to lock you out or cut water or electricity, treat it as serious and ask for official or legal-aid help. This sample cannot say what a court would do.",
        },
      ],
      deadlines: [
        {
          id: "dl-vacate",
          label: "Date to leave, as written in the sample notice",
          date: DEMO_DATES.vacate,
          urgency: "soon",
          note: "Counted from the date on the sample notice. Check the real date on any paper you receive.",
        },
      ],
      missingInformation: [
        {
          id: "mi-deed",
          question: "Where is the signed leave-and-licence or rent agreement?",
          whyNeeded: "The notice refers to an agreement that is not attached here.",
        },
        {
          id: "mi-notice-service",
          question: "How did the notice reach you (WhatsApp, email, post, by hand)?",
          whyNeeded: "How a notice was delivered can matter later. This sample cannot see that.",
        },
      ],
      evidenceChecklist: [
        { id: "ev-notice", label: "The notice (this sample PDF)", status: "have" },
        { id: "ev-rent", label: "Proof of rent paid", status: "missing" },
        { id: "ev-deed", label: "Original agreement", status: "missing" },
        { id: "ev-photos", label: "Photos of the flat as it is today", status: "optional" },
        { id: "ev-deposit", label: "Proof of the deposit you paid", status: "missing" },
      ],
      legalInformation: [
        {
          id: "li-licence",
          title: "“Leave and licence” is not the same as every rental",
          summary:
            "In Maharashtra, many flats are given on a “leave and licence” paper. The words on the paper, whether it is registered, and local practice all matter. This sample does not apply any law to your facts.",
          verification: "demo_unverified",
        },
        {
          id: "li-aid",
          title: "If you cannot pay for an advocate",
          summary:
            "State and District Legal Services Authorities help people who qualify, free of cost. In Maharashtra you can call 15100 or 1800 222 324. Use official sources, not rumours.",
          verification: "demo_unverified",
        },
      ],
      sources: [
        {
          id: "src-nalsa",
          label: "National Legal Services Authority (NALSA)",
          kind: "official_body",
          url: "https://nalsa.gov.in/",
          note: SOURCE_NOTE,
        },
        {
          id: "src-mslsa",
          label: "Maharashtra State Legal Services Authority",
          kind: "official_body",
          url: "https://maharashtra.nalsa.gov.in/",
          note: SOURCE_NOTE,
        },
        {
          id: "src-ecourts",
          label: "eCourts Services",
          kind: "court_services",
          url: "https://ecourts.gov.in/",
          note: SOURCE_NOTE,
        },
      ],
      nextSteps: [
        {
          id: "ns-1",
          order: 1,
          kind: "self",
          text: "Keep the notice safe. Write down the date you got it. Collect proof of rent and deposit.",
        },
        {
          id: "ns-2",
          order: 2,
          kind: "self",
          text: "Find the original agreement. Take photos of the flat and the meter readings, if it is safe to do so.",
        },
        {
          id: "ns-3",
          order: 3,
          kind: "official",
          text: "For free help, call legal aid on 15100 or contact your District Legal Services Authority.",
        },
        {
          id: "ns-4",
          order: 4,
          kind: "lawyer",
          text: "If the date is close or you fear being locked out, speak to an advocate or to legal aid soon.",
        },
      ],
      questionsForLawyer: [
        "Is 15 days enough notice for the kind of agreement I have?",
        "What should I do if the owner refuses to return the deposit?",
        "What should I do, and not do, if someone tries to lock me out?",
      ],
    },

    "case-consumer": {
      caseId: "case-consumer",
      overview: {
        oneLine: "A sample warranty card for a washing machine that still leaks after a repair visit.",
        documentOrProblemType: "Product warranty card (sample picture)",
        parties: "You (the buyer) and the sample brand “Sagar Appliances”",
      },
      plainLanguageSummary:
        "The card says the machine has a two-year warranty from the day it was bought. Your notes say the drum still leaks after a technician came. This screen explains the card in simple words. It does not promise a refund, a new machine, or a win in a consumer complaint.",
      keyFacts: [
        "Product on the card: front-load washing machine, model SG-FL70.",
        "Date of purchase printed on the card: 3 March 2025.",
        "Warranty printed on the card: 24 months from purchase.",
        "Your notes say you already paid for one service visit.",
        "Place in your notes: Pune, Maharashtra.",
      ],
      clauses: [
        {
          id: "cl-cover",
          heading: "What the card says is covered",
          plainLanguage:
            "Faults from manufacturing during the warranty period, repaired through authorised service centres.",
          excerpt: "“Covered: manufacturing defects for 24 months from date of purchase.”",
        },
        {
          id: "cl-exclude",
          heading: "What the card says is not covered",
          plainLanguage:
            "Damage from bad plumbing, from objects left inside, or from repair by someone who is not authorised.",
          excerpt: "“Not covered: misuse, unauthorised repair, or installation defects.”",
          whyItMatters:
            "A seller may say the fault is “installation” or “misuse”. Photos and the technician’s job sheet help show what was really done.",
        },
      ],
      obligations: [
        {
          id: "ob-you-keep",
          actor: "you",
          text: "Keep the bill, the warranty card, and every job sheet from the technician.",
        },
        {
          id: "ob-brand",
          actor: "other_party",
          text: "As printed, the brand offers warranty service through authorised centres for the period on the card.",
        },
      ],
      risks: [
        {
          id: "rk-time",
          severity: "attention",
          text: "Warranties run out. Note the end date and do not rely only on spoken promises.",
        },
        {
          id: "rk-cash",
          severity: "attention",
          text: "If you pay cash again without a bill, it is harder to show what you have already spent.",
        },
      ],
      deadlines: [
        {
          id: "dl-warranty",
          label: "Warranty end date, worked out from the purchase date on the sample card",
          date: DEMO_DATES.warrantyEnd,
          urgency: "upcoming",
          note: "Worked out from the sample card. Check the date on your own card.",
        },
      ],
      missingInformation: [
        {
          id: "mi-invoice",
          question: "Where is the purchase bill (GST invoice)?",
          whyNeeded: "The sample picture shows only the warranty card.",
        },
        {
          id: "mi-job",
          question: "Do you have the technician’s job sheet from the last visit?",
          whyNeeded: "It shows what they say they repaired.",
        },
      ],
      evidenceChecklist: [
        { id: "ev-card", label: "Warranty card (sample picture)", status: "have" },
        { id: "ev-invoice", label: "Purchase bill", status: "missing" },
        { id: "ev-job", label: "Service job sheets", status: "missing" },
        { id: "ev-photos", label: "Photos or a short video of the leak", status: "optional" },
      ],
      legalInformation: [
        {
          id: "li-consumer",
          title: "There is an official way to complain about goods and services",
          summary:
            "India has a consumer complaint system with a national helpline (1915) and consumer commissions. This sample does not file anything for you and does not say you would win.",
          verification: "demo_unverified",
        },
      ],
      sources: [
        {
          id: "src-consumer",
          label: "National Consumer Helpline (1915)",
          kind: "procedure_guide",
          url: "https://consumerhelpline.gov.in/",
          note: SOURCE_NOTE,
        },
        {
          id: "src-nalsa",
          label: "National Legal Services Authority (NALSA)",
          kind: "official_body",
          url: "https://nalsa.gov.in/",
          note: SOURCE_NOTE,
        },
      ],
      nextSteps: [
        {
          id: "ns-1",
          order: 1,
          kind: "self",
          text: "Write the story in order: when you bought it, when it first failed, the service visit, what still fails.",
        },
        {
          id: "ns-2",
          order: 2,
          kind: "self",
          text: "Write to the authorised service centre by email or letter, and keep a copy.",
        },
        {
          id: "ns-3",
          order: 3,
          kind: "official",
          text: "To complain officially, call the National Consumer Helpline on 1915. This app does not send a complaint for you.",
        },
        {
          id: "ns-4",
          order: 4,
          kind: "legal_aid",
          text: "If the amount is large and you need help, ask legal aid or an advocate who handles consumer matters.",
        },
      ],
      questionsForLawyer: [
        "On these papers, can I ask for a new machine or a refund, or only another repair?",
        "Should I write to the company in a particular way before I complain?",
        "Is there a time limit for making a consumer complaint?",
      ],
    },

    "case-employment": {
      caseId: "case-employment",
      overview: {
        oneLine: "A sample unpaid-salary problem told in the person’s own words. More papers are still needed.",
        documentOrProblemType: "Problem told in words (no paper uploaded yet)",
        parties: "You and the sample employer “SwiftCart Logistics”",
      },
      plainLanguageSummary:
        "You say you joined in June and that two months’ salary has not been paid. There is no appointment letter in this case yet, so Juris can only arrange what you typed. This sample case is marked “needs you”. It says nothing against any real company.",
      keyFacts: [
        "Job you described: operations associate.",
        "You say you joined in June.",
        "June salary: you say it was paid.",
        "July and August salary: you say they have not been paid.",
        "Proof so far: an offer on WhatsApp and a letter at home. Neither is uploaded here.",
      ],
      clauses: [],
      obligations: [
        {
          id: "ob-you",
          actor: "you",
          text: "Collect the appointment letter, bank statements, and any written messages from HR.",
        },
        {
          id: "ob-hr",
          actor: "other_party",
          text: "You say HR told you accounts is delayed. That is what they said in your story. It has not been checked.",
        },
      ],
      risks: [
        {
          id: "rk-proof",
          severity: "attention",
          text: "Without the written terms and bank proof, it is hard for anyone, even an advocate, to see the full picture.",
        },
        {
          id: "rk-resign",
          severity: "attention",
          text: "Resigning suddenly or sending angry messages can affect later talks. This is not advice to stay or to leave.",
        },
      ],
      deadlines: [
        {
          id: "dl-unknown",
          label: "No official date found in this case",
          urgency: "none",
          note: "Upload the appointment letter if you want dates from a paper to show here.",
        },
      ],
      missingInformation: [
        {
          id: "mi-letter",
          question: "Please add the appointment letter or offer.",
          whyNeeded: "Pay, joining date, and notice rules are usually written there.",
        },
        {
          id: "mi-bank",
          question: "Can you add a bank statement that shows the June salary and the missing months?",
          whyNeeded: "It supports the dates you gave.",
        },
        {
          id: "mi-ctc",
          question: "What monthly salary was agreed?",
          whyNeeded: "Your story does not say the amount.",
        },
      ],
      evidenceChecklist: [
        { id: "ev-desc", label: "Your written story", status: "have" },
        { id: "ev-letter", label: "Appointment or offer letter", status: "missing" },
        { id: "ev-bank", label: "Bank statement", status: "missing" },
        { id: "ev-hr", label: "HR emails or WhatsApp messages", status: "optional" },
      ],
      legalInformation: [
        {
          id: "li-labour",
          title: "There may be official ways to complain about unpaid salary",
          summary:
            "Depending on the kind of work and the employer, the labour department or other bodies may help. This sample does not choose one for you and does not apply any law to SwiftCart, which is a made-up name.",
          verification: "demo_unverified",
        },
      ],
      sources: [
        {
          id: "src-nalsa",
          label: "National Legal Services Authority (NALSA)",
          kind: "official_body",
          url: "https://nalsa.gov.in/",
          note: SOURCE_NOTE,
        },
        {
          id: "src-india",
          label: "India Code (the laws of India, for later reading; not applied here)",
          kind: "legislation_portal",
          url: "https://www.indiacode.nic.in/",
          note: SOURCE_NOTE,
        },
      ],
      nextSteps: [
        {
          id: "ns-1",
          order: 1,
          kind: "self",
          text: "Upload the appointment letter and a bank statement, then come back to this case.",
        },
        {
          id: "ns-2",
          order: 2,
          kind: "self",
          text: "Write a polite note to HR with the date, the months and the amounts not paid. Keep a copy.",
        },
        {
          id: "ns-3",
          order: 3,
          kind: "legal_aid",
          text: "If the company is large or you feel unsafe, contact legal aid or an advocate who handles labour matters. Do not rely on this sample.",
        },
      ],
      questionsForLawyer: [
        "Which papers should I bring to the first meeting?",
        "Is it useful to send a written demand before an official complaint?",
        "Where should a complaint against a private company in Thane be made?",
      ],
    },
  },

  matterLabels: {
    consumer: "Shop / product",
    tenancy: "Rent / house",
    employment: "Job / salary",
    family: "Family",
    criminal_complaint: "Police",
    property: "Land / house",
    documents_id: "ID papers",
    other: "Other",
  },

  generated: {
    sourceNote: SOURCE_NOTE,
    oneLine: (title, matter) => `Sample explanation for “${title}” (${matter}).`,
    typeFromStory: "Problem told in your words (sample)",
    typeFromPaper: "Paper, with or without a story (sample)",
    parties: "You and the other people named in your paper or your story",
    summary: (story) =>
      `This is a sample explanation made for the demo. ${story} Juris has not read your paper and has not asked a real AI model. Treat every heading as an example of the layout, not as a legal opinion.`,
    noStory: "You started this case without writing a story.",
    factPlace: (place) => `Place you entered: ${place}.`,
    factNoPlace: "You did not enter a place.",
    factStartedWith: {
      document: "You started with: a paper.",
      description: "You started with: your story.",
      document_and_description: "You started with: a paper and your story.",
    },
    factNotRead: "No paper is actually read in this demo.",
    clauseHeading: "Sample heading",
    clausePlain: "When Juris can read real papers, the important sentences will appear here in simple words.",
    clauseExcerpt: "“Sample line. It is not taken from your paper.”",
    dutyYou: "Keep your original papers, and a list of what happened and when.",
    dutyOther: "What the other side must do cannot be listed until a real paper is read.",
    risk: "Do not miss the dates on any paper you really received. This demo may not show your real dates.",
    dateLabel: "No date could be read",
    dateNote: "A later version will read dates from your paper.",
    missingQuestion: "Which paper started this problem (a notice, an agreement, a letter)?",
    missingWhy: "A sample cannot guess facts that you did not give.",
    evidenceNotes: "Your notes in Juris",
    evidenceOriginal: "The original paper, with stamps or signatures",
    legalTitle: "Example only, not checked",
    legalSummary:
      "Later versions may suggest topics to read about. This card is a sample. It is not research on your facts.",
    sourceLegalAid: "National Legal Services Authority (NALSA)",
    sourceCourts: "eCourts Services",
    step1: "Write down the dates, the names, and the papers you already have.",
    step2: "If you need a person, call free legal aid on 15100 or see an advocate. This app is not that person.",
    questions: [
      "Which paper do you want to see first?",
      "Which dates on my papers really matter?",
      "What should I not do until we have spoken?",
    ],
  },

  chat: {
    keywords: {
      person: ["lawyer", "advocate", "person", "legal aid"],
      date: ["date", "deadline", "last day"],
      next: ["next", "what should i do", "what to do"],
    },
    prefix: "Sample reply. This is not from a real AI model.",
    date: (label, date) =>
      `The sample case lists “${label}”${date ? ` (${date})` : ""}. Check the date on the real paper in your hand. Juris is not a lawyer.`,
    noDate: "This sample case does not list a date. Juris is not a lawyer.",
    person: "If you want to talk to a person, open Free help for legal aid from the government. Juris does not act for you.",
    nextStep: (step) => `A first step in this sample is: ${step} This is not legal advice.`,
    defaultStep: "collect your papers.",
    overview: (oneLine) =>
      `${oneLine} You can ask about dates, papers, or what to do next. Juris is not a lawyer and does not give legal advice.`,
    defaultOverview: "This sample case has a short explanation on its page.",
  },
};
