import type { CaseAnalysis } from "@/domain/analysis";

const SOURCE_NOTE =
  "Starting point for official information; not a citation for this demo case.";

export const DEMO_ANALYSES: Record<string, CaseAnalysis> = {
  "case-tenancy": {
    caseId: "case-tenancy",
    overview: {
      oneLine: "A fictional leave-and-licence notice asking the occupant to vacate a Bengaluru flat.",
      documentOrProblemType: "Leave and licence / vacancy notice (demo PDF)",
      parties: "Occupant (you) and owner named R. Krishnan in the sample file",
    },
    plainLanguageSummary:
      "This sample paper is written as a notice from a flat owner. In plain words, it says: you have been using the 1BHK under a leave-and-licence arrangement, the owner wants the premises back, and it asks you to leave within 15 days of the notice date. It also mentions the security deposit. This is a demo explanation of a made-up document. It does not decide who is right, and it is not legal advice.",
    keyFacts: [
      "City shown in the sample: Bengaluru, Karnataka.",
      "Arrangement described as leave and licence, not a registered lease (as written in the demo file).",
      "Notice asks the occupant to vacate in 15 days.",
      "Rent is described as paid up to date in your notes.",
      "A security deposit is mentioned; the amount in the demo file is ₹60,000.",
    ],
    clauses: [
      {
        id: "cl-vacate",
        heading: "Request to vacate",
        plainLanguage:
          "The owner asks you to hand back the keys and leave by a stated date. The paper treats this as ending the licence.",
        excerpt:
          "“The Licensee shall vacate and hand over vacant possession within fifteen (15) days of this notice.”",
        whyItMatters:
          "This is the sentence that creates time pressure. Whether that period is fair or enforceable is a question for an advocate, not for this demo.",
      },
      {
        id: "cl-deposit",
        heading: "Security deposit",
        plainLanguage:
          "The notice says the deposit will be settled after inspection for damage, minus unpaid dues if any.",
        excerpt:
          "“The security deposit shall be refunded after deduction of dues and damages, if any.”",
        whyItMatters:
          "Deposit refunds are a common dispute. Keep proof of what you paid and the condition of the flat.",
      },
      {
        id: "cl-lock",
        heading: "Inspection and keys",
        plainLanguage:
          "It asks for a joint inspection and return of all keys and access cards.",
        whyItMatters:
          "A written record of the inspection (photos, a simple note both sides sign) can reduce later arguments.",
      },
    ],
    obligations: [
      {
        id: "ob-you-read",
        actor: "you",
        text: "Read the full notice, keep the file, and note the date you received it.",
      },
      {
        id: "ob-you-rent",
        actor: "you",
        text: "Continue collecting proof of rent already paid (receipts, UPI, bank statements).",
      },
      {
        id: "ob-other",
        actor: "other_party",
        text: "As written, the owner is asking for vacant possession and offering to settle the deposit after inspection.",
      },
      {
        id: "ob-unclear",
        actor: "unclear",
        text: "The demo file does not attach the original leave-and-licence deed, so the exact written terms are incomplete.",
      },
    ],
    risks: [
      {
        id: "rk-time",
        severity: "attention",
        text: "A short vacate period can feel urgent. Do not ignore the paper. Also do not assume you must leave the same day without checking your papers and getting human advice if needed.",
      },
      {
        id: "rk-deposit",
        severity: "attention",
        text: "If you leave without a written handover, the deposit discussion can become harder.",
      },
      {
        id: "rk-lockout",
        severity: "serious",
        text: "If anyone threatens to lock you out or cut utilities, treat that as a serious safety and rights issue and seek official / legal-aid help. This demo does not tell you what a court would do.",
      },
    ],
    deadlines: [
      {
        id: "dl-vacate",
        label: "Vacate date written in the sample notice",
        date: "2026-08-27",
        urgency: "soon",
        note: "Counted from the demo notice date. Confirm the real date on any paper you actually receive.",
      },
      {
        id: "dl-reply",
        label: "Suggested: send a written acknowledgement (demo prompt)",
        date: "2026-08-22",
        urgency: "urgent",
        note: "Not a legal deadline. A calm written record of when you got the notice is often useful.",
      },
    ],
    missingInformation: [
      {
        id: "mi-deed",
        question: "Where is the signed leave-and-licence / rent agreement?",
        whyNeeded: "The notice refers to an arrangement that is not attached in this demo.",
      },
      {
        id: "mi-notice-service",
        question: "How was the notice delivered (WhatsApp, email, post, hand)?",
        whyNeeded: "Delivery details sometimes matter later. This demo cannot see that.",
      },
    ],
    evidenceChecklist: [
      { id: "ev-notice", label: "The vacancy notice (this demo PDF)", status: "have" },
      { id: "ev-rent", label: "Proof of rent paid", status: "missing" },
      { id: "ev-deed", label: "Original agreement / licence deed", status: "missing" },
      { id: "ev-photos", label: "Photos of the flat as it is today", status: "optional" },
      { id: "ev-deposit", label: "Proof of security deposit paid", status: "missing" },
    ],
    legalInformation: [
      {
        id: "li-licence",
        title: "Leave and licence is not the same as every rental story",
        summary:
          "In some cities, people use a “leave and licence” paper. The words on the paper, registration, and local practice all matter. This prototype does not apply any real statute to your facts.",
        verification: "demo_unverified",
      },
      {
        id: "li-aid",
        title: "If you cannot afford a private advocate",
        summary:
          "State Legal Services Authorities and District Legal Services Authorities exist to help eligible people. NALSA publishes information about legal aid. Use official sites, not rumours.",
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
        id: "src-kslsa",
        label: "Karnataka State Legal Services Authority (directory via official legal-aid network)",
        kind: "official_body",
        url: "https://nalsa.gov.in/",
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
        text: "Save the notice, note the date you received it, and collect rent and deposit proofs.",
      },
      {
        id: "ns-2",
        order: 2,
        kind: "self",
        text: "Find the original agreement. Photograph the flat and meter readings if you can do so safely.",
      },
      {
        id: "ns-3",
        order: 3,
        kind: "official",
        text: "If you need free help, look up legal aid through NALSA / your district legal services authority.",
      },
      {
        id: "ns-4",
        order: 4,
        kind: "lawyer",
        text: "If the dates are close or you fear lock-out, speak to a qualified advocate. Use Find an advocate as a preview only in this demo.",
      },
    ],
    questionsForLawyer: [
      "Does this notice actually end my right to stay, given how the original paper was written?",
      "What should I put in a written reply, if anything, and what should I avoid saying?",
      "How should the security deposit and inspection be handled so I am not left without proof?",
      "If the owner changes the locks or cuts water/power, what should I do the same day?",
    ],
  },
  "case-consumer": {
    caseId: "case-consumer",
    overview: {
      oneLine: "A fictional warranty card for a washing machine that still fails after a paid repair.",
      documentOrProblemType: "Product warranty card (demo image)",
      parties: "Buyer (you) and demo brand “Sagar Appliances”",
    },
    plainLanguageSummary:
      "The sample card says the machine is under a two-year manufacturer warranty from the purchase date. Your notes say the drum still leaks after a technician visit. This screen explains the card in everyday language. It does not promise a refund, replacement, or a win at a consumer commission.",
    keyFacts: [
      "Product in the demo: front-load washing machine, model SG-FL70.",
      "Purchase date printed on the card: 3 March 2025.",
      "Warranty period printed: 24 months from purchase.",
      "You already paid for one service visit (as per your description in this prototype).",
      "Location in the case file: Pune, Maharashtra.",
    ],
    clauses: [
      {
        id: "cl-cover",
        heading: "What the card says is covered",
        plainLanguage:
          "Manufacturing defects in the machine during the printed warranty period, with service through authorised centres.",
        excerpt: "“Covered: manufacturing defects for 24 months from date of purchase.”",
      },
      {
        id: "cl-exclude",
        heading: "What the card says is not covered",
        plainLanguage:
          "Damage from poor plumbing, foreign objects, or repairs by someone who is not authorised.",
        excerpt: "“Not covered: misuse, unauthorised repair, or installation defects.”",
        whyItMatters:
          "A seller may argue “installation” or “misuse”. Photos and the job card from the technician help show what was actually done.",
      },
    ],
    obligations: [
      {
        id: "ob-you-keep",
        actor: "you",
        text: "Keep the invoice, warranty card, and every job sheet from the technician.",
      },
      {
        id: "ob-brand",
        actor: "other_party",
        text: "As printed, the brand is offering warranty service through authorised centres during the period on the card.",
      },
    ],
    risks: [
      {
        id: "rk-time",
        severity: "attention",
        text: "Warranty windows run out. Note the printed end date and do not rely on verbal promises alone.",
      },
      {
        id: "rk-cash",
        severity: "attention",
        text: "Paying again in cash without a bill makes it harder to show what you already spent.",
      },
    ],
    deadlines: [
      {
        id: "dl-warranty",
        label: "Printed warranty end date on the demo card",
        date: "2027-03-03",
        urgency: "upcoming",
        note: "Taken from the sample card. Check the date on any real card you hold.",
      },
    ],
    missingInformation: [
      {
        id: "mi-invoice",
        question: "Where is the GST invoice / tax invoice?",
        whyNeeded: "The demo image is only the warranty card.",
      },
      {
        id: "mi-job",
        question: "Do you have the technician’s job sheet from the last visit?",
        whyNeeded: "It shows what they claimed to repair.",
      },
    ],
    evidenceChecklist: [
      { id: "ev-card", label: "Warranty card (demo image)", status: "have" },
      { id: "ev-invoice", label: "Purchase invoice", status: "missing" },
      { id: "ev-job", label: "Service job sheets", status: "missing" },
      { id: "ev-photos", label: "Photos or a short video of the leak", status: "optional" },
    ],
    legalInformation: [
      {
        id: "li-consumer",
        title: "Consumer complaints are a known official path",
        summary:
          "India has a consumer complaint system for goods and services. Portals and commissions exist. This demo does not file anything for you and does not say your case would succeed.",
        verification: "demo_unverified",
      },
    ],
    sources: [
      {
        id: "src-consumer",
        label: "National Consumer Helpline / consumer affairs information",
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
        text: "Write a short timeline: purchase, first fault, service visit, what still fails.",
      },
      {
        id: "ns-2",
        order: 2,
        kind: "self",
        text: "Email or write to the authorised service centre and keep a copy.",
      },
      {
        id: "ns-3",
        order: 3,
        kind: "official",
        text: "If you need a public grievance path, read the National Consumer Helpline site. This app does not submit a complaint.",
      },
      {
        id: "ns-4",
        order: 4,
        kind: "legal_aid",
        text: "If the amount is large and you need help, ask legal aid or a consumer-law advocate.",
      },
    ],
    questionsForLawyer: [
      "Is a replacement or refund realistic on these papers, or only another repair?",
      "Should I write to the company in a particular way before any commission?",
      "What is the usual time limit people watch for consumer complaints, in general terms?",
    ],
  },
  "case-employment": {
    caseId: "case-employment",
    overview: {
      oneLine: "A fictional unpaid-salary situation described in the citizen’s own words — more papers are still needed.",
      documentOrProblemType: "Problem description (no document uploaded yet)",
      parties: "You and demo employer “SwiftCart Logistics”",
    },
    plainLanguageSummary:
      "You say two months’ salary has not been credited after a June joining. There is no appointment letter in this file yet, so Juris can only organise what you typed. This is a demo case that is marked “needs more detail”. It is not a finding against any real company.",
    keyFacts: [
      "Role described: operations associate.",
      "Joining described: June 2026.",
      "June salary: you say it was paid.",
      "July and August: you say they are unpaid.",
      "Proof so far: a WhatsApp offer and a letter at home, not in this file.",
    ],
    clauses: [],
    obligations: [
      {
        id: "ob-you",
        actor: "you",
        text: "Gather the appointment letter, bank statements, and any written HR messages.",
      },
      {
        id: "ob-hr",
        actor: "other_party",
        text: "You report that HR said accounts is delayed. That is their statement in your story, not a verified fact.",
      },
    ],
    risks: [
      {
        id: "rk-proof",
        severity: "attention",
        text: "Without written terms and bank proof, it is harder for anyone — including an advocate — to see the full picture.",
      },
      {
        id: "rk-resign",
        severity: "attention",
        text: "Sudden resignation or angry messages can affect later discussions. This is not advice to stay or leave.",
      },
    ],
    deadlines: [
      {
        id: "dl-unknown",
        label: "No official deadline found in the file",
        urgency: "none",
        note: "Upload the appointment letter if you want this section to show dates from a document.",
      },
    ],
    missingInformation: [
      {
        id: "mi-letter",
        question: "Please add the appointment letter or offer.",
        whyNeeded: "Pay, joining date, and notice rules are usually on that paper.",
      },
      {
        id: "mi-bank",
        question: "Can you add a bank statement showing June credit and missing months?",
        whyNeeded: "It supports the timeline you described.",
      },
      {
        id: "mi-ctc",
        question: "What monthly amount was agreed?",
        whyNeeded: "Your description does not state the figure.",
      },
    ],
    evidenceChecklist: [
      { id: "ev-desc", label: "Your written description", status: "have" },
      { id: "ev-letter", label: "Appointment / offer letter", status: "missing" },
      { id: "ev-bank", label: "Bank statement", status: "missing" },
      { id: "ev-hr", label: "HR emails or WhatsApp export", status: "optional" },
    ],
    legalInformation: [
      {
        id: "li-labour",
        title: "Wage complaints may have official channels",
        summary:
          "Depending on the kind of work and the employer, labour departments and other forums may exist. This demo does not choose a forum for you and does not apply any section of law to SwiftCart (a fictional name).",
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
        label: "India Code (legislation portal — for later reading, not applied here)",
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
        text: "Upload the appointment letter and a bank statement, then return to this case.",
      },
      {
        id: "ns-2",
        order: 2,
        kind: "self",
        text: "Write a polite dated note to HR listing months and amounts unpaid. Keep a copy.",
      },
      {
        id: "ns-3",
        order: 3,
        kind: "legal_aid",
        text: "If the workplace is large or you feel unsafe, contact legal aid or a labour-law advocate rather than relying on this demo.",
      },
    ],
    questionsForLawyer: [
      "What papers are the minimum I should bring to a first consultation?",
      "Is a written demand useful before any official complaint?",
      "Which forum is even in play, given this is a private company in Hyderabad (demo facts)?",
    ],
  },
};
