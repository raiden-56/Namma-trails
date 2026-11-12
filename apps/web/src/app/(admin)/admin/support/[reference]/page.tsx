import type { Metadata } from "next";
import { TicketDetail } from "@/features/admin/SupportAdmin";

export const metadata: Metadata = { title: "Ticket" };

export default async function AdminTicketPage({ params }: { params: Promise<{ reference: string }> }) {
  const { reference } = await params;
  return <TicketDetail reference={reference} />;
}
