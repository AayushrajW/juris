import type { LawyerThread } from "@/domain/thread";

export const DEMO_LAWYER_THREADS: LawyerThread[] = [
  {
    lawyerId: "adv-sharma",
    unreadCount: 2,
    messages: [
      {
        id: "tm-1",
        lawyerId: "adv-sharma",
        role: "lawyer",
        content:
          "Hello Meera. I have looked at the sample notice you shared in this prototype. Please keep the original file and any rent receipts together.",
        createdAt: "2026-08-18T08:12:00.000Z",
      },
      {
        id: "tm-2",
        lawyerId: "adv-sharma",
        role: "user",
        content: "Thank you. I wanted to understand the deposit and the 15-day vacate line before I reply.",
        createdAt: "2026-08-18T08:20:00.000Z",
      },
      {
        id: "tm-3",
        lawyerId: "adv-sharma",
        role: "lawyer",
        content:
          "That is a sensible first question. This chat is a demo — I cannot give live legal advice here. Bring the signed agreement if you speak with a real advocate.",
        createdAt: "2026-08-18T08:26:00.000Z",
      },
    ],
  },
  {
    lawyerId: "adv-menon",
    unreadCount: 1,
    messages: [
      {
        id: "tm-4",
        lawyerId: "adv-menon",
        role: "lawyer",
        content:
          "I can review wage and appointment papers in this preview. Upload what you have on the case page when you are ready.",
        createdAt: "2026-08-17T11:04:00.000Z",
      },
    ],
  },
];
